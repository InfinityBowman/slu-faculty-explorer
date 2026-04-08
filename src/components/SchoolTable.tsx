import { Fragment, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowRight, ArrowUp, ChevronRight } from 'lucide-react'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { SchoolSummary } from '@/hooks/useSchools'
import type { HTier } from '@/lib/types'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'

const TIER_LABELS: Record<HTier, string> = {
  'top_1%': 'Top 1%',
  'top_5%': 'Top 5%',
  'top_10%': 'Top 10%',
  'top_25%': 'Top 25%',
  above_median: 'Above median',
  below_median: 'Below median',
}

const TIER_CLASSES: Record<HTier, string> = {
  'top_1%': 'bg-primary text-primary-foreground border-primary shadow-sm',
  'top_5%': 'bg-primary/85 text-primary-foreground border-primary/85',
  'top_10%': 'bg-primary/15 text-primary border-primary/30',
  'top_25%': 'bg-primary/8 text-primary/90 border-primary/15',
  above_median: 'bg-muted text-foreground border-border',
  below_median: 'text-muted-foreground/80 border-transparent',
}

interface SchoolTableProps {
  schools: Array<SchoolSummary>
}

export function SchoolTable({ schools }: SchoolTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'medianFieldPercentile', desc: true },
  ])
  const [expanded, setExpanded] = useState<string | null>(null)

  const columns = useMemo<Array<ColumnDef<SchoolSummary>>>(
    () => [
      {
        id: 'school',
        accessorFn: (r) => r.school,
        header: 'School',
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="text-foreground truncate text-[13px] leading-tight font-medium">
              {row.original.school}
            </span>
            {row.original.topField ? (
              <span className="text-muted-foreground mt-0.5 truncate text-[11px]">
                Primarily {row.original.topField}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'n',
        accessorFn: (r) => r.n,
        header: 'Faculty',
        cell: ({ row }) => (
          <div className="flex flex-col items-end">
            <span className="tabular text-foreground text-[13px] font-medium">
              {row.original.n}
            </span>
            {row.original.nWithData < row.original.n ? (
              <span
                className={cn(
                  'tabular mt-0.5 text-[10px]',
                  row.original.lowCoverage
                    ? 'text-amber-600 dark:text-amber-500'
                    : 'text-muted-foreground',
                )}
                title={`${row.original.nWithData} of ${row.original.n} have bibliometric data`}
              >
                {row.original.nWithData} w/ data
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'medianFieldPercentile',
        accessorFn: (r) => r.medianFieldPercentile ?? -1,
        header: 'Median field %',
        cell: ({ row }) => (
          <PercentileBar value={row.original.medianFieldPercentile} />
        ),
      },
      {
        id: 'medianFwci',
        accessorFn: (r) => r.medianFwci ?? -1,
        header: 'Median FWCI',
        cell: ({ row }) => <FwciCell value={row.original.medianFwci} />,
      },
      {
        id: 'nTop5',
        accessorFn: (r) => r.nTop5,
        header: '# Top 5%',
        cell: ({ row }) => (
          <CountCell n={row.original.nTop5} of={row.original.nWithData} />
        ),
      },
      {
        id: 'nTop25',
        accessorFn: (r) => r.nTop25,
        header: '# Top 25%',
        cell: ({ row }) => (
          <CountCell n={row.original.nTop25} of={row.original.nWithData} />
        ),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: schools,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    sortDescFirst: true,
    enableSortingRemoval: false,
  })

  const numericColumns = new Set([
    'n',
    'medianFieldPercentile',
    'medianFwci',
    'nTop5',
    'nTop25',
  ])

  const headerCellBase =
    'bg-muted shadow-[inset_0_-1px_0_var(--color-border)]'

  const sortedRows = table.getRowModel().rows
  const totalColumns = columns.length + 1

  return (
    <table className="w-full">
      <thead>
        <tr>
          {table.getHeaderGroups()[0].headers.map((header) => {
            const isNumeric = numericColumns.has(header.column.id)
            const canSort = header.column.getCanSort()
            const sorted = header.column.getIsSorted()
            return (
              <th
                key={header.id}
                className={cn(
                  headerCellBase,
                  'text-muted-foreground px-4 py-2.5 text-[10px] font-medium tracking-[0.08em] uppercase',
                  isNumeric ? 'text-right' : 'text-left',
                  header.column.id === 'school' && 'pl-6',
                  header.column.id === 'nTop25' && 'pr-6',
                )}
              >
                {canSort ? (
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                    className={cn(
                      'hover:text-foreground inline-flex items-center gap-1 transition-colors',
                      isNumeric && 'flex-row-reverse',
                      sorted && 'text-foreground',
                    )}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    <span className="inline-flex size-3 items-center justify-center">
                      {sorted === 'asc' ? (
                        <ArrowUp className="size-3" />
                      ) : sorted === 'desc' ? (
                        <ArrowDown className="size-3" />
                      ) : null}
                    </span>
                  </button>
                ) : (
                  flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )
                )}
              </th>
            )
          })}
          <th className={cn(headerCellBase, 'w-10')} />
        </tr>
      </thead>
      <tbody>
        {sortedRows.length === 0 ? (
          <tr>
            <td
              colSpan={totalColumns}
              className="text-muted-foreground h-24 text-center text-sm"
            >
              No schools to display.
            </td>
          </tr>
        ) : (
          sortedRows.map((row) => {
            const isExpanded = expanded === row.original.school
            return (
              <Fragment key={row.original.school}>
                <tr
                  onClick={() =>
                    setExpanded(isExpanded ? null : row.original.school)
                  }
                  className={cn(
                    'hover:bg-primary/[0.025] cursor-pointer border-b transition-colors hover:shadow-[inset_3px_0_0_var(--color-primary)]',
                    isExpanded &&
                      'bg-primary/[0.04] shadow-[inset_3px_0_0_var(--color-primary)]',
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const isNumeric = numericColumns.has(cell.column.id)
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-4 py-3 align-middle',
                          isNumeric && 'text-right',
                          cell.column.id === 'school' &&
                            'max-w-[340px] pl-6',
                          cell.column.id === 'nTop25' && 'pr-6',
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    )
                  })}
                  <td className="pr-6 text-right">
                    <ChevronRight
                      className={cn(
                        'text-muted-foreground inline size-3.5 transition-transform',
                        isExpanded && 'rotate-90',
                      )}
                    />
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="bg-primary/[0.02] border-b">
                    <td colSpan={totalColumns} className="px-6 py-4">
                      <SchoolDetail summary={row.original} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })
        )}
      </tbody>
    </table>
  )
}

interface PercentileBarProps {
  value: number | null
}

function PercentileBar({ value }: PercentileBarProps) {
  if (value == null) {
    return (
      <span className="text-muted-foreground/50 tabular text-[11px]">—</span>
    )
  }
  const pct = Math.round(value)
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="tabular text-foreground text-[13px] font-medium">
        {pct}
        <span className="text-muted-foreground ml-0.5 text-[10px]">/100</span>
      </div>
      <div className="bg-muted h-1 w-24 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface FwciCellProps {
  value: number | null
}

function FwciCell({ value }: FwciCellProps) {
  if (value == null) {
    return (
      <span className="text-muted-foreground/50 tabular text-[11px]">—</span>
    )
  }
  const aboveAverage = value >= 1
  return (
    <span
      className={cn(
        'tabular text-[13px]',
        aboveAverage
          ? 'text-foreground font-medium'
          : 'text-muted-foreground',
      )}
      title="Field-Weighted Citation Impact (1.0 = field average)"
    >
      {value.toFixed(2)}
    </span>
  )
}

interface CountCellProps {
  n: number
  of: number
}

function CountCell({ n, of }: CountCellProps) {
  const pct = of > 0 ? Math.round((n / of) * 100) : null
  return (
    <div className="flex flex-col items-end">
      <span
        className={cn(
          'tabular text-[13px]',
          n > 0 ? 'text-foreground font-medium' : 'text-muted-foreground/50',
        )}
      >
        {n}
      </span>
      {n > 0 && pct != null ? (
        <span className="text-muted-foreground tabular mt-0.5 text-[10px]">
          {pct}%
        </span>
      ) : null}
    </div>
  )
}

interface SchoolDetailProps {
  summary: SchoolSummary
}

function SchoolDetail({ summary }: SchoolDetailProps) {
  const setSchool = useAppStore((s) => s.setSchool)
  const setDepartment = useAppStore((s) => s.setDepartment)

  const handleViewAll = () => {
    setSchool(summary.school)
    setDepartment('all')
  }

  return (
    <div className="space-y-4">
      {/* Low-coverage flag — honest about book-scholarship schools */}
      {summary.lowCoverage ? (
        <div className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium tracking-tight text-amber-700 dark:text-amber-500">
          Limited bibliometric coverage — likely book-scholarship fields
        </div>
      ) : null}

      {/* Two-column layout: stars on left, departments drill-down on right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top faculty */}
        {summary.topFaculty.length > 0 ? (
          <div className="min-w-0">
            <SectionLabel>
              Top faculty by global field rank
            </SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {summary.topFaculty.map((tf) => (
                <li
                  key={tf.id}
                  className="flex items-center justify-between gap-3 text-[12px]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground truncate font-medium">
                      {tf.name}
                    </div>
                    <div className="text-muted-foreground truncate text-[11px]">
                      {tf.department}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    {tf.tier ? <TierBadge tier={tf.tier} /> : null}
                    {tf.openalexHIndex != null ? (
                      <span className="text-muted-foreground tabular text-[11px]">
                        h={tf.openalexHIndex}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Department drill-down */}
        {summary.departments.length > 0 ? (
          <div className="min-w-0">
            <SectionLabel>
              Departments ({summary.departments.length})
            </SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {summary.departments.map((d) => (
                <li
                  key={d.department}
                  className="flex items-center justify-between gap-3 text-[12px]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground truncate font-medium">
                      {d.department}
                    </div>
                    <div className="text-muted-foreground tabular text-[10px]">
                      {d.n} faculty
                      {d.noisy ? (
                        <span className="text-amber-600 dark:text-amber-500 ml-1">
                          · small
                        </span>
                      ) : null}
                      {d.lowCoverage && !d.noisy ? (
                        <span className="text-amber-600 dark:text-amber-500 ml-1">
                          · limited data
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    {d.medianFieldPercentile != null ? (
                      <span className="text-foreground tabular text-[11px] font-medium">
                        {Math.round(d.medianFieldPercentile)}
                        <span className="text-muted-foreground ml-0.5 text-[9px]">
                          /100
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50 text-[11px]">
                        —
                      </span>
                    )}
                    {d.nTop5 > 0 ? (
                      <span className="text-primary tabular text-[10px]">
                        {d.nTop5} top-5%
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Bottom action bar */}
      <div className="flex justify-end border-t pt-3">
        <Link
          to="/"
          onClick={handleViewAll}
          className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors"
        >
          View all {summary.n} faculty in Explorer
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  )
}

function TierBadge({ tier }: { tier: HTier }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-tight whitespace-nowrap',
        TIER_CLASSES[tier],
      )}
      title={`Global field h-index tier: ${TIER_LABELS[tier]}`}
    >
      {TIER_LABELS[tier]}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
      {children}
    </div>
  )
}
