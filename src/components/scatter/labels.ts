import type { Selection } from 'd3-selection'
import type { Point } from './usePoints'

// Outlier label rendering — placement, collision avoidance, and the d3
// enter/update/exit join. Lives in its own file because it's the chunkiest
// piece of the chart's d3 code and has no other coupling to the main render.

export interface LabelPlacementInput {
  // The clipped overlay group the labels are appended into.
  overlay: Selection<SVGGElement, unknown, null, undefined>
  // Pre-filtered points the labels should consider. Caller is responsible for
  // visibility filtering (e.g. when zoomed, drop offscreen points so labels
  // don't pile up at the plot edge).
  points: ReadonlyArray<Point>
  // Set of point ids that are eligible for labeling (top-N).
  labelIds: ReadonlySet<number>
  // Pre-rescaled scales — these are the *current* (zoomed) scales, not the
  // base ones, so labels track the dots through pan/zoom.
  xPx: (p: Point) => number
  yPx: (p: Point) => number
  // Radius of the dot under each point. Provided as a function so the
  // chart can apply its size encoding.
  radiusOf: (p: Point) => number
  innerWidth: number
  innerHeight: number
  // When true, transition labels in/out smoothly. When false (zoom render),
  // update positions imperatively to avoid mid-gesture lag.
  animated: boolean
  transitionMs: number
}

interface PlacedLabel {
  point: Point
  x: number
  y: number
  anchor: 'start' | 'end'
}

const CHAR_WIDTH = 6.3 // approximate width of a Geist 11px char
const LABEL_HEIGHT = 14
const LABEL_PAD = 4
const NUDGE_TRIES = 6

export function drawLabels(input: LabelPlacementInput): void {
  const {
    overlay,
    points,
    labelIds,
    xPx,
    yPx,
    radiusOf,
    innerWidth,
    innerHeight,
    animated,
    transitionMs,
  } = input

  // Only label points that fall inside the current (possibly zoomed)
  // viewport. Otherwise the labels pile up against the plot edges.
  const visibleLabelPoints = points
    .filter((p) => {
      if (!labelIds.has(p.id)) return false
      const px = xPx(p)
      const py = yPx(p)
      return px >= 0 && px <= innerWidth && py >= 0 && py <= innerHeight
    })
    .sort((a, b) => radiusOf(b) - radiusOf(a))

  const placed: Array<PlacedLabel> = []
  for (const p of visibleLabelPoints) {
    const dotX = xPx(p)
    const dotY = yPx(p)
    const radius = radiusOf(p)
    // Anchor to the left of the dot if we're in the right 35% of the plot.
    const anchor: 'start' | 'end' =
      dotX > innerWidth * 0.65 ? 'end' : 'start'
    const labelOffset = radius + 5
    const labelX = anchor === 'end' ? dotX - labelOffset : dotX + labelOffset
    let labelY = dotY
    const textWidth = p.lastName.length * CHAR_WIDTH

    if (overlapsAny(placed, anchor, labelX, labelY, textWidth)) {
      let offset = LABEL_HEIGHT + LABEL_PAD
      let found = false
      for (let tries = 0; tries < NUDGE_TRIES; tries++) {
        if (!overlapsAny(placed, anchor, labelX, labelY - offset, textWidth)) {
          labelY = labelY - offset
          found = true
          break
        }
        if (!overlapsAny(placed, anchor, labelX, labelY + offset, textWidth)) {
          labelY = labelY + offset
          found = true
          break
        }
        offset += LABEL_HEIGHT + LABEL_PAD
      }
      if (!found) {
        labelY = dotY
      }
    }

    labelY = Math.max(
      LABEL_HEIGHT / 2,
      Math.min(innerHeight - LABEL_HEIGHT / 2, labelY),
    )

    placed.push({ point: p, x: labelX, y: labelY, anchor })
  }

  const labels = overlay
    .selectAll<SVGTextElement, PlacedLabel>('text.label')
    .data(placed, (d) => d.point.id.toString())

  labels
    .exit()
    .transition()
    .duration(animated ? transitionMs / 2 : 0)
    .attr('opacity', 0)
    .remove()

  const labelsEnter = labels
    .enter()
    .append('text')
    .attr('class', 'label')
    .attr('fill', 'var(--color-foreground)')
    .attr('font-size', 11)
    .attr('font-weight', 500)
    .attr('dominant-baseline', 'middle')
    .attr('x', (d) => d.x)
    .attr('y', (d) => d.y)
    .attr('text-anchor', (d) => d.anchor)
    .attr('opacity', 0)
    .style('pointer-events', 'none')
    .style('font-variant-numeric', 'tabular-nums')
    // Halo effect so labels stay readable over dot clusters
    .style('paint-order', 'stroke')
    .style('stroke', 'var(--color-background)')
    .style('stroke-width', '3px')
    .style('stroke-linejoin', 'round')

  const labelsMerged = labelsEnter
    .merge(labels)
    .text((d) => d.point.lastName)
    .attr('text-anchor', (d) => d.anchor)

  if (animated) {
    labelsMerged
      .transition()
      .duration(transitionMs)
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('opacity', 1)
  } else {
    labelsMerged
      .interrupt()
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('opacity', 1)
  }
}

function overlapsAny(
  placed: ReadonlyArray<PlacedLabel>,
  anchor: 'start' | 'end',
  labelX: number,
  cy: number,
  textWidth: number,
): boolean {
  const aLeft = anchor === 'start' ? labelX : labelX - textWidth
  const aRight = anchor === 'start' ? labelX + textWidth : labelX
  const aTop = cy - LABEL_HEIGHT / 2
  const aBottom = cy + LABEL_HEIGHT / 2
  for (const pl of placed) {
    const plText = pl.point.lastName.length * CHAR_WIDTH
    const bLeft = pl.anchor === 'start' ? pl.x : pl.x - plText
    const bRight = pl.anchor === 'start' ? pl.x + plText : pl.x
    const bTop = pl.y - LABEL_HEIGHT / 2
    const bBottom = pl.y + LABEL_HEIGHT / 2
    if (
      aLeft < bRight + LABEL_PAD &&
      aRight > bLeft - LABEL_PAD &&
      aTop < bBottom + LABEL_PAD &&
      aBottom > bTop - LABEL_PAD
    ) {
      return true
    }
  }
  return false
}
