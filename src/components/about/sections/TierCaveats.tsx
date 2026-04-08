import { Bullets, Code, P, Section, Strong, Subhead } from '../prose'

export function TierCaveats() {
  return (
    <Section id="tier-caveats" title="Reading tiers carefully">
      <P>
        Two subtle issues with how <Code>primary_h_tier</Code> is computed.
        Both are real and worth understanding before quoting tier numbers in
        a report.
      </P>

      <Subhead>1. Different reference populations between faculty</Subhead>
      <P>
        The tier uses <Strong>subfield</Strong> as the reference population
        when the subfield has at least 500 active authors, and falls back to{' '}
        <Strong>field</Strong> otherwise. So:
      </P>
      <Bullets>
        <li>
          Faculty A's "Top 10%" might be vs ~700 Finance researchers
          (subfield-based)
        </li>
        <li>
          Faculty B's "Top 10%" might be vs 5.3M Social Sciences researchers
          (field-based, because their subfield was too small)
        </li>
      </Bullets>
      <P>
        The label is consistent. The denominator is not. Two faculty in the
        same tier may have been ranked against very different reference
        populations.
      </P>

      <Subhead>2. h-index source mixing</Subhead>
      <P>
        When a faculty member has a Google Scholar profile, their{' '}
        <Strong>Scholar h-index</Strong> drives their tier. When they don't,
        their <Strong>OpenAlex h-index</Strong> drives it. Scholar tends to
        count more citations than OpenAlex (Scholar indexes more sources,
        including some lower-quality venues), so Scholar h-indices are
        typically a few points higher than OpenAlex h-indices for the same
        person.
      </P>
      <P>
        Practical effect: faculty with a Scholar profile get a small
        structural advantage in tier assignment compared to faculty whose
        tier is computed from OpenAlex h-index only. Two faculty in the same
        tier may have been computed from different underlying numbers.
      </P>
    </Section>
  )
}
