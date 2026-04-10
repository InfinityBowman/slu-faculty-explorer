import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import type { Faculty, HTier } from './types'
import type { TierFilter } from '@/store/appStore'

const TIER_RANK: Record<HTier, number> = {
  'top_1%': 6,
  'top_5%': 5,
  'top_10%': 4,
  'top_25%': 3,
  above_median: 2,
  below_median: 1,
}

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
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
  useExtendedSearch: true,
}

export function createFuseIndex(data: Array<Faculty>): Fuse<Faculty> {
  return new Fuse(data, FUSE_OPTIONS)
}

interface FilterParams {
  search: string
  school: string
  department: string
  tier: TierFilter
}

export function filterFaculty(
  all: Array<Faculty>,
  fuse: Fuse<Faculty>,
  params: FilterParams,
): Array<Faculty> {
  const { search, school, department, tier } = params
  const q = search.trim()
  const minTierRank = tier === 'all' ? null : TIER_RANK[tier]

  const passesCategoricalFilters = (f: Faculty): boolean => {
    if (school !== 'all' && f.school !== school) return false
    if (department !== 'all' && f.department !== department) return false
    if (minTierRank != null) {
      if (!f.primaryHTier) return false
      if (TIER_RANK[f.primaryHTier] < minTierRank) return false
    }
    return true
  }

  if (q.length > 0) {
    return fuse
      .search(q)
      .map((result) => result.item)
      .filter(passesCategoricalFilters)
  }

  return all.filter(passesCategoricalFilters)
}
