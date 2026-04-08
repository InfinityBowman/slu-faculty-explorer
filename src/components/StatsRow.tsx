import { useMemo } from 'react'
import type { Faculty } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store/appStore'

interface StatsRowProps {
  rows: Array<Faculty>
}

function median(values: Array<number>): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function StatsRow({ rows }: StatsRowProps) {
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

  const profileLabel =
    metricSource === 'scholar' ? 'With Scholar profile' : 'With OpenAlex ID'

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <StatCard label="Faculty shown" value={stats.count.toLocaleString()} />
      <StatCard
        label={profileLabel}
        value={`${stats.withProfile.toLocaleString()} / ${stats.count.toLocaleString()}`}
      />
      <StatCard
        label="Median h-index"
        value={stats.medianH == null ? '—' : stats.medianH.toString()}
      />
      <StatCard
        label="Total citations"
        value={stats.totalCitations.toLocaleString()}
      />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-medium">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  )
}
