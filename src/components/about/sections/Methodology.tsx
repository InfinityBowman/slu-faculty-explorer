import { P, Section, Strong, Subhead } from '../prose'

export function Methodology() {
  return (
    <Section id="methodology" title="Methodology details">
      <P>
        Smaller items that don't change interpretation but are worth knowing
        if you dig deeper.
      </P>

      <Subhead>Department reclassification</Subhead>
      <P>
        Faculty are pulled out of generic directory buckets like "Office of
        the Dean" or "Teacher Education Faculty" and placed in their actual
        home departments using the department text on their bio page (or, as
        a fallback, by extracting "Professor of X" from their title). About
        25 faculty were reclassified this way. <Strong>Side effect:</Strong>{' '}
        the Department shown in the explorer doesn't always match the
        Department listed on the SLU directory page for the same person.
        The explorer's version is the more accurate of the two.
      </P>

      <Subhead>Possible name collisions</Subhead>
      <P>
        Faculty are matched to their OpenAlex author record by name, with an
        SLU institution filter applied. Common names can collide: in one
        caught case, an SLU faculty member with a modest publication record
        was being matched to a high-h-index cardiologist at a different
        institution. The match was rejected by an affiliation cross-check.
        We've also caught and filtered other miss-matches the same way.
      </P>
      <P>
        There may still be undetected collisions in faculty with very common
        names. If a number looks implausibly high for someone you know, open
        the OpenAlex profile link in their row detail and confirm it's the
        right person.
      </P>

      <Subhead>Career length and m-index</Subhead>
      <P>
        The "Active years" range shown for each faculty member is the first
        and last year of their <Strong>indexed</Strong> publications, not
        their actual first publication ever. For senior faculty whose early
        career predates good electronic indexing, this biases career length
        downward.
      </P>
      <P>
        For this reason, the explorer does not show m-index (h-index divided
        by career length). An m-index computed from indexed-only career
        length would systematically penalize long-tenured faculty whose
        early work is missing from the index.
      </P>
    </Section>
  )
}
