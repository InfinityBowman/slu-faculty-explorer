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

    const x = scaleLog()
      .domain([1, maxWorks])
      .range([0, innerWidth])
      .nice()

    const y = scaleLog()
      .domain([1, maxCites])
      .range([innerHeight, 0])
      .nice()

    const r = scaleSqrt().domain([0, maxH]).range([2.5, 16])

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
      .data(y.ticks(5))
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
          .ticks(6)
          .tickFormat((d) => {
            const n = Number(d)
            if (n >= 1000) return `${Math.round(n / 1000)}k`
            return n.toString()
          })
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
          .ticks(5)
          .tickFormat((d) => {
            const n = Number(d)
            if (n >= 1000) return `${Math.round(n / 1000)}k`
            return n.toString()
          })
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
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        setHover({
          point: d,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        })
        select(this)
          .attr('stroke', 'var(--color-slu-800)')
          .attr('stroke-width', 1.5)
      })
      .on('mousemove', function (event: MouseEvent, d: Point) {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        setHover({
          point: d,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        })
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

    // Outlier labels — bound data to top 5
    const labels = plot
      .selectAll<SVGTextElement, Point>('text.label')
      .data(
        points.filter((p) => labelIds.has(p.id)),
        (d) => d.id.toString(),
      )

    labels.exit().remove()

    const labelsEnter = labels
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('fill', 'var(--color-foreground)')
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .attr('dominant-baseline', 'middle')
      .style('pointer-events', 'none')
      .style('font-variant-numeric', 'tabular-nums')

    labelsEnter
      .merge(labels)
      .text((d) => d.lastName)
      .transition()
      .duration(TRANSITION_MS)
      .attr('x', (d) => x(d.works) + r(d.hIndex) + 5)
      .attr('y', (d) => y(d.citations))
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
      {hover ? (
        <div
          className="bg-popover text-popover-foreground pointer-events-none absolute z-10 min-w-[160px] -translate-x-1/2 rounded-md border p-2.5 shadow-md"
          style={{
            left: hover.x,
            top: hover.y - 12,
            transform: 'translate(-50%, -100%)',
          }}
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
      ) : null}
    </div>
  )
}
