#!/usr/bin/env python3
"""
Derive two cleanup columns from bio_title and bio_department:

  admin_role    - one of: Dean | Associate Dean | Chair | Director | Coordinator | ""
                  Lets us filter or compare dean-track / chair-track faculty separately.
                  "Dean" covers deans and provosts; "Associate Dean" covers associate /
                  assistant / vice deans and provosts.

  department    - reclassified where the current label is a generic bucket
                  ("Office of the Dean", "Teacher Education Faculty", blank, etc.)
                  and bio_department gives us the real home department.

Reclassification is deliberately conservative:
  - Only touches rows whose current department is in GENERIC_DEPT_LABELS.
  - Only uses bio_department when it's non-blank AND not itself a generic label
    AND doesn't just repeat the school name (single-dept schools like SSW / SON
    genuinely have "Faculty" as their whole department — we leave those alone).
  - "Department of X" is normalized to "X".

Usage:
    uv run python classify.py
    uv run python classify.py --dry-run
"""

import argparse
import csv
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
RESULTS_FILE = HERE / "results.csv"

NEW_FIELDS = ["admin_role"]

# Labels that came from directory-parser fallbacks, not real departments.
# Nursing "Faculty" is intentionally EXCLUDED because the Trudy Busch Valentine
# School of Nursing genuinely has one faculty pool — "Faculty" is the real dept.
GENERIC_DEPT_LABELS = {
    "",
    "Office of the Dean",
    "Teacher Education Faculty",
    "Program Option Coordinators and Directors",
    "Administration",
    "Educational Leadership Faculty",
    "Educational Studies Faculty",
    "Higher Education Faculty",
    "Catholic Educational Leadership Faculty",
}

# Spelling variants in bio_department that should merge with the canonical
# dept label already used elsewhere in results.csv. Keys are the variants we've
# observed; values are the canonical form.
DEPT_ALIASES = {
    "Education Studies": "Educational Studies",
    "Education Leadership": "Educational Leadership",
    "Earth, Environmental and Geospatial Science": "Earth, Environmental and Geospatial Sciences",
}

# When bio_department is blank, try to pull the home department out of the
# bio_title — SLU titles like "Associate Professor of Aviation Science" or
# "Professor of Biomedical Engineering; Department Chair" are very common.
_TITLE_DEPT_RE = re.compile(
    r"(?:Associate|Assistant|Clinical|Visiting|Research|Distinguished)?\s*"
    r"Professor\s+of\s+([A-Z][A-Za-z ,'&\-]+?)(?:\s*;|\s*,|$)",
    re.IGNORECASE,
)


def extract_admin_role(bio_title):
    """Return the highest admin role inferred from a bio_title, or ''.

    Priority: Dean > Associate Dean > Chair > Director > Coordinator.
    Carefully distinguishes 'Department Chair' (admin role) from
    '[Name] Endowed Chair in [Field]' (titled professorship, not admin).
    """
    if not bio_title:
        return ""
    s = bio_title.strip()
    low = s.lower()

    # 1. Pure Dean / Provost — the word "dean" not prefixed by associate/assistant/vice.
    if re.search(r"(?<!associate\s)(?<!assistant\s)(?<!vice\s)\bdean\b", low):
        return "Dean"
    if (
        re.search(r"\bprovost\b", low)
        and not re.search(r"(?:associate|assistant|vice)\s+provost", low)
    ):
        return "Dean"

    # 2. Associate / Assistant / Vice Dean or Provost.
    if re.search(r"(?:associate|assistant|vice)\s+(?:dean|provost)\b", low):
        return "Associate Dean"

    # 3. Chair — parsed clause-by-clause so endowed-chair professorships don't match.
    # Split on both ; and , because both appear as clause separators in titles.
    for clause in re.split(r"[;,]", s):
        cl = clause.strip().lower()
        if not cl:
            continue
        if "department chair" in cl or "department chairperson" in cl:
            return "Chair"
        if "associate chair" in cl and "endowed" not in cl:
            return "Chair"
        # Bare "Chair" as a clause-opener: matches "Chair", "Chair and Professor",
        # etc. Excludes "Chair in <field>" / "Chair of <field>" (endowed names).
        if re.match(r"^chair\b", cl) and not re.match(r"^chair\s+(?:in|of|for)\b", cl):
            return "Chair"

    # 4. Director.
    if re.search(r"\bdirector\b", low):
        return "Director"

    # 5. Coordinator.
    if re.search(r"\bcoordinator\b", low):
        return "Coordinator"

    return ""


def normalize_dept(bio_dept):
    """'Department of Chemistry' -> 'Chemistry'. Applies known-variant aliases."""
    if not bio_dept:
        return ""
    d = bio_dept.strip()
    m = re.match(r"^Department\s+of\s+(.+)$", d, re.IGNORECASE)
    if m:
        d = m.group(1).strip()
    return DEPT_ALIASES.get(d, d)


def extract_dept_from_title(bio_title):
    """Pull 'X' out of '[Associate/Assistant/...]Professor of X' if present.
    Returns '' if no match. Used as a fallback when bio_department is blank."""
    if not bio_title:
        return ""
    m = _TITLE_DEPT_RE.search(bio_title)
    if not m:
        return ""
    dept = m.group(1).strip().rstrip(".,;")
    # Drop trailing "and ..." tails like "Professor of Biology and Director..."
    dept = re.split(r"\s+and\s+", dept, maxsplit=1)[0].strip()
    return DEPT_ALIASES.get(dept, dept)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rows = list(csv.DictReader(RESULTS_FILE.open()))
    print(f"Loaded {len(rows)} rows", file=sys.stderr)

    fieldnames = list(rows[0].keys())
    for f in NEW_FIELDS:
        if f not in fieldnames:
            fieldnames.append(f)

    # Pass 1: admin_role
    role_counts = {}
    for r in rows:
        role = extract_admin_role(r.get("bio_title", ""))
        r["admin_role"] = role
        role_counts[role] = role_counts.get(role, 0) + 1

    print("\nAdmin role distribution:", file=sys.stderr)
    for role in ("Dean", "Associate Dean", "Chair", "Director", "Coordinator", ""):
        n = role_counts.get(role, 0)
        if n:
            label = role if role else "(no admin role)"
            print(f"  {n:>4}  {label}", file=sys.stderr)

    # Pass 2: reclassify generic department labels using bio_department,
    # falling back to bio_title extraction.
    reclassified = []
    for r in rows:
        dept = r["department"]
        if dept not in GENERIC_DEPT_LABELS:
            continue
        new_dept = normalize_dept(r.get("bio_department", ""))
        source = "bio_department"
        if not new_dept:
            new_dept = extract_dept_from_title(r.get("bio_title", ""))
            source = "bio_title"
        if not new_dept:
            continue
        if new_dept in GENERIC_DEPT_LABELS:
            continue
        # Skip if new_dept just repeats the school name (single-dept schools).
        if new_dept.lower() in (r["school"] or "").lower():
            continue
        reclassified.append((r["id"], r["name"], dept, new_dept, source))
        r["department"] = new_dept

    # Pass 3: normalize remaining department labels via alias map (fixes
    # variant spellings in rows that were already populated, not just the
    # ones reclassified above).
    alias_fixes = []
    for r in rows:
        if r["department"] in DEPT_ALIASES:
            old = r["department"]
            r["department"] = DEPT_ALIASES[old]
            alias_fixes.append((r["id"], r["name"], old, r["department"]))

    print(f"\nReclassified {len(reclassified)} rows:", file=sys.stderr)
    for fid, name, old, new, source in reclassified:
        print(f"  #{fid:>3} {name:<28} {old!r:<40} -> {new!r}  ({source})",
              file=sys.stderr)

    if alias_fixes:
        print(f"\nAlias-normalized {len(alias_fixes)} rows:", file=sys.stderr)
        for fid, name, old, new in alias_fixes:
            print(f"  #{fid:>3} {name:<28} {old!r} -> {new!r}", file=sys.stderr)

    if args.dry_run:
        print("\n(dry-run — not writing)", file=sys.stderr)
        return

    with RESULTS_FILE.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})

    print(f"\nWrote {RESULTS_FILE}", file=sys.stderr)


if __name__ == "__main__":
    main()
