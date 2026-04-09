import { useMemo } from 'react'
import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Faculty, HTier } from '@/lib/types'
import type { TierDatum } from '@/lib/insights'
import { H_TIER_ORDER } from '@/lib/types'
import { TIER_FILL, TIER_LABEL, abbreviate, tierData } from '@/lib/insights'

// Compute rounded corners for a cell based on whether this tier is the
// leftmost or rightmost visible segment in that row.
const R = 4
function edgeRadius(row: TierDatum, tier: HTier): number | [number, number, number, number] {
  const tIdx = H_TIER_ORDER.indexOf(tier)
  const firstIdx = H_TIER_ORDER.findIndex((t) => row[t] > 0)
  const lastIdx = H_TIER_ORDER.length - 1 - [...H_TIER_ORDER].reverse().findIndex((t) => row[t] > 0)
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

  return (
    <div className="space-y-5">
      {/* University-wide headline bar */}
      <div>
        <div className="mb-1.5 flex items-baseline gap-2 text-[11px]">
          <span className="font-semibold">All SLU</span>
          <span className="tabular text-muted-foreground">n={uniRow.n}</span>
        </div>
        <div className="flex h-8 overflow-hidden rounded">
          {H_TIER_ORDER.map((t) => {
            const pct = uniRow[t]
            if (pct <= 0) return null
            return (
              <div
                key={t}
                style={{ width: `${pct}%`, background: TIER_FILL[t] }}
                className="relative"
                title={`${TIER_LABEL[t]}: ${Math.round(pct)}%`}
              >
                {pct >= 7 ? (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white/90">
                    {Math.round(pct)}%
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-school chart */}
      <ResponsiveContainer width="100%" height={schoolRows.length * 40 + 50}>
        <BarChart data={schoolRows} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 10 }}>
          <XAxis
            type="number"
            domain={[0, 100]}
            allowDataOverflow
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={190}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<TierTooltip />} cursor={{ fill: 'var(--color-muted)', fillOpacity: 0.5 }} />
          {H_TIER_ORDER.map((tier) => (
            <Bar key={tier} dataKey={tier} stackId="tier" fill={TIER_FILL[tier]} radius={0} barSize={18}>
              {schoolRows.map((row, idx) => (
                <Cell key={idx} radius={edgeRadius(row, tier) as unknown as number} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {H_TIER_ORDER.map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ background: TIER_FILL[t] }} />
            <span className="text-[10px] text-muted-foreground">{TIER_LABEL[t]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

 
function TierTooltip({ active, payload }: { active?: boolean; payload?: Array<any> }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as { label: string; n: number } | undefined
  if (!row) return null
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium">{row.label} <span className="text-muted-foreground">n={row.n}</span></div>
      <div className="mt-1.5 space-y-0.5">
        {payload.filter((p) => p.value > 0).map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-sm" style={{ background: TIER_FILL[p.name as HTier] }} />
            <span>{TIER_LABEL[p.name as HTier]}</span>
            <span className="ml-auto tabular font-medium">{p.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
