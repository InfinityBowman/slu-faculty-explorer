import { useEffect, useMemo, useState } from 'react'
import type { Faculty } from '@/lib/types'
import type { MetricSource } from '@/store/appStore'
import { loadFaculty } from '@/lib/loadFaculty'
import { useAppStore } from '@/store/appStore'

export interface PercentileInfo {
  rank: number // 1 = highest
  total: number
  percentile: number // 0–100, 100 = top
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

  return useMemo(() => {
    if (!all) return []
    const q = search.trim().toLowerCase()
    return all.filter((f) => {
      if (school !== 'all' && f.school !== school) return false
      if (department !== 'all' && f.department !== department) return false
      if (q.length > 0) {
        const hay = `${f.name} ${f.department} ${f.openalexTopTopic ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [all, search, school, department])
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

const hIndexFor = (f: Faculty, source: MetricSource): number | null =>
  source === 'scholar' ? f.hIndex : f.openalexHIndex

/**
 * Compute each faculty member's rank and percentile within their department,
 * based on the current metric source's h-index. Faculty with a null h-index
 * are excluded from the ranking entirely (not given a percentile). Computed
 * against the full dataset, not filtered, so the number is stable as users
 * filter the view.
 */
export function useFacultyPercentiles(
  all: Array<Faculty> | null,
): Map<number, PercentileInfo> {
  const metricSource = useAppStore((s) => s.metricSource)

  return useMemo(() => {
    const out = new Map<number, PercentileInfo>()
    if (!all) return out

    // Group by department
    const byDept = new Map<string, Array<Faculty>>()
    for (const f of all) {
      if (!f.department) continue
      if (hIndexFor(f, metricSource) == null) continue
      const bucket = byDept.get(f.department)
      if (bucket) bucket.push(f)
      else byDept.set(f.department, [f])
    }

    for (const bucket of byDept.values()) {
      bucket.sort((a, b) => {
        const ha = hIndexFor(a, metricSource) ?? 0
        const hb = hIndexFor(b, metricSource) ?? 0
        return hb - ha
      })
      const total = bucket.length
      for (let i = 0; i < total; i++) {
        const rank = i + 1
        // Percentile: top of dept = 100, bottom = 100/total
        // Using (total - rank + 1) / total * 100 for "at or above" semantics
        const percentile = ((total - rank + 1) / total) * 100
        out.set(bucket[i].id, { rank, total, percentile })
      }
    }

    return out
  }, [all, metricSource])
}
