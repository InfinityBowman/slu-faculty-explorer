import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { axisBottom } from 'd3-axis'
import type { Faculty } from '@/lib/types'
import { abbreviate, loadBenchmarks, median } from '@/lib/insights'
import type { Benchmark } from '@/lib/insights'

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

const MARGIN = { top: 10, right: 24, bottom: 32, left: 160 }
const ROW_H = 48

export function FieldBenchmark({ faculty }: { faculty: Array<Faculty> }) {
  const [benchmarks, setBenchmarks] = useState<Array<Benchmark>>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(700)

  useEffect(() => { loadBenchmarks().then(setBenchmarks) }, [])

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

  const height = rows.length * ROW_H + MARGIN.top + MARGIN.bottom

  useLayoutEffect(() => {
    if (!svgRef.current || !rows.length) return
    const innerW = width - MARGIN.left - MARGIN.right
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

    // Stripe
    rowG.selectAll('rect.stripe').data((d) => [d]).join('rect')
      .attr('class', 'stripe')
      .attr('x', 0).attr('y', -ROW_H / 2).attr('width', innerW).attr('height', ROW_H)
      .attr('fill', (_, i) => i % 2 === 0 ? 'var(--color-muted)' : 'transparent')
      .attr('fill-opacity', 0.3)

    // Global range bar (P25–P90)
    rowG.selectAll('rect.range').data((d) => [d]).join('rect')
      .attr('class', 'range')
      .attr('x', (d) => x(d.p25))
      .attr('width', (d) => Math.max(0, x(d.p90) - x(d.p25)))
      .attr('y', -8).attr('height', 16).attr('rx', 3)
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
      .attr('cx', (d) => x(d.sluMedian)).attr('cy', 0).attr('r', 5)
      .attr('fill', (d) => d.sluMedian >= d.p75 ? 'oklch(0.28 0.16 259)' : d.sluMedian >= d.p50 ? 'oklch(0.41 0.17 259)' : 'oklch(0.64 0.13 259)')
      .attr('stroke', 'white').attr('stroke-width', 1.5)

    // SLU label
    rowG.selectAll('text.slu-label').data((d) => [d]).join('text')
      .attr('class', 'slu-label')
      .attr('x', (d) => x(d.sluMedian)).attr('y', -14)
      .attr('text-anchor', 'middle').attr('font-size', 9).attr('font-weight', 600)
      .attr('fill', 'var(--color-foreground)')
      .text((d) => Math.round(d.sluMedian))

    // Row labels (left side)
    rowG.selectAll('text.school-name').data((d) => [d]).join('text')
      .attr('class', 'school-name')
      .attr('x', -12).attr('y', -4)
      .attr('text-anchor', 'end').attr('font-size', 11).attr('font-weight', 500)
      .attr('fill', 'var(--color-foreground)')
      .text((d) => d.school)

    rowG.selectAll('text.school-sub').data((d) => [d]).join('text')
      .attr('class', 'school-sub')
      .attr('x', -12).attr('y', 10)
      .attr('text-anchor', 'end').attr('font-size', 9)
      .attr('fill', 'var(--color-muted-foreground)')
      .text((d) => `${d.field} · n=${d.n}`)
  }, [rows, width])

  if (!rows.length) {
    return <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Loading benchmarks...</div>
  }

  return (
    <div ref={containerRef} className="relative min-w-0">
      <svg ref={svgRef} width={width} height={height} className="block overflow-visible" />
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm bg-muted-foreground/15" /> Global P25–P90</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-px bg-muted-foreground/50" /> Global P50</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full" style={{ background: 'oklch(0.28 0.16 259)' }} /> Above P75</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full" style={{ background: 'oklch(0.41 0.17 259)' }} /> P50–P75</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full" style={{ background: 'oklch(0.64 0.13 259)' }} /> Below P50</span>
      </div>
    </div>
  )
}
