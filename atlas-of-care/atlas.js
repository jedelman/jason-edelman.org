// Atlas of Care: what people add to the map. No DOM and no SDK import, so it
// runs in the browser and in Node tests alike.
//
// The marks on the map are only what people add, and there are three kinds of record:
//
//   link      "what do you do to hold your world together": a web address and a
//             place. No text of the person's own.
//   vouch     "who holds your world together": a pointer at an organisation or a
//             person, by their atproto account or their web address, and a
//             place. No text of the voucher's own. Several people can vouch for
//             the same one in the same place; the page counts them.
//   takedown  a request that one link or vouch come off the page. It points at
//             the record and carries no text. Whoever is vouched for can use it
//             like anyone else.
//
// Nobody keeps a list of contributors and this site stores nothing. Both
// records name the atlas's DID in their `atlas` field, and Constellation, a
// network-wide index of links between records, answers "which records point at
// this DID?" The index only says where to look. Each record it reports is read
// from its author's own PDS, so a deleted one 404s and drops out.
//
// What other people add is placed in an administrative unit (a country, a
// county, a district, a region), never at an address. Its coordinates are the
// centre of that unit, rounded.
//
// A takedown request is honoured at once: the record stops being shown here.
// The site's own hidden.json can list it under `keep` to show it again after a
// request has been looked at and turned down.

export const NS = 'org.jason-edelman.atlas'
export const COL = { link: `${NS}.link`, vouch: `${NS}.vouch`, takedown: `${NS}.takedown` }
// Granular OAuth scope: this app can touch its own three collections, nothing else.
export const SCOPE = ['atproto', ...Object.values(COL).map((c) => `repo:${c}`)].join(' ')
// jason-edelman.org. Records point here so the index can find them.
export const ATLAS_DID = 'did:plc:zz4wcje4a2nbbtc7pdoth3f2'
export const MAX_RECORDS = 2000
export const MAX_URL = 400

export const SCOPES = ['world', 'us', 'in', 'eu']
const UNIT = /^[A-Za-z0-9._-]{1,64}$/
const DID = /^did:[a-z]+:[A-Za-z0-9._:%-]{1,200}$/
const RKEY = /^[A-Za-z0-9._~:-]{1,512}$/

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

// What the form collects -> a link record to write, or the reasons it can't be.
// atproto records hold no floats, so coordinates are strings.
export function buildLink(input, now = new Date()) {
  const errors = []
  const url = cleanUrl(String(input.url ?? '').trim())
  if (!url) errors.push('Enter a full web address that starts with https:// or http://.')
  const lat = coord(input.lat, 90)
  const lon = coord(input.lon, 180)
  if (!SCOPES.includes(input.scope) || !UNIT.test(String(input.unit ?? '')) || lat == null || lon == null) errors.push('Pick a place on the map first.')
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    record: { $type: COL.link, atlas: ATLAS_DID, url, scope: input.scope, unit: String(input.unit), lat: lat.toFixed(2), lon: lon.toFixed(2), createdAt: now.toISOString() },
  }
}

// A record read from someone's repo -> a checked link, or null if it isn't one.
// Anyone can write anything into their own repo, so nothing is trusted here.
export function parseLink(value) {
  if (!value || typeof value !== 'object' || value.$type !== COL.link || value.atlas !== ATLAS_DID) return null
  const url = cleanUrl(value.url)
  const lat = coord(value.lat, 90)
  const lon = coord(value.lon, 180)
  if (!url || lat == null || lon == null) return null
  if (!SCOPES.includes(value.scope) || typeof value.unit !== 'string' || !UNIT.test(value.unit)) return null
  const created = new Date(typeof value.createdAt === 'string' ? value.createdAt : NaN)
  return { url, host: hostOf(url), scope: value.scope, unit: value.unit, lat, lon, createdAt: Number.isNaN(created.getTime()) ? null : created.toISOString() }
}

// Who a vouch is for: an atproto account (a DID) or a web address. Returns the
// normalised form, or null. A handle is turned into a DID before it gets here.
export function vouchSubject(s) {
  if (typeof s !== 'string') return null
  const t = s.trim()
  return DID.test(t) ? t : cleanUrl(t)
}

// What the form collects -> a vouch record to write, or the reasons it can't be.
export function buildVouch(input, now = new Date()) {
  const errors = []
  const subject = vouchSubject(String(input.subject ?? ''))
  if (!subject) errors.push('Give their atproto handle, or a full web address that starts with https:// or http://.')
  const lat = coord(input.lat, 90)
  const lon = coord(input.lon, 180)
  if (!SCOPES.includes(input.scope) || !UNIT.test(String(input.unit ?? '')) || lat == null || lon == null) errors.push('Pick a place on the map first.')
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    record: { $type: COL.vouch, atlas: ATLAS_DID, subject, scope: input.scope, unit: String(input.unit), lat: lat.toFixed(2), lon: lon.toFixed(2), createdAt: now.toISOString() },
  }
}

// A vouch record read from someone's repo -> a checked vouch, or null.
export function parseVouch(value) {
  if (!value || typeof value !== 'object' || value.$type !== COL.vouch || value.atlas !== ATLAS_DID) return null
  const subject = vouchSubject(value.subject)
  const lat = coord(value.lat, 90)
  const lon = coord(value.lon, 180)
  if (!subject || lat == null || lon == null) return null
  if (!SCOPES.includes(value.scope) || typeof value.unit !== 'string' || !UNIT.test(value.unit)) return null
  const created = new Date(typeof value.createdAt === 'string' ? value.createdAt : NaN)
  return { subject, isAccount: subject.startsWith('did:'), scope: value.scope, unit: value.unit, lat, lon, createdAt: Number.isNaN(created.getTime()) ? null : created.toISOString() }
}

// Vouches for the same one in the same place become one entry, with everyone
// who vouched. A voucher counts once, and nobody's vouch for themselves counts.
export function groupVouches(vouches) {
  const groups = new Map()
  for (const v of vouches) {
    if (v.subject === v.did) continue
    const key = `${v.subject}|${v.scope}|${v.unit}`
    let g = groups.get(key)
    if (!g) groups.set(key, (g = { key: 'vouch:' + key, subject: v.subject, isAccount: v.isAccount, scope: v.scope, unit: v.unit, lat: v.lat, lon: v.lon, createdAt: v.createdAt, vouchers: [] }))
    if (!g.vouchers.some((x) => x.did === v.did)) g.vouchers.push({ did: v.did, handle: v.handle || null, uri: v.uri, rkey: v.rkey })
    if (v.createdAt && (!g.createdAt || v.createdAt > g.createdAt)) g.createdAt = v.createdAt
  }
  return [...groups.values()].sort((a, b) => b.vouchers.length - a.vouchers.length || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

// at://did/<a link or vouch collection>/rkey, and nothing else.
export function subjectUri(s) {
  if (typeof s !== 'string') return null
  const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(s)
  return m && DID.test(m[1]) && (m[2] === COL.link || m[2] === COL.vouch) && RKEY.test(m[3]) ? s : null
}
export const linkUri = (s) => (subjectUri(s) && s.split('/')[3] === COL.link ? s : null)

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

// What people have added that this page will show, newest first: links and vouches.
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
      io.backlinks(ATLAS_DID, COL.link, '.atlas', MAX_RECORDS),
      io.backlinks(ATLAS_DID, COL.vouch, '.atlas', MAX_RECORDS),
      io.backlinks(ATLAS_DID, COL.takedown, '.atlas', MAX_RECORDS),
    ])
  } catch (error) {
    return { links: [], vouches: [], withheld: 0, unreachable: 0, error }
  }
  const read = (collection, parse) => async (r) => {
    const id = await io.resolveDid(r.did)
    const rec = await io.getRecord(id.pds, r.did, collection, r.rkey)
    return { parsed: rec ? parse(rec.value) : null, handle: id.handle || null }
  }
  const wantLinks = unique(linkRefs).filter((r) => !hideDid.has(r.did))
  const wantVouches = unique(vouchRefs).filter((r) => !hideDid.has(r.did))
  const downs = unique(downRefs)
  const [gotLinks, gotVouches, gotDowns] = await Promise.all([
    pool(wantLinks, 8, read(COL.link, parseLink)),
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
      out.push({ ...g.value.parsed, uri, rkey: r.rkey, did: r.did, handle: g.value.handle })
    })
    return out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  }
  const links = collect(gotLinks, wantLinks, COL.link)
  // Nobody shows as vouched for if they, or their address, are on the hidden list.
  const vouches = collect(gotVouches, wantVouches, COL.vouch).filter((v) => !hideDid.has(v.subject) && !hideUri.has(v.subject))
  return { links, vouches, withheld, unreachable, error: null }
}
