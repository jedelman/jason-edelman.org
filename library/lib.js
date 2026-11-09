// Library protocol logic. No DOM and no SDK import, so it runs in the
// browser and in Node tests alike. Public reads are plain XRPC GETs; every
// write goes through an authenticated @atproto/api Agent passed in by the caller.
//
// Where records live:
//   owner's repo     item (the inventory), checkin (owner closes someone's loan)
//   borrower's repo  loan (exists while the item is out; deleted on check-in)
//                    return (a receipt written at check-in: the borrower's history)
//
// Nobody keeps a list of borrowers. Open loans are found by backlink: every
// loan names the library's DID, and Constellation, a network-wide index of
// links between records, answers "which loan records point at this DID?"
// The index only says where to look. Each loan it reports is read from the
// borrower's own PDS, so a stale index entry (a loan already deleted) 404s
// and drops out.

export const NS = 'org.jason-edelman.library'
export const COL = {
  item: `${NS}.item`,
  loan: `${NS}.loan`,
  checkin: `${NS}.checkin`,
  return: `${NS}.return`,
}
// Granular OAuth scope: this app can touch its own four collections and
// upload images, nothing else in anyone's repo.
export const SCOPE = ['atproto', ...Object.values(COL).map((c) => `repo:${c}`), 'blob:image/*'].join(' ')
export const HANDLE_RESOLVER = 'https://bsky.social'
export const CONSTELLATION = 'https://constellation.microcosm.blue'
const APPVIEW = 'https://public.api.bsky.app'
const PLC = 'https://plc.directory'
const MAX_OPEN_LOANS = 1000 // more index entries than this and the rest are ignored

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
    // The CDN's thumbnail preset is ~30x smaller than the full avatar.
    avatar: a.avatar ? a.avatar.replace('/img/avatar/', '/img/avatar_thumbnail/') : null,
  }))
}

// ── Records ──────────────────────────────────────────────────────────────

const shape = (r) => ({ uri: r.uri, cid: r.cid, rkey: r.uri.split('/').pop(), value: r.value })

export async function listRecords(pds, repo, collection) {
  const out = []
  let cursor
  for (let page = 0; page < 100; page++) {
    const q = new URLSearchParams({ repo, collection, limit: '100' })
    if (cursor) q.set('cursor', cursor)
    const data = await getJson(`${pds}/xrpc/com.atproto.repo.listRecords?${q}`)
    out.push(...data.records)
    cursor = data.cursor
    if (!cursor || data.records.length === 0) break
  }
  return out.map(shape)
}

// A record, or null if it no longer exists.
export async function getRecord(pds, repo, collection, rkey) {
  const q = new URLSearchParams({ repo, collection, rkey })
  try {
    return shape(await getJson(`${pds}/xrpc/com.atproto.repo.getRecord?${q}`))
  } catch (e) {
    if (e.error === 'RecordNotFound' || e.status === 404) return null
    throw e
  }
}

// Records in `collection` whose `path` field links to `target` (an at-uri or a DID).
export async function backlinks(target, collection, path, max = MAX_OPEN_LOANS) {
  const out = []
  let cursor
  while (out.length < max) {
    const q = new URLSearchParams({ target, collection, path, limit: '100' })
    if (cursor) q.set('cursor', cursor)
    const data = await getJson(`${CONSTELLATION}/links?${q}`)
    out.push(...data.linking_records)
    cursor = data.cursor
    if (!cursor || !data.linking_records.length) break
  }
  return out.slice(0, max)
}

export function blobUrl(lib, blob) {
  const cid = blob?.ref?.$link ?? blob?.cid
  if (!cid) return null
  return `${lib.pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(lib.did)}&cid=${encodeURIComponent(cid)}`
}

// ── Codes ────────────────────────────────────────────────────────────────

// Detectors disagree on UPC-A: some report 12 digits, some an EAN-13 with a
// leading 0. Store and compare the 12-digit form so a code scanned on one
// phone matches the same code scanned on another.
export function normalizeCode(raw) {
  const s = String(raw ?? '').trim()
  return /^0\d{12}$/.test(s) ? s.slice(1) : s
}

export const isbnOf = (code) => (/^97[89]\d{10}$/.test(code) ? code : null)

// Best effort: a title from Open Library for a book's ISBN, else null.
export async function lookupIsbn(isbn) {
  try {
    const j = await getJson(`https://openlibrary.org/isbn/${isbn}.json`)
    return [j.title, j.subtitle].filter(Boolean).join(': ') || null
  } catch {
    return null
  }
}

// ── State ────────────────────────────────────────────────────────────────

// Everything needed to know where each item is. `me` (the signed-in DID, if
// any) has their own loans and receipts read straight from their repo, which
// is current to the second; everyone else's loans come through the index.
export async function loadLibrary(lib, { me = null } = {}) {
  const meId = me ? await resolveDid(me) : null
  const [items, checkins, refs, myLoans, myReturns] = await Promise.all([
    listRecords(lib.pds, lib.did, COL.item),
    listRecords(lib.pds, lib.did, COL.checkin),
    backlinks(lib.did, COL.loan, '.library').catch((e) => ({ error: e })),
    meId ? listRecords(meId.pds, me, COL.loan) : [],
    meId ? listRecords(meId.pds, me, COL.return) : [],
  ])
  const indexError = refs.error ?? null
  const seen = new Set()
  const others = indexError ? [] : refs.filter((r) => r.did !== me && !seen.has(r.did + r.rkey) && seen.add(r.did + r.rkey))
  const unreachable = []
  const handles = new Map()
  if (meId?.handle) handles.set(me, meId.handle)
  const fetched = await pool(others, 8, async (r) => {
    const id = await resolveDid(r.did)
    if (id.handle) handles.set(r.did, id.handle)
    const rec = await getRecord(id.pds, r.did, COL.loan, r.rkey)
    return rec && { ...rec, did: r.did }
  })
  const loans = []
  fetched.forEach((f, i) => {
    if (!f.ok) unreachable.push(others[i].did)
    else if (f.value) loans.push(f.value)
  })
  for (const l of myLoans) loans.push({ ...l, did: me })
  const receipts = myReturns.filter((r) => r.value?.library === lib.did)
  return buildSnapshot(lib, { items, checkins, loans, handles, unreachable, indexError, receipts })
}

export function buildSnapshot(lib, { items, checkins, loans, handles = new Map(), unreachable = [], indexError = null, receipts = [] }) {
  const closed = new Map() // loan uri -> the owner's checkin record
  for (const c of checkins) if (c.value?.loan?.uri) closed.set(c.value.loan.uri, c)
  const itemUris = new Set(items.map((i) => i.uri))
  const forLibrary = loans.filter((l) => l.value?.library === lib.did)
  const active = new Map() // item uri -> open loans, oldest first
  for (const l of forLibrary) {
    if (closed.has(l.uri)) continue
    const u = l.value?.subject?.uri
    if (!itemUris.has(u)) continue
    if (!active.has(u)) active.set(u, [])
    active.get(u).push(l)
  }
  for (const list of active.values()) list.sort((a, b) => String(a.value.createdAt).localeCompare(String(b.value.createdAt)))
  return { lib, items, closed, loans: forLibrary, active, handles, unreachable, indexError, receipts }
}

export const holderOf = (snap, item) => snap.active.get(item.uri)?.[0] ?? null
export const handleOf = (snap, did) => snap.handles.get(did) ?? did
export const openLoansOf = (snap, did) => [...snap.active.values()].flat().filter((l) => l.did === did)
// My loans the owner has already checked in: tidy() turns them into receipts.
export const closedLoansOf = (snap, did) => snap.loans.filter((l) => l.did === did && snap.closed.has(l.uri))

// Copies share a barcode, and copies of a title are interchangeable: one
// title, a pool of copies. -> { code, copies, loans (open, oldest first), free }
export function poolOf(snap, rawCode) {
  const code = normalizeCode(rawCode)
  const copies = snap.items.filter((i) => normalizeCode(i.value?.barcode) === code)
  return poolFrom(snap, code, copies)
}

function poolFrom(snap, code, copies) {
  const loans = copies.flatMap((c) => snap.active.get(c.uri) ?? []).sort((a, b) => String(a.value.createdAt).localeCompare(String(b.value.createdAt)))
  const free = copies.filter((c) => !holderOf(snap, c))
  return { code, copies, loans, free }
}

// Every title in the catalog, one pool each.
export function pools(snap) {
  const groups = new Map()
  for (const i of snap.items) {
    const code = normalizeCode(i.value?.barcode)
    if (!groups.has(code)) groups.set(code, [])
    groups.get(code).push(i)
  }
  return [...groups].map(([code, copies]) => poolFrom(snap, code, copies))
}

// The copy a pool is shown by: one with a photo if there is one.
export const faceOf = (pool) => pool.copies.find((c) => c.value?.photo) ?? pool.copies[0]

// What one scan means. `me` is the signed-in DID, or null.
//   checkin     I have a copy out: this scan returns mine (Jason's rule)
//   checkout    a copy is free: take it
//   out         every copy is out with someone else
//   signed-out  status only
//   unknown     no item has this code
// Every result carries the pool.
export function decide(snap, rawCode, me) {
  const pool = poolOf(snap, rawCode)
  if (!pool.copies.length) return { kind: 'unknown', code: pool.code, pool }
  const mine = me ? pool.loans.find((l) => l.did === me) : null
  if (mine) return { kind: 'checkin', item: pool.copies.find((c) => c.uri === mine.value.subject.uri), loan: mine, pool }
  const free = pool.free[0]
  if (!me) return { kind: 'signed-out', item: free ?? faceOf(pool), loan: free ? null : pool.loans[0], pool }
  if (!free) return { kind: 'out', item: faceOf(pool), loan: pool.loans[0], pool }
  return { kind: 'checkout', item: free, pool }
}

// ── Writes (agent: an authenticated @atproto/api Agent; me: its DID) ─────

const now = () => new Date().toISOString()
const repo = (agent) => agent.com.atproto.repo

export function checkOut(agent, me, snap, item) {
  return repo(agent).createRecord({
    repo: me,
    collection: COL.loan,
    record: { $type: COL.loan, subject: { uri: item.uri, cid: item.cid }, library: snap.lib.did, createdAt: now() },
  })
}

// Delete the loan (that is the check-in: its backlink goes away), then write
// a receipt. -> { deleted, receipt }.
// Deleting a record that's already gone succeeds silently, but only a real
// delete returns a commit, so a double check-in (two taps, two devices)
// writes one receipt, not two. A failed receipt loses a history line, never
// the item's status.
export async function checkIn(agent, me, loan, returnedAt = now()) {
  const { data } = await repo(agent).deleteRecord({ repo: me, collection: COL.loan, rkey: loan.rkey, swapRecord: loan.cid })
  if (!data?.commit) return { deleted: false, receipt: false }
  try {
    await repo(agent).createRecord({
      repo: me,
      collection: COL.return,
      record: { $type: COL.return, subject: loan.value.subject, library: loan.value.library, borrowedAt: loan.value.createdAt, returnedAt },
    })
    return { deleted: true, receipt: true }
  } catch (e) {
    console.warn('Checked in, but the receipt was not written', e)
    return { deleted: true, receipt: false }
  }
}

// The owner closes a loan that lives in someone else's repo.
export function checkInFor(agent, me, loan) {
  return repo(agent).createRecord({
    repo: me,
    collection: COL.checkin,
    record: { $type: COL.checkin, loan: { uri: loan.uri, cid: loan.cid }, createdAt: now() },
  })
}

// Clear my loans the owner already checked in, so they stop appearing as
// backlinks and become ordinary history.
export async function tidy(agent, me, snap) {
  const stale = closedLoansOf(snap, me)
  for (const loan of stale) await checkIn(agent, me, loan, snap.closed.get(loan.uri).value.createdAt)
  return stale.length
}

export async function addItem(agent, me, { barcode, title, notes, photo }) {
  const record = { $type: COL.item, barcode: normalizeCode(barcode), title: String(title).trim(), createdAt: now() }
  if (!record.barcode || !record.title) throw new Error('An item needs a barcode and a title')
  if (notes && notes.trim()) record.notes = notes.trim()
  if (photo) {
    const { data } = await repo(agent).uploadBlob(photo, { encoding: photo.type || 'image/jpeg' })
    record.photo = data.blob
  }
  return repo(agent).createRecord({ repo: me, collection: COL.item, record })
}

export function removeItem(agent, me, item) {
  return repo(agent).deleteRecord({ repo: me, collection: COL.item, rkey: item.rkey, swapRecord: item.cid })
}
