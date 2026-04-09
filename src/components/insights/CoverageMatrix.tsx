import { useMemo } from 'react'
import {
  Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Faculty } from '@/lib/types'
import { abbreviate, coverageMatrix } from '@/lib/insights'

export function CoverageMatrix({ faculty }: { faculty: Array<Faculty> }) {
  const data = useMemo(
    () =>
      coverageMatrix(faculty).map((r) => ({
        school: abbreviate(r.school),
        Scholar: r.scholar,
        OpenAlex: r.openalex,
        Neither: r.neither,
        total: r.total,
        pct: r.coveragePct,
      })),
    [faculty],
  )

  return (
    <ResponsiveContainer width="100%" height={data.length * 44 + 60}>
      <BarChart data={data} layout="vertical" margin={{ left: 130, right: 50, top: 5, bottom: 10 }}>
        <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="school"
          width={120}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload.length) return null
            const d = payload[0].payload as { school: string; Scholar: number; OpenAlex: number; Neither: number; total: number; pct: number }
            return (
              <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                <div className="font-medium">{d.school}</div>
                <div className="mt-1 tabular space-y-0.5">
                  <div>Scholar: {d.Scholar} · OpenAlex: {d.OpenAlex} · Neither: {d.Neither}</div>
                  <div className="font-medium">Coverage: {d.pct}% of {d.total}</div>
                </div>
              </div>
            )
          }}
          cursor={{ fill: 'var(--color-muted)', fillOpacity: 0.3 }}
        />
        <Legend
          verticalAlign="bottom"
          iconSize={10}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
        <Bar dataKey="Scholar" stackId="src" fill="oklch(0.35 0.15 259)" barSize={20} />
        <Bar dataKey="OpenAlex" stackId="src" fill="oklch(0.55 0.19 259)" barSize={20} />
        <Bar dataKey="Neither" stackId="src" fill="oklch(0.88 0.03 259)" barSize={20} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
