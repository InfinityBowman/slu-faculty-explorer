import { useMemo } from 'react'
import type { Faculty } from '@/lib/types'
import { useAppStore } from '@/store/appStore'

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
  const metricSource = useAppStore((s) => s.metricSource)

  const stats = useMemo(() => {
    const hValues: Array<number> = []
    const citeValues: Array<number> = []
    let withProfile = 0
    for (const f of rows) {
      const h = metricSource === 'scholar' ? f.hIndex : f.openalexHIndex
      const c = metricSource === 'scholar' ? f.citations : f.openalexCitations
      const hasProfile =
        metricSource === 'scholar' ? f.scholarId != null : f.openalexId != null
      if (h != null) hValues.push(h)
      if (c != null) citeValues.push(c)
      if (hasProfile) withProfile += 1
    }
    return {
      count: rows.length,
      withProfile,
      medianH: median(hValues),
      totalCitations: citeValues.reduce((sum, n) => sum + n, 0),
    }
  }, [rows, metricSource])

  const isFiltered = rows.length !== total
  const profileLabel =
    metricSource === 'scholar' ? 'With Scholar profile' : 'With OpenAlex ID'
  const profileRatio =
    stats.count > 0 ? Math.round((stats.withProfile / stats.count) * 100) : 0

  return (
    <section className="bg-card rounded-lg border">
      <div className="grid grid-cols-2 md:grid-cols-4">
        <Stat
          label="Faculty"
          value={stats.count.toLocaleString()}
          hint={
            isFiltered ? `of ${total.toLocaleString()} total` : 'total tracked'
          }
        />
        <Stat
          label={profileLabel}
          value={stats.withProfile.toLocaleString()}
          hint={`${profileRatio}% of shown`}
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
          hint={metricSource === 'scholar' ? 'Google Scholar' : 'OpenAlex'}
        />
        <Stat
          label="Total citations"
          value={stats.totalCitations.toLocaleString()}
          hint={metricSource === 'scholar' ? 'Google Scholar' : 'OpenAlex'}
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
      <div className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
        {label}
      </div>
      <div className="tabular mt-1.5 text-3xl leading-none font-semibold tracking-tight">
        {value}
      </div>
      <div className="text-muted-foreground tabular mt-2 text-[11px]">
        {hint}
      </div>
    </div>
  )
}
