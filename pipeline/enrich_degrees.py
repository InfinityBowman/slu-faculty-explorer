#!/usr/bin/env python3
"""
For each row in directory.csv whose raw_name doesn't already contain a Ph.D./Ed.D./
DNP/etc. signal, fetch the bio page H1 to see what degree they actually have.
Adds two columns to directory.csv:
  - bio_h1   : the heading text from their bio page (e.g. "Helen W. Lach, Ph.D., RN")
  - degree   : detected primary degree (Ph.D., Ed.D., DNP, D.N.P., D.S.W., Dr.PH, DHSc, MD, etc.)

Usage:
    uv run python enrich_degrees.py
    uv run python enrich_degrees.py --dry-run
"""

import argparse
import csv
import random
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

HERE = Path(__file__).parent
DIRECTORY_FILE = HERE / "directory.csv"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

# Detect doctorate-level degrees in priority order — Ph.D. wins over others
DEGREE_PATTERNS = [
    ("Ph.D.", re.compile(r"\bPh\.?\s*D\.?\b", re.IGNORECASE)),
    ("Ed.D.", re.compile(r"\bEd\.?\s*D\.?\b", re.IGNORECASE)),
    ("D.N.P.", re.compile(r"\bD\.?\s*N\.?\s*P\.?\b", re.IGNORECASE)),
    ("D.S.W.", re.compile(r"\bD\.?\s*S\.?\s*W\.?\b", re.IGNORECASE)),
    ("Dr.PH", re.compile(r"\bDr\.?\s*P\.?\s*H\.?\b", re.IGNORECASE)),
    ("DHSc", re.compile(r"\bDH\.?Sc\.?\b", re.IGNORECASE)),
    ("D.M.A.", re.compile(r"\bD\.?\s*M\.?\s*A\.?\b", re.IGNORECASE)),
    ("Sc.D.", re.compile(r"\bSc\.?\s*D\.?\b", re.IGNORECASE)),
    ("M.D.", re.compile(r"\bM\.?\s*D\.?\b")),
    ("J.D.", re.compile(r"\bJ\.?\s*D\.?\b")),
]


def detect_degree(text):
    if not text:
        return ""
    for label, pat in DEGREE_PATTERNS:
        if pat.search(text):
            return label
    return ""


def fetch_h1(url):
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=15)
        r.raise_for_status()
    except Exception as e:
        return None, f"http_error: {e}"
    soup = BeautifulSoup(r.text, "html.parser")
    h1 = soup.find("h1")
    if not h1:
        return None, "no_h1"
    return h1.get_text(strip=True), None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--min-delay", type=float, default=0.3)
    ap.add_argument("--max-delay", type=float, default=0.8)
    args = ap.parse_args()

    rows = list(csv.DictReader(DIRECTORY_FILE.open()))

    # Add bio_h1 + degree columns if missing
    for r in rows:
        r.setdefault("bio_h1", "")
        r.setdefault("degree", detect_degree(r["raw_name"]))

    # Find rows that need bio fetch: missing degree AND not previously fetched
    todo = [r for r in rows if not r["degree"] and not r["bio_h1"]]
    print(f"{len(rows)} total rows, {len(todo)} need bio fetch", file=sys.stderr)

    if args.dry_run:
        return

    for i, r in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {r['raw_name'][:35]:<35} ", end="", flush=True, file=sys.stderr)
        h1, err = fetch_h1(r["slu_url"])
        if h1:
            r["bio_h1"] = h1
            r["degree"] = detect_degree(h1)
            print(f"-> {r['degree'] or '(no degree)'}", file=sys.stderr)
        else:
            r["bio_h1"] = f"ERROR: {err}"
            print(f"-> {err}", file=sys.stderr)
        if i < len(todo):
            time.sleep(random.uniform(args.min_delay, args.max_delay))

    # Write back, preserving existing columns + adding the new ones
    fieldnames = list(rows[0].keys())
    with DIRECTORY_FILE.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    # Summary
    by_degree = {}
    for r in rows:
        d = r["degree"] or "(none)"
        by_degree[d] = by_degree.get(d, 0) + 1
    print("\nDegree distribution:", file=sys.stderr)
    for d, n in sorted(by_degree.items(), key=lambda x: -x[1]):
        print(f"  {d:>10}  {n}", file=sys.stderr)


if __name__ == "__main__":
    main()
