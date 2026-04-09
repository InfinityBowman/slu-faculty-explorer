#!/usr/bin/env python3
"""
Parse SLU faculty bio pages and enrich results.csv with bio fields.

Adds columns:
  bio_title           - rank/title (e.g. "Edward Jones Professor; Professor")
  bio_department      - department text shown under title
  bio_email           - first slu.edu email found on the page
  bio_phone           - first phone number found
  bio_office          - office location if found
  phd_institution     - parsed from Education section
  phd_year            - parsed from Education section
  research_interests  - free-text from Research Interests section
  bio_status          - found / no_url / fetch_error / parse_error

Strategy: SLU bios use a fairly consistent layout — H1 with name+degree, then a
title line, then department, then H2 sections (Education, Research Interests, etc.)

Usage:
    uv run python extract_bio.py
    uv run python extract_bio.py --names "Bidisha Chakrabarty"
    uv run python extract_bio.py --limit 10
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
RESULTS_FILE = HERE / "results.csv"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

BIO_FIELDS = [
    "bio_title", "bio_department", "bio_email", "bio_phone", "bio_office",
    "phd_institution", "phd_year", "research_interests", "bio_status",
]

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9.-]+\.)?slu\.edu")
PHONE_RE = re.compile(r"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b")
PHD_YEAR_RE = re.compile(r"\b(19\d{2}|20\d{2})\b")
PHD_LINE_RE = re.compile(r"Ph\.?\s*D\.?[^.]{0,200}", re.IGNORECASE)


def fetch_bio(url):
    r = requests.get(url, headers={"User-Agent": UA}, timeout=20)
    r.raise_for_status()
    return r.text


def section_lines(soup, h2_label):
    """Return the lines inside an h2-delimited section as a list of strings.
    Each <p>/<li>/<br> boundary becomes a separate line."""
    main = soup.find("main") or soup
    target = None
    for h2 in main.find_all("h2"):
        if h2_label.lower() in h2.get_text(strip=True).lower():
            target = h2
            break
    if not target:
        return []
    out = []
    for sib in target.next_siblings:
        if getattr(sib, "name", None) == "h2":
            break
        if hasattr(sib, "get_text"):
            t = sib.get_text(separator="\n", strip=True)
            for line in t.splitlines():
                line = line.strip()
                if line:
                    out.append(line)
    return out


def section_text(soup, h2_label):
    """Joined version of section_lines, for sections where we just want a blob."""
    return " ".join(section_lines(soup, h2_label)).strip()


def title_block(soup):
    """Return the text between the H1 and the first H2 — usually contains title + dept."""
    main = soup.find("main") or soup
    h1 = main.find("h1")
    if not h1:
        return ""
    parts = []
    for sib in h1.next_siblings:
        if getattr(sib, "name", None) == "h2":
            break
        if hasattr(sib, "get_text"):
            t = sib.get_text(separator="\n", strip=True)
            if t:
                parts.append(t)
    return "\n".join(parts).strip()


def parse_education(lines):
    """Extract Ph.D. institution + year from a list of education lines.
    Each line should be one degree entry (e.g. 'Ph.D. in Finance, SUNY Buffalo, 2003')."""
    if not lines:
        return "", ""
    # find the line that mentions Ph.D.
    phd_line = ""
    for line in lines:
        if re.search(r"\bPh\.?\s*D\.?\b", line, re.IGNORECASE):
            phd_line = line
            break
    if not phd_line:
        return "", ""

    # Year (last 19xx/20xx in the line)
    year = ""
    years = PHD_YEAR_RE.findall(phd_line)
    if years:
        year = years[-1]

    # Institution: split on commas, drop the "Ph.D. in X" chunk and the year chunk
    parts = [p.strip(" .,()") for p in phd_line.split(",")]
    inst = ""
    for p in parts[1:]:
        # skip year-only parts and degree-name parts like "in Finance"
        if not p or PHD_YEAR_RE.fullmatch(p):
            continue
        if p.lower().startswith("in "):
            continue
        if re.search(r"\bPh\.?\s*D\.?\b", p, re.IGNORECASE):
            continue
        # strip stray year inside the part
        cleaned = re.sub(r"\b(19|20)\d{2}\b", "", p).strip(" .,()")
        if cleaned and len(cleaned) > 2:
            inst = cleaned
            break

    return inst, year


def parse_bio(html):
    """Return a dict of bio fields parsed from the page."""
    soup = BeautifulSoup(html, "html.parser")

    out = {f: "" for f in BIO_FIELDS}

    # Title block
    tb = title_block(soup)
    if tb:
        # First line is usually the title (rank), second is the department
        lines = [l.strip() for l in tb.split("\n") if l.strip()]
        if lines:
            out["bio_title"] = lines[0][:200]
        if len(lines) >= 2:
            out["bio_department"] = lines[1][:200]

    # Education — pass lines (not flattened text) so we don't merge degree entries
    edu_lines = section_lines(soup, "Education")
    inst, year = parse_education(edu_lines)
    out["phd_institution"] = inst
    out["phd_year"] = year

    # Research Interests
    out["research_interests"] = section_text(soup, "Research Interests")[:500]

    # Contact info — search whole page text for email and phone
    main = soup.find("main") or soup
    full = main.get_text(separator=" ", strip=True)
    em = EMAIL_RE.search(full)
    if em:
        out["bio_email"] = em.group(0)
    ph = PHONE_RE.search(full)
    if ph:
        out["bio_phone"] = ph.group(0)

    # Office: capture only the room/office identifier — anchored to a room
    # number shape (1-4 digits + optional trailing letter). The previous
    # regex was too loose and matched things like "Office of Scientific
    # Research..." (treating "of" as the captured value), then ran on for
    # 80 characters into the next field of the page.
    om = re.search(
        r"(?:Office\s+Location|Office|Room)\s*:?\s+(\d{1,4}[A-Za-z]?)\b",
        full,
        re.IGNORECASE,
    )
    if om:
        out["bio_office"] = om.group(1)

    out["bio_status"] = "found"
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--names", nargs="+")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--min-delay", type=float, default=0.3)
    ap.add_argument("--max-delay", type=float, default=0.7)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    rows = list(csv.DictReader(RESULTS_FILE.open()))
    print(f"Loaded {len(rows)} rows", file=sys.stderr)

    for r in rows:
        for f in BIO_FIELDS:
            r.setdefault(f, "")

    todo = rows
    if args.names:
        wanted = set(args.names)
        todo = [r for r in rows if r["name"] in wanted]
    if not args.force:
        todo = [r for r in todo if not r.get("bio_title")]
    if args.limit:
        todo = todo[: args.limit]

    print(f"To process: {len(todo)}", file=sys.stderr)

    for i, row in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {row['name'][:35]:<35} ", end="", flush=True, file=sys.stderr)
        if not row.get("slu_url"):
            row["bio_status"] = "no_url"
            print("-> no_url", file=sys.stderr)
            continue
        try:
            html = fetch_bio(row["slu_url"])
        except Exception as e:
            row["bio_status"] = f"fetch_error: {type(e).__name__}"
            print(f"-> fetch_error: {e}", file=sys.stderr)
            continue
        try:
            parsed = parse_bio(html)
            row.update(parsed)
            print(f"-> {row['bio_title'][:50]}", file=sys.stderr)
        except Exception as e:
            row["bio_status"] = f"parse_error: {type(e).__name__}"
            print(f"-> parse_error: {e}", file=sys.stderr)

        if i < len(todo):
            time.sleep(random.uniform(args.min_delay, args.max_delay))

    # Preserve any existing columns (openalex, percentiles, etc.) — don't truncate
    fieldnames = list(rows[0].keys())
    for f in BIO_FIELDS:
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
