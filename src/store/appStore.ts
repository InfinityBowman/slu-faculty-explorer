import { create } from 'zustand'

export type MetricSource = 'scholar' | 'openalex'

interface AppState {
  search: string
  school: string // 'all' | school name
  department: string // 'all' | department name
  metricSource: MetricSource
  setSearch: (s: string) => void
  setSchool: (s: string) => void
  setDepartment: (d: string) => void
  setMetricSource: (m: MetricSource) => void
  reset: () => void
}

const initial = {
  search: '',
  school: 'all',
  department: 'all',
  metricSource: 'scholar' as MetricSource,
}

export const useAppStore = create<AppState>()((set) => ({
  ...initial,
  setSearch: (search) => set({ search }),
  setSchool: (school) => set({ school, department: 'all' }),
  setDepartment: (department) => set({ department }),
  setMetricSource: (metricSource) => set({ metricSource }),
  reset: () => set(initial),
}))
