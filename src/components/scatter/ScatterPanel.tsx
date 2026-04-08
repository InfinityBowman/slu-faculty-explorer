import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScatterChart } from './ScatterChart'
import { ScatterControls } from './ScatterControls'
import { ScatterLegend } from './ScatterLegend'
import { useScatterPoints } from './usePoints'
import type { PointsResult } from './usePoints'
import type { ScatterConfig } from './types'
import type { Faculty } from '@/lib/types'
import { useAppStore } from '@/store/appStore'

interface ScatterPanelProps {
  rows: Array<Faculty>
}

const DEFAULT_CONFIG: ScatterConfig = {
  xId: 'works',
  yId: 'citations',
  sizeId: 'hIndex',
  colorId: 'none',
}

// Top-level wrapper that owns the scatter config state and stitches together
// the controls, chart, and legend. usePoints runs here once and the result
// is threaded into both the chart and the legend, so their color assignment
// is guaranteed to match.
export function ScatterPanel({ rows }: ScatterPanelProps) {
  const [config, setConfig] = useState<ScatterConfig>(DEFAULT_CONFIG)
  const metricSource = useAppStore((s) => s.metricSource)
  const result = useScatterPoints(rows, config, metricSource)

  // Set of category values the user has clicked off in the legend. Scoped to
  // the current colorId so switching between Color encodings starts fresh.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )
  useEffect(() => {
    setHidden(new Set<string>())
  }, [config.colorId])

  const toggleCategory = useCallback((value: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }
      return next
    })
  }, [])

  // Filter the points the chart actually renders, but leave the legend's
  // color assignment intact. That way hidden categories stay in the legend
  // (so the user can toggle them back on) even though no dots appear.
  const visibleResult = useMemo<PointsResult>(() => {
    if (hidden.size === 0) return result
    return {
      ...result,
      points: result.points.filter(
        (p) => p.colorValue == null || !hidden.has(p.colorValue),
      ),
    }
  }, [result, hidden])

  return (
    <div className="space-y-0">
      <ScatterControls config={config} onChange={setConfig} />
      <div className="border-y px-4 py-4">
        <ScatterChart result={visibleResult} />
      </div>
      <ScatterLegend
        field={result.fields.colorField}
        assignment={result.colorAssignment}
        hidden={hidden}
        onToggle={toggleCategory}
      />
    </div>
  )
}
