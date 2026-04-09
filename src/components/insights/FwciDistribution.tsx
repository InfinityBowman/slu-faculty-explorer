import { useMemo } from 'react'
import {
  Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ChartTooltip, useChartTooltip } from './ChartTooltip'
import type { Faculty } from '@/lib/types'
import type { HistogramBin } from '@/lib/insights'
import { fwciHistogram } from '@/lib/insights'

export function FwciDistribution({ faculty }: { faculty: Array<Faculty> }) {
  const { bins, abovePct, medianFwci } = useMemo(
    () => fwciHistogram(faculty),
    [faculty],
  )

  const { data: hovered, rendered, setData, tooltipRef } = useChartTooltip<HistogramBin>()

  return (
    <div onMouseLeave={() => setData(null)}>
      <div className="mb-4 flex items-baseline gap-6">
        <Stat value={`${abovePct}%`} label="above field average" />
        {medianFwci != null ? (
          <Stat value={medianFwci.toFixed(2)} label="median FWCI" />
        ) : null}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={bins}
          margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
          onMouseMove={(state) => {
            if (state.isTooltipActive && state.activeTooltipIndex != null)
              setData(bins[Number(state.activeTooltipIndex)])
            else setData(null)
          }}
          onMouseLeave={() => setData(null)}
        >
          <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
          <Tooltip content={() => null} cursor={{ fill: 'var(--color-muted)', fillOpacity: 0.4 }} />
          <ReferenceLine x="1.0–1.5" stroke="var(--color-foreground)" strokeDasharray="4 3" strokeOpacity={0.5} label={{ value: '1.0 = field avg', position: 'top', fontSize: 9, fill: 'var(--color-muted-foreground)' }} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {bins.map((bin, i) => (
              <Cell key={i} fill={bin.aboveAvg ? 'oklch(0.41 0.17 259)' : 'oklch(0.82 0.05 259)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <ChartTooltip visible={hovered != null} tooltipRef={tooltipRef}>
        {rendered && (
          <div>
            FWCI {rendered.label}: <span className="font-medium">{rendered.count}</span> faculty
          </div>
        )}
      </ChartTooltip>
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
