// node --test atlas-of-care/atlas.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStatement, parseStatement, cleanStatement, withI, buildTakedown, parseTakedown, loadCommunity, cleanUrl, statementUri, subjectUri, buildVouch, parseVouch, buildLike, parseLike, cleanVouches, standingVouches, cleanLikes, standingLikes, loadFollowing, COL, ATLAS_DID, SCOPE, MAX_URL, MAX_TEXT } from './atlas.js'

const good = { text: 'feed the birds', scope: 'us', unit: '35039' }
const uriOf = (did, rkey) => `at://${did}/${COL.statement}/${rkey}`
const CID1 = 'bafyreib2rxk3rybk3aobmv5cjuql3bm2twh4jo5uxgf5kpqcsgz7soitae'
const CID2 = 'bafyreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku'

test('scope covers the four collections and nothing else', () => {
  assert.equal(SCOPE, 'atproto repo:org.jason-edelman.atlas.statement repo:org.jason-edelman.atlas.vouch repo:org.jason-edelman.atlas.like repo:org.jason-edelman.atlas.takedown')
})

test('a statement record holds one sentence that begins with I, and a place if one was picked', () => {
  const r = buildStatement(good, new Date('2026-11-14T15:00:00Z'))
  assert.deepEqual(r.record, { $type: COL.statement, atlas: ATLAS_DID, text: 'I feed the birds', createdAt: '2026-11-14T15:00:00.000Z', scope: 'us', unit: '35039' })
  assert.deepEqual(buildStatement({ text: 'feed the birds' }, new Date('2026-11-14T15:00:00Z')).record, { $type: COL.statement, atlas: ATLAS_DID, text: 'I feed the birds', createdAt: '2026-11-14T15:00:00.000Z' })
  for (const v of Object.values(r.record)) assert.equal(typeof v, 'string')
})

test('the I is supplied by the form and never doubled', () => {
  assert.equal(withI('cook for my kids'), 'I cook for my kids')
  assert.equal(withI('I clean toilets'), 'I clean toilets')
  assert.equal(withI("I'm the one who locks up"), "I'm the one who locks up")
  assert.equal(buildStatement({ ...good, text: '  clean \n  toilets ' }).record.text, 'I clean toilets')
  assert.equal(buildStatement({ ...good, text: "I've kept the well for years" }).record.text, "I've kept the well for years")
})

test('a statement can carry a web address, and a bad one is refused when written', () => {
  assert.equal(buildStatement({ ...good, url: 'https://example.org/acequia#top' }).record.url, 'https://example.org/acequia')
  assert.equal('url' in buildStatement({ ...good, url: '  ' }).record, false)
  assert.equal(buildStatement({ ...good, url: 'javascript:alert(1)' }).ok, false)
})

test('a statement has to begin with I and stay one short line about no one else', () => {
  const bad = ['You never help', 'Bob feeds the birds', 'It is cold', 'I', 'I ', 'Ian feeds the birds', 'i feed the birds', 'I thank @bob.example', 'I post at https://x.example', 'I am at www.x.example',
    'I ' + 'x'.repeat(MAX_TEXT), 'I feed\u202e the birds', 'I feed\u0000 the birds', '', null, 42, {}]
  for (const s of bad) assert.equal(cleanStatement(s), null, String(s))
  assert.equal(cleanStatement('I ' + 'x'.repeat(MAX_TEXT - 2)).length, MAX_TEXT)
  assert.equal(buildStatement({ ...good, text: 'x'.repeat(200) }).ok, false)
  assert.equal(buildStatement({ ...good, text: '' }).ok, false)
})

test('half a place is refused, and anything else passed in is ignored', () => {
  assert.deepEqual(buildStatement({ ...good, unit: '' }).errors, ['Pick the place from the list, or leave it out.'])
  assert.equal(buildStatement({ ...good, scope: 'mars' }).ok, false)
  assert.equal(buildStatement({ text: 'feed the birds', scope: 'us' }).ok, false)
  const r = buildStatement({ ...good, title: 'hello', about: 'someone else', unitName: 'anything', lat: 1, lon: 2 })
  assert.deepEqual(Object.keys(r.record).sort(), ['$type', 'atlas', 'createdAt', 'scope', 'text', 'unit'])
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
  assert.equal(buildStatement({ ...good, unit: 'call me at 555 0100' }).ok, false)
  assert.equal(buildStatement({ ...good, unit: '<b>x</b>' }).ok, false)
  assert.equal(buildStatement({ ...good, unit: 'x'.repeat(65) }).ok, false)
})

test('parseStatement round-trips a built record, with or without a place', () => {
  const { record } = buildStatement({ ...good, url: 'https://example.org/acequia' }, new Date('2026-11-14T15:00:00Z'))
  assert.deepEqual(parseStatement(record), { text: 'I feed the birds', url: 'https://example.org/acequia', host: 'example.org', scope: 'us', unit: '35039', createdAt: '2026-11-14T15:00:00.000Z' })
  const bare = parseStatement(buildStatement({ text: 'feed the birds' }).record)
  assert.deepEqual([bare.url, bare.scope, bare.unit], [null, null, null])
})

test('parseStatement returns only its own fields, drops a bad address or place, and keeps markup as plain text', () => {
  const { record } = buildStatement(good)
  const e = parseStatement({ ...record, text: 'I <img src=x onerror=alert(1)>', url: 'javascript:alert(1)', unit: 'two words', lat: '36.51', lon: '-106.70', about: 'someone else', unitName: 'anything' })
  assert.deepEqual(Object.keys(e).sort(), ['createdAt', 'host', 'scope', 'text', 'unit', 'url'])
  assert.deepEqual([e.url, e.scope, e.unit], [null, null, null])
  assert.equal(e.text, 'I <img src=x onerror=alert(1)>')   // the page escapes it; it is never markup
  assert.equal(parseStatement({ ...record, scope: 'mars' }).unit, null)
  assert.equal(parseStatement({ ...record, unit: 7 }).scope, null)
})

test('parseStatement rejects records that are not statements for this atlas', () => {
  const { record } = buildStatement(good)
  assert.equal(parseStatement(null), null)
  assert.equal(parseStatement({ ...record, $type: 'app.bsky.feed.post' }), null)
  assert.equal(parseStatement({ ...record, atlas: 'did:plc:someoneelse' }), null)
  assert.equal(parseStatement({ ...record, text: 'She feeds the birds' }), null)
  assert.equal(parseStatement({ ...record, text: undefined }), null)
})

test('a takedown points at one statement on this map and carries nothing else', () => {
  const subject = uriOf('did:plc:aaa', '3abc')
  const r = buildTakedown(subject, new Date('2026-11-14T15:00:00Z'))
  assert.deepEqual(r.record, { $type: COL.takedown, atlas: ATLAS_DID, subject, createdAt: '2026-11-14T15:00:00.000Z' })
  assert.equal(parseTakedown(r.record), subject)
  assert.equal(parseTakedown({ ...r.record, reason: 'ignored' }), subject)
})

test('a takedown can point at a vouch too', () => {
  const subject = `at://did:plc:aaa/${COL.vouch}/3abc`
  assert.equal(subjectUri(subject), subject)
  assert.equal(statementUri(subject), null)
  assert.equal(parseTakedown(buildTakedown(subject).record), subject)
})

test('a takedown cannot point at anything but a statement or vouch record', () => {
  for (const s of ['at://did:plc:aaa/app.bsky.feed.post/3abc', 'https://example.org', 'at://not-a-did/' + COL.statement + '/1', uriOf('did:plc:aaa', 'a/b'), '', null]) {
    assert.equal(subjectUri(s), null, String(s))
    assert.equal(buildTakedown(s).ok, false)
  }
  assert.equal(parseTakedown({ $type: COL.takedown, atlas: 'did:plc:other', subject: uriOf('did:plc:aaa', '1') }), null)
})

// records: { 'did/collection/rkey': value }; cids: { 'did/collection/rkey': cid }
const fakeIo = (records, { failDid, failIndex, cids = {} } = {}) => ({
  backlinks: async (_target, collection) => {
    if (failIndex === collection) throw new Error('index down')
    return Object.keys(records).filter((k) => k.split('/')[1] === collection).map((k) => ({ did: k.split('/')[0], collection, rkey: k.split('/')[2] }))
  },
  resolveDid: async (did) => {
    if (did === failDid) throw new Error('unreachable')
    return { did, pds: 'https://pds.example', handle: did.slice(-3) + '.example' }
  },
  getRecord: async (_pds, did, col, rkey) => (records[`${did}/${col}/${rkey}`] ? { value: records[`${did}/${col}/${rkey}`], cid: cids[`${did}/${col}/${rkey}`] || CID1 } : null),
})
const L = (did, rkey) => `${did}/${COL.statement}/${rkey}`
const T = (did, rkey) => `${did}/${COL.takedown}/${rkey}`

test('loadCommunity reads each statement from its author, newest first, with its content hash, and skips junk', async () => {
  const a = buildStatement(good, new Date('2026-11-01T00:00:00Z')).record
  const b = buildStatement({ ...good, text: 'cook for my kids' }, new Date('2026-11-10T00:00:00Z')).record
  const out = await loadCommunity(fakeIo({ [L('did:plc:aaa', '1')]: a, [L('did:plc:bbb', '2')]: b, [L('did:plc:ccc', '3')]: { $type: COL.statement, atlas: ATLAS_DID }, [L('did:plc:ddd', '4')]: null }, { cids: { [L('did:plc:bbb', '2')]: CID2 } }))
  assert.equal(out.error, null)
  assert.deepEqual(out.statements.map((e) => e.text), ['I cook for my kids', 'I feed the birds'])
  assert.equal(out.statements[0].uri, uriOf('did:plc:bbb', '2'))
  assert.equal(out.statements[0].recordCid, CID2)
  assert.equal(out.statements[0].handle, 'bbb.example')
  assert.equal(out.withheld, 0)
})

test('a takedown request withholds the statement at once', async () => {
  const a = buildStatement(good).record
  const down = buildTakedown(uriOf('did:plc:aaa', '1')).record
  const out = await loadCommunity(fakeIo({ [L('did:plc:aaa', '1')]: a, [L('did:plc:bbb', '2')]: a, [T('did:plc:zzz', '9')]: down }))
  assert.deepEqual(out.statements.map((e) => e.did), ['did:plc:bbb'])
  assert.equal(out.withheld, 1)
})

test('keep overrides a takedown request; hidden dids and uris are never shown', async () => {
  const a = buildStatement(good).record
  const recs = { [L('did:plc:aaa', '1')]: a, [L('did:plc:bbb', '2')]: a, [L('did:plc:ccc', '3')]: a, [T('did:plc:zzz', '9')]: buildTakedown(uriOf('did:plc:aaa', '1')).record }
  const out = await loadCommunity(fakeIo(recs), { keep: [uriOf('did:plc:aaa', '1')], dids: ['did:plc:bbb'], uris: [uriOf('did:plc:ccc', '3')] })
  assert.deepEqual(out.statements.map((e) => e.did), ['did:plc:aaa'])
  assert.equal(out.withheld, 0)
})

test('loadCommunity fails closed when any index query fails', async () => {
  const a = buildStatement(good).record
  for (const failIndex of [COL.statement, COL.vouch, COL.like, COL.takedown]) {
    const out = await loadCommunity(fakeIo({ [L('did:plc:aaa', '1')]: a }, { failIndex }))
    assert.equal(out.statements.length, 0)
    assert.equal(out.error.message, 'index down')
  }
})

test('loadCommunity counts authors it could not reach', async () => {
  const a = buildStatement(good).record
  const out = await loadCommunity(fakeIo({ [L('did:plc:aaa', '1')]: a, [L('did:plc:eee', '5')]: a }, { failDid: 'did:plc:eee' }))
  assert.deepEqual(out.statements.map((e) => e.did), ['did:plc:aaa'])
  assert.equal(out.unreachable, 1)
})

// ── Vouches ──────────────────────────────────────────────────────────────────

const V = (did, rkey) => `${did}/${COL.vouch}/${rkey}`
const TENDER = uriOf('did:plc:tender', 's1')
const vouch = { uri: TENDER, cid: CID1 }

test('a vouch points at one statement, by address and content hash, and holds nothing else', () => {
  const r = buildVouch(vouch, new Date('2026-11-14T15:00:00Z'))
  assert.deepEqual(r.record, { $type: COL.vouch, atlas: ATLAS_DID, subject: { uri: TENDER, cid: CID1 }, createdAt: '2026-11-14T15:00:00.000Z' })
  assert.deepEqual(Object.keys(buildVouch({ ...vouch, note: 'free text', text: 'She feeds the birds' }).record).sort(), ['$type', 'atlas', 'createdAt', 'subject'])
})

test('a vouch cannot be for an account, a web address, a name or another kind of record', () => {
  for (const uri of ['did:plc:tender', 'https://foodbank.example/', 'Maria down the street', 'at://did:plc:tender/app.bsky.feed.post/1', `at://did:plc:tender/${COL.vouch}/1`, '', null]) assert.equal(buildVouch({ uri, cid: CID1 }).ok, false, String(uri))
  for (const cid of ['', 'not a cid!', null, 7]) assert.equal(buildVouch({ uri: TENDER, cid }).ok, false, String(cid))
})

test('parseVouch round-trips and rejects what is not a vouch for a statement on this atlas', () => {
  const { record } = buildVouch(vouch, new Date('2026-11-14T15:00:00Z'))
  assert.deepEqual(parseVouch(record), { subject: TENDER, cid: CID1, createdAt: '2026-11-14T15:00:00.000Z' })
  assert.deepEqual(Object.keys(parseVouch({ ...record, note: 'free text' })).sort(), ['cid', 'createdAt', 'subject'])
  assert.equal(parseVouch({ ...record, subject: 'did:plc:tender' }), null)            // the rule before this one
  assert.equal(parseVouch({ ...record, subject: 'https://foodbank.example/' }), null)  // and the one before that
  assert.equal(parseVouch({ ...record, subject: { uri: TENDER } }), null)
  assert.equal(parseVouch({ ...record, atlas: 'did:plc:other' }), null)
})

test('a voucher counts once per statement, never for their own, and only while the statement reads as it did', () => {
  const base = { ...parseVouch(buildVouch(vouch).record) }
  const list = [
    { ...base, did: 'did:plc:aaa', handle: 'a.example', uri: 'u1', rkey: '1' },
    { ...base, did: 'did:plc:bbb', handle: 'b.example', uri: 'u2', rkey: '2' },
    { ...base, did: 'did:plc:aaa', handle: 'a.example', uri: 'u3', rkey: '3' },      // the same person again
    { ...base, did: 'did:plc:tender', handle: 't.example', uri: 'u4', rkey: '4' },   // vouching for one's own statement
    { ...base, subject: uriOf('did:plc:absent', 'x'), did: 'did:plc:ccc', handle: 'c.example', uri: 'u5', rkey: '5' },   // a statement that is not on the map
  ]
  const clean = cleanVouches(list)
  assert.deepEqual(clean.map((v) => v.did), ['did:plc:aaa', 'did:plc:bbb', 'did:plc:ccc'])
  assert.deepEqual(clean[0].records, [{ uri: 'u1', rkey: '1' }, { uri: 'u3', rkey: '3' }])
  assert.deepEqual(standingVouches(clean, new Map([[TENDER, CID1]])).map((v) => v.did), ['did:plc:aaa', 'did:plc:bbb'])
  assert.deepEqual(standingVouches(clean, new Map([[TENDER, CID2]])), [])   // the sentence was changed after it was vouched for
  assert.deepEqual(standingVouches(clean, new Map()), [])
})

test('vouches load with the rest; a takedown withholds one, and so does the hidden list for whoever is vouched for', async () => {
  const rec = buildVouch(vouch).record
  const other = buildVouch({ uri: uriOf('did:plc:hidden', 's2'), cid: CID1 }).record
  const recs = { [V('did:plc:aaa', '1')]: rec, [V('did:plc:bbb', '2')]: rec, [V('did:plc:ccc', '3')]: other, [T('did:plc:tender', '9')]: buildTakedown(`at://did:plc:aaa/${COL.vouch}/1`).record }
  const out = await loadCommunity(fakeIo(recs), { dids: ['did:plc:hidden'] })
  assert.deepEqual(out.vouches.map((v) => v.did), ['did:plc:bbb'])
  assert.equal(out.vouches[0].subject, TENDER)
  assert.equal(out.withheld, 1)
  assert.equal(subjectUri(`at://did:plc:aaa/${COL.vouch}/1`), `at://did:plc:aaa/${COL.vouch}/1`)
})

// ── Likes ────────────────────────────────────────────────────────────────────

test('a like is the same pointer as a vouch, in its own collection', () => {
  const r = buildLike(vouch, new Date('2026-11-14T15:00:00Z'))
  assert.deepEqual(r.record, { $type: COL.like, atlas: ATLAS_DID, subject: { uri: TENDER, cid: CID1 }, createdAt: '2026-11-14T15:00:00.000Z' })
  assert.deepEqual(parseLike(r.record), { subject: TENDER, cid: CID1, createdAt: '2026-11-14T15:00:00.000Z' })
  assert.equal(parseLike(buildVouch(vouch).record), null)   // a vouch is not a like
  assert.equal(parseVouch(r.record), null)                  // and a like is not a vouch
  assert.equal(buildLike({ uri: 'did:plc:tender', cid: CID1 }).ok, false)
})

test('a liker counts once per statement, never for their own, and only while the statement reads as it did', () => {
  const base = { ...parseLike(buildLike(vouch).record) }
  const clean = cleanLikes([
    { ...base, did: 'did:plc:aaa', uri: 'k1', rkey: '1' }, { ...base, did: 'did:plc:aaa', uri: 'k2', rkey: '2' },
    { ...base, did: 'did:plc:tender', uri: 'k3', rkey: '3' }, { ...base, did: 'did:plc:bbb', uri: 'k4', rkey: '4' },
  ])
  assert.deepEqual(clean.map((v) => v.did), ['did:plc:aaa', 'did:plc:bbb'])
  assert.equal(standingLikes(clean, new Map([[TENDER, CID1]])).length, 2)
  assert.equal(standingLikes(clean, new Map([[TENDER, CID2]])).length, 0)
})

test('likes load with the rest, and not from or for a hidden account', async () => {
  const K = (did, rkey) => `${did}/${COL.like}/${rkey}`
  const rec = buildLike(vouch).record
  const recs = { [K('did:plc:aaa', '1')]: rec, [K('did:plc:bad', '2')]: rec, [K('did:plc:ccc', '3')]: buildLike({ uri: uriOf('did:plc:bad', 's9'), cid: CID1 }).record, [V('did:plc:bbb', '4')]: buildVouch(vouch).record }
  const out = await loadCommunity(fakeIo(recs), { dids: ['did:plc:bad'] })
  assert.deepEqual(out.likes.map((v) => v.did), ['did:plc:aaa'])
  assert.deepEqual(out.vouches.map((v) => v.did), ['did:plc:bbb'])
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
