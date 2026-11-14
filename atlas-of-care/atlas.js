// Atlas of Care: what people add to the map. No DOM and no SDK import, so it
// runs in the browser and in Node tests alike.
//
// An entry someone adds is a record in THEIR OWN atproto repo
// (org.jason-edelman.atlas.entry). Nobody keeps a list of contributors: every
// entry names the atlas's DID in its `atlas` field, and Constellation, a
// network-wide index of links between records, answers "which entry records
// point at this DID?" The index only says where to look. Each entry it reports
// is read from its author's own PDS, so a deleted entry 404s and drops out.
//
// An entry is placed in an administrative unit (a country, a county, a
// district, a region), never at an address. Its coordinates are the centre of
// that unit, rounded.

export const NS = 'org.jason-edelman.atlas'
export const COL = `${NS}.entry`
// Granular OAuth scope: this app can touch its own one collection, nothing else.
export const SCOPE = `atproto repo:${COL}`
// jason-edelman.org. Entries point here so the index can find them.
export const ATLAS_DID = 'did:plc:zz4wcje4a2nbbtc7pdoth3f2'
export const MAX_ENTRIES = 2000

export const SCOPES = ['world', 'us', 'in', 'eu']
export const MODES = ['repeats', 'turns']
export const DOMAINS = ['farming', 'care', 'commons', 'kitchen', 'wetland', 'trees', 'land', 'species', 'vector', 'vaccine', 'eradication', 'abortion', 'contraception', 'birth', 'repair']
export const LIMITS = { title: 100, does: 600, who: 300, pays: 300, needs: 300, unit: 64, unitName: 120, link: 400 }

// Plain text only: control characters out, whitespace collapsed, length capped.
export function clean(s, max) {
  const t = String(s ?? '')
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return [...t].slice(0, max).join('')
}

const httpUrl = (s) => {
  try {
    const u = new URL(String(s))
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

const coord = (s, lim) => {
  const n = Number(s)
  return typeof s !== 'boolean' && s !== '' && s != null && Number.isFinite(n) && Math.abs(n) <= lim ? n : null
}

// What the form collects -> a record to write, or the reasons it can't be written.
// atproto records hold no floats, so coordinates are strings.
export function buildRecord(input, now = new Date()) {
  const errors = []
  const title = clean(input.title, LIMITS.title)
  const does = clean(input.does, LIMITS.does)
  if (!title) errors.push('Give it a short name.')
  if (!does) errors.push('Say what is done.')
  if (!SCOPES.includes(input.scope) || !clean(input.unit, LIMITS.unit)) errors.push('Pick a place on the map first.')
  if (!MODES.includes(input.mode)) errors.push('Say whether it has to be done again or was done once.')
  if (!DOMAINS.includes(input.domain)) errors.push('Pick the kind of work.')
  const lat = coord(input.lat, 90)
  const lon = coord(input.lon, 180)
  if (lat == null || lon == null) errors.push('Pick a place on the map first.')
  const linkRaw = clean(input.link, LIMITS.link)
  const link = linkRaw ? httpUrl(linkRaw) : null
  if (linkRaw && !link) errors.push('The link has to start with https:// or http://.')
  if (errors.length) return { ok: false, errors: [...new Set(errors)] }
  const record = {
    $type: COL,
    atlas: ATLAS_DID,
    title,
    does,
    mode: input.mode,
    domain: input.domain,
    scope: input.scope,
    unit: clean(input.unit, LIMITS.unit),
    unitName: clean(input.unitName, LIMITS.unitName),
    lat: lat.toFixed(2),
    lon: lon.toFixed(2),
    createdAt: now.toISOString(),
  }
  for (const k of ['who', 'pays', 'needs']) {
    const v = clean(input[k], LIMITS[k])
    if (v) record[k] = v
  }
  if (link) record.link = link
  return { ok: true, record }
}

// A record read from someone's repo -> a checked entry, or null if it isn't one.
// Anyone can write anything into their own repo, so nothing is trusted here.
export function parseEntry(value) {
  if (!value || typeof value !== 'object' || value.$type !== COL || value.atlas !== ATLAS_DID) return null
  const title = clean(value.title, LIMITS.title)
  const does = clean(value.does, LIMITS.does)
  const lat = coord(value.lat, 90)
  const lon = coord(value.lon, 180)
  if (!title || !does || lat == null || lon == null) return null
  if (!SCOPES.includes(value.scope) || !MODES.includes(value.mode) || !DOMAINS.includes(value.domain)) return null
  const unit = clean(value.unit, LIMITS.unit)
  if (!unit) return null
  const created = new Date(value.createdAt)
  return {
    title,
    does,
    mode: value.mode,
    domain: value.domain,
    scope: value.scope,
    unit,
    unitName: clean(value.unitName, LIMITS.unitName),
    lat,
    lon,
    who: clean(value.who, LIMITS.who),
    pays: clean(value.pays, LIMITS.pays),
    needs: clean(value.needs, LIMITS.needs),
    link: value.link ? httpUrl(clean(value.link, LIMITS.link)) : null,
    createdAt: Number.isNaN(created.getTime()) ? null : created.toISOString(),
  }
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

// Everything people have added, newest first.
// io: { backlinks, resolveDid, getRecord } from ../library/lib.js (or fakes in tests).
// hidden: { dids: [], uris: [] }, the entries this site declines to show.
export async function loadCommunity(io, hidden = {}) {
  const hideDid = new Set(hidden.dids || [])
  const hideUri = new Set(hidden.uris || [])
  let refs
  try {
    refs = await io.backlinks(ATLAS_DID, COL, '.atlas', MAX_ENTRIES)
  } catch (error) {
    return { entries: [], unreachable: 0, error }
  }
  const seen = new Set()
  const wanted = refs.filter((r) => r && r.did && r.rkey && !hideDid.has(r.did) && !seen.has(r.did + '/' + r.rkey) && seen.add(r.did + '/' + r.rkey))
  const got = await pool(wanted, 8, async (r) => {
    const id = await io.resolveDid(r.did)
    const rec = await io.getRecord(id.pds, r.did, COL, r.rkey)
    const entry = rec && parseEntry(rec.value)
    return entry && { ...entry, uri: `at://${r.did}/${COL}/${r.rkey}`, rkey: r.rkey, did: r.did, handle: id.handle || null }
  })
  const entries = []
  let unreachable = 0
  for (const g of got) {
    if (!g.ok) unreachable++
    else if (g.value && !hideUri.has(g.value.uri)) entries.push(g.value)
  }
  entries.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  return { entries, unreachable, error: null }
}
