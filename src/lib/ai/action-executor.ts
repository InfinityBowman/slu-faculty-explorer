import type { ToolCall } from './use-chat'
import type { TierFilter } from '@/store/appStore'
import { useAppStore } from '@/store/appStore'

export interface ActionResult {
  description: string
}

const VALID_TIERS = new Set([
  'all',
  'top_1%',
  'top_5%',
  'top_10%',
  'top_25%',
  'above_median',
])

const VALID_SOURCES = new Set(['scholar', 'openalex'])

const VALID_NUMERIC_IDS = new Set([
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
])

const VALID_COLOR_IDS = new Set(['none', 'domain', 'school', 'tier', 'adminRole'])

export function executeToolCall(toolCall: ToolCall): ActionResult {
  const store = useAppStore.getState()
  const args = toolCall.arguments

  switch (toolCall.name) {
    case 'set_filters': {
      const descriptions: Array<string> = []

      if ('search' in args && typeof args.search === 'string') {
        store.setSearch(args.search)
        descriptions.push(`Search: "${args.search}"`)
      }
      if ('school' in args && typeof args.school === 'string') {
        store.setSchool(args.school)
        descriptions.push(`School: ${args.school}`)
      }
      if ('department' in args && typeof args.department === 'string') {
        store.setDepartment(args.department)
        descriptions.push(`Department: ${args.department}`)
      }
      if ('tier' in args && typeof args.tier === 'string') {
        if (VALID_TIERS.has(args.tier)) {
          store.setTier(args.tier as TierFilter)
          descriptions.push(`Tier: ${args.tier}`)
        }
      }
      if ('metricSource' in args && typeof args.metricSource === 'string') {
        if (VALID_SOURCES.has(args.metricSource)) {
          store.setMetricSource(args.metricSource as 'scholar' | 'openalex')
          descriptions.push(`Source: ${args.metricSource}`)
        }
      }

      return {
        description: descriptions.length
          ? descriptions.join(', ')
          : 'No filter changes',
      }
    }

    case 'set_scatter': {
      const updates: Record<string, string> = {}
      const descriptions: Array<string> = []

      if ('x' in args && typeof args.x === 'string' && VALID_NUMERIC_IDS.has(args.x)) {
        updates.xId = args.x
        descriptions.push(`X: ${args.x}`)
      }
      if ('y' in args && typeof args.y === 'string' && VALID_NUMERIC_IDS.has(args.y)) {
        updates.yId = args.y
        descriptions.push(`Y: ${args.y}`)
      }
      if ('color' in args && typeof args.color === 'string' && VALID_COLOR_IDS.has(args.color)) {
        updates.colorId = args.color
        descriptions.push(`Color: ${args.color}`)
      }
      if ('size' in args && typeof args.size === 'string') {
        if (args.size === 'fixed' || VALID_NUMERIC_IDS.has(args.size)) {
          updates.sizeId = args.size
          descriptions.push(`Size: ${args.size}`)
        }
      }

      if (Object.keys(updates).length > 0) {
        store.setScatterConfig(updates)
      }

      return {
        description: descriptions.length
          ? `Scatter: ${descriptions.join(', ')}`
          : 'No scatter changes',
      }
    }

    case 'clear_filters': {
      store.reset()
      return { description: 'Reset all filters' }
    }

    default:
      return { description: `Unknown tool: ${toolCall.name}` }
  }
}
