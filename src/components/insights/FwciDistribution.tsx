import { useMemo } from 'react'
import {
  Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Faculty } from '@/lib/types'
import { fwciHistogram } from '@/lib/insights'

export function FwciDistribution({ faculty }: { faculty: Array<Faculty> }) {
  const { bins, abovePct, medianFwci } = useMemo(
    () => fwciHistogram(faculty),
    [faculty],
  )

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-6">
        <Stat value={`${abovePct}%`} label="above field average" />
        {medianFwci != null ? (
          <Stat value={medianFwci.toFixed(2)} label="median FWCI" />
        ) : null}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={bins} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload.length) return null
              const d = payload[0].payload as { label: string; count: number }
              return (
                <div className="rounded-md border bg-popover px-3 py-1.5 text-xs shadow-md">
                  FWCI {d.label}: <span className="font-medium">{d.count}</span> faculty
                </div>
              )
            }}
            cursor={{ fill: 'var(--color-muted)', fillOpacity: 0.4 }}
          />
          <ReferenceLine x="1.0–1.5" stroke="var(--color-foreground)" strokeDasharray="4 3" strokeOpacity={0.5} label={{ value: '1.0 = field avg', position: 'top', fontSize: 9, fill: 'var(--color-muted-foreground)' }} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {bins.map((bin, i) => (
              <Cell key={i} fill={bin.aboveAvg ? 'oklch(0.41 0.17 259)' : 'oklch(0.82 0.05 259)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
