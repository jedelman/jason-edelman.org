// Atlas of Care: what people add to the map. No DOM and no SDK import, so it
// runs in the browser and in Node tests alike.
//
// People can add exactly two things, and neither carries any text of their own:
//
//   link      a web address and a place. A record in the adder's own repo.
//   takedown  a request that one link come off the page. A record in the
//             requester's own repo that points at the link.
//
// Nobody keeps a list of contributors and this site stores nothing. Both
// records name the atlas's DID in their `atlas` field, and Constellation, a
// network-wide index of links between records, answers "which records point at
// this DID?" The index only says where to look. Each record it reports is read
// from its author's own PDS, so a deleted one 404s and drops out.
//
// A link is placed in an administrative unit (a country, a county, a district,
// a region), never at an address. Its coordinates are the centre of that unit,
// rounded.
//
// A takedown request is honoured at once: the link stops being shown here. The
// site's own hidden.json can list a link under `keep` to show it again after a
// request has been looked at and turned down.

export const NS = 'org.jason-edelman.atlas'
export const COL = { link: `${NS}.link`, takedown: `${NS}.takedown` }
// Granular OAuth scope: this app can touch its own two collections, nothing else.
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

// at://did/org.jason-edelman.atlas.link/rkey, and nothing else.
export function linkUri(s) {
  if (typeof s !== 'string') return null
  const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(s)
  return m && DID.test(m[1]) && m[2] === COL.link && RKEY.test(m[3]) ? s : null
}

export function buildTakedown(subject, now = new Date()) {
  const uri = linkUri(subject)
  if (!uri) return { ok: false, errors: ['That is not a link on this map.'] }
  return { ok: true, record: { $type: COL.takedown, atlas: ATLAS_DID, subject: uri, createdAt: now.toISOString() } }
}

// A takedown record -> the link it asks to remove, or null.
export function parseTakedown(value) {
  if (!value || typeof value !== 'object' || value.$type !== COL.takedown || value.atlas !== ATLAS_DID) return null
  return linkUri(value.subject)
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

// The links people have added that this page will show, newest first.
// io: { backlinks, resolveDid, getRecord } from ../library/lib.js (or fakes in tests).
// hidden: { dids: [], uris: [], keep: [] } from hidden.json.
//
// It fails closed. If the index can't be asked about links or about takedown
// requests, nothing is shown, because a link that someone asked to have removed
// might otherwise come back.
export async function loadCommunity(io, hidden = {}) {
  const hideDid = new Set(hidden.dids || [])
  const hideUri = new Set(hidden.uris || [])
  const keep = new Set(hidden.keep || [])
  let linkRefs, downRefs
  try {
    ;[linkRefs, downRefs] = await Promise.all([
      io.backlinks(ATLAS_DID, COL.link, '.atlas', MAX_RECORDS),
      io.backlinks(ATLAS_DID, COL.takedown, '.atlas', MAX_RECORDS),
    ])
  } catch (error) {
    return { links: [], withheld: 0, unreachable: 0, error }
  }
  const read = (collection, parse) => async (r) => {
    const id = await io.resolveDid(r.did)
    const rec = await io.getRecord(id.pds, r.did, collection, r.rkey)
    return { parsed: rec ? parse(rec.value) : null, handle: id.handle || null }
  }
  const wanted = unique(linkRefs).filter((r) => !hideDid.has(r.did))
  const downs = unique(downRefs)
  const [gotLinks, gotDowns] = await Promise.all([pool(wanted, 8, read(COL.link, parseLink)), pool(downs, 8, read(COL.takedown, parseTakedown))])

  const asked = new Set()
  let unreachable = 0
  for (const g of gotDowns) {
    if (!g.ok) unreachable++
    else if (g.value.parsed) asked.add(g.value.parsed)
  }
  const links = []
  let withheld = 0
  gotLinks.forEach((g, i) => {
    if (!g.ok) return void unreachable++
    if (!g.value.parsed) return
    const r = wanted[i]
    const uri = `at://${r.did}/${COL.link}/${r.rkey}`
    if (hideUri.has(uri)) return
    if (asked.has(uri) && !keep.has(uri)) return void withheld++
    links.push({ ...g.value.parsed, uri, rkey: r.rkey, did: r.did, handle: g.value.handle })
  })
  links.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  return { links, withheld, unreachable, error: null }
}
