import { H_TIER_ORDER } from './types'
import type { Faculty, HTier } from './types'

// ── Shared constants ───────────────────────────────────────────────────────

// SLU monochromatic blue ramp — darkest = highest tier.
// Matches the sequential palette in scatter/palettes.ts.
export const TIER_FILL: Record<HTier, string> = {
  'top_1%': 'oklch(0.28 0.16 259)',
  'top_5%': 'oklch(0.40 0.18 259)',
  'top_10%': 'oklch(0.52 0.17 259)',
  'top_25%': 'oklch(0.64 0.13 259)',
  above_median: 'oklch(0.78 0.08 259)',
  below_median: 'oklch(0.88 0.04 259)',
}

export const TIER_LABEL: Record<HTier, string> = {
  'top_1%': 'Top 1%',
  'top_5%': 'Top 5%',
  'top_10%': 'Top 10%',
  'top_25%': 'Top 25%',
  above_median: 'Above median',
  below_median: 'Below median',
}

const SCHOOL_ABBR: Record<string, string> = {
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

export function abbreviate(school: string): string {
  return SCHOOL_ABBR[school] ?? school
}

// ── Aggregation utilities ──────────────────────────────────────────────────

export function median(values: Array<number>): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function quartiles(sorted: Array<number>) {
  const n = sorted.length
  const med =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)]
  const lower = sorted.slice(0, Math.floor(n / 2))
  const upper = sorted.slice(Math.ceil(n / 2))
  const q = (arr: Array<number>) =>
    arr.length === 0
      ? med
      : arr.length % 2 === 0
        ? (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2
        : arr[Math.floor(arr.length / 2)]
  return { q1: q(lower), med, q3: q(upper) }
}

// ── Tier distribution ──────────────────────────────────────────────────────

export interface TierDatum {
  label: string
  n: number
  'top_1%': number
  'top_5%': number
  'top_10%': number
  'top_25%': number
  above_median: number
  below_median: number
}

export function tierData(faculty: Array<Faculty>, label: string): TierDatum {
  const counts: Record<string, number> = {}
  for (const t of H_TIER_ORDER) counts[t] = 0
  let n = 0
  for (const f of faculty) {
    if (f.primaryHTier) {
      counts[f.primaryHTier]++
      n++
    }
  }
  const row: TierDatum = {
    label,
    n,
    'top_1%': 0,
    'top_5%': 0,
    'top_10%': 0,
    'top_25%': 0,
    above_median: 0,
    below_median: 0,
  }
  for (const t of H_TIER_ORDER) {
    row[t] = n > 0 ? Math.round((counts[t] / n) * 1000) / 10 : 0
  }
  return row
}

// ── FWCI histogram ─────────────────────────────────────────────────────────

export interface HistogramBin {
  label: string
  count: number
  aboveAvg: boolean
}

export function fwciHistogram(faculty: Array<Faculty>) {
  const edges = [0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0, Infinity]
  const labels = [
    '<0.25',
    '0.25–0.5',
    '0.5–0.75',
    '0.75–1.0',
    '1.0–1.5',
    '1.5–2.0',
    '2.0–3.0',
    '3.0–5.0',
    '5.0+',
  ]
  const bins: Array<HistogramBin> = labels.map((label, i) => ({
    label,
    count: 0,
    aboveAvg: edges[i] >= 1.0,
  }))

  const values: Array<number> = []
  let above = 0
  for (const f of faculty) {
    if (f.openalex2yrFwci == null) continue
    values.push(f.openalex2yrFwci)
    if (f.openalex2yrFwci >= 1.0) above++
    for (let i = 0; i < edges.length - 1; i++) {
      if (f.openalex2yrFwci >= edges[i] && f.openalex2yrFwci < edges[i + 1]) {
        bins[i].count++
        break
      }
    }
  }
  return {
    bins,
    abovePct: values.length > 0 ? Math.round((above / values.length) * 100) : 0,
    medianFwci: median(values),
  }
}

// ── m-index by career decade ───────────────────────────────────────────────

interface DecadeGroup {
  decade: string
  q1: number
  med: number
  q3: number
  min: number
  max: number
  n: number
}

export function mIndexByDecade(faculty: Array<Faculty>): Array<DecadeGroup> {
  const buckets = new Map<string, Array<number>>()
  for (const f of faculty) {
    if (f.mIndex == null || f.openalexFirstYear == null) continue
    const decade = `${Math.floor(f.openalexFirstYear / 10) * 10}s`
    const arr = buckets.get(decade) ?? []
    arr.push(f.mIndex)
    buckets.set(decade, arr)
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.length >= 3)
    .map(([decade, values]) => {
      const sorted = [...values].sort((a, b) => a - b)
      const { q1, med, q3 } = quartiles(sorted)
      return {
        decade,
        q1,
        med,
        q3,
        min: sorted[0],
        max: sorted.at(-1)!,
        n: sorted.length,
      }
    })
}

// ── Admin role metrics ─────────────────────────────────────────────────────

export interface AdminRoleRow {
  role: string
  n: number
  medianPercentile: number | null
  medianFwci: number | null
}

const ROLE_LABELS: Record<string, string> = {
  Dean: 'Dean / Provost',
  'Associate Dean': 'Assoc. Dean',
  Chair: 'Dept. Chair',
  Director: 'Director',
  Coordinator: 'Coordinator',
  '': 'No admin role',
}

export function adminRoleMetrics(faculty: Array<Faculty>): Array<AdminRoleRow> {
  return ['Dean', 'Associate Dean', 'Chair', 'Director', 'Coordinator', ''].map(
    (role) => {
      const members = faculty.filter((f) => (f.adminRole ?? '') === role)
      const pcts = members
        .map((f) => f.fieldHPercentile)
        .filter((v): v is number => v != null)
      const fwcis = members
        .map((f) => f.openalex2yrFwci)
        .filter((v): v is number => v != null)
      return {
        role: ROLE_LABELS[role],
        n: members.length,
        medianPercentile: median(pcts),
        medianFwci: median(fwcis),
      }
    },
  )
}

// ── Coverage matrix ────────────────────────────────────────────────────────

interface CoverageRow {
  school: string
  total: number
  scholar: number
  openalex: number
  either: number
  neither: number
  coveragePct: number
}

export function coverageMatrix(faculty: Array<Faculty>): Array<CoverageRow> {
  const buckets = new Map<string, Array<Faculty>>()
  for (const f of faculty) {
    if (!f.school) continue
    const arr = buckets.get(f.school) ?? []
    arr.push(f)
    buckets.set(f.school, arr)
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([school, members]) => {
      let scholar = 0,
        openalex = 0,
        either = 0,
        neither = 0
      for (const f of members) {
        const s = f.scholarId != null,
          o = f.openalexId != null
        if (s) scholar++
        if (o) openalex++
        if (s || o) either++
        else neither++
      }
      return {
        school,
        total: members.length,
        scholar,
        openalex,
        either,
        neither,
        coveragePct: Math.round((either / members.length) * 100),
      }
    })
}

// ── Benchmark loader ───────────────────────────────────────────────────────

export interface Benchmark {
  level: 'field' | 'subfield'
  name: string
  nAuthors: number
  p25: number
  p50: number
  p75: number
  p90: number
  p95: number
  p99: number
}

export async function loadBenchmarks(): Promise<Array<Benchmark>> {
  const Papa = await import('papaparse')
  const res = await fetch('/benchmarks.csv')
  if (!res.ok) return []
  const text = await res.text()
  const parsed = Papa.default.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })
  return parsed.data.map((row) => ({
    level: row.level as 'field' | 'subfield',
    name: row.name,
    nAuthors: Number(row.n_authors) || 0,
    p25: Number(row.p25) || 0,
    p50: Number(row.p50) || 0,
    p75: Number(row.p75) || 0,
    p90: Number(row.p90) || 0,
    p95: Number(row.p95) || 0,
    p99: Number(row.p99) || 0,
  }))
}
