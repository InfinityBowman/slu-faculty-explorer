import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from 'lucide-react'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { Faculty } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store/appStore'

interface FacultyTableProps {
  rows: Array<Faculty>
}

const fmt = (n: number | null) =>
  n == null ? <span className="text-muted-foreground">—</span> : n.toLocaleString()

export function FacultyTable({ rows }: FacultyTableProps) {
  const metricSource = useAppStore((s) => s.metricSource)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'hIndex', desc: true },
  ])

  const columns = useMemo<Array<ColumnDef<Faculty>>>(() => {
    const isScholar = metricSource === 'scholar'
    const hKey = isScholar ? 'hIndex' : 'openalexHIndex'
    const iKey = isScholar ? 'i10Index' : 'openalexI10Index'
    const cKey = isScholar ? 'citations' : 'openalexCitations'

    return [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => {
          const f = row.original
          const url = isScholar ? f.scholarUrl : null
          return (
            <div className="flex flex-col">
              <span className="font-medium">{f.name}</span>
              <span className="text-muted-foreground text-xs">
                {f.department}
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 inline-flex items-center gap-0.5 underline"
                  >
                    profile <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'school',
        header: 'School',
        cell: ({ row }) => (
          <Badge variant="secondary" className="max-w-[180px] truncate">
            {row.original.school}
          </Badge>
        ),
      },
      {
        id: 'hIndex',
        accessorFn: (f) => f[hKey],
        header: 'h-index',
        cell: ({ getValue }) => fmt(getValue() as number | null),
      },
      {
        id: 'i10Index',
        accessorFn: (f) => f[iKey],
        header: 'i10',
        cell: ({ getValue }) => fmt(getValue() as number | null),
      },
      {
        id: 'citations',
        accessorFn: (f) => f[cKey],
        header: 'Citations',
        cell: ({ getValue }) => fmt(getValue() as number | null),
      },
      {
        id: 'works',
        accessorFn: (f) => f.openalexWorksCount,
        header: 'Works',
        cell: ({ getValue }) => fmt(getValue() as number | null),
      },
      {
        id: 'topic',
        accessorFn: (f) => f.openalexTopTopic,
        header: 'Top topic',
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return v ? (
            <span className="text-muted-foreground line-clamp-1 max-w-[240px] text-xs">
              {v}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
        enableSorting: false,
      },
    ]
  }, [metricSource])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    sortDescFirst: true,
    enableSortingRemoval: false,
  })

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                return (
                  <TableHead key={header.id}>
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="hover:text-foreground inline-flex items-center gap-1"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {sorted === 'asc' ? (
                          <ArrowUp className="size-3" />
                        ) : sorted === 'desc' ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-muted-foreground h-24 text-center"
              >
                No faculty match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
