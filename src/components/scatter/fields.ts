import type { CategoricalField, NumericField } from './types'
import { H_TIER_ORDER } from '@/lib/types'

// ─── Tick / value formatters ───────────────────────────────────────────────

const formatLog10 = (n: number): string => {
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return n.toString()
}

const formatInt = (n: number): string => Math.round(n).toString()
const formatPercent = (n: number): string => `${Math.round(n)}`
const formatFwci = (n: number): string => n.toFixed(2)
const formatYears = (n: number): string => `${Math.round(n)}y`

// Half-decade tick set for log axes that span many orders of magnitude
// (works, citations). Capped at 5k so a few extreme outliers don't waste
// half the plot area.
const LOG_TICK_VALUES = [1, 3, 10, 30, 100, 300, 1000, 3000, 5000]

// Power-of-ten tick set for log axes with a smaller dynamic range.
const POWER10_TICK_VALUES = [1, 10, 100, 1000, 10_000, 100_000, 1_000_000]

// ─── Numeric fields (X / Y / Size) ─────────────────────────────────────────

export const NUMERIC_FIELDS: ReadonlyArray<NumericField> = [
  {
    id: 'works',
    label: 'Works',
    accessor: (f) => f.openalexWorksCount,
    scale: 'log',
    tickValues: LOG_TICK_VALUES,
    formatTick: formatLog10,
    formatValue: formatInt,
  },
  {
    id: 'citations',
    label: 'Citations',
    accessor: (f, source) =>
      source === 'scholar' ? f.citations : f.openalexCitations,
    scale: 'log',
    tickValues: POWER10_TICK_VALUES,
    formatTick: formatLog10,
    formatValue: formatInt,
  },
  {
    id: 'hIndex',
    label: 'h-index',
    accessor: (f, source) =>
      source === 'scholar' ? f.hIndex : f.openalexHIndex,
    scale: 'linear',
    formatTick: formatInt,
    formatValue: formatInt,
  },
  {
    id: 'i10',
    label: 'i10',
    accessor: (f, source) =>
      source === 'scholar' ? f.i10Index : f.openalexI10Index,
    scale: 'linear',
    formatTick: formatInt,
    formatValue: formatInt,
  },
  {
    id: 'fwci',
    label: 'FWCI',
    accessor: (f) => f.openalex2yrFwci,
    // FWCI is mostly small values clustered near 1; linear is much more
    // legible than log here.
    scale: 'linear',
    formatTick: formatFwci,
    formatValue: formatFwci,
  },
  {
    id: 'fieldPct',
    label: 'Global field rank',
    accessor: (f) => f.fieldHPercentile,
    scale: 'linear',
    domain: [0, 100],
    formatTick: formatPercent,
    formatValue: (n) => `${Math.round(n)}th percentile`,
  },
  {
    id: 'subfieldPct',
    label: 'Global subfield rank',
    accessor: (f) => f.subfieldHPercentile,
    scale: 'linear',
    domain: [0, 100],
    formatTick: formatPercent,
    formatValue: (n) => `${Math.round(n)}th percentile`,
  },
  {
    id: 'deptHPct',
    label: 'Dept percentile (h)',
    accessor: (f) => f.deptHPercentile,
    scale: 'linear',
    domain: [0, 100],
    formatTick: formatPercent,
    formatValue: (n) => `${Math.round(n)}th percentile`,
  },
  {
    id: 'deptFwciPct',
    label: 'Dept percentile (FWCI)',
    accessor: (f) => f.deptFwciPercentile,
    scale: 'linear',
    domain: [0, 100],
    formatTick: formatPercent,
    formatValue: (n) => `${Math.round(n)}th percentile`,
  },
  {
    id: 'careerLength',
    label: 'Career length (years)',
    accessor: (f) => {
      if (f.openalexFirstYear == null || f.openalexLastYear == null) return null
      const len = f.openalexLastYear - f.openalexFirstYear + 1
      return len > 0 ? len : null
    },
    scale: 'linear',
    formatTick: formatInt,
    formatValue: formatYears,
  },
  {
    id: 'lastYear',
    label: 'Last publication year',
    accessor: (f) => f.openalexLastYear,
    scale: 'linear',
    formatTick: formatInt,
    formatValue: formatInt,
  },
]

const NUMERIC_BY_ID = new Map(NUMERIC_FIELDS.map((f) => [f.id, f] as const))

export function findNumericField(id: string): NumericField {
  const field = NUMERIC_BY_ID.get(id)
  if (!field) {
    throw new Error(`Unknown numeric field: ${id}`)
  }
  return field
}

// ─── Categorical fields (Color) ────────────────────────────────────────────

export const CATEGORICAL_FIELDS: ReadonlyArray<CategoricalField> = [
  {
    id: 'domain',
    label: 'Domain',
    accessor: (f) => f.openalexDomain,
  },
  {
    id: 'school',
    label: 'School',
    accessor: (f) => f.school,
  },
  {
    id: 'tier',
    label: 'Field tier',
    accessor: (f) => f.primaryHTier,
    ordered: H_TIER_ORDER,
  },
  {
    id: 'adminRole',
    label: 'Admin role',
    accessor: (f) => f.adminRole,
  },
]

const CATEGORICAL_BY_ID = new Map(
  CATEGORICAL_FIELDS.map((f) => [f.id, f] as const),
)

export function findCategoricalField(id: string): CategoricalField | null {
  return CATEGORICAL_BY_ID.get(id) ?? null
}
