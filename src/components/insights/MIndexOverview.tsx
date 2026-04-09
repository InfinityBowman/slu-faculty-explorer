import { useMemo } from 'react'
import {
  Bar,
  ComposedChart,
  ErrorBar,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartTooltip, useChartTooltip } from './ChartTooltip'
import type { Faculty } from '@/lib/types'
import { mIndexByDecade } from '@/lib/insights'

interface MIndexChartRow {
  decade: string
  median: number
  iqr: [number, number]
  q1: number
  q3: number
  n: number
}

export function MIndexOverview({ faculty }: { faculty: Array<Faculty> }) {
  const decades = useMemo(() => mIndexByDecade(faculty), [faculty])

  const data = useMemo(
    () =>
      decades.map(
        (d): MIndexChartRow => ({
          decade: d.decade,
          median: Math.round(d.med * 100) / 100,
          iqr: [
            Math.round((d.med - d.q1) * 100) / 100,
            Math.round((d.q3 - d.med) * 100) / 100,
          ],
          q1: d.q1,
          q3: d.q3,
          n: d.n,
        }),
      ),
    [decades],
  )

  const {
    data: hovered,
    rendered,
    setData,
    tooltipRef,
  } = useChartTooltip<MIndexChartRow>()

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Not enough data for m-index breakdown.
      </div>
    )
  }

  return (
    <div onMouseLeave={() => setData(null)}>
      <div className="mb-3 text-[11px] text-muted-foreground">
        m = h-index / years publishing. Hirsch benchmarks: m&asymp;1 successful,
        m&asymp;2 outstanding, m&ge;3 exceptional
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart
          data={data}
          margin={{ left: 0, right: 10, top: 15, bottom: 5 }}
          onMouseMove={(state) => {
            if (state.isTooltipActive && state.activeTooltipIndex != null)
              setData(data[Number(state.activeTooltipIndex)])
            else setData(null)
          }}
          onMouseLeave={() => setData(null)}
        >
          <XAxis
            dataKey="decade"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={30}
            domain={[0, 'auto']}
          />
          <Tooltip
            content={() => null}
            cursor={{ fill: 'var(--color-muted)', fillOpacity: 0.3 }}
          />
          <ReferenceLine
            y={1}
            stroke="var(--color-muted-foreground)"
            strokeDasharray="4 3"
            strokeOpacity={0.5}
            label={{
              value: 'm=1',
              position: 'right',
              fontSize: 9,
              fill: 'var(--color-muted-foreground)',
            }}
          />
          <ReferenceLine
            y={2}
            stroke="var(--color-muted-foreground)"
            strokeDasharray="4 3"
            strokeOpacity={0.5}
            label={{
              value: 'm=2',
              position: 'right',
              fontSize: 9,
              fill: 'var(--color-muted-foreground)',
            }}
          />
          <Bar
            dataKey="median"
            fill="oklch(0.41 0.17 259)"
            radius={[3, 3, 0, 0]}
            barSize={32}
          >
            <ErrorBar
              dataKey="iqr"
              stroke="oklch(0.28 0.12 259)"
              strokeWidth={1.5}
            />
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      <ChartTooltip visible={hovered != null} tooltipRef={tooltipRef}>
        {rendered && (
          <div>
            <div className="font-medium">
              {rendered.decade}{' '}
              <span className="text-muted-foreground">n={rendered.n}</span>
            </div>
            <div className="tabular mt-1">
              Median: {rendered.median.toFixed(2)} &middot; IQR:{' '}
              {rendered.q1.toFixed(2)}&ndash;{rendered.q3.toFixed(2)}
            </div>
          </div>
        )}
      </ChartTooltip>
    </div>
  )
}
