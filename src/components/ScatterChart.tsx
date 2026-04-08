import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { scaleLog, scaleSqrt } from 'd3-scale'
import { axisBottom, axisLeft } from 'd3-axis'
import 'd3-transition'
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
  const [width, setWidth] = useState(800)
  const [hover, setHover] = useState<HoverState | null>(null)

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

  // Main d3 draw effect
  useLayoutEffect(() => {
    if (!svgRef.current) return
    const innerWidth = width - MARGIN.left - MARGIN.right
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom
    if (innerWidth <= 0) return

    const svg = select(svgRef.current)

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

    const x = scaleLog().domain([1, xMax]).range([0, innerWidth])

    const y = scaleLog()
      .domain([1, maxCites])
      .range([innerHeight, 0])
      .nice()

    const r = scaleSqrt().domain([0, maxH]).range([2.5, 16])

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

    // X uses the half-decade tick list filtered to the current domain so
    // collapsed views (e.g. a single department) still show a reasonable spread
    const [xLo, xHi] = x.domain() as [number, number]
    const xTickValues = X_TICK_VALUES.filter((t) => t >= xLo && t <= xHi)
    const yTickValues = log10TickValues(y.domain() as [number, number])

    const formatLog10 = (d: number | { valueOf: () => number }): string => {
      const n = Number(d)
      if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`
      if (n >= 1000) return `${Math.round(n / 1000)}k`
      return n.toString()
    }

    // Root plot group (created once, reused)
    let plot = svg.select<SVGGElement>('g.plot')
    if (plot.empty()) {
      plot = svg.append('g').attr('class', 'plot')
    }
    plot.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // Grid lines layer
    let gridY = plot.select<SVGGElement>('g.grid-y')
    if (gridY.empty()) {
      gridY = plot.append('g').attr('class', 'grid-y')
    }
    gridY
      .selectAll('line')
      .data(yTickValues)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', 'var(--color-border)')
      .attr('stroke-opacity', 0.6)

    // X axis
    let xAxisG = plot.select<SVGGElement>('g.x-axis')
    if (xAxisG.empty()) {
      xAxisG = plot.append('g').attr('class', 'x-axis')
    }
    xAxisG
      .attr('transform', `translate(0,${innerHeight})`)
      .transition()
      .duration(TRANSITION_MS)
      .call(
        axisBottom(x)
          .tickValues(xTickValues)
          .tickFormat(formatLog10)
          .tickSizeOuter(0),
      )

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
    let yAxisG = plot.select<SVGGElement>('g.y-axis')
    if (yAxisG.empty()) {
      yAxisG = plot.append('g').attr('class', 'y-axis')
    }
    yAxisG
      .transition()
      .duration(TRANSITION_MS)
      .call(
        axisLeft(y)
          .tickValues(yTickValues)
          .tickFormat(formatLog10)
          .tickSizeOuter(0),
      )

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

    // Axis labels
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

    // Dots — enter / update / exit with smooth transitions
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
      .attr('cx', (d) => x(d.works))
      .attr('cy', (d) => y(d.citations))
      .attr('r', 0)
      .attr('opacity', 0)
      .attr('fill', 'var(--color-primary)')
      .attr('stroke', 'var(--color-slu-700)')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')

    dotsEnter
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
      .transition()
      .duration(TRANSITION_MS)
      .attr('cx', (d) => x(d.works))
      .attr('cy', (d) => y(d.citations))
      .attr('r', (d) => r(d.hIndex))
      .attr('opacity', 0.55)

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

    // Sort by priority so highest-h-index claims its ideal spot first
    const labelPoints = points
      .filter((p) => labelIds.has(p.id))
      .sort((a, b) => b.hIndex - a.hIndex)

    const placed: Array<PlacedLabel> = []
    for (const p of labelPoints) {
      const dotX = x(p.works)
      const dotY = y(p.citations)
      const radius = r(p.hIndex)
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

    const labels = plot
      .selectAll<SVGTextElement, PlacedLabel>('text.label')
      .data(placed, (d) => d.point.id.toString())

    labels
      .exit()
      .transition()
      .duration(TRANSITION_MS / 2)
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

    labelsEnter
      .merge(labels)
      .text((d) => d.point.lastName)
      .attr('text-anchor', (d) => d.anchor)
      .transition()
      .duration(TRANSITION_MS)
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('opacity', 1)
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
        className="block overflow-visible"
      />
      {hover
        ? (() => {
            const pos = computeTooltipPosition(hover.x, hover.y)
            return (
              <div
                className="bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 pointer-events-none fixed z-50 min-w-[160px] max-w-[280px] rounded-md border p-2.5 shadow-md duration-150 ease-out"
                style={{ left: pos.left, top: pos.top }}
              >
          <div className="text-[13px] font-medium">{hover.point.name}</div>
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
