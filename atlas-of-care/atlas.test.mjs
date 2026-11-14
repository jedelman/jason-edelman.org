// node --test atlas-of-care/atlas.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLink, parseLink, buildTakedown, parseTakedown, loadCommunity, cleanUrl, linkUri, subjectUri, buildVouch, parseVouch, cleanVouches, standingVouches, loadFollowing, vouchSubject, COL, ATLAS_DID, SCOPE, MAX_URL } from './atlas.js'

const good = { url: 'https://example.org/acequia', scope: 'us', unit: '35039', lat: 36.5123, lon: -106.6987 }
const uriOf = (did, rkey) => `at://${did}/${COL.link}/${rkey}`

test('scope covers the three collections and nothing else', () => {
  assert.equal(SCOPE, 'atproto repo:org.jason-edelman.atlas.link repo:org.jason-edelman.atlas.vouch repo:org.jason-edelman.atlas.takedown')
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

test('a takedown can point at a vouch too', () => {
  const subject = `at://did:plc:aaa/${COL.vouch}/3abc`
  assert.equal(subjectUri(subject), subject)
  assert.equal(linkUri(subject), null)
  assert.equal(parseTakedown(buildTakedown(subject).record), subject)
})

test('a takedown cannot point at anything but a link or vouch record', () => {
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
  for (const failIndex of [COL.link, COL.vouch, COL.takedown]) {
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

// ── Vouches ──────────────────────────────────────────────────────────────────

const V = (did, rkey) => `${did}/${COL.vouch}/${rkey}`
const vouch = { subject: 'did:plc:tender' }

test('a vouch points at an account and holds nothing else', () => {
  const r = buildVouch(vouch, new Date('2026-11-14T15:00:00Z'))
  assert.deepEqual(r.record, { $type: COL.vouch, atlas: ATLAS_DID, subject: 'did:plc:tender', createdAt: '2026-11-14T15:00:00.000Z' })
  assert.deepEqual(Object.keys(buildVouch({ ...vouch, name: 'free text', note: 'x', unit: '51710', lat: 1, lon: 2 }).record).sort(), ['$type', 'atlas', 'createdAt', 'subject'])
})

test('a vouch cannot be for a web address, a name or a bare handle', () => {
  for (const subject of ['https://foodbank.example/', 'Maria down the street', 'tender.bsky.social', 'javascript:alert(1)', 'did:', '', null]) assert.equal(buildVouch({ subject }).ok, false, String(subject))
  assert.equal(vouchSubject('did:web:example.org'), 'did:web:example.org')
})

test('parseVouch round-trips, ignores an old record\'s place, and rejects what is not a vouch for this atlas', () => {
  const { record } = buildVouch(vouch, new Date('2026-11-14T15:00:00Z'))
  assert.deepEqual(parseVouch(record), { subject: 'did:plc:tender', createdAt: '2026-11-14T15:00:00.000Z' })
  assert.deepEqual(Object.keys(parseVouch({ ...record, scope: 'us', unit: '51710', lat: '36.92', lon: '-76.24', note: 'free text' })).sort(), ['createdAt', 'subject'])
  assert.equal(parseVouch({ ...record, subject: 'https://foodbank.example/' }), null)
  assert.equal(parseVouch({ ...record, subject: 'Maria' }), null)
  assert.equal(parseVouch({ ...record, atlas: 'did:plc:other' }), null)
})

test('a voucher counts once per account, never for themselves, and only for someone who is on the map', () => {
  const base = { ...parseVouch(buildVouch(vouch).record) }
  const list = [
    { ...base, did: 'did:plc:aaa', handle: 'a.example', uri: 'u1', rkey: '1' },
    { ...base, did: 'did:plc:bbb', handle: 'b.example', uri: 'u2', rkey: '2' },
    { ...base, did: 'did:plc:aaa', handle: 'a.example', uri: 'u3', rkey: '3' },      // the same person again
    { ...base, did: 'did:plc:tender', handle: 't.example', uri: 'u4', rkey: '4' },   // vouching for oneself
    { ...base, subject: 'did:plc:absent', did: 'did:plc:ccc', handle: 'c.example', uri: 'u5', rkey: '5' },   // someone who never entered
  ]
  const clean = cleanVouches(list)
  assert.deepEqual(clean.map((v) => v.did + '>' + v.subject), ['did:plc:aaa>did:plc:tender', 'did:plc:bbb>did:plc:tender', 'did:plc:ccc>did:plc:absent'])
  assert.deepEqual(clean[0].records, [{ uri: 'u1', rkey: '1' }, { uri: 'u3', rkey: '3' }])
  assert.deepEqual(standingVouches(clean, new Set(['did:plc:tender'])).map((v) => v.did), ['did:plc:aaa', 'did:plc:bbb'])
  assert.deepEqual(standingVouches(clean, new Set()), [])
})

test('vouches load with the rest; a takedown withholds one, and so does the hidden list for whoever is vouched for', async () => {
  const rec = buildVouch(vouch).record
  const other = buildVouch({ subject: 'did:plc:hidden' }).record
  const recs = { [V('did:plc:aaa', '1')]: rec, [V('did:plc:bbb', '2')]: rec, [V('did:plc:ccc', '3')]: other, [T('did:plc:tender', '9')]: buildTakedown(`at://did:plc:aaa/${COL.vouch}/1`).record }
  const out = await loadCommunity(fakeIo(recs), { dids: ['did:plc:hidden'] })
  assert.deepEqual(out.vouches.map((v) => v.did), ['did:plc:bbb'])
  assert.equal(out.withheld, 1)
  assert.equal(subjectUri(`at://did:plc:aaa/${COL.vouch}/1`), `at://did:plc:aaa/${COL.vouch}/1`)
})

// ── Who you follow ───────────────────────────────────────────────────────────

test('loadFollowing asks about 30 accounts a call, never about yourself, and keeps only those you follow', async () => {
  const me = 'did:plc:me'
  const dids = Array.from({ length: 65 }, (_, i) => `did:plc:x${i}`)
  const calls = []
  const getJson = async (url) => {
    const q = new URL(url).searchParams
    calls.push(q.getAll('others'))
    assert.equal(q.get('actor'), me)
    return { relationships: q.getAll('others').map((did) => (did.endsWith('3') ? { did, following: `at://${me}/app.bsky.graph.follow/k` } : did.endsWith('4') ? { did, followedBy: 'at://x/app.bsky.graph.follow/k' } : { did })) }
  }
  const out = await loadFollowing(getJson, me, [me, ...dids, dids[0], 'not a did'])
  assert.deepEqual(calls.map((c) => c.length), [30, 30, 5])
  assert.equal(calls.flat().includes(me), false)
  assert.deepEqual([...out].sort(), dids.filter((d) => d.endsWith('3')).sort())
})

test('loadFollowing throws when a call fails, so half an answer is never shown', async () => {
  await assert.rejects(loadFollowing(async () => { throw new Error('HTTP 502') }, 'did:plc:me', ['did:plc:a']))
  assert.deepEqual([...(await loadFollowing(async () => { throw new Error('unused') }, 'did:plc:me', []))], [])
})
