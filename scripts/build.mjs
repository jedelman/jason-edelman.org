#!/usr/bin/env node
/**
 * Build script for jason-edelman.org
 *
 * 1. Cleans and recreates public/
 * 2. Copies root static files into public/
 * 3. Builds each subproject (git submodules) into public/<name>/
 * 4. Generates sitemap.xml from all HTML files in public/
 *
 * Add future subprojects to the SUBPROJECTS array.
 */

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC  = resolve(ROOT, 'public');
const DOMAIN  = 'https://jason-edelman.org';

// Static files/dirs to copy from repo root into public/
const STATIC = [
  'index.html',
  'style.css',
  'dev-journal',
  '.well-known',
];

// Subprojects: { name, dir, buildCmd, outDir }
// outDir is relative to the subproject dir, copied to public/<name>/
// For plain static HTML projects, set buildCmd to null and outDir to '.'
const SUBPROJECTS = [
  {
    name: 'abolish-lawns',
    dir: 'abolish-lawns',
    buildCmd: 'npm install && npm run build',
    outDir: 'build',
  },
  {
    name: 'ghent-streets',
    dir: 'ghent-streets',
    buildCmd: null,   // plain static HTML — no build step needed
    outDir: '.',
  },
  {
    name: 'mithlond',
    dir: 'mithlond',
    buildCmd: null,   // plain static HTML — no build step needed
    outDir: '.',
  },
];

// ── Clean ─────────────────────────────────────────────────────────────────────
console.log('🧹 Cleaning public/');
rmSync(PUBLIC, { recursive: true, force: true });
mkdirSync(PUBLIC, { recursive: true });

// ── Static files ──────────────────────────────────────────────────────────────
console.log('📄 Copying static files');
for (const item of STATIC) {
  cpSync(resolve(ROOT, item), resolve(PUBLIC, item), { recursive: true, force: true });
}

// ── Subprojects ───────────────────────────────────────────────────────────────
for (const project of SUBPROJECTS) {
  const projectDir = resolve(ROOT, project.dir);
  const outDir     = resolve(projectDir, project.outDir);
  const destDir    = resolve(PUBLIC, project.name);

  if (project.buildCmd) {
    console.log(`\n🔨 Building ${project.name}`);
    execSync(project.buildCmd, { cwd: projectDir, stdio: 'inherit' });
  } else {
    console.log(`\n📋 ${project.name} (static — no build step)`);
  }

  console.log(`📦 Copying ${project.name} → public/${project.name}/`);
  cpSync(outDir, destDir, { recursive: true,
    filter: (src) => {
      const rel = src.replace(projectDir, '');
      return !rel.startsWith('/.git') &&
             !rel.startsWith('/node_modules') &&
             !rel.startsWith('/.wrangler');
    }
  });
}

// ── Sitemap ───────────────────────────────────────────────────────────────────
console.log('\n🗺  Generating sitemap.xml');

/** Recursively collect all .html files under a directory. */
function collectHtml(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip asset/data dirs that contain no addressable pages
      if (['_app', 'assets', 'data', '.well-known'].includes(entry.name)) continue;
      collectHtml(full, files);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Try to get the git last-modified date for a file.
 * Falls back to the file's mtime if git is unavailable or the file is untracked.
 */
function lastmod(absPath) {
  try {
    const dir  = dirname(absPath);
    const file = absPath.split('/').pop();
    const out  = execSync(`git log -1 --format=%cI -- "${file}"`, {
      cwd: dir, encoding: 'utf8', stdio: ['pipe','pipe','pipe']
    }).trim();
    if (out) return out.slice(0, 10); // YYYY-MM-DD
  } catch { /* fall through */ }
  return new Date(statSync(absPath).mtime).toISOString().slice(0, 10);
}

/**
 * Assign a priority based on path depth and whether it's an index.
 *   root /           → 1.0
 *   subproject root  → 0.9
 *   subproject page  → 0.7
 *   deeper pages     → 0.5
 */
function priority(urlPath) {
  const parts = urlPath.replace(/^\//, '').replace(/\/$/, '').split('/').filter(Boolean);
  if (parts.length === 0) return '1.0';              // root
  if (parts.length === 1) return '0.9';              // /subproject/
  if (parts.length === 2) return '0.7';              // /subproject/page
  return '0.5';
}

/**
 * Convert a file in public/ to a canonical URL.
 * index.html → trailing slash; other .html → strip extension.
 */
function toUrl(absPath) {
  let rel = '/' + relative(PUBLIC, absPath).replace(/\\/g, '/');
  if (rel.endsWith('/index.html')) rel = rel.slice(0, -'index.html'.length);
  else rel = rel.slice(0, -'.html'.length) + '/';
  return DOMAIN + rel;
}

// Pages to exclude from sitemap (non-content files)
function shouldExclude(urlPath) {
  const parts = urlPath.split('/').filter(Boolean);
  const last  = parts[parts.length - 1];
  // Exclude any 404 page at any depth
  if (last === '404') return true;
  // Exclude stub/coming-soon pages (abolish-lawns stubs all return "In preparation")
  // We identify them by being in the known stub list
  const STUBS = new Set(['science']);
  if (parts.length === 2 && STUBS.has(last)) return true;
  return false;
}

const htmlFiles = collectHtml(PUBLIC);
const entries   = [];

for (const file of htmlFiles) {
  const url  = toUrl(file);
  const path = url.replace(DOMAIN, '');
  if (shouldExclude(path)) continue;

  entries.push({
    loc:      url,
    lastmod:  lastmod(file),
    priority: priority(path),
    // Weekly for project pages, monthly for deep archive pages
    changefreq: path.split('/').filter(Boolean).length <= 2 ? 'weekly' : 'monthly',
  });
}

// Sort: root first, then by priority desc, then alpha
entries.sort((a, b) => {
  if (a.loc === DOMAIN + '/') return -1;
  if (b.loc === DOMAIN + '/') return 1;
  const pa = parseFloat(a.priority), pb = parseFloat(b.priority);
  if (pa !== pb) return pb - pa;
  return a.loc.localeCompare(b.loc);
});

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries.map(e => [
    '  <url>',
    `    <loc>${e.loc}</loc>`,
    `    <lastmod>${e.lastmod}</lastmod>`,
    `    <changefreq>${e.changefreq}</changefreq>`,
    `    <priority>${e.priority}</priority>`,
    '  </url>',
  ].join('\n')),
  '</urlset>',
].join('\n');

writeFileSync(resolve(PUBLIC, 'sitemap.xml'), xml);
console.log(`   → ${entries.length} URLs written to public/sitemap.xml`);

// ── robots.txt ────────────────────────────────────────────────────────────────
// Write a root robots.txt that points crawlers at the sitemap.
// (Individual subprojects may have their own robots.txt inside their subdirs —
//  this one lives at the root and takes precedence for the root domain.)
const robots = [
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${DOMAIN}/sitemap.xml`,
].join('\n');

writeFileSync(resolve(PUBLIC, 'robots.txt'), robots);
console.log(`   → robots.txt written`);

console.log('\n✅ public/ ready for deployment');
