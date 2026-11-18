#!/usr/bin/env node
// Re-fetches every unverified quote in the research watch and checks it's on the page.
//
//   node research-watch/verify.mjs                  every project, every unverified quote
//   node research-watch/verify.mjs --project mithlond
//   node research-watch/verify.mjs --recheck        verify again even what's already verified
//   node research-watch/verify.mjs --can <url>...   say whether robots.txt lets the watch fetch each URL
//
// A quote is checked against the page's text: the HTML with tags stripped, a PDF's text (pdftotext), or, if neither
// has it, the page as a headless browser renders it. Case, curly quotes, dashes and spacing are folded first.
// A URL that robots.txt (or a Content-Signal of ai-input=no) closes to this watch fails without being fetched.
// A pass stamps the quote's entry with `verified` (an ISO time); a failure stamps `verify_error` and exits 1.
// render.mjs refuses to publish anything without `verified`, so a failed item must be fixed or dropped.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT, projects, htmlToText, normalize, dehyphenate, robotsAllows, UA } from './lib.mjs';

const args = process.argv.slice(2);
const only = args.includes('--project') ? args[args.indexOf('--project') + 1] : null;
const RECHECK = args.includes('--recheck');
const MIN = 20, MAX = 600;

if (args.includes('--can')) {
  let closed = 0;
  for (const url of args.slice(args.indexOf('--can') + 1)) {
    const r = await robotsAllows(url);
    if (!r.ok) closed++;
    console.log(`${r.ok ? 'ok    ' : 'CLOSED'} ${url}${r.ok ? '' : `  (${r.why})`}`);
  }
  process.exit(closed ? 1 : 0);
}

const tmp = mkdtempSync(join(tmpdir(), 'watch-verify-'));
const cache = new Map();   // url -> { texts: [normalized...], error }
let browser = null;

async function fetchTexts(url) {
  if (cache.has(url)) return cache.get(url);
  const out = { texts: [], error: null, rendered: false };
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45000);
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: ctl.signal });
    clearTimeout(timer);
    const type = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (!res.ok) out.error = `HTTP ${res.status}`;
    if (type.includes('pdf') || buf.subarray(0, 5).toString() === '%PDF-') {
      const f = join(tmp, `${cache.size}.pdf`);
      writeFileSync(f, buf);
      const text = execFileSync('pdftotext', ['-enc', 'UTF-8', f, '-'], { maxBuffer: 256 * 1024 * 1024 }).toString();
      if (!text.trim()) out.error = 'PDF without extractable text';
      out.texts.push(normalize(text), normalize(dehyphenate(text.replace(/\s+/g, ' '))));
      out.error = text.trim() ? null : out.error;
    } else {
      const text = type.includes('html') || /^\s*</.test(buf.subarray(0, 200).toString()) ? htmlToText(buf.toString()) : buf.toString();
      out.texts.push(normalize(text));
    }
  } catch (e) {
    out.error = e.name === 'AbortError' ? 'timeout' : String(e.message || e);
  }
  cache.set(url, out);
  return out;
}

/** The page as a browser renders it, for pages that build their text with JavaScript or turn away plain fetches. */
async function renderedText(url) {
  try {
    if (!browser) {
      const { chromium } = createRequire(import.meta.url)('playwright');
      browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
    }
    const page = await browser.newPage({ userAgent: UA });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    const text = await page.evaluate(() => document.body ? document.body.innerText : '');
    await page.close();
    return normalize(text);
  } catch (e) {
    return '';
  }
}

async function check(entry, where) {
  const q = normalize(entry.quote || '');
  if (q.length < MIN || q.length > MAX) return `quote must be ${MIN}–${MAX} characters (is ${q.length})`;
  if (!/^https?:\/\//.test(entry.url || '')) return 'no http(s) url';
  const robots = await robotsAllows(entry.url);
  if (!robots.ok) return `closed to this watch (${robots.why})`;
  const page = await fetchTexts(entry.url);
  if (page.texts.some((t) => t.includes(q))) return null;
  if (!page.rendered) {
    page.rendered = true;
    const t = await renderedText(entry.url);
    if (t) page.texts.push(t);
    if (t.includes(q)) return null;
  }
  return page.error ? `couldn't read the page (${page.error})` : 'quote not found on the page';
}

let failures = 0, passed = 0, skipped = 0;
const now = new Date().toISOString();

async function verifyEntry(entry, where) {
  if (entry.verified && !RECHECK) { skipped++; return; }
  const err = await check(entry, where);
  if (err) {
    failures++;
    entry.verify_error = err;
    delete entry.verified;
    console.error(`✗ ${where}: ${err}\n    ${entry.url}`);
  } else {
    passed++;
    entry.verified = now;
    delete entry.verify_error;
  }
}

for (const p of projects()) {
  if (only && p.id !== only) continue;
  const dir = resolve(ROOT, p.data);
  const ddir = join(dir, 'digests');
  if (existsSync(ddir)) {
    for (const f of readdirSync(ddir).filter((f) => f.endsWith('.json')).sort()) {
      const file = join(ddir, f);
      const d = JSON.parse(readFileSync(file, 'utf8'));
      for (const [i, item] of (d.items || []).entries()) await verifyEntry(item, `${p.id} ${f} item ${i + 1}`);
      writeFileSync(file, JSON.stringify(d, null, 2) + '\n');
    }
  }
  const cfile = join(dir, 'claims.json');
  if (existsSync(cfile)) {
    const c = JSON.parse(readFileSync(cfile, 'utf8'));
    for (const claim of c.claims || []) {
      for (const [i, s] of (claim.sources || []).entries()) await verifyEntry(s, `${p.id} claim ${claim.id} source ${i + 1}`);
    }
    writeFileSync(cfile, JSON.stringify(c, null, 2) + '\n');
  }
}

if (browser) await browser.close();
rmSync(tmp, { recursive: true, force: true });
console.log(`verified ${passed}, already verified ${skipped}, failed ${failures}`);
process.exit(failures ? 1 : 0);
