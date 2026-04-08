import Papa from 'papaparse'
import type { Faculty } from './types'

const toNum = (v: string | undefined): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const toStr = (v: string | undefined): string | null => {
  if (v == null || v === '') return null
  return v
}

interface RawRow {
  id: string
  name: string
  school: string
  department: string
  slu_url: string
  scholar_id: string
  scholar_url: string
  matched_affiliation: string
  h_index: string
  h_index_5y: string
  i10_index: string
  i10_index_5y: string
  citations: string
  citations_5y: string
  status: string
  openalex_id: string
  openalex_works_count: string
  openalex_citations: string
  openalex_h_index: string
  openalex_i10_index: string
  openalex_2yr_fwci: string
  openalex_top_topic: string
  openalex_first_year: string
  openalex_last_year: string
  openalex_status: string
}

export async function loadFaculty(): Promise<Array<Faculty>> {
  const res = await fetch('/faculty.csv')
  if (!res.ok) throw new Error(`Failed to load faculty.csv: ${res.status}`)
  const text = await res.text()

  const parsed = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    console.warn('CSV parse warnings:', parsed.errors.slice(0, 3))
  }

  return parsed.data
    .filter((row) => row.id && row.name)
    .map((row) => ({
      id: Number(row.id),
      name: row.name,
      school: row.school,
      department: row.department,
      sluUrl: toStr(row.slu_url),
      scholarId: toStr(row.scholar_id),
      scholarUrl: toStr(row.scholar_url),
      matchedAffiliation: toStr(row.matched_affiliation),
      hIndex: toNum(row.h_index),
      hIndex5y: toNum(row.h_index_5y),
      i10Index: toNum(row.i10_index),
      i10Index5y: toNum(row.i10_index_5y),
      citations: toNum(row.citations),
      citations5y: toNum(row.citations_5y),
      status: row.status,
      openalexId: toStr(row.openalex_id),
      openalexWorksCount: toNum(row.openalex_works_count),
      openalexCitations: toNum(row.openalex_citations),
      openalexHIndex: toNum(row.openalex_h_index),
      openalexI10Index: toNum(row.openalex_i10_index),
      openalex2yrFwci: toNum(row.openalex_2yr_fwci),
      openalexTopTopic: toStr(row.openalex_top_topic),
      openalexFirstYear: toNum(row.openalex_first_year),
      openalexLastYear: toNum(row.openalex_last_year),
      openalexStatus: toStr(row.openalex_status),
    }))
}
