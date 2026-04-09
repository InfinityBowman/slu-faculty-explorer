import { Bullets, P, Section, Strong, Subhead } from '../prose'
import { HirschTable } from '../tables'

export function FieldTiers() {
  return (
    <Section id="field-tiers" title="Field tiers explained">
      <P>
        Each faculty member with enough publication data is assigned a Field
        tier based on where their h-index falls in the global distribution of
        active researchers in their field. Six tiers, in order:
      </P>
      <Bullets>
        <li>
          <Strong>Top 1%</Strong> — h-index in the top 1% of the field
        </li>
        <li>
          <Strong>Top 5%</Strong> — top 5%
        </li>
        <li>
          <Strong>Top 10%</Strong> — top 10%
        </li>
        <li>
          <Strong>Top 25%</Strong> — top 25%
        </li>
        <li>
          <Strong>Above median</Strong> — above the field median, but below the
          top quartile
        </li>
        <li>
          <Strong>Below median</Strong> — below the field median
        </li>
      </Bullets>

      <Subhead>The reference population: active researchers only</Subhead>
      <P>
        The reference population is filtered to researchers with at least ten
        indexed publications. Every tier in the explorer depends on this filter,
        so it is worth understanding what it does.
      </P>
      <P>
        Without it, the global researcher population is dominated by
        single-paper authors and graduate students, whose median h-index is 0 or
        1 in most fields. Computing percentiles against that population would
        make any tenured faculty member look elite. With the filter applied, the
        field landmarks line up with published Hirsch and Bornmann benchmarks
        for active research careers:
      </P>
      <HirschTable />
      <P>
        So when you see "Top 10%" on a faculty member, the comparison is{' '}
        <Strong>against active researchers in the field</Strong>, not against
        every person who has ever published a paper. This is the right
        comparison for promotion-style evaluation, and it is more generous than
        what the phrase "top 10%" might suggest at first reading.
      </P>
    </Section>
  )
}
