#!/usr/bin/env python3
"""
Mithlond scraper — fetch.py

Reads scrape/queue.yaml and fetches each source.
Handles:
  - socrata:          Socrata Open Data API → JSON
  - scc_case:         SCC docket JS SPA → Playwright renders → extract + download PDFs
  - deq_permit_table: fetch DEQ index page, find Excel download link, download file
  - http:             Direct HTTP GET → raw file

Run: python3 scrape/fetch.py [--dry-run] [--id SOURCE_ID] [--cadence once|weekly|monthly]
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
import yaml
from bs4 import BeautifulSoup

REPO_ROOT = Path(__file__).parent.parent
QUEUE_FILE = Path(__file__).parent / "queue.yaml"
LOG_FILE = REPO_ROOT / "data" / "fetch-log.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 "
        "Mithlond-Research/1.0 (github.com/jedelman/mithlond)"
    )
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


def log(msg):
    print(f"[{datetime.now(timezone.utc).isoformat()}] {msg}", flush=True)


def ensure_dir(path):
    path.mkdir(parents=True, exist_ok=True)


def write_json(path, data, meta=None):
    ensure_dir(path.parent)
    payload = {"fetched_at": datetime.now(timezone.utc).isoformat(), "source": meta or {}, "data": data}
    path.write_text(json.dumps(payload, indent=2, default=str))
    log(f"  Wrote {path} ({path.stat().st_size:,} bytes)")


def write_binary(path, content):
    ensure_dir(path.parent)
    path.write_bytes(content)
    log(f"  Wrote {path} ({len(content):,} bytes)")


def append_log(entry):
    ensure_dir(LOG_FILE.parent)
    entries = []
    if LOG_FILE.exists():
        try:
            entries = json.loads(LOG_FILE.read_text())
        except Exception:
            entries = []
    entries.append(entry)
    LOG_FILE.write_text(json.dumps(entries[-500:], indent=2, default=str))


def download_file(url, out_path, label=""):
    if out_path.exists():
        log(f"  Skip (exists): {out_path.name}")
        return {"url": url, "file": out_path.name, "label": label, "status": "exists"}
    try:
        r = SESSION.get(url, timeout=90, stream=True)
        r.raise_for_status()
        content = r.content
        write_binary(out_path, content)
        time.sleep(1)
        return {"url": url, "file": out_path.name, "label": label, "status": "ok", "bytes": len(content)}
    except Exception as e:
        log(f"  ERROR: {e}")
        return {"url": url, "file": out_path.name, "status": "error", "error": str(e)}


# ── Fetchers ─────────────────────────────────────────────────────────────────

def fetch_socrata(source, dry_run):
    host = source["host"]
    dataset_id = source["dataset_id"]
    params = source.get("params", {})
    output = REPO_ROOT / source["output"]
    url = f"https://{host}/resource/{dataset_id}.json"
    log(f"  Socrata GET {url} params={params}")
    if dry_run:
        return {"status": "dry-run", "url": url}
    resp = SESSION.get(url, params=params, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    log(f"  Got {len(data)} records")
    write_json(output, data, {"url": url, "params": params, "record_count": len(data)})
    return {"status": "ok", "url": url, "records": len(data)}


def fetch_scc_case(source, dry_run):
    """
    SCC docket is a JavaScript SPA — BeautifulSoup gets only the shell HTML.
    Uses Playwright (headless Chromium) to fully render the page,
    then extracts all /DOCS/ PDF links from the rendered DOM.
    """
    from playwright.sync_api import sync_playwright

    case_number = source["case_number"]
    output_dir = REPO_ROOT / source["output_dir"]
    ensure_dir(output_dir)
    case_url = f"https://scc.virginia.gov/docketsearch/CASES/summary?Id={case_number}"
    log(f"  SCC case (Playwright): {case_url}")

    if dry_run:
        return {"status": "dry-run", "url": case_url}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=HEADERS["User-Agent"])
        log(f"  Navigating to {case_url}...")
        page.goto(case_url, wait_until="networkidle", timeout=30000)
        try:
            page.wait_for_selector("a[href*='/DOCS/']", timeout=15000)
            log(f"  Document links found in DOM")
        except Exception:
            log(f"  Warning: timed out waiting for /DOCS/ links — saving what we have")
        html = page.content()
        browser.close()

    (output_dir / "summary.html").write_text(html)
    log(f"  Saved rendered HTML ({len(html):,} chars)")

    soup = BeautifulSoup(html, "lxml")
    base = "https://scc.virginia.gov"
    pdf_links = []
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/DOCS/" in href.upper() or href.upper().endswith(".PDF"):
            full = urljoin(base, href)
            if full not in seen:
                seen.add(full)
                pdf_links.append((full, a.get_text(strip=True)))

    log(f"  Found {len(pdf_links)} PDF link(s)")

    results = []
    for pdf_url, label in pdf_links:
        parsed = urlparse(pdf_url)
        fname = Path(parsed.path).name or "document.pdf"
        if len(fname) > 120:
            fname = fname[:116] + ".pdf"
        out_path = output_dir / fname
        results.append(download_file(pdf_url, out_path, label[:80]))

    manifest = {
        "case_number": case_number,
        "case_url": case_url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "document_count": len(results),
        "documents": results,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    ok = sum(1 for r in results if r["status"] == "ok")
    log(f"  Done: {ok}/{len(results)} downloaded")
    return {"status": "ok", "case": case_number, "documents": len(results), "downloaded": ok}


def fetch_deq_permit_table(source, dry_run):
    """
    DEQ 403s on direct document URLs even from GH Actions.
    Fetch the index page, find the Excel/download link, follow it.
    """
    index_url = source["index_url"]
    output = REPO_ROOT / source["output"]
    log(f"  DEQ index: {index_url}")

    if dry_run:
        return {"status": "dry-run", "url": index_url}

    resp = SESSION.get(index_url, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    excel_url = None
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if any(x in href.lower() for x in [".xlsx", ".xls", ".csv", "showpublisheddocument", "showdocument", "download"]):
            excel_url = urljoin(index_url, href)
            log(f"  Found: {excel_url} | '{a.get_text(strip=True)[:60]}'")
            break

    if not excel_url:
        all_links = [(a["href"], a.get_text(strip=True)[:40]) for a in soup.find_all("a", href=True)]
        log(f"  No download link found. Links on page ({len(all_links)}):")
        for href, text in all_links[:40]:
            log(f"    {href!r} → {text!r}")
        (REPO_ROOT / "data" / "deq-index-debug.html").write_text(resp.text)
        raise RuntimeError("Could not find Excel download link on DEQ page — debug HTML saved")

    result = download_file(excel_url, output)
    return {"status": result["status"], "index_url": index_url, "download_url": excel_url,
            "bytes": result.get("bytes")}


def fetch_http(source, dry_run):
    url = source["url"]
    output = REPO_ROOT / source["output"]
    log(f"  HTTP GET {url}")
    if dry_run:
        return {"status": "dry-run", "url": url}
    resp = SESSION.get(url, timeout=60)
    resp.raise_for_status()
    ensure_dir(output.parent)
    output.write_bytes(resp.content)
    log(f"  Wrote {output} ({len(resp.content):,} bytes)")
    return {"status": "ok", "url": url, "bytes": len(resp.content)}


# ── Main ─────────────────────────────────────────────────────────────────────

FETCHERS = {
    "socrata": fetch_socrata,
    "scc_case": fetch_scc_case,
    "deq_permit_table": fetch_deq_permit_table,
    "http": fetch_http,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--id")
    parser.add_argument("--cadence")
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
            results.append({"id": sid, "status": "skip", "reason": f"unknown type {stype}"})
            continue
        try:
            result = fetcher(source, dry_run=args.dry_run)
            result["id"] = sid
            results.append(result)
        except requests.HTTPError as e:
            log(f"  HTTP ERROR: {e}")
            results.append({"id": sid, "status": "http-error", "error": str(e)})
        except Exception as e:
            import traceback
            log(f"  ERROR: {e}")
            traceback.print_exc()
            results.append({"id": sid, "status": "error", "error": str(e)})

    log("\n── Summary ──")
    for r in results:
        log(f"  {r['id']}: {r.get('status','?')}" + (f" → {r['error']}" if r.get("error") else ""))

    if not args.dry_run:
        append_log({"run_at": datetime.now(timezone.utc).isoformat(), "sources_run": len(sources), "results": results})

    if any(r.get("status") in ("error", "http-error") for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
