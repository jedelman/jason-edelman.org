// admin.jason-edelman.org: steward tools for the agent cluster. build.mjs bundles the pages in public/ into
// pages.gen.js; this script serves them with a strict policy: no network access from the page, no framing, no
// indexing. (A script rather than static assets, because deploys from cloud sessions can't use the assets
// upload step.)
import pages from './pages.gen.js'

const HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Robots-Tag': 'noindex',
  'Cache-Control': 'no-store',
}
const TYPES = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8' }

export default {
  fetch(req) {
    const url = new URL(req.url)
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: HEADERS })
    let path = url.pathname
    if (!path.endsWith('/') && !path.includes('.') && pages[path + '/index.html']) return Response.redirect(new URL(path + '/', url), 301)
    if (path.endsWith('/')) path += 'index.html'
    const body = pages[path]
    const found = typeof body === 'string'
    const type = TYPES[(found ? path : '.html').split('.').pop()] || 'text/plain; charset=utf-8'
    return new Response(req.method === 'HEAD' ? null : (found ? body : pages['/404.html']), { status: found ? 200 : 404, headers: { ...HEADERS, 'Content-Type': type } })
  },
}
