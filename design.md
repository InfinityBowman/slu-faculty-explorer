# SLU Faculty Explorer

A research analytics dashboard for Saint Louis University leadership. Combines exploratory browsing, comparative analytics, presentation-ready visualizations, and an AI assistant — all built on field-normalized bibliometric data from Google Scholar and OpenAlex.

Live at **faculty.jacobmaynard.dev**

## Data

Two pre-computed CSV files power the entire application. No live external APIs.

**faculty.csv** (~400 faculty records, 44 columns) contains identity, contact, Google Scholar metrics (h-index, i10, citations), OpenAlex metrics (works, citations, h-index, FWCI, field classification, career span), SLU biographical data (PhD institution/year, research interests, admin role), and computed percentiles (department-level and global field-level).

**benchmarks.csv** provides global h-index percentile benchmarks (P25 through P99) for ~200 research fields and subfields, sourced from OpenAlex's active-author population (10+ publications).

Two metrics are derived client-side at load time:
- **bestH** — the higher of Scholar or OpenAlex h-index
- **mIndex** — h-index divided by years since first publication (Hirsch's productivity-normalized metric)

Faculty are classified into six global **field-normalized tiers** based on their h-index percentile within their primary research field: top 1%, top 5%, top 10%, top 25%, above median, below median.

## Pages

### Explorer (`/`)

The primary browsing interface. Three integrated panels:

**Filters** — sticky sidebar with fuzzy text search (Fuse.js, weighted across name/department/field/interests), school and department dropdowns (department scoped to selected school), tier threshold selector, and Scholar/OpenAlex source toggle.

**Scatter plot** — D3-rendered interactive chart with pan/zoom. 12+ plottable numeric metrics on X and Y axes (works, citations, h-index, m-index, i10, FWCI, field percentile, career length, etc.). Optional size encoding by any numeric field. Color encoding by 20+ categorical fields with appropriate sequential or nominal palettes. Legend items are clickable to toggle category visibility.

**Data table** — sortable, virtualized list of all matching faculty with key metrics.

### Schools (`/schools`)

School comparison view with expandable drill-down. Each school row shows aggregate metrics; expanding reveals department-level summaries with top 3 faculty per department (ranked by tier, then h-index, then field percentile). Flags noisy departments (n < 5) and low-coverage fields (< 50% with data).

### Insights (`/insights`)

Six presentation-ready visualizations for SLU leadership:

**Field-normalized tier distribution** — stacked horizontal bars showing the percentage of faculty in each global h-index percentile tier, broken out by school. All SLU aggregate shown separately with bold label.

**FWCI distribution** — histogram of faculty citation impact relative to global field average (1.0). Shows headline stats: percent above field average and median FWCI.

**m-index by career stage** — bar chart with IQR error bars, grouping m-index (h-index per year of publishing) by first-publication decade. Reference lines at m=1 (successful) and m=2 (outstanding).

**Administrative role vs. research output** — horizontal bars showing median global field h-percentile for each role (Dean/Provost, Associate Dean, Chair, Director, Coordinator, no admin role).

**SLU vs. global field benchmarks** — D3-rendered chart positioning each school's median h-index against the global field distribution (P25-P90 range bar, P50 tick, colored SLU dot). Each school matched to its dominant research field.

**Data source coverage** — stacked bars showing how many faculty per school have Google Scholar profiles, OpenAlex profiles, or neither. Quantifies the completeness of the underlying data.

All charts use a shared tooltip system: cursor-following, fixed-position, CSS opacity transitions, document-level position tracking, automatic viewport edge flipping.

### About (`/about`)

Documentation of methodology, data sources, scope, and caveats. Table of contents sidebar with anchor navigation across 11 sections.

## AI Assistant

Cmd+K opens a floating chat panel backed by the Claude API. Context-aware: the system prompt adapts based on which page the user is on.

Eight tool-use capabilities let the AI manipulate the UI directly:
- Set search query, school filter, department filter, tier filter
- Configure scatter chart axes, size, and color encodings
- Run data analysis queries
- Navigate between pages

Streams responses with markdown rendering and shows real-time tool execution badges.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 19.2 + TanStack Start (SSR) |
| Routing | TanStack Router (file-based) |
| State | Zustand |
| Charts | Recharts (bar/composed charts) + D3 (scatter, benchmarks) |
| Search | Fuse.js (fuzzy, weighted, extended syntax) |
| CSV | PapaParse |
| UI | shadcn/ui + Radix primitives + Tailwind CSS 4 |
| Deploy | Cloudflare Workers |

## Color System

All insight visualizations use a monochromatic SLU blue ramp in OKLCH color space (hue 259), varying lightness from 0.28 (darkest, top 1%) to 0.88 (lightest, below median). Scatter plot palettes are defined separately with both sequential and nominal schemes.
