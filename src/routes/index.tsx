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
                Faculty scatter
              </h2>
              <p className="text-muted-foreground text-xs">
                Each dot is one faculty member · pick what to plot
              </p>
            </div>
            <ScatterPanel rows={filtered} />
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
