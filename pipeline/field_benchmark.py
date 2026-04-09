#!/usr/bin/env python3
"""
Score each SLU faculty's h-index against the global distribution of authors
in their OpenAlex field and subfield, so we can answer "is this a good h-index
for their actual field of study, not just for SLU?"

Strategy:
  1. Fetch OpenAlex's topic taxonomy (~4500 topics, paginated) and build a
     lookup of topic_display_name -> (topic_id, subfield, field, domain).
     Cached to openalex_topics.csv so re-runs are free.

  2. For each SLU row, resolve its openalex_top_topic to the full hierarchy.

  3. For each unique subfield and field in the SLU data, use OpenAlex's
     group_by=summary_stats.h_index endpoint (which returns a full histogram
     in one call) to build the global h-index distribution. To stay under
     the URL length limit, we batch topic IDs ~80 at a time and sum histograms.

  4. From each histogram compute landmarks (p25/p50/p75/p90/p95/p99) and per-
     faculty percentile (exact, via the histogram's CDF — no sampling noise).

Adds columns to results.csv:
  openalex_domain, openalex_field, openalex_subfield
  field_h_percentile, subfield_h_percentile
  primary_h_tier   — human-readable: top_1% / top_5% / top_10% / top_25% /
                      above_median / below_median  (uses subfield if its sample
                      is >= MIN_SAMPLE, otherwise falls back to field)

Writes:
  openalex_topics.csv   — cached topic hierarchy (fetched once)
  field_benchmarks.csv  — per-field + per-subfield landmarks with sample sizes

Usage:
    uv run python field_benchmark.py
    uv run python field_benchmark.py --refresh-topics  # re-fetch topic cache
"""

import argparse
import csv
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).parent
RESULTS_FILE = HERE / "results.csv"
TOPICS_CACHE = HERE / "openalex_topics.csv"
BENCHMARKS_FILE = HERE / "field_benchmarks.csv"

OPENALEX_BASE = "https://api.openalex.org"
BATCH_TOPIC_IDS = 80  # URL-length safe (tested up to 100, 120 breaks)
# Below this sample size, the subfield histogram is too noisy; fall back to field.
MIN_SUBFIELD_SAMPLE = 500

# OpenAlex indexes every author of every work — grad students, one-paper
# co-authors, industry practitioners — so the raw h-index population is
# dominated by h=0 authors (p50=0 in most fields). That's not a useful
# denominator for "is this SLU prof good for their field?". We restrict the
# benchmark to authors with 10+ works, i.e. people with an actual research
# track record. Verified empirically: the Finance topic goes from p95=13
# unfiltered to p95=26 with this filter — which matches real-world intuition.
ACTIVE_AUTHOR_FILTER = "works_count:>9"

NEW_FIELDS = [
    "openalex_domain",
    "openalex_field",
    "openalex_subfield",
    "field_h_percentile",
    "subfield_h_percentile",
    "primary_h_tier",
]


# ─── Phase 1: fetch / load topic taxonomy ────────────────────────────────────

TOPIC_CACHE_FIELDS = [
    "topic_id", "topic_name",
    "subfield_id", "subfield_name",
    "field_id", "field_name",
    "domain_id", "domain_name",
]


def fetch_topic_tree():
    """Paginate /topics to build the full taxonomy. ~4500 rows, ~5 API calls."""
    topics = []
    page = 1
    while True:
        r = requests.get(
            f"{OPENALEX_BASE}/topics",
            params={
                "per-page": 200,
                "page": page,
                "select": "id,display_name,subfield,field,domain",
            },
            timeout=30,
        )
        r.raise_for_status()
        d = r.json()
        results = d.get("results", [])
        if not results:
            break
        for t in results:
            tid = (t.get("id") or "").rsplit("/", 1)[-1]
            sf = t.get("subfield") or {}
            f = t.get("field") or {}
            dm = t.get("domain") or {}
            topics.append({
                "topic_id": tid,
                "topic_name": t.get("display_name", ""),
                "subfield_id": (sf.get("id") or "").rsplit("/", 1)[-1],
                "subfield_name": sf.get("display_name", ""),
                "field_id": (f.get("id") or "").rsplit("/", 1)[-1],
                "field_name": f.get("display_name", ""),
                "domain_id": (dm.get("id") or "").rsplit("/", 1)[-1],
                "domain_name": dm.get("display_name", ""),
            })
        total = d.get("meta", {}).get("count", 0)
        if len(topics) >= total:
            break
        page += 1
    return topics


def load_topic_tree(refresh=False):
    """Load from cache or fetch fresh."""
    if TOPICS_CACHE.exists() and not refresh:
        with TOPICS_CACHE.open() as f:
            return list(csv.DictReader(f))
    print("Fetching OpenAlex topic tree...", file=sys.stderr)
    topics = fetch_topic_tree()
    with TOPICS_CACHE.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=TOPIC_CACHE_FIELDS)
        w.writeheader()
        w.writerows(topics)
    print(f"  cached {len(topics)} topics to {TOPICS_CACHE.name}", file=sys.stderr)
    return topics


# ─── Phase 3: benchmark histograms via group_by ──────────────────────────────

def fetch_h_histogram(topic_ids):
    """Query OpenAlex for an h-index histogram of active authors matching any
    of the given topic IDs. Active = works_count >= 10. Returns {h: count}
    dict. Batches topic_ids to fit URL length and sums across batches."""
    histogram = {}
    for i in range(0, len(topic_ids), BATCH_TOPIC_IDS):
        batch = topic_ids[i : i + BATCH_TOPIC_IDS]
        r = requests.get(
            f"{OPENALEX_BASE}/authors",
            params={
                "filter": f"topics.id:{'|'.join(batch)},{ACTIVE_AUTHOR_FILTER}",
                "group_by": "summary_stats.h_index",
                "per-page": 200,
            },
            timeout=60,
        )
        r.raise_for_status()
        d = r.json()
        for g in d.get("group_by", []) or []:
            try:
                h = int(g["key"])
            except (ValueError, TypeError):
                continue
            histogram[h] = histogram.get(h, 0) + g.get("count", 0)
        time.sleep(0.15)  # be polite
    return histogram


def histogram_landmarks(histogram):
    """From {h: count} compute p25/p50/p75/p90/p95/p99 and total sample size."""
    if not histogram:
        return None
    total = sum(histogram.values())
    cum = 0
    landmarks = {}
    targets = {"p25": 0.25, "p50": 0.50, "p75": 0.75, "p90": 0.90, "p95": 0.95, "p99": 0.99}
    sorted_hs = sorted(histogram.items())
    for target_name, target_frac in targets.items():
        target_count = target_frac * total
        running = 0
        for h, c in sorted_hs:
            running += c
            if running >= target_count:
                landmarks[target_name] = h
                break
        else:
            landmarks[target_name] = sorted_hs[-1][0]
    landmarks["n"] = total
    return landmarks


def histogram_percentile(value, histogram):
    """Percentile rank of `value` against a {h: count} histogram.
    Uses the standard definition: % strictly less + 0.5 * % equal. 0–100."""
    if not histogram or value is None:
        return None
    total = sum(histogram.values())
    less = sum(c for h, c in histogram.items() if h < value)
    equal = histogram.get(value, 0)
    return round(100 * (less + 0.5 * equal) / total, 1)


# ─── Phase 5: tier assignment ────────────────────────────────────────────────

def h_tier(percentile):
    """Human-readable tier from a percentile."""
    if percentile is None:
        return ""
    if percentile >= 99:
        return "top_1%"
    if percentile >= 95:
        return "top_5%"
    if percentile >= 90:
        return "top_10%"
    if percentile >= 75:
        return "top_25%"
    if percentile >= 50:
        return "above_median"
    return "below_median"


# ─── Main ────────────────────────────────────────────────────────────────────

def best_h(row):
    """Prefer Scholar h_index (when present) over OpenAlex h_index, mirroring
    how we've been ranking faculty elsewhere in the project."""
    for field in ("h_index", "openalex_h_index"):
        v = row.get(field, "")
        if v not in ("", None):
            try:
                return int(v)
            except (ValueError, TypeError):
                continue
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh-topics", action="store_true",
                    help="Force re-fetch of the OpenAlex topic cache")
    args = ap.parse_args()

    # Phase 1: topic tree
    topics = load_topic_tree(refresh=args.refresh_topics)
    by_name = {t["topic_name"]: t for t in topics}

    # Phase 2: enrich SLU rows with field/subfield from their top topic
    rows = list(csv.DictReader(RESULTS_FILE.open()))
    print(f"Loaded {len(rows)} rows", file=sys.stderr)

    fieldnames = list(rows[0].keys())
    for nf in NEW_FIELDS:
        if nf not in fieldnames:
            fieldnames.append(nf)
    for r in rows:
        for nf in NEW_FIELDS:
            r.setdefault(nf, "")

    mapped = 0
    missing_topic_names = set()
    for r in rows:
        topic_name = r.get("openalex_top_topic", "")
        if not topic_name:
            continue
        t = by_name.get(topic_name)
        if not t:
            missing_topic_names.add(topic_name)
            continue
        r["openalex_domain"] = t["domain_name"]
        r["openalex_field"] = t["field_name"]
        r["openalex_subfield"] = t["subfield_name"]
        mapped += 1

    print(f"Mapped {mapped}/{len(rows)} rows to OpenAlex field/subfield",
          file=sys.stderr)
    if missing_topic_names:
        print(f"  {len(missing_topic_names)} topic names not in cache "
              f"(maybe renamed? first 3: {list(missing_topic_names)[:3]})",
              file=sys.stderr)

    # Phase 3: build histograms per unique subfield and field
    subfields_needed = {r["openalex_subfield"] for r in rows if r.get("openalex_subfield")}
    fields_needed = {r["openalex_field"] for r in rows if r.get("openalex_field")}
    print(f"\nUnique subfields to benchmark: {len(subfields_needed)}",
          file=sys.stderr)
    print(f"Unique fields to benchmark:    {len(fields_needed)}", file=sys.stderr)

    # Group topic IDs by subfield and field from the cached taxonomy
    topics_by_subfield = {}
    topics_by_field = {}
    for t in topics:
        topics_by_subfield.setdefault(t["subfield_name"], []).append(t["topic_id"])
        topics_by_field.setdefault(t["field_name"], []).append(t["topic_id"])

    subfield_hists = {}
    for i, sf in enumerate(sorted(subfields_needed), 1):
        tids = topics_by_subfield.get(sf, [])
        if not tids:
            continue
        print(f"  [{i}/{len(subfields_needed)}] subfield {sf!r}  "
              f"({len(tids)} topics)", end="", flush=True, file=sys.stderr)
        hist = fetch_h_histogram(tids)
        subfield_hists[sf] = hist
        n = sum(hist.values())
        print(f"  n={n:,}", file=sys.stderr)

    field_hists = {}
    for i, f in enumerate(sorted(fields_needed), 1):
        tids = topics_by_field.get(f, [])
        if not tids:
            continue
        print(f"  [{i}/{len(fields_needed)}] field {f!r}  "
              f"({len(tids)} topics)", end="", flush=True, file=sys.stderr)
        hist = fetch_h_histogram(tids)
        field_hists[f] = hist
        n = sum(hist.values())
        print(f"  n={n:,}", file=sys.stderr)

    # Phase 4: score each SLU row
    for r in rows:
        h = best_h(r)
        if h is None:
            continue
        sf_name = r.get("openalex_subfield", "")
        f_name = r.get("openalex_field", "")
        sf_hist = subfield_hists.get(sf_name)
        f_hist = field_hists.get(f_name)
        sf_pct = histogram_percentile(h, sf_hist) if sf_hist else None
        f_pct = histogram_percentile(h, f_hist) if f_hist else None
        r["subfield_h_percentile"] = sf_pct if sf_pct is not None else ""
        r["field_h_percentile"] = f_pct if f_pct is not None else ""

        # primary_h_tier: subfield if its sample is large enough, else field
        if sf_hist and sum(sf_hist.values()) >= MIN_SUBFIELD_SAMPLE:
            r["primary_h_tier"] = h_tier(sf_pct)
        elif f_hist:
            r["primary_h_tier"] = h_tier(f_pct)

    # Write benchmarks sidecar
    benchmark_rows = []
    for sf_name, hist in sorted(subfield_hists.items()):
        lm = histogram_landmarks(hist) or {}
        benchmark_rows.append({
            "level": "subfield",
            "name": sf_name,
            "n_authors": lm.get("n", 0),
            "p25": lm.get("p25", ""),
            "p50": lm.get("p50", ""),
            "p75": lm.get("p75", ""),
            "p90": lm.get("p90", ""),
            "p95": lm.get("p95", ""),
            "p99": lm.get("p99", ""),
        })
    for f_name, hist in sorted(field_hists.items()):
        lm = histogram_landmarks(hist) or {}
        benchmark_rows.append({
            "level": "field",
            "name": f_name,
            "n_authors": lm.get("n", 0),
            "p25": lm.get("p25", ""),
            "p50": lm.get("p50", ""),
            "p75": lm.get("p75", ""),
            "p90": lm.get("p90", ""),
            "p95": lm.get("p95", ""),
            "p99": lm.get("p99", ""),
        })

    with BENCHMARKS_FILE.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "level", "name", "n_authors", "p25", "p50", "p75", "p90", "p95", "p99",
        ])
        w.writeheader()
        w.writerows(benchmark_rows)
    print(f"\nWrote {BENCHMARKS_FILE} ({len(benchmark_rows)} rows)", file=sys.stderr)

    # Write enriched results.csv
    with RESULTS_FILE.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})
    print(f"Wrote {RESULTS_FILE}", file=sys.stderr)

    # Quick summary
    tiers = {}
    for r in rows:
        t = r.get("primary_h_tier", "")
        if t:
            tiers[t] = tiers.get(t, 0) + 1
    print("\nPrimary h-tier distribution:", file=sys.stderr)
    for tier in ("top_1%", "top_5%", "top_10%", "top_25%", "above_median", "below_median"):
        n = tiers.get(tier, 0)
        print(f"  {n:>4}  {tier}", file=sys.stderr)


if __name__ == "__main__":
    main()
