import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Faculty } from '@/lib/types'
import { useAppStore } from '@/store/appStore'

interface HIndexChartProps {
  rows: Array<Faculty>
}

const BUCKETS = [
  { label: '0', min: 0, max: 0 },
  { label: '1–5', min: 1, max: 5 },
  { label: '6–10', min: 6, max: 10 },
  { label: '11–20', min: 11, max: 20 },
  { label: '21–40', min: 21, max: 40 },
  { label: '41–60', min: 41, max: 60 },
  { label: '61+', min: 61, max: Infinity },
]

export function HIndexChart({ rows }: HIndexChartProps) {
  const metricSource = useAppStore((s) => s.metricSource)

  const data = useMemo(() => {
    const counts = BUCKETS.map((b) => ({ bucket: b.label, count: 0 }))
    for (const row of rows) {
      const h = metricSource === 'scholar' ? row.hIndex : row.openalexHIndex
      if (h == null) continue
      const idx = BUCKETS.findIndex((b) => h >= b.min && h <= b.max)
      if (idx >= 0) counts[idx].count += 1
    }
    return counts
  }, [rows, metricSource])

  return (
    <div className="min-w-0">
      <ResponsiveContainer width="100%" height={256}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="bucket" className="text-xs" />
          <YAxis allowDecimals={false} className="text-xs" />
          <Tooltip
            contentStyle={{
              background: 'var(--color-popover)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
