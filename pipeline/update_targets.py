#!/usr/bin/env python3
"""
Append new Ph.D. faculty from directory.csv into targets.md.

Filter rules:
  - degree must be exactly "Ph.D." (Ed.D./DNP/DSW/etc. excluded — same as before)
  - not Madrid
  - not already in targets.md (matched by normalized name)
  - not a duplicate within directory.csv (deduped by slu_url then by normalized name)

New entries are appended in a "## Phase 2 additions — {school}" structure at the
end of targets.md, grouped by school then by department, with new sequential IDs.

Usage:
    uv run python update_targets.py
    uv run python update_targets.py --dry-run
"""

import argparse
import csv
import sys
from collections import OrderedDict, defaultdict
from pathlib import Path

import re

from extract_directory import normalize_name
from scrape import parse_targets


# Terminal doctoral/professional degree tokens. Once we see one of these after
# a comma, everything that follows is credentials — clinical certs (OTR/L,
# CCC-SLP/A, MLS (ASCP)CM, FSNMMI-TS, etc.), society memberships (FAAN, FAOTA),
# post-nominals, and so on. None are ever part of a name.
_DEG_TOKEN = (
    r"Ph\.?\s*D\.?|Ed\.?\s*D\.?|D\.?\s*N\.?\s*P\.?|D\.?\s*S\.?\s*W\.?|"
    r"M\.?\s*D\.?|D\.?\s*M\.?\s*A\.?|Sc\.?\s*D\.?|Dr\.?\s*P\.?\s*H\.?|"
    r"J\.?\s*D\.?|Psy\.?\s*D\.?|Pharm\.?\s*D\.?|DH\.?Sc\.?|D\.?\s*P\.?\s*T\.?|"
    r"OTD|S\.?\s*J\.?"
)
# Truncate at the first comma-introduced degree token. Matches the whole tail.
_TRUNCATE_RE = re.compile(rf",\s*(?:{_DEG_TOKEN})\b.*$", re.IGNORECASE)
# Fallback: strip a bare trailing degree with no preceding comma (rare).
_TRAIL_DEG_RE = re.compile(rf",?\s*\b(?:{_DEG_TOKEN})\s*\.?\s*$", re.IGNORECASE)


def clean_display_name(raw):
    """Strip degree credentials and trailing annotations to get a clean searchable name.

    Strategy: find the first ", <terminal degree>" and truncate everything from
    the comma onward. This robustly removes clinical certs, society memberships,
    and multi-credential stacks without needing to enumerate every abbreviation.

    Constraints to avoid mauling real names:
    - Degree tokens must be preceded by a comma — "Thomas J. Finan" won't match S.J.
    - Dash-annotations require whitespace on both sides — "Tae-Hyuk" survives but
      "Irma Kuljanishvili - Physics" is stripped.
    """
    s = _TRUNCATE_RE.sub("", raw).strip(",. \t")
    s = _TRAIL_DEG_RE.sub("", s).strip(",. \t")
    s = re.sub(r"\s+[-–—]\s+[A-Z][a-z]+.*$", "", s)
    return s.strip(",. \t")

HERE = Path(__file__).parent
DIRECTORY_FILE = HERE / "directory.csv"
TARGETS_FILE = HERE / "targets.md"


SCHOOL_ORDER = [
    "Chaifetz School of Business",
    "College for Public Health and Social Justice",
    "School of Social Work",
    "School of Science and Engineering",
    "College of Arts and Sciences",
    "College of Philosophy and Letters",
    "Doisy College of Health Sciences",
    "Trudy Busch Valentine School of Nursing",
    "School of Education",
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    # Existing targets — for de-dup
    existing = parse_targets()
    existing_norm = {normalize_name(name) for _, name, _, _ in existing}
    next_id = max((fid for fid, _, _, _ in existing), default=0) + 1
    print(f"Existing targets: {len(existing)}; next ID = {next_id}", file=sys.stderr)

    # Directory rows
    with DIRECTORY_FILE.open() as f:
        dir_rows = list(csv.DictReader(f))

    # Filter to Ph.D., active (not emeritus, not Madrid), not duplicate
    seen_urls = set()
    seen_norm = set()
    new_entries = []
    for r in dir_rows:
        if r.get("is_madrid") == "True":
            continue
        if r.get("is_emeritus") == "True":
            continue
        if r.get("degree") != "Ph.D.":
            continue
        if r["slu_url"] in seen_urls:
            continue
        if r["norm_name"] in seen_norm:
            continue
        seen_urls.add(r["slu_url"])
        seen_norm.add(r["norm_name"])
        if r["norm_name"] in existing_norm:
            continue
        new_entries.append(r)

    print(f"New Ph.D. entries to add: {len(new_entries)}", file=sys.stderr)

    # Group by school then department, preserving sensible orders
    by_school = defaultdict(lambda: defaultdict(list))
    for r in new_entries:
        by_school[r["school"]][r["department"] or "(unknown)"].append(r)

    # Counts per school
    print("\nNew Ph.D. by school:", file=sys.stderr)
    for s in SCHOOL_ORDER:
        if s in by_school:
            n = sum(len(v) for v in by_school[s].values())
            print(f"  {s:50} +{n}", file=sys.stderr)
    extras = set(by_school) - set(SCHOOL_ORDER)
    for s in extras:
        n = sum(len(v) for v in by_school[s].values())
        print(f"  {s:50} +{n}", file=sys.stderr)

    if args.dry_run:
        return

    # Build appendix text
    lines = ["", "---", "", "# Phase 2 additions (2026-04-08)",
             "", f"Appended {len(new_entries)} new active Ph.D. faculty pulled from "
             "the new schools' directory pages and from re-running extract_directory.py "
             "across the original three schools. Strict Ph.D. filter (Ed.D./DNP/DSW/etc. "
             "excluded — see directory.csv for the broader doctoral list).", ""]

    cur_id = next_id
    for s in SCHOOL_ORDER + sorted(extras):
        if s not in by_school:
            continue
        depts = by_school[s]
        total = sum(len(v) for v in depts.values())
        lines.append(f"## {s} ({total} new)")
        lines.append("")
        # sort departments alphabetically with "Office of the Dean" first
        dept_keys = sorted(depts.keys(), key=lambda d: (0 if "Dean" in d else 1, d))
        for dept in dept_keys:
            faculty = sorted(depts[dept], key=lambda r: r["raw_name"])
            lines.append(f"### {dept} ({len(faculty)})")
            for r in faculty:
                clean_name = clean_display_name(r["raw_name"])
                lines.append(f"{cur_id}. {clean_name}")
                cur_id += 1
            lines.append("")
        lines.append("")

    appendix = "\n".join(lines)

    with TARGETS_FILE.open("a") as f:
        f.write(appendix)

    print(f"\nAppended {len(new_entries)} entries (IDs {next_id}–{cur_id - 1}) to targets.md",
          file=sys.stderr)


if __name__ == "__main__":
    main()
