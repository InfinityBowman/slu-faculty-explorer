#!/usr/bin/env python3
"""
Retry failed entries in results.csv using a looser search query.

Strategy: drop the '"Saint Louis"' constraint from the search query, then verify
SLU affiliation by fetching each candidate's profile page directly. For common
names this means fetching multiple profiles, but each fetch is free.

Reads:  results.csv (in place)
Writes: results.csv (rewritten with recovered rows updated to status='recovered')

Usage:
    uv run python retry.py
    uv run python retry.py --dry-run    # show what would be retried
    uv run python retry.py --max-candidates 5
"""

import argparse
import csv
import os
import random
import sys
import time

import requests
from dotenv import load_dotenv

from scrape import (
    HERE, RESULTS_FILE, CSV_FIELDS, USER_ID_RE,
    is_slu, clean_query_name, BRAVE_API_KEY,
    fetch_profile_html, parse_profile_metrics,
)

load_dotenv(HERE / ".env")


def looser_search(name, school=None, department=None):
    """Brave search with department disambiguator. Returns (results, error)."""
    clean = clean_query_name(name)
    # Use department keyword to disambiguate common names
    qparts = [f'"{clean}"', "Saint Louis"]
    if department:
        # take first significant word from department
        dept_word = department.split()[0]
        if len(dept_word) > 3 and dept_word.lower() not in ("of", "and", "the", "for"):
            qparts.append(dept_word)
    qparts.append("Google Scholar")
    query = " ".join(qparts)

    headers = {
        "X-Subscription-Token": BRAVE_API_KEY,
        "Accept": "application/json",
    }
    r = requests.get(
        "https://api.search.brave.com/res/v1/web/search",
        headers=headers,
        params={"q": query},
        timeout=30,
    )
    if r.status_code == 422:
        return [], None
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        return [], str(data["error"])
    web_results = data.get("web", {}).get("results", []) or []
    return [
        {
            "link": w.get("url", ""),
            "title": w.get("title", ""),
            "snippet": w.get("description", ""),
        }
        for w in web_results
    ], None


def find_candidates(name, results, limit):
    """Return Scholar profile candidates whose title contains the name's last word."""
    clean = clean_query_name(name).lower()
    tokens = clean.split()
    if not tokens:
        return []
    last_name = tokens[-1]

    candidates = []
    seen = set()
    for r in results:
        link = r.get("link", "")
        m = USER_ID_RE.search(link)
        if not m:
            continue
        author_id = m.group(1)
        if author_id in seen:
            continue
        seen.add(author_id)
        title = r.get("title", "").lower()
        if last_name in title:
            candidates.append({
                "author_id": author_id,
                "title": r.get("title", ""),
                "snippet": r.get("snippet", ""),
            })
        if len(candidates) >= limit:
            break
    return candidates


def retry_one(row, max_candidates):
    name = row["name"]

    try:
        results, err = looser_search(name, school=row.get("school"), department=row.get("department"))
    except Exception as e:
        row["status"] = f"retry_error: {type(e).__name__}: {e}"
        return

    if err:
        row["status"] = f"retry_no_results: {err}"
        return

    candidates = find_candidates(name, results, max_candidates)
    if not candidates:
        row["status"] = "retry_no_candidates"
        return

    for cand in candidates:
        try:
            html = fetch_profile_html(cand["author_id"])
        except Exception:
            continue

        metrics = parse_profile_metrics(html)
        if not metrics:
            continue

        affiliation = metrics.get("affiliation", "")
        if is_slu(affiliation):
            row["scholar_id"] = cand["author_id"]
            row["scholar_url"] = f"https://scholar.google.com/citations?user={cand['author_id']}"
            row["matched_affiliation"] = affiliation
            row["h_index"] = metrics.get("h_index", "")
            row["h_index_5y"] = metrics.get("h_index_5y", "")
            row["i10_index"] = metrics.get("i10_index", "")
            row["i10_index_5y"] = metrics.get("i10_index_5y", "")
            row["citations"] = metrics.get("citations", "")
            row["citations_5y"] = metrics.get("citations_5y", "")
            row["status"] = "recovered"
            return

        time.sleep(random.uniform(0.5, 1.0))

    row["status"] = f"retry_no_slu_in_{len(candidates)}_candidates"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--max-candidates", type=int, default=5,
                    help="Max profiles to fetch per name (default 5)")
    ap.add_argument("--min-delay", type=float, default=0.8)
    ap.add_argument("--max-delay", type=float, default=1.4)
    ap.add_argument("--names", nargs="+",
                    help="Only retry these specific names (exact match)")
    args = ap.parse_args()

    with RESULTS_FILE.open() as f:
        rows = list(csv.DictReader(f))

    failed = [r for r in rows if r["status"] != "found"]
    if args.names:
        wanted = set(args.names)
        failed = [r for r in failed if r["name"] in wanted]
    print(f"{len(rows)} total, {len(failed)} to retry", file=sys.stderr)

    if args.dry_run:
        for r in failed:
            print(f"  #{r['id']:>3} {r['name']:<30} ({r['status']})", file=sys.stderr)
        return

    for i, row in enumerate(failed, 1):
        print(f"[{i}/{len(failed)}] #{row['id']} {row['name']}... ",
              end="", flush=True, file=sys.stderr)
        retry_one(row, args.max_candidates)
        st = row["status"]
        if st == "recovered":
            print(f"recovered  h={row['h_index']} cites={row['citations']}",
                  file=sys.stderr)
        else:
            print(st, file=sys.stderr)
        if i < len(failed):
            time.sleep(random.uniform(args.min_delay, args.max_delay))

    # Preserve any existing columns (openalex, bio, percentiles, etc.)
    fieldnames = list(rows[0].keys())
    for f in CSV_FIELDS:
        if f not in fieldnames:
            fieldnames.append(f)
    with RESULTS_FILE.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})

    found = sum(1 for r in rows if r["status"] in ("found", "recovered"))
    print(f"\nDone. {found}/{len(rows)} now have data.", file=sys.stderr)


if __name__ == "__main__":
    main()
