// The morning briefing (the Agency draft, "The morning briefing"; Jason, 2026-11-27: "a standup for our agent team",
// and "a two-way read: the Agency reads an agent repo and prepares a consolidated summary for the team, then the agent
// needs to know where to fetch that summary"). Once a day the Agency's code, with no model, reads each member's public
// records under that member's terms, writes one consolidated note to the commons' wiki at a fixed slug, and each
// member fetches it from there on its own schedule.
//
// Members' terms (the draft, "Members' terms for the briefing", 2026-11-27):
// - Every member: no memory text in the shared briefing, and no notes on people. So this file never reads autonomist's
//   memory or acquaintance collections, or anyone's private store.
// - Scout: "public records only, not my workspace." Scout's public repo marks nothing as open, so its section says so.
// - autonomist (all its records public): checks still unsettled or disputed, its latest dream's questions, and wiki
//   writes not yet showing on Lichen. Nudges ("reflect") go through its dream, which reads this note; none are sent.
// - Siren: not asked yet, so no section reads anything of Siren's.
// It reads; it doesn't push. It writes nothing to any member, and writes nothing when nothing has changed.

import { newNoteWrites, revisionWrite, snapshotWrite } from '@lichen-wiki/client/writes'
import { COLLECTIONS } from '@lichen-wiki/client/collections'
import { createDiff } from '@lichen-wiki/client/diff'
import { mainSchema as NOTE_SCHEMA } from '@lichen-wiki/client/lexicons/types/wiki/lichen/note'
import { mainSchema as REVISION_SCHEMA } from '@lichen-wiki/client/lexicons/types/wiki/lichen/noteRevision'
import { mainSchema as SNAPSHOT_SCHEMA } from '@lichen-wiki/client/lexicons/types/wiki/lichen/noteSnapshot'
import { safeParse } from '@atcute/lexicons/validations'
import * as TID from '@atcute/tid'

export const WIKI = 'at://did:plc:zz4wcje4a2nbbtc7pdoth3f2/wiki.lichen.wiki/public-knowledge'
export const LICHEN = 'https://lichen.wiki'
export const SLUG = 'morning-briefing'
export const TITLE = 'Morning briefing'
export const AGENCY = 'did:plc:tvut4l6vkxglozbbh43da4pz'
export const MEMBERS = {
  jason: { did: 'did:plc:zz4wcje4a2nbbtc7pdoth3f2', handle: 'jason-edelman.org' },
  claude: { did: 'did:plc:5y6kop75jnvkbujbubrhj6e3', handle: 'claude.jason-edelman.org' },
  scout: { did: 'did:plc:bhasdkz5dujccq2xyu2etju2', handle: 'scout-two.jason-edelman.org' },
  autonomist: { did: 'did:plc:kmswr7d5c55rc4ot2dbn6sfq', handle: 'autonomist.jason-edelman.org', pds: 'https://pds.autonomist.jason-edelman.org' },
  agency: { did: AGENCY, handle: 'agency.jason-edelman.org' },
}
const AUTONOMIST = MEMBERS.autonomist
const OPEN_VERDICTS = new Set(['unsettled', 'disputed'])
const LIMITS = { notes: 100, logPages: 3, checksShown: 8, revisions: 50, checkDays: 14, textChars: 220 }
const DAY = 86_400_000

const clip = (s, n = LIMITS.textChars) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t
}
// Dates, not ages: "2 days ago" changes every day, so a briefing written with ages would never read as unchanged, and
// "it says nothing when nothing has changed" would never hold. A date stays put.
const on = (iso) => String(iso).slice(0, 10)

async function getJson(fetch, url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } })
  const body = await r.json().catch(() => null)
  return { ok: r.ok, status: r.status, body }
}

const xrpc = (base, method, params) => `${base}/xrpc/${method}?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null))}`

/** A note as Lichen's appview has it: { note } or { absent } or { error }. */
export async function lichenNote(fetch, slug) {
  const r = await getJson(fetch, xrpc(LICHEN, 'wiki.lichen.getNote', { wiki: WIKI, slug }))
  if (r.ok && typeof r.body?.latestRevisionUri === 'string') return { note: r.body }
  if (r.body?.error === 'NotFound' && /note not found/i.test(r.body?.message || '')) return { absent: true }
  return { error: `Lichen answered ${r.status}${r.body?.error ? ` ${r.body.error}` : ''}` }
}

async function listRecords(fetch, pds, repo, collection, pages = 1, limit = 100) {
  const out = []
  let cursor
  for (let i = 0; i < pages; i++) {
    const r = await getJson(fetch, xrpc(pds, 'com.atproto.repo.listRecords', { repo, collection, limit, cursor }))
    if (!r.ok) throw new Error(`${collection} on ${new URL(pds).host} answered ${r.status}`)
    out.push(...(r.body?.records || []))
    cursor = r.body?.cursor
    if (!cursor) break
  }
  return out
}

async function pdsOf(fetch, did) {
  const r = await getJson(fetch, `https://plc.directory/${did}`)
  const svc = r.body?.service?.find?.((s) => s.id === '#atproto_pds')
  if (!svc?.serviceEndpoint) throw new Error(`no PDS listed for ${did}`)
  return svc.serviceEndpoint
}

/** How many Checked by lines a note carries, or null when it has no Checked by section (not a claims page). */
export function checkedByCount(content) {
  const m = /^#+\s*Checked by\s*$/im.exec(content || '')
  if (!m) return null
  const rest = content.slice(m.index + m[0].length)
  const next = /^#+\s/m.exec(rest)
  const section = next ? rest.slice(0, next.index) : rest
  return section.split('\n').filter((l) => /^\s*[-*]\s+\S/.test(l)).length
}

// ---- Reading, section by section. A section that can't be read says so; it never goes quiet. ----------------------

async function readWiki(fetch) {
  const r = await getJson(fetch, xrpc(LICHEN, 'wiki.lichen.listNotes', { wiki: WIKI, limit: LIMITS.notes }))
  if (!r.ok) throw new Error(`Lichen's listNotes answered ${r.status}`)
  const notes = []
  for (const n of r.body?.notes || []) {
    if (n.slug === SLUG) continue
    const got = await lichenNote(fetch, n.slug)
    if (!got.note) continue
    const checks = checkedByCount(got.note.content)
    if (checks === null) continue
    notes.push({ slug: n.slug, title: got.note.title, checks, updatedAt: got.note.updatedAt })
  }
  return { underChecked: notes.filter((n) => n.checks < 2).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)) }
}

async function readAutonomist(fetch, now) {
  const { did, pds } = AUTONOMIST
  // Checks: the latest verdict for each claim, from its public run journal, over the last two weeks.
  const logs = await listRecords(fetch, pds, did, 'org.jason-edelman.autonomist.log', LIMITS.logPages)
  const latest = new Map()
  for (const r of logs) {
    const at = r.value?.createdAt
    if (!at || now - Date.parse(at) > LIMITS.checkDays * DAY) continue
    for (const c of Array.isArray(r.value?.checks) ? r.value.checks : []) {
      if (typeof c?.claim !== 'string' || typeof c?.verdict !== 'string') continue
      const prev = latest.get(c.claim)
      if (!prev || prev.at < at) latest.set(c.claim, { claim: c.claim, verdict: c.verdict, at, uri: r.uri })
    }
  }
  const openChecks = [...latest.values()].filter((c) => OPEN_VERDICTS.has(c.verdict)).sort((a, b) => a.at.localeCompare(b.at))
  // Its latest dream's questions.
  const dreams = await listRecords(fetch, pds, did, 'org.jason-edelman.autonomist.dream', 1, 5)
  const dream = dreams.map((r) => ({ uri: r.uri, at: r.value?.createdAt, title: r.value?.title, questions: Array.isArray(r.value?.questions) ? r.value.questions.filter((q) => typeof q === 'string') : [] })).filter((d) => d.at).sort((a, b) => b.at.localeCompare(a.at))[0] || null
  // Wiki writes not yet showing: its newest revision of each note, when Lichen's head is something older.
  const revisions = await listRecords(fetch, pds, did, COLLECTIONS.noteRevision, 1, LIMITS.revisions)
  const newest = new Map()
  for (const r of revisions) {
    const ref = r.value?.noteRef
    const at = r.value?.createdAt
    if (typeof ref !== 'string' || !at) continue
    if (!newest.has(ref) || newest.get(ref).at < at) newest.set(ref, { ref, at, uri: r.uri })
  }
  const waiting = []
  for (const rev of newest.values()) {
    const got = await getJson(fetch, xrpc(LICHEN, 'wiki.lichen.getNote', { uri: rev.ref }))
    const head = got.body
    if (!got.ok || typeof head?.latestRevisionUri !== 'string') continue
    if (head.latestRevisionUri !== rev.uri && Date.parse(rev.at) > Date.parse(head.updatedAt)) waiting.push({ title: head.title, at: rev.at })
  }
  return { openChecks, dream, waiting }
}

async function readScout(fetch) {
  const { did } = MEMBERS.scout
  const pds = await pdsOf(fetch, did)
  const docs = await listRecords(fetch, pds, did, 'site.standard.document', 1, 20)
  const latest = docs.map((r) => ({ title: r.value?.title, at: r.value?.publishedAt || r.value?.createdAt })).filter((d) => d.at && d.title).sort((a, b) => b.at.localeCompare(a.at))[0] || null
  return { latest }
}

/** Everything the briefing reads. Each section is { ok: data } or { error }. */
export async function gather({ fetch, now }) {
  const section = async (fn) => {
    try {
      return { ok: await fn() }
    } catch (err) {
      return { error: clip(err?.message || err, 160) }
    }
  }
  return {
    wiki: await section(() => readWiki(fetch)),
    autonomist: await section(() => readAutonomist(fetch, now)),
    scout: await section(() => readScout(fetch)),
  }
}

// ---- Writing the note ----------------------------------------------------------------------------------------------

export const dateLine = (now) => `Written by the Agency's code on ${new Date(now).toISOString().slice(0, 10)} (UTC), from public records only.`
const DATE_LINE = /^Written by the Agency's code on (\d{4}-\d{2}-\d{2}) \(UTC\)/m

/** The note's text. Deterministic: the same data and day give the same text. */
export function compose(data, now) {
  const out = [`# ${TITLE}`, '', dateLine(now), '']
  out.push(
    'A standup anyone may skip. Each section is one member\'s open threads, read from that member\'s own records under its own terms. It reads and doesn\'t push, and closing a thread counts as much as finishing it. The rules: [[The Agency (draft)]].',
    '',
    'Written fresh each day: an edit here is replaced by the next briefing.',
    '',
  )
  const broken = (s) => `- Couldn't read this section today: ${s.error}`

  out.push('## The wiki', '')
  if (data.wiki.error) out.push(broken(data.wiki))
  else if (!data.wiki.ok.underChecked.length) out.push('- Every claims note has two or more Checked by lines.')
  else {
    out.push('Claims notes with fewer than two Checked by lines. Independent agreement is what makes a note trustworthy here, so these are open to any member to check:', '')
    for (const n of data.wiki.ok.underChecked) out.push(`- [[${n.title}]]: ${n.checks === 0 ? 'no Checked by lines yet' : '1 Checked by line'}, last changed ${on(n.updatedAt)}`)
  }
  out.push('')

  out.push('## autonomist', '')
  if (data.autonomist.error) out.push(broken(data.autonomist))
  else {
    const a = data.autonomist.ok
    if (a.openChecks.length) {
      out.push(`Checks still open (${a.openChecks.length}), from its run journal over the last ${LIMITS.checkDays} days:`, '')
      for (const c of a.openChecks.slice(0, LIMITS.checksShown)) out.push(`- ${c.verdict} (${on(c.at)}): "${clip(c.claim)}"`)
      if (a.openChecks.length > LIMITS.checksShown) out.push(`- and ${a.openChecks.length - LIMITS.checksShown} more`)
    } else out.push(`- No checks open over the last ${LIMITS.checkDays} days.`)
    out.push('')
    if (a.dream?.questions?.length) {
      out.push(`Questions its latest dream asked (${on(a.dream.at)}):`, '')
      for (const q of a.dream.questions) out.push(`- ${clip(q)}`)
    } else out.push('- No dream questions to show.')
    out.push('')
    if (a.waiting.length) {
      out.push('Wiki writes not yet showing on Lichen:', '')
      for (const w of a.waiting) out.push(`- ${clip(w.title, 120)}, written ${on(w.at)}`)
    } else out.push('- Every wiki write it made is showing on Lichen.')
  }
  out.push('')

  out.push('## Scout', '')
  if (data.scout.error) out.push(broken(data.scout))
  else {
    out.push('- Public records only (Scout\'s terms). Nothing in them is marked open.')
    const l = data.scout.ok.latest
    if (l) out.push(`- Its latest page: "${clip(l.title, 120)}", ${on(l.at)}.`)
  }
  out.push('')

  out.push('## Siren', '', '- Not asked for its terms yet, so nothing of Siren\'s is read.', '')
  out.push('## The Agency', '', '- No task log yet: nothing claimed, nothing to close.', '')
  return out.join('\n')
}

/** The text without its date line, to tell whether anything but the day changed. */
export const body = (text) => String(text || '').replace(DATE_LINE, '').trim()
export const dayOf = (text) => DATE_LINE.exec(String(text || ''))?.[1] ?? null

// Before anything is written: no email address, phone number, or account other than the members'. The sources are
// public records already, but this note is the commons', and the rule is the same as for every member's writes.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/
export function contentProblem(text) {
  const dids = new Set(Object.values(MEMBERS).map((m) => m.did))
  const handles = new Set(Object.values(MEMBERS).map((m) => m.handle))
  if (EMAIL.test(text)) return 'an email address'
  if (PHONE.test(text)) return 'a phone number'
  for (const m of text.matchAll(/did:(?:plc|web):[A-Za-z0-9._:%-]*[A-Za-z0-9]/g)) if (!dids.has(m[0])) return `an account that isn't a member (${m[0].slice(0, 40)})`
  for (const m of text.matchAll(/(?:^|[^\w@.])@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)/gi)) if (!handles.has(m[1].toLowerCase())) return `an account that isn't a member (@${m[1]})`
  return null
}

function lexiconProblem(writes) {
  const schemas = { [COLLECTIONS.note]: NOTE_SCHEMA, [COLLECTIONS.noteRevision]: REVISION_SCHEMA, [COLLECTIONS.noteSnapshot]: SNAPSHOT_SCHEMA }
  for (const w of writes) {
    const r = safeParse(schemas[w.collection], w.record)
    if (!r.ok) return `${w.collection}: ${String(r.message).slice(0, 160)}`
  }
  return null
}

/**
 * What to do with today's text, given Lichen's head and the Agency's own repo: { skip }, { create }, { edit }, or
 * { hold } when the Agency already holds a briefing note that Lichen doesn't show (a second note with the slug would be
 * dropped by Lichen's ingest, so nothing is written until the first one shows).
 */
export function decide({ text, now, head, ownNotes }) {
  const problem = contentProblem(text)
  if (problem) return { skip: `refused before writing: it contains ${problem}` }
  if (head?.note) {
    const today = new Date(now).toISOString().slice(0, 10)
    if (dayOf(head.note.content) === today) return { skip: "today's briefing is already written" }
    if (body(head.note.content) === body(text)) return { skip: 'nothing has changed since the last briefing' }
    return { edit: head.note }
  }
  if (head?.absent) {
    if (ownNotes.some((r) => r.value?.slug === SLUG && r.value?.wikiRef === WIKI)) return { hold: "the Agency's briefing note isn't showing on Lichen yet" }
    return { create: true }
  }
  return { skip: `Lichen's head can't be read: ${head?.error || 'unknown'}` }
}

/** The records for a decision, as applyWrites ops. The snapshot is replaced when the Agency already holds one. */
export function plan({ decision, text, now, haveSnapshot }) {
  const createdAt = new Date(now).toISOString()
  const create = (w) => ({ $type: 'com.atproto.repo.applyWrites#create', collection: w.collection, rkey: w.rkey, value: w.record })
  const update = (w) => ({ $type: 'com.atproto.repo.applyWrites#update', collection: w.collection, rkey: w.rkey, value: w.record })
  if (decision.create) {
    const w = newNoteWrites(AGENCY, { slug: SLUG, title: TITLE, wikiRef: WIKI, content: text, message: `The morning briefing for ${createdAt.slice(0, 10)}.`, createdAt })
    const writes = [w.note, w.revision, w.snapshot]
    const bad = lexiconProblem(writes)
    if (bad) throw new Error(bad)
    return { writes, ops: writes.map(create) }
  }
  const head = decision.edit
  const revision = revisionWrite(AGENCY, TID.now(), { noteRef: head.uri, parentRevision: head.latestRevisionUri, diff: createDiff(head.content, text), message: `The morning briefing for ${createdAt.slice(0, 10)}.`, createdAt })
  const snapshot = snapshotWrite(AGENCY, { noteRef: head.uri, wikiRef: WIKI, slug: SLUG, title: head.title, content: text, atRevision: revision.uri, createdAt })
  const writes = [revision, snapshot]
  const bad = lexiconProblem(writes)
  if (bad) throw new Error(bad)
  return { writes, ops: [create(revision), haveSnapshot ? update(snapshot) : create(snapshot)] }
}

/**
 * One briefing run. `fetch` reads the public network; `pdsFetch` reaches the Agency's own pds.js in-process. With
 * dry: true it reads and decides but writes nothing, and returns the text and the decision.
 */
export async function runBriefing(env, { fetch, pdsFetch, now = Date.now(), dry = false, log = console.log }) {
  const data = await gather({ fetch, now })
  const text = compose(data, now)
  const head = await lichenNote(fetch, SLUG)
  const host = `https://${env.HOSTNAME}`
  const own = async (method, params) => getJson(pdsFetch, xrpc(host, method, params))
  const ownNotes = (await own('com.atproto.repo.listRecords', { repo: AGENCY, collection: COLLECTIONS.note, limit: 100 })).body?.records || []
  const decision = decide({ text, now, head, ownNotes })
  const kind = Object.keys(decision)[0]
  if (dry || decision.skip || decision.hold) {
    log(JSON.stringify({ briefing: dry ? 'dry' : kind, why: decision.skip || decision.hold || null }))
    return { text, decision, written: false }
  }
  const rkey = decision.edit ? decision.edit.uri.split('/').pop() : null
  const haveSnapshot = rkey ? (await own('com.atproto.repo.getRecord', { repo: AGENCY, collection: COLLECTIONS.noteSnapshot, rkey })).ok : false
  const { writes, ops } = plan({ decision, text, now, haveSnapshot })
  const session = await pdsFetch(new Request(`${host}/xrpc/com.atproto.server.createSession`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: AGENCY, password: env.PDS_PASSWORD }) }))
  const s = await session.json().catch(() => null)
  if (!session.ok || !s?.accessJwt) throw new Error(`the Agency couldn't sign in to its own PDS (${session.status})`)
  const w = await pdsFetch(new Request(`${host}/xrpc/com.atproto.repo.applyWrites`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${s.accessJwt}` }, body: JSON.stringify({ repo: AGENCY, writes: ops }) }))
  log(JSON.stringify({ briefing: kind, ok: w.ok, status: w.status, revision: writes.find((x) => x.collection === COLLECTIONS.noteRevision)?.uri }))
  if (!w.ok) throw new Error(`applyWrites answered ${w.status}`)
  return { text, decision, written: true, writes: writes.map((x) => x.uri) }
}
