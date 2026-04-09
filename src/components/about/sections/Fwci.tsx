import { Callout, P, Section, Strong } from '../prose'

export function Fwci() {
  return (
    <Section id="fwci" title="What FWCI is">
      <P>
        FWCI is the <Strong>Field-Weighted Citation Impact</Strong>. It is the
        single best cross-field impact-per-paper metric in the explorer.
      </P>
      <P>
        It measures how often this faculty member's recent papers are cited
        relative to the average paper in the same field, in the same year, of
        the same publication type. <Strong>1.0 = field average.</Strong> A value
        of 2.0 means "twice as cited as the typical paper in this field." A
        value of 0.5 means "half as cited."
      </P>
      <P>
        Because FWCI is already field-normalized, you can fairly compare a
        chemist to an economist on impact-per-paper. Raw citation counts (the
        Citations column) cannot be compared the same way, since fields with
        high citation density would dominate.
      </P>
      <Callout>
        FWCI here is the <Strong>2-year</Strong> variant, based on the most
        recent two years of citations. It is a recent-impact measure rather than
        a lifetime one. A useful framing: it answers "are this person's current
        papers landing?" rather than "what is this person's career-long impact?"
      </Callout>
    </Section>
  )
}
