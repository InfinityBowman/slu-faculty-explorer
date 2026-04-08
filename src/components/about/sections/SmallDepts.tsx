import { Bullets, Code, P, Section } from '../prose'

export function SmallDepts() {
  return (
    <Section id="small-depts" title="Small departments (n<5)">
      <P>
        Reclassification by <Code>classify.py</Code> moves faculty out of
        generic directory buckets ("Office of the Dean", "Teacher Education
        Faculty") into their actual home departments. This is the right call
        for accuracy, but it produced a few department buckets with very few
        people:
      </P>
      <Bullets>
        <li>Herrmann Center</li>
        <li>Office of School and Community Partnerships</li>
        <li>Systematic Theology</li>
      </Bullets>
      <P>
        With <Code>n = 1</Code>, "100th percentile in dept" is mathematically
        degenerate — the lone person is automatically at every extreme.
        Treat dept percentiles in small departments with skepticism.
      </P>
      <P>
        The pre-computed <Code>dept_summary.csv</Code> file has a{' '}
        <Code>noisy</Code> flag for any department with fewer than five
        members. The explorer doesn't yet surface this flag inline, so for
        now you should manually note small-dept rows when reading dept
        percentiles.
      </P>
    </Section>
  )
}
