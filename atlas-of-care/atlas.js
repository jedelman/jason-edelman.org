// Atlas of Care: what people add to the map. No DOM and no SDK import, so it
// runs in the browser and in Node tests alike.
//
// The marks on the map are only what people add, and there are three kinds of record:
//
//   statement  "what do you do to hold your world together": one sentence in
//              the person's own words that begins with "I", and a place. It
//              may carry a web address. Nobody can write one about someone else:
//              it sits in the repo of whoever says it, and it has to say "I".
//   vouch      "who holds your world together": a pointer at one statement, by
//              its address and its content hash, and nothing else. It affirms
//              that sentence as it stood. If the sentence is changed or
//              removed, the vouch no longer counts.
//   takedown   a request that one statement or vouch come off the page. It
//              points at the record and carries no text.
//
// Nobody keeps a list of contributors and this site stores nothing. Each
// record names the atlas's DID in its `atlas` field, and Constellation, a
// network-wide index of links between records, answers "which records point at
// this DID?" The index only says where to look. Each record it reports is read
// from its author's own PDS, so a deleted one 404s and drops out.
//
// A statement is placed in an administrative unit (a country, a county, a
// district, a region), never at an address. Its coordinates are the centre of
// that unit, rounded.
//
// A takedown request is honoured at once: the record stops being shown here.
// The site's own hidden.json can list it under `keep` to show it again after a
// request has been looked at and turned down.

export const NS = 'org.jason-edelman.atlas'
export const COL = { statement: `${NS}.statement`, vouch: `${NS}.vouch`, takedown: `${NS}.takedown` }
// Granular OAuth scope: this app can touch its own three collections, nothing else.
export const SCOPE = ['atproto', ...Object.values(COL).map((c) => `repo:${c}`)].join(' ')
// jason-edelman.org. Records point here so the index can find them.
export const ATLAS_DID = 'did:plc:zz4wcje4a2nbbtc7pdoth3f2'
export const MAX_RECORDS = 2000
export const MAX_URL = 400
export const MAX_TEXT = 140

export const SCOPES = ['world', 'us', 'in', 'eu']
const UNIT = /^[A-Za-z0-9._-]{1,64}$/
const DID = /^did:[a-z]+:[A-Za-z0-9._:%-]{1,200}$/
const RKEY = /^[A-Za-z0-9._~:-]{1,512}$/
const CID = /^[a-z0-9]{20,200}$/i

// A web address we are willing to show: http(s), a real host name, no
// credentials, no fragment. Returns the normalised address, or null.
export function cleanUrl(s) {
  if (typeof s !== 'string') return null
  const raw = s.trim()
  if (!raw || raw.length > MAX_URL || /[\s\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/.test(raw)) return null
  let u
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (u.username || u.password) return null
  const host = u.hostname
  if (!host.includes('.') || host.endsWith('.') || /^[0-9.]+$/.test(host) || host.startsWith('[')) return null
  u.hash = ''
  return u.href.length <= MAX_URL ? u.href : null
}

export const hostOf = (url) => new URL(url).hostname.replace(/^www\./, '')

const coord = (s, lim) => {
  if (typeof s !== 'string' && typeof s !== 'number') return null
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && Math.abs(n) <= lim ? n : null
}

// One sentence that begins with "I". Returns it tidied, or null.
//
// "I" is the whole rule about whose work a statement can describe. Beyond it,
// a statement is one line of at most MAX_TEXT characters, with no web address
// and no @-mention in it: the address has its own field, and a mention is a
// way of talking about someone else.
const UNSAFE = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/
export function cleanStatement(s) {
  if (typeof s !== 'string') return null
  if (UNSAFE.test(s.replace(/[\t\n\r]/g, ' '))) return null
  const text = s.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!/^I(?: |['’](?:m|ve|ll|d) )\S/.test(text) || [...text].length < 4 || [...text].length > MAX_TEXT) return null
  if (/@|:\/\/|\bwww\.|\bhttps?\b/i.test(text)) return null
  return text
}
// What someone typed after the "I" the form already shows -> the full sentence.
// A leading "I" they typed anyway ("I cook", "I'm the one who") is not doubled.
export const withI = (rest) => {
  const r = String(rest ?? '').trim()
  return /^I(?:\s|['’])/.test(r) ? r : 'I ' + r
}

// What the form collects -> a statement record to write, or the reasons it can't be.
// atproto records hold no floats, so coordinates are strings.
export function buildStatement(input, now = new Date()) {
  const errors = []
  const text = cleanStatement(withI(input.text))
  if (!text) errors.push(`Say what you do in one line, up to ${MAX_TEXT} characters, with no web address or @ in it.`)
  const rawUrl = String(input.url ?? '').trim()
  const url = rawUrl ? cleanUrl(rawUrl) : null
  if (rawUrl && !url) errors.push('The web address has to be a full one that starts with https:// or http://. It can be left out.')
  const lat = coord(input.lat, 90)
  const lon = coord(input.lon, 180)
  if (!SCOPES.includes(input.scope) || !UNIT.test(String(input.unit ?? '')) || lat == null || lon == null) errors.push('Pick a place on the map first.')
  if (errors.length) return { ok: false, errors }
  const record = { $type: COL.statement, atlas: ATLAS_DID, text, scope: input.scope, unit: String(input.unit), lat: lat.toFixed(2), lon: lon.toFixed(2), createdAt: now.toISOString() }
  if (url) record.url = url
  return { ok: true, record }
}

// A record read from someone's repo -> a checked statement, or null if it isn't one.
// Anyone can write anything into their own repo, so nothing is trusted here. A web
// address that does not pass is dropped; the statement still stands.
export function parseStatement(value) {
  if (!value || typeof value !== 'object' || value.$type !== COL.statement || value.atlas !== ATLAS_DID) return null
  const text = cleanStatement(value.text)
  const lat = coord(value.lat, 90)
  const lon = coord(value.lon, 180)
  if (!text || lat == null || lon == null) return null
  if (!SCOPES.includes(value.scope) || typeof value.unit !== 'string' || !UNIT.test(value.unit)) return null
  const url = value.url == null ? null : cleanUrl(value.url)
  const created = new Date(typeof value.createdAt === 'string' ? value.createdAt : NaN)
  return { text, url, host: url ? hostOf(url) : null, scope: value.scope, unit: value.unit, lat, lon, createdAt: Number.isNaN(created.getTime()) ? null : created.toISOString() }
}

// at://did/<the statement collection>/rkey, and nothing else.
export function statementUri(s) {
  if (typeof s !== 'string') return null
  const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(s)
  return m && DID.test(m[1]) && m[2] === COL.statement && RKEY.test(m[3]) ? s : null
}

// A vouch record to write, or the reason it can't be. It points at one
// statement by address and content hash, the way atproto pins a record.
export function buildVouch(input, now = new Date()) {
  const uri = statementUri(input.uri)
  const cid = typeof input.cid === 'string' && CID.test(input.cid) ? input.cid : null
  if (!uri || !cid) return { ok: false, errors: ['A vouch is for something someone has said they do here.'] }
  return { ok: true, record: { $type: COL.vouch, atlas: ATLAS_DID, subject: { uri, cid }, createdAt: now.toISOString() } }
}

// A vouch record read from someone's repo -> a checked vouch, or null. Vouches
// written before 2026-11-14 pointed at an account or a web address; they are
// no longer vouches.
export function parseVouch(value) {
  if (!value || typeof value !== 'object' || value.$type !== COL.vouch || value.atlas !== ATLAS_DID) return null
  const s = value.subject
  if (!s || typeof s !== 'object') return null
  const subject = statementUri(s.uri)
  if (!subject || typeof s.cid !== 'string' || !CID.test(s.cid)) return null
  const created = new Date(typeof value.createdAt === 'string' ? value.createdAt : NaN)
  return { subject, cid: s.cid, createdAt: Number.isNaN(created.getTime()) ? null : created.toISOString() }
}

// One vouch per voucher per statement, however many records they wrote, and
// nobody's vouch for their own statement. `records` keeps every record behind
// it, so withdrawing or declining reaches all of them.
export function cleanVouches(vouches) {
  const seen = new Map()
  for (const v of vouches) {
    if (v.subject.split('/')[2] === v.did) continue
    const key = v.did + '|' + v.subject + '|' + v.cid
    const have = seen.get(key)
    if (have) have.records.push({ uri: v.uri, rkey: v.rkey })
    else seen.set(key, { did: v.did, handle: v.handle || null, subject: v.subject, cid: v.cid, createdAt: v.createdAt, records: [{ uri: v.uri, rkey: v.rkey }] })
  }
  return [...seen.values()]
}

// The vouches that count: those for a statement that is on the map and still
// reads as it did when it was vouched for. `current` maps a statement's address
// to its content hash.
export const standingVouches = (vouches, current) => vouches.filter((v) => current.get(v.subject) === v.cid)

// Which of `dids` the account `me` follows on Bluesky. getJson fetches a URL
// and returns its JSON; the AppView takes at most 30 accounts a call. Returns
// a Set, or throws if any call fails, so a partial answer is never shown as whole.
export const APPVIEW = 'https://public.api.bsky.app'
export const MAX_FOLLOW_CHECK = 900
export async function loadFollowing(getJson, me, dids) {
  const others = [...new Set(dids)].filter((d) => d !== me && DID.test(d)).slice(0, MAX_FOLLOW_CHECK)
  const out = new Set()
  for (let i = 0; i < others.length; i += 30) {
    const q = new URLSearchParams([['actor', me], ...others.slice(i, i + 30).map((d) => ['others', d])])
    const res = await getJson(`${APPVIEW}/xrpc/app.bsky.graph.getRelationships?${q}`)
    for (const r of res.relationships || []) if (r && typeof r.following === 'string' && DID.test(r.did)) out.add(r.did)
  }
  return out
}

// at://did/<the statement or vouch collection>/rkey, and nothing else.
export function subjectUri(s) {
  if (typeof s !== 'string') return null
  const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(s)
  return m && DID.test(m[1]) && (m[2] === COL.statement || m[2] === COL.vouch) && RKEY.test(m[3]) ? s : null
}

export function buildTakedown(subject, now = new Date()) {
  const uri = subjectUri(subject)
  if (!uri) return { ok: false, errors: ['That is not something people have added to this map.'] }
  return { ok: true, record: { $type: COL.takedown, atlas: ATLAS_DID, subject: uri, createdAt: now.toISOString() } }
}

// A takedown record -> the record it asks to remove, or null.
export function parseTakedown(value) {
  if (!value || typeof value !== 'object' || value.$type !== COL.takedown || value.atlas !== ATLAS_DID) return null
  return subjectUri(value.subject)
}

// Run fn over items, at most `limit` at a time.
async function pool(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      try {
        out[i] = { ok: true, value: await fn(items[i]) }
      } catch (error) {
        out[i] = { ok: false, error }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

const unique = (refs) => {
  const seen = new Set()
  return refs.filter((r) => r && typeof r.did === 'string' && typeof r.rkey === 'string' && !seen.has(r.did + '/' + r.rkey) && seen.add(r.did + '/' + r.rkey))
}

// What people have added that this page will show, newest first: statements and vouches.
// io: { backlinks, resolveDid, getRecord } from ../library/lib.js (or fakes in tests).
// hidden: { dids: [], uris: [], keep: [] } from hidden.json.
//
// It fails closed. If the index can't be asked about any of the three kinds of
// record, nothing is shown, because something that someone asked to have removed
// might otherwise come back.
export async function loadCommunity(io, hidden = {}) {
  const hideDid = new Set(hidden.dids || [])
  const hideUri = new Set(hidden.uris || [])
  const keep = new Set(hidden.keep || [])
  let linkRefs, vouchRefs, downRefs
  try {
    ;[linkRefs, vouchRefs, downRefs] = await Promise.all([
      io.backlinks(ATLAS_DID, COL.statement, '.atlas', MAX_RECORDS),
      io.backlinks(ATLAS_DID, COL.vouch, '.atlas', MAX_RECORDS),
      io.backlinks(ATLAS_DID, COL.takedown, '.atlas', MAX_RECORDS),
    ])
  } catch (error) {
    return { statements: [], vouches: [], withheld: 0, unreachable: 0, error }
  }
  const read = (collection, parse) => async (r) => {
    const id = await io.resolveDid(r.did)
    const rec = await io.getRecord(id.pds, r.did, collection, r.rkey)
    return { parsed: rec ? parse(rec.value) : null, cid: rec && typeof rec.cid === 'string' ? rec.cid : null, handle: id.handle || null }
  }
  const wantLinks = unique(linkRefs).filter((r) => !hideDid.has(r.did))
  const wantVouches = unique(vouchRefs).filter((r) => !hideDid.has(r.did))
  const downs = unique(downRefs)
  const [gotLinks, gotVouches, gotDowns] = await Promise.all([
    pool(wantLinks, 8, read(COL.statement, parseStatement)),
    pool(wantVouches, 8, read(COL.vouch, parseVouch)),
    pool(downs, 8, read(COL.takedown, parseTakedown)),
  ])
  const asked = new Set()
  let unreachable = 0
  for (const g of gotDowns) {
    if (!g.ok) unreachable++
    else if (g.value.parsed) asked.add(g.value.parsed)
  }
  let withheld = 0
  const collect = (got, wanted, collection) => {
    const out = []
    got.forEach((g, i) => {
      if (!g.ok) return void unreachable++
      if (!g.value.parsed) return
      const r = wanted[i]
      const uri = `at://${r.did}/${collection}/${r.rkey}`
      if (hideUri.has(uri)) return
      if (asked.has(uri) && !keep.has(uri)) return void withheld++
      out.push({ ...g.value.parsed, uri, rkey: r.rkey, did: r.did, handle: g.value.handle, ...(collection === COL.statement ? { recordCid: g.value.cid } : {}) })
    })
    return out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  }
  const statements = collect(gotLinks, wantLinks, COL.statement)
  // Nobody shows as vouched for if they are on the hidden list.
  const vouches = collect(gotVouches, wantVouches, COL.vouch).filter((v) => !hideDid.has(v.subject.split('/')[2]))
  return { statements, vouches, withheld, unreachable, error: null }
}
