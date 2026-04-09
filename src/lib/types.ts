export type HTier =
  | 'top_1%'
  | 'top_5%'
  | 'top_10%'
  | 'top_25%'
  | 'above_median'
  | 'below_median'

export const H_TIER_ORDER: Array<HTier> = [
  'top_1%',
  'top_5%',
  'top_10%',
  'top_25%',
  'above_median',
  'below_median',
]

export interface Faculty {
  id: number
  name: string
  school: string
  department: string
  sluUrl: string | null

  // Google Scholar
  scholarId: string | null
  scholarUrl: string | null
  matchedAffiliation: string | null
  hIndex: number | null
  hIndex5y: number | null
  i10Index: number | null
  i10Index5y: number | null
  citations: number | null
  citations5y: number | null
  status: string

  // OpenAlex
  openalexId: string | null
  openalexWorksCount: number | null
  openalexCitations: number | null
  openalexHIndex: number | null
  openalexI10Index: number | null
  openalex2yrFwci: number | null
  openalexTopTopic: string | null
  openalexFirstYear: number | null
  openalexLastYear: number | null
  openalexStatus: string | null

  // SLU bio page
  bioTitle: string | null
  bioDepartment: string | null
  bioEmail: string | null
  bioPhone: string | null
  bioOffice: string | null
  phdInstitution: string | null
  phdYear: number | null
  researchInterests: string | null
  bioStatus: string | null

  // Within-SLU computed (compute.py)
  deptHPercentile: number | null
  deptFwciPercentile: number | null
  deptWorksPercentile: number | null

  // Classification (classify.py)
  adminRole: string | null

  // Global field benchmarks (field_benchmark.py)
  openalexDomain: string | null
  openalexField: string | null
  openalexSubfield: string | null
  fieldHPercentile: number | null
  subfieldHPercentile: number | null
  primaryHTier: HTier | null

  // Derived (computed client-side)
  bestH: number | null
  mIndex: number | null
}
