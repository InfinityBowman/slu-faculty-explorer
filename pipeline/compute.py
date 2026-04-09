#!/usr/bin/env python3
"""
Compute derived metrics from results.csv:
  - dept_h_percentile         per-person h-index percentile within their department
  - dept_fwci_percentile      same for OpenAlex 2yr FWCI
  - dept_works_percentile     same for OpenAlex works count

Also writes a sidecar dept_summary.csv with per-department aggregates:
  school, department, n_faculty, n_with_scholar, n_with_openalex,
  median_h, mean_h, max_h, median_fwci, mean_fwci, total_citations, noisy

A department is flagged "noisy" if n_faculty < 5 — percentiles are unreliable.

Usage:
    uv run python compute.py
"""

import csv
import statistics
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
RESULTS_FILE = HERE / "results.csv"
DEPT_SUMMARY_FILE = HERE / "dept_summary.csv"

PERCENTILE_FIELDS = [
    "dept_h_percentile",
    "dept_fwci_percentile",
    "dept_works_percentile",
]


def to_float(x):
    if x in ("", None):
        return None
    try:
        return float(x)
    except (ValueError, TypeError):
        return None


def percentile_rank(value, all_values):
    """Standard percentile rank: % of values strictly less than this one,
    plus half the % equal to it. Returns 0–100."""
    if value is None or not all_values:
        return ""
    n = len(all_values)
    less = sum(1 for v in all_values if v < value)
    equal = sum(1 for v in all_values if v == value)
    return round(100 * (less + 0.5 * equal) / n, 1)


def main():
    rows = list(csv.DictReader(RESULTS_FILE.open()))
    print(f"Loaded {len(rows)} rows", file=sys.stderr)

    # Group by (school, department)
    by_dept = defaultdict(list)
    for r in rows:
        key = (r["school"], r["department"])
        by_dept[key].append(r)

    # Compute percentiles per department
    for (school, dept), dept_rows in by_dept.items():
        h_values = sorted(filter(None, [to_float(r.get("h_index")) for r in dept_rows]))
        fwci_values = sorted(filter(None, [to_float(r.get("openalex_2yr_fwci")) for r in dept_rows]))
        works_values = sorted(filter(None, [to_float(r.get("openalex_works_count")) for r in dept_rows]))

        for r in dept_rows:
            h = to_float(r.get("h_index"))
            fwci = to_float(r.get("openalex_2yr_fwci"))
            works = to_float(r.get("openalex_works_count"))
            r["dept_h_percentile"] = percentile_rank(h, h_values)
            r["dept_fwci_percentile"] = percentile_rank(fwci, fwci_values)
            r["dept_works_percentile"] = percentile_rank(works, works_values)

    # Build dept_summary
    summary_rows = []
    for (school, dept), dept_rows in sorted(by_dept.items()):
        n = len(dept_rows)
        with_scholar = sum(1 for r in dept_rows if r.get("status") == "found")
        with_oa = sum(1 for r in dept_rows if r.get("openalex_status") == "found")

        h_vals = list(filter(None, [to_float(r.get("h_index")) for r in dept_rows]))
        fwci_vals = list(filter(None, [to_float(r.get("openalex_2yr_fwci")) for r in dept_rows]))
        works_vals = list(filter(None, [to_float(r.get("openalex_works_count")) for r in dept_rows]))
        cite_vals = list(filter(None, [to_float(r.get("citations")) for r in dept_rows]))
        oa_cite_vals = list(filter(None, [to_float(r.get("openalex_citations")) for r in dept_rows]))

        def stat(values, fn, fmt="{:.1f}"):
            if not values:
                return ""
            try:
                return fmt.format(fn(values))
            except statistics.StatisticsError:
                return ""

        summary_rows.append({
            "school": school,
            "department": dept,
            "n_faculty": n,
            "n_with_scholar": with_scholar,
            "n_with_openalex": with_oa,
            "median_h": stat(h_vals, statistics.median, "{:.0f}"),
            "mean_h": stat(h_vals, statistics.mean),
            "max_h": stat(h_vals, max, "{:.0f}"),
            "median_fwci": stat(fwci_vals, statistics.median, "{:.2f}"),
            "mean_fwci": stat(fwci_vals, statistics.mean, "{:.2f}"),
            "median_works": stat(works_vals, statistics.median, "{:.0f}"),
            "total_scholar_citations": int(sum(cite_vals)) if cite_vals else "",
            "total_openalex_citations": int(sum(oa_cite_vals)) if oa_cite_vals else "",
            "noisy": "yes" if n < 5 else "",
        })

    # Write results.csv with new percentile columns
    fieldnames = list(rows[0].keys()) if rows else []
    for f in PERCENTILE_FIELDS:
        if f not in fieldnames:
            fieldnames.append(f)
    with RESULTS_FILE.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})
    print(f"Updated {RESULTS_FILE} with percentile columns", file=sys.stderr)

    # Write dept_summary.csv
    summary_fields = [
        "school", "department", "n_faculty", "n_with_scholar", "n_with_openalex",
        "median_h", "mean_h", "max_h", "median_fwci", "mean_fwci",
        "median_works", "total_scholar_citations", "total_openalex_citations", "noisy",
    ]
    with DEPT_SUMMARY_FILE.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=summary_fields)
        w.writeheader()
        w.writerows(summary_rows)
    print(f"Wrote {DEPT_SUMMARY_FILE} ({len(summary_rows)} departments)", file=sys.stderr)


if __name__ == "__main__":
    main()
