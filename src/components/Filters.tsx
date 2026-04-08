import type { Faculty } from '@/lib/types'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/store/appStore'
import { useDepartmentOptions, useSchoolOptions } from '@/hooks/useFaculty'

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

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Input
        placeholder="Search name, dept, topic…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Select value={school} onValueChange={setSchool}>
        <SelectTrigger>
          <SelectValue placeholder="School" />
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
      <Select value={department} onValueChange={setDepartment}>
        <SelectTrigger>
          <SelectValue placeholder="Department" />
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
      <Select
        value={metricSource}
        onValueChange={(v) => setMetricSource(v as 'scholar' | 'openalex')}
      >
        <SelectTrigger>
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="scholar">Google Scholar</SelectItem>
          <SelectItem value="openalex">OpenAlex</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
