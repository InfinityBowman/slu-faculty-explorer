import type { CategoricalField } from './types'
import type { ColorAssignment } from './palettes'
import { cn } from '@/lib/utils'

interface ScatterLegendProps {
  field: CategoricalField | null
  assignment: ColorAssignment | null
  hidden: ReadonlySet<string>
  onToggle: (value: string) => void
}

export function ScatterLegend({
  field,
  assignment,
  hidden,
  onToggle,
}: ScatterLegendProps) {
  if (!field || !assignment || assignment.entries.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-6 py-3">
      <span className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
        {field.label}
      </span>
      {assignment.entries.map((entry) => {
        const isHidden = hidden.has(entry.value)
        return (
          <button
            key={entry.value}
            type="button"
            onClick={() => onToggle(entry.value)}
            aria-pressed={!isHidden}
            className={cn(
              'group flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] transition-colors',
              'hover:bg-muted focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none',
              isHidden
                ? 'text-muted-foreground/60 line-through'
                : 'text-foreground/85',
            )}
            title={isHidden ? `Show ${entry.value}` : `Hide ${entry.value}`}
          >
            <span
              className={cn(
                'inline-block h-2.5 w-2.5 rounded-full border transition-colors',
                isHidden ? 'border-border bg-transparent' : 'border-transparent',
              )}
              style={
                isHidden ? undefined : { backgroundColor: entry.color }
              }
              aria-hidden
            />
            {entry.value}
          </button>
        )
      })}
    </div>
  )
}
