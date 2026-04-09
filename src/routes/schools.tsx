import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { ChartMetric } from '@/components/SchoolStripChart'
import { SchoolStripChart } from '@/components/SchoolStripChart'
import { SchoolTable } from '@/components/SchoolTable'
import { Skeleton } from '@/components/ui/skeleton'
import { useFacultyData } from '@/hooks/useFaculty'
import { useSchoolSummary } from '@/hooks/useSchools'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/schools')({
  head: () => ({
    meta: [
      { title: 'Schools | SLU Faculty Research Explorer' },
      {
        name: 'description',
        content:
          'Compare research productivity across Saint Louis University schools. View field percentile and FWCI distributions, department breakdowns, and top faculty by school.',
      },
    ],
  }),
  component: SchoolsPage,
})

function SchoolsPage() {
  const { data, error, isLoading } = useFacultyData()
  const schools = useSchoolSummary(data)
  const [metric, setMetric] = useState<ChartMetric>('fieldPercentile')

  const headerTitle =
    metric === 'fwci'
      ? 'Distribution of field-weighted citation impact'
      : 'Distribution of field percentiles'
  const headerSubtitle =
    metric === 'fwci'
      ? 'Each dot is one faculty · thick tick marks the median · 1.0 = field avg'
      : 'Each dot is one faculty member · thick tick marks the median'

  return (
    <main className="mx-auto max-w-350 px-6 py-8">
      <div className="mb-6">
        <h2 className="text-[19px] leading-tight font-semibold tracking-tight">
          School strength
        </h2>
        <p className="mt-1 max-w-180 text-[13px] text-muted-foreground">
          Important to note that h-index scores are relative to a field. A high
          h-index in one field might be average in another. Additionally, the
          field chosen by OpenAlex for a given faculty member might not reflect
          their actual research area, which can greatly skew percentile
          rankings.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
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
          <section className="rounded-lg border bg-card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b px-6 py-4">
              <div className="min-w-0">
                <h3 className="text-sm font-medium tracking-tight">
                  {headerTitle}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {headerSubtitle}
                </p>
              </div>
              <MetricToggle value={metric} onChange={setMetric} />
            </div>
            <div className="p-4">
              <SchoolStripChart
                schools={schools}
                faculty={data}
                metric={metric}
              />
            </div>
          </section>

          <section className="rounded-lg border bg-card">
            <div className="flex items-baseline justify-between border-b px-6 py-4">
              <h3 className="text-sm font-medium tracking-tight">
                All schools
                <span className="tabular ml-2 font-normal text-muted-foreground">
                  {schools.length.toLocaleString()}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
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

interface MetricToggleProps {
  value: ChartMetric
  onChange: (m: ChartMetric) => void
}

function MetricToggle({ value, onChange }: MetricToggleProps) {
  return (
    <div className="inline-flex h-9 items-center rounded-md border bg-muted p-0.5">
      <ToggleButton
        active={value === 'fieldPercentile'}
        onClick={() => onChange('fieldPercentile')}
      >
        Field %
      </ToggleButton>
      <ToggleButton active={value === 'fwci'} onClick={() => onChange('fwci')}>
        FWCI
      </ToggleButton>
    </div>
  )
}

interface ToggleButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToggleButton({ active, onClick, children }: ToggleButtonProps) {
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
