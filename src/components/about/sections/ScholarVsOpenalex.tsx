import { Bullets, Callout, P, Section, Strong, Subhead } from '../prose'

export function ScholarVsOpenalex() {
  return (
    <Section id="scholar-vs-openalex" title="Google Scholar vs OpenAlex">
      <P>
        This tool pulls bibliometric data from two independent sources. They
        measure overlapping things but work very differently, and the same
        faculty member will often have different numbers in each. Neither is
        wrong.
      </P>

      <Subhead>Google Scholar</Subhead>
      <P>
        Google Scholar is Google&apos;s academic search engine. When a
        researcher creates a public Scholar profile, Google tracks their
        publications and computes an h-index, i10-index, and citation count
        automatically.
      </P>
      <Bullets>
        <li>
          <Strong>Broad citation counting.</Strong> Scholar indexes journals,
          conferences, books, dissertations, patents, court opinions, and
          preprints. It tends to produce higher citation counts (and therefore
          higher h-indices) than other sources because it casts a wider net.
        </li>
        <li>
          <Strong>Self-reported profiles.</Strong> Faculty must opt in by
          creating a profile. Only about 35% of SLU&apos;s Ph.D. faculty have
          one, and coverage is heavily skewed by discipline (67% of Business
          faculty vs. 9% of Nursing, 0% of Philosophy &amp; Letters).
        </li>
        <li>
          <Strong>No field normalization.</Strong> Scholar gives you raw counts
          only. It does not tell you whether an h-index of 20 is high or low for
          your field.
        </li>
      </Bullets>

      <Subhead>OpenAlex</Subhead>
      <P>
        OpenAlex is an open bibliometric database maintained by OurResearch (a
        nonprofit). It indexes over 300 million scholarly works and
        automatically builds author profiles by matching publications to
        researchers, so faculty do not need to opt in.
      </P>
      <Bullets>
        <li>
          <Strong>Broader coverage.</Strong> Because profiles are constructed
          automatically, OpenAlex covers about 82% of SLU faculty vs.
          Scholar&apos;s 35%. Combined, one source or the other covers about 80%
          of the roster.
        </li>
        <li>
          <Strong>Structured metadata.</Strong> Every author is tagged with a
          research topic, subfield, and field from a controlled taxonomy. This
          is what lets us compute field-relative benchmarks (percentiles and
          tiers).
        </li>
        <li>
          <Strong>Stricter citation counting.</Strong> OpenAlex indexes fewer
          non-traditional sources than Scholar, so its h-indices and citation
          counts tend to run lower for the same person. A faculty member with
          h=30 on Scholar might show h=22 in OpenAlex. This is not an error; the
          two systems simply count different things.
        </li>
        <li>
          <Strong>Automatic classification can be imprecise.</Strong> OpenAlex
          assigns each author a primary research topic based on their
          publications. A social work faculty member who publishes in psychology
          journals may be classified under Psychology rather than Social Work.
          This affects which global benchmark population they are compared
          against for field percentiles and tiers.
        </li>
      </Bullets>

      <Subhead>Why the numbers differ</Subhead>
      <P>
        Of the 152 faculty who appear in both sources, Scholar&apos;s h-index is
        higher 82% of the time. The gap is typically 1 to 5 points (median of 2).
        This reflects the different scope of what each system counts as a
        citation, not a data quality problem in either source.
      </P>

      <Callout tone="info">
        <Strong>Which should I trust?</Strong> Neither is more &ldquo;correct&rdquo;
        than the other. Scholar tends to be the number faculty recognize because
        it is the one on their own profile. OpenAlex provides the broader
        coverage and the field context needed for cross-discipline comparisons.
        This tool shows both when available.
      </Callout>
    </Section>
  )
}
