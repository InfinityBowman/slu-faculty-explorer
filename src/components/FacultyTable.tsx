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
// Generous fixed estimate — actual content varies by which bio fields a row
// has. The virtualizer tolerates over-estimates better than under-estimates
// (under causes scroll jumps when rows reflow), so we err on the high side.
const EXPANDED_ROW_HEIGHT = 360

interface FacultyTableProps {
  rows: Array<Faculty>
}

const CURRENT_YEAR = new Date().getFullYear()

interface Row {
  faculty: Faculty
  hIndex: number | null
  mIndex: number | null
  i10: number | null
  citations: number | null
  works: number | null
  fwci: number | null
  tier: HTier | null
  field: string | null
}

const fmt = (n: number | null) =>
  n == null ? (
    <span className="text-muted-foreground/50">—</span>
  ) : (
    n.toLocaleString()
  )

export function FacultyTable({ rows }: FacultyTableProps) {
  const search = useAppStore((s) => s.search)
  const hasSearch = search.trim().length > 0
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'hIndex', desc: true },
  ])
  const [expanded, setExpanded] = useState<number | null>(null)

  const tableData = useMemo<Array<Row>>(() => {
    return rows.map((f) => {
      const hIndex = f.hIndex ?? f.openalexHIndex
      const years =
        f.openalexFirstYear != null ? CURRENT_YEAR - f.openalexFirstYear : null
      const mIndex =
        hIndex != null && years != null && years > 0 ? hIndex / years : null
      return {
        faculty: f,
        hIndex,
        mIndex,
        i10: f.i10Index ?? f.openalexI10Index,
        citations: f.citations ?? f.openalexCitations,
        works: f.openalexWorksCount,
        fwci: f.openalex2yrFwci,
        tier: f.primaryHTier,
        field: f.openalexField,
      }
    })
  }, [rows])

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
            <span className="mt-0.5 truncate text-[11px] text-muted-foreground">
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
          <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
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
        id: 'field',
        accessorFn: (r) => r.field ?? '',
        header: 'Field',
        cell: ({ row }) => <FieldCell value={row.original.field} />,
      },
      {
        id: 'hIndex',
        accessorFn: (r) => r.hIndex,
        header: 'h-index',
        cell: ({ row }) => (
          <span className="tabular text-[13px] font-medium text-foreground">
            {fmt(row.original.hIndex)}
          </span>
        ),
      },
      {
        id: 'mIndex',
        accessorFn: (r) => r.mIndex,
        header: 'm-index',
        cell: ({ row }) => (
          <span className="tabular text-[12px] text-muted-foreground">
            {row.original.mIndex == null ? (
              <span className="text-muted-foreground/50">—</span>
            ) : (
              row.original.mIndex.toFixed(2)
            )}
          </span>
        ),
      },
      {
        id: 'i10',
        accessorFn: (r) => r.i10,
        header: 'i10',
        cell: ({ row }) => (
          <span className="tabular text-[12px] text-muted-foreground">
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
          <span className="tabular text-[12px] text-muted-foreground">
            {fmt(row.original.works)}
          </span>
        ),
      },
    ],
    [],
  )

  // When the user is searching, rows arrive pre-sorted by Fuse relevance.
  // Applying column sorting would bury the best matches, so we disable it.
  const activeSorting = useMemo<SortingState>(
    () => (hasSearch ? [] : sorting),
    [hasSearch, sorting],
  )

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting: activeSorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    sortDescFirst: true,
    enableSortingRemoval: false,
  })

  const numericColumns = new Set([
    'tier',
    'hIndex',
    'mIndex',
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
                    'px-4 py-2.5 text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase',
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
                        'inline-flex items-center gap-1 transition-colors hover:text-foreground',
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
                className="h-24 text-center text-sm text-muted-foreground"
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
                        setExpanded(isExpanded ? null : row.original.faculty.id)
                      }
                      className={cn(
                        'cursor-pointer border-b transition-colors hover:bg-primary/[0.025] hover:shadow-[inset_3px_0_0_var(--color-primary)]',
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
                              cell.column.id === 'name' && 'max-w-[280px] pl-6',
                              cell.column.id === 'school' && 'max-w-[200px]',
                              cell.column.id === 'field' && 'max-w-[160px]',
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
                            'inline size-3.5 text-muted-foreground transition-transform',
                            isExpanded && 'rotate-90',
                          )}
                        />
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-b bg-primary/[0.02]">
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
    return (
      <span className="tabular text-[11px] text-muted-foreground/50">—</span>
    )
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
    return (
      <span className="tabular text-[11px] text-muted-foreground/50">—</span>
    )
  }
  const aboveAverage = value >= 1
  return (
    <span
      className={cn(
        'tabular text-[12px]',
        aboveAverage ? 'font-medium text-foreground' : 'text-muted-foreground',
      )}
      title={`Field-Weighted Citation Impact (1.0 = field average)`}
    >
      {value.toFixed(2)}
    </span>
  )
}

interface FieldCellProps {
  value: string | null
}

function FieldCell({ value }: FieldCellProps) {
  if (!value) {
    return (
      <span className="tabular text-[11px] text-muted-foreground/50">—</span>
    )
  }
  return (
    <span
      className="line-clamp-2 text-[11px] leading-tight text-muted-foreground"
      title={value}
    >
      {value}
    </span>
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
  const phdLine = formatPhd(f.phdInstitution, f.phdYear)

  const hasDeptPercentiles =
    f.deptHPercentile != null ||
    f.deptFwciPercentile != null ||
    f.deptWorksPercentile != null
  const hasGlobalRank =
    f.fieldHPercentile != null || f.subfieldHPercentile != null

  return (
    // items-start prevents the right column from stretching to match the left
    // column's height — without it, the evidence link flex container fills the
    // full cell vertically and its children stretch into giant boxes.
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-4">
        {/* Title + admin role */}
        {f.bioTitle != null || f.adminRole != null ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {f.bioTitle ? (
              <span className="text-[13px] leading-snug font-medium text-foreground">
                {f.bioTitle}
              </span>
            ) : null}
            {f.adminRole ? (
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium tracking-tight whitespace-nowrap text-primary">
                {f.adminRole}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Research interests blurb — line-clamp keeps virtualizer estimate
            sane; users can click through to the SLU profile for the full text. */}
        {f.researchInterests ? (
          <div>
            <SectionLabel>Research interests</SectionLabel>
            <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-foreground/90">
              {f.researchInterests}
            </p>
          </div>
        ) : null}

        {/* Two metric blocks side by side: within-SLU dept rank + global field rank */}
        {hasDeptPercentiles || hasGlobalRank ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {hasDeptPercentiles ? (
              <MetricBlock title="Within SLU department">
                <div className="grid grid-cols-3 gap-3">
                  <PctStat label="h-index" pct={f.deptHPercentile} />
                  <PctStat label="FWCI" pct={f.deptFwciPercentile} />
                  <PctStat label="Works" pct={f.deptWorksPercentile} />
                </div>
              </MetricBlock>
            ) : null}
            {hasGlobalRank ? (
              <MetricBlock title="Global h-index rank">
                <div className="grid grid-cols-2 gap-3">
                  <PctStat
                    label="Field"
                    sublabel={f.openalexField ?? undefined}
                    pct={f.fieldHPercentile}
                  />
                  <PctStat
                    label="Subfield"
                    sublabel={f.openalexSubfield ?? undefined}
                    pct={f.subfieldHPercentile}
                  />
                </div>
              </MetricBlock>
            ) : null}
          </div>
        ) : null}

        {/* Footnote line of one-line metadata fields */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-3 text-[12px]">
          {phdLine ? <Field label="Ph.D." value={phdLine} /> : null}
          {f.openalexTopTopic ? (
            <Field label="Top topic" value={f.openalexTopTopic} />
          ) : null}
          {yearRange ? <Field label="Active years" value={yearRange} /> : null}
          {f.bioEmail ? (
            <div>
              <SectionLabel>Email</SectionLabel>
              <a
                href={`mailto:${f.bioEmail}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 block text-primary hover:underline"
              >
                {f.bioEmail}
              </a>
            </div>
          ) : null}
          {/* bioOffice intentionally omitted — extract_bio.py over-collects this
              field (often containing email + phone + nav text). Re-enable once
              the extractor is fixed upstream. */}
          {f.matchedAffiliation ? (
            <Field label="Affiliation" value={f.matchedAffiliation} />
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-2 md:items-end">
        {f.scholarUrl ? (
          <EvidenceLink href={f.scholarUrl} label="Google Scholar" />
        ) : null}
        {f.openalexId ? (
          <EvidenceLink
            href={`https://openalex.org/${f.openalexId}`}
            label="OpenAlex"
          />
        ) : null}
        {f.sluUrl ? <EvidenceLink href={f.sluUrl} label="SLU profile" /> : null}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </div>
  )
}

function MetricBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-2">{children}</div>
    </div>
  )
}

interface PctStatProps {
  label: string
  sublabel?: string
  pct: number | null
}

function PctStat({ label, sublabel, pct }: PctStatProps) {
  const rounded = pct == null ? null : Math.round(pct)
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] font-medium tracking-[0.04em] text-muted-foreground uppercase">
        {label}
      </div>
      {rounded == null ? (
        <div className="mt-1 text-[13px] text-muted-foreground/50">—</div>
      ) : (
        // flex + items-baseline keeps "75" and "th" tight on a shared baseline
        // — without it the size differential and tabular-nums width create a
        // visible gap that reads as "75 th" instead of "75th".
        <div className="mt-1 flex items-baseline leading-none text-foreground">
          <span className="tabular text-[18px] font-semibold">{rounded}</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            {ordinalSuffix(rounded)}
          </span>
        </div>
      )}
      {sublabel ? (
        <div
          className="mt-1 truncate text-[10px] text-muted-foreground/70"
          title={sublabel}
        >
          {sublabel}
        </div>
      ) : null}
    </div>
  )
}

function formatPhd(
  institution: string | null,
  year: number | null,
): string | null {
  if (!institution && year == null) return null
  if (institution && year != null) return `${institution} (${year})`
  return institution ?? `${year}`
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-0.5 text-foreground/90">{value}</div>
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
      className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
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
    'College for Public Health and Social Justice':
      'Public Health & Social Justice',
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
