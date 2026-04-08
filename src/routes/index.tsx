import { createFileRoute } from '@tanstack/react-router'
import { Filters } from '@/components/Filters'
import { FacultyTable } from '@/components/FacultyTable'
import { ScatterChart } from '@/components/ScatterChart'
import { StatStrip } from '@/components/StatStrip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useFacultyData,
  useFacultyPercentiles,
  useFilteredFaculty,
} from '@/hooks/useFaculty'

export const Route = createFileRoute('/')({
  component: ExplorerPage,
})

function ExplorerPage() {
  const { data, error, isLoading } = useFacultyData()
  const filtered = useFilteredFaculty(data)
  const percentiles = useFacultyPercentiles(data)

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      {error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-4 py-3 text-sm">
          Failed to load faculty data: {error}
        </div>
      ) : null}

      {isLoading ? <LoadingSkeleton /> : null}

      {data ? (
        <div className="space-y-8">
          <Filters all={data} />

          <StatStrip rows={filtered} total={data.length} />

          <section className="bg-card rounded-lg border">
            <div className="flex items-baseline justify-between border-b px-6 py-4">
              <h2 className="text-sm font-medium tracking-tight">
                Productivity vs. impact
              </h2>
              <p className="text-muted-foreground text-xs">
                Each dot is one faculty member · sized by h-index
              </p>
            </div>
            <div className="p-4">
              <ScatterChart rows={filtered} />
            </div>
          </section>

          <section className="bg-card rounded-lg border">
            <div className="flex items-baseline justify-between border-b px-6 py-4">
              <h2 className="text-sm font-medium tracking-tight">
                Faculty
                <span className="text-muted-foreground tabular ml-2 font-normal">
                  {filtered.length.toLocaleString()}
                </span>
              </h2>
              <p className="text-muted-foreground text-xs">
                Click a row for details
              </p>
            </div>
            <FacultyTable rows={filtered} percentiles={percentiles} />
          </section>
        </div>
      ) : null}
    </main>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-11" />
      <Skeleton className="h-20" />
      <Skeleton className="h-80" />
      <Skeleton className="h-96" />
    </div>
  )
}
