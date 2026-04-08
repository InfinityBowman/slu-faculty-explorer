import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Filters } from '@/components/Filters'
import { FacultyTable } from '@/components/FacultyTable'
import { HIndexChart } from '@/components/HIndexChart'
import { StatsRow } from '@/components/StatsRow'
import { useFacultyData, useFilteredFaculty } from '@/hooks/useFaculty'

export function App() {
  const { data, error, isLoading } = useFacultyData()
  const filtered = useFilteredFaculty(data)

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <h1 className="text-xl font-semibold tracking-tight">
            SLU Faculty Research Explorer
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Google Scholar &amp; OpenAlex metrics for Saint Louis University faculty.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {error ? (
          <div className="border-destructive text-destructive rounded-md border p-4 text-sm">
            Failed to load data: {error}
          </div>
        ) : null}

        {isLoading ? <LoadingSkeleton /> : null}

        {data ? (
          <>
            <Filters all={data} />
            <StatsRow rows={filtered} />
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle className="text-base">h-index distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <HIndexChart rows={filtered} />
                </CardContent>
              </Card>
              <Card className="min-w-0">
                <CardHeader>
                  <CardTitle className="text-base">Faculty</CardTitle>
                </CardHeader>
                <CardContent>
                  <FacultyTable rows={filtered} />
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  )
}

export default App
