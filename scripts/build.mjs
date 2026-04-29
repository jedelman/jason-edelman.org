#!/usr/bin/env node
/**
 * Build script for jason-edelman.org
 *
 * 1. Cleans and recreates public/
 * 2. Copies root static files into public/
 * 3. Builds each subproject (git submodules) into public/<name>/
 *
 * Add future subprojects to the SUBPROJECTS array.
 */

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = resolve(ROOT, 'public');

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
  const outDir = resolve(projectDir, project.outDir);
  const destDir = resolve(PUBLIC, project.name);

  if (project.buildCmd) {
    console.log(`\n🔨 Building ${project.name}`);
    execSync(project.buildCmd, { cwd: projectDir, stdio: 'inherit' });
  } else {
    console.log(`\n📋 ${project.name} (static — no build step)`);
  }

  console.log(`📦 Copying ${project.name} → public/${project.name}/`);
  cpSync(outDir, destDir, { recursive: true,
    filter: (src) => {
      // Exclude git internals, node_modules, and data-only dirs from static copy
      const rel = src.replace(projectDir, '');
      return !rel.startsWith('/.git') &&
             !rel.startsWith('/node_modules') &&
             !rel.startsWith('/.wrangler');
    }
  });
}

console.log('\n✅ public/ ready for deployment');
