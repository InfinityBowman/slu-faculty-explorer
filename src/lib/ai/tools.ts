import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'
import { executeCode } from './code-executor'
import {
  buildDatasetSummary,
  buildDepartmentSummary,
  buildFacultyDetail,
  buildRankings,
  buildSchoolSummary,
  buildSearch,
} from './data-executor'
import type { Faculty } from '@/lib/types'
import type { TierFilter } from '@/store/appStore'
import { useAppStore } from '@/store/appStore'

// ── Faculty data ref (set from CommandBar when data loads) ──

let _faculty: Array<Faculty> = []
export function setFacultyData(data: Array<Faculty>) {
  _faculty = data
}

// ── Enum values ──

const TIER_VALUES = [
  'all',
  'top_1%',
  'top_5%',
  'top_10%',
  'top_25%',
  'above_median',
] as const

const SOURCE_VALUES = ['scholar', 'openalex'] as const

const NUMERIC_FIELD_IDS = [
  'works',
  'citations',
  'hIndex',
  'mIndex',
  'i10',
  'fwci',
  'fieldPct',
  'subfieldPct',
  'deptHPct',
  'deptFwciPct',
  'careerLength',
  'lastYear',
] as const

const COLOR_FIELD_IDS = [
  'none',
  'domain',
  'school',
  'tier',
  'adminRole',
] as const

const SIZE_FIELD_IDS = ['fixed', ...NUMERIC_FIELD_IDS] as const

const RANKING_METRICS = [
  'hIndex',
  'mIndex',
  'citations',
  'works',
  'fwci',
  'fieldPercentile',
] as const

// ── Tool Definitions ──

const setFiltersDef = toolDefinition({
  name: 'set_filters' as const,
  description:
    'Set explorer filters. Only include filters you want to change. Omit filters you want to leave as-is.',
  inputSchema: z.object({
    search: z
      .string()
      .optional()
      .describe(
        'Free-text search (matches name, department, research interests)',
      ),
    school: z
      .string()
      .optional()
      .describe('School name or "all" for no filter'),
    department: z
      .string()
      .optional()
      .describe('Department name or "all" for no filter'),
    tier: z
      .enum(TIER_VALUES)
      .optional()
      .describe(
        'Minimum field tier threshold. "top_5%" means top 5% or better.',
      ),
    metricSource: z
      .enum(SOURCE_VALUES)
      .optional()
      .describe('Which data source to use for h-index and citations'),
  }),
})

const setScatterDef = toolDefinition({
  name: 'set_scatter' as const,
  description:
    'Configure the scatter chart axes and encodings. Only include fields you want to change.',
  inputSchema: z.object({
    x: z.enum(NUMERIC_FIELD_IDS).optional().describe('X-axis metric'),
    y: z.enum(NUMERIC_FIELD_IDS).optional().describe('Y-axis metric'),
    color: z
      .enum(COLOR_FIELD_IDS)
      .optional()
      .describe('Color encoding categorical field, or "none"'),
    size: z
      .enum(SIZE_FIELD_IDS)
      .optional()
      .describe('Size encoding metric, or "fixed" for uniform size'),
  }),
})

const clearFiltersDef = toolDefinition({
  name: 'clear_filters' as const,
  description: 'Reset all explorer filters to their defaults.',
  inputSchema: z.object({}),
})

const getDatasetSummaryDef = toolDefinition({
  name: 'get_dataset_summary' as const,
  description:
    'Get high-level stats about the full faculty dataset: total faculty, coverage by source, school breakdown, median h-index. Call this first for general questions.',
  inputSchema: z.object({}),
})

const getFacultyDetailDef = toolDefinition({
  name: 'get_faculty_detail' as const,
  description:
    'Get the full profile for a specific faculty member by name. Uses fuzzy matching.',
  inputSchema: z.object({
    name: z.string().describe('Faculty member name (e.g. "Jerome Katz")'),
  }),
})

const getSchoolSummaryDef = toolDefinition({
  name: 'get_school_summary' as const,
  description:
    'Get summary stats for a specific school: faculty count, coverage, median h-index, top faculty, department breakdown.',
  inputSchema: z.object({
    school: z
      .string()
      .describe('School name (e.g. "Chaifetz School of Business")'),
  }),
})

const getDepartmentSummaryDef = toolDefinition({
  name: 'get_department_summary' as const,
  description:
    'Get summary stats for a specific department: faculty count, coverage, median h-index, top faculty.',
  inputSchema: z.object({
    department: z.string().describe('Department name (e.g. "Finance")'),
  }),
})

const getRankingsDef = toolDefinition({
  name: 'get_rankings' as const,
  description:
    'Rank faculty by a metric. Returns top or bottom faculty with values.',
  inputSchema: z.object({
    metric: z.enum(RANKING_METRICS).describe('Metric to rank by'),
    school: z.string().optional().describe('Optional school filter'),
    department: z.string().optional().describe('Optional department filter'),
    order: z
      .enum(['desc', 'asc'])
      .optional()
      .describe('Sort order (default: desc = highest first)'),
    limit: z
      .number()
      .optional()
      .describe('Number of results (default: 10, max: 25)'),
  }),
})

const searchFacultyDef = toolDefinition({
  name: 'search_faculty' as const,
  description:
    'Search faculty by name, department, research interests, or OpenAlex field. Returns matching faculty with key metrics.',
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        'Search query (matched against name, department, research interests, OpenAlex field/topic)',
      ),
    limit: z
      .number()
      .optional()
      .describe('Max results (default: 10, max: 25)'),
  }),
})

const runAnalysisDef = toolDefinition({
  name: 'run_analysis' as const,
  description: `Execute JavaScript code against the faculty dataset for custom computations (correlations, statistical tests, complex filtering, group comparisons). The code receives \`data\` — an array of faculty objects — and must return a JSON-serializable value. Runs in a sandboxed worker with a 5-second timeout.

Each element in \`data\` has these properties (all nullable except id/name/school/department):
  id, name, school, department,
  hIndex, hIndex5y, i10Index, i10Index5y, citations, citations5y,
  openalexHIndex, openalexCitations, openalexWorksCount, openalex2yrFwci,
  openalexFirstYear, openalexLastYear,
  openalexField, openalexSubfield, openalexTopTopic,
  primaryHTier, fieldHPercentile, subfieldHPercentile, deptHPercentile,
  adminRole, phdYear, phdInstitution

Example: compute average h-index by school:
  const bySchool = {};
  for (const f of data) {
    const h = f.hIndex ?? f.openalexHIndex;
    if (h == null) continue;
    (bySchool[f.school] ??= []).push(h);
  }
  const result = {};
  for (const [s, vals] of Object.entries(bySchool)) {
    result[s] = { mean: vals.reduce((a,b) => a+b, 0) / vals.length, n: vals.length };
  }
  return result;`,
  inputSchema: z.object({
    code: z
      .string()
      .describe(
        'JavaScript function body. Has access to `data` (Array of faculty objects). Must `return` a JSON-serializable value.',
      ),
    description: z
      .string()
      .describe(
        'Brief human-readable description of what this code computes (shown to the user while running)',
      ),
  }),
})

// ── Client Tools (with execute functions) ──

const VALID_NUMERIC_IDS = new Set<string>(NUMERIC_FIELD_IDS)
const VALID_COLOR_IDS = new Set<string>(COLOR_FIELD_IDS)

const setFiltersClient = setFiltersDef.client((args) => {
  const store = useAppStore.getState()
  const descriptions: Array<string> = []

  if (args.search !== undefined) {
    store.setSearch(args.search)
    descriptions.push(`Search: "${args.search}"`)
  }
  if (args.school !== undefined) {
    store.setSchool(args.school)
    descriptions.push(`School: ${args.school}`)
  }
  if (args.department !== undefined) {
    store.setDepartment(args.department)
    descriptions.push(`Department: ${args.department}`)
  }
  if (args.tier !== undefined) {
    store.setTier(args.tier as TierFilter)
    descriptions.push(`Tier: ${args.tier}`)
  }
  if (args.metricSource !== undefined) {
    store.setMetricSource(args.metricSource)
    descriptions.push(`Source: ${args.metricSource}`)
  }

  return {
    success: true,
    description: descriptions.join(', ') || 'No filter changes',
  }
})

const setScatterClient = setScatterDef.client((args) => {
  const updates: Record<string, string> = {}
  const descriptions: Array<string> = []

  if (args.x && VALID_NUMERIC_IDS.has(args.x)) {
    updates.xId = args.x
    descriptions.push(`X: ${args.x}`)
  }
  if (args.y && VALID_NUMERIC_IDS.has(args.y)) {
    updates.yId = args.y
    descriptions.push(`Y: ${args.y}`)
  }
  if (args.color && VALID_COLOR_IDS.has(args.color)) {
    updates.colorId = args.color
    descriptions.push(`Color: ${args.color}`)
  }
  if (args.size && (args.size === 'fixed' || VALID_NUMERIC_IDS.has(args.size))) {
    updates.sizeId = args.size
    descriptions.push(`Size: ${args.size}`)
  }

  if (Object.keys(updates).length > 0) {
    useAppStore.getState().setScatterConfig(updates)
  }

  return {
    success: true,
    description: descriptions.length
      ? `Scatter: ${descriptions.join(', ')}`
      : 'No scatter changes',
  }
})

const clearFiltersClient = clearFiltersDef.client(() => {
  useAppStore.getState().reset()
  return { success: true, description: 'Reset all filters' }
})

const getDatasetSummaryClient = getDatasetSummaryDef.client(() => {
  return buildDatasetSummary(_faculty)
})

const getFacultyDetailClient = getFacultyDetailDef.client((args) => {
  return buildFacultyDetail(args.name, _faculty)
})

const getSchoolSummaryClient = getSchoolSummaryDef.client((args) => {
  return buildSchoolSummary(args.school, _faculty)
})

const getDepartmentSummaryClient = getDepartmentSummaryDef.client((args) => {
  return buildDepartmentSummary(args.department, _faculty)
})

const getRankingsClient = getRankingsDef.client((args) => {
  return buildRankings(
    args.metric,
    args.school,
    args.department,
    args.order ?? 'desc',
    Math.min(args.limit ?? 10, 25),
    _faculty,
  )
})

const searchFacultyClient = searchFacultyDef.client((args) => {
  return buildSearch(args.query, Math.min(args.limit ?? 10, 25), _faculty)
})

const runAnalysisClient = runAnalysisDef.client(async (args) => {
  try {
    const result = await executeCode(args.code, _faculty)
    return { result }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
})

// ── Exports ──

/** Tool definitions (no execute) — passed to server-side chat() */
export const TOOL_DEFS = [
  setFiltersDef,
  setScatterDef,
  clearFiltersDef,
  getDatasetSummaryDef,
  getFacultyDetailDef,
  getSchoolSummaryDef,
  getDepartmentSummaryDef,
  getRankingsDef,
  searchFacultyDef,
  runAnalysisDef,
]

/** Client tools (with execute) — passed to useChat() */
export const CLIENT_TOOLS = [
  setFiltersClient,
  setScatterClient,
  clearFiltersClient,
  getDatasetSummaryClient,
  getFacultyDetailClient,
  getSchoolSummaryClient,
  getDepartmentSummaryClient,
  getRankingsClient,
  searchFacultyClient,
  runAnalysisClient,
] as const
