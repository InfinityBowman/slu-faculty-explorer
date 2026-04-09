import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartTooltip, useChartTooltip } from './ChartTooltip'
import type { Faculty, HTier } from '@/lib/types'
import type { TierDatum } from '@/lib/insights'
import { H_TIER_ORDER } from '@/lib/types'
import { TIER_FILL, TIER_LABEL, abbreviate, tierData } from '@/lib/insights'

const R = 4
const BAR_SIZE = 18
const ROW_H = 40
const Y_WIDTH = 190

function edgeRadius(
  row: TierDatum,
  tier: HTier,
): number | [number, number, number, number] {
  const tIdx = H_TIER_ORDER.indexOf(tier)
  const firstIdx = H_TIER_ORDER.findIndex((t) => row[t] > 0)
  const lastIdx =
    H_TIER_ORDER.length -
    1 -
    [...H_TIER_ORDER].reverse().findIndex((t) => row[t] > 0)
  const isFirst = tIdx === firstIdx
  const isLast = tIdx === lastIdx
  if (isFirst && isLast) return [R, R, R, R]
  if (isFirst) return [R, 0, 0, R]
  if (isLast) return [0, R, R, 0]
  return 0
}

export function TierOverview({ faculty }: { faculty: Array<Faculty> }) {
  const { uniRow, schoolRows } = useMemo(() => {
    const uni = tierData(faculty, 'All SLU')
    const buckets = new Map<string, Array<Faculty>>()
    for (const f of faculty) {
      if (f.school) {
        const a = buckets.get(f.school) ?? []
        a.push(f)
        buckets.set(f.school, a)
      }
    }
    const schools = Array.from(buckets.entries())
      .map(([school, members]) => tierData(members, abbreviate(school)))
      .sort((a, b) => {
        const topA = a['top_1%'] + a['top_5%'] + a['top_10%'] + a['top_25%']
        const topB = b['top_1%'] + b['top_5%'] + b['top_10%'] + b['top_25%']
        return topB - topA
      })
    return { uniRow: uni, schoolRows: schools }
  }, [faculty])

  const { data, rendered, setData, tooltipRef } = useChartTooltip<TierDatum>()

  const xAxisProps = {
    type: 'number' as const,
    domain: [0, 100] as [number, number],
    allowDataOverflow: true,
    tickFormatter: (v: number) => `${v}%`,
    tick: { fontSize: 11 },
    axisLine: false,
    tickLine: false,
  }

  return (
    <div onMouseLeave={() => setData(null)}>
      {/* All SLU — single row, bold label */}
      <ResponsiveContainer width="100%" height={ROW_H + 10}>
        <BarChart
          data={[uniRow]}
          layout="vertical"
          margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
          onMouseMove={(state) => {
            if (state.isTooltipActive) setData(uniRow)
            else setData(null)
          }}
          onMouseLeave={() => setData(null)}
        >
          <XAxis {...xAxisProps} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={Y_WIDTH}
            tick={{ fontSize: 11, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={() => null}
            cursor={{ fill: 'var(--color-muted)', fillOpacity: 0.5 }}
          />
          {H_TIER_ORDER.map((tier) => (
            <Bar
              key={tier}
              dataKey={tier}
              stackId="tier"
              fill={TIER_FILL[tier]}
              radius={0}
              barSize={BAR_SIZE}
            >
              <Cell radius={edgeRadius(uniRow, tier) as unknown as number} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Schools */}
      <div className="mt-1">
        <ResponsiveContainer
          width="100%"
          height={schoolRows.length * ROW_H + 40}
        >
          <BarChart
            data={schoolRows}
            layout="vertical"
            margin={{ left: 10, right: 20, top: 0, bottom: 10 }}
            onMouseMove={(state) => {
              if (state.isTooltipActive && state.activeTooltipIndex != null)
                setData(schoolRows[Number(state.activeTooltipIndex)])
              else setData(null)
            }}
            onMouseLeave={() => setData(null)}
          >
            <XAxis {...xAxisProps} />
            <YAxis
              type="category"
              dataKey="label"
              width={Y_WIDTH}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={() => null}
              cursor={{ fill: 'var(--color-muted)', fillOpacity: 0.5 }}
            />
            {H_TIER_ORDER.map((tier) => (
              <Bar
                key={tier}
                dataKey={tier}
                stackId="tier"
                fill={TIER_FILL[tier]}
                radius={0}
                barSize={BAR_SIZE}
              >
                {schoolRows.map((row, idx) => (
                  <Cell
                    key={idx}
                    radius={edgeRadius(row, tier) as unknown as number}
                  />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2">
        {H_TIER_ORDER.map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: TIER_FILL[t] }}
            />
            <span className="text-[10px] text-muted-foreground">
              {TIER_LABEL[t]}
            </span>
          </div>
        ))}
      </div>

      <ChartTooltip visible={data != null} tooltipRef={tooltipRef}>
        {rendered && (
          <>
            <div className="font-medium">
              {rendered.label}{' '}
              <span className="text-muted-foreground">n={rendered.n}</span>
            </div>
            <div className="mt-1.5 space-y-0.5">
              {H_TIER_ORDER.filter((t) => rendered[t] > 0).map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-sm"
                    style={{ background: TIER_FILL[t] }}
                  />
                  <span>{TIER_LABEL[t]}</span>
                  <span className="tabular ml-auto font-medium">
                    {rendered[t]}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </ChartTooltip>
    </div>
  )
}
