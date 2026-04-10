import type { Faculty } from '@/lib/types'

// A numeric field is anything that can be plotted on an axis or used to drive
// dot size. For dual-source metrics (h-index, citations, i10), accessors
// prefer Google Scholar when available and fall back to OpenAlex.
export interface NumericField {
  id: string
  label: string
  accessor: (f: Faculty) => number | null
  scale: 'log' | 'linear'
  // Custom domain endpoints for known-bounded fields (e.g. percentiles
  // always go 0–100). When omitted, the chart computes the domain from data.
  domain?: [number, number]
  // Optional explicit tick values; otherwise the chart picks them from the
  // computed scale. Useful for log axes where d3's auto-ticks get noisy.
  tickValues?: ReadonlyArray<number>
  // How to format a single tick value for display.
  formatTick?: (n: number) => string
  // How to format a value for the tooltip (may differ from tick formatting,
  // e.g. tooltips can show full precision).
  formatValue?: (n: number) => string
}

// A categorical field drives color encoding. `null` accessor return = unknown,
// rendered with the default dot color. `ordered` is used for sequential color
// scales (e.g. Field tier); without it, the field is treated as nominal.
export interface CategoricalField {
  id: string
  label: string
  accessor: (f: Faculty) => string | null
  ordered?: ReadonlyArray<string>
}

// The "no encoding" sentinel for the Color dropdown — picking this turns off
// color encoding entirely and falls back to the single-color default.
export const NO_COLOR_ID = 'none'

// Likewise for Size — picking 'fixed' turns off size encoding so every dot
// renders at the same radius.
export const FIXED_SIZE_ID = 'fixed'

export interface ScatterConfig {
  xId: string
  yId: string
  // sizeId can be FIXED_SIZE_ID to disable size encoding.
  sizeId: string
  // colorId can be NO_COLOR_ID to disable color encoding.
  colorId: string
}
