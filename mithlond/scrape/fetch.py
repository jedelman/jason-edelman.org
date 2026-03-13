#!/usr/bin/env python3
"""
Mithlond scraper — fetch.py

Reads scrape/queue.yaml and fetches each source.
Handles:
  - socrata:   Socrata Open Data API → JSON
  - scc_case:  SCC docket case page → discover + download all PDFs
  - http:      Direct HTTP GET → raw file (JSON, XLSX, PDF, etc.)

Outputs committed to data/ in the repo root.
Run: python3 scrape/fetch.py [--dry-run] [--id SOURCE_ID]
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlparse

import requests
import yaml
from bs4 import BeautifulSoup

REPO_ROOT = Path(__file__).parent.parent
QUEUE_FILE = Path(__file__).parent / "queue.yaml"
LOG_FILE = REPO_ROOT / "data" / "fetch-log.json"

HEADERS = {
    "User-Agent": "Mithlond-Research-Bot/1.0 (github.com/jedelman/mithlond; research-only)"
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


# ── Helpers ──────────────────────────────────────────────────────────────────

def log(msg: str):
    print(f"[{datetime.now(timezone.utc).isoformat()}] {msg}", flush=True)


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, data, meta: dict = None):
    ensure_dir(path.parent)
    payload = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": meta or {},
        "data": data,
    }
    path.write_text(json.dumps(payload, indent=2, default=str))
    log(f"  Wrote {path} ({path.stat().st_size:,} bytes)")


def write_binary(path: Path, content: bytes):
    ensure_dir(path.parent)
    path.write_bytes(content)
    log(f"  Wrote {path} ({len(content):,} bytes)")


def append_log(entry: dict):
    ensure_dir(LOG_FILE.parent)
    entries = []
    if LOG_FILE.exists():
        try:
            entries = json.loads(LOG_FILE.read_text())
        except Exception:
            entries = []
    entries.append(entry)
    # Keep last 500 entries
    LOG_FILE.write_text(json.dumps(entries[-500:], indent=2, default=str))


# ── Fetchers ─────────────────────────────────────────────────────────────────

def fetch_socrata(source: dict, dry_run: bool) -> dict:
    host = source["host"]
    dataset_id = source["dataset_id"]
    params = source.get("params", {})
    output = REPO_ROOT / source["output"]

    url = f"https://{host}/resource/{dataset_id}.json"
    log(f"  Socrata GET {url}")
    log(f"  Params: {params}")

    if dry_run:
        return {"status": "dry-run", "url": url}

    resp = SESSION.get(url, params=params, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    log(f"  Got {len(data)} records")

    write_json(output, data, {"url": url, "params": params, "record_count": len(data)})
    return {"status": "ok", "url": url, "records": len(data), "output": str(output)}


def fetch_scc_case(source: dict, dry_run: bool) -> dict:
    case_number = source["case_number"]
    output_dir = REPO_ROOT / source["output_dir"]

    # SCC docket search URL
    case_url = f"https://scc.virginia.gov/docketsearch/CASES/summary?Id={case_number}"
    log(f"  SCC case page: {case_url}")

    if dry_run:
        return {"status": "dry-run", "url": case_url}

    resp = SESSION.get(case_url, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # Save the case summary HTML
    ensure_dir(output_dir)
    (output_dir / "summary.html").write_text(resp.text)
    log(f"  Saved case summary HTML")

    # Extract all document links (.pdf, .PDF)
    base = "https://scc.virginia.gov"
    pdf_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.lower().endswith(".pdf") or "/docs/" in href.lower():
            full = urljoin(base, href)
            if full not in pdf_links:
                pdf_links.append((full, a.get_text(strip=True)))

    log(f"  Found {len(pdf_links)} document link(s)")

    results = []
    for pdf_url, label in pdf_links:
        # Sanitize filename from URL
        parsed = urlparse(pdf_url)
        fname = Path(parsed.path).name or "document.pdf"
        # Truncate long filenames
        if len(fname) > 100:
            fname = fname[:96] + ".pdf"
        out_path = output_dir / fname

        if out_path.exists():
            log(f"  Skip (exists): {fname}")
            results.append({"url": pdf_url, "file": fname, "status": "exists"})
            continue

        try:
            log(f"  Downloading: {fname} ({label[:60]})")
            r = SESSION.get(pdf_url, timeout=60, stream=True)
            r.raise_for_status()
            content = r.content
            write_binary(out_path, content)
            results.append({"url": pdf_url, "file": fname, "label": label, "status": "ok", "bytes": len(content)})
            time.sleep(1)  # polite
        except Exception as e:
            log(f"  ERROR downloading {pdf_url}: {e}")
            results.append({"url": pdf_url, "file": fname, "status": "error", "error": str(e)})

    # Write manifest
    manifest = {
        "case_number": case_number,
        "case_url": case_url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "documents": results,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    log(f"  Manifest written to {output_dir}/manifest.json")

    return {"status": "ok", "case": case_number, "documents": len(results)}


def fetch_http(source: dict, dry_run: bool) -> dict:
    url = source["url"]
    output = REPO_ROOT / source["output"]

    log(f"  HTTP GET {url}")

    if dry_run:
        return {"status": "dry-run", "url": url}

    resp = SESSION.get(url, timeout=60)
    resp.raise_for_status()

    ensure_dir(output.parent)
    output.write_bytes(resp.content)
    log(f"  Wrote {output} ({len(resp.content):,} bytes, type={resp.headers.get('content-type','?')})")
    return {"status": "ok", "url": url, "bytes": len(resp.content), "output": str(output)}


# ── Main ─────────────────────────────────────────────────────────────────────

FETCHERS = {
    "socrata": fetch_socrata,
    "scc_case": fetch_scc_case,
    "http": fetch_http,
}


def main():
    parser = argparse.ArgumentParser(description="Mithlond data fetcher")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be fetched, do nothing")
    parser.add_argument("--id", help="Run only this source ID")
    parser.add_argument("--cadence", help="Run only sources matching this cadence (once, weekly, monthly)")
    args = parser.parse_args()

    queue = yaml.safe_load(QUEUE_FILE.read_text())
    sources = queue.get("sources", [])

    if args.id:
        sources = [s for s in sources if s["id"] == args.id]
        if not sources:
            print(f"ERROR: no source with id '{args.id}'")
            sys.exit(1)

    if args.cadence:
        sources = [s for s in sources if s.get("cadence") == args.cadence]

    log(f"Running {len(sources)} source(s) | dry_run={args.dry_run}")

    results = []
    for source in sources:
        sid = source["id"]
        stype = source["type"]
        log(f"\n── {sid} ({stype}) ──")

        fetcher = FETCHERS.get(stype)
        if not fetcher:
            log(f"  Unknown type '{stype}', skipping")
            results.append({"id": sid, "status": "skip", "reason": f"unknown type {stype}"})
            continue

        try:
            result = fetcher(source, dry_run=args.dry_run)
            result["id"] = sid
            result["type"] = stype
            results.append(result)
        except requests.HTTPError as e:
            log(f"  HTTP ERROR: {e}")
            results.append({"id": sid, "status": "http-error", "error": str(e)})
        except Exception as e:
            log(f"  ERROR: {e}")
            results.append({"id": sid, "status": "error", "error": str(e)})

    # Summary
    log("\n── Summary ──")
    for r in results:
        status = r.get("status", "?")
        log(f"  {r['id']}: {status}")
        if r.get("error"):
            log(f"    → {r['error']}")

    if not args.dry_run:
        append_log({
            "run_at": datetime.now(timezone.utc).isoformat(),
            "sources_run": len(sources),
            "results": results,
        })

    # Exit nonzero if any errors (so GH Actions marks the run failed)
    errors = [r for r in results if r.get("status") in ("error", "http-error")]
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
