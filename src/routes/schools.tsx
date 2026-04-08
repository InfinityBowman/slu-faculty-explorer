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
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="mb-6">
        <h2 className="text-[19px] leading-tight font-semibold tracking-tight">
          School strength
        </h2>
        <p className="text-muted-foreground mt-1 max-w-[720px] text-[13px]">
          SLU&apos;s nine schools ranked on a field-fair basis. Toggle between
          global field h-index percentile (overall ranking) and FWCI (impact
          per paper). Click a table row to see the department drill-down and
          top faculty.
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
            <div className="flex flex-wrap items-start justify-between gap-3 border-b px-6 py-4">
              <div className="min-w-0">
                <h3 className="text-sm font-medium tracking-tight">
                  {headerTitle}
                </h3>
                <p className="text-muted-foreground mt-0.5 text-xs">
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

interface MetricToggleProps {
  value: ChartMetric
  onChange: (m: ChartMetric) => void
}

function MetricToggle({ value, onChange }: MetricToggleProps) {
  return (
    <div className="bg-muted inline-flex h-9 items-center rounded-md border p-0.5">
      <ToggleButton
        active={value === 'fieldPercentile'}
        onClick={() => onChange('fieldPercentile')}
      >
        Field %
      </ToggleButton>
      <ToggleButton
        active={value === 'fwci'}
        onClick={() => onChange('fwci')}
      >
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
