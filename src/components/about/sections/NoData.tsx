import { Callout, Code, P, Section, Strong } from '../prose'

export function NoData() {
  return (
    <Section id="no-data" title="The 84 no-data faculty">
      <P>
        About 84 faculty have no Scholar and no OpenAlex h-index. Almost all
        of them are in humanities departments —{' '}
        <Strong>Theology, English, History, Philosophy</Strong>. Their
        primary scholarly output is books, and Scholar and OpenAlex both
        index journal articles heavily but books poorly.
      </P>
      <Callout tone="warn">
        These rows are real "no data," not bugs. The dataset cannot evaluate
        book-scholarship-heavy fields with the metrics it has. If you compare
        departments by mean h-index, humanities departments will look
        underperforming because the measurement instrument doesn't fit them
        — not because of the people.
      </Callout>
      <P>
        If you need to compare humanities departments, you need a different
        instrument (book reviews, university press placements, monograph
        impact, awards). This dataset is honest about being unable to provide
        that.
      </P>
      <P>
        Three additional rows are clinical practitioners who likely don't
        publish: <Code>Minh Kosfeld</Code>, <Code>Angela Cecil</Code>,{' '}
        <Code>Saneta Thurmon</Code>. Treat as honest no-data.
      </P>
    </Section>
  )
}
