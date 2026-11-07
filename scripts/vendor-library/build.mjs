#!/usr/bin/env node
// Builds library/vendor/ from the exact npm versions in package-lock.json:
//   oauth-client-browser.js  BrowserOAuthClient
//   atproto-api.js           Agent (loaded only after sign-in)
//   barcode-detector.js      BarcodeDetector polyfill, for browsers without one
//   zxing_reader.wasm        the polyfill's decoder, served from beside it
//   LICENSES.txt             notices for every package in the bundles, and zxing-cpp
//
// Usage: cd scripts/vendor-library && npm ci && npm run build
// The site build never runs this; it only copies library/ into public/.

import { build } from 'esbuild'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../../library/vendor')
const WASM = 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'

const entries = {
  'oauth-client-browser': `export { BrowserOAuthClient } from '@atproto/oauth-client-browser'`,
  'atproto-api': `export { Agent } from '@atproto/api'`,
  'barcode-detector': `
import { BarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
// Fetch the .wasm from beside this file, not from jsDelivr.
prepareZXingModule({
  overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? new URL(path, import.meta.url).href : prefix + path) },
})
export { BarcodeDetector }`,
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const inputs = new Set([WASM])
for (const [name, contents] of Object.entries(entries)) {
  const result = await build({
    stdin: { contents, resolveDir: HERE, sourcefile: `${name}.entry.js` },
    absWorkingDir: HERE,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    legalComments: 'none', // collected into LICENSES.txt instead
    define: { 'process.env.NODE_ENV': '"production"' },
    banner: { js: `// ${name}: bundled from npm by scripts/vendor-library. Licenses: LICENSES.txt` },
    outfile: join(OUT, `${name}.js`),
    metafile: true,
    logLevel: 'warning',
  })
  for (const f of Object.keys(result.metafile.inputs)) inputs.add(f)
}
copyFileSync(join(HERE, WASM), join(OUT, 'zxing_reader.wasm'))

// One notice per package that ended up in the output.
const packages = new Map()
for (const f of inputs) {
  const m = f.match(/^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//)
  if (m) packages.set(m[2], join(HERE, m[1]))
}
const sections = [...packages.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, dir]) => {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f))
    const text = file ? readFileSync(join(dir, file), 'utf8').trim() : `(No license file in the package. package.json says: ${pkg.license ?? 'nothing'}.)`
    return `== ${name} ${pkg.version} (${pkg.license ?? 'unknown'}) ==\n\n${text}\n`
  })
// zxing_reader.wasm is compiled from zxing-cpp plus zxing-wasm's C++ glue, both
// Apache-2.0. The npm package ships only its MIT notice, so add theirs.
const { ZXING_CPP_COMMIT } = await import('barcode-detector/ponyfill')
sections.push(
  `== zxing-cpp, commit ${ZXING_CPP_COMMIT}, and zxing-wasm's src/cpp (Apache-2.0) ==\n\n` +
    `Compiled into zxing_reader.wasm. https://github.com/zxing-cpp/zxing-cpp\n\n` +
    readFileSync(join(HERE, 'APACHE-2.0.txt'), 'utf8').trim() + '\n',
)
writeFileSync(
  join(OUT, 'LICENSES.txt'),
  `Third-party code in this directory, bundled from npm by scripts/vendor-library.\n${packages.size} packages.\n\n${sections.join('\n')}`,
)

for (const f of readdirSync(OUT)) console.log(`${f.padEnd(26)} ${readFileSync(join(OUT, f)).length.toLocaleString()} bytes`)
if (!existsSync(join(OUT, 'zxing_reader.wasm'))) throw new Error('wasm missing')
