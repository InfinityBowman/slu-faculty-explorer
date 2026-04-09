import { createFileRoute } from '@tanstack/react-router'
import { Filters } from '@/components/Filters'
import { FacultyTable } from '@/components/FacultyTable'
import { ScatterPanel } from '@/components/scatter/ScatterPanel'
import { StatStrip } from '@/components/StatStrip'
import { Skeleton } from '@/components/ui/skeleton'
import { useFacultyData, useFilteredFaculty } from '@/hooks/useFaculty'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Explorer | SLU Faculty Research Explorer' },
      {
        name: 'description',
        content:
          'Filter, search, and visualize research metrics for 519 SLU faculty. Interactive scatter plots with configurable axes, sortable tables, and AI-powered data exploration.',
      },
    ],
  }),
  component: ExplorerPage,
})

function ExplorerPage() {
  const { data, error, isLoading } = useFacultyData()
  const filtered = useFilteredFaculty(data)

  return (
    <main className="mx-auto max-w-350 px-6 py-8">
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load faculty data: {error}
        </div>
      ) : null}

      {isLoading ? <LoadingSkeleton /> : null}

      {data ? (
        <div className="space-y-8">
          <Filters all={data} />

          <StatStrip rows={filtered} total={data.length} />

          <section className="rounded-lg border bg-card">
            <div className="flex items-baseline justify-between border-b px-6 py-4">
              <h2 className="text-sm font-medium tracking-tight">
                Faculty scatter
              </h2>
              <p className="text-xs text-muted-foreground">
                Each dot is one faculty member · pick what to plot
              </p>
            </div>
            <ScatterPanel rows={filtered} />
          </section>

          <section className="rounded-lg border bg-card">
            <div className="flex items-baseline justify-between border-b px-6 py-4">
              <h2 className="text-sm font-medium tracking-tight">
                Faculty
                <span className="tabular ml-2 font-normal text-muted-foreground">
                  {filtered.length.toLocaleString()}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Click a row for details
              </p>
            </div>
            <FacultyTable rows={filtered} />
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
