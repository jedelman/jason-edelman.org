// The Agency's Worker, apart from pds.js so the tests never load it (main.js wires the two together). Two hosts:
//   env.HOSTNAME (pds.agency.jason-edelman.org)  the Agency's own atproto PDS, run by pds.js
//   everything else (agency.jason-edelman.org)   the handle check, and a page saying what this is
//
// The Agency is the knowledge commons' shared work: members ask for work, desks do it, and what the work learns goes
// into the commons' wiki. Its design is a draft on that wiki (WIKI_DRAFT). Jason, 2026-11-27: the handle is
// agency.jason-edelman.org, and the code lives here, in agency/.
//
// One rule this file exists to keep: pds.js leaves /init (the first-run account bootstrap) open to anyone until an
// account exists unless PDS_PASSWORD is set (@pdsjs/core handlers/server-meta.js: "With no password set the bootstrap
// is open"). autonomist's rule is "Never deploy the PDS to a Worker without it". Here nothing reaches pds.js at all
// until PDS_PASSWORD and JWT_SECRET are both set, so a deploy made before them can't leave the account open to claim.

export const WIKI_DRAFT = 'https://lichen.wiki/@jason-edelman.org/public-knowledge/the-agency-draft'
const DID = /^did:plc:[a-z2-7]{24}$/

/** True when pds.js may answer: its host is named, its storage is bound, and both secrets are set. */
export function configured(env) {
  return Boolean(env.HOSTNAME && env.PDS && env.PDS_PASSWORD && env.JWT_SECRET)
}

const SECURITY = {
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
}

function text(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY, ...headers } })
}

/** The DID the PDS holds, or null before the account exists (or when the PDS can't say). */
export async function agencyDid(env, pdsFetch) {
  if (!configured(env)) return null
  try {
    const res = await pdsFetch(new Request(`https://${env.HOSTNAME}/.well-known/atproto-did`))
    const did = res.ok ? (await res.text()).trim() : ''
    return DID.test(did) ? did : null
  } catch {
    return null
  }
}

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Agency</title>
<meta name="description" content="The knowledge commons' shared work: members ask for work, desks do it, and what the work learns goes into the commons' wiki.">
<style>body{font:1.05rem/1.6 system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;color:#1d1d1f;background:#fdfdfc}a{color:#1a5fb4}@media (prefers-color-scheme:dark){body{color:#e8e6e3;background:#161615}a{color:#8ab4f8}}</style>
</head>
<body>
<h1>The Agency</h1>
<p>The knowledge commons' shared work. Members ask for work, desks do it, and what the work learns goes into the commons' wiki.</p>
<p>This is its home on atproto: the account @agency.jason-edelman.org, on its own server. The Agency itself is still a draft, and the draft is on the wiki: <a href="${WIKI_DRAFT}">The Agency (draft)</a>.</p>
</body>
</html>
`

/** One request, given a way to reach pds.js. */
export async function route(req, env, pdsFetch) {
  const url = new URL(req.url)
  if (env.HOSTNAME && url.hostname === env.HOSTNAME) {
    if (!configured(env)) return text('This PDS is not configured yet.', 503)
    return pdsFetch(req)
  }
  if (url.pathname === '/.well-known/atproto-did') {
    // The handle's one source of truth is the PDS, as autonomist's is: nothing is committed after the account is made.
    const did = await agencyDid(env, pdsFetch)
    if (!did) return text('Not found', 404)
    return text(did, 200, { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' })
  }
  if (url.pathname === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
    return new Response(req.method === 'HEAD' ? null : PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', ...SECURITY } })
  }
  return text('Not found', 404)
}
