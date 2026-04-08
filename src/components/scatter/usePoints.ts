import { useMemo } from 'react'
import { findCategoricalField, findNumericField } from './fields'
import { FIXED_SIZE_ID, NO_COLOR_ID } from './types'
import { buildColorAssignment } from './palettes'
import type { Faculty } from '@/lib/types'
import type { CategoricalField, NumericField, ScatterConfig } from './types'
import type { ColorAssignment } from './palettes'
import type { MetricSource } from '@/store/appStore'

export interface Point {
  id: number
  name: string
  lastName: string
  department: string
  x: number
  y: number
  size: number | null
  colorValue: string | null
}

export interface ResolvedFields {
  xField: NumericField
  yField: NumericField
  sizeField: NumericField | null
  colorField: CategoricalField | null
}

export interface PointsResult {
  points: Array<Point>
  fields: ResolvedFields
  colorAssignment: ColorAssignment | null
}

// Resolves the scatter config into actual field definitions and builds the
// list of plottable points. Filters out faculty whose values are missing for
// any required field, and (for log scales) any non-positive values that
// can't be plotted.
export function useScatterPoints(
  rows: Array<Faculty>,
  config: ScatterConfig,
  metricSource: MetricSource,
): PointsResult {
  const fields = useMemo<ResolvedFields>(() => {
    const xField = findNumericField(config.xId)
    const yField = findNumericField(config.yId)
    const sizeField =
      config.sizeId === FIXED_SIZE_ID ? null : findNumericField(config.sizeId)
    const colorField =
      config.colorId === NO_COLOR_ID ? null : findCategoricalField(config.colorId)
    return { xField, yField, sizeField, colorField }
  }, [config.xId, config.yId, config.sizeId, config.colorId])

  const points = useMemo<Array<Point>>(() => {
    const out: Array<Point> = []
    for (const f of rows) {
      const x = fields.xField.accessor(f, metricSource)
      const y = fields.yField.accessor(f, metricSource)
      if (x == null || y == null) continue
      // Log scales require strictly positive values.
      if (fields.xField.scale === 'log' && x <= 0) continue
      if (fields.yField.scale === 'log' && y <= 0) continue

      let size: number | null = null
      if (fields.sizeField) {
        const s = fields.sizeField.accessor(f, metricSource)
        if (s == null) continue
        // Size encoding can't handle non-positive values either (sqrt scale).
        if (s < 0) continue
        size = s
      }

      const colorValue = fields.colorField
        ? fields.colorField.accessor(f)
        : null

      const parts = f.name.split(' ')
      out.push({
        id: f.id,
        name: f.name,
        lastName: parts[parts.length - 1] ?? f.name,
        department: f.department,
        x,
        y,
        size,
        colorValue,
      })
    }
    return out
  }, [rows, fields, metricSource])

  const colorAssignment = useMemo(() => {
    if (!fields.colorField) return null
    const values: Array<string> = []
    for (const p of points) {
      if (p.colorValue) values.push(p.colorValue)
    }
    return buildColorAssignment(fields.colorField, values)
  }, [fields.colorField, points])

  return { points, fields, colorAssignment }
}
