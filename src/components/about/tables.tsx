import { Strong } from './prose'
import { cn } from '@/lib/utils'

// Three reference tables embedded in the About page. Kept in one file
// because they share the Th/Td primitives and the same visual treatment;
// each is a thin data + render shell.

function Th({
  align = 'left',
  children,
}: {
  align?: 'left' | 'right'
  children: React.ReactNode
}) {
  return (
    <th
      className={cn(
        'px-3 py-2 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  )
}

function Td({
  align = 'left',
  children,
}: {
  align?: 'left' | 'right'
  children: React.ReactNode
}) {
  return (
    <td
      className={cn(
        'px-3 py-2 text-foreground/90',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </td>
  )
}

// ─── Source provenance ─────────────────────────────────────────────────────

const SOURCE_ROWS: ReadonlyArray<{
  source: string
  purpose: string
  coverage: string
}> = [
  {
    source: 'Google Scholar',
    purpose: 'h-index, i10, citations (lifetime + 5y)',
    coverage: '35% (183 of 519)',
  },
  {
    source: 'OpenAlex',
    purpose: 'h-index, FWCI, works count, top topic, field/subfield',
    coverage: '82% (424 of 519)',
  },
  {
    source: 'SLU bio pages',
    purpose: 'title, education, research interests, contact',
    coverage: '95% (491 of 519)',
  },
]

export function SourceTable() {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-muted text-left text-muted-foreground">
            <Th>Source</Th>
            <Th>What it provides</Th>
            <Th>Coverage</Th>
          </tr>
        </thead>
        <tbody>
          {SOURCE_ROWS.map((r) => (
            <tr key={r.source} className="border-t">
              <Td>
                <Strong>{r.source}</Strong>
              </Td>
              <Td>{r.purpose}</Td>
              <Td>
                <span className="tabular">{r.coverage}</span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Question → column lookup ──────────────────────────────────────────────

const USAGE_ROWS: ReadonlyArray<{ q: string; answer: string }> = [
  {
    q: 'How does Dr. X rank within Finance at SLU?',
    answer: 'Dept percentile',
  },
  {
    q: 'Is Dr. X elite globally for their field?',
    answer: 'Field tier',
  },
  {
    q: "Are Dr. X's recent papers cited more than typical for the field?",
    answer: 'FWCI (above 1.0 means above field average)',
  },
  {
    q: 'Compare an h-index of 23 in Finance to an h-index of 44 in Social Work',
    answer: 'Field tier (for both)',
  },
  {
    q: 'How is this person doing on impact vs productivity vs citations?',
    answer: "The three numbers in the row detail's Within SLU department block",
  },
]

export function UsageTable() {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-muted text-left text-muted-foreground">
            <Th>Question</Th>
            <Th>Where to look</Th>
          </tr>
        </thead>
        <tbody>
          {USAGE_ROWS.map((r) => (
            <tr key={r.q} className="border-t align-top">
              <Td>{r.q}</Td>
              <Td>{r.answer}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Hirsch / Bornmann field landmarks ─────────────────────────────────────

// Published h-index landmarks for active researchers by field. Anchors the
// "top 10%" claims with concrete numbers so readers can sanity-check the tier
// methodology against benchmarks they may have seen elsewhere.
const HIRSCH_ROWS: ReadonlyArray<{
  field: string
  n: string
  p50: number
  p75: number
  p90: number
  p95: number
  p99: number
}> = [
  {
    field: 'Business, Mgmt & Accounting',
    n: '668k',
    p50: 4,
    p75: 8,
    p90: 14,
    p95: 20,
    p99: 37,
  },
  {
    field: 'Economics & Finance',
    n: '665k',
    p50: 4,
    p75: 8,
    p90: 16,
    p95: 23,
    p99: 44,
  },
  {
    field: 'Psychology',
    n: '872k',
    p50: 6,
    p75: 11,
    p90: 20,
    p95: 28,
    p99: 52,
  },
  {
    field: 'Social Sciences',
    n: '5.3M',
    p50: 2,
    p75: 5,
    p90: 10,
    p95: 15,
    p99: 31,
  },
  { field: 'Medicine', n: '10.7M', p50: 7, p75: 14, p90: 24, p95: 33, p99: 59 },
  {
    field: 'Physics & Astronomy',
    n: '1.2M',
    p50: 8,
    p75: 15,
    p90: 28,
    p95: 40,
    p99: 75,
  },
  {
    field: 'Arts & Humanities',
    n: '1.2M',
    p50: 2,
    p75: 5,
    p90: 9,
    p95: 14,
    p99: 28,
  },
]

export function HirschTable() {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-muted text-muted-foreground">
            <Th>Field</Th>
            <Th align="right">n authors</Th>
            <Th align="right">p50</Th>
            <Th align="right">p75</Th>
            <Th align="right">p90</Th>
            <Th align="right">p95</Th>
            <Th align="right">p99</Th>
          </tr>
        </thead>
        <tbody>
          {HIRSCH_ROWS.map((r) => (
            <tr key={r.field} className="border-t">
              <Td>{r.field}</Td>
              <Td align="right">
                <span className="tabular">{r.n}</span>
              </Td>
              <Td align="right">
                <span className="tabular">{r.p50}</span>
              </Td>
              <Td align="right">
                <span className="tabular">{r.p75}</span>
              </Td>
              <Td align="right">
                <span className="tabular">{r.p90}</span>
              </Td>
              <Td align="right">
                <span className="tabular">{r.p95}</span>
              </Td>
              <Td align="right">
                <span className="tabular">{r.p99}</span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
