// Tests for the morning briefing (src/briefing.js), with no network: compose, the decision, the records, the guard.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyDiff } from '@lichen-wiki/client/diff'
import { AGENCY, SLUG, WIKI, body, checkedByCount, compose, contentProblem, dayOf, decide, plan, runBriefing } from '../src/briefing.js'

const NOW = Date.parse('2026-11-27T20:30:00Z')
const TOMORROW = NOW + 86_400_000
const data = {
  wiki: { ok: { underChecked: [{ slug: 'a-note', title: 'A note', checks: 1, updatedAt: '2026-11-25T19:00:00Z' }] } },
  autonomist: { ok: { openChecks: [{ claim: 'A public claim about a council vote.', verdict: 'disputed', at: '2026-11-26T10:00:00Z', uri: 'at://x/y/z' }], dream: { at: '2026-11-27T07:07:00Z', questions: ['Who decides on your block?'] }, waiting: [] } },
  scout: { ok: { latest: { title: 'Disclosure', at: '2026-11-18T01:49:15Z' } } },
}

test('compose is deterministic and says what it read, section by section', () => {
  const a = compose(data, NOW)
  assert.equal(a, compose(data, NOW))
  assert.equal(dayOf(a), '2026-11-27')
  assert.match(a, /^# Morning briefing/)
  assert.match(a, /\[\[A note\]\]: 1 Checked by line, last changed 2026-11-25/)
  assert.match(a, /- disputed \(2026-11-26\): "A public claim about a council vote."/)
  assert.match(a, /Questions its latest dream asked \(2026-11-27\):/)
  assert.match(a, /Every wiki write it made is showing on Lichen/)
  assert.match(a, /Its latest page: "Disclosure", 2026-11-18/)
  assert.match(a, /## Siren\n\n- Not asked for its terms yet/)
  assert.doesNotMatch(a, /ago/)
})

test('a section that cannot be read says so; it never goes quiet', () => {
  const t = compose({ ...data, autonomist: { error: 'org.jason-edelman.autonomist.log on pds.autonomist.jason-edelman.org answered 502' } }, NOW)
  assert.match(t, /## autonomist\n\n- Couldn't read this section today: .*502/)
})

test('the day line is the only difference between two days with the same data', () => {
  const a = compose(data, NOW)
  const b = compose(data, TOMORROW)
  assert.notEqual(a, b)
  assert.equal(body(a), body(b))
})

test('decide: create, hold, once a day, unchanged, changed', () => {
  const text = compose(data, NOW)
  assert.deepEqual(decide({ text, now: NOW, head: { absent: true }, ownNotes: [] }), { create: true })
  const held = decide({ text, now: NOW, head: { absent: true }, ownNotes: [{ value: { slug: SLUG, wikiRef: WIKI } }] })
  assert.ok(held.hold, 'a note the Agency holds but Lichen does not show is never created twice')
  const head = { note: { uri: `at://${AGENCY}/wiki.lichen.note/3n3abc`, latestRevisionUri: `at://${AGENCY}/wiki.lichen.noteRevision/3n3abd`, title: 'Morning briefing', content: text } }
  assert.match(decide({ text, now: NOW, head, ownNotes: [] }).skip, /already written/)
  const tomorrowSame = compose(data, TOMORROW)
  assert.match(decide({ text: tomorrowSame, now: TOMORROW, head, ownNotes: [] }).skip, /nothing has changed/)
  const changed = compose({ ...data, scout: { ok: { latest: null } } }, TOMORROW)
  assert.equal(decide({ text: changed, now: TOMORROW, head, ownNotes: [] }).edit, head.note)
  assert.match(decide({ text, now: NOW, head: { error: 'Lichen answered 500' }, ownNotes: [] }).skip, /can't be read/)
})

test('decide refuses text with an email, a phone or a non-member account', () => {
  const base = compose(data, NOW)
  for (const bad of ['write to someone@example.com', 'call 757-555-0123', 'see did:plc:someoneelsesomeoneelse1', 'as @stranger.bsky.social said']) {
    assert.match(decide({ text: `${base}\n${bad}`, now: NOW, head: { absent: true }, ownNotes: [] }).skip, /refused before writing/, bad)
  }
  assert.equal(contentProblem('Members @scout-two.jason-edelman.org and did:plc:kmswr7d5c55rc4ot2dbn6sfq, a $219,000 contract voted 4-0.'), null)
})

test('plan: a new note is three creates; an edit is a revision on the head plus the snapshot', () => {
  const text = compose(data, NOW)
  const c = plan({ decision: { create: true }, text, now: NOW, haveSnapshot: false })
  assert.deepEqual(c.ops.map((o) => [o.$type.split('#')[1], o.collection]), [['create', 'wiki.lichen.note'], ['create', 'wiki.lichen.noteRevision'], ['create', 'wiki.lichen.noteSnapshot']])
  assert.equal(c.ops[0].value.slug, SLUG)
  assert.equal(c.ops[0].value.wikiRef, WIKI)
  assert.equal(applyDiff('', c.ops[1].value.diff), text)
  const head = { uri: `at://${AGENCY}/wiki.lichen.note/3n3abc`, latestRevisionUri: `at://${AGENCY}/wiki.lichen.noteRevision/3n3abd`, title: 'Morning briefing', content: text }
  const next = compose({ ...data, scout: { ok: { latest: null } } }, TOMORROW)
  const e = plan({ decision: { edit: head }, text: next, now: TOMORROW, haveSnapshot: true })
  assert.deepEqual(e.ops.map((o) => [o.$type.split('#')[1], o.collection]), [['create', 'wiki.lichen.noteRevision'], ['update', 'wiki.lichen.noteSnapshot']])
  assert.equal(e.ops[0].value.parentRevision, head.latestRevisionUri)
  assert.equal(applyDiff(text, e.ops[0].value.diff), next)
  assert.equal(e.ops[1].rkey, '3n3abc')
})

test('checkedByCount counts list lines under the heading, and is null with no heading', () => {
  assert.equal(checkedByCount('# T\n\nbody\n\n## Checked by\n- Claude, 2026-11-25\n- Scout, 2026-11-25\n\n## Next\n- x'), 2)
  assert.equal(checkedByCount('# T\n\n## Checked by\n\n'), 0)
  assert.equal(checkedByCount('# T\n\nno section'), null)
})

test('a dry run reads and decides but never signs in or writes', async () => {
  const calls = []
  const fakeFetch = async (url, init = {}) => {
    const u = new URL(typeof url === 'string' ? url : url.url)
    calls.push(`${init.method || (url.method ?? 'GET')} ${u.host}${u.pathname}`)
    const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s })
    if (u.pathname.endsWith('wiki.lichen.listNotes')) return json({ notes: [] })
    if (u.pathname.endsWith('wiki.lichen.getNote')) return json({ error: 'NotFound', message: 'Note not found' }, 400)
    if (u.host === 'plc.directory') return json({ service: [{ id: '#atproto_pds', serviceEndpoint: 'https://scout.pds' }] })
    if (u.pathname.endsWith('com.atproto.repo.listRecords')) return json({ records: [] })
    return json({ error: 'unexpected' }, 404)
  }
  const r = await runBriefing({ HOSTNAME: 'pds.agency.jason-edelman.org', PDS_PASSWORD: 'x' }, { fetch: fakeFetch, pdsFetch: fakeFetch, now: NOW, dry: true, log: () => {} })
  assert.equal(r.written, false)
  assert.ok(r.decision.create)
  assert.ok(!calls.some((c) => /createSession|applyWrites/.test(c)), calls.join('\n'))
})
