import { useMemo } from 'react'
import type { Faculty, HTier } from '@/lib/types'

// Higher = better, used to sort top-faculty lists by tier first then h-index.
const TIER_RANK: Record<HTier, number> = {
  'top_1%': 6,
  'top_5%': 5,
  'top_10%': 4,
  'top_25%': 3,
  above_median: 2,
  below_median: 1,
}

// Departments with fewer than this many faculty are flagged noisy — their
// percentile medians swing wildly on single-person changes. Schools are
// always ≥ 6 so the flag is dept-level only.
const NOISY_N_THRESHOLD = 5

// Less than half the rows having bibliometric coverage flags book-scholarship
// fields (Theology, English, History, Philosophy) where the indexes are thin.
const LOW_COVERAGE_THRESHOLD = 0.5

// How many "top faculty" to precompute for the expandable row detail.
const TOP_FACULTY_LIMIT = 5

export interface TopFaculty {
  id: number
  name: string
  department: string
  tier: HTier | null
  openalexHIndex: number | null
  fieldHPercentile: number | null
  fwci: number | null
}

export interface DeptSummary {
  department: string
  school: string
  n: number
  nWithData: number
  coverage: number
  noisy: boolean
  lowCoverage: boolean
  medianFieldPercentile: number | null
  medianFwci: number | null
  medianOpenalexHIndex: number | null
  nTop1: number
  nTop5: number
  nTop10: number
  nTop25: number
  topField: string | null
  topFaculty: Array<TopFaculty>
}

export interface SchoolSummary {
  school: string
  n: number
  nWithData: number
  coverage: number
  lowCoverage: boolean
  medianFieldPercentile: number | null
  medianFwci: number | null
  medianOpenalexHIndex: number | null
  nTop1: number
  nTop5: number
  nTop10: number
  nTop25: number
  topField: string | null
  topFaculty: Array<TopFaculty>
  departments: Array<DeptSummary>
}

function median(values: Array<number>): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function mode<T>(values: Array<T>): T | null {
  if (values.length === 0) return null
  const counts = new Map<T, number>()
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  let best: T | null = null
  let bestCount = 0
  for (const [k, c] of counts) {
    if (c > bestCount) {
      best = k
      bestCount = c
    }
  }
  return best
}

// Shared tier-threshold counter. "top 5%" counts top_1% + top_5% (threshold
// semantics, matching the filter dropdown).
interface TierCounts {
  nTop1: number
  nTop5: number
  nTop10: number
  nTop25: number
}

function countTiers(faculty: Array<Faculty>): TierCounts {
  let nTop1 = 0
  let nTop5 = 0
  let nTop10 = 0
  let nTop25 = 0
  for (const f of faculty) {
    if (!f.primaryHTier) continue
    const rank = TIER_RANK[f.primaryHTier]
    if (rank >= TIER_RANK['top_1%']) nTop1++
    if (rank >= TIER_RANK['top_5%']) nTop5++
    if (rank >= TIER_RANK['top_10%']) nTop10++
    if (rank >= TIER_RANK['top_25%']) nTop25++
  }
  return { nTop1, nTop5, nTop10, nTop25 }
}

// Top faculty, sorted by tier → h-index → field percentile.
function topFacultyFor(
  faculty: Array<Faculty>,
  limit: number,
): Array<TopFaculty> {
  return faculty
    .map<TopFaculty>((f) => ({
      id: f.id,
      name: f.name,
      department: f.department,
      tier: f.primaryHTier,
      openalexHIndex: f.openalexHIndex,
      fieldHPercentile: f.fieldHPercentile,
      fwci: f.openalex2yrFwci,
    }))
    .sort((a, b) => {
      const ta = a.tier ? TIER_RANK[a.tier] : 0
      const tb = b.tier ? TIER_RANK[b.tier] : 0
      if (ta !== tb) return tb - ta
      const ha = a.openalexHIndex ?? 0
      const hb = b.openalexHIndex ?? 0
      if (ha !== hb) return hb - ha
      const fa = a.fieldHPercentile ?? 0
      const fb = b.fieldHPercentile ?? 0
      return fb - fa
    })
    .slice(0, limit)
}

function buildDeptSummary(
  department: string,
  faculty: Array<Faculty>,
): DeptSummary {
  const school = faculty[0]?.school ?? ''
  const n = faculty.length
  const withData = faculty.filter((f) => f.fieldHPercentile != null)
  const nWithData = withData.length
  const coverage = n > 0 ? nWithData / n : 0

  const fieldPcts = withData
    .map((f) => f.fieldHPercentile)
    .filter((v): v is number => v != null)
  const fwcis = faculty
    .map((f) => f.openalex2yrFwci)
    .filter((v): v is number => v != null)
  const openalexHs = faculty
    .map((f) => f.openalexHIndex)
    .filter((v): v is number => v != null)
  const fields = faculty
    .map((f) => f.openalexField)
    .filter((v): v is string => v != null && v.length > 0)

  return {
    department,
    school,
    n,
    nWithData,
    coverage,
    noisy: n < NOISY_N_THRESHOLD,
    lowCoverage: coverage < LOW_COVERAGE_THRESHOLD,
    medianFieldPercentile: median(fieldPcts),
    medianFwci: median(fwcis),
    medianOpenalexHIndex: median(openalexHs),
    ...countTiers(faculty),
    topField: mode(fields),
    topFaculty: topFacultyFor(faculty, 3),
  }
}

/**
 * Aggregate all faculty into 9 school-level summary rows, with each row
 * carrying a nested drill-down array of department summaries. Every metric
 * is OpenAlex-derived (FWCI, field percentile, OpenAlex h-index) — the field
 * benchmarks only exist in OpenAlex, so the Scholar/OpenAlex source toggle
 * is intentionally ignored on this page.
 */
export function useSchoolSummary(
  all: Array<Faculty> | null,
): Array<SchoolSummary> {
  return useMemo(() => {
    if (!all) return []

    // Bucket by school
    const buckets = new Map<string, Array<Faculty>>()
    for (const f of all) {
      if (!f.school) continue
      const b = buckets.get(f.school)
      if (b) b.push(f)
      else buckets.set(f.school, [f])
    }

    const summaries: Array<SchoolSummary> = []

    for (const [school, faculty] of buckets) {
      const n = faculty.length
      const withData = faculty.filter((f) => f.fieldHPercentile != null)
      const nWithData = withData.length
      const coverage = n > 0 ? nWithData / n : 0

      const fieldPcts = withData
        .map((f) => f.fieldHPercentile)
        .filter((v): v is number => v != null)
      const fwcis = faculty
        .map((f) => f.openalex2yrFwci)
        .filter((v): v is number => v != null)
      const openalexHs = faculty
        .map((f) => f.openalexHIndex)
        .filter((v): v is number => v != null)
      const fields = faculty
        .map((f) => f.openalexField)
        .filter((v): v is string => v != null && v.length > 0)

      // Nested department breakdown — each dept within this school gets
      // its own summary row for the expanded drill-down view.
      const deptBuckets = new Map<string, Array<Faculty>>()
      for (const f of faculty) {
        if (!f.department) continue
        const b = deptBuckets.get(f.department)
        if (b) b.push(f)
        else deptBuckets.set(f.department, [f])
      }
      const departments: Array<DeptSummary> = []
      for (const [deptName, deptFaculty] of deptBuckets) {
        departments.push(buildDeptSummary(deptName, deptFaculty))
      }
      // Sort dept drill-down by median field percentile, nulls last
      departments.sort((a, b) => {
        const av = a.medianFieldPercentile ?? -1
        const bv = b.medianFieldPercentile ?? -1
        return bv - av
      })

      summaries.push({
        school,
        n,
        nWithData,
        coverage,
        lowCoverage: coverage < LOW_COVERAGE_THRESHOLD,
        medianFieldPercentile: median(fieldPcts),
        medianFwci: median(fwcis),
        medianOpenalexHIndex: median(openalexHs),
        ...countTiers(faculty),
        topField: mode(fields),
        topFaculty: topFacultyFor(faculty, TOP_FACULTY_LIMIT),
        departments,
      })
    }

    return summaries
  }, [all])
}
