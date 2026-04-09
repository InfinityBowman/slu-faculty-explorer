# SLU Faculty Research Metrics — Design Doc

Reference for the SLU faculty research-metrics dataset. Captures what's in the
data, where each column came from, and how to reproduce or extend it.

## 1. Goal

A CSV that lets us **compare research output across SLU departments fairly**,
controlling for the fact that bibliometric numbers like h-index mean very
different things in different fields. The unit of analysis is the individual
faculty member.

## 2. Final scope

**519 active US Ph.D. faculty** across 9 schools / 61 departments.

| School | n |
|---|---|
| College of Arts and Sciences | 242 |
| School of Science and Engineering | 96 |
| Chaifetz School of Business | 51 |
| Doisy College of Health Sciences | 36 |
| College for Public Health and Social Justice | 27 |
| Trudy Busch Valentine School of Nursing | 23 |
| School of Education | 20 |
| School of Social Work | 18 |
| College of Philosophy and Letters | 6 |

**Filter applied:** Active (not emeritus), US-based (excludes SLU-Madrid),
holds a Ph.D. (Ed.D. / DNP / DSW / Pharm.D. / J.D.-only excluded — they're in
`directory.csv` if needed). Practitioner-instructor faculty without research
doctorates are excluded.

## 3. Deliverables

| File | Description |
|---|---|
| `results.csv` | **The dataset.** 519 rows × 44 columns. |
| `dept_summary.csv` | 61 departments with median/mean/max h, FWCI, citations, n_with_scholar, n_with_openalex, noisy flag (n<5). |
| `field_benchmarks.csv` | 144 rows: per-field and per-subfield h-index landmarks (p25/p50/p75/p90/p95/p99) with author counts. Audit trail for the global percentile claims. |
| `directory.csv` | Raw output of the SLU directory scraper — superset of `results.csv` (includes Ed.D./DNP/etc). |
| `targets.md` | Source-of-truth list of names being scraped, organized by school > department. |
| `openalex_topics.csv` | Cached OpenAlex taxonomy: 4516 topics with field/subfield/domain hierarchy. |

## 4. Data sources

| Source | Purpose | Cost |
|---|---|---|
| **SLU directory pages** (`/{school}/faculty/index.php` etc.) | Names, departments, bio URLs | free |
| **SLU faculty bio pages** | Title, education, email, office, research interests | free |
| **Brave Search API** | Find each faculty's Google Scholar profile URL | 2,000/mo free, ~120 used |
| **Google Scholar profile pages** | h-index, i10, citations (all + 5y) | free direct fetch |
| **OpenAlex API** | Works count, FWCI, topic, h-index, year-by-year | free, no key |
| **OpenAlex `/topics` + `/authors` + `group_by`** | Field/subfield benchmarks for percentile scoring | free |
| **SerpAPI** (legacy) | Original Scholar search engine, kept as fallback in `scrape.py` | 250/mo free |

Coverage outcome:
- Scholar h-index: 183/519 (35%)
- OpenAlex h-index: 424/519 (82%)
- Either h-index: ~84%
- Bio data: 491/519 (95%)
- Field benchmarks: 424/519 (82% — same set as OpenAlex)

## 5. Schema — every column with provenance

### Identity
| Column | Source | Notes |
|---|---|---|
| `id` | `update_targets.py` | Sequential int per faculty. Stable across runs. |
| `name` | `targets.md` (cleaned by `clean_display_name`) | Strips clinical certs and degree suffixes — see §10. |
| `school` | `targets.md` | One of the 9 SLU schools. |
| `department` | `targets.md`, then `classify.py` | Some rows reclassified from generic buckets ("Office of the Dean", "Teacher Education Faculty") to their real home department using `bio_department` or `bio_title`. |
| `slu_url` | `extract_directory.py` → `add_slu_urls.py` | Faculty bio page on slu.edu. |

### Google Scholar (`scrape.py` + `retry.py`)
| Column | Notes |
|---|---|
| `scholar_id` | Profile ID from `citations?user=...` |
| `scholar_url` | Full Scholar profile URL |
| `matched_affiliation` | Affiliation string from the matched profile — used to validate it's the SLU person, not a name collision. Kept as a breadcrumb on `wrong_person` rejections. |
| `h_index`, `h_index_5y` | Parsed from `gsc_rsb_st` table on the profile HTML |
| `i10_index`, `i10_index_5y` | Same |
| `citations`, `citations_5y` | Same |
| `status` | `found` / `recovered` / `wrong_person` / `retry_no_candidates` / `retry_no_slu_in_N_candidates` / `no_search_results` / etc. |

### OpenAlex (`openalex.py`)
| Column | Notes |
|---|---|
| `openalex_id` | e.g., `A5039460905`. Looked up by name + SLU institution filter, fallback to name-only search with affiliation verification. |
| `openalex_works_count` | Total publications |
| `openalex_citations` | Total citations (OpenAlex's count, often higher than Scholar's) |
| `openalex_h_index` | OpenAlex-computed |
| `openalex_i10_index` | Same |
| `openalex_2yr_fwci` | **Field-Weighted Citation Impact** — already field-normalized by OpenAlex's topic classifier. 1.0 = field average. The single best cross-field "impact per paper" metric we have. |
| `openalex_top_topic` | Display name of the author's most-cited topic (e.g., "Financial Markets and Investment Strategies") |
| `openalex_first_year` | Earliest publication year |
| `openalex_last_year` | Most recent publication year |
| `openalex_status` | `found` / `not_found` / `ambiguous_multiple_slu` / `rejected_wrong_person_*` / `error` |

### SLU bio page (`extract_bio.py`)
| Column | Notes |
|---|---|
| `bio_title` | Rank + endowed/admin titles from the H1 area (e.g., "Edward Jones Professor; Professor") |
| `bio_department` | Department text shown on the bio page. **More authoritative than `targets.md` department** — used by `classify.py` to fix mis-bucketed rows. |
| `bio_email`, `bio_phone`, `bio_office` | Pulled by regex from full page text |
| `phd_institution`, `phd_year` | Parsed from the Education section's Ph.D. line (line-by-line, not joined-text — see §10 DQ1). |
| `research_interests` | Free-text blob from the Research Interests section |
| `bio_status` | `found` / `no_url` / `fetch_error` / `parse_error` |

### Within-SLU computed (`compute.py`)
| Column | Notes |
|---|---|
| `dept_h_percentile` | Faculty's h-index percentile within their (final, post-classify) department. 0–100. Standard formula: % strictly less + 0.5 × % equal. |
| `dept_fwci_percentile` | Same for `openalex_2yr_fwci` |
| `dept_works_percentile` | Same for `openalex_works_count` |

### Classification (`classify.py`)
| Column | Notes |
|---|---|
| `admin_role` | One of: `Dean` / `Associate Dean` / `Chair` / `Director` / `Coordinator` / `""`. Extracted from `bio_title` with priority order. Carefully distinguishes "Department Chair" (admin) from "Endowed Chair in X" (titled professorship). |

### Global field benchmarks (`field_benchmark.py`)
| Column | Notes |
|---|---|
| `openalex_domain` | OpenAlex's top-level domain (4 values: Physical / Life / Health / Social Sciences). Mapped from `openalex_top_topic` via cached topic taxonomy. |
| `openalex_field` | One of OpenAlex's ~26 fields (Economics, Psychology, Medicine, …) |
| `openalex_subfield` | One of OpenAlex's ~252 subfields |
| `field_h_percentile` | Where this faculty's h sits in the **global** h-index distribution of active researchers in their OpenAlex field. 0–100. |
| `subfield_h_percentile` | Same, for subfield. |
| `primary_h_tier` | Human-readable: `top_1%` / `top_5%` / `top_10%` / `top_25%` / `above_median` / `below_median`. Uses subfield when its sample is ≥ 500 active authors, else falls back to field. |

**Important methodology note**: the "active researcher" filter is `works_count >= 10`. Without it, OpenAlex's full author population is dominated by single-paper authors and grad students (median h-index = 0–1 in most fields), which makes any tenured faculty look elite. With the filter, the field landmarks match published Hirsch / Bornmann benchmarks, e.g.:

| Field | n_authors | p50 | p75 | p90 | p95 | p99 |
|---|---|---|---|---|---|---|
| Business, Mgmt & Accounting | 668k | 4 | 8 | 14 | 20 | 37 |
| Economics & Finance | 665k | 4 | 8 | 16 | 23 | 44 |
| Psychology | 872k | 6 | 11 | 20 | 28 | 52 |
| Social Sciences | 5.3M | 2 | 5 | 10 | 15 | 31 |
| Medicine | 10.7M | 7 | 14 | 24 | 33 | 59 |
| Physics & Astronomy | 1.2M | 8 | 15 | 28 | 40 | 75 |
| Arts & Humanities | 1.2M | 2 | 5 | 9 | 14 | 28 |

The `field_benchmarks.csv` file has all 24 fields and 120 subfields with full landmarks + author counts as the audit trail.

## 6. The two relative-score systems

The dataset answers two different "is this person good?" questions:

### Within-SLU comparison (for internal allocation, dept-level reviews)
- **`dept_h_percentile`** — where you sit in your SLU department
- **`dept_fwci_percentile`**, **`dept_works_percentile`** — same for impact and productivity
- Uses real SLU peers as the comparison group
- Caveat: noisy for departments with n < 5 (flagged in `dept_summary.csv`)

### Global comparison (for promotion cases, external benchmarking, leadership reports)
- **`field_h_percentile`** — vs all active researchers in your OpenAlex field worldwide
- **`subfield_h_percentile`** — finer comparison within your subfield
- **`primary_h_tier`** — human-readable rollup; uses subfield if reliable, else field
- **`openalex_2yr_fwci`** — already field-normalized impact-per-paper

### Suggested usage by question
| Question | Best column |
|---|---|
| "How does Dr. X rank within Finance at SLU?" | `dept_h_percentile` |
| "Is Dr. X elite globally for their field?" | `primary_h_tier` |
| "Are Dr. X's recent papers cited more than typical for the field?" | `openalex_2yr_fwci` (>1.0 = above average) |
| "Compare Bidisha's h=23 in Finance to Brandy's h=44 in Social Work" | both `field_h_percentile` |
| "How does Chaifetz as a school stack up?" | aggregate `field_h_percentile` over Chaifetz rows |
| "Who are the dean-track researchers?" | filter `admin_role in ('Dean','Associate Dean')` |

## 7. Architecture / scripts

```
SLU directory pages
       │
       ▼
extract_directory.py ─────────► directory.csv
       │
       ▼
update_targets.py ────────────► targets.md  (cleaned names, stable IDs)
       │
       ▼
add_slu_urls.py ──────────────► (joins slu_url onto results.csv)
       │
       ▼
scrape.py (Brave/SerpAPI) ────► Scholar profile URL
       │                              │
       │                              ▼
       │                        fetch profile HTML
       │                              │
       │                              ▼
       │                       parse h-index, citations
       │
       ├─► retry.py ──────────► looser-query recovery pass for failures
       │
       ├─► openalex.py ───────► OpenAlex author lookup + metrics
       │
       └─► extract_bio.py ────► title, email, phd, research interests
                      │
                      ▼
                 results.csv (master)
                      │
                      ├─► classify.py ─────────► admin_role, dept reclassification
                      │
                      ├─► compute.py ──────────► within-dept percentiles + dept_summary.csv
                      │
                      └─► field_benchmark.py ──► global field/subfield percentiles + tiers
                                                + field_benchmarks.csv
```

| Script | Role |
|---|---|
| `extract_directory.py` | Scrapes the 9 schools' `/faculty/index.php` and `/leadership.php` pages → `directory.csv`. Recognizes degree suffixes, emeritus markers, Madrid affiliations. |
| `update_targets.py` | Filters `directory.csv` to active US Ph.D., dedups, appends new rows to `targets.md` with sequential IDs. Contains the `clean_display_name` regex (see §10). |
| `add_slu_urls.py` | Backfills `slu_url` into `results.csv` by joining on normalized name. |
| `scrape.py` | Brave/SerpAPI search → Scholar profile lookup → fetch profile HTML → parse h-index. Resume-safe (skips IDs already in results.csv). |
| `retry.py` | Looser-query Scholar lookup for rows where `status != "found"`. Adds department-disambiguator to query. Has `--names` filter for targeted retries. |
| `openalex.py` | OpenAlex author lookup with SLU institution filter + name-only fallback. Picks best of multiple SLU matches by works count (only flags `ambiguous_multiple_slu` if runner-up has ≥half best's works). |
| `extract_bio.py` | Fetches and parses SLU bio pages → bio_title, bio_email, phd_institution, etc. |
| `classify.py` | Extracts `admin_role` from `bio_title`; reclassifies generic department buckets ("Office of the Dean", etc.) using `bio_department` (preferred) or `bio_title` "Professor of X" extraction (fallback); applies known dept-name aliases. |
| `compute.py` | Within-dept percentiles → `results.csv`; dept aggregates → `dept_summary.csv`. |
| `field_benchmark.py` | Fetches OpenAlex topic taxonomy → maps faculty to field/subfield → builds global h-index histograms via `group_by=summary_stats.h_index` (filtered to `works_count>=10`) → computes `field_h_percentile`, `subfield_h_percentile`, `primary_h_tier` → writes `field_benchmarks.csv`. |
| `update.py` | **Monthly update orchestrator.** Snapshots results.csv, refreshes Scholar + OpenAlex metrics by known ID (no re-search), shells out to existing scripts for new faculty and recomputation, diffs old vs new, produces flagged change report. |
| `enrich_degrees.py` | One-off: fetches bio H1 to detect Ph.D./Ed.D./DNP/etc. for rows where the directory link text didn't include a degree. |

## 8. Run order (reproducing from scratch)

```bash
# 1. Pull SLU directory + bios
uv run python extract_directory.py
uv run python update_targets.py

# 2. Add slu_urls (one-time data join)
uv run python add_slu_urls.py

# 3. Scholar scrape (Brave is default; resumes on crash)
uv run python scrape.py

# 4. Recovery pass for Scholar failures
uv run python retry.py

# 5. OpenAlex enrichment (catches no-Scholar faculty)
uv run python openalex.py

# 6. SLU bio extraction
uv run python extract_bio.py

# 7. Data cleanup: admin_role + dept reclassification
uv run python classify.py

# 8. Within-SLU percentiles + dept summary
uv run python compute.py

# 9. Global field benchmarks (writes openalex_topics.csv on first run)
uv run python field_benchmark.py
```

Each step is idempotent and resume-safe. Targeted re-runs are supported via
`--names "Name1" "Name2"` on `scrape.py`, `retry.py`, `openalex.py`, and
`extract_bio.py`.

## 8b. Monthly updates (diff-based pipeline)

```bash
# Dry run — see what would be refreshed without fetching
uv run python update.py --dry-run

# Full metric refresh (Scholar + OpenAlex) with change report
uv run python update.py

# Also re-scrape SLU directory for new hires / departures
uv run python update.py --with-directory

# Restore pre-update snapshot if something went wrong
uv run python update.py --rollback
```

`update.py` orchestrates the full pipeline with two safety properties:

1. **Refresh by ID, not by search.** Existing Scholar and OpenAlex matches are
   updated by re-fetching the known profile/author ID. No re-searching means no
   risk of wrong-person regressions (the DQ8-style problem). Only faculty who
   don't yet have a match go through the search path.

2. **Diff-based change report.** Before updating, the current `results.csv` is
   snapshotted to `snapshots/results_YYYY-MM-DD.csv`. After the pipeline runs,
   a column-by-column diff produces `changes_YYYY-MM-DD.csv` with severity flags:
   - **high** — Scholar/OpenAlex ID changed to a different value (possible wrong-person swap)
   - **medium** — status regression or h-index jump > 10 (worth reviewing)
   - **info** — new/departed faculty
   - **ok** — normal metric movement

Pipeline phases:
1. Snapshot `results.csv`
2. (Optional) Re-scrape SLU directory + update `targets.md`
3. Scholar refresh — re-fetch profile pages for known `scholar_id`s
4. OpenAlex refresh — re-fetch `/authors/{id}` for known `openalex_id`s
5. New faculty — `scrape.py` + `retry.py` + `openalex.py` + `extract_bio.py`
6. Recompute — `classify.py` + `compute.py` + `field_benchmark.py`
7. Diff old vs new, generate flagged change report

## 9. Decisions made

- **Filter** = active, US-based, Ph.D.-holding faculty. Excludes emeritus, Madrid, Ed.D./DNP/DSW/Pharm.D./J.D.-only.
- **Search step is the hard part** — Google walls Scholar's `search_authors` endpoint behind sign-in; `scholarly` library is broken; only third-party search APIs work for the search step.
- **Profile fetch is free** — public Scholar profiles render h-index in plain HTML.
- **Brave Search is the primary search engine** — 2,000/mo free, ~120 used in this build. SerpAPI kept as fallback.
- **OpenAlex** is the parallel data source — gets us field normalization (FWCI), broader coverage (catches ~half of the no-Scholar faculty), and global field benchmarks.
- **Within-dept percentile** for SLU-internal comparisons; **global field percentile** for external comparisons. Both computed; both kept.
- **Field benchmark population is filtered to `works_count >= 10`** — without this filter the medians collapse to 0–1 because OpenAlex includes every author of every paper. With the filter, the landmarks match published Hirsch benchmarks.
- **`results.csv` is committed**, not gitignored — it's the deliverable.
- **HTML report dropped** — CSV is the deliverable; analysts consume it directly.
- **Classify before compute** — `classify.py` reclassifies generic dept labels so the percentile groupings in `compute.py` use real peer departments.
- **Nursing "Faculty" left as one bucket** — Trudy Busch Valentine SON genuinely has one faculty pool, not sub-departments. Same for SSW.
- **Endowed-chair vs department-chair distinguished** — `classify.py`'s admin_role logic walks `bio_title` clauses split on `;,` and excludes `Chair in X` / `Chair of X` / named-chair patterns from the admin Chair tier.

## 10. Data quality fixes applied (not just open issues)

| ID | Issue | Fix |
|---|---|---|
| **DQ1** | `phd_institution` over-greedy parse: "The State University of New York at Buffalo M" (the M was from the next-line `M.A. in Economics`) | Rewrote `parse_education` in `extract_bio.py` to operate on lines, not joined text |
| **DQ2** | P&L 0% Scholar coverage | Investigated — small school, mostly humanities (book authors), expected |
| **DQ3** | Many Scholar failures | Built `retry.py` with department-disambiguator query |
| **DQ4** | OpenAlex `ambiguous_multiple_slu` over-flagged | Picks best by works count; only flags ambiguous if runner-up has ≥half the best's works |
| **DQ5** | 12 dirty names with embedded clinical credentials (`Crystal Botkin, Ph.D., M.P.H., CNMT, PET, FSNMMI-TS`) | Rewrote `clean_display_name` in `update_targets.py` to truncate at first `, <terminal degree>` rather than enumerate every cert. Recovered 9/12 after re-running scrape + openalex. |
| **DQ6** | Generic dept-label buckets diluting percentile groupings (SSE "Office of the Dean" bucket pooled chairs from Chemistry, Biology, etc.) | Built `classify.py` to reclassify using `bio_department` (preferred) or `bio_title` "Professor of X" extraction. 25 rows reclassified. |
| **DQ7** | Spelling variants ("Education Studies" vs "Educational Studies") creating tiny separate buckets | Added `DEPT_ALIASES` map in `classify.py`. 3 rows fixed. |
| **DQ8** | John James matched to Michael J. Mack (h=168 cardiologist) by OpenAlex search | Cleared bogus enrichment; row marked `openalex_status = rejected_wrong_person_michael_mack`. |
| **DQ9** | Schools section header `## School Name (96 new)` broke the targets parser | Broadened `SCHOOL_RE` in `scrape.py` to strip any parenthetical after school name |
| **DQ10** | Hyphenated names truncated ("Tae-Hyuk (Ted) Ahn" → "Tae") | Rewrote `clean_display_name` dash regex to require whitespace on both sides |
| **DQ11** | "Thomas J. Finan" → "ThomaFinan" (S.J. degree pattern matched mid-word) | Anchored degree patterns to end-of-string with `\b` boundaries |
| **DQ12** | Bio-fetch silently truncating columns added by other scripts | Fixed `extract_bio.py`, `openalex.py`, `retry.py` to preserve existing fieldnames instead of using a hard-coded list |

## 11. Known issues / caveats

- **The 84 "no-data" faculty** — almost all are humanities (Theology, English, History, Philosophy) where book scholarship dominates and Scholar/OpenAlex index journals heavily but books poorly. These are real "no data," not bugs.
- **3 clinical practitioners** still zero-data after DQ5 cleanup (Minh Kosfeld, Angela Cecil, Saneta Thurmon) — likely don't publish.
- **Gary Bledsoe** is the one residual SSE "Office of the Dean" row — blank `bio_title` so we can't infer his home department.
- **John James / Michael Mack collision (DQ8)** — fixed for this row, but `openalex.py` will re-fetch and re-match if run with `--force` or after clearing the row. Worth adding a "rejected" skip-list to `openalex.py` if it becomes a recurring problem.
- **n=1 dept buckets from reclassification** (Herrmann Center, Office of School and Community Partnerships, Systematic Theology) — honest small buckets, but their percentiles are degenerate.
- **`primary_h_tier` is based on Scholar h-index when present, OpenAlex h-index otherwise.** Two faculty with the same tier may be using different underlying numbers — Scholar tends to count more citations than OpenAlex.
- **m-index / career-length normalization not yet added** — `openalex_first_year` is "first OpenAlex-indexed year," not "first publication year," which biases m-index for older faculty whose early work isn't indexed. Decided not to add until we can resolve this.

## 12. Cost summary

| Step | API | Calls (final) | Cost |
|---|---|---|---|
| Directory + bio fetches | direct curl | ~700 | $0 |
| Brave search | Brave Search API | ~120 | $0 (free tier 2k/mo) |
| Scholar profile fetch | direct curl | ~190 | $0 |
| OpenAlex author lookup | OpenAlex API | ~520 | $0 (no key) |
| OpenAlex topic tree | OpenAlex API | ~5 | $0 |
| OpenAlex field histograms | OpenAlex API (`group_by`) | ~150 (subfield + field, batched) | $0 |
| **Total** | | **~1,700 requests** | **$0** |

Brave usage: ~6% of monthly free tier consumed.
