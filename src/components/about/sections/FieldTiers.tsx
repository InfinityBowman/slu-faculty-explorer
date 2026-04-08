import { Bullets, Code, P, Section, Strong, Subhead } from '../prose'
import { HirschTable } from '../tables'

export function FieldTiers() {
  return (
    <Section id="field-tiers" title="Field tiers explained">
      <P>
        Each faculty member with an OpenAlex h-index is assigned a tier
        based on where that h-index falls in the global distribution of
        active researchers in their OpenAlex field. Six tiers, in order:
      </P>
      <Bullets>
        <li>
          <Code>top_1%</Code> — h-index in the top 1% of the field
        </li>
        <li>
          <Code>top_5%</Code> — top 5%
        </li>
        <li>
          <Code>top_10%</Code> — top 10%
        </li>
        <li>
          <Code>top_25%</Code> — top 25%
        </li>
        <li>
          <Code>above_median</Code> — above the field median, but below the
          top quartile
        </li>
        <li>
          <Code>below_median</Code> — below the field median
        </li>
      </Bullets>

      <Subhead>The reference population: active researchers only</Subhead>
      <P>
        The reference population is filtered to authors with at least 10
        indexed works (<Code>works_count &gt;= 10</Code>). This filter is
        the load-bearing methodology choice behind every tier in the
        explorer.
      </P>
      <P>
        Without it, OpenAlex's full author population is dominated by
        single-paper authors and grad students whose median h-index is 0–1
        in most fields. Computing percentiles against that population would
        make any tenured faculty look elite. With the filter, the field
        landmarks match published Hirsch and Bornmann benchmarks for active
        research careers:
      </P>
      <HirschTable />
      <P>
        So when you see "Top 10% in field" on a faculty member, the
        comparison is{' '}
        <Strong>against active researchers in the field</Strong>, not against
        everyone OpenAlex has ever indexed. This is the right comparison for
        promotion-style evaluation, but it is more generous than the literal
        English reading of "top 10%."
      </P>
    </Section>
  )
}
