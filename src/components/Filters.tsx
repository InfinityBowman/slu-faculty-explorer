import { Search } from 'lucide-react'
import type { Faculty } from '@/lib/types'
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

interface FiltersProps {
  all: Array<Faculty> | null
}

export function Filters({ all }: FiltersProps) {
  const search = useAppStore((s) => s.search)
  const school = useAppStore((s) => s.school)
  const department = useAppStore((s) => s.department)
  const metricSource = useAppStore((s) => s.metricSource)
  const setSearch = useAppStore((s) => s.setSearch)
  const setSchool = useAppStore((s) => s.setSchool)
  const setDepartment = useAppStore((s) => s.setDepartment)
  const setMetricSource = useAppStore((s) => s.setMetricSource)

  const schools = useSchoolOptions(all)
  const departments = useDepartmentOptions(all, school)

  const schoolActive = school !== 'all'
  const deptActive = department !== 'all'

  return (
    <div className="bg-card sticky top-4 z-10 flex flex-wrap items-end gap-3 rounded-lg border p-3 shadow-sm backdrop-blur-sm">
      <FilterField label="Search" className="min-w-[240px] flex-1">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Name, department, or research topic…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 h-9 w-full rounded-md border bg-white pl-8 text-[13px] focus-visible:ring-[3px] focus-visible:outline-none"
          />
        </div>
      </FilterField>

      <FilterField label="School" className="min-w-[200px] flex-1">
        <Select value={school} onValueChange={setSchool}>
          <SelectTrigger
            className={cn(
              'h-9 w-full',
              schoolActive && 'border-primary ring-primary/15 ring-[3px]',
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
              deptActive && 'border-primary ring-primary/15 ring-[3px]',
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

      <FilterField label="Source">
        <div className="bg-muted inline-flex h-9 items-center rounded-md border p-0.5">
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
      <label className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
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
