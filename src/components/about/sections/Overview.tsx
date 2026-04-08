import { Anchor, Callout, P, Section, Strong } from '../prose'

export function Overview() {
  return (
    <Section id="overview" title="Overview">
      <P>
        This dataset covers <Strong>519 active US Ph.D. faculty</Strong> across
        nine schools and sixty-one departments at Saint Louis University. The
        unit of analysis is the individual faculty member.
      </P>
      <P>
        The goal is to compare research output across SLU departments fairly,
        while controlling for the fact that bibliometric numbers like h-index
        mean very different things in different fields. To support that, the
        dataset combines a per-faculty record (Google Scholar, OpenAlex, SLU
        bio data) with two percentile systems: one against SLU peers in the
        same department, and one against the global population of active
        researchers in the same OpenAlex field.
      </P>
      <Callout>
        Read the{' '}
        <Anchor href="#percentile-systems">two percentile systems</Anchor>{' '}
        section before drawing conclusions from any rank — they answer
        different questions and you should not mix them up.
      </Callout>
    </Section>
  )
}
