import { Bullets, P, Section } from '../prose'

export function SmallDepts() {
  return (
    <Section id="small-depts" title="Small departments">
      <P>
        Where possible, faculty are pulled out of generic directory buckets
        like "Office of the Dean" or "Teacher Education Faculty" and placed
        in their actual home departments. This is the right call for
        accuracy, but it produces a few department buckets with very few
        people:
      </P>
      <Bullets>
        <li>Herrmann Center</li>
        <li>Office of School and Community Partnerships</li>
        <li>Systematic Theology</li>
      </Bullets>
      <P>
        When a department has only one or two people, the within-department
        percentile is mathematically degenerate, since the lone person sits
        at every extreme by default. Treat Dept percentile in small
        departments with caution.
      </P>
      <P>
        A future version of the explorer will mark these rows with a "noisy
        department" flag inline. For now you should manually note small-dept
        rows when reading the Dept percentile column.
      </P>
    </Section>
  )
}
