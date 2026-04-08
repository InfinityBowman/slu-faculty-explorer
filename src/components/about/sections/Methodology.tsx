import { Code, P, Section, Strong, Subhead } from '../prose'

export function Methodology() {
  return (
    <Section id="methodology" title="Methodology details">
      <P>
        Smaller items that don't change interpretation but are worth knowing
        if you dig deeper.
      </P>

      <Subhead>Department reclassification</Subhead>
      <P>
        Classifying moves people from generic directory buckets
        into their actual home departments using the bio page's department
        text, or by extracting "Professor of X" from the bio title. About 25
        faculty were reclassified. Side effect: the explorer's "Department" for
        a given person doesn't always match the SLU directory's listed
        department. The bio-page version is more accurate.
      </P>

      <Subhead>OpenAlex name collisions</Subhead>
      <P>
        OpenAlex's author lookup is by name, with an SLU institution filter
        applied. Common names can collide: in one caught case, John James
        (an SLU faculty member with a modest publication record) was matched
        to Michael J. Mack, an h=168 cardiologist with no SLU affiliation.
        The match was rejected by an affiliation cross-check. The{' '}
        <Code>openalex_status</Code> column flags any{' '}
        <Code>rejected_wrong_person_*</Code> cases that were caught. There
        may be undetected collisions in faculty with very common names — if
        a number looks implausibly high, check the OpenAlex profile link.
      </P>

      <Subhead>Career length and m-index</Subhead>
      <P>
        <Code>openalex_first_year</Code> is "first OpenAlex-indexed year,"
        not "first ever published." For senior faculty whose early career
        predates good indexing, this biases career length downward. m-index
        (h-index ÷ career length) is therefore <Strong>not computed</Strong>{' '}
        in the dataset — it would systematically penalize long-tenured
        faculty whose early work is missing from the index.
      </P>

      <Subhead>Computation formulas</Subhead>
      <P>
        Within-SLU dept percentile uses the standard formula:{' '}
        <Code>(% strictly less + 0.5 × % equal)</Code>. Global field
        percentile is computed against an OpenAlex{' '}
        <Code>group_by=summary_stats.h_index</Code> histogram, filtered to
        active researchers (<Code>works_count &gt;= 10</Code>) in the field
        or subfield as described above.
      </P>
    </Section>
  )
}
