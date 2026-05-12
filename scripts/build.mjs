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
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
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

// Subprojects: { name, dir, buildCmd, outDir, required }
// required: if true, build fails when directory is missing (not just a warning)
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
  {
    name: 'eastside-commons',
    dir: 'eastside-commons',
    buildCmd: null,   // plain static HTML — constraint solver runs in browser
    outDir: '.',
    required: true,   // hard failure if missing
  },
  {
    name: 'qri',
    dir: 'qri',
    buildCmd: 'node ../scripts/build-qri.mjs',
    outDir: '.',
  },
];

// ── Pre-flight: verify required sources exist before nuking public/ ─────────────
const REQUIRED_SOURCES = [...STATIC, ...SUBPROJECTS.map(p => p.dir)];
const missing = REQUIRED_SOURCES.filter(f => !existsSync(resolve(ROOT, f)));
if (missing.length) {
  // Warn about missing submodules but only hard-fail on non-optional sources
  const OPTIONAL = new Set(SUBPROJECTS.filter(p => !p.required).map(p => p.dir));
  const hardMissing = missing.filter(f => !OPTIONAL.has(f));
  for (const f of missing) {
    const tag = OPTIONAL.has(f) ? '⚠️  optional' : '❌ required';
    console.warn(`  ${tag} source missing: ${f}`);
  }
  if (hardMissing.length) {
    console.error('\nPre-flight failed — aborting before public/ is cleaned.');
    process.exit(1);
  }
}
console.log('✅ Pre-flight passed');

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

  // Guard: skip if submodule directory is missing or not checked out (empty)
  try {
    const entries = readdirSync(projectDir).filter(e => e !== '.git');
    if (entries.length === 0) {
      console.log(`\n⚠️  Skipping ${project.name} — directory empty (submodule not checked out)`);
      continue;
    }
  } catch {
    console.log(`\n⚠️  Skipping ${project.name} — directory not found`);
    continue;
  }

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

// ── Build manifest ────────────────────────────────────────────────────────────
const builtProjects = SUBPROJECTS.filter(p => existsSync(resolve(PUBLIC, p.name)));
const manifest = {
  built_at:    new Date().toISOString(),
  total_files: 0,  // filled in after sitemap
  sources: {
    static_files: STATIC.filter(f => existsSync(resolve(PUBLIC, f))).join(', '),
    ...Object.fromEntries(builtProjects.map(p => [p.name, 'copied'])),
  },
};

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

// Write deploy timestamp — ensures wrangler always sees a changed file
// and re-establishes the full asset binding on every deploy
writeFileSync(resolve(PUBLIC, '_deploy.txt'), new Date().toISOString());
console.log(`   → _deploy.txt written`);

// Finalise manifest with file count
function countFiles(dir) {
  let n = 0;
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      n += e.isDirectory() ? countFiles(resolve(dir, e.name)) : 1;
    }
  } catch {}
  return n;
}
manifest.total_files = countFiles(PUBLIC);
writeFileSync(resolve(PUBLIC, '_build-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`   → _build-manifest.json (${manifest.total_files} files)`);

console.log('\n✅ public/ ready for deployment');
