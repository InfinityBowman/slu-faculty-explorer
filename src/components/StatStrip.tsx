import { useMemo } from 'react'
import type { Faculty } from '@/lib/types'

interface StatStripProps {
  rows: Array<Faculty>
  total: number
}

function median(values: Array<number>): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export function StatStrip({ rows, total }: StatStripProps) {
  const stats = useMemo(() => {
    const hValues: Array<number> = []
    const citeValues: Array<number> = []
    let withProfile = 0
    for (const f of rows) {
      const h = f.hIndex ?? f.openalexHIndex
      const c = f.citations ?? f.openalexCitations
      if (h != null) hValues.push(h)
      if (c != null) citeValues.push(c)
      if (f.scholarId != null || f.openalexId != null) withProfile += 1
    }
    return {
      count: rows.length,
      withProfile,
      medianH: median(hValues),
      totalCitations: citeValues.reduce((sum, n) => sum + n, 0),
    }
  }, [rows])

  const isFiltered = rows.length !== total
  const profileRatio =
    stats.count > 0 ? Math.round((stats.withProfile / stats.count) * 100) : 0

  return (
    <section className="rounded-lg border bg-card">
      <div className="grid grid-cols-2 md:grid-cols-4">
        <Stat
          label="Faculty"
          value={stats.count.toLocaleString()}
          hint={
            isFiltered ? `of ${total.toLocaleString()} total` : 'total tracked'
          }
        />
        <Stat
          label="With profile"
          value={stats.withProfile.toLocaleString()}
          hint={`${profileRatio}% coverage`}
        />
        <Stat
          label="Median h-index"
          value={
            stats.medianH == null
              ? '—'
              : Number.isInteger(stats.medianH)
                ? stats.medianH.toString()
                : stats.medianH.toFixed(1)
          }
          hint="Scholar + OpenAlex"
        />
        <Stat
          label="Total citations"
          value={stats.totalCitations.toLocaleString()}
          hint="Scholar + OpenAlex"
        />
      </div>
    </section>
  )
}

interface StatProps {
  label: string
  value: string
  hint: string
}

function Stat({ label, value, hint }: StatProps) {
  return (
    <div className="relative px-6 py-5 not-first:border-l">
      <div className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="tabular mt-1.5 text-3xl leading-none font-semibold tracking-tight">
        {value}
      </div>
      <div className="tabular mt-2 text-[11px] text-muted-foreground">
        {hint}
      </div>
    </div>
  )
}
