import { Anchor, P, Section, Strong, Subhead } from '../prose'
import { UsageTable } from '../tables'

export function PercentileSystems() {
  return (
    <Section id="percentile-systems" title="Two percentile systems">
      <P>
        The explorer answers two different "is this person productive?"
        questions, with two different comparison groups. They are not
        interchangeable.
      </P>

      <Subhead>Within SLU department</Subhead>
      <P>
        The <Strong>Dept percentile</Strong> column on the table, along with the
        three side-by-side numbers in the row detail's "Within SLU department"
        block, all answer the same question: where does this person sit compared
        to their SLU peers in the same department? A value of 0 means the bottom
        of the department and 100 means the top. Three versions are shown (by
        h-index, by FWCI, and by publication count) because a faculty member can
        be productive on one measure and average on another.
      </P>
      <P>
        Best for internal allocation, committee reviews, and "where does Dr. X
        stand against the rest of our department" questions.
      </P>
      <P>
        <Strong>Caveat:</Strong> in small departments (under five people) the
        percentile is mathematically degenerate, since everyone tends to land at
        the extremes. See <Anchor href="#small-depts">Small departments</Anchor>
        .
      </P>

      <Subhead>Global field tier</Subhead>
      <P>
        The <Strong>Field tier</Strong> column on the table, and the "Global
        h-index rank" block in the row detail, answer a different question:
        where does this person's h-index sit compared to{' '}
        <Strong>active researchers worldwide</Strong> in the same field? Best
        for promotion cases, external benchmarking, and leadership reports.
      </P>

      <Subhead>Which one to use</Subhead>
      <UsageTable />
    </Section>
  )
}
