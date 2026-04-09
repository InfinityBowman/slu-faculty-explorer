import { Callout, P, Section, Strong } from '../prose'

export function NoData() {
  return (
    <Section id="no-data" title="The 84 no-data faculty">
      <P>
        About 84 faculty have no h-index from either source. Almost all of them
        are in humanities departments such as{' '}
        <Strong>Theology, English, History, and Philosophy</Strong>. Their
        primary scholarly output is books, and the bibliographic sources used
        here index journal articles thoroughly but books poorly.
      </P>
      <Callout tone="warn">
        These rows reflect a real absence of indexed data, not a bug in the
        scrape. The explorer cannot evaluate book-scholarship-heavy fields with
        the metrics it has. If you compare departments by mean h-index,
        humanities departments will look as if they are underperforming when the
        measurement is the actual problem.
      </Callout>
      <P>
        Comparing humanities departments fairly requires a different instrument:
        book reviews, university press placements, monograph impact, and
        disciplinary awards. The explorer does not attempt to capture any of
        these.
      </P>
      <P>
        Three additional rows are clinical-track faculty members who do not
        publish in indexed venues. These should also be read as a genuine
        absence of data rather than a missed lookup.
      </P>
    </Section>
  )
}
