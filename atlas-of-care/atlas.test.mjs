// node --test atlas-of-care/atlas.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildLink, parseLink, buildTakedown, parseTakedown, loadCommunity, loadOwnCases, buildCase, parseCase, caseRkey, cleanUrl, linkUri, subjectUri, COL, ATLAS_DID, SCOPE, MAX_URL } from './atlas.js'

const good = { url: 'https://example.org/acequia', scope: 'us', unit: '35039', lat: 36.5123, lon: -106.6987 }
const uriOf = (did, rkey) => `at://${did}/${COL.link}/${rkey}`

test('scope covers the three collections and nothing else', () => {
  assert.equal(SCOPE, 'atproto repo:org.jason-edelman.atlas.link repo:org.jason-edelman.atlas.case repo:org.jason-edelman.atlas.takedown')
})

test('a link record holds an address and a place, and no other fields', () => {
  const r = buildLink(good, new Date('2026-11-14T15:00:00Z'))
  assert.equal(r.ok, true)
  assert.deepEqual(Object.keys(r.record).sort(), ['$type', 'atlas', 'createdAt', 'lat', 'lon', 'scope', 'unit', 'url'])
  assert.equal(r.record.$type, COL.link)
  assert.equal(r.record.atlas, ATLAS_DID)
  assert.equal(r.record.lat, '36.51')
  assert.equal(r.record.lon, '-106.70')
  for (const v of Object.values(r.record)) assert.equal(typeof v, 'string') // no floats in atproto records
})

test('buildLink ignores anything else the caller passes', () => {
  const r = buildLink({ ...good, title: 'hello', note: 'free text', unitName: 'anything' })
  assert.equal('title' in r.record || 'note' in r.record || 'unitName' in r.record, false)
})

test('buildLink says what is missing', () => {
  assert.deepEqual(buildLink({ ...good, url: '' }).errors, ['Enter a full web address that starts with https:// or http://.'])
  assert.deepEqual(buildLink({ ...good, unit: '' }).errors, ['Pick a place on the map first.'])
  assert.equal(buildLink({ ...good, scope: 'mars' }).ok, false)
  assert.equal(buildLink({ ...good, lat: undefined }).ok, false)
})

test('cleanUrl accepts ordinary addresses and drops the fragment', () => {
  assert.equal(cleanUrl('https://example.org/a?b=1#frag'), 'https://example.org/a?b=1')
  assert.equal(cleanUrl('  http://example.org  '), 'http://example.org/')
})

test('cleanUrl refuses everything that is not a plain public web address', () => {
  const bad = ['javascript:alert(1)', 'data:text/html,x', 'ftp://example.org', 'not a url', 'https://user:pw@example.org/', 'https://localhost/x',
    'https://127.0.0.1/x', 'https://[::1]/x', 'https://example.org/a b', 'https://example.org/‮evil', 'https://example.org/' + 'a'.repeat(MAX_URL), '', null, 42, {}]
  for (const u of bad) assert.equal(cleanUrl(u), null, String(u))
})

test('a unit id cannot smuggle text', () => {
  assert.equal(buildLink({ ...good, unit: 'call me at 555 0100' }).ok, false)
  assert.equal(buildLink({ ...good, unit: '<b>x</b>' }).ok, false)
  assert.equal(buildLink({ ...good, unit: 'x'.repeat(65) }).ok, false)
})

test('parseLink round-trips a built record', () => {
  const { record } = buildLink(good, new Date('2026-11-14T15:00:00Z'))
  assert.deepEqual(parseLink(record), { url: 'https://example.org/acequia', host: 'example.org', scope: 'us', unit: '35039', lat: 36.51, lon: -106.7, createdAt: '2026-11-14T15:00:00.000Z' })
})

test('parseLink returns only its own fields, whatever else the record holds', () => {
  const { record } = buildLink(good)
  const e = parseLink({ ...record, title: '<img src=x onerror=alert(1)>', does: 'free text', unitName: 'anything' })
  assert.deepEqual(Object.keys(e).sort(), ['createdAt', 'host', 'lat', 'lon', 'scope', 'unit', 'url'])
})

test('parseLink rejects records that are not links for this atlas', () => {
  const { record } = buildLink(good)
  assert.equal(parseLink(null), null)
  assert.equal(parseLink({ ...record, $type: 'app.bsky.feed.post' }), null)
  assert.equal(parseLink({ ...record, atlas: 'did:plc:someoneelse' }), null)
  assert.equal(parseLink({ ...record, url: 'javascript:alert(1)' }), null)
  assert.equal(parseLink({ ...record, lat: '191' }), null)
  assert.equal(parseLink({ ...record, lat: true }), null)
  assert.equal(parseLink({ ...record, unit: 'two words' }), null)
  assert.equal(parseLink({ ...record, unit: 7 }), null)
  assert.equal(parseLink({ ...record, scope: 'mars' }), null)
})

test('a takedown points at one link on this map and carries nothing else', () => {
  const subject = uriOf('did:plc:aaa', '3abc')
  const r = buildTakedown(subject, new Date('2026-11-14T15:00:00Z'))
  assert.deepEqual(r.record, { $type: COL.takedown, atlas: ATLAS_DID, subject, createdAt: '2026-11-14T15:00:00.000Z' })
  assert.equal(parseTakedown(r.record), subject)
  assert.equal(parseTakedown({ ...r.record, reason: 'ignored' }), subject)
})

test('a takedown can point at a contributed case study too', () => {
  const subject = `at://did:plc:aaa/${COL.case}/3abc`
  assert.equal(subjectUri(subject), subject)
  assert.equal(linkUri(subject), null)
  assert.equal(parseTakedown(buildTakedown(subject).record), subject)
})

test('a takedown cannot point at anything but a link or case record', () => {
  for (const s of ['at://did:plc:aaa/app.bsky.feed.post/3abc', 'https://example.org', 'at://not-a-did/' + COL.link + '/1', uriOf('did:plc:aaa', 'a/b'), '', null]) {
    assert.equal(subjectUri(s), null, String(s))
    assert.equal(buildTakedown(s).ok, false)
  }
  assert.equal(parseTakedown({ $type: COL.takedown, atlas: 'did:plc:other', subject: uriOf('did:plc:aaa', '1') }), null)
})

// records: { 'did/collection/rkey': value }
const fakeIo = (records, { failDid, failIndex } = {}) => ({
  backlinks: async (_target, collection) => {
    if (failIndex === collection) throw new Error('index down')
    return Object.keys(records).filter((k) => k.split('/')[1] === collection).map((k) => ({ did: k.split('/')[0], collection, rkey: k.split('/')[2] }))
  },
  resolveDid: async (did) => {
    if (did === failDid) throw new Error('unreachable')
    return { did, pds: 'https://pds.example', handle: did.slice(-3) + '.example' }
  },
  getRecord: async (_pds, did, col, rkey) => (records[`${did}/${col}/${rkey}`] ? { value: records[`${did}/${col}/${rkey}`] } : null),
})
const L = (did, rkey) => `${did}/${COL.link}/${rkey}`
const T = (did, rkey) => `${did}/${COL.takedown}/${rkey}`

test('loadCommunity reads each link from its author, newest first, and skips junk', async () => {
  const a = buildLink(good, new Date('2026-11-01T00:00:00Z')).record
  const b = buildLink({ ...good, url: 'https://newer.example/' }, new Date('2026-11-10T00:00:00Z')).record
  const out = await loadCommunity(fakeIo({ [L('did:plc:aaa', '1')]: a, [L('did:plc:bbb', '2')]: b, [L('did:plc:ccc', '3')]: { $type: COL.link, atlas: ATLAS_DID }, [L('did:plc:ddd', '4')]: null }))
  assert.equal(out.error, null)
  assert.deepEqual(out.links.map((e) => e.host), ['newer.example', 'example.org'])
  assert.equal(out.links[0].uri, uriOf('did:plc:bbb', '2'))
  assert.equal(out.links[0].handle, 'bbb.example')
  assert.equal(out.withheld, 0)
})

test('a takedown request withholds the link at once', async () => {
  const a = buildLink(good).record
  const down = buildTakedown(uriOf('did:plc:aaa', '1')).record
  const out = await loadCommunity(fakeIo({ [L('did:plc:aaa', '1')]: a, [L('did:plc:bbb', '2')]: a, [T('did:plc:zzz', '9')]: down }))
  assert.deepEqual(out.links.map((e) => e.did), ['did:plc:bbb'])
  assert.equal(out.withheld, 1)
})

test('keep overrides a takedown request; hidden dids and uris are never shown', async () => {
  const a = buildLink(good).record
  const recs = { [L('did:plc:aaa', '1')]: a, [L('did:plc:bbb', '2')]: a, [L('did:plc:ccc', '3')]: a, [T('did:plc:zzz', '9')]: buildTakedown(uriOf('did:plc:aaa', '1')).record }
  const out = await loadCommunity(fakeIo(recs), { keep: [uriOf('did:plc:aaa', '1')], dids: ['did:plc:bbb'], uris: [uriOf('did:plc:ccc', '3')] })
  assert.deepEqual(out.links.map((e) => e.did), ['did:plc:aaa'])
  assert.equal(out.withheld, 0)
})

test('loadCommunity fails closed when either index query fails', async () => {
  const a = buildLink(good).record
  for (const failIndex of [COL.link, COL.case, COL.takedown]) {
    const out = await loadCommunity(fakeIo({ [L('did:plc:aaa', '1')]: a }, { failIndex }))
    assert.equal(out.links.length, 0)
    assert.equal(out.error.message, 'index down')
  }
})

test('loadCommunity counts authors it could not reach', async () => {
  const a = buildLink(good).record
  const out = await loadCommunity(fakeIo({ [L('did:plc:aaa', '1')]: a, [L('did:plc:eee', '5')]: a }, { failDid: 'did:plc:eee' }))
  assert.deepEqual(out.links.map((e) => e.did), ['did:plc:aaa'])
  assert.equal(out.unreachable, 1)
})

// ── Case studies ─────────────────────────────────────────────────────────────

const seeds = JSON.parse(readFileSync(new URL('./data/entries.json', import.meta.url), 'utf8'))
const C = (did, rkey) => `${did}/${COL.case}/${rkey}`
const study = { title: 'Ditch day', place: 'Rio Arriba County, NM', does: 'Neighbours clear the shared ditch each April.', who: 'Water-right holders', pays: 'not stated',
  domain: 'commons', mode: 'repeats', lat: 36.51, lon: -106.7, scope: 'us', unit: '35039', source_title: 'Ditch notes', source_url: 'https://example.org/ditch' }

test("every one of the atlas's own case studies becomes a record and comes back the same", () => {
  assert.ok(seeds.length >= 56)
  for (const e of seeds) {
    const built = buildCase(e, new Date('2026-11-14T00:00:00Z'))
    assert.equal(built.ok, true, `${e.title}: ${built.errors}`)
    for (const v of Object.values(built.record)) assert.equal(typeof v, 'string') // no floats in atproto records
    const back = parseCase(built.record)
    for (const k of ['title', 'place', 'does', 'who', 'mode', 'domain', 'quote', 'source_title', 'source_url']) assert.equal(back[k], e[k], `${e.title}: ${k}`)
    assert.ok(Math.abs(back.lat - e.lat) < 0.001 && Math.abs(back.lon - e.lon) < 0.001)
  }
})

test('the record keys of the seed case studies are distinct and valid', () => {
  const keys = seeds.map((e) => caseRkey(e.title))
  assert.equal(new Set(keys).size, keys.length)
  for (const k of keys) assert.match(k, /^[a-z0-9-]{1,80}$/)
  assert.equal(caseRkey('Kerala’s ASHA health workers'), 'kerala-s-asha-health-workers')
  assert.equal(caseRkey('Bello Horizonte olla común'), 'bello-horizonte-olla-comun')
})

test('"not stated" and "none found" are left out of the record', () => {
  const { record } = buildCase({ ...study, cost: 'not stated', contested: 'none found' })
  for (const k of ['pays', 'cost', 'contested']) assert.equal(k in record, false)
})

test('a case study needs a name, a place, what is done, a kind, a mode and a real source', () => {
  assert.equal(buildCase(study).ok, true)
  for (const k of ['title', 'place', 'does', 'source_title']) assert.equal(buildCase({ ...study, [k]: ' ' }).ok, false, k)
  assert.equal(buildCase({ ...study, source_url: 'javascript:alert(1)' }).ok, false)
  assert.equal(buildCase({ ...study, source_url: '' }).ok, false)
  assert.equal(buildCase({ ...study, mode: 'x' }).ok, false)
  assert.equal(buildCase({ ...study, domain: 'x' }).ok, false)
  assert.equal(buildCase({ ...study, unit: 'two words' }).ok, false)
  assert.equal(buildCase({ ...study, lat: 'north' }).ok, false)
})

test('parseCase caps long text, strips control characters and drops a bad source', () => {
  const { record } = buildCase(study)
  const e = parseCase({ ...record, result: 'x'.repeat(5000), who: 'a\u0000b\u202ec' })
  assert.equal(e.result.length, 900)
  assert.equal(e.who, 'a b c')
  assert.equal(parseCase({ ...record, sourceUrl: 'javascript:alert(1)' }), null)
  assert.equal(parseCase({ ...record, atlas: 'did:plc:other' }), null)
  assert.equal(parseCase({ ...record, title: 7 }), null)
})

test("loadOwnCases reads the owner's repo directly and skips records that are not case studies", async () => {
  const a = buildCase(seeds[0]).record
  const io = { resolveDid: async () => ({ pds: 'https://pds.example' }), listRecords: async (_pds, repo, col) => {
    assert.equal(repo, ATLAS_DID); assert.equal(col, COL.case)
    return [{ uri: `at://${ATLAS_DID}/${COL.case}/k1`, rkey: 'k1', value: a }, { uri: 'x', rkey: 'k2', value: { $type: COL.case } }]
  } }
  const out = await loadOwnCases(io)
  assert.equal(out.length, 1)
  assert.equal(out[0].title, seeds[0].title)
  assert.equal(out[0].uri, `at://${ATLAS_DID}/${COL.case}/k1`)
})

test('contributed case studies load beside links; the owner\'s own and unplaced ones are left out', async () => {
  const mine = buildCase(study).record
  const unplaced = buildCase({ ...study, scope: undefined, unit: undefined }).record
  const out = await loadCommunity(fakeIo({ [C('did:plc:aaa', '1')]: mine, [C(ATLAS_DID, 'own')]: mine, [C('did:plc:bbb', '2')]: unplaced, [L('did:plc:ccc', '3')]: buildLink(good).record }))
  assert.deepEqual(out.cases.map((c) => c.did), ['did:plc:aaa'])
  assert.equal(out.cases[0].title, 'Ditch day')
  assert.equal(out.cases[0].handle, 'aaa.example')
  assert.equal(out.links.length, 1)
})

test('a takedown request withholds a contributed case study', async () => {
  const mine = buildCase(study).record
  const down = buildTakedown(`at://did:plc:aaa/${COL.case}/1`).record
  const out = await loadCommunity(fakeIo({ [C('did:plc:aaa', '1')]: mine, [T('did:plc:zzz', '9')]: down }))
  assert.equal(out.cases.length, 0)
  assert.equal(out.withheld, 1)
})
