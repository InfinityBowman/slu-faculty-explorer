import { useEffect, useMemo, useState } from 'react'
import type { Faculty, HTier } from '@/lib/types'
import { loadFaculty } from '@/lib/loadFaculty'
import { useAppStore } from '@/store/appStore'

// Higher = better. Used by the tier filter to interpret "top_25%" as
// "top_25% or better" (a minimum-tier threshold, not equality).
const TIER_RANK: Record<HTier, number> = {
  'top_1%': 6,
  'top_5%': 5,
  'top_10%': 4,
  'top_25%': 3,
  above_median: 2,
  below_median: 1,
}

export function useFacultyData() {
  const [data, setData] = useState<Array<Faculty> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadFaculty()
      .then((rows) => {
        if (!cancelled) setData(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, error, isLoading: data == null && error == null }
}

export function useFilteredFaculty(all: Array<Faculty> | null) {
  const search = useAppStore((s) => s.search)
  const school = useAppStore((s) => s.school)
  const department = useAppStore((s) => s.department)
  const tier = useAppStore((s) => s.tier)

  return useMemo(() => {
    if (!all) return []
    const q = search.trim().toLowerCase()
    const minTierRank = tier === 'all' ? null : TIER_RANK[tier]
    return all.filter((f) => {
      if (school !== 'all' && f.school !== school) return false
      if (department !== 'all' && f.department !== department) return false
      if (minTierRank != null) {
        // Faculty without a tier (no OpenAlex h-index → no field benchmark)
        // are excluded when filtering on tier — there's nothing to compare.
        if (!f.primaryHTier) return false
        if (TIER_RANK[f.primaryHTier] < minTierRank) return false
      }
      if (q.length > 0) {
        const hay = `${f.name} ${f.department} ${f.openalexTopTopic ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [all, search, school, department, tier])
}

export function useSchoolOptions(all: Array<Faculty> | null): Array<string> {
  return useMemo(() => {
    if (!all) return []
    return Array.from(
      new Set(all.map((f) => f.school).filter((s) => s.length > 0)),
    ).sort()
  }, [all])
}

export function useDepartmentOptions(
  all: Array<Faculty> | null,
  school: string,
): Array<string> {
  return useMemo(() => {
    if (!all) return []
    const scoped = school === 'all' ? all : all.filter((f) => f.school === school)
    return Array.from(
      new Set(scoped.map((f) => f.department).filter((d) => d.length > 0)),
    ).sort()
  }, [all, school])
}

