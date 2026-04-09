#!/usr/bin/env python3
"""
Backfill the slu_url column in results.csv from directory.csv.

For each row in results.csv, look up the SLU bio URL by normalized name.
Adds the column if missing. Prints unmatched names so we can spot issues.

Usage:
    uv run python add_slu_urls.py             # writes back results.csv
    uv run python add_slu_urls.py --dry-run
"""

import argparse
import csv
import sys
from pathlib import Path

from extract_directory import normalize_name

HERE = Path(__file__).parent
RESULTS_FILE = HERE / "results.csv"
DIRECTORY_FILE = HERE / "directory.csv"

NEW_FIELDS_ORDER = [
    "id", "name", "school", "department", "slu_url",
    "scholar_id", "scholar_url", "matched_affiliation",
    "h_index", "h_index_5y", "i10_index", "i10_index_5y",
    "citations", "citations_5y", "status",
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not DIRECTORY_FILE.exists():
        sys.exit(f"missing {DIRECTORY_FILE} — run extract_directory.py first")

    # Build name -> url lookup from directory.csv
    name_to_url = {}
    with DIRECTORY_FILE.open() as f:
        for r in csv.DictReader(f):
            n = r["norm_name"]
            if n and n not in name_to_url:
                name_to_url[n] = r["slu_url"]

    # Load results.csv
    with RESULTS_FILE.open() as f:
        rows = list(csv.DictReader(f))

    matched = 0
    unmatched = []
    for row in rows:
        norm = normalize_name(row["name"])
        url = name_to_url.get(norm, "")
        if not url:
            # try matching just on last word
            parts = norm.split()
            if parts:
                last = parts[-1]
                candidates = [
                    (k, v) for k, v in name_to_url.items()
                    if k.split() and k.split()[-1] == last
                ]
                if len(candidates) == 1:
                    url = candidates[0][1]
        row["slu_url"] = url
        if url:
            matched += 1
        else:
            unmatched.append(row["name"])

    print(f"Matched {matched}/{len(rows)} rows", file=sys.stderr)
    if unmatched:
        print(f"\n{len(unmatched)} unmatched (no SLU URL found):", file=sys.stderr)
        for n in unmatched:
            print(f"  - {n}", file=sys.stderr)

    if args.dry_run:
        return

    # Preserve any existing columns; ensure slu_url is added if missing
    fieldnames = list(rows[0].keys())
    if "slu_url" not in fieldnames:
        fieldnames.insert(4, "slu_url")
    with RESULTS_FILE.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in rows:
            w.writerow({k: row.get(k, "") for k in fieldnames})

    print(f"\nWrote {RESULTS_FILE}", file=sys.stderr)


if __name__ == "__main__":
    main()
