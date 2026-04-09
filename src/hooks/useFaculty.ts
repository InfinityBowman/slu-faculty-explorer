import { useEffect, useMemo, useState } from 'react'
import Fuse from 'fuse.js'
import type { Faculty } from '@/lib/types'
import { loadFaculty } from '@/lib/loadFaculty'
import { createFuseIndex, filterFaculty, FUSE_OPTIONS } from '@/lib/search'
import { useAppStore } from '@/store/appStore'

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
    return createFuseIndex(all)
  }, [all])
}

export function useFilteredFaculty(all: Array<Faculty> | null) {
  const search = useAppStore((s) => s.search)
  const school = useAppStore((s) => s.school)
  const department = useAppStore((s) => s.department)
  const tier = useAppStore((s) => s.tier)
  const fuse = useFuseIndex(all)

  return useMemo(() => {
    if (!all || !fuse) return []
    return filterFaculty(all, fuse, { search, school, department, tier })
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
