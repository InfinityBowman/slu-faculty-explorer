import type { Faculty } from '@/lib/types'

const CURRENT_YEAR = new Date().getFullYear()

function median(values: Array<number>): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function mIndex(f: Faculty): number | null {
  const h = f.hIndex ?? f.openalexHIndex
  if (h == null || f.openalexFirstYear == null) return null
  const years = CURRENT_YEAR - f.openalexFirstYear
  return years > 0 ? Math.round((h / years) * 100) / 100 : null
}

function fuzzyMatch(input: string, candidates: Array<string>): string | null {
  const lower = input.toLowerCase()
  const exact = candidates.find((c) => c.toLowerCase() === lower)
  if (exact) return exact
  const substring = candidates.find((c) => c.toLowerCase().includes(lower))
  if (substring) return substring
  const reverse = candidates.find((c) => lower.includes(c.toLowerCase()))
  if (reverse) return reverse
  return null
}

function facultySummary(f: Faculty) {
  return {
    name: f.name,
    department: f.department,
    school: f.school,
    hIndex: f.hIndex ?? f.openalexHIndex,
    mIndex: mIndex(f),
    citations: f.citations ?? f.openalexCitations,
    works: f.openalexWorksCount,
    fwci: f.openalex2yrFwci,
    tier: f.primaryHTier,
    field: f.openalexField,
  }
}

function facultyDetail(f: Faculty) {
  return {
    ...facultySummary(f),
    scholarHIndex: f.hIndex,
    openalexHIndex: f.openalexHIndex,
    hIndex5y: f.hIndex5y,
    i10Index: f.i10Index ?? f.openalexI10Index,
    scholarCitations: f.citations,
    openalexCitations: f.openalexCitations,
    citations5y: f.citations5y,
    fieldPercentile: f.fieldHPercentile,
    subfieldPercentile: f.subfieldHPercentile,
    deptHPercentile: f.deptHPercentile,
    topTopic: f.openalexTopTopic,
    subfield: f.openalexSubfield,
    researchInterests: f.researchInterests,
    phdInstitution: f.phdInstitution,
    phdYear: f.phdYear,
    adminRole: f.adminRole,
    firstYear: f.openalexFirstYear,
    lastYear: f.openalexLastYear,
    hasScholar: f.scholarId != null,
    hasOpenalex: f.openalexId != null,
  }
}

export function buildDatasetSummary(faculty: Array<Faculty>) {
  const withScholar = faculty.filter((f) => f.hIndex != null)
  const withOpenalex = faculty.filter((f) => f.openalexHIndex != null)
  const allH = faculty
    .map((f) => f.hIndex ?? f.openalexHIndex)
    .filter((v): v is number => v != null)

  const bySchool: Record<string, { total: number; withData: number }> = {}
  for (const f of faculty) {
    if (!f.school) continue
    const entry = bySchool[f.school] ?? { total: 0, withData: 0 }
    entry.total++
    if (f.hIndex != null || f.openalexHIndex != null) entry.withData++
    bySchool[f.school] = entry
  }

  const tierCounts: Record<string, number> = {}
  for (const f of faculty) {
    if (f.primaryHTier) {
      tierCounts[f.primaryHTier] = tierCounts[f.primaryHTier] + 1
    }
  }

  return {
    totalFaculty: faculty.length,
    scholarCoverage: withScholar.length,
    openalexCoverage: withOpenalex.length,
    eitherCoverage: faculty.filter(
      (f) => f.hIndex != null || f.openalexHIndex != null,
    ).length,
    medianHIndex: median(allH),
    tierDistribution: tierCounts,
    bySchool: Object.entries(bySchool)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([school, d]) => ({
        school,
        total: d.total,
        withData: d.withData,
        coverage: Math.round((d.withData / d.total) * 100),
      })),
  }
}

export function buildFacultyDetail(name: string, faculty: Array<Faculty>) {
  if (!name) return { error: 'No name provided' }

  const names = faculty.map((f) => f.name)
  const matched = fuzzyMatch(name, names)
  if (!matched) return { error: `No faculty found matching "${name}"` }

  const match = faculty.find((fac) => fac.name === matched)
  if (!match) return { error: `No faculty found matching "${name}"` }

  return facultyDetail(match)
}

export function buildSchoolSummary(school: string, faculty: Array<Faculty>) {
  if (!school) return { error: 'No school provided' }

  const schools = [...new Set(faculty.map((f) => f.school))]
  const matched = fuzzyMatch(school, schools)
  if (!matched) return { error: `No school found matching "${school}"` }

  const schoolFaculty = faculty.filter((f) => f.school === matched)
  const allH = schoolFaculty
    .map((f) => f.hIndex ?? f.openalexHIndex)
    .filter((v): v is number => v != null)
  const withData = schoolFaculty.filter(
    (f) => f.hIndex != null || f.openalexHIndex != null,
  )

  const departments: Record<string, number> = {}
  for (const f of schoolFaculty) {
    if (f.department) {
      departments[f.department] = (departments[f.department] ?? 0) + 1
    }
  }

  const topFaculty = [...schoolFaculty]
    .sort((a, b) => {
      const ha = a.hIndex ?? a.openalexHIndex ?? 0
      const hb = b.hIndex ?? b.openalexHIndex ?? 0
      return hb - ha
    })
    .slice(0, 5)
    .map(facultySummary)

  return {
    school: matched,
    totalFaculty: schoolFaculty.length,
    withData: withData.length,
    coverage: Math.round((withData.length / schoolFaculty.length) * 100),
    medianHIndex: median(allH),
    topFaculty,
    departments: Object.entries(departments)
      .sort((a, b) => b[1] - a[1])
      .map(([dept, count]) => ({ department: dept, count })),
  }
}

export function buildDepartmentSummary(department: string, faculty: Array<Faculty>) {
  if (!department) return { error: 'No department provided' }

  const depts = [...new Set(faculty.map((f) => f.department))]
  const matched = fuzzyMatch(department, depts)
  if (!matched) {
    return { error: `No department found matching "${department}"` }
  }

  const deptFaculty = faculty.filter((f) => f.department === matched)
  const allH = deptFaculty
    .map((f) => f.hIndex ?? f.openalexHIndex)
    .filter((v): v is number => v != null)
  const withData = deptFaculty.filter(
    (f) => f.hIndex != null || f.openalexHIndex != null,
  )

  const topFaculty = [...deptFaculty]
    .sort((a, b) => {
      const ha = a.hIndex ?? a.openalexHIndex ?? 0
      const hb = b.hIndex ?? b.openalexHIndex ?? 0
      return hb - ha
    })
    .slice(0, 5)
    .map(facultySummary)

  return {
    department: matched,
    school: deptFaculty[0]?.school ?? null,
    totalFaculty: deptFaculty.length,
    withData: withData.length,
    coverage: Math.round((withData.length / deptFaculty.length) * 100),
    medianHIndex: median(allH),
    topFaculty,
  }
}

export function buildRankings(
  metric: string,
  school: string | undefined,
  department: string | undefined,
  order: string,
  limit: number,
  faculty: Array<Faculty>,
) {
  let filtered = faculty

  if (school) {
    const schools = [...new Set(faculty.map((f) => f.school))]
    const matched = fuzzyMatch(school, schools)
    if (matched) filtered = filtered.filter((f) => f.school === matched)
  }
  if (department) {
    const depts = [...new Set(faculty.map((f) => f.department))]
    const matched = fuzzyMatch(department, depts)
    if (matched) filtered = filtered.filter((f) => f.department === matched)
  }

  type Entry = {
    name: string
    department: string
    school: string
    value: number
  }
  const entries: Array<Entry> = []

  for (const f of filtered) {
    let value: number | null = null
    switch (metric) {
      case 'hIndex':
        value = f.hIndex ?? f.openalexHIndex
        break
      case 'mIndex':
        value = mIndex(f)
        break
      case 'citations':
        value = f.citations ?? f.openalexCitations
        break
      case 'works':
        value = f.openalexWorksCount
        break
      case 'fwci':
        value = f.openalex2yrFwci
        break
      case 'fieldPercentile':
        value = f.fieldHPercentile
        break
    }
    if (value != null) {
      entries.push({
        name: f.name,
        department: f.department,
        school: f.school,
        value: Math.round(value * 100) / 100,
      })
    }
  }

  entries.sort((a, b) =>
    order === 'asc' ? a.value - b.value : b.value - a.value,
  )

  return {
    metric,
    order,
    totalMatching: entries.length,
    results: entries.slice(0, limit).map((e, i) => ({
      rank: i + 1,
      ...e,
    })),
  }
}

export function buildSearch(query: string, limit: number, faculty: Array<Faculty>) {
  if (!query) return { error: 'No query provided' }

  const lower = query.toLowerCase()
  const scored: Array<{ f: Faculty; score: number }> = []

  for (const f of faculty) {
    let score = 0
    if (f.name.toLowerCase().includes(lower)) score += 10
    if (f.department.toLowerCase().includes(lower)) score += 5
    if (f.researchInterests?.toLowerCase().includes(lower)) score += 3
    if (f.openalexField?.toLowerCase().includes(lower)) score += 4
    if (f.openalexSubfield?.toLowerCase().includes(lower)) score += 4
    if (f.openalexTopTopic?.toLowerCase().includes(lower)) score += 3
    if (score > 0) scored.push({ f, score })
  }

  scored.sort((a, b) => b.score - a.score)

  return {
    query,
    totalMatches: scored.length,
    results: scored.slice(0, limit).map((s) => facultySummary(s.f)),
  }
}
