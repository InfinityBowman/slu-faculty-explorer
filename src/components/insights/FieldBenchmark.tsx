import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { axisBottom } from 'd3-axis'
import { ChartTooltip, useChartTooltip } from './ChartTooltip'
import type { Faculty } from '@/lib/types'
import type { Benchmark } from '@/lib/insights'
import { abbreviate, loadBenchmarks, median } from '@/lib/insights'

interface SchoolBenchmark {
  school: string
  field: string
  sluMedian: number
  p25: number
  p50: number
  p75: number
  p90: number
  n: number
}

// SLU dot colors — enough contrast to read at a glance
const DOT_ABOVE_P75 = 'oklch(0.28 0.16 259)'  // darkest navy
const DOT_MID = 'oklch(0.48 0.19 259)'          // SLU primary
const DOT_BELOW_P50 = 'oklch(0.74 0.09 259)'    // noticeably lighter

const MARGIN = { top: 10, right: 24, bottom: 32, left: 260 }
const ROW_H = 48

export function FieldBenchmark({ faculty }: { faculty: Array<Faculty> }) {
  const [benchmarks, setBenchmarks] = useState<Array<Benchmark>>([])
  const [loadError, setLoadError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(700)
  const { data: hovered, rendered, setData, tooltipRef, trackPosition } = useChartTooltip<SchoolBenchmark>()

  useEffect(() => {
    loadBenchmarks().then((b) => {
      setBenchmarks(b)
      if (b.length === 0) setLoadError(true)
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) setWidth(Math.floor(w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rows = useMemo(() => {
    if (!benchmarks.length) return []
    const fieldMap = new Map<string, Benchmark>()
    for (const b of benchmarks) if (b.level === 'field') fieldMap.set(b.name, b)

    const buckets = new Map<string, Array<Faculty>>()
    for (const f of faculty) {
      if (!f.school) continue
      const a = buckets.get(f.school) ?? []
      a.push(f)
      buckets.set(f.school, a)
    }

    const out: Array<SchoolBenchmark> = []
    for (const [school, members] of buckets) {
      const fieldCounts = new Map<string, number>()
      const hs: Array<number> = []
      for (const f of members) {
        if (f.openalexField) fieldCounts.set(f.openalexField, (fieldCounts.get(f.openalexField) ?? 0) + 1)
        if (f.bestH != null) hs.push(f.bestH)
      }
      let domField = ''
      let maxC = 0
      for (const [field, c] of fieldCounts) if (c > maxC) { domField = field; maxC = c }
      const sluMed = median(hs)
      const global = fieldMap.get(domField)
      if (sluMed == null || !global) continue
      out.push({ school: abbreviate(school), field: domField, sluMedian: sluMed, p25: global.p25, p50: global.p50, p75: global.p75, p90: global.p90, n: hs.length })
    }
    return out.sort((a, b) => b.sluMedian - a.sluMedian)
  }, [faculty, benchmarks])

  const svgWidth = Math.min(width, 950)
  const height = rows.length * ROW_H + MARGIN.top + MARGIN.bottom

  useLayoutEffect(() => {
    if (!svgRef.current || !rows.length) return
    const innerW = svgWidth - MARGIN.left - MARGIN.right
    if (innerW <= 0) return

    const maxH = Math.max(...rows.map((r) => Math.max(r.sluMedian, r.p90))) * 1.1
    const x = scaleLinear().domain([0, maxH]).range([0, innerW])
    const yFor = (i: number) => i * ROW_H + ROW_H / 2

    const svg = select(svgRef.current)
    let g = svg.select<SVGGElement>('g.plot')
    if (g.empty()) g = svg.append('g').attr('class', 'plot')
    g.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // Axis
    let axG = g.select<SVGGElement>('g.x-axis')
    if (axG.empty()) axG = g.append('g').attr('class', 'x-axis')
    axG.attr('transform', `translate(0,${rows.length * ROW_H})`)
    axG.call(axisBottom(x).ticks(6).tickSizeOuter(0))
    axG.selectAll('text').attr('fill', 'var(--color-muted-foreground)').attr('font-size', 10)
    axG.selectAll('path.domain').attr('stroke', 'var(--color-border)')
    axG.selectAll('line').attr('stroke', 'var(--color-border)')

    // Rows
    const rowG = g.selectAll<SVGGElement, SchoolBenchmark>('g.row')
      .data(rows, (d) => d.school)
      .join('g')
      .attr('class', 'row')
      .attr('transform', (_, i) => `translate(0,${yFor(i)})`)

    // Stripe — use parent row index via closure
    rowG.each(function (_, i) {
      select(this).selectAll('rect.stripe').data([null]).join('rect')
        .attr('class', 'stripe')
        .attr('x', 0).attr('y', -ROW_H / 2).attr('width', innerW).attr('height', ROW_H)
        .attr('fill', i % 2 === 0 ? 'var(--color-muted)' : 'transparent')
        .attr('fill-opacity', 0.3)
    })

    // Global range bar (P25–P90) — fully rounded
    rowG.selectAll('rect.range').data((d) => [d]).join('rect')
      .attr('class', 'range')
      .attr('x', (d) => x(d.p25))
      .attr('width', (d) => Math.max(0, x(d.p90) - x(d.p25)))
      .attr('y', -8).attr('height', 16).attr('rx', 8)
      .attr('fill', 'var(--color-muted-foreground)').attr('fill-opacity', 0.12)

    // P50 tick
    rowG.selectAll('line.p50').data((d) => [d]).join('line')
      .attr('class', 'p50')
      .attr('x1', (d) => x(d.p50)).attr('x2', (d) => x(d.p50))
      .attr('y1', -10).attr('y2', 10)
      .attr('stroke', 'var(--color-muted-foreground)').attr('stroke-opacity', 0.5).attr('stroke-width', 1)

    // SLU median marker
    rowG.selectAll('circle.slu').data((d) => [d]).join('circle')
      .attr('class', 'slu')
      .attr('cx', (d) => x(d.sluMedian)).attr('cy', 0).attr('r', 6)
      .attr('fill', (d) => d.sluMedian >= d.p75 ? DOT_ABOVE_P75 : d.sluMedian >= d.p50 ? DOT_MID : DOT_BELOW_P50)
      .attr('stroke', 'white').attr('stroke-width', 2)

    // SLU label
    rowG.selectAll('text.slu-label').data((d) => [d]).join('text')
      .attr('class', 'slu-label')
      .attr('x', (d) => x(d.sluMedian)).attr('y', -16)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('font-weight', 600)
      .attr('fill', 'var(--color-foreground)')
      .text((d) => Math.round(d.sluMedian))

    // Row labels (left side)
    rowG.selectAll('text.school-name').data((d) => [d]).join('text')
      .attr('class', 'school-name')
      .attr('x', -16).attr('y', -4)
      .attr('text-anchor', 'end')
      .attr('font-size', 11).attr('font-weight', 500)
      .attr('fill', 'var(--color-foreground)')
      .text((d) => d.school)

    rowG.selectAll('text.school-sub').data((d) => [d]).join('text')
      .attr('class', 'school-sub')
      .attr('x', -16).attr('y', 10)
      .attr('text-anchor', 'end')
      .attr('font-size', 9)
      .attr('fill', 'var(--color-muted-foreground)')
      .text((d) => `${d.field} · n=${d.n}`)

    // Hover hit areas — transparent rects covering full row for consistent hover
    rowG.selectAll('rect.hit').data((d) => [d]).join('rect')
      .attr('class', 'hit')
      .attr('x', -MARGIN.left).attr('y', -ROW_H / 2)
      .attr('width', innerW + MARGIN.left).attr('height', ROW_H)
      .attr('fill', 'transparent')
      .style('cursor', 'default')
      .on('mouseenter', (_event: MouseEvent, d: SchoolBenchmark) => setData(d))
      .on('mouseleave', () => setData(null))
  }, [rows, svgWidth, setData])

  if (loadError) {
    return <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Failed to load benchmark data.</div>
  }

  if (!rows.length) {
    return <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Loading benchmarks...</div>
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden" onMouseMove={trackPosition}>
      <svg ref={svgRef} width={svgWidth} height={height} className="mx-auto block" />
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-full bg-muted-foreground/12" /> Global P25&ndash;P90</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-px bg-muted-foreground/50" /> Global median</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full" style={{ background: DOT_ABOVE_P75 }} /> SLU above P75</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full" style={{ background: DOT_MID }} /> SLU at P50&ndash;P75</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full" style={{ background: DOT_BELOW_P50 }} /> SLU below P50</span>
      </div>

      <ChartTooltip visible={hovered != null} tooltipRef={tooltipRef}>
        {rendered && (
          <div>
            <div className="text-[13px] font-medium">{rendered.school}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{rendered.field} &middot; n={rendered.n}</div>
            <div className="mt-2 flex gap-4 border-t pt-2 text-[11px]">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">SLU median</div>
                <div className="tabular font-medium">{Math.round(rendered.sluMedian)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Global P50</div>
                <div className="tabular font-medium">{Math.round(rendered.p50)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Global P75</div>
                <div className="tabular font-medium">{Math.round(rendered.p75)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Global P90</div>
                <div className="tabular font-medium">{Math.round(rendered.p90)}</div>
              </div>
            </div>
          </div>
        )}
      </ChartTooltip>
    </div>
  )
}
