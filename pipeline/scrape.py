#!/usr/bin/env python3
"""
Scrape Google Scholar h-index for SLU faculty listed in targets.md.

Hybrid approach:
  1. SerpAPI google engine -> Google search for each faculty's Scholar profile URL
     (the dedicated google_scholar_profiles endpoint was discontinued)
  2. Direct HTTP fetch of public profile page -> parse h-index from HTML ($0)

  ~94 SerpAPI calls total — fits in 100/month free tier.

Reads:  targets.md, .env (SERPAPI_KEY)
Writes: results.csv   (incremental — can resume on crash)
        failures.log  (names that need manual review)

Usage:
    uv run python scrape.py                    # full run
    uv run python scrape.py --test             # first 3, no delays
    uv run python scrape.py --limit 10
    uv run python scrape.py --names "Name1" "Name2"
"""

import argparse
import csv
import os
import random
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

HERE = Path(__file__).parent
TARGETS_FILE = HERE / "targets.md"
RESULTS_FILE = HERE / "results.csv"
FAILURES_FILE = HERE / "failures.log"

load_dotenv(HERE / ".env")
SERPAPI_KEY = os.environ.get("SERPAPI_KEY")
BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY")

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

CSV_FIELDS = [
    "id", "name", "school", "department", "slu_url",
    "scholar_id", "scholar_url", "matched_affiliation",
    "h_index", "h_index_5y", "i10_index", "i10_index_5y",
    "citations", "citations_5y", "status",
]

# ─── targets.md parser ───────────────────────────────────────────────────────

SCHOOL_RE = re.compile(r"^## (.+?)(?:\s*\([^)]*\))?\s*$")
DEPT_RE = re.compile(r"^### (.+?)(?:\s*\([^)]*\))?\s*$")
NAME_RE = re.compile(r"^(\d+)\.\s+(.+?)\s*$")
ITALIC_NOTE_RE = re.compile(r"\s*\*\([^)]*\)\*\s*$")


def parse_targets():
    rows = []
    school = None
    department = None
    in_school = False

    for line in TARGETS_FILE.read_text().splitlines():
        line = line.rstrip()

        m = SCHOOL_RE.match(line)
        if m:
            title = m.group(1).strip()
            if "edge case" in title.lower() or title.lower().startswith("count"):
                in_school = False
            else:
                in_school = True
                school = title
                department = None
            continue

        if not in_school:
            continue

        m = DEPT_RE.match(line)
        if m:
            department = m.group(1).strip()
            continue

        if school and department:
            m = NAME_RE.match(line)
            if m:
                fid = int(m.group(1))
                raw = m.group(2).strip()
                name = ITALIC_NOTE_RE.sub("", raw).strip()
                rows.append((fid, name, school, department))

    return rows


def load_done_ids():
    if not RESULTS_FILE.exists():
        return set()
    with RESULTS_FILE.open() as f:
        return {int(r["id"]) for r in csv.DictReader(f)}


def append_result(row):
    write_header = not RESULTS_FILE.exists()
    with RESULTS_FILE.open("a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if write_header:
            w.writeheader()
        w.writerow(row)


def log_failure(msg):
    with FAILURES_FILE.open("a") as f:
        f.write(msg + "\n")


def is_slu(affiliation):
    """Recognize SLU affiliations. Includes the literal university name in
    several spellings plus uniquely-SLU sub-school names (Chaifetz, Doisy,
    Trudy Busch Valentine) and the slu.edu email domain marker."""
    if not affiliation:
        return False
    a = affiliation.lower()
    return (
        "saint louis university" in a
        or "st. louis university" in a
        or "st louis university" in a
        or "chaifetz" in a                    # Chaifetz School of Business
        or "doisy" in a                       # Doisy College of Health Sciences
        or "trudy busch valentine" in a       # Trudy Busch Valentine School of Nursing
        or "slu.edu" in a                     # SLU email domain
    )


# ─── Search step (Brave or SerpAPI) ──────────────────────────────────────────

USER_ID_RE = re.compile(r"citations\?user=([A-Za-z0-9_-]+)")


def clean_query_name(name):
    """Strip parenthetical aliases like 'Xu (Frank) Wang' -> 'Xu Wang'."""
    return re.sub(r"\s*\([^)]*\)\s*", " ", name).strip()


def _build_query_strict(name):
    """Strict site-scoped query — works well on Google's index (SerpAPI)."""
    return f'"{clean_query_name(name)}" "Saint Louis" site:scholar.google.com/citations'


def _build_query_loose(name):
    """Broader query without site: filter — needed for Brave whose index of
    scholar.google.com pages is sparse. Returns hits to scholar.google.com mixed
    with university bios, Wikipedia, etc.; the find_best_match step filters by
    URL pattern + last-name match."""
    return f'"{clean_query_name(name)}" Google Scholar Saint Louis'


def serpapi_search(name):
    """SerpAPI google engine. Returns list of result dicts with 'link' and 'title'."""
    if not SERPAPI_KEY:
        raise RuntimeError("SERPAPI_KEY not set in .env")
    params = {"engine": "google", "q": _build_query_strict(name), "api_key": SERPAPI_KEY}
    r = requests.get("https://serpapi.com/search.json", params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(f"SerpAPI: {data['error']}")
    return data.get("organic_results", [])


def brave_search(name):
    """Brave Search API. Uses the looser query format because Brave's index of
    scholar.google.com is sparse — the strict site: query returns 0 hits even
    for known-good profiles."""
    if not BRAVE_API_KEY:
        raise RuntimeError("BRAVE_API_KEY not set in .env")
    headers = {
        "X-Subscription-Token": BRAVE_API_KEY,
        "Accept": "application/json",
    }
    params = {"q": _build_query_loose(name)}
    r = requests.get(
        "https://api.search.brave.com/res/v1/web/search",
        headers=headers,
        params=params,
        timeout=30,
    )
    if r.status_code == 422:
        return []
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(f"Brave: {data['error']}")
    web_results = data.get("web", {}).get("results", []) or []
    return [
        {
            "link": w.get("url", ""),
            "title": w.get("title", ""),
            "snippet": w.get("description", ""),
        }
        for w in web_results
    ]


SEARCH_ENGINES = {
    "brave": brave_search,
    "serpapi": serpapi_search,
}


def find_best_match(name, results):
    """Pick the first organic_result whose link is a Scholar profile and whose
    title plausibly matches the queried name. Returns (author_id, title) or (None, None)."""
    clean = clean_query_name(name).lower()
    tokens = clean.split()
    if not tokens:
        return None, None
    last_name = tokens[-1]

    for r in results:
        link = r.get("link", "")
        m = USER_ID_RE.search(link)
        if not m:
            continue
        title = r.get("title", "").lower()
        if last_name in title:
            return m.group(1), r.get("title", "")
    return None, None


# ─── Direct profile-page fetch + parse ───────────────────────────────────────

def fetch_profile_html(author_id):
    url = f"https://scholar.google.com/citations?user={author_id}&hl=en"
    r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    r.raise_for_status()
    return r.text


def parse_profile_metrics(html):
    """Parse h-index, i10-index, citations from profile HTML."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", id="gsc_rsb_st")
    metrics = {}
    if table:
        for row in table.find("tbody").find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 3:
                continue
            label = cells[0].get_text(strip=True).lower()
            try:
                all_val = int(cells[1].get_text(strip=True))
                recent_val = int(cells[2].get_text(strip=True))
            except ValueError:
                continue
            if label == "citations":
                metrics["citations"] = all_val
                metrics["citations_5y"] = recent_val
            elif label == "h-index":
                metrics["h_index"] = all_val
                metrics["h_index_5y"] = recent_val
            elif label == "i10-index":
                metrics["i10_index"] = all_val
                metrics["i10_index_5y"] = recent_val

    aff_div = soup.find("div", class_="gsc_prf_il")
    if aff_div:
        metrics["affiliation"] = aff_div.get_text(strip=True)
    return metrics


# ─── Per-faculty pipeline ────────────────────────────────────────────────────

def scrape_one(fid, name, school, department, search_fn=brave_search, slu_url_lookup=None):
    base = {f: "" for f in CSV_FIELDS}
    base.update({"id": fid, "name": name, "school": school, "department": department})
    if slu_url_lookup is not None:
        base["slu_url"] = slu_url_lookup.get(name, "")

    try:
        results = search_fn(name)
    except Exception as e:
        base["status"] = f"search_error: {type(e).__name__}: {e}"
        return base

    if not results:
        base["status"] = "no_search_results"
        return base

    author_id, matched_title = find_best_match(name, results)
    if not author_id:
        base["status"] = "no_match_in_results"
        return base

    base["scholar_id"] = author_id
    base["scholar_url"] = f"https://scholar.google.com/citations?user={author_id}"

    try:
        html = fetch_profile_html(author_id)
    except Exception as e:
        base["status"] = f"fetch_error: {type(e).__name__}: {e}"
        return base

    metrics = parse_profile_metrics(html)
    if not metrics or "h_index" not in metrics:
        base["status"] = "parse_error"
        return base

    affiliation = metrics.get("affiliation", "")
    base["matched_affiliation"] = affiliation

    if is_slu(affiliation):
        base["status"] = "found"
        base["h_index"] = metrics.get("h_index", "")
        base["h_index_5y"] = metrics.get("h_index_5y", "")
        base["i10_index"] = metrics.get("i10_index", "")
        base["i10_index_5y"] = metrics.get("i10_index_5y", "")
        base["citations"] = metrics.get("citations", "")
        base["citations_5y"] = metrics.get("citations_5y", "")
    else:
        # The Scholar profile we found belongs to a different person (same name).
        # Clear the metrics — they don't belong to our SLU faculty member.
        # Keep matched_affiliation as a breadcrumb for manual review.
        base["status"] = "wrong_person"
        base["scholar_id"] = ""
        base["scholar_url"] = ""

    return base


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", choices=list(SEARCH_ENGINES), default="brave",
                    help="Search engine for the profile lookup step (default: brave)")
    ap.add_argument("--test", action="store_true", help="First 3 names, no delays")
    ap.add_argument("--limit", type=int, help="Stop after N names")
    ap.add_argument("--names", nargs="+", help="Run only these specific names")
    ap.add_argument("--min-delay", type=float, default=0.8)
    ap.add_argument("--max-delay", type=float, default=1.4)
    args = ap.parse_args()

    search_fn = SEARCH_ENGINES[args.engine]
    print(f"Using search engine: {args.engine}", file=sys.stderr)

    # Load slu_url lookup from directory.csv if present
    slu_url_lookup = {}
    directory_file = HERE / "directory.csv"
    if directory_file.exists():
        from extract_directory import normalize_name
        with directory_file.open() as f:
            for r in csv.DictReader(f):
                slu_url_lookup[r["raw_name"]] = r["slu_url"]
                # also key by normalized name for fuzzy match
                slu_url_lookup[normalize_name(r["raw_name"])] = r["slu_url"]

    def lookup_slu_url(name):
        from extract_directory import normalize_name
        return slu_url_lookup.get(name) or slu_url_lookup.get(normalize_name(name), "")

    # Wrap into a dict so scrape_one can call .get() on it
    class _Lookup:
        def get(self, name, default=""):
            return lookup_slu_url(name) or default

    slu_lookup_obj = _Lookup() if slu_url_lookup else None

    targets = parse_targets()
    print(f"Parsed {len(targets)} targets from {TARGETS_FILE.name}", file=sys.stderr)

    if args.names:
        wanted = set(args.names)
        targets = [t for t in targets if t[1] in wanted]
    if args.test:
        targets = targets[:3]
        args.min_delay = args.max_delay = 0
    if args.limit:
        targets = targets[: args.limit]

    done = load_done_ids()
    todo = [t for t in targets if t[0] not in done]
    print(f"{len(done)} already done, {len(todo)} to scrape", file=sys.stderr)

    for i, (fid, name, school, department) in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] #{fid} {name} ({department})... ",
              end="", flush=True, file=sys.stderr)
        result = scrape_one(fid, name, school, department, search_fn=search_fn, slu_url_lookup=slu_lookup_obj)
        append_result(result)

        status = result["status"]
        if status.startswith("found") or status.startswith("ambiguous"):
            print(f"{status}  h={result['h_index']} cites={result['citations']}",
                  file=sys.stderr)
        else:
            print(status, file=sys.stderr)
            log_failure(f"#{fid} {name} ({school}/{department}): {status}")

        if i < len(todo) and args.max_delay > 0:
            time.sleep(random.uniform(args.min_delay, args.max_delay))

    print("Done.", file=sys.stderr)


if __name__ == "__main__":
    main()
