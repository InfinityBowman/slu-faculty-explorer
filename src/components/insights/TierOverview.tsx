import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import type { Faculty, HTier } from '@/lib/types'
import { H_TIER_ORDER } from '@/lib/types'
import { TIER_FILL, TIER_LABEL, abbreviate, tierData } from '@/lib/insights'

export function TierOverview({ faculty }: { faculty: Array<Faculty> }) {
  const data = useMemo(() => {
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
    return [uni, ...schools]
  }, [faculty])

  return (
    <ResponsiveContainer width="100%" height={data.length * 44 + 60}>
      <BarChart data={data} layout="vertical" margin={{ left: 130, right: 20, top: 10, bottom: 10 }}>
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<TierTooltip />} cursor={{ fill: 'var(--color-muted)', fillOpacity: 0.5 }} />
        <Legend
          content={() => (
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2">
              {H_TIER_ORDER.map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ background: TIER_FILL[t] }} />
                  <span className="text-[10px] text-muted-foreground">{TIER_LABEL[t]}</span>
                </div>
              ))}
            </div>
          )}
        />
        {H_TIER_ORDER.map((tier) => (
          <Bar key={tier} dataKey={tier} stackId="tier" fill={TIER_FILL[tier]} radius={0} barSize={20}>
            {data.map((_, idx) => (
              <Cell key={idx} radius={
                tier === 'top_1%' ? [4, 0, 0, 4] as unknown as number :
                tier === 'below_median' ? [0, 4, 4, 0] as unknown as number : 0
              } />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
