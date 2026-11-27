// Tests for the Agency's routing (src/site.js), with a fake pds.js. Run: npm test (in agency/).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { route, configured, PAGE, WIKI_DRAFT } from '../src/site.js'

const HOST = 'pds.agency.jason-edelman.org'
const DID = 'did:plc:abcdefghijklmnopqrstuvwx'
const env = (over = {}) => ({ HOSTNAME: HOST, PDS: {}, PDS_PASSWORD: 'p', JWT_SECRET: 'j', ...over })

/** A fake pds.js: records what reached it, and answers the DID it holds (or none, before birth). */
function fakePds({ did = DID } = {}) {
  const seen = []
  const fetch = async (req) => {
    const u = new URL(req.url)
    seen.push({ host: u.host, path: u.pathname, method: req.method })
    if (u.pathname === '/.well-known/atproto-did') return did ? new Response(did) : new Response('Not found', { status: 404 })
    return new Response(JSON.stringify({ reached: u.pathname }), { headers: { 'content-type': 'application/json' } })
  }
  return { fetch, seen }
}
const req = (url, init) => new Request(url, init)

test('nothing reaches pds.js until both secrets are set: an early deploy leaves no open /init', async () => {
  for (const missing of ['PDS_PASSWORD', 'JWT_SECRET', 'PDS', 'HOSTNAME']) {
    const pds = fakePds()
    const e = env({ [missing]: undefined })
    assert.equal(configured(e), false, missing)
    if (missing === 'HOSTNAME') continue // without a host, the PDS host is never recognized at all
    const r = await route(req(`https://${HOST}/init`, { method: 'POST', body: '{}' }), e, pds.fetch)
    assert.equal(r.status, 503, missing)
    const s = await route(req(`https://${HOST}/xrpc/com.atproto.server.describeServer`), e, pds.fetch)
    assert.equal(s.status, 503, missing)
    assert.equal(pds.seen.length, 0, `${missing}: pds.js was reached`)
  }
})

test('with both secrets, the PDS host goes to pds.js unchanged', async () => {
  const pds = fakePds()
  const r = await route(req(`https://${HOST}/xrpc/com.atproto.sync.getRepo?did=${DID}`), env(), pds.fetch)
  assert.equal(r.status, 200)
  assert.deepEqual(pds.seen, [{ host: HOST, path: '/xrpc/com.atproto.sync.getRepo', method: 'GET' }])
})

test('the handle resolves to the DID the PDS holds, and to nothing before birth', async () => {
  const born = await route(req('https://agency.jason-edelman.org/.well-known/atproto-did'), env(), fakePds().fetch)
  assert.equal(born.status, 200)
  assert.equal(await born.text(), DID)
  assert.equal(born.headers.get('access-control-allow-origin'), '*')
  const unborn = await route(req('https://agency.jason-edelman.org/.well-known/atproto-did'), env(), fakePds({ did: null }).fetch)
  assert.equal(unborn.status, 404)
  const unconfigured = fakePds()
  const r = await route(req('https://agency.jason-edelman.org/.well-known/atproto-did'), env({ PDS_PASSWORD: '' }), unconfigured.fetch)
  assert.equal(r.status, 404)
  assert.equal(unconfigured.seen.length, 0)
})

test('a DID that is not a did:plc is never served as the handle', async () => {
  const odd = { fetch: async () => new Response('did:web:example.com') }
  const r = await route(req('https://agency.jason-edelman.org/.well-known/atproto-did'), env(), odd.fetch)
  assert.equal(r.status, 404)
})

test('the page says what this is and links the draft; everything else on the site host is 404', async () => {
  const pds = fakePds()
  const r = await route(req('https://agency.jason-edelman.org/'), env(), pds.fetch)
  assert.equal(r.status, 200)
  const html = await r.text()
  assert.equal(html, PAGE)
  assert.ok(html.includes(WIKI_DRAFT))
  assert.match(r.headers.get('content-security-policy'), /default-src 'none'/)
  assert.equal((await route(req('https://agency.jason-edelman.org/', { method: 'HEAD' }), env(), pds.fetch)).status, 200)
  assert.equal((await route(req('https://agency.jason-edelman.org/init', { method: 'POST', body: '{}' }), env(), pds.fetch)).status, 404)
  assert.equal((await route(req('https://agency.jason-edelman.org/xrpc/com.atproto.server.createSession'), env(), pds.fetch)).status, 404)
  assert.equal(pds.seen.length, 0, 'the site host never forwards to pds.js except for the DID')
})
