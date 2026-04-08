export interface Faculty {
  id: number
  name: string
  school: string
  department: string
  sluUrl: string | null
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
}
