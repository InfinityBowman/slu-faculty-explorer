#!/usr/bin/env python3
"""
Monthly update pipeline for SLU faculty research metrics.

Refreshes Scholar and OpenAlex metrics for existing faculty, optionally detects
new/departed faculty via directory re-scrape, and produces a diff-based change
report with suspicious-change flagging.

Key safety property: existing Scholar and OpenAlex matches are refreshed BY ID
(re-fetch the known profile), NOT by re-searching.  This avoids wrong-person
regressions.  Only unmatched faculty go through the search path.

Usage:
    uv run python update.py                    # full metric refresh + change report
    uv run python update.py --with-directory   # also re-scrape SLU directory for new/departed
    uv run python update.py --rollback         # restore most recent snapshot
    uv run python update.py --dry-run          # show plan without fetching

Outputs:
    snapshots/results_YYYY-MM-DD.csv   - pre-update backup
    changes_YYYY-MM-DD.csv             - change report (id, name, column, old, new, flag)
    results.csv                        - updated dataset
    ../public/faculty.csv              - published for frontend
    ../public/benchmarks.csv           - published for frontend
"""

import argparse
import csv
import random
import shutil
import subprocess
import sys
import time
from datetime import date
from pathlib import Path

import requests

HERE = Path(__file__).parent
REPO_ROOT = HERE.parent
PUBLIC_DIR = REPO_ROOT / "public"
RESULTS_FILE = HERE / "results.csv"
BENCHMARKS_FILE = HERE / "field_benchmarks.csv"
SNAPSHOTS_DIR = HERE / "snapshots"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_csv(path):
    with open(path) as f:
        return list(csv.DictReader(f))


def save_csv(rows, path, fieldnames=None):
    if not rows:
        return
    if fieldnames is None:
        fieldnames = list(rows[0].keys())
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


# ---------------------------------------------------------------------------
# Phase 1 — Snapshot
# ---------------------------------------------------------------------------

def snapshot_results():
    """Copy results.csv -> snapshots/results_YYYY-MM-DD.csv.  Returns path."""
    SNAPSHOTS_DIR.mkdir(exist_ok=True)
    today = date.today().isoformat()
    dest = SNAPSHOTS_DIR / f"results_{today}.csv"
    n = 2
    while dest.exists():
        dest = SNAPSHOTS_DIR / f"results_{today}_{n}.csv"
        n += 1
    shutil.copy2(RESULTS_FILE, dest)
    print(f"  Snapshot saved: {dest.name}", file=sys.stderr)
    return dest


# ---------------------------------------------------------------------------
# Phase 2 — Scholar refresh (by known ID — no re-search)
# ---------------------------------------------------------------------------

def refresh_scholar(rows, delay=0.8):
    """Re-fetch Scholar profile pages for rows that already have a scholar_id.
    Updates metrics in place.  Returns count refreshed."""
    from scrape import fetch_profile_html, parse_profile_metrics, is_slu

    eligible = [
        r for r in rows
        if r.get("scholar_id") and r.get("status") in ("found", "recovered")
    ]
    if not eligible:
        print("  0 profiles to refresh", file=sys.stderr)
        return 0

    print(f"  Refreshing {len(eligible)} Scholar profiles...", file=sys.stderr)
    ok = 0
    for i, row in enumerate(eligible, 1):
        print(f"    [{i}/{len(eligible)}] {row['name'][:35]:<35} ",
              end="", flush=True, file=sys.stderr)
        try:
            html = fetch_profile_html(row["scholar_id"])
            metrics = parse_profile_metrics(html)
        except Exception as e:
            print(f"fetch error: {e}", file=sys.stderr)
            continue

        if not metrics or "h_index" not in metrics:
            print("parse error (skipped)", file=sys.stderr)
            continue

        aff = metrics.get("affiliation", "")
        if not is_slu(aff):
            # Affiliation drifted — don't silently overwrite.
            print(f"WARN affiliation now '{aff}' (skipped)", file=sys.stderr)
            continue

        for k in ("h_index", "h_index_5y", "i10_index", "i10_index_5y",
                   "citations", "citations_5y"):
            row[k] = metrics.get(k, "")
        row["matched_affiliation"] = aff
        ok += 1
        print(f"h={row['h_index']} cites={row['citations']}", file=sys.stderr)

        if i < len(eligible):
            time.sleep(random.uniform(delay * 0.8, delay * 1.2))

    print(f"  {ok}/{len(eligible)} refreshed", file=sys.stderr)
    return ok


# ---------------------------------------------------------------------------
# Phase 3 — OpenAlex refresh (by known ID — no re-search)
# ---------------------------------------------------------------------------

def refresh_openalex(rows, delay=0.2):
    """Re-fetch OpenAlex author records for rows with an existing openalex_id.
    Uses the direct /authors/{id} endpoint — no search, no re-matching risk.
    Returns count refreshed."""
    from openalex import openalex_get, extract_metrics

    eligible = [
        r for r in rows
        if r.get("openalex_id")
        and not r.get("openalex_status", "").startswith("rejected_")
    ]
    if not eligible:
        print("  0 authors to refresh", file=sys.stderr)
        return 0

    print(f"  Refreshing {len(eligible)} OpenAlex authors by ID...", file=sys.stderr)
    ok = 0
    for i, row in enumerate(eligible, 1):
        print(f"    [{i}/{len(eligible)}] {row['name'][:35]:<35} ",
              end="", flush=True, file=sys.stderr)
        try:
            author = openalex_get(f"/authors/{row['openalex_id']}")
        except Exception as e:
            print(f"error: {e}", file=sys.stderr)
            continue

        row.update(extract_metrics(author))
        ok += 1
        print(f"h={row.get('openalex_h_index', '?')} fwci={row.get('openalex_2yr_fwci', '?')}",
              file=sys.stderr)

        if i < len(eligible):
            time.sleep(delay)

    print(f"  {ok}/{len(eligible)} refreshed", file=sys.stderr)
    return ok


# ---------------------------------------------------------------------------
# New / departed faculty detection
# ---------------------------------------------------------------------------

def detect_roster_changes(rows):
    """Compare targets.md roster against results.csv.
    Returns (new_targets, departed_ids)."""
    from scrape import parse_targets

    targets = parse_targets()
    target_ids = {t[0] for t in targets}
    result_ids = {int(r["id"]) for r in rows}

    new = [t for t in targets if t[0] not in result_ids]
    departed = [r for r in rows if int(r["id"]) not in target_ids]

    if new:
        print(f"  {len(new)} new faculty in targets.md:", file=sys.stderr)
        for fid, name, school, dept in new[:10]:
            print(f"    #{fid} {name} ({dept})", file=sys.stderr)
        if len(new) > 10:
            print(f"    ... and {len(new) - 10} more", file=sys.stderr)
    if departed:
        print(f"  {len(departed)} faculty in results.csv but not in targets.md:", file=sys.stderr)
        for r in departed[:10]:
            print(f"    #{r['id']} {r['name']}", file=sys.stderr)

    return new, departed


# ---------------------------------------------------------------------------
# Diff engine
# ---------------------------------------------------------------------------

METRIC_COLS = [
    "h_index", "h_index_5y", "i10_index", "i10_index_5y",
    "citations", "citations_5y",
    "openalex_works_count", "openalex_citations",
    "openalex_h_index", "openalex_i10_index", "openalex_2yr_fwci",
    "openalex_top_topic",
    "dept_h_percentile", "dept_fwci_percentile", "dept_works_percentile",
    "field_h_percentile", "subfield_h_percentile", "primary_h_tier",
]
ID_COLS = ["scholar_id", "openalex_id"]
STATUS_COLS = ["status", "openalex_status"]
DIFF_COLS = ID_COLS + STATUS_COLS + METRIC_COLS

H_JUMP_THRESHOLD = 10  # flag h-index moves larger than this


def _flag(col, old, new):
    """Classify a single-cell change: 'high' | 'medium' | 'ok'."""
    # Identity columns swapping to a different value
    if col in ID_COLS:
        if old and new and old != new:
            return "high"
        if old and not new:
            return "medium"
        return "ok"

    # Status regressions
    if col in STATUS_COLS:
        good = ("found", "recovered")
        if old in good and new not in good:
            return "medium"
        return "ok"

    # Large h-index jumps
    if col in ("h_index", "openalex_h_index"):
        try:
            if abs(int(new) - int(old)) > H_JUMP_THRESHOLD:
                return "medium"
        except (ValueError, TypeError):
            pass
        return "ok"

    return "ok"


def diff_results(old_rows, new_rows):
    """Column-by-column diff.  Returns list of change dicts."""
    old_map = {r["id"]: r for r in old_rows}
    new_map = {r["id"]: r for r in new_rows}
    changes = []

    # Departed (in old, not in new)
    for fid, r in old_map.items():
        if fid not in new_map:
            changes.append(dict(id=fid, name=r["name"], type="departed",
                                column="", old_value="", new_value="",
                                flag="info"))

    for fid, nr in new_map.items():
        # New row
        if fid not in old_map:
            changes.append(dict(id=fid, name=nr["name"], type="new",
                                column="", old_value="",
                                new_value=f"{nr.get('school','')}/{nr.get('department','')}",
                                flag="info"))
            continue

        # Column-level changes
        orr = old_map[fid]
        for col in DIFF_COLS:
            ov = str(orr.get(col, "")).strip()
            nv = str(nr.get(col, "")).strip()
            if ov == nv:
                continue
            changes.append(dict(id=fid, name=nr["name"], type="changed",
                                column=col, old_value=ov, new_value=nv,
                                flag=_flag(col, ov, nv)))

    return changes


def write_change_report(changes, path):
    if not changes:
        return
    fields = ["flag", "id", "name", "type", "column", "old_value", "new_value"]
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for c in sorted(changes, key=lambda c: (
            {"high": 0, "medium": 1, "info": 2, "ok": 3}[c["flag"]],
            int(c["id"]),
        )):
            w.writerow(c)


def print_summary(changes, report_path):
    if not changes:
        print("\nNo changes detected.", file=sys.stderr)
        return

    new_ct = sum(1 for c in changes if c["type"] == "new")
    dep_ct = sum(1 for c in changes if c["type"] == "departed")
    chg_ids = set(c["id"] for c in changes if c["type"] == "changed")
    high = [c for c in changes if c["flag"] == "high"]
    med = [c for c in changes if c["flag"] == "medium"]

    print(f"\n{'=' * 60}", file=sys.stderr)
    print("CHANGE REPORT", file=sys.stderr)
    print(f"{'=' * 60}", file=sys.stderr)
    print(f"  New faculty:      {new_ct}", file=sys.stderr)
    print(f"  Departed:         {dep_ct}", file=sys.stderr)
    print(f"  Faculty updated:  {len(chg_ids)}", file=sys.stderr)
    print(f"  Column changes:   {sum(1 for c in changes if c['type'] == 'changed')}",
          file=sys.stderr)

    if high:
        print(f"\n  ** HIGH ({len(high)}) — possible wrong-person match:", file=sys.stderr)
        for c in high:
            print(f"     #{c['id']} {c['name']}: {c['column']} "
                  f"'{c['old_value']}' -> '{c['new_value']}'", file=sys.stderr)

    if med:
        print(f"\n  * MEDIUM ({len(med)}) — worth reviewing:", file=sys.stderr)
        for c in med:
            print(f"     #{c['id']} {c['name']}: {c['column']} "
                  f"'{c['old_value']}' -> '{c['new_value']}'", file=sys.stderr)

    print(f"\n  Full report: {report_path.name}", file=sys.stderr)
    print(f"  To rollback:  uv run python update.py --rollback", file=sys.stderr)
    print(f"{'=' * 60}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Publish to public/ (frontend consumes these)
# ---------------------------------------------------------------------------

def publish():
    """Copy final CSVs to public/ so the frontend picks them up."""
    shutil.copy2(RESULTS_FILE, PUBLIC_DIR / "faculty.csv")
    print(f"  Published results.csv -> public/faculty.csv", file=sys.stderr)
    if BENCHMARKS_FILE.exists():
        shutil.copy2(BENCHMARKS_FILE, PUBLIC_DIR / "benchmarks.csv")
        print(f"  Published field_benchmarks.csv -> public/benchmarks.csv", file=sys.stderr)


# ---------------------------------------------------------------------------
# Rollback
# ---------------------------------------------------------------------------

def rollback():
    if not SNAPSHOTS_DIR.exists():
        print("No snapshots directory.", file=sys.stderr)
        return False
    snaps = sorted(SNAPSHOTS_DIR.glob("results_*.csv"))
    if not snaps:
        print("No snapshots found.", file=sys.stderr)
        return False
    latest = snaps[-1]
    shutil.copy2(latest, RESULTS_FILE)
    print(f"Restored {latest.name} -> results.csv", file=sys.stderr)
    publish()
    return True


# ---------------------------------------------------------------------------
# Shell out to existing scripts
# ---------------------------------------------------------------------------

def _run(script, *extra_args):
    cmd = ["uv", "run", "python", script, *extra_args]
    print(f"  Running: {' '.join(cmd)}", file=sys.stderr)
    subprocess.run(cmd, cwd=str(HERE), check=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description="Monthly update pipeline for SLU faculty research metrics")
    ap.add_argument("--with-directory", action="store_true",
                    help="Re-scrape SLU directory for new/departed faculty")
    ap.add_argument("--rollback", action="store_true",
                    help="Restore most recent snapshot and exit")
    ap.add_argument("--dry-run", action="store_true",
                    help="Show what would happen without fetching")
    ap.add_argument("--scholar-delay", type=float, default=0.8)
    ap.add_argument("--openalex-delay", type=float, default=0.2)
    args = ap.parse_args()

    if args.rollback:
        rollback()
        return

    if not RESULTS_FILE.exists():
        print("No results.csv — run the initial pipeline first.", file=sys.stderr)
        sys.exit(1)

    # ── Phase 1: Snapshot ──────────────────────────────────────────────────
    print("Phase 1: Snapshot", file=sys.stderr)
    snap = snapshot_results()
    old_rows = load_csv(snap)

    # ── Phase 2: Directory refresh (optional) ──────────────────────────────
    if args.with_directory:
        print("\nPhase 2: Directory refresh", file=sys.stderr)
        if not args.dry_run:
            _run("extract_directory.py")
            _run("update_targets.py")
        else:
            print("  (dry run — skipped)", file=sys.stderr)

    # ── Phase 3: Scholar refresh (existing matches by ID) ──────────────────
    print("\nPhase 3: Scholar refresh", file=sys.stderr)
    rows = load_csv(RESULTS_FILE)
    fieldnames = list(rows[0].keys())

    if not args.dry_run:
        refresh_scholar(rows, delay=args.scholar_delay)
        save_csv(rows, RESULTS_FILE, fieldnames)
    else:
        n = sum(1 for r in rows
                if r.get("scholar_id") and r.get("status") in ("found", "recovered"))
        print(f"  (dry run) Would refresh {n} Scholar profiles", file=sys.stderr)

    # ── Phase 4: OpenAlex refresh (existing matches by ID) ─────────────────
    print("\nPhase 4: OpenAlex refresh", file=sys.stderr)
    if not args.dry_run:
        refresh_openalex(rows, delay=args.openalex_delay)
        save_csv(rows, RESULTS_FILE, fieldnames)
    else:
        n = sum(1 for r in rows
                if r.get("openalex_id")
                and not r.get("openalex_status", "").startswith("rejected_"))
        print(f"  (dry run) Would refresh {n} OpenAlex authors", file=sys.stderr)

    # ── Phase 5: New faculty (scrape + search for unmatched) ───────────────
    new_targets, departed = detect_roster_changes(rows)

    if new_targets and not args.dry_run:
        print(f"\nPhase 5: Scraping {len(new_targets)} new faculty", file=sys.stderr)
        _run("scrape.py")
        _run("retry.py")
        # OpenAlex search for rows still without a match (new + old unmatched)
        _run("openalex.py")
        _run("extract_bio.py")
        rows = load_csv(RESULTS_FILE)
        fieldnames = list(rows[0].keys())
    elif not new_targets:
        # Still try OpenAlex search for previously-unmatched rows
        unmatched = [r for r in rows
                     if not r.get("openalex_id")
                     and not r.get("openalex_status", "").startswith("rejected_")
                     and r.get("openalex_status") != "not_found"]
        if unmatched and not args.dry_run:
            print(f"\nPhase 5: OpenAlex search for {len(unmatched)} unmatched",
                  file=sys.stderr)
            _run("openalex.py")
            rows = load_csv(RESULTS_FILE)
            fieldnames = list(rows[0].keys())

    # ── Phase 6: Recompute derived columns ─────────────────────────────────
    print("\nPhase 6: Recompute", file=sys.stderr)
    if not args.dry_run:
        _run("classify.py")
        _run("compute.py")
        _run("field_benchmark.py")
        rows = load_csv(RESULTS_FILE)

    # ── Phase 7: Diff + report ─────────────────────────────────────────────
    print("\nPhase 7: Change report", file=sys.stderr)
    new_rows = rows if not args.dry_run else old_rows
    changes = diff_results(old_rows, new_rows)

    today = date.today().isoformat()
    report = HERE / f"changes_{today}.csv"
    write_change_report(changes, report)
    print_summary(changes, report)

    # ── Phase 8: Publish to public/ ───────────────────────────────────────
    if not args.dry_run:
        print("\nPhase 8: Publish", file=sys.stderr)
        publish()


if __name__ == "__main__":
    main()
