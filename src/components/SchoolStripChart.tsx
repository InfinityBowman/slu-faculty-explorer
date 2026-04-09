import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { select } from 'd3-selection'
import { scaleLinear, scaleLog } from 'd3-scale'
import { axisBottom } from 'd3-axis'
import 'd3-transition'
import type { Faculty, HTier } from '@/lib/types'
import type { SchoolSummary } from '@/hooks/useSchools'

export type ChartMetric = 'fieldPercentile' | 'fwci'

interface SchoolStripChartProps {
  schools: Array<SchoolSummary>
  faculty: Array<Faculty>
  metric: ChartMetric
}

interface StripPoint {
  id: number
  schoolIdx: number
  name: string
  department: string
  // The metric-specific value used for x positioning on the current view
  value: number
  // Both metrics kept on the point so the tooltip always has full context
  fieldPercentile: number | null
  fwci: number | null
  tier: HTier | null
  openalexField: string | null
}

interface HoverState {
  point: StripPoint
  schoolLabel: string
  x: number
  y: number
}

const MARGIN = { top: 20, right: 24, bottom: 40, left: 200 }
const ROW_HEIGHT = 56
const DOT_RADIUS = 3.5
const TRANSITION_MS = 500

// Tooltip viewport clamping — same pattern as ScatterChart
const TOOLTIP_WIDTH = 240
const TOOLTIP_HEIGHT = 130
const TOOLTIP_GAP = 14
const TOOLTIP_PAD = 8

function computeTooltipPosition(
  x: number,
  y: number,
): {
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
  left = Math.max(TOOLTIP_PAD, Math.min(vw - TOOLTIP_WIDTH - TOOLTIP_PAD, left))
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

// FWCI log scale clamps values below this floor (0.1) to avoid log(0) and to
// keep a handful of zero-FWCI faculty visible at the left edge.
const FWCI_FLOOR = 0.1
const FWCI_CEIL = 10
const FWCI_TICKS = [0.1, 0.3, 1, 3, 10]
const FIELD_TICKS = [0, 25, 50, 75, 100]
const FIELD_GRID = [25, 50, 75]
const FWCI_GRID = [0.3, 3]

export function SchoolStripChart({
  schools,
  faculty,
  metric,
}: SchoolStripChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  // Track previous metric to know when to animate vs snap (width changes
  // and initial mount should snap; metric toggles should glide).
  const prevMetricRef = useRef<ChartMetric | null>(null)
  const [width, setWidth] = useState(800)
  const [hover, setHover] = useState<HoverState | null>(null)

  const isFwci = metric === 'fwci'

  // Sort schools by the active metric's median desc, nulls sink to the bottom
  const sortedSchools = useMemo(() => {
    return [...schools].sort((a, b) => {
      const av = (isFwci ? a.medianFwci : a.medianFieldPercentile) ?? -1
      const bv = (isFwci ? b.medianFwci : b.medianFieldPercentile) ?? -1
      return bv - av
    })
  }, [schools, isFwci])

  // School name → sorted index lookup, used when assigning dots to rows
  const schoolIndex = useMemo(() => {
    const m = new Map<string, number>()
    sortedSchools.forEach((s, i) => m.set(s.school, i))
    return m
  }, [sortedSchools])

  // Plottable faculty for the current metric — both values stashed on the
  // point so the tooltip can show them regardless of which axis is active.
  const points = useMemo<Array<StripPoint>>(() => {
    const out: Array<StripPoint> = []
    for (const f of faculty) {
      const raw = isFwci ? f.openalex2yrFwci : f.fieldHPercentile
      if (raw == null) continue
      const idx = schoolIndex.get(f.school)
      if (idx == null) continue
      out.push({
        id: f.id,
        schoolIdx: idx,
        name: f.name,
        department: f.department,
        value: raw,
        fieldPercentile: f.fieldHPercentile,
        fwci: f.openalex2yrFwci,
        tier: f.primaryHTier,
        openalexField: f.openalexField,
      })
    }
    return out
  }, [faculty, schoolIndex, isFwci])

  // Count of visible dots per school row, for the "N of total" label
  const pointsPerSchool = useMemo(() => {
    const counts = new Map<number, number>()
    for (const p of points) {
      counts.set(p.schoolIdx, (counts.get(p.schoolIdx) ?? 0) + 1)
    }
    return counts
  }, [points])

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

    // Detect metric change for animated transitions. Width changes and
    // initial mount snap (dur=0); only metric toggles glide.
    const metricChanged =
      prevMetricRef.current != null && prevMetricRef.current !== metric
    prevMetricRef.current = metric
    const dur = metricChanged ? TRANSITION_MS : 0

    const svg = select(svgRef.current)

    // Scale construction. Log for FWCI (distribution is heavy-tailed with
    // 1.0 as the meaningful reference); linear for field percentile.
    const x = isFwci
      ? scaleLog()
          .domain([FWCI_FLOOR, FWCI_CEIL])
          .range([0, innerWidth])
          .clamp(true)
      : scaleLinear().domain([0, 100]).range([0, innerWidth])

    // Defensive clamp for FWCI log scale (raw 0 would map to -Infinity)
    const xSafe = (v: number): number =>
      isFwci ? x(Math.max(FWCI_FLOOR, v)) : x(v)

    const yFor = (schoolIdx: number): number =>
      schoolIdx * ROW_HEIGHT + ROW_HEIGHT / 2

    const tickValues = isFwci ? FWCI_TICKS : FIELD_TICKS
    const gridValues = isFwci ? FWCI_GRID : FIELD_GRID
    const tickFormat = (d: number | { valueOf: () => number }): string => {
      const n = Number(d)
      if (isFwci) {
        if (n === 1) return '1.0'
        if (n < 1) return n.toString()
        return n.toString()
      }
      return n.toString()
    }
    const axisLabel = isFwci
      ? 'FIELD-WEIGHTED CITATION IMPACT · 1.0 = FIELD AVERAGE'
      : 'GLOBAL FIELD H-INDEX PERCENTILE'
    const formatMedian = (v: number): string =>
      isFwci ? v.toFixed(2) : Math.round(v).toString()

    // Root plot group (created once, reused)
    let plot = svg.select<SVGGElement>('g.plot')
    if (plot.empty()) {
      plot = svg.append('g').attr('class', 'plot')
    }
    plot.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // Alternating row background stripes — keyed on index (not school name)
    // so rows don't animate backgrounds when schools reorder.
    const bgData = sortedSchools.map((_, i) => i)
    plot
      .selectAll<SVGRectElement, number>('rect.row-bg')
      .data(bgData, (d) => d.toString())
      .join('rect')
      .attr('class', 'row-bg')
      .attr('x', 0)
      .attr('y', (i) => i * ROW_HEIGHT)
      .attr('width', innerWidth)
      .attr('height', ROW_HEIGHT)
      .attr('fill', (i) => (i % 2 === 0 ? 'var(--color-muted)' : 'transparent'))
      .attr('fill-opacity', 0.4)

    // Vertical gridlines — positions depend on the scale and re-animate on
    // metric toggle since the tick values are completely different.
    const gridLines = plot
      .selectAll<SVGLineElement, number>('line.grid-x')
      .data(gridValues)
      .join((enter) =>
        enter
          .append('line')
          .attr('class', 'grid-x')
          .attr('stroke', 'var(--color-border)')
          .attr('stroke-opacity', 0.6)
          .attr('stroke-dasharray', '2,3')
          .attr('x1', (d) => xSafe(d))
          .attr('x2', (d) => xSafe(d))
          .attr('y1', 0)
          .attr('y2', innerHeight),
      )
    gridLines
      .transition('pos')
      .duration(dur)
      .attr('x1', (d) => xSafe(d))
      .attr('x2', (d) => xSafe(d))
      .attr('y2', innerHeight)

    // Reference line (FWCI only) at 1.0 — the "field average" marker. Enters
    // on toggle to FWCI, exits on toggle to field %.
    const refData: Array<number> = isFwci ? [1] : []
    const refLines = plot
      .selectAll<SVGLineElement, number>('line.ref-line')
      .data(refData)
    refLines
      .exit()
      .transition('ref')
      .duration(dur)
      .attr('stroke-opacity', 0)
      .remove()
    const refEnter = refLines
      .enter()
      .append('line')
      .attr('class', 'ref-line')
      .attr('stroke', 'var(--color-foreground)')
      .attr('stroke-opacity', 0)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5,3')
      .attr('pointer-events', 'none')
      .attr('x1', (d) => xSafe(d))
      .attr('x2', (d) => xSafe(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
    refEnter.transition('ref').duration(dur).attr('stroke-opacity', 0.4)
    refLines
      .transition('pos')
      .duration(dur)
      .attr('x1', (d) => xSafe(d))
      .attr('x2', (d) => xSafe(d))
      .attr('y2', innerHeight)

    // Reference label "FIELD AVG" above the 1.0 line
    const refLabelData: Array<number> = isFwci ? [1] : []
    const refLabels = plot
      .selectAll<SVGTextElement, number>('text.ref-label')
      .data(refLabelData)
    refLabels.exit().transition('ref').duration(dur).attr('opacity', 0).remove()
    const refLabelEnter = refLabels
      .enter()
      .append('text')
      .attr('class', 'ref-label')
      .attr('font-size', 9)
      .attr('fill', 'var(--color-muted-foreground)')
      .attr('letter-spacing', '0.06em')
      .attr('text-anchor', 'start')
      .attr('pointer-events', 'none')
      .attr('opacity', 0)
      .attr('x', (d) => xSafe(d) + 4)
      .attr('y', -6)
      .text('FIELD AVG')
    refLabelEnter.transition('ref').duration(dur).attr('opacity', 1)
    refLabels
      .transition('pos')
      .duration(dur)
      .attr('x', (d) => xSafe(d) + 4)

    // X axis
    let xAxisG = plot.select<SVGGElement>('g.x-axis')
    if (xAxisG.empty()) {
      xAxisG = plot.append('g').attr('class', 'x-axis')
    }
    xAxisG.attr('transform', `translate(0,${innerHeight})`)
    const axisCall = axisBottom(x)
      .tickValues(tickValues)
      .tickFormat(tickFormat)
      .tickSizeOuter(0)
    if (metricChanged) {
      xAxisG.transition('axis').duration(dur).call(axisCall)
    } else {
      xAxisG.call(axisCall)
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

    // X axis label — text snaps on toggle, position stays put
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
      .attr('y', innerHeight + 32)
      .text(axisLabel)

    // School row labels (two lines: abbreviated name + "n/total")
    const labels = plot
      .selectAll<SVGGElement, SchoolSummary>('g.school-label')
      .data(sortedSchools, (d) => d.school)

    labels.exit().remove()

    const labelsEnter = labels
      .enter()
      .append('g')
      .attr('class', 'school-label')
      .attr(
        'transform',
        (d) => `translate(0, ${yFor(schoolIndex.get(d.school) ?? 0)})`,
      )

    labelsEnter
      .append('text')
      .attr('class', 'school-name')
      .attr('x', -12)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--color-foreground)')
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .attr('y', -6)

    labelsEnter
      .append('text')
      .attr('class', 'school-sub')
      .attr('x', -12)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--color-muted-foreground)')
      .attr('font-size', 10)
      .attr('y', 9)

    const labelsMerged = labelsEnter.merge(labels)

    labelsMerged
      .transition('pos')
      .duration(dur)
      .attr(
        'transform',
        (d) => `translate(0, ${yFor(schoolIndex.get(d.school) ?? 0)})`,
      )
    labelsMerged
      .select<SVGTextElement>('text.school-name')
      .text((d) => abbreviateSchool(d.school))
    labelsMerged.select<SVGTextElement>('text.school-sub').text((d) => {
      const visible = pointsPerSchool.get(schoolIndex.get(d.school) ?? -1) ?? 0
      return visible === d.n ? `n=${d.n}` : `${visible} of ${d.n}`
    })

    // Dots — one per plottable faculty. Positions update on metric change,
    // opacity handles initial fade-in.
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
      // Start at the target position so newly-entered dots don't fly in
      .attr('cx', (d) => xSafe(d.value))
      .attr('cy', (d) => yFor(d.schoolIdx) + jitterFor(d.id) * (dotBand / 2))
      .attr('r', DOT_RADIUS)

    const dotsMerged = dotsEnter
      .merge(dots)
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

    // Position transition (animated on metric change, instant otherwise)
    dotsMerged
      .transition('pos')
      .duration(dur)
      .attr('cx', (d) => xSafe(d.value))
      .attr('cy', (d) => yFor(d.schoolIdx) + jitterFor(d.id) * (dotBand / 2))

    // Opacity transition — always runs so newly-entered dots fade in. For
    // existing dots it's a no-op (already at 0.35).
    dotsMerged.transition('opacity').duration(450).attr('opacity', 0.35)

    // ---- Median markers + labels ----
    interface MedianMarker {
      schoolKey: string
      schoolIdx: number
      value: number
    }
    const medianMarkers: Array<MedianMarker> = sortedSchools
      .map((s, i) => ({
        schoolKey: s.school,
        schoolIdx: i,
        value: (isFwci ? s.medianFwci : s.medianFieldPercentile) ?? Number.NaN,
      }))
      .filter((m) => !Number.isNaN(m.value))

    const markers = plot
      .selectAll<SVGLineElement, MedianMarker>('line.median')
      .data(medianMarkers, (d) => d.schoolKey)
    markers.exit().remove()
    const markersEnter = markers
      .enter()
      .append('line')
      .attr('class', 'median')
      .attr('stroke', 'var(--color-slu-900)')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('pointer-events', 'none')
      .attr('x1', (d) => xSafe(d.value))
      .attr('x2', (d) => xSafe(d.value))
      .attr('y1', (d) => yFor(d.schoolIdx) - ROW_HEIGHT * 0.35)
      .attr('y2', (d) => yFor(d.schoolIdx) + ROW_HEIGHT * 0.35)
    markersEnter
      .merge(markers)
      .transition('pos')
      .duration(dur)
      .attr('x1', (d) => xSafe(d.value))
      .attr('x2', (d) => xSafe(d.value))
      .attr('y1', (d) => yFor(d.schoolIdx) - ROW_HEIGHT * 0.35)
      .attr('y2', (d) => yFor(d.schoolIdx) + ROW_HEIGHT * 0.35)

    // Median value labels — small number next to each median tick
    const medianLabels = plot
      .selectAll<SVGTextElement, MedianMarker>('text.median-label')
      .data(medianMarkers, (d) => d.schoolKey)
    medianLabels.exit().remove()
    const medianLabelsEnter = medianLabels
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
      .attr('x', (d) => xSafe(d.value) + 6)
      .attr('y', (d) => yFor(d.schoolIdx) - ROW_HEIGHT * 0.3)

    medianLabelsEnter
      .merge(medianLabels)
      .text((d) => formatMedian(d.value))
      .transition('pos')
      .duration(dur)
      .attr('x', (d) => xSafe(d.value) + 6)
      .attr('y', (d) => yFor(d.schoolIdx) - ROW_HEIGHT * 0.3)
  }, [
    sortedSchools,
    schoolIndex,
    points,
    pointsPerSchool,
    width,
    metric,
    isFwci,
  ])

  if (sortedSchools.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center text-sm text-muted-foreground"
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
      {hover
        ? (() => {
            const pos = computeTooltipPosition(hover.x, hover.y)
            return (
              <div
                className="pointer-events-none fixed z-50 max-w-[280px] min-w-[200px] animate-in rounded-md border bg-popover p-2.5 text-popover-foreground shadow-md duration-150 ease-out fade-in-0 zoom-in-95"
                style={{ left: pos.left, top: pos.top }}
              >
                <div className="text-[13px] font-medium">
                  {hover.point.name}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {hover.point.department}
                </div>
                {hover.point.openalexField ? (
                  <div className="mt-0.5 text-[10px] text-muted-foreground italic">
                    Field: {hover.point.openalexField}
                  </div>
                ) : null}
                <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 text-[11px]">
                  {isFwci ? (
                    <FwciTooltipCell value={hover.point.fwci} primary />
                  ) : (
                    <FieldPctTooltipCell
                      value={hover.point.fieldPercentile}
                      primary
                    />
                  )}
                  {isFwci ? (
                    <FieldPctTooltipCell value={hover.point.fieldPercentile} />
                  ) : (
                    <FwciTooltipCell value={hover.point.fwci} />
                  )}
                  <div>
                    <div className="text-[9px] tracking-wider text-muted-foreground uppercase">
                      Tier
                    </div>
                    <div className="text-[11px] font-medium">
                      {hover.point.tier ? TIER_LABELS[hover.point.tier] : '—'}
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

interface TooltipCellProps {
  value: number | null
  primary?: boolean
}

function FieldPctTooltipCell({ value, primary }: TooltipCellProps) {
  return (
    <div>
      <div className="text-[9px] tracking-wider text-muted-foreground uppercase">
        Field %
      </div>
      <div
        className={
          primary
            ? 'tabular text-[13px] font-semibold text-primary'
            : 'tabular text-[11px] font-medium text-foreground'
        }
      >
        {value == null ? '—' : Math.round(value)}
      </div>
    </div>
  )
}

function FwciTooltipCell({ value, primary }: TooltipCellProps) {
  if (value == null) {
    return (
      <div>
        <div className="text-[9px] tracking-wider text-muted-foreground uppercase">
          FWCI
        </div>
        <div
          className={
            primary
              ? 'tabular text-[13px] font-semibold'
              : 'tabular text-[11px] text-muted-foreground'
          }
        >
          —
        </div>
      </div>
    )
  }
  const aboveAverage = value >= 1
  return (
    <div>
      <div className="text-[9px] tracking-wider text-muted-foreground uppercase">
        FWCI
      </div>
      <div
        className={
          primary
            ? `tabular text-[13px] font-semibold ${aboveAverage ? 'text-primary' : 'text-muted-foreground'}`
            : `tabular text-[11px] ${aboveAverage ? 'font-medium text-foreground' : 'text-muted-foreground'}`
        }
      >
        {value.toFixed(2)}
      </div>
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
