import { createFileRoute } from '@tanstack/react-router'
import { SchoolStripChart } from '@/components/SchoolStripChart'
import { SchoolTable } from '@/components/SchoolTable'
import { Skeleton } from '@/components/ui/skeleton'
import { useFacultyData } from '@/hooks/useFaculty'
import { useSchoolSummary } from '@/hooks/useSchools'

export const Route = createFileRoute('/schools')({
  component: SchoolsPage,
})

function SchoolsPage() {
  const { data, error, isLoading } = useFacultyData()
  const schools = useSchoolSummary(data)

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="mb-6">
        <h2 className="text-[19px] leading-tight font-semibold tracking-tight">
          School strength
        </h2>
        <p className="text-muted-foreground mt-1 max-w-[720px] text-[13px]">
          SLU's nine schools ranked on a field-fair basis. Each dot in the chart
          is one faculty member, positioned by their global field h-index
          percentile. The thick blue tick is the school's median. Click a table
          row to see the department drill-down and top faculty.
        </p>
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-4 py-3 text-sm">
          Failed to load faculty data: {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : null}

      {data ? (
        <div className="space-y-8">
          <section className="bg-card rounded-lg border">
            <div className="flex items-baseline justify-between border-b px-6 py-4">
              <h3 className="text-sm font-medium tracking-tight">
                Distribution of field percentiles
              </h3>
              <p className="text-muted-foreground text-xs">
                Each dot is one faculty member · thick tick marks the median
              </p>
            </div>
            <div className="p-4">
              <SchoolStripChart schools={schools} faculty={data} />
            </div>
          </section>

          <section className="bg-card rounded-lg border">
            <div className="flex items-baseline justify-between border-b px-6 py-4">
              <h3 className="text-sm font-medium tracking-tight">
                All schools
                <span className="text-muted-foreground tabular ml-2 font-normal">
                  {schools.length.toLocaleString()}
                </span>
              </h3>
              <p className="text-muted-foreground text-xs">
                Click a row for departments and top faculty
              </p>
            </div>
            <SchoolTable schools={schools} />
          </section>
        </div>
      ) : null}
    </main>
  )
}
