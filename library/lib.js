// Library protocol logic. No DOM and no SDK import, so it runs in the
// browser and in Node tests alike. Public reads are plain XRPC GETs against
// each repo's PDS; every write goes through an authenticated @atproto/api
// Agent passed in by the caller.
//
// Where records live:
//   owner's repo     item (inventory), member (who may borrow), checkin (owner closes a loan)
//   borrower's repo  loan (a checkout; returnedAt is set on check-in)

export const NS = 'org.jason-edelman.library'
export const COL = {
  item: `${NS}.item`,
  member: `${NS}.member`,
  loan: `${NS}.loan`,
  checkin: `${NS}.checkin`,
}
// Granular OAuth scope: this app can touch its own four collections and
// upload images, nothing else in anyone's repo.
export const SCOPE = ['atproto', ...Object.values(COL).map((c) => `repo:${c}`), 'blob:image/*'].join(' ')
export const HANDLE_RESOLVER = 'https://bsky.social'
const PLC = 'https://plc.directory'

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const j = await res.json()
      msg = j.message || j.error || msg
    } catch {}
    throw new Error(msg)
  }
  return res.json()
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

// ── Records ──────────────────────────────────────────────────────────────

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
  return out.map((r) => ({ uri: r.uri, cid: r.cid, rkey: r.uri.split('/').pop(), value: r.value }))
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

// Fetch everything needed to know where each item is. Loans are read from
// the owner and each member; the owner's member list is the boundary.
export async function loadLibrary(lib) {
  const [items, members, checkins] = await Promise.all([
    listRecords(lib.pds, lib.did, COL.item),
    listRecords(lib.pds, lib.did, COL.member),
    listRecords(lib.pds, lib.did, COL.checkin),
  ])
  const memberDids = members.map((m) => m.value?.subject).filter((d) => typeof d === 'string' && d !== lib.did)
  const borrowers = [lib.did, ...new Set(memberDids)]
  const settled = await Promise.allSettled(
    borrowers.map(async (did) => {
      const id = await resolveDid(did)
      const recs = await listRecords(id.pds, did, COL.loan)
      return { id, loans: recs.filter((r) => r.value?.library === lib.did).map((r) => ({ ...r, did })) }
    }),
  )
  const loans = []
  const handles = new Map()
  const unreachable = []
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') {
      loans.push(...s.value.loans)
      if (s.value.id.handle) handles.set(borrowers[i], s.value.id.handle)
    } else unreachable.push(borrowers[i])
  })
  return buildSnapshot(lib, { items, members, checkins, loans, handles, unreachable })
}

export function buildSnapshot(lib, { items, members, checkins, loans, handles = new Map(), unreachable = [] }) {
  const closed = new Set(checkins.map((c) => c.value?.loan?.uri).filter(Boolean))
  const memberMap = new Map()
  for (const m of members) if (typeof m.value?.subject === 'string') memberMap.set(m.value.subject, m)
  for (const [did, m] of memberMap) if (!handles.has(did) && m.value.handle) handles.set(did, m.value.handle)
  const itemUris = new Set(items.map((i) => i.uri))
  const active = new Map() // item uri -> open loans, oldest first
  for (const l of loans) {
    if (l.value?.returnedAt || closed.has(l.uri)) continue
    if (l.did !== lib.did && !memberMap.has(l.did)) continue
    const u = l.value?.subject?.uri
    if (!itemUris.has(u)) continue
    if (!active.has(u)) active.set(u, [])
    active.get(u).push(l)
  }
  for (const list of active.values()) list.sort((a, b) => String(a.value.createdAt).localeCompare(String(b.value.createdAt)))
  return { lib, items, members: memberMap, closed, loans, active, handles, unreachable }
}

export const holderOf = (snap, item) => snap.active.get(item.uri)?.[0] ?? null
export const isMember = (snap, did) => !!did && (did === snap.lib.did || snap.members.has(did))
export const handleOf = (snap, did) => snap.handles.get(did) ?? did
export const openLoansOf = (snap, did) => [...snap.active.values()].flat().filter((l) => l.did === did)

// What one scan means. `me` is the signed-in DID, or null.
//   checkin     I hold a copy: return it
//   checkout    a copy is free and I may borrow: take it
//   out         every copy is out with someone else
//   not-member  a copy is free but I'm not on the member list
//   signed-out  status only
//   unknown     no item has this code
export function decide(snap, rawCode, me) {
  const code = normalizeCode(rawCode)
  const copies = snap.items.filter((i) => normalizeCode(i.value?.barcode) === code)
  if (!copies.length) return { kind: 'unknown', code }
  if (me) {
    for (const item of copies) {
      const loan = (snap.active.get(item.uri) ?? []).find((l) => l.did === me)
      if (loan) return { kind: 'checkin', item, loan }
    }
  }
  const free = copies.find((i) => !holderOf(snap, i))
  if (!me) return { kind: 'signed-out', item: free ?? copies[0], loan: free ? null : holderOf(snap, copies[0]) }
  if (!free) return { kind: 'out', item: copies[0], loan: holderOf(snap, copies[0]) }
  if (!isMember(snap, me)) return { kind: 'not-member', item: free }
  return { kind: 'checkout', item: free }
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

export function checkIn(agent, me, loan) {
  return repo(agent).putRecord({
    repo: me,
    collection: COL.loan,
    rkey: loan.rkey,
    record: { ...loan.value, returnedAt: now() },
    swapRecord: loan.cid,
  })
}

// The owner closes a loan that lives in someone else's repo.
export function checkInFor(agent, me, loan) {
  return repo(agent).createRecord({
    repo: me,
    collection: COL.checkin,
    record: { $type: COL.checkin, loan: { uri: loan.uri, cid: loan.cid }, createdAt: now() },
  })
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

export async function addMember(agent, me, snap, input) {
  const id = await resolveIdentity(input)
  if (id.did === me || snap.members.has(id.did)) return { id, existing: true }
  const record = { $type: COL.member, subject: id.did, createdAt: now() }
  if (id.handle) record.handle = id.handle
  await repo(agent).createRecord({ repo: me, collection: COL.member, record })
  return { id, existing: false }
}

export function removeMember(agent, me, member) {
  return repo(agent).deleteRecord({ repo: me, collection: COL.member, rkey: member.rkey })
}
