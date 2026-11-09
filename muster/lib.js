// Muster protocol logic. No DOM and no SDK import, so it runs in the browser
// and in Node tests alike. Public reads are plain XRPC GETs; every write goes
// through an authenticated @atproto/api Agent passed in by the caller.
//
// Where records live:
//   poster's repo  action  one public action: what, where (an area), when, how many
//   desk's repo    desk    a collective's list: who it vouches for, which desks it trusts
//
// Nothing here is private, and nothing here is a membership list. There is no
// server: the open wire finds posters through the relay's collection index
// (com.atproto.sync.listReposByCollection), a desk names its posters itself,
// and every action is read from its poster's own PDS.

export const NS = 'org.jason-edelman.muster'
export const COL = { action: `${NS}.action`, desk: `${NS}.desk` }
// Granular OAuth scope: this app can touch its own two collections, nothing else.
export const SCOPE = ['atproto', ...Object.values(COL).map((c) => `repo:${c}`)].join(' ')
export const HANDLE_RESOLVER = 'https://bsky.social'
export const RELAY = 'https://relay1.us-east.bsky.network'
const APPVIEW = 'https://public.api.bsky.app'
const PLC = 'https://plc.directory'
export const MAX_AUTHORS = 1000 // the open wire reads at most this many posters
export const DESK_DEPTH = 3 // a desk's included desks, and theirs, and theirs

// Rough crowd sizes. A report says "hundreds", never a count, and the pulse
// adds up only the bottom of each range, so its total is a floor.
export const CROWD = [
  { value: '10+', min: 10, label: 'dozens' },
  { value: '100+', min: 100, label: 'hundreds' },
  { value: '1000+', min: 1000, label: 'thousands' },
  { value: '10000+', min: 10000, label: 'tens of thousands' },
]
const CROWD_MIN = new Map(CROWD.map((c) => [c.value, c.min]))

const LIMITS = { title: 140, place: 80, note: 300, issue: 32, issues: 4, deskName: 64, deskAbout: 300, vouches: 1000, includes: 50 }

async function getJson(url, init) {
  const res = await fetch(url, init)
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    let error
    try {
      const j = await res.json()
      msg = j.message || j.error || msg
      error = j.error
    } catch {}
    throw Object.assign(new Error(msg), { status: res.status, error })
  }
  return res.json()
}

// Run fn over items, at most `limit` at a time.
export async function pool(items, limit, fn) {
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

// ── Areas ────────────────────────────────────────────────────────────────
// An action is placed by geohash, never by coordinates. Five characters is a
// cell about 5 km across: a neighbourhood or a small town, not an address.
// Dropping characters zooms out (four is about 20 by 30 km at mid-latitudes),
// which is how the pulse counts areas.

export const AREA_PRECISION = 5
const B32 = '0123456789bcdefghjkmnpqrstuvwxyz'
const GEOHASH = /^[0-9b-hjkmnp-z]{1,12}$/

export function geohashEncode(lat, lon, precision = AREA_PRECISION) {
  let latLo = -90, latHi = 90, lonLo = -180, lonHi = 180
  let hash = '', bit = 0, ch = 0, even = true
  while (hash.length < precision) {
    if (even) {
      const mid = (lonLo + lonHi) / 2
      if (lon >= mid) { ch = (ch << 1) | 1; lonLo = mid } else { ch <<= 1; lonHi = mid }
    } else {
      const mid = (latLo + latHi) / 2
      if (lat >= mid) { ch = (ch << 1) | 1; latLo = mid } else { ch <<= 1; latHi = mid }
    }
    even = !even
    if (++bit === 5) { hash += B32[ch]; bit = 0; ch = 0 }
  }
  return hash
}

// -> { south, west, north, east }
export function geohashBounds(hash) {
  let latLo = -90, latHi = 90, lonLo = -180, lonHi = 180, even = true
  for (const c of hash) {
    const n = B32.indexOf(c)
    if (n < 0) throw new Error(`Not a geohash: ${hash}`)
    for (let b = 4; b >= 0; b--) {
      const bit = (n >> b) & 1
      if (even) { const mid = (lonLo + lonHi) / 2; bit ? (lonLo = mid) : (lonHi = mid) }
      else { const mid = (latLo + latHi) / 2; bit ? (latLo = mid) : (latHi = mid) }
      even = !even
    }
  }
  return { south: latLo, west: lonLo, north: latHi, east: lonHi }
}

// -> [lon, lat], the cell's centre (GeoJSON order).
export function geohashCenter(hash) {
  const b = geohashBounds(hash)
  return [(b.west + b.east) / 2, (b.south + b.north) / 2]
}

// ── Dates ────────────────────────────────────────────────────────────────
// An action happens on a calendar day where it happens: "2026-11-09", with no
// time and no zone. The organizers' own link carries the details.

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
export function isDate(s) {
  const m = DATE.exec(String(s ?? ''))
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

// ── Issues ───────────────────────────────────────────────────────────────

export const normalizeIssue = (s) =>
  String(s ?? '').toLowerCase().normalize('NFKC').replace(/[\s_]+/g, ' ').trim().replace(/^#+\s*/, '').slice(0, LIMITS.issue)

// Offered before anyone has posted: the struggles named in the thread this
// started from. After that, the tags people actually use come first.
export const SEED_ISSUES = ['ice', 'flock', 'data centers', 'tesla takedown', 'labor', 'border']

export function topIssues(actions, n = 10) {
  const counts = new Map()
  for (const a of actions) for (const i of a.value.issues) counts.set(i, (counts.get(i) ?? 0) + 1)
  const used = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([i]) => i)
  return [...new Set([...used, ...SEED_ISSUES])].slice(0, Math.max(n, used.length))
}

// ── Validation ───────────────────────────────────────────────────────────
// Records come from anyone. Read defensively: anything malformed is dropped,
// anything over length is cut, and a link must be http(s).

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
function httpUrl(v) {
  if (typeof v !== 'string') return null
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

// A stored action, cleaned, or null if it can't be shown.
export function readAction(value) {
  if (!value || typeof value !== 'object') return null
  const title = str(value.title, LIMITS.title)
  const place = str(value.area?.name, LIMITS.place)
  const geohash = typeof value.area?.geohash === 'string' ? value.area.geohash.toLowerCase().slice(0, AREA_PRECISION) : ''
  if (!title || !place || geohash.length < 3 || !GEOHASH.test(geohash) || !isDate(value.date)) return null
  const issues = Array.isArray(value.issues) ? [...new Set(value.issues.map(normalizeIssue).filter(Boolean))].slice(0, LIMITS.issues) : []
  const out = { title, date: value.date, area: { geohash, name: place }, issues }
  if (CROWD_MIN.has(value.crowd)) out.crowd = value.crowd
  const link = httpUrl(value.link)
  if (link) out.link = link
  const note = str(value.note, LIMITS.note)
  if (note) out.note = note
  if (typeof value.createdAt === 'string') out.createdAt = value.createdAt
  return out
}

// What the post form sends, checked and shaped into a record. Throws with a
// message meant for the person filling it in.
export function makeAction({ title, date, geohash, place, issues = [], crowd = '', link = '', note = '' }) {
  const record = { $type: COL.action, title: str(title, LIMITS.title), date, area: { geohash: String(geohash ?? '').slice(0, AREA_PRECISION), name: str(place, LIMITS.place) } }
  if (!record.title) throw new Error('Say what the action is.')
  if (!isDate(date)) throw new Error('Pick the day it happens or happened.')
  if (record.area.geohash.length !== AREA_PRECISION || !GEOHASH.test(record.area.geohash)) throw new Error('Tap the map where it is.')
  if (!record.area.name) throw new Error('Name the place: a town or a neighbourhood.')
  record.issues = [...new Set(issues.map(normalizeIssue).filter(Boolean))].slice(0, LIMITS.issues)
  if (crowd) {
    if (!CROWD_MIN.has(crowd)) throw new Error('Unknown crowd size.')
    record.crowd = crowd
  }
  if (String(link).trim()) {
    const u = httpUrl(String(link).trim())
    if (!u) throw new Error('The link has to start with https://')
    record.link = u
  }
  if (str(note, LIMITS.note)) record.note = str(note, LIMITS.note)
  record.createdAt = new Date().toISOString()
  return record
}

const DID = /^did:(plc:[a-z2-7]{24}|web:[a-zA-Z0-9.%-]+)$/
const AT_URI = /^at:\/\/(did:[a-z]+:[a-zA-Z0-9.%:-]+)\/([a-zA-Z0-9.-]+)\/([a-zA-Z0-9._~:-]{1,512})$/

export function readDesk(value) {
  if (!value || typeof value !== 'object') return null
  const name = str(value.name, LIMITS.deskName)
  if (!name) return null
  const vouches = Array.isArray(value.vouches) ? [...new Set(value.vouches.filter((d) => typeof d === 'string' && DID.test(d)))].slice(0, LIMITS.vouches) : []
  const includes = Array.isArray(value.includes)
    ? [...new Set(value.includes.filter((u) => typeof u === 'string' && AT_URI.test(u) && AT_URI.exec(u)[2] === COL.desk))].slice(0, LIMITS.includes)
    : []
  const out = { name, vouches, includes }
  const about = str(value.about, LIMITS.deskAbout)
  if (about) out.about = about
  if (typeof value.createdAt === 'string') out.createdAt = value.createdAt
  return out
}

export function makeDesk({ name, about = '', vouches = [], includes = [], createdAt }) {
  const record = { $type: COL.desk, name: str(name, LIMITS.deskName), vouches: [...new Set(vouches)], includes: [...new Set(includes)] }
  if (!record.name) throw new Error('Name the desk.')
  if (record.vouches.some((d) => !DID.test(d))) throw new Error('Something in the vouch list is not an account.')
  if (record.includes.some((u) => !AT_URI.test(u) || AT_URI.exec(u)[2] !== COL.desk)) throw new Error('Something in the desk list is not a desk link.')
  if (record.vouches.length > LIMITS.vouches) throw new Error(`A desk can vouch for at most ${LIMITS.vouches} people.`)
  if (record.includes.length > LIMITS.includes) throw new Error(`A desk can include at most ${LIMITS.includes} desks.`)
  if (str(about, LIMITS.deskAbout)) record.about = str(about, LIMITS.deskAbout)
  record.createdAt = createdAt || new Date().toISOString()
  return record
}

export function parseAtUri(uri) {
  const m = AT_URI.exec(String(uri ?? ''))
  return m ? { did: m[1], collection: m[2], rkey: m[3] } : null
}

// ── Identity ─────────────────────────────────────────────────────────────

export async function resolveHandle(handle) {
  const q = encodeURIComponent(handle.toLowerCase())
  const { did } = await getJson(`${HANDLE_RESOLVER}/xrpc/com.atproto.identity.resolveHandle?handle=${q}`)
  return did
}

const didCache = new Map()

// -> { did, pds, handle }. handle is the one the DID document claims.
export function resolveDid(did) {
  if (!didCache.has(did)) {
    const p = (async () => {
      let url
      if (did.startsWith('did:plc:')) url = `${PLC}/${did}`
      else if (did.startsWith('did:web:')) url = `https://${decodeURIComponent(did.slice(8))}/.well-known/did.json`
      else throw new Error(`Unsupported DID method: ${did}`)
      const doc = await getJson(url)
      const svc = (doc.service || []).find((s) => s.id === '#atproto_pds' || s.id === `${did}#atproto_pds`)
      if (!svc) throw new Error(`No PDS listed for ${did}`)
      const aka = (doc.alsoKnownAs || []).find((a) => a.startsWith('at://'))
      return { did, pds: String(svc.serviceEndpoint).replace(/\/+$/, ''), handle: aka ? aka.slice(5) : null }
    })()
    didCache.set(did, p)
    p.catch(() => didCache.delete(did))
  }
  return didCache.get(did)
}

export async function resolveIdentity(input) {
  const s = String(input || '').trim().replace(/^@/, '').replace(/^at:\/\//, '').replace(/\/.*$/, '')
  if (!s) throw new Error('Enter a handle')
  const did = s.startsWith('did:') ? s : await resolveHandle(s)
  return resolveDid(did)
}

// Handle suggestions for a partial input, from Bluesky's public AppView.
export async function searchActors(q, signal) {
  const params = new URLSearchParams({ q, limit: '6' })
  const { actors } = await getJson(`${APPVIEW}/xrpc/app.bsky.actor.searchActorsTypeahead?${params}`, { signal })
  return actors.map((a) => ({
    did: a.did,
    handle: a.handle,
    displayName: a.displayName || '',
    avatar: a.avatar ? a.avatar.replace('/img/avatar/', '/img/avatar_thumbnail/') : null,
  }))
}

// Handles as Bluesky's AppView has verified them (a DID document alone can
// claim any handle), 25 accounts per request. -> Map did -> handle
// Accounts the AppView doesn't know, or whose handle fails, are left out.
export async function verifiedHandles(dids) {
  const out = new Map()
  const batches = []
  for (let i = 0; i < dids.length; i += 25) batches.push(dids.slice(i, i + 25))
  await pool(batches, 4, async (batch) => {
    const q = new URLSearchParams()
    for (const d of batch) q.append('actors', d)
    const { profiles } = await getJson(`${APPVIEW}/xrpc/app.bsky.actor.getProfiles?${q}`)
    for (const p of profiles) if (p.handle && p.handle !== 'handle.invalid') out.set(p.did, p.handle)
  })
  return out
}

// ── Records ──────────────────────────────────────────────────────────────

const shape = (r) => ({ uri: r.uri, cid: r.cid, rkey: r.uri.split('/').pop(), value: r.value })

export async function listRecords(pds, repo, collection, maxPages = 20) {
  const out = []
  let cursor
  for (let page = 0; page < maxPages; page++) {
    const q = new URLSearchParams({ repo, collection, limit: '100' })
    if (cursor) q.set('cursor', cursor)
    const data = await getJson(`${pds}/xrpc/com.atproto.repo.listRecords?${q}`)
    out.push(...data.records)
    cursor = data.cursor
    if (!cursor || data.records.length === 0) break
  }
  return out.map(shape)
}

export async function getRecord(pds, repo, collection, rkey) {
  const q = new URLSearchParams({ repo, collection, rkey })
  try {
    return shape(await getJson(`${pds}/xrpc/com.atproto.repo.getRecord?${q}`))
  } catch (e) {
    if (e.error === 'RecordNotFound' || e.status === 404) return null
    throw e
  }
}

// Every repo the relay has seen write to `collection`. -> [did]
export async function reposWithCollection(collection, max = MAX_AUTHORS) {
  const out = []
  let cursor
  while (out.length < max) {
    const q = new URLSearchParams({ collection, limit: '500' })
    if (cursor) q.set('cursor', cursor)
    const data = await getJson(`${RELAY}/xrpc/com.atproto.sync.listReposByCollection?${q}`)
    out.push(...data.repos.map((r) => r.did))
    cursor = data.cursor
    if (!cursor || !data.repos.length) break
  }
  return [...new Set(out)].slice(0, max)
}

// ── Loading ──────────────────────────────────────────────────────────────

// Every action in these repos. -> { actions, handles, unreachable }
// Each action: { uri, cid, rkey, did, value } with value cleaned by readAction.
export async function loadActions(dids) {
  const unreachable = []
  const [results, handles] = await Promise.all([
    pool(dids, 8, async (did) => {
      const id = await resolveDid(did)
      return (await listRecords(id.pds, did, COL.action)).map((r) => ({ ...r, did }))
    }),
    verifiedHandles(dids).catch(() => new Map()),
  ])
  const actions = []
  results.forEach((r, i) => {
    if (!r.ok) return unreachable.push(dids[i])
    for (const a of r.value) {
      const value = readAction(a.value)
      if (value) actions.push({ ...a, value })
    }
  })
  return { actions, handles, unreachable }
}

// A desk and everything it trusts, followed DESK_DEPTH levels down.
// -> { desk, desks, dids, missing }
//   desk     the root: { uri, did, value }
//   desks    every desk reached, the root first
//   dids     whose actions the desk shows: each desk's owner and the people it vouches for
//   missing  included desks that couldn't be read
export async function loadDesk(uri) {
  const desks = []
  const missing = []
  const seen = new Set()
  let level = [uri]
  for (let depth = 0; depth <= DESK_DEPTH && level.length; depth++) {
    const fresh = level.filter((u) => !seen.has(u) && seen.add(u))
    const got = await pool(fresh, 6, async (u) => {
      const p = parseAtUri(u)
      if (!p || p.collection !== COL.desk) throw new Error(`Not a desk: ${u}`)
      const id = await resolveDid(p.did)
      const rec = await getRecord(id.pds, p.did, COL.desk, p.rkey)
      const value = rec && readDesk(rec.value)
      if (!value) throw new Error(`No desk at ${u}`)
      return { uri: rec.uri, cid: rec.cid, rkey: rec.rkey, did: p.did, handle: null, value }
    })
    level = []
    got.forEach((g, i) => {
      if (!g.ok) {
        if (depth === 0) throw g.error
        return missing.push(fresh[i])
      }
      desks.push(g.value)
      level.push(...g.value.value.includes)
    })
  }
  // Show and link desks by handle only where the AppView has verified it.
  const vh = await verifiedHandles([...new Set(desks.map((d) => d.did))]).catch(() => new Map())
  for (const d of desks) d.handle = vh.get(d.did) ?? null
  const dids = new Set()
  for (const d of desks) {
    dids.add(d.did)
    for (const v of d.value.vouches) dids.add(v)
  }
  return { desk: desks[0], desks, dids: [...dids], missing }
}

// "at://did/col/rkey", "handle/rkey", or a Muster page link with ?desk=. -> at-uri
export async function resolveDeskRef(ref) {
  let s = String(ref ?? '').trim()
  try {
    const u = new URL(s)
    if (u.searchParams.get('desk')) s = u.searchParams.get('desk')
  } catch {}
  if (parseAtUri(s)) return s
  const m = /^@?([^/\s]+)\/([a-zA-Z0-9._~:-]+)$/.exec(s)
  if (!m) throw new Error('Paste a desk link.')
  const id = await resolveIdentity(m[1])
  return `at://${id.did}/${COL.desk}/${m[2]}`
}

// The short form for links: handle/rkey when the handle is known.
export const deskRef = (desk) => (desk.handle ? `${desk.handle}/${desk.rkey}` : desk.uri)

// ── The pulse ────────────────────────────────────────────────────────────
// What a set of actions adds up to. Areas are four-character geohash cells
// (about 20 by 30 km at mid-latitudes); the crowd is a floor, the bottom of each reported range.

export function pulse(actions, { today = localDate(), days = 30 } = {}) {
  const from = addDays(today, -(days - 1))
  const past = actions.filter((a) => a.value.date >= from && a.value.date <= today)
  const upcoming = actions.filter((a) => a.value.date > today)
  const areas = new Set(past.map((a) => a.value.area.geohash.slice(0, 4)))
  const floor = past.reduce((n, a) => n + (CROWD_MIN.get(a.value.crowd) ?? 0), 0)
  const reported = past.filter((a) => a.value.crowd).length
  return { days, actions: past.length, areas: areas.size, floor, reported, upcoming: upcoming.length }
}

// Upcoming soonest first, then the rest newest first.
export function sortActions(actions, today = localDate()) {
  const up = actions.filter((a) => a.value.date > today).sort((a, b) => a.value.date.localeCompare(b.value.date))
  const past = actions.filter((a) => a.value.date <= today).sort((a, b) => b.value.date.localeCompare(a.value.date) || String(b.value.createdAt).localeCompare(String(a.value.createdAt)))
  return [...up, ...past]
}

// ── Writes (agent: an authenticated @atproto/api Agent; me: its DID) ─────

const repo = (agent) => agent.com.atproto.repo

export function postAction(agent, me, fields) {
  return repo(agent).createRecord({ repo: me, collection: COL.action, record: makeAction(fields) })
}

export function deleteAction(agent, me, action) {
  return repo(agent).deleteRecord({ repo: me, collection: COL.action, rkey: action.rkey, swapRecord: action.cid })
}

// Create a desk, or replace one of mine (pass the desk being edited).
export function saveDesk(agent, me, fields, existing = null) {
  const record = makeDesk({ ...fields, createdAt: existing?.value?.createdAt })
  if (!existing) return repo(agent).createRecord({ repo: me, collection: COL.desk, record })
  return repo(agent).putRecord({ repo: me, collection: COL.desk, rkey: existing.rkey, record, swapRecord: existing.cid })
}

export function deleteDesk(agent, me, desk) {
  return repo(agent).deleteRecord({ repo: me, collection: COL.desk, rkey: desk.rkey, swapRecord: desk.cid })
}
