import { useMemo } from 'react'
import {
  Bar, ComposedChart, ErrorBar, ReferenceLine, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from 'recharts'
import type { Faculty } from '@/lib/types'
import { mIndexByDecade } from '@/lib/insights'

export function MIndexOverview({ faculty }: { faculty: Array<Faculty> }) {
  const decades = useMemo(() => mIndexByDecade(faculty), [faculty])

  // Reshape for recharts: bar shows median, ErrorBar shows IQR
  const data = useMemo(
    () =>
      decades.map((d) => ({
        decade: d.decade,
        median: Math.round(d.med * 100) / 100,
        // ErrorBar needs [lowerDelta, upperDelta] from the bar value
        iqr: [
          Math.round((d.med - d.q1) * 100) / 100,
          Math.round((d.q3 - d.med) * 100) / 100,
        ],
        q1: d.q1,
        q3: d.q3,
        n: d.n,
      })),
    [decades],
  )

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Not enough data for m-index breakdown.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 text-[11px] text-muted-foreground">
        m = h-index / years publishing. Hirsch benchmarks: m&asymp;1 successful, m&asymp;2
        outstanding, m&ge;3 exceptional
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ left: 0, right: 10, top: 15, bottom: 5 }}>
          <XAxis dataKey="decade" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} domain={[0, 'auto']} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload.length) return null
              const d = payload[0].payload as { decade: string; median: number; q1: number; q3: number; n: number }
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                  <div className="font-medium">{d.decade} <span className="text-muted-foreground">n={d.n}</span></div>
                  <div className="mt-1 tabular">
                    Median: {d.median.toFixed(2)} &middot; IQR: {d.q1.toFixed(2)}–{d.q3.toFixed(2)}
                  </div>
                </div>
              )
            }}
            cursor={{ fill: 'var(--color-muted)', fillOpacity: 0.3 }}
          />
          <ReferenceLine y={1} stroke="var(--color-muted-foreground)" strokeDasharray="4 3" strokeOpacity={0.5} label={{ value: 'm=1', position: 'right', fontSize: 9, fill: 'var(--color-muted-foreground)' }} />
          <ReferenceLine y={2} stroke="var(--color-muted-foreground)" strokeDasharray="4 3" strokeOpacity={0.5} label={{ value: 'm=2', position: 'right', fontSize: 9, fill: 'var(--color-muted-foreground)' }} />
          <Bar dataKey="median" fill="oklch(0.41 0.17 259)" radius={[3, 3, 0, 0]} barSize={32}>
            <ErrorBar dataKey="iqr" stroke="oklch(0.28 0.12 259)" strokeWidth={1.5} />
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
