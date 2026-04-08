import { Anchor, Code, P, Section, Strong, Subhead } from '../prose'
import { UsageTable } from '../tables'

export function PercentileSystems() {
  return (
    <Section id="percentile-systems" title="Two percentile systems">
      <P>
        The dataset answers two different "is this person productive?"
        questions, with two different reference populations. They are not
        interchangeable.
      </P>

      <Subhead>Within-SLU department percentile</Subhead>
      <P>
        Columns: <Code>dept_h_percentile</Code>,{' '}
        <Code>dept_fwci_percentile</Code>, <Code>dept_works_percentile</Code>.
      </P>
      <P>
        Where this faculty member sits within their SLU department, by
        h-index (or FWCI, or total works). 0 = bottom of the department,
        100 = top. The comparison group is real SLU peers. Best for internal
        allocation, committee reviews, and "where does Dr. X stand against
        the rest of our department" questions.
      </P>
      <P>
        <Strong>Caveat:</Strong> in small departments (n &lt; 5) the
        percentile is mathematically degenerate — everyone tends to be at the
        extremes. See{' '}
        <Anchor href="#small-depts">Small departments</Anchor>.
      </P>

      <Subhead>Global field percentile and tier</Subhead>
      <P>
        Columns: <Code>field_h_percentile</Code>,{' '}
        <Code>subfield_h_percentile</Code>, <Code>primary_h_tier</Code>.
      </P>
      <P>
        Where this faculty member's h-index sits in the global distribution
        of active researchers in their OpenAlex field. The comparison group
        is <Strong>worldwide</Strong> — every author in OpenAlex with at
        least 10 indexed works in the same field. Best for promotion cases,
        external benchmarking, and leadership reports.
      </P>

      <Subhead>Which one to use</Subhead>
      <UsageTable />
    </Section>
  )
}
