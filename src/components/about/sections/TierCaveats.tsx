import { Bullets, P, Section, Strong, Subhead } from '../prose'

export function TierCaveats() {
  return (
    <Section id="tier-caveats" title="Reading tiers carefully">
      <P>
        Two subtle issues with how the Field tier is computed. Both are real and
        worth understanding before quoting tier numbers in a report.
      </P>

      <Subhead>1. Different reference populations between faculty</Subhead>
      <P>
        The tier uses <Strong>subfield</Strong> as the reference population when
        the subfield has at least 500 active researchers worldwide, and falls
        back to the broader <Strong>field</Strong> otherwise. So:
      </P>
      <Bullets>
        <li>
          Faculty A's "Top 10%" might be measured against ~700 Finance
          researchers (subfield-based)
        </li>
        <li>
          Faculty B's "Top 10%" might be measured against 5.3M Social Sciences
          researchers (field-based, because their subfield was too small to use
          on its own)
        </li>
      </Bullets>
      <P>
        Two faculty members in the same tier may have been ranked against very
        different reference populations, even though their tier labels look
        identical. The denominator behind a "Top 10%" rating is not always the
        same denominator.
      </P>

      <Subhead>2. The h-index source can vary by faculty member</Subhead>
      <P>
        When a faculty member has a Google Scholar profile, their{' '}
        <Strong>Scholar h-index</Strong> drives their tier. When they don't,
        their <Strong>OpenAlex h-index</Strong> drives it. Scholar tends to
        count more citations than OpenAlex (Scholar indexes more sources,
        including some lower-quality venues), so Scholar h-indices are typically
        a few points higher than OpenAlex h-indices for the same person.
      </P>
      <P>
        Practical effect: faculty with a Scholar profile get a small structural
        advantage in tier assignment compared to faculty whose tier is based on
        OpenAlex alone. Two faculty in the same tier may have been computed from
        different underlying numbers.
      </P>
    </Section>
  )
}
