# Feature Ideas for SLU Faculty Research Explorer

**Direction**: Make this the tool SLU administrators reach for during hiring committees, program reviews, and provost meetings — and the tool faculty send tenure committees a link to. Every feature should answer a question someone at SLU is already asking in a spreadsheet or PowerPoint.

---

## Showstoppers

High effort, high impact. The kind of features that get this tool embedded in institutional workflows.

### 1. Faculty Impact Summary — Exportable One-Pagers

**What**: Any faculty row can be expanded into a polished, printable one-page research impact summary. Includes their metrics, field percentile context ("73rd percentile among all Computer Science researchers globally"), within-SLU department rank, career trajectory, and a brief AI-generated narrative ("Dr. Park is a mid-career researcher whose citation impact significantly exceeds her field's median..."). Export as PDF or copy as formatted HTML for pasting into documents.

**Why unforgettable**: Tenure packets, annual reviews, and grant applications all require exactly this kind of summary — and right now faculty assemble it by hand from three different websites. This collapses a 45-minute task into one click. Department chairs doing 15 annual reviews would use this every single year.

**Technical challenge**: PDF generation on Cloudflare Workers (either a server-side HTML-to-PDF pipeline or a client-side jsPDF/html2canvas approach). The AI narrative needs to be templated enough to be accurate but flexible enough to not sound robotic. The field percentile context is already in the data — it just needs to be surfaced in plain English.

**Wow moment**: A faculty member preparing for tenure clicks "Export summary," gets a clean PDF with their metrics contextualized against 50,000 researchers in their field, and pastes it directly into their tenure dossier.

### 2. Department Health Dashboard

**What**: A dedicated department-level view designed for chairs and deans. For each department: career stage distribution (pie chart: early/mid/senior based on years since first publication), publication trend line (is output accelerating or declining?), concentration risk ("Dr. Chen accounts for 62% of this department's total citations"), upcoming retirement exposure (faculty with 30+ year careers), and gap analysis vs. peer departments within SLU.

**Why unforgettable**: Department chairs are asked "how is your department doing?" in every program review and budget meeting. Right now they cobble together an answer from memory and vibes. This gives them a real answer with real numbers, in a format they can screenshot for a slide deck.

**Technical challenge**: Career stage classification from `openalexFirstYear` (early: <10 years, mid: 10-20, senior: 20+). Concentration risk is straightforward (Herfindahl index on citations within department). The trend line requires either year-over-year pipeline snapshots or approximation from current data. The gap analysis reuses the existing dept percentile data but presents it comparatively.

**Wow moment**: A dean opens the Chemistry department, sees "Publication Concentration: HIGH — 2 of 11 faculty produce 71% of citations," and immediately has a concrete talking point for the next resource allocation meeting.

### 3. Hiring Impact Simulator

**What**: A sandbox mode where administrators add phantom faculty to model hiring scenarios. Set school, department, field, and approximate metrics. Watch in real-time as department rankings shift, percentiles recalculate, tier distributions change, and the scatter plot adjusts. Model departures too — toggle a faculty member "off" and see what happens to the department. Save scenarios to compare: "Option A: hire two assistant professors" vs. "Option B: hire one senior researcher."

**Why unforgettable**: Every hiring committee argues about priorities in the abstract. This makes the argument concrete and visual. "Hiring a computational biologist with h-index 25 moves us from 6th to 4th among SLU departments in median FWCI" is a fundamentally different conversation than "we think we need someone in comp bio."

**Technical challenge**: Phantom rows must flow through the entire derived-data pipeline — percentile recalculation, tier reassignment, scatter point generation — without touching the real dataset. A "simulation layer" that wraps the data array and re-derives all computed fields. Scenario persistence (localStorage or URL hash). The UI needs to clearly distinguish real vs. phantom faculty (ghost dots, dashed borders in tables).

**Wow moment**: A provost toggles off two retiring faculty, adds one phantom senior hire, and watches the department's median h-index bar barely move — making the case for two hires instead of one replacement.

### 4. Program Review & Accreditation Report Generator

**What**: One-click generation of formatted reports for program reviews, accreditation visits (AACSB, HLC, ABET), and board presentations. Pre-built templates: "School Research Summary" (aggregate metrics, top faculty, field coverage, tier distribution), "Department Self-Study Supplement" (all faculty with metrics, percentile context, trend indicators), "Provost Briefing" (cross-school comparison table, highlights, concerns). Export as PDF with SLU branding or as raw tables for pasting into Word/Slides.

**Why unforgettable**: Accreditation visits consume hundreds of faculty hours assembling exactly this data. A self-study supplement that would take a week to compile becomes a 30-second export. If this tool can save even one accreditation cycle's worth of data-gathering labor, it pays for itself permanently.

**Technical challenge**: Report templates need to be flexible enough for different accreditation bodies but opinionated enough to be useful out of the box. PDF layout with tables, charts, and narrative sections is the hardest part — either server-side Puppeteer or a client-side layout engine. The AI generates the narrative sections; the data tables are deterministic.

**Wow moment**: An AACSB accreditation coordinator exports a "School Research Summary" for Chaifetz Business, gets a 3-page PDF with faculty metrics, field benchmarks, tier distribution charts, and an AI-written research narrative — ready to paste into the self-study document.

---

## Quick Wins

Achievable in focused sprints. Directly useful to the target audience.

### 5. Side-by-Side Faculty Comparison

**What**: Select 2-5 faculty members (checkboxes in the table, or via the AI: "compare Dr. Park and Dr. Rivera") and get a clean comparison view. Overlapping radar charts, a metric-by-metric table with color-coded advantages, and field-context footnotes ("Dr. Park's h-index of 28 is 65th percentile in Biology; Dr. Rivera's 22 is 81st percentile in Philosophy — Rivera is relatively stronger within their field").

**Why unforgettable**: Hiring committees compare candidates. Tenure committees compare against department benchmarks. Department chairs compare faculty during annual reviews. Every one of these conversations currently happens by flipping between tabs or rows in a spreadsheet. A dedicated comparison view with field normalization saves real time and reduces apples-to-oranges errors.

**Technical challenge**: Radar chart normalization across heterogeneous metrics. The field-context footnotes require pulling percentile data for each faculty member's specific field and rendering it as intelligible prose. Multi-select state management in the existing table (checkboxes + a floating comparison bar).

**Wow moment**: A tenure committee pulls up a candidate next to the department median and two comparable peers, sees the radar chart overlap, and immediately understands the candidate's relative strengths without anyone doing manual math.

### 6. URL-Encoded Shareable Views

**What**: Encode the full app state — filters, scatter config, selected faculty, active page — into a compact URL. Every view becomes a link you can paste in email or a report. The AI chat can generate these too: "Here's a link showing all top-1% faculty in Science & Engineering."

**Why unforgettable**: Administrators communicate via email. Right now, sharing a finding means taking a screenshot. A shareable URL turns every insight into a live, interactive link. "Here's our top-tier faculty in Engineering" becomes a URL the provost can click, explore further, and forward to the board.

**Technical challenge**: Serialize the Zustand store to a compressed URL-safe string. Hydrate on page load. Handle stale links gracefully (faculty removed in a data refresh). TanStack Router's search params integration would be the natural approach.

**Wow moment**: A dean pastes a link in a budget request email. The provost clicks it and lands on a pre-filtered view showing exactly the data that supports the request — no screenshots, no attachments.

### 7. "My Department" Bookmarkable Quick-Filter

**What**: A persistent quick-access button (or URL parameter) that instantly filters everything to a single department. Faculty can bookmark `faculty.jacobmaynard.dev/?dept=Chemistry` and always land on their department's view. The schools page, insights page, and scatter all respect this filter. A small "Viewing: Chemistry" banner with a clear button keeps context obvious.

**Why unforgettable**: Most faculty and chairs only care about their own department. Right now they have to re-select their department from the dropdown every visit. A bookmarkable department URL eliminates the most common first interaction and makes the tool feel personalized.

**Technical challenge**: Minimal — read a URL search param on mount, set the Zustand department filter, and persist it across route changes. The banner component is a few lines. The deeper version remembers the user's department in localStorage.

**Wow moment**: A department chair bookmarks their department URL. Every morning they open it and immediately see their faculty's current metrics — zero clicks to get oriented.

### 8. Retention Risk Flags

**What**: Automatically flag faculty who represent high retention risk: top-tier field ranking (top 10% or better) AND mid-career (10-20 years since first pub) AND high recent productivity. These are the researchers peer institutions are most likely to recruit away. Show them with a subtle indicator in the table and aggregate them in the department health view. The AI can explain: "Dr. Kim is top-5% in their field, mid-career, and has 3x the department median FWCI — this is a high-value retention target."

**Why unforgettable**: Universities lose star faculty because no one was paying attention until the counter-offer arrived. This surfaces the people worth proactively retaining — before they're on the market. No other bibliometric tool connects research metrics to institutional strategy this directly.

**Technical challenge**: The classification is rule-based using existing data fields (primaryHTier + career length from openalexFirstYear + FWCI relative to department). The flag is a small icon or badge in the table. The harder part is sensitivity — you don't want the tool publicly labeling people as "flight risks." Consider making this a gated view or export-only feature.

**Wow moment**: A provost opens the retention risk view, sees 14 faculty flagged across the university, and realizes 3 of them are in the same department that just lost its chair. That's an actionable insight no spreadsheet would have surfaced.

### 9. Year-Over-Year Change Indicators

**What**: After each monthly data refresh, compute deltas for key metrics (h-index, citations, FWCI, works count) and show them as small +/- indicators next to the current values in the table. "h-index: 23 (+2 since last refresh)". Aggregate at the department level too: "Chemistry: median h-index 19 → 20 this quarter."

**Why unforgettable**: Static numbers don't tell you direction. A department with median h-index 15 that was 12 last year is a completely different story than one that was 17. Change indicators turn a snapshot into a trend, which is what administrators actually make decisions on.

**Technical challenge**: Requires storing the previous month's data snapshot (a second CSV or a simple JSON of previous values per faculty ID). The pipeline would output a `previous_faculty.csv` alongside the current one, and the client diffs them on load. Storage cost is trivial — it's one extra 200KB file.

**Wow moment**: A dean scans the department health view and immediately spots that the Education department's median FWCI dropped 15% this quarter — prompting a conversation that would have waited until the annual review.

---

## Wild Cards

Higher risk, but would genuinely differentiate this tool.

### 10. Collaboration Network & "Missed Connections"

**What**: Use OpenAlex co-authorship data to build a visual graph of which SLU faculty have actually co-published. Nodes are faculty, edges are shared papers. Then surface "missed connections" — pairs of faculty in different departments with highly overlapping research interests or OpenAlex topics who have never co-authored. The AI suggests introductions: "Dr. Smith (CS) and Dr. Jones (Biology) both work on network analysis and have never co-published."

**Why unforgettable**: Interdisciplinary collaboration is the #1 thing every strategic plan says SLU wants more of, and the #1 thing nobody has good tooling for. This makes hidden connections visible and turns the explorer into a matchmaking service for research partnerships.

**Technical challenge**: Batch-fetching co-authorship data for ~300 OpenAlex-linked faculty. Topic similarity scoring (cosine similarity on OpenAlex concept vectors) filtered against existing edges. Force-directed graph layout with careful tuning. The "missed connections" ranking needs to avoid obvious false positives (a chemist and an English professor both tagged "education" by OpenAlex).

**Wow moment**: A researcher discovers that someone two buildings over has been working on the same problem from a different disciplinary angle — and neither of them knew. They apply for an interdisciplinary grant together.

### 11. Peer Institution Benchmarking

**What**: Pull aggregate metrics for SLU's peer and aspirant institutions from OpenAlex's institutional data. Show how SLU departments compare: "SLU Chemistry median h-index: 19. Peer institution median: 22. Aspirant institution median: 31." Overlay peer institution markers on the scatter chart as reference lines or ghost distributions.

**Why unforgettable**: "How do we compare?" is the question behind every strategic plan, budget request, and accreditation self-study. Right now, answering it requires weeks of manual data collection. If this tool can show SLU's position relative to peers in one click, it becomes indispensable for anyone writing a proposal or strategic document.

**Technical challenge**: OpenAlex's institution-level API provides aggregate stats but not department-level breakdowns — you'd need to query works by institution + field to approximate department-level peer comparison. The peer/aspirant institution list needs to be configurable (every SLU document defines these differently). Caching matters — you don't want to hit OpenAlex on every page load.

**Wow moment**: A department chair opens the peer benchmark view and sees their department plotted against 10 peer institutions. They're above average in FWCI but below in publication count — a clear, data-backed argument for a course release policy to increase output.

### 12. Natural Language Report Builder

**What**: Extend the existing AI chat with a "Generate report" mode. The user describes what they need in plain English — "Write a 2-page research summary for the School of Education for our HLC accreditation visit" or "Give me talking points about our top 20 researchers for the board meeting" — and the AI generates a formatted document using all available data tools. It calls `get_school_summary`, `get_rankings`, `run_analysis` behind the scenes and weaves the results into a coherent narrative with inline metrics.

**Why unforgettable**: The AI chat already has all the tools. This just aims them at the actual output administrators need — not chat messages, but documents. The difference between "ask a question, get an answer" and "describe what you need, get a deliverable" is the difference between a toy and a tool.

**Technical challenge**: The LLM needs careful prompting to produce structured, professional documents rather than chatty responses. Multi-tool orchestration (call 4-5 tools, synthesize into a narrative) pushes context limits. The output needs formatting controls — markdown-to-PDF, or at minimum a "copy as rich text" button that preserves headings and tables for pasting into Word.

**Wow moment**: Typing "Write a research highlight for the Board of Trustees featuring our top 10 faculty by field percentile" and getting a polished two-page document with metrics, context, and narrative — ready to present.

---

## Consider Removing

Sometimes the best feature is subtraction.

- **The metric source toggle (Scholar vs. OpenAlex)** — Faculty and administrators don't understand the difference between these databases and shouldn't need to. Pick the best source per metric (Scholar for h-index where available, OpenAlex for FWCI/works/field data) and present a single unified view. The toggle adds cognitive load for non-technical users. Move the data-source explanation to "About this data."

- **Separate Schools and Insights pages** — A dean comparing schools almost always wants the analytical context (tier distributions, FWCI spread) right there. Consider merging into a single "Analytics" page where school is a filter dimension rather than a separate page. Fewer pages = fewer places to get lost.
