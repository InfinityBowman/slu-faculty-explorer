import { Search } from 'lucide-react'
import type { Faculty } from '@/lib/types'
import type { TierFilter } from '@/store/appStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/store/appStore'
import { useDepartmentOptions, useSchoolOptions } from '@/hooks/useFaculty'
import { cn } from '@/lib/utils'

// Threshold-style options: each entry means "this tier or better." Ordering
// goes strictest → loosest so the dropdown reads top-to-bottom as elite → broad.
// below_median is omitted on purpose — "everyone with a tier" is rarely useful
// and confuses with "All faculty," which already includes the no-tier rows.
const TIER_OPTIONS: ReadonlyArray<{ value: TierFilter; label: string }> = [
  { value: 'all', label: 'All faculty' },
  { value: 'top_1%', label: 'Top 1% in field' },
  { value: 'top_5%', label: 'Top 5% in field' },
  { value: 'top_10%', label: 'Top 10% in field' },
  { value: 'top_25%', label: 'Top 25% in field' },
  { value: 'above_median', label: 'Above field median' },
]

interface FiltersProps {
  all: Array<Faculty> | null
}

export function Filters({ all }: FiltersProps) {
  const search = useAppStore((s) => s.search)
  const school = useAppStore((s) => s.school)
  const department = useAppStore((s) => s.department)
  const tier = useAppStore((s) => s.tier)
  const metricSource = useAppStore((s) => s.metricSource)
  const setSearch = useAppStore((s) => s.setSearch)
  const setSchool = useAppStore((s) => s.setSchool)
  const setDepartment = useAppStore((s) => s.setDepartment)
  const setTier = useAppStore((s) => s.setTier)
  const setMetricSource = useAppStore((s) => s.setMetricSource)

  const schools = useSchoolOptions(all)
  const departments = useDepartmentOptions(all, school)

  const schoolActive = school !== 'all'
  const deptActive = department !== 'all'
  const tierActive = tier !== 'all'

  return (
    <div className="sticky top-4 z-10 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3 shadow-sm backdrop-blur-sm">
      <FilterField label="Search" className="min-w-[240px] flex-1">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Name, field, research interest…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-white pl-8 text-[13px] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none"
          />
        </div>
      </FilterField>

      <FilterField label="School" className="min-w-[200px] flex-1">
        <Select value={school} onValueChange={setSchool}>
          <SelectTrigger
            className={cn(
              'h-9 w-full',
              schoolActive && 'border-primary ring-[3px] ring-primary/15',
            )}
          >
            <SelectValue placeholder="All schools" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All schools</SelectItem>
            {schools.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Department" className="min-w-[200px] flex-1">
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger
            className={cn(
              'h-9 w-full',
              deptActive && 'border-primary ring-[3px] ring-primary/15',
            )}
          >
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Field tier" className="min-w-[180px]">
        <Select value={tier} onValueChange={(v) => setTier(v as TierFilter)}>
          <SelectTrigger
            className={cn(
              'h-9 w-full',
              tierActive && 'border-primary ring-[3px] ring-primary/15',
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Source">
        <div className="inline-flex h-9 items-center rounded-md border bg-muted p-0.5">
          <SourceButton
            active={metricSource === 'scholar'}
            onClick={() => setMetricSource('scholar')}
          >
            Scholar
          </SourceButton>
          <SourceButton
            active={metricSource === 'openalex'}
            onClick={() => setMetricSource('openalex')}
          >
            OpenAlex
          </SourceButton>
        </div>
      </FilterField>
    </div>
  )
}

interface FilterFieldProps {
  label: string
  className?: string
  children: React.ReactNode
}

function FilterField({ label, className, children }: FilterFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </label>
      {children}
    </div>
  )
}

interface SourceButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function SourceButton({ active, onClick, children }: SourceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-full rounded-[5px] px-3 text-[12px] font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
