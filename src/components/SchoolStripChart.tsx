import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { scaleLinear } from 'd3-scale'
import { axisBottom } from 'd3-axis'
import 'd3-transition'
import type { Faculty, HTier } from '@/lib/types'
import type { SchoolSummary } from '@/hooks/useSchools'

interface SchoolStripChartProps {
  schools: Array<SchoolSummary>
  faculty: Array<Faculty>
}

interface StripPoint {
  id: number
  schoolIdx: number
  name: string
  department: string
  fieldPercentile: number
  tier: HTier | null
}

interface HoverState {
  point: StripPoint
  schoolLabel: string
  x: number
  y: number
}

const MARGIN = { top: 16, right: 24, bottom: 36, left: 200 }
const ROW_HEIGHT = 56
const DOT_RADIUS = 3.5

// Tooltip viewport clamping — same pattern as ScatterChart
const TOOLTIP_WIDTH = 230
const TOOLTIP_HEIGHT = 110
const TOOLTIP_GAP = 14
const TOOLTIP_PAD = 8

function computeTooltipPosition(x: number, y: number): {
  left: number
  top: number
} {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = x - TOOLTIP_WIDTH / 2
  let top = y - TOOLTIP_GAP - TOOLTIP_HEIGHT
  if (top < TOOLTIP_PAD) top = y + TOOLTIP_GAP
  if (top + TOOLTIP_HEIGHT > vh - TOOLTIP_PAD)
    top = vh - TOOLTIP_HEIGHT - TOOLTIP_PAD
  left = Math.max(
    TOOLTIP_PAD,
    Math.min(vw - TOOLTIP_WIDTH - TOOLTIP_PAD, left),
  )
  return { left, top }
}

// Deterministic pseudo-random jitter in [-1, 1] based on faculty id, so
// dots land in the same place across re-renders and the density story
// stays stable.
function jitterFor(id: number): number {
  const s = Math.sin(id * 12.9898) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

const TIER_LABELS: Record<HTier, string> = {
  'top_1%': 'Top 1%',
  'top_5%': 'Top 5%',
  'top_10%': 'Top 10%',
  'top_25%': 'Top 25%',
  above_median: 'Above median',
  below_median: 'Below median',
}

export function SchoolStripChart({ schools, faculty }: SchoolStripChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(800)
  const [hover, setHover] = useState<HoverState | null>(null)

  // Sort schools by median field percentile desc (best at top), nulls last
  const sortedSchools = useMemo(() => {
    return [...schools].sort((a, b) => {
      const av = a.medianFieldPercentile ?? -1
      const bv = b.medianFieldPercentile ?? -1
      return bv - av
    })
  }, [schools])

  // Build school lookup by name → index in sorted order
  const schoolIndex = useMemo(() => {
    const m = new Map<string, number>()
    sortedSchools.forEach((s, i) => m.set(s.school, i))
    return m
  }, [sortedSchools])

  // Extract plottable faculty (those with a field percentile)
  const points = useMemo<Array<StripPoint>>(() => {
    const out: Array<StripPoint> = []
    for (const f of faculty) {
      if (f.fieldHPercentile == null) continue
      const idx = schoolIndex.get(f.school)
      if (idx == null) continue
      out.push({
        id: f.id,
        schoolIdx: idx,
        name: f.name,
        department: f.department,
        fieldPercentile: f.fieldHPercentile,
        tier: f.primaryHTier,
      })
    }
    return out
  }, [faculty, schoolIndex])

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

  const HEIGHT = sortedSchools.length * ROW_HEIGHT + MARGIN.top + MARGIN.bottom

  useLayoutEffect(() => {
    if (!svgRef.current) return
    const innerWidth = width - MARGIN.left - MARGIN.right
    const innerHeight = sortedSchools.length * ROW_HEIGHT
    if (innerWidth <= 0) return

    const svg = select(svgRef.current)

    const x = scaleLinear().domain([0, 100]).range([0, innerWidth])

    const yFor = (schoolIdx: number): number =>
      schoolIdx * ROW_HEIGHT + ROW_HEIGHT / 2

    // Root group
    let plot = svg.select<SVGGElement>('g.plot')
    if (plot.empty()) {
      plot = svg.append('g').attr('class', 'plot')
    }
    plot.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // Alternating row background stripes — makes rows easier to scan
    const bgData = sortedSchools.map((_, i) => i)
    const bgs = plot
      .selectAll<SVGRectElement, number>('rect.row-bg')
      .data(bgData, (d) => d.toString())
    bgs
      .join('rect')
      .attr('class', 'row-bg')
      .attr('x', 0)
      .attr('y', (i) => i * ROW_HEIGHT)
      .attr('width', innerWidth)
      .attr('height', ROW_HEIGHT)
      .attr(
        'fill',
        (i) =>
          i % 2 === 0 ? 'var(--color-muted)' : 'transparent',
      )
      .attr('fill-opacity', 0.4)

    // Vertical gridlines at 25, 50, 75
    const gridValues = [25, 50, 75]
    plot
      .selectAll<SVGLineElement, number>('line.grid-x')
      .data(gridValues)
      .join('line')
      .attr('class', 'grid-x')
      .attr('x1', (d) => x(d))
      .attr('x2', (d) => x(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', 'var(--color-border)')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-dasharray', '2,3')

    // X axis
    let xAxisG = plot.select<SVGGElement>('g.x-axis')
    if (xAxisG.empty()) {
      xAxisG = plot.append('g').attr('class', 'x-axis')
    }
    xAxisG
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        axisBottom(x)
          .tickValues([0, 25, 50, 75, 100])
          .tickFormat((d) => `${d}`)
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

    // X axis label
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
      .attr('y', innerHeight + 28)
      .text('GLOBAL FIELD H-INDEX PERCENTILE')

    // School row labels (two lines: abbreviated name + "n/total")
    const labels = plot
      .selectAll<SVGGElement, SchoolSummary>('g.school-label')
      .data(sortedSchools, (d) => d.school)

    labels.exit().remove()

    const labelsEnter = labels
      .enter()
      .append('g')
      .attr('class', 'school-label')

    labelsEnter
      .append('text')
      .attr('class', 'school-name')
      .attr('x', -12)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--color-foreground)')
      .attr('font-size', 11)
      .attr('font-weight', 500)

    labelsEnter
      .append('text')
      .attr('class', 'school-sub')
      .attr('x', -12)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--color-muted-foreground)')
      .attr('font-size', 10)

    const labelsMerged = labelsEnter.merge(labels)

    labelsMerged.attr(
      'transform',
      (_, i) => `translate(0, ${yFor(i)})`,
    )
    labelsMerged
      .select<SVGTextElement>('text.school-name')
      .attr('y', -6)
      .text((d) => abbreviateSchool(d.school))
    labelsMerged
      .select<SVGTextElement>('text.school-sub')
      .attr('y', 9)
      .text((d) =>
        d.nWithData === d.n
          ? `n=${d.n}`
          : `${d.nWithData} of ${d.n}`,
      )

    // Dots — one per plottable faculty
    const dotBand = ROW_HEIGHT * 0.55
    const dots = plot
      .selectAll<SVGCircleElement, StripPoint>('circle.dot')
      .data(points, (d) => d.id.toString())

    dots.exit().remove()

    const dotsEnter = dots
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('fill', 'var(--color-primary)')
      .attr('stroke', 'var(--color-slu-700)')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0)
      .style('cursor', 'pointer')

    const dotsMerged = dotsEnter
      .merge(dots)
      .attr('cx', (d) => x(d.fieldPercentile))
      .attr('cy', (d) => yFor(d.schoolIdx) + jitterFor(d.id) * (dotBand / 2))
      .attr('r', DOT_RADIUS)
      .on('mouseenter', function (event: MouseEvent, d: StripPoint) {
        setHover({
          point: d,
          schoolLabel: sortedSchools[d.schoolIdx].school,
          x: event.clientX,
          y: event.clientY,
        })
        select(this)
          .attr('stroke', 'var(--color-slu-800)')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.9)
      })
      .on('mousemove', function (event: MouseEvent, d: StripPoint) {
        setHover({
          point: d,
          schoolLabel: sortedSchools[d.schoolIdx].school,
          x: event.clientX,
          y: event.clientY,
        })
      })
      .on('mouseleave', function () {
        setHover(null)
        select(this)
          .attr('stroke', 'var(--color-slu-700)')
          .attr('stroke-width', 0.5)
          .attr('opacity', 0.35)
      })

    dotsMerged.transition().duration(450).attr('opacity', 0.35)

    // Median markers — thick vertical line per school at its median field %
    interface MedianMarker {
      schoolIdx: number
      value: number
      label: string
    }
    const medianMarkers: Array<MedianMarker> = sortedSchools
      .map((s, i) => ({
        schoolIdx: i,
        value: s.medianFieldPercentile,
        label: s.school,
      }))
      .filter(
        (m): m is MedianMarker => m.value != null,
      )

    const markers = plot
      .selectAll<SVGLineElement, MedianMarker>('line.median')
      .data(medianMarkers, (d) => d.label)
    markers.exit().remove()
    markers
      .enter()
      .append('line')
      .attr('class', 'median')
      .attr('stroke', 'var(--color-slu-900)')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('pointer-events', 'none')
      .merge(markers)
      .attr('x1', (d) => x(d.value))
      .attr('x2', (d) => x(d.value))
      .attr('y1', (d) => yFor(d.schoolIdx) - ROW_HEIGHT * 0.35)
      .attr('y2', (d) => yFor(d.schoolIdx) + ROW_HEIGHT * 0.35)

    // Median value labels — small number next to each median tick
    const medianLabels = plot
      .selectAll<SVGTextElement, MedianMarker>('text.median-label')
      .data(medianMarkers, (d) => d.label)
    medianLabels.exit().remove()
    medianLabels
      .enter()
      .append('text')
      .attr('class', 'median-label')
      .attr('font-size', 10)
      .attr('font-weight', 600)
      .attr('fill', 'var(--color-slu-900)')
      .attr('dominant-baseline', 'middle')
      .attr('pointer-events', 'none')
      .style('font-variant-numeric', 'tabular-nums')
      .style('paint-order', 'stroke')
      .style('stroke', 'var(--color-background)')
      .style('stroke-width', '3px')
      .style('stroke-linejoin', 'round')
      .merge(medianLabels)
      .attr('x', (d) => x(d.value) + 6)
      .attr('y', (d) => yFor(d.schoolIdx) - ROW_HEIGHT * 0.3)
      .text((d) => Math.round(d.value).toString())
  }, [sortedSchools, points, width])

  if (sortedSchools.length === 0) {
    return (
      <div
        ref={containerRef}
        className="text-muted-foreground flex items-center justify-center text-sm"
        style={{ height: 300 }}
      >
        No schools in the current filters.
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
        (() => {
          const pos = computeTooltipPosition(hover.x, hover.y)
          return (
            <div
              className="bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 pointer-events-none fixed z-50 min-w-[180px] max-w-[280px] rounded-md border p-2.5 shadow-md duration-150 ease-out"
              style={{ left: pos.left, top: pos.top }}
            >
              <div className="text-[13px] font-medium">{hover.point.name}</div>
              <div className="text-muted-foreground mt-0.5 text-[11px]">
                {hover.point.department}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground text-[9px] tracking-wider uppercase">
                    Field %
                  </div>
                  <div className="tabular text-primary font-medium">
                    {Math.round(hover.point.fieldPercentile)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[9px] tracking-wider uppercase">
                    Tier
                  </div>
                  <div className="font-medium">
                    {hover.point.tier ? TIER_LABELS[hover.point.tier] : '—'}
                  </div>
                </div>
              </div>
            </div>
          )
        })()
      ) : null}
    </div>
  )
}

function abbreviateSchool(school: string): string {
  const abbr: Record<string, string> = {
    'Chaifetz School of Business': 'Chaifetz Business',
    'College for Public Health and Social Justice':
      'Public Health & Social Justice',
    'School of Social Work': 'Social Work',
    'School of Science and Engineering': 'Science & Engineering',
    'Doisy College of Health Sciences': 'Doisy Health Sciences',
    'Trudy Busch Valentine School of Nursing': 'Nursing',
    'College of Philosophy and Letters': 'Philosophy & Letters',
    'College of Arts and Sciences': 'Arts & Sciences',
    'School of Education': 'Education',
  }
  return abbr[school] ?? school
}
