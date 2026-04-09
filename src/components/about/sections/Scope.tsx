import { Bullets, P, Section, Strong } from '../prose'

export function Scope() {
  return (
    <Section id="scope" title="Who's included">
      <P>The 519 rows are filtered to faculty who are:</P>
      <Bullets>
        <li>
          <Strong>Active</Strong> — emeritus faculty are excluded
        </li>
        <li>
          <Strong>US-based</Strong> — SLU-Madrid faculty are excluded
        </li>
        <li>
          <Strong>Hold a Ph.D.</Strong> — Ed.D., DNP, DSW, Pharm.D., and
          J.D.-only faculty are excluded; practitioner-instructor faculty
          without research doctorates are also excluded
        </li>
      </Bullets>
      <P>
        These exclusions are about matching the dataset to its purpose
        (cross-field research-output comparison among research faculty), not a
        judgment on the excluded groups.
      </P>
      <P>
        If a faculty member you expect to find isn't in the explorer, the most
        likely reasons are: (1) their primary degree isn't a Ph.D., (2) they're
        emeritus, or (3) they're affiliated with SLU-Madrid.
      </P>
    </Section>
  )
}
