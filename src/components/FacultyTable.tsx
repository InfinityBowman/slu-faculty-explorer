import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ChevronRight, ExternalLink } from 'lucide-react'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { Faculty, HTier } from '@/lib/types'
import type { PercentileInfo } from '@/hooks/useFaculty'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'

// Higher = better, so desc-sort puts top_1% on top and nulls sink to the bottom.
const TIER_RANK: Record<HTier, number> = {
  'top_1%': 6,
  'top_5%': 5,
  'top_10%': 4,
  'top_25%': 3,
  above_median: 2,
  below_median: 1,
}

const TIER_LABELS: Record<HTier, string> = {
  'top_1%': 'Top 1%',
  'top_5%': 'Top 5%',
  'top_10%': 'Top 10%',
  'top_25%': 'Top 25%',
  above_median: 'Above median',
  below_median: 'Below median',
}

// Monochrome ramp on the SLU primary — strongest fill at top_1%, fading to a
// plain text label at below_median. Keeps the table restrained while still
// reading as a quality scale at a glance.
const TIER_CLASSES: Record<HTier, string> = {
  'top_1%': 'bg-primary text-primary-foreground border-primary shadow-sm',
  'top_5%': 'bg-primary/85 text-primary-foreground border-primary/85',
  'top_10%': 'bg-primary/15 text-primary border-primary/30',
  'top_25%': 'bg-primary/8 text-primary/90 border-primary/15',
  above_median: 'bg-muted text-foreground border-border',
  below_median: 'text-muted-foreground/80 border-transparent',
}

const COLLAPSED_ROW_HEIGHT = 57
const EXPANDED_ROW_HEIGHT = 230

interface FacultyTableProps {
  rows: Array<Faculty>
  percentiles: Map<number, PercentileInfo>
}

interface Row {
  faculty: Faculty
  hIndex: number | null
  i10: number | null
  citations: number | null
  works: number | null
  fwci: number | null
  tier: HTier | null
  percentile: PercentileInfo | null
}

const fmt = (n: number | null) =>
  n == null ? (
    <span className="text-muted-foreground/50">—</span>
  ) : (
    n.toLocaleString()
  )

export function FacultyTable({ rows, percentiles }: FacultyTableProps) {
  const metricSource = useAppStore((s) => s.metricSource)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'hIndex', desc: true },
  ])
  const [expanded, setExpanded] = useState<number | null>(null)

  const tableData = useMemo<Array<Row>>(() => {
    return rows.map((f) => ({
      faculty: f,
      hIndex: metricSource === 'scholar' ? f.hIndex : f.openalexHIndex,
      i10: metricSource === 'scholar' ? f.i10Index : f.openalexI10Index,
      citations:
        metricSource === 'scholar' ? f.citations : f.openalexCitations,
      works: f.openalexWorksCount,
      fwci: f.openalex2yrFwci,
      tier: f.primaryHTier,
      percentile: percentiles.get(f.id) ?? null,
    }))
  }, [rows, metricSource, percentiles])

  const columns = useMemo<Array<ColumnDef<Row>>>(
    () => [
      {
        id: 'name',
        accessorFn: (r) => r.faculty.name,
        header: 'Faculty',
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] leading-tight font-medium">
              {row.original.faculty.name}
            </span>
            <span className="text-muted-foreground mt-0.5 truncate text-[11px]">
              {row.original.faculty.department || '—'}
            </span>
          </div>
        ),
      },
      {
        id: 'school',
        accessorFn: (r) => r.faculty.school,
        header: 'School',
        cell: ({ row }) => (
          <span className="text-muted-foreground line-clamp-2 text-[11px] leading-tight">
            {abbreviateSchool(row.original.faculty.school)}
          </span>
        ),
      },
      {
        id: 'tier',
        // Sort by tier rank (higher = better). Nulls become -1 so they sink
        // to the bottom on a desc sort, matching the default for numeric cols.
        accessorFn: (r) => (r.tier ? TIER_RANK[r.tier] : -1),
        header: 'Field tier',
        cell: ({ row }) => <TierBadge tier={row.original.tier} />,
      },
      {
        id: 'percentile',
        accessorFn: (r) => r.percentile?.percentile ?? -1,
        header: 'Dept percentile',
        cell: ({ row }) => <PercentileBar info={row.original.percentile} />,
      },
      {
        id: 'hIndex',
        accessorFn: (r) => r.hIndex,
        header: 'h-index',
        cell: ({ row }) => (
          <span className="tabular text-foreground text-[13px] font-medium">
            {fmt(row.original.hIndex)}
          </span>
        ),
      },
      {
        id: 'i10',
        accessorFn: (r) => r.i10,
        header: 'i10',
        cell: ({ row }) => (
          <span className="tabular text-muted-foreground text-[12px]">
            {fmt(row.original.i10)}
          </span>
        ),
      },
      {
        id: 'citations',
        accessorFn: (r) => r.citations,
        header: 'Citations',
        cell: ({ row }) => (
          <span className="tabular text-[13px]">
            {fmt(row.original.citations)}
          </span>
        ),
      },
      {
        id: 'fwci',
        accessorFn: (r) => r.fwci,
        header: 'FWCI',
        cell: ({ row }) => <FwciCell value={row.original.fwci} />,
      },
      {
        id: 'works',
        accessorFn: (r) => r.works,
        header: 'Works',
        cell: ({ row }) => (
          <span className="tabular text-muted-foreground text-[12px]">
            {fmt(row.original.works)}
          </span>
        ),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    sortDescFirst: true,
    enableSortingRemoval: false,
  })

  const numericColumns = new Set([
    'tier',
    'percentile',
    'hIndex',
    'i10',
    'citations',
    'fwci',
    'works',
  ])

  const headerCellBase =
    'bg-muted sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--color-border)]'

  const sortedRows = table.getRowModel().rows
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const row = sortedRows[index]
      return expanded === row.original.faculty.id
        ? EXPANDED_ROW_HEIGHT
        : COLLAPSED_ROW_HEIGHT
    },
    overscan: 8,
    getItemKey: (index) => sortedRows[index].original.faculty.id,
  })

  // Force the virtualizer to recompute sizes whenever the expanded row changes
  useEffect(() => {
    virtualizer.measure()
  }, [expanded, virtualizer])

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - virtualItems[virtualItems.length - 1].end
      : 0

  const totalColumns = columns.length + 1

  return (
    <div
      ref={scrollRef}
      className="max-h-[640px] overflow-y-auto"
      style={{ scrollbarGutter: 'stable' }}
    >
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
                    header.column.id === 'name' && 'pl-6',
                    header.column.id === 'works' && 'pr-6',
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
                No faculty match the current filters.
              </td>
            </tr>
          ) : (
            <>
              {paddingTop > 0 ? (
                <tr aria-hidden="true">
                  <td colSpan={totalColumns} style={{ height: paddingTop }} />
                </tr>
              ) : null}
              {virtualItems.map((vi) => {
                const row = sortedRows[vi.index]
                const isExpanded = expanded === row.original.faculty.id
                return (
                  <Fragment key={vi.key}>
                    <tr
                      onClick={() =>
                        setExpanded(
                          isExpanded ? null : row.original.faculty.id,
                        )
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
                              cell.column.id === 'name' &&
                                'max-w-[280px] pl-6',
                              cell.column.id === 'school' && 'max-w-[200px]',
                              cell.column.id === 'works' && 'pr-6',
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
                          <RowDetail row={row.original} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
              {paddingBottom > 0 ? (
                <tr aria-hidden="true">
                  <td
                    colSpan={totalColumns}
                    style={{ height: paddingBottom }}
                  />
                </tr>
              ) : null}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

interface TierBadgeProps {
  tier: HTier | null
}

function TierBadge({ tier }: TierBadgeProps) {
  if (!tier) {
    return <span className="text-muted-foreground/50 tabular text-[11px]">—</span>
  }
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

interface FwciCellProps {
  value: number | null
}

// FWCI is field-normalized: 1.0 = field average. Above 1 is above-average impact;
// below 1 is below-average. Show the number with a subtle emphasis to make
// "above field average" pop without being garish.
function FwciCell({ value }: FwciCellProps) {
  if (value == null) {
    return <span className="text-muted-foreground/50 tabular text-[11px]">—</span>
  }
  const aboveAverage = value >= 1
  return (
    <span
      className={cn(
        'tabular text-[12px]',
        aboveAverage ? 'text-foreground font-medium' : 'text-muted-foreground',
      )}
      title={`Field-Weighted Citation Impact (1.0 = field average)`}
    >
      {value.toFixed(2)}
    </span>
  )
}

interface PercentileBarProps {
  info: PercentileInfo | null
}

function PercentileBar({ info }: PercentileBarProps) {
  if (!info) {
    return <span className="text-muted-foreground/50 tabular text-[11px]">—</span>
  }
  const pct = Math.round(info.percentile)
  const ordinal = ordinalSuffix(pct)
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="tabular text-muted-foreground text-[11px]">
        <span className="text-foreground font-medium">{pct}</span>
        <span className="text-muted-foreground">{ordinal}</span>
        <span className="text-muted-foreground/70 ml-1">
          ({info.rank}/{info.total})
        </span>
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

interface RowDetailProps {
  row: Row
}

function RowDetail({ row }: RowDetailProps) {
  const f = row.faculty
  const yearRange =
    f.openalexFirstYear != null && f.openalexLastYear != null
      ? `${f.openalexFirstYear}–${f.openalexLastYear}`
      : null
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_auto]">
      <div className="space-y-3">
        {f.openalexTopTopic ? (
          <div>
            <div className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
              Top research topic
            </div>
            <div className="mt-1 text-[13px]">{f.openalexTopTopic}</div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-[12px]">
          {yearRange ? (
            <Field label="Active years" value={yearRange} />
          ) : null}
          {f.matchedAffiliation ? (
            <Field label="Affiliation" value={f.matchedAffiliation} />
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {f.scholarUrl ? (
          <EvidenceLink href={f.scholarUrl} label="Google Scholar" />
        ) : null}
        {f.openalexId ? (
          <EvidenceLink
            href={`https://openalex.org/${f.openalexId}`}
            label="OpenAlex"
          />
        ) : null}
        {f.sluUrl ? (
          <EvidenceLink href={f.sluUrl} label="SLU profile" />
        ) : null}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] font-medium tracking-[0.08em] uppercase">
        {label}
      </div>
      <div className="mt-0.5">{value}</div>
    </div>
  )
}

function EvidenceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  )
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return 'th'
  switch (n % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

function abbreviateSchool(school: string): string {
  const abbr: Record<string, string> = {
    'Chaifetz School of Business': 'Chaifetz Business',
    'College for Public Health and Social Justice': 'Public Health & Social Justice',
    'School of Social Work': 'Social Work',
    'School of Science and Engineering': 'Science & Engineering',
    'Doisy College of Health Sciences': 'Doisy Health Sciences',
    'Trudy Busch Valentine School of Nursing': 'Nursing',
    'College of Philosophy and Letters': 'Philosophy & Letters',
    'College of Arts and Sciences': 'Arts & Sciences',
    'School of Education': 'Education',
  }
  return abbr[school] ?? school
}
