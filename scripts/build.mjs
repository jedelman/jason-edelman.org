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

// Subprojects: { dir, buildCmd, outDir }
// outDir is relative to the subproject dir, copied to public/<dir>/
const SUBPROJECTS = [
  {
    name: 'abolish-lawns',
    dir: 'abolish-lawns',
    buildCmd: 'npm install && npm run build',
    outDir: 'build',
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

  console.log(`\n🔨 Building ${project.name}`);
  execSync(project.buildCmd, { cwd: projectDir, stdio: 'inherit' });

  console.log(`📦 Copying ${project.name} build → public/${project.name}/`);
  cpSync(outDir, destDir, { recursive: true });
}

console.log('\n✅ public/ ready for deployment');
