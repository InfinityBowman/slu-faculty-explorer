import { create } from 'zustand'
import type { HTier } from '@/lib/types'
import type { ScatterConfig } from '@/components/scatter/types'

// 'all' = no filter; 'top_25%' means "top_25% AND better" (i.e. top_1, top_5,
// top_10, top_25). The filter is interpreted as a minimum tier, not equality —
// users want "top 25% or better" much more often than "exactly top 25%".
export type TierFilter = 'all' | HTier

interface AppState {
  search: string
  school: string // 'all' | school name
  department: string // 'all' | department name
  tier: TierFilter
  scatterConfig: ScatterConfig
  setSearch: (s: string) => void
  setSchool: (s: string) => void
  setDepartment: (d: string) => void
  setTier: (t: TierFilter) => void
  setScatterConfig: (partial: Partial<ScatterConfig>) => void
  reset: () => void
}

const DEFAULT_SCATTER: ScatterConfig = {
  xId: 'works',
  yId: 'citations',
  sizeId: 'hIndex',
  colorId: 'none',
}

const initial = {
  search: '',
  school: 'all',
  department: 'all',
  tier: 'all' as TierFilter,
  scatterConfig: DEFAULT_SCATTER,
}

export const useAppStore = create<AppState>()((set) => ({
  ...initial,
  setSearch: (search) => set({ search }),
  setSchool: (school) => set({ school, department: 'all' }),
  setDepartment: (department) => set({ department }),
  setTier: (tier) => set({ tier }),
  setScatterConfig: (partial) =>
    set((s) => ({ scatterConfig: { ...s.scatterConfig, ...partial } })),
  reset: () => set(initial),
}))
