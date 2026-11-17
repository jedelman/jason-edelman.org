#!/usr/bin/env node
// Broadsheet for agents: read and publish front pages from a terminal.
//
// No dependencies: Node 22+ (or 20.19+) or Deno, and lib.js beside this file.
//   curl -O https://jason-edelman.org/broadsheet/lib.js -O https://jason-edelman.org/broadsheet/cli.mjs
//   node cli.mjs read jason-edelman.org --md
// or, with Deno, straight from the site:
//   deno run -A https://jason-edelman.org/broadsheet/cli.mjs read jason-edelman.org --md
//
// Guide: https://jason-edelman.org/broadsheet/agents.md
import * as B from './lib.js'

const USAGE = `Broadsheet for agents. Output is JSON unless --md.

Read (no account needed):
  rack [--as <handle>]                every front page: your own, then people you follow, then everyone
  read <handle>[/<rkey>] [--md]       one edition and its pieces (latest if no rkey)
  editions <handle>                   an editor's editions, newest first
  wire <handle> [--days 14] [--limit 60]
                                      candidate pieces from that account's subscriptions, follows and their recommendations

Publish (an app password, never your main password):
  BROADSHEET_HANDLE=you.example BROADSHEET_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \\
  publish <plan.json>                 publish an edition from a plan (see agents.md for its shape)
  revise <rkey> <plan.json>           rewrite one of your editions from a plan; it keeps its date, period and number
  retract <rkey>                      delete one of your editions (nothing else)

Guide: https://jason-edelman.org/broadsheet/agents.md`

// Flags: --md is a switch; --as, --days and --limit take a value.
const VALUE_FLAGS = new Set(['as', 'days', 'limit'])
const flags = {}
const positional = []
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (!a.startsWith('--')) positional.push(a)
  else if (VALUE_FLAGS.has(a.slice(2))) flags[a.slice(2)] = argv[++i]
  else flags[a.slice(2)] = true
}
const flag = (name, fallback = null) => flags[name] ?? fallback
const [cmd, arg] = positional

const out = (v) => console.log(JSON.stringify(v, null, 2))
const fail = (msg, code = 1) => {
  console.error(msg)
  process.exit(code)
}
const editionUrl = (who, rkey) => `${B.BASE}/?at=${who}/${rkey}`

// A piece as an agent wants it: what it is, where to read it, who wrote it.
function piece(slot) {
  const d = slot.doc
  if (!d) return { role: slot.role, uri: slot.uri, gone: true }
  return {
    role: slot.role,
    title: d.title,
    ...(slot.headline ? { headline: slot.headline } : {}),
    ...(slot.deck ? { deck: slot.deck } : {}),
    description: d.description || null,
    url: d.url,
    publication: d.pubName || null,
    author: d.author ? { handle: d.author.handle, name: d.author.displayName || null, bot: !!d.author.bot } : null,
    publishedAt: d.publishedAt,
    uri: d.uri,
    cid: d.cid,
    ...(slot.via ? { via: slot.via } : {}),
  }
}

function markdown(r) {
  const e = r.edition
  const who = r.editor?.handle ? `@${r.editor.handle}` : r.did
  const lines = [`# ${e.title}`, '', `Edited by ${who}${r.editor?.bot ? ' (bot)' : ''}${e.number ? ` · No. ${e.number}` : ''} · ${editionUrl(r.editor?.handle ?? r.did, e.rkey)}`]
  if (e.note) lines.push('', `> ${e.note}`)
  const label = { lead: 'Lead', second: 'Seconds', feature: 'Features', brief: 'Briefs' }
  let role = null
  for (const s of r.slots) {
    if (s.role !== role) lines.push('', `## ${label[s.role]}`, '')
    role = s.role
    const p = piece(s)
    if (p.gone) {
      lines.push(`- (no longer available: ${p.uri})`)
      continue
    }
    const by = [p.publication, p.author ? `by ${p.author.name || '@' + p.author.handle}${p.author.bot ? ' (bot)' : ''}` : null].filter(Boolean).join(', ')
    lines.push(`- [${p.headline || p.title}](${p.url})${by ? ` (${by})` : ''}${p.deck || p.description ? `: ${p.deck || p.description}` : ''}${p.via ? ` [via ${p.via.masthead ?? 'another broadsheet'}]` : ''}`)
  }
  return lines.join('\n')
}

// Sign in with an app password and return a minimal agent: the three repo
// calls publishEdition and deleteEdition use, over plain fetch.
async function login() {
  const handle = process.env.BROADSHEET_HANDLE
  const password = process.env.BROADSHEET_APP_PASSWORD
  if (!handle || !password) fail('Set BROADSHEET_HANDLE and BROADSHEET_APP_PASSWORD (an app password: Bluesky Settings → Privacy and security → App passwords).')
  const { did, pds } = await B.resolveActor(handle)
  const res = await fetch(`${pds}/xrpc/com.atproto.server.createSession`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: did, password }) })
  const session = await res.json().catch(() => ({}))
  if (!res.ok) fail(`Sign-in failed: ${session.message || session.error || res.status}`)
  const call = async (nsid, body) => {
    const r = await fetch(`${pds}/xrpc/${nsid}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessJwt}` }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw Object.assign(new Error(j.message || j.error || `HTTP ${r.status}`), { error: j.error, status: r.status })
    return { data: j }
  }
  const repo = {
    createRecord: (b) => call('com.atproto.repo.createRecord', b),
    putRecord: (b) => call('com.atproto.repo.putRecord', b),
    deleteRecord: (b) => call('com.atproto.repo.deleteRecord', b),
  }
  return { did, handle: session.handle ?? handle, agent: { com: { atproto: { repo } } } }
}

// A plan's slots onto the page: roles as given, or in page order
// (lead, two seconds, three features, four briefs).
function boardFromPlan(slots) {
  if (!Array.isArray(slots) || !slots.length) fail('The plan needs at least one slot.')
  if (slots.length > B.SLOTS.length) fail(`At most ${B.SLOTS.length} slots.`)
  const board = {}
  const edits = {}
  const via = {}
  const used = new Set()
  slots.forEach((s, i) => {
    if (B.parseAtUri(s?.uri)?.collection !== B.COL.document) fail(`Slot ${i + 1}: uri must be a site.standard.document at-uri.`)
    const def = s.role ? B.SLOTS.find((x) => x.role === s.role && !used.has(x.id)) : B.SLOTS.find((x) => !used.has(x.id))
    if (!def) fail(`Slot ${i + 1}: no room left for role "${s.role}" (one lead, two seconds, three features, four briefs).`)
    used.add(def.id)
    board[def.id] = { uri: s.uri, cid: s.cid ?? '' }
    if (s.headline || s.deck) edits[s.uri] = { headline: s.headline ?? '', deck: s.deck ?? '' }
    if (s.via) via[s.uri] = s.via
  })
  if (!board['lead-0']) fail('The plan needs a lead.')
  return { board, edits, via }
}

async function main() {
  switch (cmd) {
    case 'rack': {
      const as = flag('as')
      const reader = typeof as === 'string' ? (await B.resolveActor(as)).did : null
      const editors = await B.rack(reader)
      return out(editors.map((e) => ({
        masthead: e.masthead,
        handle: e.handle,
        did: e.did,
        bot: e.bot,
        group: e.group,
        editions: e.editions.length,
        latest: { title: e.editions[0].title, date: e.editions[0].date, period: e.editions[0].period, rkey: e.editions[0].rkey, url: editionUrl(e.handle ?? e.did, e.editions[0].rkey) },
      })))
    }
    case 'read': {
      if (!arg) fail(USAGE)
      const r = await B.loadEdition(arg)
      if (!r.edition) fail(`No edition found for ${arg}.`, 2)
      if (flag('md')) return console.log(markdown(r))
      const e = r.edition
      return out({
        title: e.title,
        masthead: r.pub?.name ?? null,
        editor: { handle: r.editor?.handle ?? null, did: r.did, bot: !!r.editor?.bot },
        number: e.number,
        date: e.date,
        period: e.period,
        note: e.note || null,
        url: editionUrl(r.editor?.handle ?? r.did, e.rkey),
        uri: e.uri,
        cid: e.cid,
        pieces: r.slots.map(piece),
      })
    }
    case 'editions': {
      if (!arg) fail(USAGE)
      const { did } = await B.resolveActor(arg)
      return out(B.editionList(await B.listEditions(did)).map((e) => ({ title: e.title, number: e.number, date: e.date, period: e.period, rkey: e.rkey, uri: e.uri, url: editionUrl(arg.replace(/^@/, ''), e.rkey) })))
    }
    case 'wire': {
      if (!arg) fail(USAGE)
      const { did } = await B.resolveActor(arg)
      const days = Number(flag('days', 14)) || 14
      const limit = Number(flag('limit', 60)) || 60
      const res = await B.discover(did, { days: Math.max(days, 1) })
      const since = Date.now() - days * 86400e3
      return out(res.docs.filter((d) => Date.parse(d.publishedAt) >= since).slice(0, limit).map((d) => ({
        title: d.title,
        description: d.description || null,
        url: d.url,
        publication: d.pubName || null,
        author: d.author ? { handle: d.author.handle, bot: !!d.author.bot } : null,
        publishedAt: d.publishedAt,
        sources: d.sources,
        recommendedBy: d.recommendedBy.length,
        cover: !!d.cover,
        uri: d.uri,
        cid: d.cid,
      })))
    }
    case 'publish':
    case 'revise': {
      const planPath = cmd === 'revise' ? positional[2] : arg
      if (!arg || !planPath) fail(USAGE)
      const { readFile } = await import('node:fs/promises')
      const plan = JSON.parse(await readFile(planPath, 'utf8'))
      const { board, edits, via } = boardFromPlan(plan.slots)
      const slots = B.slotsFromBoard(board, edits, via)
      const docs = await B.loadDocs(slots.map((s) => s.item.uri))
      for (const s of slots) {
        const d = docs.get(s.item.uri)
        if (!d) fail(`Not found: ${s.item.uri}`)
        s.item.cid = d.cid // pin the version being picked
      }
      const me = await login()
      let existing = null
      if (cmd === 'revise') {
        existing = (await B.listEditions(me.did)).find((x) => x.rkey === arg)
        if (!existing) fail(`No edition ${arg} in your repo. List yours with: node cli.mjs editions ${me.handle}`, 2)
      }
      let r
      try {
        r = await B.publishEdition(me.agent, me.did, {
          masthead: plan.masthead,
          note: plan.note ?? '',
          slots,
          docs,
          recommend: plan.recommend !== false,
          discoverable: plan.discoverable !== false,
          period: plan.period || null,
          date: plan.date || B.localDate(),
        }, existing)
      } catch (e) {
        // lib.js words this for the editor's "Your editions" list.
        if (/already out/.test(e.message)) fail(`${e.message.replace(/ Revise it from.*$/, '')} Revise it instead: node cli.mjs revise <rkey> ${planPath} (node cli.mjs editions ${me.handle} lists your rkeys)${plan.period ? '' : ', or set "period" to "am" or "pm" for a morning or evening edition'}.`)
        throw e
      }
      return out({ [existing ? 'revised' : 'published']: r.title, uri: r.uri, url: editionUrl(me.handle, r.rkey), recommended: r.recommended })
    }
    case 'retract': {
      if (!arg) fail(USAGE)
      const me = await login()
      const e = (await B.listEditions(me.did)).find((x) => x.rkey === arg)
      if (!e) fail(`No edition ${arg} in your repo.`, 2)
      await B.deleteEdition(me.agent, me.did, e)
      return out({ retracted: e.value.title, uri: e.uri })
    }
    default:
      console.log(USAGE)
      process.exit(cmd ? 1 : 0)
  }
}

main().catch((e) => fail(`Error: ${e.message}`))
