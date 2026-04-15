#!/usr/bin/env python3
"""
Extract faculty name + bio URL + (school, department) from each SLU directory page.

Outputs:
  - directory.csv  : full extraction (name, school, department, slu_url, raw_text)
  - prints diff against current targets.md so we can spot missing/changed names

Usage:
    uv run python extract_directory.py
    uv run python extract_directory.py --diff-only
"""

import argparse
import csv
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup, NavigableString

from scrape import parse_targets, clean_query_name

HERE = Path(__file__).parent
DIRECTORY_CSV = HERE / "directory.csv"

BASE = "https://www.slu.edu"

# Each entry is one URL to fetch. Multiple entries can share the same school.
# default_department is used when the page doesn't have a department-level header
# (e.g. SSE/A&S departments where the URL itself names the department).
DIRECTORIES = [
    # ── Chaifetz School of Business ──
    {
        "school": "Chaifetz School of Business",
        "url": f"{BASE}/business/about/faculty/directory.php",
        "link_path_substrings": ["/business/about/faculty/"],
        "default_department": None,
    },
    {
        "school": "Chaifetz School of Business",
        "url": f"{BASE}/business/about/leadership.php",
        "link_path_substrings": ["/business/about/faculty/"],
        "default_department": "Office of the Dean",
    },

    # ── College for Public Health and Social Justice ──
    {
        "school": "College for Public Health and Social Justice",
        "url": f"{BASE}/public-health-social-justice/faculty/index.php",
        "link_path_substrings": ["/public-health-social-justice/faculty/"],
        "default_department": None,
    },

    # ── School of Social Work ──
    {
        "school": "School of Social Work",
        "url": f"{BASE}/social-work/faculty/index.php",
        # Cara Wallace cross-listed under /nursing/
        "link_path_substrings": ["/social-work/faculty/", "/nursing/faculty/"],
        "default_department": None,
    },

    # ── School of Science and Engineering ──
    {
        "school": "School of Science and Engineering",
        "url": f"{BASE}/science-and-engineering/faculty/index.php",
        "link_path_substrings": ["/science-and-engineering/"],
        "default_department": "Office of the Dean",
    },
    {
        "school": "School of Science and Engineering",
        "url": f"{BASE}/science-and-engineering/about/leadership.php",
        "link_path_substrings": ["/science-and-engineering/"],
        "default_department": "Office of the Dean",
    },
    {
        "school": "School of Science and Engineering",
        "url": f"{BASE}/science-and-engineering/academics/aerospace-and-mechanical-engineering/faculty/index.php",
        "link_path_substrings": ["/science-and-engineering/"],
        "default_department": "Aerospace and Mechanical Engineering",
    },
    {
        "school": "School of Science and Engineering",
        "url": f"{BASE}/science-and-engineering/academics/parks-aviation-science/faculty/index.php",
        "link_path_substrings": ["/science-and-engineering/"],
        "default_department": "Aviation Science",
    },
    {
        "school": "School of Science and Engineering",
        "url": f"{BASE}/science-and-engineering/academics/biomedical-engineering/faculty/index.php",
        "link_path_substrings": ["/science-and-engineering/"],
        "default_department": "Biomedical Engineering",
    },
    {
        "school": "School of Science and Engineering",
        "url": f"{BASE}/science-and-engineering/academics/chemistry/faculty/index.php",
        "link_path_substrings": ["/science-and-engineering/"],
        "default_department": "Chemistry",
    },
    {
        "school": "School of Science and Engineering",
        "url": f"{BASE}/science-and-engineering/academics/civil-engineering/faculty/index.php",
        "link_path_substrings": ["/science-and-engineering/"],
        "default_department": "Civil Engineering",
    },
    {
        "school": "School of Science and Engineering",
        "url": f"{BASE}/science-and-engineering/academics/computer-science/faculty-and-staff/index.php",
        "link_path_substrings": ["/science-and-engineering/"],
        "default_department": "Computer Science",
    },
    {
        "school": "School of Science and Engineering",
        "url": f"{BASE}/science-and-engineering/academics/electrical-and-computer-engineering/faculty/index.php",
        "link_path_substrings": ["/science-and-engineering/"],
        "default_department": "Electrical and Computer Engineering",
    },
    {
        "school": "School of Science and Engineering",
        "url": f"{BASE}/science-and-engineering/academics/earth-environmental-geospatial-science/faculty/index.php",
        "link_path_substrings": ["/science-and-engineering/"],
        "default_department": "Earth, Environmental and Geospatial Sciences",
    },

    # ── College of Arts and Sciences (15 active dept faculty pages) ──
    *[
        {
            "school": "College of Arts and Sciences",
            "url": f"{BASE}/arts-and-sciences/{slug}/faculty/index.php",
            "link_path_substrings": ["/arts-and-sciences/"],
            "default_department": dept,
        }
        for slug, dept in [
            ("biology", "Biology"),
            ("english", "English"),
            ("history", "History"),
            ("philosophy", "Philosophy"),
            ("psychology", "Psychology"),
            ("political-science", "Political Science"),
            ("sociology-anthropology", "Sociology and Anthropology"),
            ("mathematics-statistics", "Mathematics and Statistics"),
            ("theological-studies", "Theological Studies"),
            ("visual-and-performing-arts", "Visual and Performing Arts"),
            ("linguistics-literatures-cultures", "Linguistics, Literatures and Cultures"),
            ("american-studies", "American Studies"),
            ("african-american-studies", "African American Studies"),
            ("women-gender-studies", "Women's and Gender Studies"),
            ("bioethics", "Health Care Ethics"),
            ("communication", "Communication"),
        ]
    ],

    # ── College of Philosophy and Letters ──
    {
        "school": "College of Philosophy and Letters",
        "url": f"{BASE}/philosophy-and-letters/faculty/index.php",
        # P&L cross-lists Beabout under /arts-and-sciences/philosophy/
        "link_path_substrings": ["/philosophy-and-letters/", "/arts-and-sciences/philosophy/"],
        "default_department": None,
    },

    # ── Doisy College of Health Sciences ──
    {
        "school": "Doisy College of Health Sciences",
        "url": f"{BASE}/doisy/faculty/index.php",
        "link_path_substrings": ["/doisy/faculty/"],
        "default_department": None,
    },

    # ── Trudy Busch Valentine School of Nursing ──
    {
        "school": "Trudy Busch Valentine School of Nursing",
        "url": f"{BASE}/nursing/faculty/index.php",
        "link_path_substrings": ["/nursing/faculty/"],
        "default_department": "Nursing",
    },

    # ── School of Education ──
    {
        "school": "School of Education",
        "url": f"{BASE}/education/faculty/index.php",
        "link_path_substrings": ["/education/faculty/"],
        "default_department": None,
    },
]

# bio-page URLs that look like faculty links but are actually section landing pages
NON_PERSON_PAGES = {
    "directory.php", "index.php", "research.php", "leadership.php", "staff.php",
    "emeritus-faculty.php", "graduate-assistants.php", "dean.php", "about.php",
    "faculty.php", "departments.php", "departments-programs.php",
}

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

# Strip degree suffixes for name comparison
NAME_STRIP_RE = re.compile(
    r",?\s*(Ph\.?D\.?|D\.?S\.?W\.?|Dr\.?P\.?H\.?|DHSc|D\.?H\.?Sc\.?|"
    r"M\.?D\.?|J\.?D\.?|M\.?S\.?W\.?|M\.?B\.?A\.?|M\.?A\.?|M\.?S\.?|M\.?Acc\.?|"
    r"L\.?C\.?S\.?W\.?|C\.?P\.?A\.?|C\.?D\.?F\.?T\.?|B\.?C\.?B\.?A\.?|"
    r"M\.?S\.?H\.?A\.?|M\.?P\.?H\.?|M\.?L\.?S\.?|M\.?S\.?C\.?J\.?|M\.?F\.?A\.?|"
    r"M\.?Sc\.?|M\.?Stat\.?|cand\.?)\b\.?",
    re.IGNORECASE,
)


def normalize_name(s):
    """Strip degrees, parens, punctuation, lowercase, collapse whitespace."""
    s = NAME_STRIP_RE.sub("", s)
    s = re.sub(r"\([^)]*\)", " ", s)        # strip parentheticals
    s = re.sub(r"[^A-Za-z\s\-']", " ", s)   # keep letters/spaces/hyphens/apostrophes
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def fetch(url):
    r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
    r.raise_for_status()
    return r.text


# Generic section names that should NOT override default_department.
# These appear on per-department faculty pages (e.g. "Faculty", "Research Faculty")
# but tell us nothing about which department the page is for.
GENERIC_SECTIONS = {
    "faculty", "research faculty", "full-time faculty", "teaching faculty",
    "core faculty", "clinical faculty", "affiliated faculty", "experimental faculty",
    "courtesy appointments", "secondary faculty", "secondary appointments",
    "cross-listed courses faculty", "departmental faculty leadership",
    "leadership", "faculty in focus", "supporting student wellness",
    "office of the dean", "office of the edward jones dean",
}


def extract_directory(html, school, link_substrings, default_department=None):
    """Walk the page top-to-bottom; track current h2/h3 as department.

    Behavior:
    - If default_department is set (per-URL config), it's the baseline department.
      Page headers can refine it to ' — Emeritus' or ' — Madrid' but won't replace it
      with generic labels like 'Faculty'.
    - If default_department is None, page headers become the department directly.
    """
    soup = BeautifulSoup(html, "html.parser")
    main = soup.find("main") or soup.find("div", class_="region-content") or soup

    rows = []
    current_section = None  # the most recent header we saw
    in_madrid = False
    in_emeritus = False

    for el in main.descendants:
        if isinstance(el, NavigableString):
            continue
        if el.name in ("h2", "h3", "h4"):
            txt = el.get_text(strip=True)
            if not txt:
                continue
            txt_lc = txt.lower()
            # Detect transitions
            if "madrid" in txt_lc:
                in_madrid = True
                in_emeritus = False
                current_section = txt
                continue
            if "emerit" in txt_lc or txt_lc.startswith("retired"):
                in_emeritus = True
                in_madrid = False
                current_section = txt
                continue
            # Generic section labels don't change department or emeritus state
            if txt_lc in GENERIC_SECTIONS:
                current_section = txt
                continue
            # A real, non-generic header — reset emeritus, set as current section
            in_emeritus = False
            in_madrid = False
            current_section = txt
        elif el.name == "a":
            href = el.get("href", "")
            if not any(s in href for s in link_substrings):
                continue
            slug = href.rsplit("/", 1)[-1]
            if slug in NON_PERSON_PAGES:
                continue
            if not href.endswith(".php"):
                continue
            text = el.get_text(strip=True)
            if not text or " " not in text:
                continue
            if text.lower().startswith(("learn ", "view ", "see ")):
                continue
            full_url = href if href.startswith("http") else BASE + href

            # Decide department:
            # - If default_department is set, use it (ignore generic header noise)
            # - Else use the most recent header
            if default_department:
                dept = default_department
            else:
                dept = current_section or "(unknown)"

            rows.append({
                "school": school,
                "department": dept,
                "raw_name": text,
                "norm_name": normalize_name(text),
                "slu_url": full_url,
                "is_madrid": in_madrid,
                "is_emeritus": in_emeritus,
            })

    # Dedupe by URL — same person sometimes linked twice on the page
    seen = set()
    unique = []
    for r in rows:
        if r["slu_url"] in seen:
            continue
        seen.add(r["slu_url"])
        unique.append(r)
    return unique


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--diff-only", action="store_true",
                    help="Only print diff vs targets.md, don't write directory.csv")
    args = ap.parse_args()

    all_rows = []
    for d in DIRECTORIES:
        slug = d["url"].rsplit("/", 2)[-2] if d["url"].endswith("index.php") else d["url"].rsplit("/", 1)[-1]
        print(f"Fetching {d['school']} [{slug}]...", file=sys.stderr)
        try:
            html = fetch(d["url"])
        except requests.HTTPError as e:
            print(f"  HTTP error: {e}", file=sys.stderr)
            continue
        rows = extract_directory(
            html,
            d["school"],
            d["link_path_substrings"],
            default_department=d.get("default_department"),
        )
        print(f"  {len(rows)} faculty entries", file=sys.stderr)
        all_rows.extend(rows)

    # Write directory.csv
    if not args.diff_only:
        with DIRECTORY_CSV.open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=[
                "school", "department", "raw_name", "norm_name", "slu_url",
                "is_madrid", "is_emeritus",
            ])
            w.writeheader()
            w.writerows(all_rows)
        print(f"\nWrote {DIRECTORY_CSV} ({len(all_rows)} rows)", file=sys.stderr)

    # Diff against targets.md
    targets = parse_targets()
    target_norm = {normalize_name(name): (fid, name, school, dept)
                   for fid, name, school, dept in targets}
    dir_norm = {r["norm_name"]: r for r in all_rows if not r["is_madrid"]}

    in_dir_not_targets = set(dir_norm) - set(target_norm)
    in_targets_not_dir = set(target_norm) - set(dir_norm)

    print("\n=== DIFF: in directory but NOT in targets.md ===", file=sys.stderr)
    for n in sorted(in_dir_not_targets):
        r = dir_norm[n]
        print(f"  + [{r['school'][:20]}/{r['department'][:30]}] {r['raw_name']}",
              file=sys.stderr)
    if not in_dir_not_targets:
        print("  (none)", file=sys.stderr)

    print("\n=== DIFF: in targets.md but NOT in directory ===", file=sys.stderr)
    for n in sorted(in_targets_not_dir):
        fid, name, school, dept = target_norm[n]
        print(f"  - #{fid} [{school[:20]}/{dept[:30]}] {name}", file=sys.stderr)
    if not in_targets_not_dir:
        print("  (none)", file=sys.stderr)


if __name__ == "__main__":
    main()
