// node --test atlas-of-care/atlas.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRecord, parseEntry, loadCommunity, clean, COL, ATLAS_DID, SCOPE, LIMITS } from './atlas.js'

const good = {
  title: 'Spring ditch cleaning',
  does: 'Neighbours clear the shared ditch each April.',
  who: 'Water-right holders',
  pays: 'unpaid',
  needs: 'Shovels and a truck',
  mode: 'repeats',
  domain: 'commons',
  scope: 'us',
  unit: '35039',
  unitName: 'Rio Arriba County, NM',
  lat: 36.5123,
  lon: -106.6987,
  link: 'https://example.org/acequia',
}

test('scope covers the one collection and nothing else', () => {
  assert.equal(SCOPE, 'atproto repo:org.jason-edelman.atlas.entry')
})

test('buildRecord writes strings for coordinates, rounded to two places', () => {
  const r = buildRecord(good, new Date('2026-11-14T15:00:00Z'))
  assert.equal(r.ok, true)
  assert.equal(r.record.$type, COL)
  assert.equal(r.record.atlas, ATLAS_DID)
  assert.equal(r.record.lat, '36.51')
  assert.equal(r.record.lon, '-106.70')
  assert.equal(r.record.createdAt, '2026-11-14T15:00:00.000Z')
  for (const v of Object.values(r.record)) assert.equal(typeof v, 'string') // no floats in atproto records
})

test('buildRecord leaves empty optional fields out', () => {
  const r = buildRecord({ ...good, who: '  ', pays: '', needs: undefined, link: '' })
  assert.equal(r.ok, true)
  for (const k of ['who', 'pays', 'needs', 'link']) assert.equal(k in r.record, false)
})

test('buildRecord says what is missing', () => {
  const r = buildRecord({ ...good, title: ' ', does: '', unit: '', lat: undefined })
  assert.equal(r.ok, false)
  assert.deepEqual(r.errors, ['Give it a short name.', 'Say what is done.', 'Pick a place on the map first.'])
})

test('buildRecord refuses a link that is not http(s)', () => {
  for (const link of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.org', 'not a url']) {
    const r = buildRecord({ ...good, link })
    assert.equal(r.ok, false, link)
  }
})

test('buildRecord refuses unknown mode, domain and scope', () => {
  assert.equal(buildRecord({ ...good, mode: 'sometimes' }).ok, false)
  assert.equal(buildRecord({ ...good, domain: 'other' }).ok, false)
  assert.equal(buildRecord({ ...good, scope: 'mars' }).ok, false)
})

test('clean strips control and bidi characters and caps length by code point', () => {
  assert.equal(clean('a\u0000b‮c\n\n d', 50), 'a b c d')
  assert.equal([...clean('😀'.repeat(200), LIMITS.title)].length, LIMITS.title)
})

test('parseEntry round-trips a built record', () => {
  const { record } = buildRecord(good, new Date('2026-11-14T15:00:00Z'))
  const e = parseEntry(record)
  assert.equal(e.title, good.title)
  assert.equal(e.lat, 36.51)
  assert.equal(e.lon, -106.7)
  assert.equal(e.link, 'https://example.org/acequia')
})

test('parseEntry rejects records that are not entries for this atlas', () => {
  const { record } = buildRecord(good)
  assert.equal(parseEntry(null), null)
  assert.equal(parseEntry({ ...record, $type: 'app.bsky.feed.post' }), null)
  assert.equal(parseEntry({ ...record, atlas: 'did:plc:someoneelse' }), null)
  assert.equal(parseEntry({ ...record, lat: '191' }), null)
  assert.equal(parseEntry({ ...record, lat: true }), null)
  assert.equal(parseEntry({ ...record, mode: 'x' }), null)
  assert.equal(parseEntry({ ...record, title: '' }), null)
})

test('parseEntry drops a hostile link and caps long text', () => {
  const { record } = buildRecord(good)
  const e = parseEntry({ ...record, link: 'javascript:alert(1)', does: 'x'.repeat(5000), title: '<img src=x onerror=alert(1)>' })
  assert.equal(e.link, null)
  assert.equal(e.does.length, LIMITS.does)
  assert.equal(e.title, '<img src=x onerror=alert(1)>') // kept as text; the page escapes it
})

const fakeIo = (records, { failDid } = {}) => ({
  backlinks: async () => Object.keys(records).map((k) => ({ did: k.split('/')[0], collection: COL, rkey: k.split('/')[1] })),
  resolveDid: async (did) => {
    if (did === failDid) throw new Error('unreachable')
    return { did, pds: 'https://pds.example', handle: did.slice(-3) + '.example' }
  },
  getRecord: async (_pds, did, _col, rkey) => (records[`${did}/${rkey}`] ? { uri: `at://${did}/${COL}/${rkey}`, value: records[`${did}/${rkey}`] } : null),
})

test('loadCommunity reads each entry from its author, newest first, and skips junk', async () => {
  const a = buildRecord(good, new Date('2026-11-01T00:00:00Z')).record
  const b = buildRecord({ ...good, title: 'Newer' }, new Date('2026-11-10T00:00:00Z')).record
  const out = await loadCommunity(fakeIo({ 'did:plc:aaa/1': a, 'did:plc:bbb/2': b, 'did:plc:ccc/3': { $type: COL, atlas: ATLAS_DID }, 'did:plc:ddd/4': null }))
  assert.equal(out.error, null)
  assert.deepEqual(out.entries.map((e) => e.title), ['Newer', 'Spring ditch cleaning'])
  assert.equal(out.entries[0].uri, `at://did:plc:bbb/${COL}/2`)
  assert.equal(out.entries[0].handle, 'bbb.example')
})

test('loadCommunity honours the hidden list and counts unreachable authors', async () => {
  const a = buildRecord(good).record
  const io = fakeIo({ 'did:plc:aaa/1': a, 'did:plc:bbb/2': a, 'did:plc:ccc/3': a, 'did:plc:eee/5': a }, { failDid: 'did:plc:eee' })
  const out = await loadCommunity(io, { dids: ['did:plc:aaa'], uris: [`at://did:plc:bbb/${COL}/2`] })
  assert.deepEqual(out.entries.map((e) => e.did), ['did:plc:ccc'])
  assert.equal(out.unreachable, 1)
})

test('loadCommunity reports an index failure without throwing', async () => {
  const out = await loadCommunity({ backlinks: async () => { throw new Error('index down') } })
  assert.equal(out.entries.length, 0)
  assert.equal(out.error.message, 'index down')
})
