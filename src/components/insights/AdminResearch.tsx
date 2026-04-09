import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartTooltip, useChartTooltip } from './ChartTooltip'
import type { Faculty } from '@/lib/types'
import type { AdminRoleRow } from '@/lib/insights'
import { adminRoleMetrics } from '@/lib/insights'

export function AdminResearch({ faculty }: { faculty: Array<Faculty> }) {
  const roles = useMemo(() => adminRoleMetrics(faculty), [faculty])
  const {
    data: hovered,
    rendered,
    setData,
    tooltipRef,
  } = useChartTooltip<AdminRoleRow>()

  return (
    <div onMouseLeave={() => setData(null)}>
      <ResponsiveContainer width="100%" height={roles.length * 46 + 40}>
        <BarChart
          data={roles}
          layout="vertical"
          margin={{ left: 90, right: 30, top: 5, bottom: 5 }}
          onMouseMove={(state) => {
            if (state.isTooltipActive && state.activeTooltipIndex != null)
              setData(roles[Number(state.activeTooltipIndex)])
            else setData(null)
          }}
          onMouseLeave={() => setData(null)}
        >
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
            content={() => null}
            cursor={{ fill: 'var(--color-muted)', fillOpacity: 0.3 }}
          />
          <Bar
            dataKey="medianPercentile"
            fill="oklch(0.41 0.17 259)"
            radius={[0, 4, 4, 0]}
            barSize={22}
            label={{
              position: 'right',
              fontSize: 10,
              fill: 'var(--color-muted-foreground)',
              formatter: (v: unknown) =>
                typeof v === 'number' ? Math.round(v) : '',
            }}
          />
        </BarChart>
      </ResponsiveContainer>

      <ChartTooltip visible={hovered != null} tooltipRef={tooltipRef}>
        {rendered && (
          <div>
            <div className="font-medium">
              {rendered.role}{' '}
              <span className="text-muted-foreground">n={rendered.n}</span>
            </div>
            <div className="tabular mt-1">
              {rendered.medianPercentile != null
                ? `Field percentile: ${Math.round(rendered.medianPercentile)}`
                : 'No data'}
              {rendered.medianFwci != null
                ? ` \u00b7 FWCI: ${rendered.medianFwci.toFixed(2)}`
                : ''}
            </div>
          </div>
        )}
      </ChartTooltip>
    </div>
  )
}
