import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
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

// Fuse configuration for faculty search. Weights bias matches toward the
// fields users actually type names of; research interests get a moderate
// weight so topic searches still land.
const FUSE_OPTIONS: IFuseOptions<Faculty> = {
  keys: [
    { name: 'name', weight: 3 },
    { name: 'department', weight: 1.5 },
    { name: 'openalexField', weight: 1 },
    { name: 'openalexSubfield', weight: 1 },
    { name: 'openalexTopTopic', weight: 1 },
    { name: 'researchInterests', weight: 0.7 },
    { name: 'bioTitle', weight: 0.5 },
  ],
  // 0 = exact match only, 1 = anything matches. 0.35 is loose enough to
  // tolerate typos and partial words without drowning in noise.
  threshold: 0.35,
  // Don't penalize matches that aren't at the start of the string — matters
  // for names where the last name is often what users type first.
  ignoreLocation: true,
  // Skip single-character "matches" that bloat results with noise.
  minMatchCharLength: 2,
  // Multi-word queries: treat whitespace as AND so "bidisha finance" means
  // "match bidisha AND match finance" across the indexed fields.
  useExtendedSearch: true,
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
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, error, isLoading: data == null && error == null }
}

// Fuse index, rebuilt only when the dataset itself changes.
function useFuseIndex(all: Array<Faculty> | null): Fuse<Faculty> | null {
  return useMemo(() => {
    if (!all) return null
    return new Fuse(all, FUSE_OPTIONS)
  }, [all])
}

export function useFilteredFaculty(all: Array<Faculty> | null) {
  const search = useAppStore((s) => s.search)
  const school = useAppStore((s) => s.school)
  const department = useAppStore((s) => s.department)
  const tier = useAppStore((s) => s.tier)
  const fuse = useFuseIndex(all)

  return useMemo(() => {
    if (!all) return []
    const q = search.trim()
    const minTierRank = tier === 'all' ? null : TIER_RANK[tier]

    const passesCategoricalFilters = (f: Faculty): boolean => {
      if (school !== 'all' && f.school !== school) return false
      if (department !== 'all' && f.department !== department) return false
      if (minTierRank != null) {
        // Faculty without a tier (no OpenAlex h-index → no field benchmark)
        // are excluded when filtering on tier — there's nothing to compare.
        if (!f.primaryHTier) return false
        if (TIER_RANK[f.primaryHTier] < minTierRank) return false
      }
      return true
    }

    // With a search query: rank by Fuse relevance first, then apply the
    // other filters in-place so the order is preserved.
    if (q.length > 0 && fuse) {
      return fuse
        .search(q)
        .map((result) => result.item)
        .filter(passesCategoricalFilters)
    }

    // No search query: just apply the categorical filters in original order.
    return all.filter(passesCategoricalFilters)
  }, [all, fuse, search, school, department, tier])
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
    const scoped =
      school === 'all' ? all : all.filter((f) => f.school === school)
    return Array.from(
      new Set(scoped.map((f) => f.department).filter((d) => d.length > 0)),
    ).sort()
  }, [all, school])
}
