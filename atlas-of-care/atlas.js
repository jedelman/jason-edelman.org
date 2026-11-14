// Atlas of Care: what people add to the map. No DOM and no SDK import, so it
// runs in the browser and in Node tests alike.
//
// People can add three things:
//
//   link      a web address and a place, with no text of their own.
//   case      a case study: who does what to keep a place going, who pays, what
//             came of it, and the source it rests on. The atlas's own case
//             studies are records of this kind in the atlas owner's repo; anyone
//             else's sit in their own repo and show beside them, marked as theirs.
//   takedown  a request that one link or one contributed case study come off the
//             page. It points at the record and carries no text.
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
// request has been looked at and turned down. The owner's own case studies are
// read straight from the owner's repo and are not subject to takedown requests.

export const NS = 'org.jason-edelman.atlas'
export const COL = { link: `${NS}.link`, case: `${NS}.case`, takedown: `${NS}.takedown` }
// Granular OAuth scope: this app can touch its own three collections, nothing else.
export const SCOPE = ['atproto', ...Object.values(COL).map((c) => `repo:${c}`)].join(' ')
// jason-edelman.org. Records point here so the index can find them.
export const ATLAS_DID = 'did:plc:zz4wcje4a2nbbtc7pdoth3f2'
export const MAX_RECORDS = 2000
export const MAX_URL = 400

export const SCOPES = ['world', 'us', 'in', 'eu']
export const MODES = ['repeats', 'turns']
export const DOMAINS = ['farming', 'care', 'commons', 'kitchen', 'wetland', 'trees', 'land', 'species', 'vector', 'vaccine', 'eradication', 'abortion', 'contraception', 'birth', 'repair']
// A case study's text fields: [record key, page key, most characters]. The page
// keeps the snake_case names its data file always used.
export const CASE_TEXT = [
  ['title', 'title', 100], ['place', 'place', 160], ['country', 'country', 80], ['who', 'who', 400], ['does', 'does', 400],
  ['pays', 'pays', 400], ['cost', 'cost', 300], ['result', 'result', 900], ['contested', 'contested', 900],
  ['whenItStops', 'when_it_stops', 600], ['modeReason', 'mode_reason', 500], ['quote', 'quote', 300],
  ['quoteSpeaker', 'quote_speaker', 200], ['sourceTitle', 'source_title', 300], ['sourcePublisher', 'source_publisher', 200],
  ['sourceDate', 'source_date', 80], ['notes', 'notes', 900],
]
const CASE_REQUIRED = ['title', 'place', 'does', 'sourceTitle']

// Plain text only: control and direction-changing characters out, whitespace
// collapsed, length capped by code point.
export function clean(s, max) {
  const t = String(s ?? '')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return [...t].slice(0, max).join('')
}
// The data file writes "not stated" and "none found" where a source is silent.
const stated = (t) => (/^(not stated|none found|not shown|not verified)\.?$/i.test(t) ? '' : t)
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

// What a case study needs before it is one: a name, a place, what is done, a
// kind, whether it repeats, and a source with a working address.
function caseFields(get, errors) {
  const out = {}
  for (const [rk, pk, max] of CASE_TEXT) {
    const v = stated(clean(get(rk, pk), max))
    if (v) out[rk] = v
  }
  for (const rk of CASE_REQUIRED) if (!out[rk]) errors.push(rk)
  return out
}

// A page-shaped case study (the keys of data/entries.json) -> a record to write.
// Coordinates are strings with three places at most; the page passes a unit's
// centre for anything a visitor contributes.
export function buildCase(input, now = new Date()) {
  const missing = []
  const text = caseFields((rk, pk) => input[pk], missing)
  const errors = []
  const label = { title: 'Give it a short name.', place: 'Pick a place on the map first.', does: 'Say what is done.', sourceTitle: 'Name the source it rests on.' }
  for (const k of missing) errors.push(label[k])
  const sourceUrl = cleanUrl(String(input.source_url ?? '').trim())
  if (!sourceUrl) errors.push('Give the source a full web address that starts with https:// or http://.')
  if (!MODES.includes(input.mode)) errors.push('Say whether it has to be done again or was done once.')
  if (!DOMAINS.includes(input.domain)) errors.push('Pick the kind of work.')
  const lat = coord(input.lat, 90)
  const lon = coord(input.lon, 180)
  if (lat == null || lon == null) errors.push('Pick a place on the map first.')
  const placed = input.scope != null || input.unit != null
  if (placed && (!SCOPES.includes(input.scope) || !UNIT.test(String(input.unit ?? '')))) errors.push('Pick a place on the map first.')
  if (errors.length) return { ok: false, errors: [...new Set(errors)] }
  const record = { $type: COL.case, atlas: ATLAS_DID, ...text, mode: input.mode, domain: input.domain, lat: String(+lat.toFixed(3)), lon: String(+lon.toFixed(3)), sourceUrl, createdAt: now.toISOString() }
  if (placed) Object.assign(record, { scope: input.scope, unit: String(input.unit) })
  return { ok: true, record }
}

// A case record read from someone's repo -> a page-shaped case study, or null.
export function parseCase(value) {
  if (!value || typeof value !== 'object' || value.$type !== COL.case || value.atlas !== ATLAS_DID) return null
  const missing = []
  const text = caseFields((rk) => (typeof value[rk] === 'string' ? value[rk] : ''), missing)
  const sourceUrl = cleanUrl(value.sourceUrl)
  const lat = coord(value.lat, 90)
  const lon = coord(value.lon, 180)
  if (missing.length || !sourceUrl || lat == null || lon == null || !MODES.includes(value.mode) || !DOMAINS.includes(value.domain)) return null
  const out = { mode: value.mode, domain: value.domain, lat, lon, source_url: sourceUrl, country: '' }
  for (const [rk, pk] of CASE_TEXT) if (text[rk]) out[pk] = text[rk]
  if (SCOPES.includes(value.scope) && typeof value.unit === 'string' && UNIT.test(value.unit)) Object.assign(out, { scope: value.scope, unit: value.unit })
  const created = new Date(typeof value.createdAt === 'string' ? value.createdAt : NaN)
  out.createdAt = Number.isNaN(created.getTime()) ? null : created.toISOString()
  return out
}

// A stable record key for one of the owner's case studies, so publishing twice
// updates a record and does not make a second one.
export function caseRkey(title) {
  const slug = clean(title, 200).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug.slice(0, 80) || 'case'
}

// at://did/<a link or case collection>/rkey, and nothing else.
export function subjectUri(s) {
  if (typeof s !== 'string') return null
  const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(s)
  return m && DID.test(m[1]) && (m[2] === COL.link || m[2] === COL.case) && RKEY.test(m[3]) ? s : null
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

// The atlas's own case studies, read straight from the owner's repo (no index).
// io: { resolveDid, listRecords } from ../library/lib.js.
export async function loadOwnCases(io) {
  const id = await io.resolveDid(ATLAS_DID)
  const recs = await io.listRecords(id.pds, ATLAS_DID, COL.case)
  return recs.map((r) => ({ parsed: parseCase(r.value), r })).filter((x) => x.parsed).map(({ parsed, r }) => ({ ...parsed, uri: r.uri, rkey: r.rkey, did: ATLAS_DID }))
}

// What other people have added that this page will show, newest first: links
// and case studies. The owner's own case studies are not in here.
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
  let linkRefs, caseRefs, downRefs
  try {
    ;[linkRefs, caseRefs, downRefs] = await Promise.all([
      io.backlinks(ATLAS_DID, COL.link, '.atlas', MAX_RECORDS),
      io.backlinks(ATLAS_DID, COL.case, '.atlas', MAX_RECORDS),
      io.backlinks(ATLAS_DID, COL.takedown, '.atlas', MAX_RECORDS),
    ])
  } catch (error) {
    return { links: [], cases: [], withheld: 0, unreachable: 0, error }
  }
  const read = (collection, parse) => async (r) => {
    const id = await io.resolveDid(r.did)
    const rec = await io.getRecord(id.pds, r.did, collection, r.rkey)
    return { parsed: rec ? parse(rec.value) : null, handle: id.handle || null }
  }
  const wantLinks = unique(linkRefs).filter((r) => !hideDid.has(r.did))
  const wantCases = unique(caseRefs).filter((r) => !hideDid.has(r.did) && r.did !== ATLAS_DID)
  const downs = unique(downRefs)
  const [gotLinks, gotCases, gotDowns] = await Promise.all([
    pool(wantLinks, 8, read(COL.link, parseLink)),
    pool(wantCases, 8, read(COL.case, parseCase)),
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
  // A contributed case study must sit in a unit of the map, as a link does.
  const cases = collect(gotCases, wantCases, COL.case).filter((c) => c.scope && c.unit)
  return { links, cases, withheld, unreachable, error: null }
}
