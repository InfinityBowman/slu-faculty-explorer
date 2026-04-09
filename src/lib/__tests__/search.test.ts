import { describe, expect, it } from 'vitest'
import { createFuseIndex, filterFaculty } from '../search'
import type { Faculty } from '../types'

/** Minimal faculty record — only the fields the search indexes. */
function makeFaculty(overrides: Partial<Faculty> & { name: string }): Faculty {
  return {
    id: 0,
    school: '',
    department: '',
    sluUrl: null,
    scholarId: null,
    scholarUrl: null,
    matchedAffiliation: null,
    hIndex: null,
    hIndex5y: null,
    i10Index: null,
    i10Index5y: null,
    citations: null,
    citations5y: null,
    status: 'ok',
    openalexId: null,
    openalexWorksCount: null,
    openalexCitations: null,
    openalexHIndex: null,
    openalexI10Index: null,
    openalex2yrFwci: null,
    openalexTopTopic: null,
    openalexFirstYear: null,
    openalexLastYear: null,
    openalexStatus: null,
    bioTitle: null,
    bioDepartment: null,
    bioEmail: null,
    bioPhone: null,
    bioOffice: null,
    phdInstitution: null,
    phdYear: null,
    researchInterests: null,
    bioStatus: null,
    deptHPercentile: null,
    deptFwciPercentile: null,
    deptWorksPercentile: null,
    adminRole: null,
    openalexDomain: null,
    openalexField: null,
    openalexSubfield: null,
    fieldHPercentile: null,
    subfieldHPercentile: null,
    primaryHTier: null,
    bestH: null,
    mIndex: null,
    ...overrides,
  }
}

const NO_FILTERS = {
  search: '',
  school: 'all',
  department: 'all',
  tier: 'all' as const,
}

describe('filterFaculty', () => {
  const fritts = makeFaculty({
    id: 1,
    name: 'Jason Fritts',
    department: 'Computer Science',
    openalexField: 'Computer Science',
    researchInterests: 'Image Segmentation Vision and Image Processing',
    bioTitle: 'Associate Professor',
  })

  const zhang = makeFaculty({
    id: 2,
    name: 'Dapeng Zhang',
    department: 'Biology',
    researchInterests:
      'Molecular and cellular mechanisms underlying neuromuscular diseases and fatigue syndromes',
  })

  const ritter = makeFaculty({
    id: 3,
    name: 'Gary Ritter',
    department: 'Education',
  })

  const all = [fritts, zhang, ritter]

  it('exact last name returns that person first', () => {
    const fuse = createFuseIndex(all)
    const results = filterFaculty(all, fuse, {
      ...NO_FILTERS,
      search: 'fritts',
    })
    expect(results[0].name).toBe('Jason Fritts')
  })

  it('partial last name returns that person first', () => {
    const fuse = createFuseIndex(all)
    const results = filterFaculty(all, fuse, {
      ...NO_FILTERS,
      search: 'fritt',
    })
    expect(results[0].name).toBe('Jason Fritts')
  })

  it('multi-word search narrows results (AND semantics)', () => {
    const fuse = createFuseIndex(all)
    const results = filterFaculty(all, fuse, {
      ...NO_FILTERS,
      search: 'jason fritts',
    })
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].name).toBe('Jason Fritts')
  })

  it('department search returns correct faculty', () => {
    const fuse = createFuseIndex(all)
    const results = filterFaculty(all, fuse, {
      ...NO_FILTERS,
      search: 'biology',
    })
    expect(results.some((f) => f.name === 'Dapeng Zhang')).toBe(true)
  })

  it('no search returns all faculty', () => {
    const fuse = createFuseIndex(all)
    const results = filterFaculty(all, fuse, NO_FILTERS)
    expect(results.length).toBe(all.length)
  })

  it('school filter narrows results', () => {
    const data = [
      makeFaculty({
        id: 1,
        name: 'A',
        school: 'Engineering',
      }),
      makeFaculty({
        id: 2,
        name: 'B',
        school: 'Business',
      }),
    ]
    const fuse = createFuseIndex(data)
    const results = filterFaculty(data, fuse, {
      ...NO_FILTERS,
      school: 'Engineering',
    })
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('A')
  })

  it('tier filter excludes faculty below the threshold', () => {
    const data = [
      makeFaculty({ id: 1, name: 'A', primaryHTier: 'top_1%' }),
      makeFaculty({ id: 2, name: 'B', primaryHTier: 'top_25%' }),
      makeFaculty({ id: 3, name: 'C', primaryHTier: null }),
    ]
    const fuse = createFuseIndex(data)
    const results = filterFaculty(data, fuse, {
      ...NO_FILTERS,
      tier: 'top_10%',
    })
    expect(results.map((f) => f.name)).toEqual(['A'])
  })

  it('combined search + school filter works', () => {
    const data = [
      makeFaculty({
        id: 1,
        name: 'Jason Fritts',
        school: 'Engineering',
      }),
      makeFaculty({
        id: 2,
        name: 'Jason Doe',
        school: 'Business',
      }),
    ]
    const fuse = createFuseIndex(data)
    const results = filterFaculty(data, fuse, {
      ...NO_FILTERS,
      search: 'jason',
      school: 'Engineering',
    })
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Jason Fritts')
  })
})
