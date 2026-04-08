import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { scaleLinear, scaleLog, scaleSqrt } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import 'd3-transition'
import { DEFAULT_DOT_COLOR, UNKNOWN_CATEGORY_COLOR } from './palettes'
import type { ScaleContinuousNumeric } from 'd3-scale'
import type { Point, PointsResult, ResolvedFields } from './usePoints'
import type { ColorAssignment } from './palettes'
import { useAppStore } from '@/store/appStore'

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

// Sqrt size scale range, used when size encoding is on. The lower bound is
// big enough to be clickable; upper bound stays restrained so big dots don't
// dominate the chart.
const SIZE_RANGE: [number, number] = [3, 16]

// Fixed-size dot radius when size encoding is off.
const FIXED_DOT_RADIUS = 5

export function ScatterChart({ result }: ScatterChartProps) {
  const metricSource = useAppStore((s) => s.metricSource)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [hover, setHover] = useState<HoverState | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{
    left: number
    top: number
  } | null>(null)

  const { points, fields, colorAssignment } = result

  // Position the tooltip so it never leaves the viewport. Measures the real
  // tooltip width/height after it renders, then clamps its position. Prefer
  // placement above the cursor; flip below if there's no room.
  useLayoutEffect(() => {
    if (!hover) {
      setTooltipPos(null)
      return
    }
    const el = tooltipRef.current
    if (!el) return
    const ttW = el.offsetWidth
    const ttH = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const GAP = 14
    const PAD = 8

    let left = hover.x - ttW / 2
    let top = hover.y - GAP - ttH

    if (top < PAD) top = hover.y + GAP
    if (top + ttH > vh - PAD) top = vh - ttH - PAD
    left = Math.max(PAD, Math.min(vw - ttW - PAD, left))

    setTooltipPos({ left, top })
  }, [hover])

  // Responsive width via ResizeObserver
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

  // Pick which points get labeled. Top 5 by size when size is encoded, else
  // top 5 by y-axis value — keeps the labeled dots associated with whatever
  // is visually prominent.
  const labelIds = useMemo(() => {
    const sortKey = fields.sizeField
      ? (p: Point) => p.size ?? 0
      : (p: Point) => p.y
    const top = [...points].sort((a, b) => sortKey(b) - sortKey(a)).slice(0, 5)
    return new Set(top.map((p) => p.id))
  }, [points, fields.sizeField])

  // Main d3 draw effect — runs whenever any of the inputs change.
  useLayoutEffect(() => {
    if (!svgRef.current) return
    const innerWidth = width - MARGIN.left - MARGIN.right
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom
    if (innerWidth <= 0) return

    const svg = select(svgRef.current)

    // ── Scales ────────────────────────────────────────────────────────────
    const x = buildScale(fields.xField, points, 'x', innerWidth)
    const y = buildScale(fields.yField, points, 'y', innerHeight)

    // Size scale: sqrt for perceptual area-proportionality. Domain is 0 to
    // max-observed (or 1 to avoid empty domain). Only used when size is on.
    const maxSize = points.reduce(
      (m, p) => Math.max(m, p.size ?? 0),
      1,
    )
    const r = scaleSqrt().domain([0, maxSize]).range(SIZE_RANGE)

    // ── Tick values ───────────────────────────────────────────────────────
    const xTicks = pickTicks(fields.xField, x)
    const yTicks = pickTicks(fields.yField, y)

    // ── Plot group ────────────────────────────────────────────────────────
    let plot = svg.select<SVGGElement>('g.plot')
    if (plot.empty()) {
      plot = svg.append('g').attr('class', 'plot')
    }
    plot.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // ── Y grid lines ──────────────────────────────────────────────────────
    let gridY = plot.select<SVGGElement>('g.grid-y')
    if (gridY.empty()) {
      gridY = plot.append('g').attr('class', 'grid-y')
    }
    gridY
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', 'var(--color-border)')
      .attr('stroke-opacity', 0.6)

    // ── X axis ────────────────────────────────────────────────────────────
    let xAxisG = plot.select<SVGGElement>('g.x-axis')
    if (xAxisG.empty()) {
      xAxisG = plot.append('g').attr('class', 'x-axis')
    }
    const xFormat = fields.xField.formatTick ?? ((d: number) => d.toString())
    xAxisG
      .attr('transform', `translate(0,${innerHeight})`)
      .transition()
      .duration(TRANSITION_MS)
      .call(
        axisBottom(x)
          .tickValues(xTicks)
          .tickFormat((d) => xFormat(Number(d)))
          .tickSizeOuter(0),
      )

    styleAxis(xAxisG)

    // ── Y axis ────────────────────────────────────────────────────────────
    let yAxisG = plot.select<SVGGElement>('g.y-axis')
    if (yAxisG.empty()) {
      yAxisG = plot.append('g').attr('class', 'y-axis')
    }
    const yFormat = fields.yField.formatTick ?? ((d: number) => d.toString())
    yAxisG
      .transition()
      .duration(TRANSITION_MS)
      .call(
        axisLeft(y)
          .tickValues(yTicks)
          .tickFormat((d) => yFormat(Number(d)))
          .tickSizeOuter(0),
      )

    styleAxis(yAxisG)

    // ── Axis labels ───────────────────────────────────────────────────────
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

    // ── Dots ──────────────────────────────────────────────────────────────
    const colorFor = makeColorResolver(colorAssignment)

    const dots = plot
      .selectAll<SVGCircleElement, Point>('circle.dot')
      .data(points, (d) => d.id.toString())

    dots
      .exit()
      .transition()
      .duration(TRANSITION_MS / 2)
      .attr('r', 0)
      .attr('opacity', 0)
      .remove()

    const dotsEnter = dots
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', (d) => x(d.x))
      .attr('cy', (d) => y(d.y))
      .attr('r', 0)
      .attr('opacity', 0)
      .attr('stroke', 'var(--color-slu-700)')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')

    dotsEnter
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
      .transition()
      .duration(TRANSITION_MS)
      .attr('cx', (d) => x(d.x))
      .attr('cy', (d) => y(d.y))
      .attr('r', (d) =>
        fields.sizeField ? r(d.size ?? 0) : FIXED_DOT_RADIUS,
      )
      .attr('opacity', 0.6)

    // ── Outlier labels with collision avoidance ───────────────────────────
    drawLabels({
      plot,
      points,
      labelIds,
      x,
      y,
      r,
      hasSize: fields.sizeField != null,
      innerWidth,
      innerHeight,
    })
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
        className="block overflow-visible"
      />
      {hover ? (
        <Tooltip
          ref={tooltipRef}
          point={hover.point}
          fields={fields}
          metricSource={metricSource}
          pos={tooltipPos}
        />
      ) : null}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

type Scale = ScaleContinuousNumeric<number, number>

// Builds a scale appropriate for the field. Log scales clamp the lower bound
// to 1 to avoid log(0); explicit field domains override the data-derived
// range entirely.
function buildScale(
  field: { scale: 'log' | 'linear'; domain?: [number, number] },
  points: ReadonlyArray<Point>,
  axis: 'x' | 'y',
  innerSize: number,
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
      // Clamp to >=1 for log; cap upper bound for very long tails (works,
      // citations) using a half-decade rounding so the axis doesn't waste
      // space on a couple of outliers.
      const lo = Math.max(1, minObs)
      const hi = Math.max(lo + 1, maxObs)
      domain = [lo, hi]
    } else {
      // Linear: a tiny pad on each side keeps the extreme dots from sitting
      // on the axes themselves.
      const span = Math.max(1, maxObs - minObs)
      const pad = span * 0.05
      domain = [minObs - pad, maxObs + pad]
    }
  }

  const range: [number, number] =
    axis === 'x' ? [0, innerSize] : [innerSize, 0]

  if (field.scale === 'log') {
    return scaleLog().domain(domain).range(range)
  }
  return scaleLinear().domain(domain).range(range).nice()
}

// Picks tick values for an axis. If the field declares its own tickValues,
// filter them to the current domain. Otherwise let the scale choose.
function pickTicks(
  field: { scale: 'log' | 'linear'; tickValues?: ReadonlyArray<number> },
  scale: Scale,
): Array<number> {
  const [lo, hi] = scale.domain() as [number, number]
  if (field.tickValues) {
    return field.tickValues.filter((t) => t >= lo && t <= hi)
  }
  // Default: use the scale's own ticks. For linear, asks for ~6 ticks.
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

// ─── Outlier label rendering ──────────────────────────────────────────────

interface DrawLabelsArgs {
  plot: ReturnType<typeof select<SVGGElement, unknown>>
  points: ReadonlyArray<Point>
  labelIds: ReadonlySet<number>
  x: Scale
  y: Scale
  // d3-scale's sqrt scale has overloaded call signatures that confuse
  // inference downstream; narrowing to (number) => number avoids that.
  r: (value: number) => number
  hasSize: boolean
  innerWidth: number
  innerHeight: number
}

interface PlacedLabel {
  point: Point
  x: number
  y: number
  anchor: 'start' | 'end'
}

const CHAR_WIDTH = 6.3
const LABEL_HEIGHT = 14
const LABEL_PAD = 4

function drawLabels({
  plot,
  points,
  labelIds,
  x,
  y,
  r,
  hasSize,
  innerWidth,
  innerHeight,
}: DrawLabelsArgs): void {
  const labelPoints = points
    .filter((p) => labelIds.has(p.id))
    .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))

  const placed: Array<PlacedLabel> = []
  for (const p of labelPoints) {
    const dotX = x(p.x)
    const dotY = y(p.y)
    const radius = hasSize ? r(p.size ?? 0) : FIXED_DOT_RADIUS
    const anchor: 'start' | 'end' =
      dotX > innerWidth * 0.65 ? 'end' : 'start'
    const labelOffset = radius + 5
    const labelX =
      anchor === 'end' ? dotX - labelOffset : dotX + labelOffset
    let labelY = dotY
    const textWidth = p.lastName.length * CHAR_WIDTH

    const overlaps = (cy: number): boolean => {
      const aLeft = anchor === 'start' ? labelX : labelX - textWidth
      const aRight = anchor === 'start' ? labelX + textWidth : labelX
      const aTop = cy - LABEL_HEIGHT / 2
      const aBottom = cy + LABEL_HEIGHT / 2
      for (const pl of placed) {
        const plText = pl.point.lastName.length * CHAR_WIDTH
        const bLeft = pl.anchor === 'start' ? pl.x : pl.x - plText
        const bRight = pl.anchor === 'start' ? pl.x + plText : pl.x
        const bTop = pl.y - LABEL_HEIGHT / 2
        const bBottom = pl.y + LABEL_HEIGHT / 2
        if (
          aLeft < bRight + LABEL_PAD &&
          aRight > bLeft - LABEL_PAD &&
          aTop < bBottom + LABEL_PAD &&
          aBottom > bTop - LABEL_PAD
        ) {
          return true
        }
      }
      return false
    }

    if (overlaps(labelY)) {
      let offset = LABEL_HEIGHT + LABEL_PAD
      let found = false
      for (let tries = 0; tries < 6; tries++) {
        if (!overlaps(labelY - offset)) {
          labelY = labelY - offset
          found = true
          break
        }
        if (!overlaps(labelY + offset)) {
          labelY = labelY + offset
          found = true
          break
        }
        offset += LABEL_HEIGHT + LABEL_PAD
      }
      if (!found) labelY = dotY
    }

    labelY = Math.max(
      LABEL_HEIGHT / 2,
      Math.min(innerHeight - LABEL_HEIGHT / 2, labelY),
    )

    placed.push({ point: p, x: labelX, y: labelY, anchor })
  }

  const labels = plot
    .selectAll<SVGTextElement, PlacedLabel>('text.label')
    .data(placed, (d) => d.point.id.toString())

  labels
    .exit()
    .transition()
    .duration(TRANSITION_MS / 2)
    .attr('opacity', 0)
    .remove()

  const labelsEnter = labels
    .enter()
    .append('text')
    .attr('class', 'label')
    .attr('fill', 'var(--color-foreground)')
    .attr('font-size', 11)
    .attr('font-weight', 500)
    .attr('dominant-baseline', 'middle')
    .attr('x', (d) => d.x)
    .attr('y', (d) => d.y)
    .attr('text-anchor', (d) => d.anchor)
    .attr('opacity', 0)
    .style('pointer-events', 'none')
    .style('font-variant-numeric', 'tabular-nums')
    .style('paint-order', 'stroke')
    .style('stroke', 'var(--color-background)')
    .style('stroke-width', '3px')
    .style('stroke-linejoin', 'round')

  labelsEnter
    .merge(labels)
    .text((d) => d.point.lastName)
    .attr('text-anchor', (d) => d.anchor)
    .transition()
    .duration(TRANSITION_MS)
    .attr('x', (d) => d.x)
    .attr('y', (d) => d.y)
    .attr('opacity', 1)
}

// ─── Tooltip ──────────────────────────────────────────────────────────────

interface TooltipProps {
  ref: React.RefObject<HTMLDivElement | null>
  point: Point
  fields: ResolvedFields
  metricSource: ReturnType<typeof useAppStore.getState>['metricSource']
  pos: { left: number; top: number } | null
}

function Tooltip({ ref, point, fields, pos }: TooltipProps) {
  return (
    <div
      ref={ref}
      className="bg-popover text-popover-foreground animate-in fade-in-0 pointer-events-none fixed z-50 max-w-[280px] min-w-[180px] rounded-md border p-2.5 shadow-md duration-100 ease-out"
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <div className="text-[13px] font-medium">{point.name}</div>
      <div className="text-muted-foreground mt-0.5 text-[11px]">
        {point.department}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2 text-[11px]">
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
        {fields.colorField ? (
          <TooltipStat
            label={fields.colorField.label}
            value={point.colorValue ?? '—'}
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
