// Broadsheet protocol logic: discovery of standard.site documents, editions
// as standard.site documents, and the normalizing in between. No DOM and no
// SDK import, so it runs in the browser and in Node tests alike. Every write
// goes through an authenticated @atproto/api Agent passed in by the caller.
//
// An edition is a site.standard.document in the editor's own broadsheet
// publication (a site.standard.publication whose url is BASE, the newsstand). Its content is
// an org.jason-edelman.broadsheet.content: slots holding strong refs to the
// documents picked. Readers that don't know the content type still see a
// document with a title, a description and a plaintext list of headlines.

export const NS = 'org.jason-edelman.broadsheet'
export const CONTENT = `${NS}.content`
export const COL = {
  document: 'site.standard.document',
  publication: 'site.standard.publication',
  subscription: 'site.standard.graph.subscription',
  recommend: 'site.standard.graph.recommend',
  follow: 'app.bsky.graph.follow',
}
export const SCOPE = ['atproto', `repo:${COL.document}`, `repo:${COL.publication}`, `repo:${COL.recommend}`].join(' ')
export const BASE = 'https://jason-edelman.org/broadsheet/newsstand'
export const DEFAULT_EDITOR = 'jason-edelman.org'
export const HANDLE_RESOLVER = 'https://bsky.social'
const RELAY = 'https://relay1.us-east.bsky.network'
const APPVIEW = 'https://public.api.bsky.app'
const PLC = 'https://plc.directory'
const CONSTELLATION = 'https://constellation.microcosm.blue'
const CDN = 'https://cdn.bsky.app/img'

// The front page: how many of each slot, in render order.
export const LAYOUT = [
  { role: 'lead', count: 1, label: 'Lead' },
  { role: 'second', count: 2, label: 'Second' },
  { role: 'feature', count: 3, label: 'Feature' },
  { role: 'brief', count: 4, label: 'Brief' },
]
export const SLOTS = LAYOUT.flatMap(({ role, count, label }) => Array.from({ length: count }, (_, i) => ({ id: `${role}-${i}`, role, label: count > 1 ? `${label} ${i + 1}` : label })))
export const ROLES = new Set(LAYOUT.map((l) => l.role))

// ── Fetching ─────────────────────────────────────────────────────────────

// Every read gives up after 15 s, so one server that never answers can't
// stall a page (or the newsstand's navigation) behind it.
const TIMEOUT = 15000
async function getJson(url, init = {}) {
  const res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(TIMEOUT) })
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

// ── Identity ─────────────────────────────────────────────────────────────

const DID_RE = /^did:(plc:[a-z2-7]{24}|web:[a-zA-Z0-9.%-]+)$/
const AT_URI = /^at:\/\/(did:[a-z]+:[a-zA-Z0-9.%:-]+)\/([a-zA-Z0-9.-]+)\/([a-zA-Z0-9._~:-]{1,512})$/
export const parseAtUri = (u) => {
  const m = AT_URI.exec(String(u ?? ''))
  return m ? { did: m[1], collection: m[2], rkey: m[3] } : null
}

export async function resolveHandle(handle) {
  const q = encodeURIComponent(handle.toLowerCase())
  return (await getJson(`${HANDLE_RESOLVER}/xrpc/com.atproto.identity.resolveHandle?handle=${q}`)).did
}

const didCache = new Map()
export function resolveDid(did) {
  if (!didCache.has(did)) {
    const p = (async () => {
      if (!DID_RE.test(did)) throw new Error(`Not a DID: ${did}`)
      const url = did.startsWith('did:plc:') ? `${PLC}/${did}` : `https://${decodeURIComponent(did.slice(8))}/.well-known/did.json`
      const doc = await getJson(url)
      const svc = (doc.service || []).find((s) => s.id === '#atproto_pds' || s.id === `${did}#atproto_pds`)
      if (!svc) throw new Error(`No PDS listed for ${did}`)
      return { did, pds: String(svc.serviceEndpoint).replace(/\/+$/, '') }
    })()
    didCache.set(did, p)
    p.catch(() => didCache.delete(did))
  }
  return didCache.get(did)
}

export async function resolveActor(input) {
  const s = String(input || '').trim().replace(/^@/, '')
  if (!s) throw new Error('Enter a handle')
  return resolveDid(s.startsWith('did:') ? s : await resolveHandle(s))
}

// Profiles as Bluesky's AppView verified them, 25 per request.
// -> Map did -> { handle, displayName }
export async function profiles(dids) {
  const out = new Map()
  const batches = []
  for (let i = 0; i < dids.length; i += 25) batches.push(dids.slice(i, i + 25))
  await pool(batches, 4, async (batch) => {
    const q = new URLSearchParams()
    for (const d of batch) q.append('actors', d)
    const { profiles } = await getJson(`${APPVIEW}/xrpc/app.bsky.actor.getProfiles?${q}`)
    for (const p of profiles) out.set(p.did, { handle: p.handle !== 'handle.invalid' ? p.handle : null, displayName: p.displayName || '' })
  })
  return out
}

// Handle suggestions for a partial input, from Bluesky's public AppView.
export async function searchActors(q, signal) {
  const params = new URLSearchParams({ q, limit: '6' })
  const { actors } = await getJson(`${APPVIEW}/xrpc/app.bsky.actor.searchActorsTypeahead?${params}`, { signal })
  return actors.map((a) => ({
    did: a.did,
    handle: a.handle,
    displayName: a.displayName || '',
    // The CDN's thumbnail preset is ~30x smaller than the full avatar.
    avatar: a.avatar ? a.avatar.replace('/img/avatar/', '/img/avatar_thumbnail/') : null,
  }))
}

// ── Records ──────────────────────────────────────────────────────────────

const shape = (r) => ({ uri: r.uri, cid: r.cid, rkey: r.uri.split('/').pop(), value: r.value })

// Newest first (listRecords' default order). Stops after maxPages.
export async function listRecords(pds, repo, collection, maxPages = 1, limit = 100) {
  const out = []
  let cursor
  for (let page = 0; page < maxPages; page++) {
    const q = new URLSearchParams({ repo, collection, limit: String(limit) })
    if (cursor) q.set('cursor', cursor)
    const data = await getJson(`${pds}/xrpc/com.atproto.repo.listRecords?${q}`)
    out.push(...data.records)
    cursor = data.cursor
    if (!cursor || !data.records.length) break
  }
  return out.map(shape)
}

export async function getRecord(uri) {
  const p = parseAtUri(uri)
  if (!p) throw new Error(`Not an at-uri: ${uri}`)
  const { pds } = await resolveDid(p.did)
  const q = new URLSearchParams({ repo: p.did, collection: p.collection, rkey: p.rkey })
  try {
    return shape(await getJson(`${pds}/xrpc/com.atproto.repo.getRecord?${q}`))
  } catch (e) {
    if (e.error === 'RecordNotFound' || e.status === 404 || e.status === 400) return null
    throw e
  }
}

export async function reposWithCollection(collection, max = 50000) {
  const out = []
  let cursor
  while (out.length < max) {
    const q = new URLSearchParams({ collection, limit: '2000' })
    if (cursor) q.set('cursor', cursor)
    const data = await getJson(`${RELAY}/xrpc/com.atproto.sync.listReposByCollection?${q}`)
    out.push(...data.repos.map((r) => r.did))
    cursor = data.cursor
    if (!cursor || !data.repos.length) break
  }
  return out
}

// ── Normalizing documents ────────────────────────────────────────────────

const str = (v, max = 5000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
function httpUrl(v) {
  if (typeof v !== 'string') return null
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href.replace(/\/+$/, '') : null
  } catch {
    return null
  }
}

// The document's words as plain text: textContent if the platform wrote it,
// else every `plaintext` field in the content tree (Leaflet keeps its text
// there), else nothing.
export function plainText(v) {
  if (typeof v?.textContent === 'string' && v.textContent.trim()) return v.textContent.trim()
  const out = []
  let size = 0
  const walk = (n, depth) => {
    if (depth > 14 || size > 6000 || n == null || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach((x) => walk(x, depth + 1))
    if (typeof n.plaintext === 'string' && n.plaintext.trim()) {
      out.push(n.plaintext.trim())
      size += n.plaintext.length
    }
    for (const [k, x] of Object.entries(n)) if (k !== 'plaintext' && x && typeof x === 'object') walk(x, depth + 1)
  }
  walk(v?.content, 0)
  return out.join('\n\n')
}

// Prose only: drop checkbox and list debris some platforms leave in plaintext,
// and a first line that just repeats the title.
export function cleanText(text, title = '') {
  let t = String(text ?? '')
    .replace(/\[[ xX]?\]/g, ' ')
    .replace(/^[ \t]*(?:[-*•#>]+|\d+[.)])[ \t]+/gm, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
  if (title && t.toLowerCase().startsWith(title.toLowerCase())) t = t.slice(title.length).replace(/^[\s:.–—-]+/, '')
  return t
}

// Up to n characters, cut at a word, with an ellipsis if cut.
export function excerpt(text, n) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  const cut = t.slice(0, n)
  const at = cut.lastIndexOf(' ')
  return (at > n * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.–—-]+$/, '') + '…'
}

const blobCid = (b) => b?.ref?.$link ?? b?.cid ?? null
export function imageUrls(did, blob) {
  const cid = blobCid(blob)
  if (!cid) return null
  return {
    thumb: `${CDN}/feed_thumbnail/plain/${did}/${cid}@jpeg`,
    full: `${CDN}/feed_fullsize/plain/${did}/${cid}@jpeg`,
    raw: null, // filled in once the PDS is known, as a fallback
    cid,
  }
}

export function readPublication(rec) {
  const v = rec?.value
  if (!v || typeof v !== 'object') return null
  const name = str(v.name, 200)
  const url = httpUrl(v.url)
  if (!name || !url) return null
  const did = parseAtUri(rec.uri)?.did
  const rgb = v.basicTheme?.accent
  const accent = rgb && [rgb.r, rgb.g, rgb.b].every((x) => Number.isInteger(x) && x >= 0 && x <= 255) ? [rgb.r, rgb.g, rgb.b] : null
  return { uri: rec.uri, cid: rec.cid, did, name, url, description: str(v.description, 600), icon: did ? imageUrls(did, v.icon) : null, accent }
}

export function canonicalUrl(base, path) {
  if (!base) return null
  const p = str(path, 2000)
  if (!p) return base
  return base + (p.startsWith('/') ? p : '/' + p)
}

// A document record, cleaned for display, or null. `pubs`: Map uri -> publication.
export function readDocument(rec, pubs = new Map()) {
  const v = rec?.value
  if (!v || typeof v !== 'object') return null
  const title = str(v.title, 300)
  const publishedAt = typeof v.publishedAt === 'string' && !isNaN(Date.parse(v.publishedAt)) ? v.publishedAt : null
  if (!title || !publishedAt) return null
  const did = parseAtUri(rec.uri)?.did
  const site = typeof v.site === 'string' ? v.site : ''
  const pub = site.startsWith('at://') ? pubs.get(site) ?? null : null
  const looseBase = site.startsWith('http') ? httpUrl(site) : null
  const text = cleanText(plainText(v), str(v.title, 300))
  return {
    uri: rec.uri,
    cid: rec.cid,
    did,
    title,
    description: str(v.description, 1200),
    text: text.slice(0, 2000),
    words: text ? text.split(/\s+/).length : 0,
    publishedAt,
    tags: Array.isArray(v.tags) ? v.tags.filter((t) => typeof t === 'string').map((t) => t.replace(/^#/, '').trim().slice(0, 64)).filter(Boolean).slice(0, 8) : [],
    cover: did ? imageUrls(did, v.coverImage) : null,
    site,
    pub,
    pubName: pub?.name ?? (looseBase ? new URL(looseBase).hostname : ''),
    url: canonicalUrl(pub?.url ?? looseBase, v.path),
    contributors: Array.isArray(v.contributors) ? v.contributors.filter((c) => typeof c?.did === 'string').map((c) => ({ did: c.did, displayName: str(c.displayName, 100) })) : [],
    isEdition: v.content?.$type === CONTENT,
  }
}

// ── Discovery ────────────────────────────────────────────────────────────
// Candidates for a reader's broadsheet, from four places:
//   subscribed   documents in publications they subscribe to
//   followed     documents by accounts they follow on Bluesky (who publish)
//   recommended  documents people they follow recommended
//   own          their own documents
// onUpdate(pool) is called as each source lands, so the wire fills in.

const SOURCE_WEIGHT = { own: 0.5, subscribed: 3, followed: 2, recommended: 1 }

export async function discover(did, { days = 45, onUpdate = () => {}, onStatus = () => {} } = {}) {
  const since = Date.now() - days * 86400e3
  const me = await resolveDid(did)
  const state = { docs: new Map(), pubs: new Map(), recs: new Map(), profiles: new Map(), errors: 0 }
  const raw = new Map() // uri -> { rec, sources:Set }
  const pubRecs = new Map() // uri -> publication record (raw)

  const addRaw = (rec, source) => {
    if (!rec?.value) return
    if (rec.value.content?.$type === CONTENT) return // other broadsheets' editions aren't articles
    const t = Date.parse(rec.value.publishedAt)
    if (!(t >= since) || t > Date.now() + 86400e3) return
    const r = raw.get(rec.uri) ?? { rec, sources: new Set() }
    r.sources.add(source)
    raw.set(rec.uri, r)
  }

  // Publications for whatever documents we have, then normalize and publish.
  const settle = async () => {
    const need = [...new Set([...raw.values()].map((r) => r.rec.value.site).filter((s) => typeof s === 'string' && s.startsWith('at://') && !pubRecs.has(s)))]
    const got = await pool(need, 8, (u) => getRecord(u))
    got.forEach((g, i) => pubRecs.set(need[i], g.ok ? g.value : null))
    for (const [u, rec] of pubRecs) if (rec && !state.pubs.has(u)) state.pubs.set(u, readPublication(rec))
    const authors = [...new Set([...raw.values()].map((r) => parseAtUri(r.rec.uri)?.did).filter((d) => d && !state.profiles.has(d)))]
    try {
      for (const [k, v] of await profiles(authors)) state.profiles.set(k, v)
    } catch {}
    for (const [uri, r] of raw) {
      const doc = readDocument(r.rec, state.pubs)
      if (!doc) continue
      doc.sources = [...r.sources]
      doc.recommendedBy = [...(state.recs.get(uri) ?? [])]
      doc.author = state.profiles.get(doc.did) ?? null
      state.docs.set(uri, doc)
    }
    onUpdate(snapshot(state))
  }

  // Everything in these repos' document collections (first page: their newest 100).
  const fromRepos = async (dids, source, filter = () => true) => {
    const res = await pool(dids, 10, async (d) => {
      const { pds } = await resolveDid(d)
      return listRecords(pds, d, COL.document, 1, 100)
    })
    for (const r of res) {
      if (!r.ok) state.errors++
      else for (const rec of r.value) if (filter(rec)) addRaw(rec, source)
    }
  }

  onStatus('Reading your subscriptions and follows…')
  const [subs, follows, docRepos, recRepos] = await Promise.all([
    listRecords(me.pds, did, COL.subscription, 10),
    listRecords(me.pds, did, COL.follow, 60).then((rs) => rs.map((r) => r.value?.subject).filter((s) => typeof s === 'string' && DID_RE.test(s))),
    reposWithCollection(COL.document).catch(() => []),
    reposWithCollection(COL.recommend).catch(() => []),
  ])
  const subPubs = new Set(subs.map((s) => s.value?.publication).filter((u) => parseAtUri(u)?.collection === COL.publication))

  // 1. Subscriptions and my own documents.
  onStatus(`Reading ${subPubs.size} subscribed publication${subPubs.size === 1 ? '' : 's'}…`)
  const subOwners = [...new Set([...subPubs].map((u) => parseAtUri(u).did))]
  await Promise.all([
    fromRepos(subOwners, 'subscribed', (rec) => subPubs.has(rec.value?.site)),
    fromRepos([did], 'own'),
  ])
  await settle()

  // 2. People I follow who publish.
  const followSet = new Set(follows)
  const publishers = docRepos.filter((d) => followSet.has(d) && d !== did)
  onStatus(`Reading ${publishers.length} people you follow who publish…`)
  await fromRepos(publishers, 'followed')
  await settle()

  // 3. What people I follow recommended lately.
  const recommenders = recRepos.filter((d) => followSet.has(d))
  onStatus(`Reading recommendations from ${recommenders.length} people you follow…`)
  const recLists = await pool(recommenders, 10, async (d) => {
    const { pds } = await resolveDid(d)
    return (await listRecords(pds, d, COL.recommend, 1, 50)).map((r) => ({ by: d, doc: r.value?.document, at: Date.parse(r.value?.createdAt) }))
  })
  for (const l of recLists) {
    if (!l.ok) continue
    for (const r of l.value) {
      if (!(r.at >= since) || parseAtUri(r.doc)?.collection !== COL.document) continue
      if (!state.recs.has(r.doc)) state.recs.set(r.doc, new Set())
      state.recs.get(r.doc).add(r.by)
    }
  }
  const missing = [...state.recs.keys()].filter((u) => !raw.has(u)).slice(0, 200)
  const recDocs = await pool(missing, 10, (u) => getRecord(u))
  recDocs.forEach((g) => g.ok && g.value && addRaw(g.value, 'recommended'))
  for (const u of state.recs.keys()) raw.get(u)?.sources.add('recommended')
  await settle()
  onStatus('')
  return snapshot(state)
}

function snapshot(state) {
  return { docs: rank([...state.docs.values()]), pubs: state.pubs, errors: state.errors }
}

// Recency, plus a lift for each source and each follow who recommended it.
export function score(doc, now = Date.now()) {
  const ageDays = Math.max(0, (now - Date.parse(doc.publishedAt)) / 86400e3)
  const source = Math.max(0, ...doc.sources.map((s) => SOURCE_WEIGHT[s] ?? 0))
  return 10 / (1 + ageDays / 4) + source + 1.5 * Math.min(doc.recommendedBy.length, 5) + (doc.cover ? 0.5 : 0)
}
export const rank = (docs) => docs.sort((a, b) => score(b) - score(a) || b.publishedAt.localeCompare(a.publishedAt))

export function search(docs, q) {
  const terms = String(q ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return docs
  return docs.filter((d) => {
    const hay = [d.title, d.description, d.pubName, d.author?.handle, d.author?.displayName, d.tags.join(' '), d.text.slice(0, 3000)].join(' ').toLowerCase()
    return terms.every((t) => hay.includes(t))
  })
}

// Fill empty slots from candidates, best first. Covers go to the slots that
// show them (lead, seconds, features); briefs take whatever is left.
export function autoFill(slots, candidates) {
  const used = new Set(Object.values(slots).filter(Boolean).map((s) => s.uri))
  const free = candidates.filter((d) => !used.has(d.uri))
  const out = { ...slots }
  const take = (wantCover) => {
    let i = free.findIndex((d) => !wantCover || d.cover)
    if (i < 0) i = free.length ? 0 : -1
    return i < 0 ? null : free.splice(i, 1)[0]
  }
  for (const s of SLOTS) {
    if (out[s.id]) continue
    const d = take(s.role !== 'brief')
    if (d) out[s.id] = { uri: d.uri, cid: d.cid }
  }
  return out
}

// Documents by uri, with their publications and authors. -> Map uri -> doc|null
export async function loadDocs(uris) {
  const got = await pool(uris, 8, (u) => getRecord(u))
  const raws = got.map((g) => (g.ok ? g.value : null))
  const pubUris = [...new Set(raws.map((r) => r?.value?.site).filter((s) => typeof s === 'string' && s.startsWith('at://')))]
  const pubs = new Map()
  const pr = await pool(pubUris, 8, (u) => getRecord(u))
  pr.forEach((g, i) => g.ok && g.value && pubs.set(pubUris[i], readPublication(g.value)))
  const authors = [...new Set(raws.map((r) => parseAtUri(r?.uri)?.did).filter(Boolean))]
  const prof = await profiles(authors).catch(() => new Map())
  const out = new Map()
  raws.forEach((r, i) => {
    const doc = r ? readDocument(r, pubs) : null
    if (doc) {
      doc.author = prof.get(doc.did) ?? null
      doc.sources ??= []
      doc.recommendedBy ??= []
    }
    out.set(uris[i], doc)
  })
  return out
}

// ── Editions ─────────────────────────────────────────────────────────────

const TID_CHARS = '234567abcdefghijklmnopqrstuvwxyz'
let lastMicros = 0
export function tid(now = Date.now()) {
  let micros = now * 1000 + Math.floor(Math.random() * 1000)
  if (micros <= lastMicros) micros = lastMicros + 1
  lastMicros = micros
  let v = (BigInt(micros) << 10n) | BigInt(Math.floor(Math.random() * 1024))
  let s = ''
  for (let i = 0; i < 13; i++) {
    s = TID_CHARS[Number(v & 31n)] + s
    v >>= 5n
  }
  return s
}

export const editionPath = (did, rkey) => `/?at=${did}/${rkey}`

// Morning and evening editions. An edition with no period is the day's only one.
export const PERIODS = { am: 'Morning Edition', pm: 'Evening Edition' }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// "2026-11-09" -> a Date at local noon (safe from timezone edges).
export const dateOf = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}
export const longDate = (ymd) => dateOf(ymd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
// Which day and period an edition belongs to: the editor's own date when the
// edition carries one, else the day it was published, where the reader is.
export function editionDay(value) {
  const c = value?.content ?? {}
  const date = typeof c.date === 'string' && DATE_RE.test(c.date) ? c.date : localDate(new Date(value?.publishedAt))
  return { date, period: PERIODS[c.period] ? c.period : null }
}

// The edition's content, cleaned, or null.
export function readEditionContent(c) {
  if (c?.$type !== CONTENT || !Array.isArray(c.slots)) return null
  const slots = []
  const seen = new Set()
  for (const s of c.slots.slice(0, SLOTS.length)) {
    if (!ROLES.has(s?.role) || parseAtUri(s?.item?.uri)?.collection !== COL.document || seen.has(s.item.uri)) continue
    seen.add(s.item.uri)
    const slot = { role: s.role, item: { uri: s.item.uri, cid: typeof s.item.cid === 'string' ? s.item.cid : '' } }
    if (str(s.headline, 300)) slot.headline = str(s.headline, 300)
    if (str(s.deck, 600)) slot.deck = str(s.deck, 600)
    const via = readVia(s.via)
    if (via) slot.via = via
    slots.push(slot)
  }
  return {
    number: Number.isInteger(c.number) && c.number > 0 ? c.number : null,
    note: str(c.note, 3000),
    date: typeof c.date === 'string' && DATE_RE.test(c.date) ? c.date : null,
    period: PERIODS[c.period] ? c.period : null,
    slots,
  }
}

// A reshare's credit: the edition it came from, and that broadsheet's name.
function readVia(v) {
  if (parseAtUri(v?.uri)?.collection !== COL.document) return null
  const out = { uri: v.uri, cid: typeof v.cid === 'string' ? v.cid : '' }
  if (str(v.masthead, 200)) out.masthead = str(v.masthead, 200)
  return out
}

// The builder's state -> slots in render order. via: uri -> reshare credit.
export function slotsFromBoard(board, edits = {}, via = {}) {
  const out = []
  for (const s of SLOTS) {
    const it = board[s.id]
    if (!it) continue
    const slot = { role: s.role, item: { uri: it.uri, cid: it.cid } }
    const e = edits[it.uri] ?? {}
    if (str(e.headline, 300)) slot.headline = str(e.headline, 300)
    if (str(e.deck, 600)) slot.deck = str(e.deck, 600)
    const v = readVia(via[it.uri])
    if (v) slot.via = v
    out.push(slot)
  }
  return out
}

// Slots in render order -> the builder's board.
export function boardFromSlots(slots) {
  const board = {}
  const edits = {}
  const via = {}
  const next = {}
  for (const s of slots) {
    const i = next[s.role] ?? 0
    const def = SLOTS.find((x) => x.role === s.role && x.id === `${s.role}-${i}`)
    if (!def) continue
    next[s.role] = i + 1
    board[def.id] = { uri: s.item.uri, cid: s.item.cid }
    if (s.headline || s.deck) edits[s.item.uri] = { headline: s.headline ?? '', deck: s.deck ?? '' }
    if (s.via) via[s.item.uri] = s.via
  }
  return { board, edits, via }
}

// "The Atmosphere, Morning Edition, November 9, 2026"
export function editionTitle(masthead, date = localDate(), period = null) {
  return [masthead, PERIODS[period], longDate(date)].filter(Boolean).join(', ')
}

// My broadsheet publication (url === BASE), or null.
export async function findMasthead(pds, did) {
  const pubs = await listRecords(pds, did, COL.publication, 5)
  return pubs.find((p) => httpUrl(p.value?.url) === BASE) ?? null
}

// My editions, newest first.
export async function listEditions(did) {
  const { pds } = await resolveDid(did)
  const docs = await listRecords(pds, did, COL.document, 10)
  return docs.filter((d) => d.value?.content?.$type === CONTENT && readEditionContent(d.value.content))
}

const repo = (agent) => agent.com.atproto.repo

// Publish an edition, which freezes it: one per day, or one morning and one
// evening edition. (`existing` replaces an edition in place; the editor no
// longer offers it, but it stays for corrections by hand.)
// -> { uri, rkey, recommended, title }
//   slots     from slotsFromBoard
//   docs      Map uri -> normalized document, for the plaintext summary
//   period    null, 'am' or 'pm'
//   date      the editor's local date, YYYY-MM-DD
export async function publishEdition(agent, me, { masthead, note = '', slots, docs, recommend = true, discoverable = true, period = null, date = localDate() }, existing = null) {
  const name = str(masthead, 200)
  if (!name) throw new Error('Name the broadsheet.')
  if (!slots.length) throw new Error('Put at least one article on the page.')
  if (slots[0].role !== 'lead') throw new Error('Fill the lead slot first.')
  if (existing && existing.value?.content?.$type !== CONTENT) throw new Error('That record is not an edition.')
  if (period && !PERIODS[period]) throw new Error('Unknown edition.')
  if (!DATE_RE.test(date)) throw new Error('Bad date.')
  const { pds } = await resolveDid(me)
  const editions = existing ? [] : await listEditions(me)
  const clash = editions.find((e) => {
    const d = editionDay(e.value)
    return d.date === date && d.period === (period || null)
  })
  if (clash) throw new Error(`${period ? `The ${PERIODS[period].toLowerCase()}` : 'Today’s edition'} for ${longDate(date)} is already out, and published editions are frozen.${period ? '' : ' Publish a morning or evening edition instead.'}`)

  // The masthead: one publication per editor, renamed when the name changes.
  let pub = await findMasthead(pds, me)
  const pubRecord = { $type: COL.publication, url: BASE, name, description: 'A broadsheet of standard.site writing.', preferences: { showInDiscover: discoverable } }
  if (!pub) {
    const { data } = await repo(agent).createRecord({ repo: me, collection: COL.publication, record: pubRecord })
    pub = { uri: data.uri, cid: data.cid }
  } else if (pub.value?.name !== name) {
    const { data } = await repo(agent).putRecord({ repo: me, collection: COL.publication, rkey: pub.rkey, record: { ...pub.value, name }, swapRecord: pub.cid })
    pub = { uri: data.uri, cid: data.cid }
  }

  const content = { $type: CONTENT, slots, date: existing ? existing.value.content.date ?? date : date }
  const number = existing ? existing.value.content.number : editions.length + 1
  if (number) content.number = number
  if (period) content.period = period
  if (str(note, 3000)) content.note = str(note, 3000)
  const rkey = existing?.rkey ?? tid()
  const headlines = slots.map((s) => {
    const d = docs.get(s.item.uri)
    return `${s.headline || d?.title || ''}${d?.pubName ? ` (${d.pubName})` : ''}`
  })
  const record = {
    $type: COL.document,
    site: pub.uri,
    path: editionPath(me, rkey),
    title: existing?.value?.title ?? editionTitle(name, date, period),
    description: str(note, 3000) || `${slots.length} pieces from ${new Set(slots.map((s) => docs.get(s.item.uri)?.pubName).filter(Boolean)).size} publications.`,
    textContent: headlines.join('\n'),
    tags: ['broadsheet'],
    publishedAt: existing?.value?.publishedAt ?? new Date().toISOString(),
    content,
  }
  if (existing) record.updatedAt = new Date().toISOString()
  const { data } = existing
    ? await repo(agent).putRecord({ repo: me, collection: COL.document, rkey, record, swapRecord: existing.cid })
    : await repo(agent).createRecord({ repo: me, collection: COL.document, rkey, record })

  // Recommend each piece once, so its author sees it was picked.
  let recommended = 0
  if (recommend) {
    const mine = new Set((await listRecords(pds, me, COL.recommend, 20)).map((r) => r.value?.document))
    for (const s of slots) {
      if (mine.has(s.item.uri) || parseAtUri(s.item.uri)?.did === me) continue
      try {
        await repo(agent).createRecord({ repo: me, collection: COL.recommend, record: { $type: COL.recommend, document: s.item.uri, createdAt: new Date().toISOString() } })
        recommended++
      } catch (e) {
        console.warn('recommend failed', s.item.uri, e)
      }
    }
  }
  return { uri: data.uri, rkey, recommended, title: record.title }
}

// Delete one of my editions. Refuses any document that isn't an edition, so a
// bug here can't touch the editor's other standard.site writing.
export async function deleteEdition(agent, me, edition) {
  if (edition.value?.content?.$type !== CONTENT || parseAtUri(edition.uri)?.did !== me) throw new Error('Not one of your editions.')
  return repo(agent).deleteRecord({ repo: me, collection: COL.document, rkey: edition.rkey, swapRecord: edition.cid })
}

// ── Reading an edition ───────────────────────────────────────────────────

// "handle/rkey", "did/rkey", "handle" (latest), or an at-uri. -> { did, rkey|null }
export async function resolveEditionRef(ref) {
  const s = String(ref ?? '').trim().replace(/^@/, '')
  const p = parseAtUri(s)
  if (p) return { did: p.did, rkey: p.rkey }
  const [who, rkey] = s.split('/')
  const { did } = await resolveActor(who || DEFAULT_EDITOR)
  return { did, rkey: rkey || null }
}

// Everything the renderer needs. -> { edition, editor, pub, slots: [{ role, headline, deck, doc|null, uri }] }
export async function loadEdition(ref) {
  const { did, rkey } = await resolveEditionRef(ref)
  let rec
  if (rkey) rec = await getRecord(`at://${did}/${COL.document}/${rkey}`)
  else rec = (await listEditions(did))[0] ?? null
  if (!rec) return { edition: null, did }
  const content = readEditionContent(rec.value.content)
  if (!content) return { edition: null, did }
  const [pubRec, prof] = await Promise.all([
    typeof rec.value.site === 'string' && rec.value.site.startsWith('at://') ? getRecord(rec.value.site).catch(() => null) : null,
    profiles([did]).catch(() => new Map()),
  ])
  const docs = await loadDocs(content.slots.map((s) => s.item.uri))
  const slots = content.slots.map((s) => {
    const doc = docs.get(s.item.uri) ?? null
    return { role: s.role, headline: s.headline ?? '', deck: s.deck ?? '', via: s.via ?? null, uri: s.item.uri, doc, changed: !!doc && !!s.item.cid && doc.cid !== s.item.cid }
  })
  return {
    did,
    edition: { uri: rec.uri, cid: rec.cid, rkey: rec.rkey, value: rec.value, title: rec.value.title, publishedAt: rec.value.publishedAt, number: content.number, note: content.note, ...editionDay(rec.value) },
    pub: pubRec ? readPublication(pubRec) : null,
    editor: prof.get(did) ?? null,
    slots,
  }
}

// ── A writer by handle ───────────────────────────────────────────────────

// Recent documents from one repo, normalized, for adding a writer to the wire
// by handle. -> [doc]
export async function writerDocs(input, { days = 45, source = 'added' } = {}) {
  const { did, pds } = await resolveActor(input)
  const since = Date.now() - days * 86400e3
  const recs = (await listRecords(pds, did, COL.document, 1, 100)).filter((r) => r.value?.content?.$type !== CONTENT && Date.parse(r.value?.publishedAt) >= since)
  const sites = [...new Set(recs.map((r) => r.value.site).filter((x) => typeof x === 'string' && x.startsWith('at://')))]
  const pubs = new Map()
  const got = await pool(sites, 8, (u) => getRecord(u))
  got.forEach((g, i) => g.ok && g.value && pubs.set(sites[i], readPublication(g.value)))
  const prof = (await profiles([did]).catch(() => new Map())).get(did) ?? null
  return recs
    .map((r) => readDocument(r, pubs))
    .filter(Boolean)
    .map((d) => Object.assign(d, { sources: [source], recommendedBy: [], author: prof }))
}

// Editions as the newsstand lists them: newest first, with day and period.
export function editionList(recs) {
  return recs
    .map((e) => ({ uri: e.uri, cid: e.cid, rkey: e.rkey, title: e.value.title, publishedAt: e.value.publishedAt, number: e.value.content?.number ?? null, ...editionDay(e.value) }))
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
}

// ── The newsstand ────────────────────────────────────────────────────────
// Every broadsheet masthead on the network, found in one query: Constellation
// indexes the url field of every site.standard.publication, so the mastheads
// are the publications whose url is the newsstand's.

export async function findMastheads(max = 5000) {
  const out = []
  let cursor
  while (out.length < max) {
    const q = new URLSearchParams({ target: BASE, collection: COL.publication, path: '.url', limit: '100' })
    if (cursor) q.set('cursor', cursor)
    const data = await getJson(`${CONSTELLATION}/links?${q}`)
    out.push(...data.linking_records)
    cursor = data.cursor
    if (!cursor || !data.linking_records.length) break
  }
  return out
}

// The rack: editors with at least one edition, each with their editions newest
// first. The reader's own broadsheet comes first, then the people they follow,
// then everyone else, each group by its latest edition.
// -> [{ did, handle, displayName, masthead, group: 'you'|'following'|'everyone',
//       editions: [{ uri, cid, rkey, title, publishedAt, number, date, period }] }]
export async function rack(readerDid = null) {
  const [heads, follows] = await Promise.all([
    findMastheads(),
    readerDid
      ? resolveDid(readerDid).then(({ pds }) => listRecords(pds, readerDid, COL.follow, 60)).then((rs) => new Set(rs.map((r) => r.value?.subject)))
      : new Set(),
  ])
  const dids = [...new Set(heads.map((h) => h.did))]
  const headOf = new Map(heads.map((h) => [h.did, h]))
  const [got, prof, pubs] = await Promise.all([
    pool(dids, 8, (d) => listEditions(d)),
    profiles(dids).catch(() => new Map()),
    pool(dids, 8, (d) => getRecord(`at://${d}/${COL.publication}/${headOf.get(d).rkey}`)),
  ])
  const editors = []
  got.forEach((g, i) => {
    if (!g.ok || !g.value.length) return
    const did = dids[i]
    editors.push({
      did,
      handle: prof.get(did)?.handle ?? null,
      displayName: prof.get(did)?.displayName ?? '',
      masthead: (pubs[i].ok && pubs[i].value ? readPublication(pubs[i].value)?.name : null) ?? null,
      group: did === readerDid ? 'you' : follows.has(did) ? 'following' : 'everyone',
      editions: editionList(g.value),
    })
  })
  const order = { you: 0, following: 1, everyone: 2 }
  return editors.sort((a, b) => order[a.group] - order[b.group] || String(b.editions[0].publishedAt).localeCompare(String(a.editions[0].publishedAt)))
}
