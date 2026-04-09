import { createFileRoute } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { useFacultyData } from '@/hooks/useFaculty'
import { TierOverview } from '@/components/insights/TierOverview'
import { FwciDistribution } from '@/components/insights/FwciDistribution'
import { MIndexOverview } from '@/components/insights/MIndexOverview'
import { AdminResearch } from '@/components/insights/AdminResearch'
import { CoverageMatrix } from '@/components/insights/CoverageMatrix'
import { FieldBenchmark } from '@/components/insights/FieldBenchmark'

export const Route = createFileRoute('/insights')({
  component: InsightsPage,
})

function InsightsPage() {
  const { data, error, isLoading } = useFacultyData()

  return (
    <main className="mx-auto max-w-350 px-6 py-8">
      <div className="mb-8">
        <h2 className="text-[19px] leading-tight font-semibold tracking-tight">
          Research insights
        </h2>
        <p className="mt-1 max-w-180 text-[13px] text-muted-foreground">
          Presentation-ready analytics for SLU leadership. All h-index
          metrics are field-normalized. See{' '}
          <a href="/about" className="underline hover:text-foreground">
            About
          </a>{' '}
          for methodology.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load faculty data: {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      ) : null}

      {data ? (
        <div className="space-y-8">
          <Section
            title="Field-normalized tier distribution"
            subtitle="Percentage of faculty in each global h-index percentile tier by school"
          >
            <TierOverview faculty={data} />
          </Section>

          <div className="grid gap-8 lg:grid-cols-2">
            <Section
              title="FWCI distribution"
              subtitle="Citation impact relative to the global field average (1.0)"
            >
              <FwciDistribution faculty={data} />
            </Section>
            <Section
              title="m-index by career stage"
              subtitle="h-index per year of publishing, grouped by first-publication decade"
            >
              <MIndexOverview faculty={data} />
            </Section>
          </div>

          <Section
            title="Administrative role vs. research output"
            subtitle="Median global field h-percentile by administrative role"
          >
            <AdminResearch faculty={data} />
          </Section>

          <Section
            title="SLU vs. global field benchmarks"
            subtitle="School median h-index against global field distribution (active authors with 10+ publications)"
          >
            <FieldBenchmark faculty={data} />
          </Section>

          <Section
            title="Data source coverage"
            subtitle="Faculty with bibliometric profiles by school and source"
          >
            <CoverageMatrix faculty={data} />
          </Section>
        </div>
      ) : null}
    </main>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-6 py-4">
        <h3 className="text-sm font-medium tracking-tight">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}
