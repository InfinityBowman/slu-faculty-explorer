import { Callout, Code, P, Section, Strong } from '../prose'

export function Fwci() {
  return (
    <Section id="fwci" title="What FWCI is">
      <P>
        FWCI is the <Strong>Field-Weighted Citation Impact</Strong>, computed
        by OpenAlex. It is the single best cross-field impact-per-paper
        metric in the dataset.
      </P>
      <P>
        It measures how often this faculty member's recent papers are cited
        relative to the average paper in the same field, in the same year,
        of the same publication type. <Strong>1.0 = field average.</Strong>{' '}
        A value of 2.0 means "twice as cited as the typical paper in this
        field." A value of 0.5 means "half as cited."
      </P>
      <P>
        Because FWCI is already field-normalized, you can fairly compare a
        chemist to an economist on impact-per-paper without raw citation
        counts unfairly favoring fields with high citation density. Raw
        citation counts (the <Code>citations</Code> column) cannot be
        compared across fields without this normalization.
      </P>
      <Callout>
        FWCI in this dataset is the <Strong>2-year</Strong> variant — based
        on the most recent two years of citations. It is a recent-impact
        measure, not lifetime impact. Treat it as "are this person's current
        papers landing?" rather than "what is this person's career-long
        impact?"
      </Callout>
    </Section>
  )
}
