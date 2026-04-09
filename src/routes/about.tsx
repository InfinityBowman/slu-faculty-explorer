import { createFileRoute } from '@tanstack/react-router'
import type { TocItem } from '@/components/about/TocSidebar'
import { TocSidebar } from '@/components/about/TocSidebar'
import { FieldTiers } from '@/components/about/sections/FieldTiers'
import { Fwci } from '@/components/about/sections/Fwci'
import { Methodology } from '@/components/about/sections/Methodology'
import { NoData } from '@/components/about/sections/NoData'
import { Overview } from '@/components/about/sections/Overview'
import { PercentileSystems } from '@/components/about/sections/PercentileSystems'
import { Scope } from '@/components/about/sections/Scope'
import { SmallDepts } from '@/components/about/sections/SmallDepts'
import { ScholarVsOpenalex } from '@/components/about/sections/ScholarVsOpenalex'
import { Sources } from '@/components/about/sections/Sources'
import { TierCaveats } from '@/components/about/sections/TierCaveats'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

const TOC: ReadonlyArray<TocItem> = [
  { id: 'overview', label: 'Overview' },
  { id: 'scope', label: "Who's included" },
  { id: 'sources', label: 'Where the numbers come from' },
  { id: 'scholar-vs-openalex', label: 'Google Scholar vs OpenAlex' },
  { id: 'percentile-systems', label: 'Two percentile systems' },
  { id: 'fwci', label: 'What FWCI is' },
  { id: 'field-tiers', label: 'Field tiers explained' },
  { id: 'no-data', label: 'The 84 no-data faculty' },
  { id: 'tier-caveats', label: 'Reading tiers carefully' },
  { id: 'small-depts', label: 'Small departments (n<5)' },
  { id: 'methodology', label: 'Methodology details' },
]

function AboutPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          About this data
        </h1>
        <p className="text-muted-foreground mt-2 text-[14px]">
          Methodology, sources, and caveats for the SLU Faculty Research
          Explorer.
        </p>
      </div>

      <div className="grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
        <TocSidebar items={TOC} />
        <article className="min-w-0 max-w-[720px] space-y-12">
          <Overview />
          <Scope />
          <Sources />
          <ScholarVsOpenalex />
          <PercentileSystems />
          <Fwci />
          <FieldTiers />
          <NoData />
          <TierCaveats />
          <SmallDepts />
          <Methodology />
        </article>
      </div>
    </main>
  )
}
