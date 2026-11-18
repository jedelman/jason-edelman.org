#!/usr/bin/env node
/**
 * Build script for jason-edelman.org, incremental.
 *
 *   node scripts/build.mjs           build only what changed since the last build
 *   node scripts/build.mjs --clean   wipe public/ and build everything
 *
 * The site is a set of units: the root's static files and folders, the in-repo projects
 * (plain static HTML, copied whole: ghent-streets, mithlond, eastside-commons), and the
 * two submodules that have a build step (abolish-lawns, qri). Each unit gets a content
 * fingerprint. A unit whose fingerprint matches the last build's, and whose output is
 * still in public/, is left alone; a changed unit is rebuilt from scratch, so files it no
 * longer has disappear too. The state is kept in .build-cache/state.json (gitignored).
 *
 * A change to this script or to build-qri.mjs rebuilds everything. CI builds from a fresh
 * clone, so it always does a full build; wrangler uploads only changed assets anyway.
 * The sitemap, robots.txt, the deploy stamp and the manifest are rewritten every run.
 *
 * Monorepo since 2026-11-17: ghent-streets and mithlond were submodules; they now live
 * here with their history. Only projects with a build step stay submodules.
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC  = resolve(ROOT, 'public');
const CACHE   = resolve(ROOT, '.build-cache');
const STATE   = resolve(CACHE, 'state.json');
const DOMAIN  = 'https://jason-edelman.org';
const CLEAN   = process.argv.includes('--clean');

// Static files/dirs to copy from repo root into public/
const STATIC = [
  'index.html',
  'style.css',
  'dev-journal',
  '.well-known',
  'oauth',
  'operator-field',
  'img',
  'contact.js',
  'liquid.js',
  'workshop',
  'library',
  'atlas-of-care',
  'broadsheet',
  'trailer.js',
  'video',
  'cv',
  'llms.txt',
];

// Projects, each served at /<name>/: { name, dir, buildCmd, outDir, required, ignore }
//   buildCmd null: plain static HTML, copied whole (outDir '.').
//   required: the build fails if the directory is missing (in-repo projects).
//   ignore: paths, relative to dir, left out of the fingerprint: build outputs and
//           files a build step writes back into its own source folder.
const PROJECTS = [
  {
    name: 'abolish-lawns',            // submodule, SvelteKit
    dir: 'abolish-lawns',
    buildCmd: 'npm install && npm run build',
    outDir: 'build',
    ignore: ['build', '.svelte-kit'],
  },
  {
    name: 'ghent-streets',            // in-repo since 2026-11-17 (was jedelman/ghent-zoning-reform)
    dir: 'ghent-streets',
    buildCmd: null,
    outDir: '.',
    required: true,
  },
  {
    name: 'mithlond',                 // in-repo since 2026-11-17 (was jedelman/mithlond)
    dir: 'mithlond',
    buildCmd: null,
    outDir: '.',
    required: true,
  },
  {
    name: 'eastside-commons',         // in-repo; the constraint solver runs in the browser
    dir: 'eastside-commons',
    buildCmd: null,
    outDir: '.',
    required: true,
  },
  {
    name: 'qri',                      // submodule; build-qri.mjs picks the latest system doc render
    dir: 'qri',
    buildCmd: 'node ../scripts/build-qri.mjs',
    outDir: '.',
    ignore: ['index.html', 'system-doc.html', 'system-doc.pdf'],
  },
];

// ── Pre-flight: verify required sources exist before touching public/ ──────────
const OPTIONAL = new Set(PROJECTS.filter(p => !p.required).map(p => p.dir));
const missing = [...STATIC, ...PROJECTS.map(p => p.dir)].filter(f => !existsSync(resolve(ROOT, f)));
for (const f of missing) console.warn(`  ${OPTIONAL.has(f) ? '⚠️  optional' : '❌ required'} source missing: ${f}`);
if (missing.some(f => !OPTIONAL.has(f))) {
  console.error('\nPre-flight failed — aborting before public/ is touched.');
  process.exit(1);
}
console.log('✅ Pre-flight passed');

// ── Fingerprints ────────────────────────────────────────────────────────────────
const SKIP_NAMES = new Set(['.git', 'node_modules', '.wrangler']);

/** A content hash of a file or a folder (paths, sizes, bytes, link targets). */
function fingerprint(absPath, ignore = []) {
  const h = createHash('sha1');
  const ig = new Set(ignore);
  const walk = (p, rel) => {
    const st = lstatSync(p);
    if (st.isSymbolicLink()) { h.update(`L ${rel} ${readlinkSync(p)}\n`); return; }
    if (st.isDirectory()) {
      for (const name of readdirSync(p).sort()) {
        const r = rel ? `${rel}/${name}` : name;
        if (SKIP_NAMES.has(name) || ig.has(r)) continue;
        walk(join(p, name), r);
      }
      return;
    }
    h.update(`F ${rel} ${st.size}\n`);
    h.update(readFileSync(p));
  };
  walk(absPath, '');
  return h.digest('hex');
}

// A change to the build itself invalidates every unit.
const BUILD_KEY = fingerprint(resolve(ROOT, 'scripts/build.mjs')) + fingerprint(resolve(ROOT, 'scripts/build-qri.mjs'));

let state = { key: null, units: {} };
try { state = JSON.parse(readFileSync(STATE, 'utf8')); } catch { /* first run, or no cache */ }

const fresh = CLEAN || !existsSync(PUBLIC) || state.key !== BUILD_KEY;
if (fresh) {
  console.log(CLEAN ? '🧹 --clean: rebuilding everything' : '🧹 Full build (no usable previous build)');
  rmSync(PUBLIC, { recursive: true, force: true });
  mkdirSync(PUBLIC, { recursive: true });
  state = { key: BUILD_KEY, units: {} };
}

const next = { key: BUILD_KEY, units: {} };
const built = [], skipped = [];

/** Rebuild a unit unless its fingerprint and output are unchanged. */
function unit(id, fp, dest, make) {
  const prev = state.units[id];
  if (prev && prev.fp === fp && existsSync(dest)) {
    skipped.push(id);
  } else {
    rmSync(dest, { recursive: true, force: true });
    make();
    built.push(id);
  }
  next.units[id] = { fp, dest: relative(ROOT, dest) };
}

// ── Static files ──────────────────────────────────────────────────────────────
console.log('📄 Static files');
for (const item of STATIC) {
  const src = resolve(ROOT, item), dest = resolve(PUBLIC, item);
  unit(`static:${item}`, fingerprint(src), dest, () => cpSync(src, dest, { recursive: true, force: true }));
}

// ── Projects ──────────────────────────────────────────────────────────────────
for (const project of PROJECTS) {
  const projectDir = resolve(ROOT, project.dir);
  const outDir     = resolve(projectDir, project.outDir);
  const destDir    = resolve(PUBLIC, project.name);

  // Guard: skip if a submodule's directory is missing or not checked out (empty)
  let entries = [];
  try { entries = readdirSync(projectDir).filter(e => e !== '.git'); } catch { /* missing */ }
  if (entries.length === 0) {
    console.log(`\n⚠️  Skipping ${project.name} — directory empty or missing (submodule not checked out)`);
    rmSync(destDir, { recursive: true, force: true });
    continue;
  }

  unit(`project:${project.name}`, fingerprint(projectDir, project.ignore), destDir, () => {
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
  });
}

// Units from an earlier build that no longer exist (a project removed from the list).
for (const [id, u] of Object.entries(state.units)) {
  if (!next.units[id] && u.dest) rmSync(resolve(ROOT, u.dest), { recursive: true, force: true });
}

console.log(`\n♻️  ${built.length} unit(s) built, ${skipped.length} unchanged`);
if (built.length && built.length <= 12) console.log(`   built: ${built.join(', ')}`);

// ── Build manifest ────────────────────────────────────────────────────────────
const builtProjects = PROJECTS.filter(p => existsSync(resolve(PUBLIC, p.name)));
let gitSha = '';
try { gitSha = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch(_) {}
const manifest = {
  built_at:    new Date().toISOString(),
  git_sha:     gitSha,
  total_files: 0,  // filled in after sitemap
  incremental: { full: fresh, built: built.length, unchanged: skipped.length },
  sources: {
    static_files: STATIC.filter(f => existsSync(resolve(PUBLIC, f))).join(', '),
    ...Object.fromEntries(builtProjects.map(p => [p.name, p.buildCmd ? 'built' : 'copied'])),
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
 * Last commit date per path, from one `git log` pass (newest first).
 *
 * CI (Workers Builds) clones shallow, so `git log` ends at a boundary commit that seems
 * to add every file it holds. A path whose newest commit is a boundary commit has an
 * unknown date: it's left out of the map, and its sitemap entry gets no <lastmod>
 * (optional in the protocol, and better absent than wrong). `newest` is the date of the
 * newest commit, which a shallow clone still has right.
 */
function gitDates(cwd) {
  const map = new Map();
  let newest = null;
  try {
    const run = (cmd) => execSync(cmd, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
    let boundary = new Set();
    if (run('git rev-parse --is-shallow-repository').trim() === 'true') {
      try { boundary = new Set(readFileSync(resolve(cwd, run('git rev-parse --git-path shallow').trim()), 'utf8').split('\n').filter(Boolean)); } catch {}
    }
    const seen = new Set();
    let date = null, cut = false;
    for (const line of run('git log "--format=%x00%H %cI" --name-only').split('\n')) {
      if (line.startsWith('\0')) {
        const [sha, iso] = line.slice(1).split(' ');
        date = iso.slice(0, 10);
        cut = boundary.has(sha);
        newest = newest || date;
      } else if (line && date && !seen.has(line)) {
        seen.add(line);
        if (!cut) map.set(line, date);
      }
    }
  } catch { /* not a git checkout */ }
  return { map, newest };
}
const repoDates = gitDates(ROOT);
const subDates = Object.fromEntries(PROJECTS.filter(p => existsSync(resolve(ROOT, p.dir, '.git'))).map(p => [p.name, gitDates(resolve(ROOT, p.dir))]));

/**
 * The last-modified date of a public file: the last commit that touched its source.
 * Pages a build step generates in a submodule (no source file of the same path) get
 * their submodule's newest commit. Anything else is unknown (null: no <lastmod>).
 */
function lastmod(absPath) {
  const rel = relative(PUBLIC, absPath).replace(/\\/g, '/');
  const [top, ...rest] = rel.split('/');
  const project = PROJECTS.find(p => p.name === top);
  if (project) {
    const inner = join(project.outDir, rest.join('/')).replace(/\\/g, '/');
    const sub = subDates[project.name];
    if (sub) {
      if (sub.map.has(inner)) return sub.map.get(inner);
      const tracked = execSync(`git ls-files -- "${inner}"`, { cwd: resolve(ROOT, project.dir), encoding: 'utf8' }).trim();
      return tracked ? null : sub.newest;   // a tracked file of unknown date stays unknown
    }
    return repoDates.map.get(`${project.dir}/${inner}`) || null;
  }
  return repoDates.map.get(rel) || null;
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
    e.lastmod && `    <lastmod>${e.lastmod}</lastmod>`,
    `    <changefreq>${e.changefreq}</changefreq>`,
    `    <priority>${e.priority}</priority>`,
    '  </url>',
  ].filter(Boolean).join('\n')),
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

// Remember what was built, for the next incremental run.
mkdirSync(CACHE, { recursive: true });
writeFileSync(STATE, JSON.stringify(next, null, 2));

console.log('\n✅ public/ ready for deployment');
