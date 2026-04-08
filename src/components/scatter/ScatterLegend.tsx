import type { CategoricalField } from './types'
import type { ColorAssignment } from './palettes'

interface ScatterLegendProps {
  field: CategoricalField | null
  assignment: ColorAssignment | null
}

export function ScatterLegend({ field, assignment }: ScatterLegendProps) {
  if (!field || !assignment || assignment.entries.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-6 py-3">
      <span className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
        {field.label}
      </span>
      {assignment.entries.map((entry) => (
        <div
          key={entry.value}
          className="text-foreground/85 flex items-center gap-1.5 text-[11px]"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
            aria-hidden
          />
          {entry.value}
        </div>
      ))}
    </div>
  )
}
