import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { scaleLog, scaleSqrt } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom'
import 'd3-transition'
import { Maximize2 } from 'lucide-react'
import type { D3ZoomEvent, ZoomBehavior, ZoomTransform } from 'd3-zoom'
import type { Faculty } from '@/lib/types'
import { useAppStore } from '@/store/appStore'

interface ScatterChartProps {
  rows: Array<Faculty>
}

interface Point {
  id: number
  name: string
  lastName: string
  department: string
  works: number
  citations: number
  hIndex: number
}

interface HoverState {
  point: Point
  x: number
  y: number
}

const MARGIN = { top: 16, right: 28, bottom: 44, left: 56 }
const HEIGHT = 340
const TRANSITION_MS = 450

// Pan/zoom config — 20x max zoom is enough to resolve individual dots in the
// dense Medicine/SSE cluster without the user getting lost in empty pixels.
const SCALE_EXTENT: [number, number] = [1, 20]

// Estimated tooltip dimensions used for viewport clamping. The tooltip has
// a `min-w-[160px] max-w-[280px]`, and a fixed content shape (name + dept +
// 3 metric cells), so estimation is accurate enough within the clamp range.
const TOOLTIP_WIDTH = 220
const TOOLTIP_HEIGHT = 108
const TOOLTIP_GAP = 14
const TOOLTIP_PAD = 8

function computeTooltipPosition(x: number, y: number): {
  left: number
  top: number
} {
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

export function ScatterChart({ rows }: ScatterChartProps) {
  const metricSource = useAppStore((s) => s.metricSource)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  // Current zoom transform — stored in a ref so it survives re-renders from
  // width changes without causing a re-render loop.
  const transformRef = useRef<ZoomTransform>(zoomIdentity)
  const zoomBehaviorRef = useRef<ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>(null)
  // Track points identity so we can reset zoom when filters change the dataset
  const prevPointsKeyRef = useRef<string>('')
  const [width, setWidth] = useState(800)
  const [hover, setHover] = useState<HoverState | null>(null)
  const [isZoomed, setIsZoomed] = useState(false)

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

  // Build points from filtered rows + selected metric source
  const points = useMemo<Array<Point>>(() => {
    const out: Array<Point> = []
    for (const f of rows) {
      const works = f.openalexWorksCount
      const citations =
        metricSource === 'scholar' ? f.citations : f.openalexCitations
      const hIndex = metricSource === 'scholar' ? f.hIndex : f.openalexHIndex
      if (works == null || citations == null || hIndex == null) continue
      if (works <= 0 || citations <= 0) continue
      const parts = f.name.split(' ')
      out.push({
        id: f.id,
        name: f.name,
        lastName: parts[parts.length - 1] ?? f.name,
        department: f.department,
        works,
        citations,
        hIndex,
      })
    }
    return out
  }, [rows, metricSource])

  // Top 5 by h-index get labeled
  const labelIds = useMemo(() => {
    const top = [...points].sort((a, b) => b.hIndex - a.hIndex).slice(0, 5)
    return new Set(top.map((p) => p.id))
  }, [points])

  // Called by reset button + double-click
  const resetZoom = () => {
    const svgEl = svgRef.current
    const zb = zoomBehaviorRef.current
    if (!svgEl || !zb) return
    select(svgEl).transition().duration(400).call(zb.transform, zoomIdentity)
  }

  // Main d3 draw effect
  useLayoutEffect(() => {
    if (!svgRef.current) return
    const innerWidth = width - MARGIN.left - MARGIN.right
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom
    if (innerWidth <= 0) return

    const svg = select(svgRef.current)

    // Reset zoom on data change (filter toggle, source change). Width changes
    // alone preserve the current view.
    const pointsKey = points.map((p) => p.id).join('|')
    const dataChanged = prevPointsKeyRef.current !== pointsKey
    prevPointsKeyRef.current = pointsKey
    if (dataChanged) {
      transformRef.current = zoomIdentity
      setIsZoomed((prev) => (prev ? false : prev))
    }

    // Compute scale domains
    const maxWorks = points.reduce((m, p) => Math.max(m, p.works), 10)
    const maxCites = points.reduce((m, p) => Math.max(m, p.citations), 10)
    const maxH = points.reduce((m, p) => Math.max(m, p.hIndex), 1)

    // X uses half-decade ticks ([1, 3, 10, 30, 100, 300, 1k, 3k, 5k]) capped
    // at 5k so a handful of very prolific OpenAlex authors don't stretch the
    // axis into wasted space. Y keeps clean power-of-10 ticks via .nice().
    const X_TICK_VALUES = [1, 3, 10, 30, 100, 300, 1000, 3000, 5000]
    const X_MAX_CAP = 5000
    const roundUpToTick = (v: number, ticks: Array<number>): number => {
      for (const t of ticks) {
        if (t >= v) return t
      }
      return ticks[ticks.length - 1]
    }
    const xMax = Math.min(X_MAX_CAP, roundUpToTick(maxWorks, X_TICK_VALUES))

    const xBase = scaleLog().domain([1, xMax]).range([0, innerWidth])

    const yBase = scaleLog()
      .domain([1, maxCites])
      .range([innerHeight, 0])
      .nice()

    const rScale = scaleSqrt().domain([0, maxH]).range([2.5, 16])

    // Compute power-of-10 tick values covering the scale's (possibly .nice()'d)
    // domain. Log scales with d3's auto-tick logic produce too many minor ticks
    // once you exceed ~2 decades — we want clean 1/10/100/1000 style ticks.
    const log10TickValues = (domain: [number, number]): Array<number> => {
      const [lo, hi] = domain
      const startExp = Math.floor(Math.log10(Math.max(lo, 1e-9)))
      const endExp = Math.ceil(Math.log10(Math.max(hi, 1e-9)))
      const out: Array<number> = []
      for (let e = startExp; e <= endExp; e++) {
        const v = Math.pow(10, e)
        if (v >= lo && v <= hi) out.push(v)
      }
      return out
    }

    const formatLog10 = (d: number | { valueOf: () => number }): string => {
      const n = Number(d)
      if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`
      if (n >= 1000) return `${Math.round(n / 1000)}k`
      // Fractional ticks can appear when zoomed deep into the log scale —
      // show a single decimal so "1.5" doesn't collapse to "2" mid-zoom
      if (n > 0 && n < 1) return n.toFixed(2)
      if (!Number.isInteger(n)) return n.toFixed(1)
      return n.toString()
    }

    // Root plot group (created once, reused)
    let plot = svg.select<SVGGElement>('g.plot')
    if (plot.empty()) {
      plot = svg.append('g').attr('class', 'plot')
    }
    plot.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // Clip path — keeps zoomed dots and labels inside the plot area so they
    // don't spill over the axes and margins. Built once and resized.
    let defs = svg.select<SVGDefsElement>('defs')
    if (defs.empty()) {
      defs = svg.append('defs')
    }
    let clipPath = defs.select<SVGClipPathElement>('#scatter-clip')
    if (clipPath.empty()) {
      clipPath = defs.append('clipPath').attr('id', 'scatter-clip')
      clipPath.append('rect')
    }
    clipPath.select('rect').attr('width', innerWidth).attr('height', innerHeight)

    // Grid lines layer (clipped — grid should stop at the plot edge)
    let gridY = plot.select<SVGGElement>('g.grid-y')
    if (gridY.empty()) {
      gridY = plot
        .append('g')
        .attr('class', 'grid-y')
        .attr('clip-path', 'url(#scatter-clip)')
    }

    // Overlay group for dots + labels — clipped, so pan/zoom content stays
    // inside the plot rect. Appended after the axes-placeholders below.
    let overlay = plot.select<SVGGElement>('g.overlay')
    if (overlay.empty()) {
      overlay = plot
        .append('g')
        .attr('class', 'overlay')
        .attr('clip-path', 'url(#scatter-clip)')
    }

    // Axis containers — NOT clipped; they live in the margin.
    let xAxisG = plot.select<SVGGElement>('g.x-axis')
    if (xAxisG.empty()) {
      xAxisG = plot.append('g').attr('class', 'x-axis')
    }
    xAxisG.attr('transform', `translate(0,${innerHeight})`)

    let yAxisG = plot.select<SVGGElement>('g.y-axis')
    if (yAxisG.empty()) {
      yAxisG = plot.append('g').attr('class', 'y-axis')
    }

    // Axis labels (static position, static text)
    let xLabel = plot.select<SVGTextElement>('text.x-label')
    if (xLabel.empty()) {
      xLabel = plot
        .append('text')
        .attr('class', 'x-label')
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--color-muted-foreground)')
        .attr('font-size', 10)
        .attr('letter-spacing', '0.06em')
        .attr('text-transform', 'uppercase')
    }
    xLabel
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 36)
      .text('WORKS (OPENALEX)')

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
      .attr('transform', `translate(${-42},${innerHeight / 2}) rotate(-90)`)
      .text('CITATIONS')

    // ---- The draw function ----
    // Called once for the initial/data-change render (animated=true) and then
    // on every zoom event (animated=false). Redraws grid, axes, dots, labels.
    const draw = (
      xScale: typeof xBase,
      yScale: typeof yBase,
      animated: boolean,
    ) => {
      const dur = animated ? TRANSITION_MS : 0

      // Tick values filtered to current (possibly zoomed) domain. When we
      // zoom in tight enough that no half-decade tick lands in view, fall
      // back to d3's default generator so the axis isn't empty.
      const [xLo, xHi] = xScale.domain() as [number, number]
      const xTickValues = X_TICK_VALUES.filter((t) => t >= xLo && t <= xHi)
      const xTicksFinal =
        xTickValues.length >= 2 ? xTickValues : xScale.ticks(5)
      const yTickValues = log10TickValues(yScale.domain() as [number, number])
      const yTicksFinal =
        yTickValues.length >= 2 ? yTickValues : yScale.ticks(5)

      // Grid
      gridY
        .selectAll<SVGLineElement, number>('line')
        .data(yTicksFinal)
        .join('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', 'var(--color-border)')
        .attr('stroke-opacity', 0.6)

      // X axis
      const xAxisCall = axisBottom(xScale)
        .tickValues(xTicksFinal)
        .tickFormat(formatLog10)
        .tickSizeOuter(0)
      if (animated) {
        xAxisG.transition().duration(dur).call(xAxisCall)
      } else {
        xAxisG.call(xAxisCall)
      }
      xAxisG.selectAll('path.domain').attr('stroke', 'var(--color-border)')
      xAxisG
        .selectAll('line')
        .attr('stroke', 'var(--color-border)')
        .attr('stroke-opacity', 0.8)
      xAxisG
        .selectAll('text')
        .attr('fill', 'var(--color-muted-foreground)')
        .attr('font-size', 11)
        .attr('font-family', 'inherit')

      // Y axis
      const yAxisCall = axisLeft(yScale)
        .tickValues(yTicksFinal)
        .tickFormat(formatLog10)
        .tickSizeOuter(0)
      if (animated) {
        yAxisG.transition().duration(dur).call(yAxisCall)
      } else {
        yAxisG.call(yAxisCall)
      }
      yAxisG.selectAll('path.domain').attr('stroke', 'var(--color-border)')
      yAxisG
        .selectAll('line')
        .attr('stroke', 'var(--color-border)')
        .attr('stroke-opacity', 0.8)
      yAxisG
        .selectAll('text')
        .attr('fill', 'var(--color-muted-foreground)')
        .attr('font-size', 11)
        .attr('font-family', 'inherit')

      // Dots — enter / update / exit inside the clipped overlay group
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
        .attr('cx', (d) => xScale(d.works))
        .attr('cy', (d) => yScale(d.citations))
        .attr('r', 0)
        .attr('opacity', 0)
        .attr('fill', 'var(--color-primary)')
        .attr('stroke', 'var(--color-slu-700)')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')

      const dotsMerged = dotsEnter
        .merge(dots)
        .on('mouseenter', function (event: MouseEvent, d: Point) {
          // Viewport coords — tooltip uses position: fixed
          setHover({ point: d, x: event.clientX, y: event.clientY })
          select(this)
            .attr('stroke', 'var(--color-slu-800)')
            .attr('stroke-width', 1.5)
        })
        .on('mousemove', function (event: MouseEvent, d: Point) {
          setHover({ point: d, x: event.clientX, y: event.clientY })
        })
        .on('mouseleave', function () {
          setHover(null)
          select(this)
            .attr('stroke', 'var(--color-slu-700)')
            .attr('stroke-width', 0.5)
        })

      if (animated) {
        dotsMerged
          .transition()
          .duration(dur)
          .attr('cx', (d) => xScale(d.works))
          .attr('cy', (d) => yScale(d.citations))
          .attr('r', (d) => rScale(d.hIndex))
          .attr('opacity', 0.55)
      } else {
        // Direct attribute updates — avoids interrupting the initial enter
        // transition mid-animation if the user starts zooming immediately,
        // and skips the transition overhead on every wheel tick.
        dotsMerged
          .interrupt()
          .attr('cx', (d) => xScale(d.works))
          .attr('cy', (d) => yScale(d.citations))
          .attr('r', (d) => rScale(d.hIndex))
          .attr('opacity', 0.55)
      }

      // ---- Outlier labels with smart placement + collision avoidance ----
      interface PlacedLabel {
        point: Point
        x: number
        y: number
        anchor: 'start' | 'end'
      }

      const CHAR_WIDTH = 6.3 // approximate width of a Geist 11px char
      const LABEL_HEIGHT = 14
      const LABEL_PAD = 4

      // Only label points that are currently visible in the zoomed viewport —
      // prevents labels from piling up at the plot edges when zoomed in.
      const visibleLabelPoints = points
        .filter((p) => {
          if (!labelIds.has(p.id)) return false
          const px = xScale(p.works)
          const py = yScale(p.citations)
          return px >= 0 && px <= innerWidth && py >= 0 && py <= innerHeight
        })
        .sort((a, b) => b.hIndex - a.hIndex)

      const placed: Array<PlacedLabel> = []
      for (const p of visibleLabelPoints) {
        const dotX = xScale(p.works)
        const dotY = yScale(p.citations)
        const radius = rScale(p.hIndex)
        // Anchor to the left of the dot if we're in the right 35% of the plot
        const anchor: 'start' | 'end' =
          dotX > innerWidth * 0.65 ? 'end' : 'start'
        const labelOffset = radius + 5
        const labelX =
          anchor === 'end' ? dotX - labelOffset : dotX + labelOffset
        let labelY = dotY
        const textWidth = p.lastName.length * CHAR_WIDTH

        // Collision check against already-placed labels, nudge vertically
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

        // Try the natural position, then nudge alternately up/down
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
          if (!found) {
            // Give up — accept overlap rather than drop the label
            labelY = dotY
          }
        }

        // Clamp within plot bounds
        labelY = Math.max(
          LABEL_HEIGHT / 2,
          Math.min(innerHeight - LABEL_HEIGHT / 2, labelY),
        )

        placed.push({ point: p, x: labelX, y: labelY, anchor })
      }

      const labels = overlay
        .selectAll<SVGTextElement, PlacedLabel>('text.label')
        .data(placed, (d) => d.point.id.toString())

      labels
        .exit()
        .transition()
        .duration(animated ? TRANSITION_MS / 2 : 0)
        .attr('opacity', 0)
        .remove()

      // Enter: start AT the final position (no top-left fly-in), opacity 0
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
        // Halo effect so labels stay readable over dot clusters
        .style('paint-order', 'stroke')
        .style('stroke', 'var(--color-background)')
        .style('stroke-width', '3px')
        .style('stroke-linejoin', 'round')

      const labelsMerged = labelsEnter
        .merge(labels)
        .text((d) => d.point.lastName)
        .attr('text-anchor', (d) => d.anchor)

      if (animated) {
        labelsMerged
          .transition()
          .duration(dur)
          .attr('x', (d) => d.x)
          .attr('y', (d) => d.y)
          .attr('opacity', 1)
      } else {
        labelsMerged
          .interrupt()
          .attr('x', (d) => d.x)
          .attr('y', (d) => d.y)
          .attr('opacity', 1)
      }
    }

    // Initial draw — apply any preserved transform (from a width change) to
    // the freshly-built base scales so the view is continuous.
    const xInitial = transformRef.current.rescaleX(xBase)
    const yInitial = transformRef.current.rescaleY(yBase)
    draw(xInitial, yInitial, true)

    // ---- Zoom behavior ----
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
      // d3's default filter — allows wheel + left-click drag + pinch
      .filter(
        (event: Event) =>
          (!(event as MouseEvent).ctrlKey || event.type === 'wheel') &&
          !(event as MouseEvent).button,
      )
      .on('start', () => {
        // Hide tooltip as soon as a pan/zoom gesture begins — the point under
        // the cursor is about to move and any stale tooltip would feel broken.
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
    // Double-click → smooth reset (more useful on a dashboard than d3's
    // default "zoom in 2x on dblclick" behavior)
    svg.on('dblclick', () => {
      svg.transition().duration(400).call(zoomBehavior.transform, zoomIdentity)
    })

    // Sync d3-zoom's internal state with our preserved transform so the next
    // wheel/drag event continues from the current view (e.g. after resize).
    if (transformRef.current !== zoomIdentity) {
      svg.call(zoomBehavior.transform, transformRef.current)
    }

    zoomBehaviorRef.current = zoomBehavior
  }, [points, labelIds, width])

  if (rows.length === 0 || points.length === 0) {
    return (
      <div
        ref={containerRef}
        className="text-muted-foreground flex items-center justify-center text-sm"
        style={{ height: HEIGHT }}
      >
        No faculty with both works and citations in the current filters.
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

      {/* Reset button — only visible when the user has actually zoomed */}
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

      {/* Hint — only visible when NOT zoomed, fades out as soon as they engage */}
      {!isZoomed ? (
        <div className="text-muted-foreground pointer-events-none absolute top-2 right-3 text-[10px] tracking-wide uppercase select-none">
          Scroll to zoom · drag to pan
        </div>
      ) : null}

      {hover
        ? (() => {
            const pos = computeTooltipPosition(hover.x, hover.y)
            return (
              <div
                className="bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 pointer-events-none fixed z-50 min-w-[160px] max-w-[280px] rounded-md border p-2.5 shadow-md duration-150 ease-out"
                style={{ left: pos.left, top: pos.top }}
              >
                <div className="text-[13px] font-medium">
                  {hover.point.name}
                </div>
                <div className="text-muted-foreground mt-0.5 text-[11px]">
                  {hover.point.department}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 text-[11px]">
                  <div>
                    <div className="text-muted-foreground text-[9px] tracking-wider uppercase">
                      Works
                    </div>
                    <div className="tabular font-medium">
                      {hover.point.works.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[9px] tracking-wider uppercase">
                      Cites
                    </div>
                    <div className="tabular font-medium">
                      {hover.point.citations.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-[9px] tracking-wider uppercase">
                      h-idx
                    </div>
                    <div className="tabular text-primary font-medium">
                      {hover.point.hIndex}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()
        : null}
    </div>
  )
}
