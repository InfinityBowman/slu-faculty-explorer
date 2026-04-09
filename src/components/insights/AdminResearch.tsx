import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { Faculty } from '@/lib/types'
import { adminRoleMetrics } from '@/lib/insights'

export function AdminResearch({ faculty }: { faculty: Array<Faculty> }) {
  const roles = useMemo(() => adminRoleMetrics(faculty), [faculty])

  return (
    <ResponsiveContainer width="100%" height={roles.length * 46 + 40}>
      <BarChart data={roles} layout="vertical" margin={{ left: 90, right: 30, top: 5, bottom: 5 }}>
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}`}
        />
        <YAxis
          type="category"
          dataKey="role"
          width={80}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload as { role: string; n: number; medianPercentile: number | null; medianFwci: number | null }
            return (
              <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                <div className="font-medium">{d.role} <span className="text-muted-foreground">n={d.n}</span></div>
                <div className="mt-1 tabular">
                  {d.medianPercentile != null ? `Field percentile: ${Math.round(d.medianPercentile)}` : 'No data'}
                  {d.medianFwci != null ? ` · FWCI: ${d.medianFwci.toFixed(2)}` : ''}
                </div>
              </div>
            )
          }}
          cursor={{ fill: 'var(--color-muted)', fillOpacity: 0.3 }}
        />
        <Bar
          dataKey="medianPercentile"
          fill="oklch(0.41 0.17 259)"
          radius={[0, 4, 4, 0]}
          barSize={22}
          label={{ position: 'right', fontSize: 10, fill: 'var(--color-muted-foreground)', formatter: (v: unknown) => typeof v === 'number' ? Math.round(v) : '' }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
