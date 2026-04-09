import type { CategoricalField } from './types'

// ─── Qualitative palette ───────────────────────────────────────────────────

// Nine distinct hues in OKLCH for nominal categories. Designed to be
// distinguishable on a light background while staying restrained enough to
// match the rest of the SLU palette. Order is rotated so that the first few
// colors are the most distinct (useful for 4-bucket Domain coloring).
const QUALITATIVE_PALETTE: ReadonlyArray<string> = [
  'oklch(0.50 0.18 259)', // slate blue (SLU primary-ish)
  'oklch(0.65 0.15 50)', // warm orange
  'oklch(0.55 0.13 150)', // forest green
  'oklch(0.50 0.15 320)', // plum
  'oklch(0.62 0.18 25)', // coral red
  'oklch(0.60 0.12 200)', // teal
  'oklch(0.70 0.13 90)', // mustard
  'oklch(0.45 0.16 280)', // indigo
  'oklch(0.55 0.10 110)', // olive
]

// ─── Sequential SLU-blue ramp for ordered categories ──────────────────────

// Six steps from dark to light, used for ordered categorical fields like
// Field tier so the lowest tier renders as the lightest dot. Matches the
// monochrome ramp used by the tier badge in the table for consistency.
const SEQUENTIAL_BLUE: ReadonlyArray<string> = [
  'oklch(0.28 0.16 259)',
  'oklch(0.40 0.18 259)',
  'oklch(0.52 0.17 259)',
  'oklch(0.64 0.13 259)',
  'oklch(0.74 0.09 259)',
  'oklch(0.84 0.05 259)',
]

export const DEFAULT_DOT_COLOR = 'oklch(0.41 0.17 259)' // SLU primary
export const UNKNOWN_CATEGORY_COLOR = 'oklch(0.78 0.01 258)' // muted gray

export interface ColorAssignment {
  // Ordered list of (label → color) entries used for both rendering dots
  // and building the legend. Stable order = predictable legend.
  entries: ReadonlyArray<{ value: string; color: string }>
  // Quick lookup for the chart's per-dot color resolution.
  lookup: ReadonlyMap<string, string>
}

// Build a label→color mapping for a categorical field, given the rows the
// chart will actually render. Unordered fields get colors from the
// qualitative palette in first-seen order; ordered fields use the sequential
// ramp in their declared order.
export function buildColorAssignment(
  field: CategoricalField,
  values: Iterable<string>,
): ColorAssignment {
  const seen = new Set<string>()
  for (const v of values) {
    if (v) seen.add(v)
  }

  let labels: Array<string>
  let palette: ReadonlyArray<string>

  if (field.ordered) {
    // Preserve the declared order, but only include labels that actually
    // appear in the data so the legend doesn't show empty entries.
    labels = field.ordered.filter((v) => seen.has(v))
    palette = SEQUENTIAL_BLUE
  } else {
    // Stable alphabetical for nominal categories so the legend doesn't
    // shuffle when the user filters the data.
    labels = Array.from(seen).sort((a, b) => a.localeCompare(b))
    palette = QUALITATIVE_PALETTE
  }

  const entries: Array<{ value: string; color: string }> = []
  const lookup = new Map<string, string>()
  for (let i = 0; i < labels.length; i++) {
    const color = palette[i % palette.length]
    entries.push({ value: labels[i], color })
    lookup.set(labels[i], color)
  }

  return { entries, lookup }
}
