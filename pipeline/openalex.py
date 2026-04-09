#!/usr/bin/env python3
"""
Enrich results.csv with OpenAlex author metrics.

Adds columns:
  openalex_id           - e.g. A5039460905
  openalex_works_count  - total publications
  openalex_citations    - total citations (OpenAlex's count)
  openalex_h_index      - OpenAlex-computed h-index
  openalex_i10_index    - OpenAlex-computed i10-index
  openalex_2yr_fwci     - 2yr mean citedness (field-weighted citation impact)
  openalex_top_topic    - dominant research topic per OpenAlex's classifier
  openalex_first_year   - earliest publication year
  openalex_last_year    - most recent publication year
  openalex_status       - found / not_found / ambiguous / error

Strategy:
  1. Search OpenAlex /authors filtered to SLU institution ID (I47838141)
  2. If 0 results, search broadly by name and take first match whose
     affiliations include SLU
  3. If still 0, mark as not_found

OpenAlex is free, no API key required, ~10 req/sec rate limit (we use 5 to be polite).
Including ?mailto={EMAIL} in requests goes into the polite pool for higher priority.

Usage:
    uv run python openalex.py
    uv run python openalex.py --names "Bidisha Chakrabarty"
    uv run python openalex.py --limit 10
"""

import argparse
import csv
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

HERE = Path(__file__).parent
RESULTS_FILE = HERE / "results.csv"

load_dotenv(HERE / ".env")
POLITE_EMAIL = os.environ.get("POLITE_EMAIL", "")  # optional

SLU_INSTITUTION_ID = "I47838141"  # Saint Louis University (US)

OPENALEX_FIELDS = [
    "openalex_id", "openalex_works_count", "openalex_citations",
    "openalex_h_index", "openalex_i10_index", "openalex_2yr_fwci",
    "openalex_top_topic", "openalex_first_year", "openalex_last_year",
    "openalex_status",
]


def openalex_get(path, params=None):
    params = dict(params or {})
    if POLITE_EMAIL:
        params["mailto"] = POLITE_EMAIL
    r = requests.get(f"https://api.openalex.org{path}", params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def search_author(name):
    """Try filtered search first; fall back to name-only search with SLU verification."""
    # Try 1: filtered to SLU institution
    try:
        d = openalex_get("/authors", {
            "search": name,
            "filter": f"affiliations.institution.id:{SLU_INSTITUTION_ID}",
            "per-page": 5,
        })
    except requests.HTTPError as e:
        return None, f"http_error: {e}"

    results = d.get("results", [])
    if len(results) == 1:
        return results[0], "found"
    if len(results) > 1:
        # Multiple SLU matches — pick the one with the most works.
        # Only flag as ambiguous if the runner-up has at least half the works count.
        # Otherwise the dominant candidate is clearly the main profile and the others
        # are duplicate sub-IDs from OpenAlex's disambiguation or co-author mentions.
        ranked = sorted(results, key=lambda r: r.get("works_count") or 0, reverse=True)
        best = ranked[0]
        runner_up = ranked[1]
        best_works = best.get("works_count") or 0
        runner_works = runner_up.get("works_count") or 0
        if best_works >= 5 and runner_works * 2 < best_works:
            return best, "found"
        return best, "ambiguous_multiple_slu"

    # Try 2: name-only search, filter by affiliations on the result
    try:
        d = openalex_get("/authors", {"search": name, "per-page": 10})
    except requests.HTTPError as e:
        return None, f"http_error: {e}"

    for r in d.get("results", []):
        affs = r.get("affiliations", []) or []
        for a in affs:
            inst = a.get("institution", {}) or {}
            iid = inst.get("id", "")
            if SLU_INSTITUTION_ID in iid:
                return r, "found"

    return None, "not_found"


def extract_metrics(author):
    summary = author.get("summary_stats", {}) or {}
    fwci = summary.get("2yr_mean_citedness")
    topics = author.get("topics", []) or []
    top_topic = topics[0].get("display_name", "") if topics else ""
    counts = author.get("counts_by_year", []) or []
    years = [c["year"] for c in counts if c.get("year")]
    return {
        "openalex_id": author.get("id", "").replace("https://openalex.org/", ""),
        "openalex_works_count": author.get("works_count", ""),
        "openalex_citations": author.get("cited_by_count", ""),
        "openalex_h_index": summary.get("h_index", ""),
        "openalex_i10_index": summary.get("i10_index", ""),
        "openalex_2yr_fwci": f"{fwci:.3f}" if isinstance(fwci, (int, float)) else "",
        "openalex_top_topic": top_topic,
        "openalex_first_year": min(years) if years else "",
        "openalex_last_year": max(years) if years else "",
    }


def enrich_one(row):
    name = row["name"]
    author, status = search_author(name)
    row["openalex_status"] = status
    if author:
        row.update(extract_metrics(author))
    else:
        for f in OPENALEX_FIELDS:
            if f != "openalex_status":
                row[f] = ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--names", nargs="+")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--delay", type=float, default=0.2)
    ap.add_argument("--force", action="store_true",
                    help="Re-fetch even rows that already have openalex_id set")
    args = ap.parse_args()

    rows = list(csv.DictReader(RESULTS_FILE.open()))
    print(f"Loaded {len(rows)} rows from results.csv", file=sys.stderr)

    # Ensure all openalex_* columns exist
    for r in rows:
        for f in OPENALEX_FIELDS:
            r.setdefault(f, "")

    # Filter
    todo = rows
    if args.names:
        wanted = set(args.names)
        todo = [r for r in rows if r["name"] in wanted]
    if not args.force:
        # Skip rows already enriched. ALSO skip rows that were manually
        # rejected as wrong-person matches (status starts with "rejected_") —
        # otherwise re-running openalex.py would re-pull the same bad author.
        todo = [
            r for r in todo
            if not r.get("openalex_id")
            and not r.get("openalex_status", "").startswith("rejected_")
        ]
    if args.limit:
        todo = todo[: args.limit]

    print(f"To enrich: {len(todo)}", file=sys.stderr)

    for i, row in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {row['name'][:35]:<35} ", end="", flush=True, file=sys.stderr)
        try:
            enrich_one(row)
        except Exception as e:
            row["openalex_status"] = f"error: {type(e).__name__}: {e}"
        st = row["openalex_status"]
        if st == "found" or st.startswith("ambiguous"):
            print(f"-> {st}  works={row['openalex_works_count']} h={row['openalex_h_index']} fwci={row['openalex_2yr_fwci']}",
                  file=sys.stderr)
        else:
            print(f"-> {st}", file=sys.stderr)
        if i < len(todo):
            time.sleep(args.delay)

    # Preserve any existing columns (bio fields, percentiles, etc.) — don't truncate
    fieldnames = list(rows[0].keys())
    for f in OPENALEX_FIELDS:
        if f not in fieldnames:
            fieldnames.append(f)
    with RESULTS_FILE.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})

    print(f"\nWrote {RESULTS_FILE}", file=sys.stderr)


if __name__ == "__main__":
    main()
