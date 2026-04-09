import { Anchor, Callout, P, Section, Strong } from '../prose'
import { SourceTable } from '../tables'

export function Sources() {
  return (
    <Section id="sources" title="Where the numbers come from">
      <P>Three independent sources are joined per faculty member:</P>
      <SourceTable />
      <P>
        Either Scholar or OpenAlex provides an h-index for{' '}
        <Strong>~84% of faculty</Strong>. The remaining ~16% are explained in{' '}
        <Anchor href="#no-data">The 84 no-data faculty</Anchor>.
      </P>
      <Callout tone="warn">
        <Strong>Coverage gap in the Scholar/OpenAlex toggle.</Strong> The
        Scholar source covers only 35% of faculty. When you flip the explorer's
        Source toggle to Scholar, two-thirds of the rows show no h-index, no
        citations, and no i10. This is not a bug. Those faculty members simply
        do not have a public Google Scholar profile. The OpenAlex view provides
        the broadest coverage.
      </Callout>
    </Section>
  )
}
