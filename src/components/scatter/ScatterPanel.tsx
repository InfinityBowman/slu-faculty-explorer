import { useState } from 'react'
import { ScatterChart } from './ScatterChart'
import { ScatterControls } from './ScatterControls'
import { ScatterLegend } from './ScatterLegend'
import { useScatterPoints } from './usePoints'
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

  return (
    <div className="space-y-0">
      <ScatterControls config={config} onChange={setConfig} />
      <div className="border-y px-4 py-4">
        <ScatterChart result={result} />
      </div>
      <ScatterLegend
        field={result.fields.colorField}
        assignment={result.colorAssignment}
      />
    </div>
  )
}
