#!/usr/bin/env node
// Builds muster/vendor/ from the exact npm version in package-lock.json:
//   maplibre-gl.mjs         MapLibre GL JS (ES module)
//   maplibre-gl-worker.mjs  its worker; the main module finds it beside itself
//   maplibre-gl.css
//   LICENSES.txt
// MapLibre ships these prebuilt, so this copies rather than bundles.
// The atproto SDK isn't duplicated here: muster imports library/vendor/.
//
// Usage: cd scripts/vendor-muster && npm ci && npm run build

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../../muster/vendor')
const PKG = join(HERE, 'node_modules/maplibre-gl')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
for (const f of ['maplibre-gl.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css']) copyFileSync(join(PKG, 'dist', f), join(OUT, f))

const { version, license } = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'))
writeFileSync(
  join(OUT, 'LICENSES.txt'),
  `Third-party code in this directory, copied from npm by scripts/vendor-muster.\n\n== maplibre-gl ${version} (${license}) ==\n\n${readFileSync(join(PKG, 'LICENSE.txt'), 'utf8').trim()}\n`,
)
console.log(`muster/vendor: maplibre-gl ${version}`)
