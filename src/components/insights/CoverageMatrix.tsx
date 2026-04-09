import { useMemo } from 'react'
import {
  Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ChartTooltip, useChartTooltip } from './ChartTooltip'
import type { Faculty } from '@/lib/types'
import { abbreviate, coverageMatrix } from '@/lib/insights'

interface CoverageChartRow {
  school: string
  Scholar: number
  OpenAlex: number
  Neither: number
  total: number
  pct: number
}

export function CoverageMatrix({ faculty }: { faculty: Array<Faculty> }) {
  const data = useMemo(
    () =>
      coverageMatrix(faculty).map((r): CoverageChartRow => ({
        school: abbreviate(r.school),
        Scholar: r.scholar,
        OpenAlex: r.openalex,
        Neither: r.neither,
        total: r.total,
        pct: r.coveragePct,
      })),
    [faculty],
  )

  const { data: hovered, rendered, setData, tooltipRef, trackPosition } = useChartTooltip<CoverageChartRow>()

  return (
    <div onMouseMove={trackPosition}>
      <ResponsiveContainer width="100%" height={data.length * 44 + 60}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 130, right: 50, top: 5, bottom: 10 }}
          onMouseMove={(state) => {
            if (state.isTooltipActive && state.activeTooltipIndex != null)
              setData(data[Number(state.activeTooltipIndex)])
            else setData(null)
          }}
          onMouseLeave={() => setData(null)}
        >
          <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="school"
            width={120}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={() => null} cursor={{ fill: 'var(--color-muted)', fillOpacity: 0.3 }} />
          <Legend
            verticalAlign="bottom"
            iconSize={10}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          <Bar dataKey="Scholar" stackId="src" fill="oklch(0.35 0.15 259)" barSize={20} />
          <Bar dataKey="OpenAlex" stackId="src" fill="oklch(0.55 0.19 259)" barSize={20} />
          <Bar dataKey="Neither" stackId="src" fill="oklch(0.75 0.06 259)" barSize={20} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <ChartTooltip visible={hovered != null} tooltipRef={tooltipRef}>
        {rendered && (
          <div>
            <div className="font-medium">{rendered.school}</div>
            <div className="mt-1 space-y-0.5 tabular">
              <div>Scholar: {rendered.Scholar} &middot; OpenAlex: {rendered.OpenAlex} &middot; Neither: {rendered.Neither}</div>
              <div className="font-medium">Coverage: {rendered.pct}% of {rendered.total}</div>
            </div>
          </div>
        )}
      </ChartTooltip>
    </div>
  )
}
