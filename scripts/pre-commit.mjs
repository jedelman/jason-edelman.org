#!/usr/bin/env node
/**
 * Pre-commit checks for jason-edelman.org
 * Install: cp scripts/pre-commit.mjs .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
 * Or run:  npm run install-hooks
 *
 * Checks:
 *   1. Required root source files exist
 *   2. wrangler.toml has no [[routes]] block
 *   3. eastside-commons HTML files are non-empty and contain </html>
 *   4. Staged deletions don't wipe more than 5 tracked source files at once
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m⚠\x1b[0m';

let failed = false;
function fail(msg)  { console.error(`  ${FAIL} ${msg}`); failed = true; }
function pass(msg)  { console.log(`  ${PASS} ${msg}`); }
function warn(msg)  { console.log(`  ${WARN} ${msg}`); }

console.log('\n\x1b[1mpre-commit checks\x1b[0m');

// ── 1. Required root sources ────────────────────────────────────────────────
console.log('\n[1] Required source files');
const REQUIRED = [
  'index.html',
  'style.css',
  'dev-journal',
  'eastside-commons',
  'eastside-commons/index.html',
  'eastside-commons/cold-open.html',
  'scripts/build.mjs',
  'wrangler.toml',
];
for (const f of REQUIRED) {
  if (existsSync(resolve(ROOT, f))) {
    pass(f);
  } else {
    fail(`Missing required source: ${f}`);
  }
}

// ── 2. wrangler.toml sanity ──────────────────────────────────────────────────
console.log('\n[2] wrangler.toml');
const wrangler = readFileSync(resolve(ROOT, 'wrangler.toml'), 'utf8');
// [[routes]] causes error 1042 (zone file not found) for custom domains on assets-only workers.
// Custom domain binding is managed in the Cloudflare dashboard. Do not add [[routes]] here.
if (/^\[\[routes\]\]/m.test(wrangler)) {
  fail('wrangler.toml has [[routes]] — this causes error 1042 on assets-only workers. Remove it; manage custom domains in the Cloudflare dashboard.');
} else {
  pass('No [[routes]] block ✓');
}
if (!wrangler.includes('[assets]')) {
  fail('wrangler.toml missing [assets] section');
} else {
  pass('[assets] section present');
}
const nfh = wrangler.match(/not_found_handling\s*=\s*"([^"]+)"/)?.[1];
if (nfh === '404-page') {
  fail('not_found_handling = "404-page" requires a 404.html — use "none" for a multi-page site');
} else if (nfh === 'single-page-application') {
  warn('not_found_handling = "single-page-application" serves index.html for all unmatched paths — only correct for SPAs');
} else {
  pass(`not_found_handling = "${nfh || 'none (default)'}" ✓`);
}

// ── 3. eastside-commons HTML sanity ─────────────────────────────────────────
console.log('\n[3] eastside-commons HTML');
const ecFiles = [
  'eastside-commons/index.html',
  'eastside-commons/cold-open.html',
  'eastside-commons/pitch-cityhall.html',
  'eastside-commons/pitch-investors.html',
  'eastside-commons/pitch-coalition.html',
];
for (const f of ecFiles) {
  const full = resolve(ROOT, f);
  if (!existsSync(full)) { warn(`${f} not found — skipping`); continue; }
  const content = readFileSync(full, 'utf8');
  if (content.length < 1000) {
    fail(`${f} is suspiciously small (${content.length} bytes) — may be empty or truncated`);
  } else if (!content.includes('</html>')) {
    fail(`${f} missing </html> — likely truncated`);
  } else {
    pass(`${f} (${(content.length / 1024).toFixed(0)}kb)`);
  }
}

// ── 4. Staged deletions check ────────────────────────────────────────────────
console.log('\n[4] Staged deletions');
let stagedDeletions = [];
try {
  const diff = execSync('git diff --cached --name-status', { encoding: 'utf8' });
  stagedDeletions = diff.split('\n')
    .filter(l => l.startsWith('D\t'))
    .map(l => l.slice(2).trim())
    .filter(f => !f.startsWith('public/') && !f.startsWith('logs/'));
} catch {}

if (stagedDeletions.length === 0) {
  pass('No source file deletions staged');
} else if (stagedDeletions.length <= 3) {
  warn(`${stagedDeletions.length} source file(s) being deleted:`);
  stagedDeletions.forEach(f => warn(`  - ${f}`));
} else {
  fail(`${stagedDeletions.length} source files staged for deletion — this is likely a mistake:`);
  stagedDeletions.forEach(f => console.error(`    - ${f}`));
  fail('If intentional, commit with --no-verify');
}

// ── Result ───────────────────────────────────────────────────────────────────
if (failed) {
  console.error('\n\x1b[31m\x1b[1mpre-commit failed — fix the issues above before committing.\x1b[0m');
  console.error('To bypass (not recommended): git commit --no-verify\n');
  process.exit(1);
} else {
  console.log('\n\x1b[32m\x1b[1mAll checks passed.\x1b[0m\n');
}
