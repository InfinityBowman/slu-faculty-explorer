import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { scaleLinear, scaleLog, scaleSqrt } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom'
import 'd3-transition'
import { Maximize2 } from 'lucide-react'
import { DEFAULT_DOT_COLOR, UNKNOWN_CATEGORY_COLOR } from './palettes'
import { drawLabels } from './labels'
import type { ScaleContinuousNumeric } from 'd3-scale'
import type { D3ZoomEvent, ZoomBehavior, ZoomTransform } from 'd3-zoom'
import type { Point, PointsResult, ResolvedFields } from './usePoints'
import type { ColorAssignment } from './palettes'
import { cn } from '@/lib/utils'

interface ScatterChartProps {
  result: PointsResult
}

interface HoverState {
  point: Point
  x: number
  y: number
}

const MARGIN = { top: 16, right: 28, bottom: 44, left: 64 }
const HEIGHT = 340
const TRANSITION_MS = 450

// Pan/zoom config. Lower bound under 1 lets the user pull out past the
// default fit-to-data view when they want more breathing room around the
// dots. Upper bound of 20 resolves individual dots in dense clusters.
const SCALE_EXTENT: [number, number] = [0.5, 20]

// Sqrt size scale range, used when size encoding is on.
const SIZE_RANGE: [number, number] = [3, 16]
const FIXED_DOT_RADIUS = 5

// Estimated tooltip dimensions used for viewport clamping. The tooltip has a
// bounded width via CSS and a single-row stats block (X, Y, optional size),
// so the rendered height stays near-constant and the estimate is accurate
// enough to skip measuring the real element.
const TOOLTIP_WIDTH = 220
const TOOLTIP_HEIGHT = 108
const TOOLTIP_GAP = 14
const TOOLTIP_PAD = 8

function computeTooltipPosition(
  x: number,
  y: number,
): { left: number; top: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Prefer above the cursor, centered horizontally
  let left = x - TOOLTIP_WIDTH / 2
  let top = y - TOOLTIP_GAP - TOOLTIP_HEIGHT

  // Flip below if it would clip the top of the viewport
  if (top < TOOLTIP_PAD) {
    top = y + TOOLTIP_GAP
  }
  // Clamp bottom
  if (top + TOOLTIP_HEIGHT > vh - TOOLTIP_PAD) {
    top = vh - TOOLTIP_HEIGHT - TOOLTIP_PAD
  }
  // Clamp horizontally
  left = Math.max(
    TOOLTIP_PAD,
    Math.min(vw - TOOLTIP_WIDTH - TOOLTIP_PAD, left),
  )

  return { left, top }
}

export function ScatterChart({ result }: ScatterChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Current zoom transform — kept in a ref so width changes preserve the
  // user's view across renders without round-tripping through React state.
  const transformRef = useRef<ZoomTransform>(zoomIdentity)
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(
    null,
  )
  // Tracks the identity of the points list so we can reset zoom when filters
  // (or any non-width input) change the dataset out from under the user.
  const prevPointsKeyRef = useRef<string>('')

  const [width, setWidth] = useState(800)
  const [hover, setHover] = useState<HoverState | null>(null)
  // `displayedHover` lags `hover` on exits by the tooltip's transition
  // duration, so the tooltip can animate out before unmounting.
  const [displayedHover, setDisplayedHover] = useState<HoverState | null>(null)
  const [isZoomed, setIsZoomed] = useState(false)

  useEffect(() => {
    if (hover) {
      setDisplayedHover(hover)
      return
    }
    // Keep the last-hovered point displayed while the exit transition runs,
    // then unmount. Canceling the timeout on hover coming back lets the
    // tooltip smoothly reuse its div for the next point.
    const timeout = setTimeout(() => setDisplayedHover(null), 150)
    return () => clearTimeout(timeout)
  }, [hover])

  const { points, fields, colorAssignment } = result

  // Responsive width.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) setWidth(Math.floor(w))
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [])

  // Top-N points eligible for labeling. By size when size is encoded, else by
  // Y value — keeps labels associated with whatever is visually prominent.
  const labelIds = useMemo(() => {
    const sortKey = fields.sizeField
      ? (p: Point) => p.size ?? 0
      : (p: Point) => p.y
    const top = [...points].sort((a, b) => sortKey(b) - sortKey(a)).slice(0, 5)
    return new Set(top.map((p) => p.id))
  }, [points, fields.sizeField])

  // Smooth-reset to identity, called by the reset button and double-click.
  const resetZoom = (): void => {
    const svgEl = svgRef.current
    const zb = zoomBehaviorRef.current
    if (!svgEl || !zb) return
    select(svgEl).transition().duration(400).call(zb.transform, zoomIdentity)
  }

  // Main d3 effect — full rebuild when any of points/fields/color/width
  // changes. Pan/zoom updates are handled inline by calling draw() with
  // rescaled scales, *without* re-running this effect.
  useLayoutEffect(() => {
    if (!svgRef.current) return
    const innerWidth = width - MARGIN.left - MARGIN.right
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom
    if (innerWidth <= 0) return

    const svg = select(svgRef.current)

    // Reset preserved zoom when the dataset changes (filter toggle, source
    // change, color toggle). Width changes alone preserve the current view.
    const pointsKey = points.map((p) => p.id).join('|')
    const dataChanged = prevPointsKeyRef.current !== pointsKey
    prevPointsKeyRef.current = pointsKey
    if (dataChanged) {
      transformRef.current = zoomIdentity
      setIsZoomed((prev) => (prev ? false : prev))
    }

    // ── Base scales ─────────────────────────────────────────────────────
    const xBase = buildScale(fields.xField, points, 'x', innerWidth, innerHeight)
    const yBase = buildScale(fields.yField, points, 'y', innerWidth, innerHeight)

    const maxSize = points.reduce((m, p) => Math.max(m, p.size ?? 0), 1)
    const rScale = scaleSqrt().domain([0, maxSize]).range(SIZE_RANGE)
    const radiusOf = (p: Point): number =>
      fields.sizeField ? rScale(p.size ?? 0) : FIXED_DOT_RADIUS

    const colorFor = makeColorResolver(colorAssignment)

    // ── Plot group + clip path ──────────────────────────────────────────
    let plot = svg.select<SVGGElement>('g.plot')
    if (plot.empty()) {
      plot = svg.append('g').attr('class', 'plot')
    }
    plot.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    let defs = svg.select<SVGDefsElement>('defs')
    if (defs.empty()) {
      defs = svg.append('defs')
    }
    let clipPath = defs.select<SVGClipPathElement>('#scatter-clip')
    if (clipPath.empty()) {
      clipPath = defs.append('clipPath').attr('id', 'scatter-clip')
      clipPath.append('rect')
    }
    clipPath
      .select('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)

    // Grid (clipped — should stop at the plot edge when zoomed)
    let gridY = plot.select<SVGGElement>('g.grid-y')
    if (gridY.empty()) {
      gridY = plot
        .append('g')
        .attr('class', 'grid-y')
        .attr('clip-path', 'url(#scatter-clip)')
    }

    // Overlay group for dots + labels (clipped)
    let overlay = plot.select<SVGGElement>('g.overlay')
    if (overlay.empty()) {
      overlay = plot
        .append('g')
        .attr('class', 'overlay')
        .attr('clip-path', 'url(#scatter-clip)')
    }

    // Axis containers (NOT clipped — they live in the margin)
    let xAxisG = plot.select<SVGGElement>('g.x-axis')
    if (xAxisG.empty()) {
      xAxisG = plot.append('g').attr('class', 'x-axis')
    }
    xAxisG.attr('transform', `translate(0,${innerHeight})`)

    let yAxisG = plot.select<SVGGElement>('g.y-axis')
    if (yAxisG.empty()) {
      yAxisG = plot.append('g').attr('class', 'y-axis')
    }

    // Axis labels (static)
    let xLabel = plot.select<SVGTextElement>('text.x-label')
    if (xLabel.empty()) {
      xLabel = plot
        .append('text')
        .attr('class', 'x-label')
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--color-muted-foreground)')
        .attr('font-size', 10)
        .attr('letter-spacing', '0.06em')
    }
    xLabel
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 36)
      .text(fields.xField.label.toUpperCase())

    let yLabel = plot.select<SVGTextElement>('text.y-label')
    if (yLabel.empty()) {
      yLabel = plot
        .append('text')
        .attr('class', 'y-label')
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--color-muted-foreground)')
        .attr('font-size', 10)
        .attr('letter-spacing', '0.06em')
    }
    yLabel
      .attr('transform', `translate(${-50},${innerHeight / 2}) rotate(-90)`)
      .text(fields.yField.label.toUpperCase())

    // ── The draw function ───────────────────────────────────────────────
    // Called once for the initial / data-change render (animated=true) and
    // then on every zoom event (animated=false). Redraws grid, axes, dots,
    // labels using the (possibly rescaled) x/y scales it's handed.
    const draw = (xScale: Scale, yScale: Scale, animated: boolean): void => {
      const dur = animated ? TRANSITION_MS : 0

      const xTicks = pickTicks(fields.xField, xScale)
      const yTicks = pickTicks(fields.yField, yScale)

      // Grid
      gridY
        .selectAll<SVGLineElement, number>('line')
        .data(yTicks)
        .join('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', 'var(--color-border)')
        .attr('stroke-opacity', 0.6)

      // X axis
      const xFormat = fields.xField.formatTick ?? defaultFormat
      const xAxisCall = axisBottom(xScale)
        .tickValues(xTicks)
        .tickFormat((d) => xFormat(Number(d)))
        .tickSizeOuter(0)
      if (animated) {
        xAxisG.transition().duration(dur).call(xAxisCall)
      } else {
        xAxisG.call(xAxisCall)
      }
      styleAxis(xAxisG)

      // Y axis
      const yFormat = fields.yField.formatTick ?? defaultFormat
      const yAxisCall = axisLeft(yScale)
        .tickValues(yTicks)
        .tickFormat((d) => yFormat(Number(d)))
        .tickSizeOuter(0)
      if (animated) {
        yAxisG.transition().duration(dur).call(yAxisCall)
      } else {
        yAxisG.call(yAxisCall)
      }
      styleAxis(yAxisG)

      // Dots — enter / update / exit inside the clipped overlay
      const dots = overlay
        .selectAll<SVGCircleElement, Point>('circle.dot')
        .data(points, (d) => d.id.toString())

      dots
        .exit()
        .transition()
        .duration(animated ? TRANSITION_MS / 2 : 0)
        .attr('r', 0)
        .attr('opacity', 0)
        .remove()

      const dotsEnter = dots
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('cx', (d) => xScale(d.x))
        .attr('cy', (d) => yScale(d.y))
        .attr('r', 0)
        .attr('opacity', 0)
        .attr('stroke', 'var(--color-slu-700)')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')

      const dotsMerged = dotsEnter
        .merge(dots)
        .on('mouseenter', function (event: MouseEvent, d: Point) {
          setHover({ point: d, x: event.clientX, y: event.clientY })
          select(this).attr('stroke-width', 1.5)
        })
        .on('mousemove', function (event: MouseEvent, d: Point) {
          setHover({ point: d, x: event.clientX, y: event.clientY })
        })
        .on('mouseleave', function () {
          setHover(null)
          select(this).attr('stroke-width', 0.5)
        })
        .attr('fill', (d) => colorFor(d.colorValue))

      if (animated) {
        dotsMerged
          .transition()
          .duration(dur)
          .attr('cx', (d) => xScale(d.x))
          .attr('cy', (d) => yScale(d.y))
          .attr('r', radiusOf)
          .attr('opacity', 0.6)
      } else {
        // Direct attribute updates — avoid interrupting the initial enter
        // transition mid-animation if the user starts zooming immediately,
        // and skip the transition overhead on every wheel tick.
        dotsMerged
          .interrupt()
          .attr('cx', (d) => xScale(d.x))
          .attr('cy', (d) => yScale(d.y))
          .attr('r', radiusOf)
          .attr('opacity', 0.6)
      }

      // Labels — viewport-filtered so they don't pile up at edges when zoomed
      drawLabels({
        overlay,
        points,
        labelIds,
        xPx: (p) => xScale(p.x),
        yPx: (p) => yScale(p.y),
        radiusOf,
        innerWidth,
        innerHeight,
        animated,
        transitionMs: TRANSITION_MS,
      })
    }

    // Initial draw — apply any preserved transform (from a width change) so
    // the view is continuous across resizes.
    const xInitial = transformRef.current.rescaleX(xBase)
    const yInitial = transformRef.current.rescaleY(yBase)
    draw(xInitial, yInitial, true)

    // ── Zoom behavior ───────────────────────────────────────────────────
    // Recreated each effect run because scales and extents depend on width.
    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent(SCALE_EXTENT)
      .translateExtent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])
      .filter(
        (event: Event) =>
          (!(event as MouseEvent).ctrlKey || event.type === 'wheel') &&
          !(event as MouseEvent).button,
      )
      .on('start', () => {
        // Hide the tooltip as soon as a pan/zoom gesture begins — the point
        // under the cursor is about to move and a stale tooltip would feel
        // broken.
        setHover(null)
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        transformRef.current = event.transform
        const zoomedIn =
          event.transform.k !== 1 ||
          event.transform.x !== 0 ||
          event.transform.y !== 0
        setIsZoomed((prev) => (prev !== zoomedIn ? zoomedIn : prev))
        const nx = event.transform.rescaleX(xBase)
        const ny = event.transform.rescaleY(yBase)
        draw(nx, ny, false)
      })

    svg.call(zoomBehavior).on('dblclick.zoom', null)
    // Override d3-zoom's default "zoom in 2x on dblclick" — for an analytical
    // dashboard, smooth-reset is much more useful.
    svg.on('dblclick', () => {
      svg
        .transition()
        .duration(400)
        .call(zoomBehavior.transform, zoomIdentity)
    })

    // Sync d3-zoom's internal state with our preserved transform so the next
    // wheel/drag continues from the current view (e.g. after a resize).
    if (transformRef.current !== zoomIdentity) {
      svg.call(zoomBehavior.transform, transformRef.current)
    }

    zoomBehaviorRef.current = zoomBehavior
  }, [points, fields, colorAssignment, labelIds, width])

  if (points.length === 0) {
    return (
      <div
        ref={containerRef}
        className="text-muted-foreground flex items-center justify-center text-sm"
        style={{ height: HEIGHT }}
      >
        No faculty with values for both axes in the current filters.
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative min-w-0">
      <svg
        ref={svgRef}
        width={width}
        height={HEIGHT}
        className="block cursor-grab overflow-visible select-none active:cursor-grabbing"
      />

      {isZoomed ? (
        <button
          type="button"
          onClick={resetZoom}
          className="bg-card hover:bg-muted animate-in fade-in-0 absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium shadow-sm transition-colors duration-150"
        >
          <Maximize2 className="size-3" />
          Reset zoom
        </button>
      ) : null}

      {!isZoomed ? (
        <div className="text-muted-foreground pointer-events-none absolute top-2 right-3 text-[10px] tracking-wide uppercase select-none">
          Scroll to zoom · drag to pan
        </div>
      ) : null}

      {displayedHover ? (
        <Tooltip
          point={displayedHover.point}
          fields={fields}
          pos={computeTooltipPosition(displayedHover.x, displayedHover.y)}
          isOpen={hover != null}
        />
      ) : null}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

type Scale = ScaleContinuousNumeric<number, number>

function defaultFormat(d: number): string {
  return d.toString()
}

// Builds a scale appropriate for the field. Explicit field domains override
// the data-derived range entirely. Otherwise:
//  - log scales clamp the lower bound to 1 (to avoid log(0)) and round the
//    upper bound UP to the next declared tick value, so the extreme dot
//    isn't glued to the plot edge
//  - linear scales add a small proportional pad on both ends
function buildScale(
  field: {
    scale: 'log' | 'linear'
    domain?: [number, number]
    tickValues?: ReadonlyArray<number>
  },
  points: ReadonlyArray<Point>,
  axis: 'x' | 'y',
  innerWidth: number,
  innerHeight: number,
): Scale {
  const accessor = axis === 'x' ? (p: Point) => p.x : (p: Point) => p.y

  let domain: [number, number]
  if (field.domain) {
    domain = field.domain
  } else {
    const values = points.map(accessor)
    const minObs = values.length > 0 ? Math.min(...values) : 0
    const maxObs = values.length > 0 ? Math.max(...values) : 1
    if (field.scale === 'log') {
      // Pin the lower bound to the field's first declared tick (usually 1)
      // rather than minObs. Otherwise the lowest actual dot ends up glued
      // to the plot floor and gets half-clipped.
      const firstTick = field.tickValues?.[0] ?? 1
      const lo = Math.max(1, firstTick)
      const paddedMax = roundUpToNextTick(maxObs, field.tickValues)
      // Fall back to a proportional bump if no tick is big enough (or the
      // field has no declared ticks) so the dot still has breathing room.
      const hi = Math.max(lo + 1, paddedMax ?? maxObs * 1.25)
      domain = [lo, hi]
    } else {
      const span = Math.max(1, maxObs - minObs)
      const pad = span * 0.08
      domain = [minObs - pad, maxObs + pad]
    }
  }

  const range: [number, number] =
    axis === 'x' ? [0, innerWidth] : [innerHeight, 0]

  if (field.scale === 'log') {
    return scaleLog().domain(domain).range(range)
  }
  return scaleLinear().domain(domain).range(range).nice()
}

// Returns the smallest tick value >= target, or null if the field has no
// declared ticks. Mirrors the old chart's half-decade rounding so log axes
// always extend past their extreme data points.
function roundUpToNextTick(
  target: number,
  ticks: ReadonlyArray<number> | undefined,
): number | null {
  if (!ticks || ticks.length === 0) return null
  for (const t of ticks) {
    if (t >= target) return t
  }
  // Target exceeds the largest declared tick — extend past it proportionally
  // so the dot still has breathing room instead of being clipped.
  return target * 1.25
}

// Picks tick values for an axis. If the field declares its own tickValues,
// filter them to the current (possibly zoomed) domain. Falls back to d3's
// default ticks when fewer than two declared ticks land in view — that way
// zooming in tight enough doesn't leave the axis empty.
function pickTicks(
  field: { scale: 'log' | 'linear'; tickValues?: ReadonlyArray<number> },
  scale: Scale,
): Array<number> {
  const [lo, hi] = scale.domain() as [number, number]
  if (field.tickValues) {
    const filtered = field.tickValues.filter((t) => t >= lo && t <= hi)
    if (filtered.length >= 2) return filtered
    return scale.ticks(5)
  }
  return scale.ticks(6)
}

function styleAxis(g: ReturnType<typeof select<SVGGElement, unknown>>): void {
  g.selectAll('path.domain').attr('stroke', 'var(--color-border)')
  g.selectAll('line')
    .attr('stroke', 'var(--color-border)')
    .attr('stroke-opacity', 0.8)
  g.selectAll('text')
    .attr('fill', 'var(--color-muted-foreground)')
    .attr('font-size', 11)
    .attr('font-family', 'inherit')
}

function makeColorResolver(
  assignment: ColorAssignment | null,
): (value: string | null) => string {
  if (!assignment) return () => DEFAULT_DOT_COLOR
  return (value) => {
    if (value == null) return UNKNOWN_CATEGORY_COLOR
    return assignment.lookup.get(value) ?? UNKNOWN_CATEGORY_COLOR
  }
}

// ─── Tooltip ──────────────────────────────────────────────────────────────

interface TooltipProps {
  point: Point
  fields: ResolvedFields
  pos: { left: number; top: number }
  isOpen: boolean
}

function Tooltip({ point, fields, pos, isOpen }: TooltipProps) {
  return (
    <div
      data-state={isOpen ? 'open' : 'closed'}
      className={cn(
        'bg-popover text-popover-foreground pointer-events-none fixed z-50 max-w-[280px] min-w-[180px] rounded-md border p-2.5 shadow-md',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'duration-150 ease-out',
      )}
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="text-[13px] font-medium">{point.name}</div>
      <div className="text-muted-foreground mt-0.5 text-[11px]">
        {point.department}
      </div>
      <div className="mt-2 flex gap-4 border-t pt-2 text-[11px]">
        <TooltipStat
          label={fields.xField.label}
          value={formatTooltipValue(fields.xField, point.x)}
        />
        <TooltipStat
          label={fields.yField.label}
          value={formatTooltipValue(fields.yField, point.y)}
        />
        {fields.sizeField && point.size != null ? (
          <TooltipStat
            label={fields.sizeField.label}
            value={formatTooltipValue(fields.sizeField, point.size)}
          />
        ) : null}
      </div>
    </div>
  )
}

function TooltipStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[9px] tracking-wider uppercase">
        {label}
      </div>
      <div className="tabular font-medium">{value}</div>
    </div>
  )
}

function formatTooltipValue(
  field: { formatValue?: (n: number) => string; formatTick?: (n: number) => string },
  value: number,
): string {
  if (field.formatValue) return field.formatValue(value)
  if (field.formatTick) return field.formatTick(value)
  return value.toString()
}

