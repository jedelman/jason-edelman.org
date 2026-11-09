// The builder: a live front page with slots, and the wire of candidates.
import { BrowserOAuthClient } from '../../library/vendor/oauth-client-browser.js'
import * as B from '../lib.js'
import { renderPaper, el, fmtDate } from '../render.js'
import { attachTypeahead } from '../typeahead.js'

const API = '../../library/vendor/atproto-api.js'
const POOL_TTL = 10 * 60e3
const WINDOWS = [
  { days: 7, label: 'week' },
  { days: 14, label: '2 weeks' },
  { days: 45, label: '45 days' },
]
const SOURCE_LABELS = { all: 'all', subscribed: 'subscriptions', followed: 'following', recommended: 'recommended', added: 'added', own: 'yours' }

const state = {
  client: null, session: null, agent: null, me: null, myHandle: null,
  reader: null, readerHandle: null, // whose follows feed the wire
  docs: [], byUri: new Map(), loading: true,
  q: '', source: 'all', days: 14,
  board: {}, edits: {}, masthead: '', note: '', recommend: true,
  editing: null, // an existing edition being revised
  editingSlot: null,
  editions: [],
}

const $ = (id) => document.getElementById(id)
const store = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem(k))
    } catch {
      return null
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v))
    } catch {}
  },
  del(k) {
    try {
      localStorage.removeItem(k)
    } catch {}
  },
}
function setStatus(msg, tone = '') {
  $('status').textContent = msg
  $('status').dataset.tone = tone
}

// ── Auth ─────────────────────────────────────────────────────────────────

async function initAuth() {
  let clientId = new URL('../client-metadata.json', import.meta.url).href
  if (['127.0.0.1', '[::1]', 'localhost'].includes(location.hostname)) {
    const host = location.hostname === 'localhost' ? '127.0.0.1' : location.hostname
    const redirect = `http://${host}:${location.port}${location.pathname}`
    clientId = `http://localhost?redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(B.SCOPE)}`
  }
  state.client = await BrowserOAuthClient.load({
    clientId,
    handleResolver: B.HANDLE_RESOLVER,
    onSessionDeleted: (sub) => {
      if (state.me === sub) setSession(null)
    },
  })
  const r = await state.client.init()
  return r?.session ?? null
}

let Agent
async function setSession(session) {
  if (session) Agent ??= (await import(API)).Agent
  state.session = session
  state.agent = session ? new Agent(session) : null
  state.me = session?.did ?? null
  state.myHandle = null
  if (session) {
    B.profiles([session.did]).then((m) => ((state.myHandle = m.get(session.did)?.handle ?? null), renderAccount())).catch(() => {})
  }
  renderAccount()
}

function renderAccount() {
  const box = $('account')
  if (state.me) {
    box.replaceChildren(
      el('span', { class: 'meta' }, 'Signed in as ', el('strong', {}, '@' + (state.myHandle ?? state.me))),
      el('button', { type: 'button', class: 'quiet', onclick: signOut }, 'Sign out'),
    )
  } else {
    const input = el('input', { name: 'handle', placeholder: 'your.handle', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Your handle' })
    box.replaceChildren(el('form', { onsubmit: (e) => (e.preventDefault(), signIn(input.value)) }, input, el('button', { type: 'submit', class: 'primary' }, 'Sign in')))
    attachTypeahead(input, (h) => signIn(h))
  }
}

async function signIn(handle) {
  const h = String(handle ?? '').trim().replace(/^@/, '')
  if (!h || !state.client) return
  saveDraft()
  try {
    await state.client.signIn(h) // redirects away; resolves only if the person comes back
  } catch (err) {
    setStatus(`Sign-in failed: ${err.message}`, 'bad')
  }
}

async function signOut() {
  const s = state.session
  await setSession(null)
  try {
    await s?.signOut()
  } catch {}
  location.reload()
}

// ── Drafts ───────────────────────────────────────────────────────────────

const draftKey = () => `broadsheet:draft:${state.me ?? 'anon'}`
function saveDraft() {
  store.set(draftKey(), { masthead: state.masthead, note: state.note, board: state.board, edits: state.edits, recommend: state.recommend, editing: state.editing?.rkey ?? null })
}
function restoreDraft() {
  const d = store.get(draftKey())
  if (!d) return false
  Object.assign(state, { masthead: d.masthead ?? '', note: d.note ?? '', board: d.board ?? {}, edits: d.edits ?? {}, recommend: d.recommend ?? true })
  return d.editing ?? null
}

// ── The wire ─────────────────────────────────────────────────────────────

function acceptPool(docs) {
  state.docs = docs
  for (const d of docs) state.byUri.set(d.uri, d)
  renderWire()
  renderPaperNow()
}

async function loadWire({ fresh = false } = {}) {
  const key = `broadsheet:pool:${state.reader}`
  const cached = store.get(key)
  if (!fresh && cached && Date.now() - cached.at < POOL_TTL) {
    state.loading = false
    acceptPool(cached.docs)
    $('wire-status').textContent = `Read ${Math.round((Date.now() - cached.at) / 60e3)} min ago. `
    $('wire-status').append(el('button', { type: 'button', class: 'quiet', style: { minHeight: '0', padding: '0' }, onclick: () => loadWire({ fresh: true }) }, 'Refresh'))
    return
  }
  state.loading = true
  try {
    const res = await B.discover(state.reader, {
      days: 45,
      onUpdate: (p) => acceptPool(p.docs),
      onStatus: (s) => s && ($('wire-status').textContent = s),
    })
    store.set(key, { at: Date.now(), docs: res.docs })
    $('wire-status').textContent = res.errors ? `${res.errors} repo${res.errors === 1 ? '' : 's'} couldn't be read.` : 'Up to date.'
  } catch (e) {
    console.error(e)
    $('wire-status').textContent = `Couldn't read the wire: ${e.message}`
  }
  state.loading = false
  renderWire()
}

const addedKey = () => `broadsheet:added:${state.reader}`
async function loadAdded() {
  for (const h of store.get(addedKey()) ?? []) {
    try {
      const docs = await B.writerDocs(h, { days: 45 })
      for (const d of docs) {
        const have = state.byUri.get(d.uri)
        if (have) have.sources = [...new Set([...have.sources, 'added'])]
      }
      acceptPool(B.rank([...state.docs, ...docs.filter((d) => !state.docs.some((x) => x.uri === d.uri))]))
    } catch {}
  }
}

function visibleDocs() {
  const since = Date.now() - state.days * 86400e3
  let docs = state.docs.filter((d) => Date.parse(d.publishedAt) >= since)
  if (state.source !== 'all') docs = docs.filter((d) => d.sources.includes(state.source))
  return B.search(docs, state.q)
}

const onPage = () => new Set(Object.values(state.board).filter(Boolean).map((b) => b.uri))

function renderWire() {
  const since = Date.now() - state.days * 86400e3
  const inWindow = state.docs.filter((d) => Date.parse(d.publishedAt) >= since)
  const counts = { all: inWindow.length }
  for (const d of inWindow) for (const s of d.sources) counts[s] = (counts[s] ?? 0) + 1
  $('sources').replaceChildren(
    ...Object.keys(SOURCE_LABELS)
      .filter((s) => s === 'all' || counts[s])
      .map((s) =>
        el('button', { type: 'button', class: 'chip', 'aria-pressed': String(state.source === s), onclick: () => ((state.source = s), renderWire()) }, SOURCE_LABELS[s], el('span', { class: 'n' }, String(counts[s] ?? 0))),
      ),
  )
  $('windows').replaceChildren(...WINDOWS.map((w) => el('button', { type: 'button', class: 'chip', 'aria-pressed': String(state.days === w.days), onclick: () => ((state.days = w.days), renderWire()) }, w.label)))
  const docs = visibleDocs()
  $('wire-count').textContent = String(docs.length)
  const used = onPage()
  const list = $('wire')
  if (!docs.length) {
    list.replaceChildren(el('li', { class: 'wire-empty' }, state.loading ? 'Reading…' : state.q ? 'Nothing matches that search.' : 'Nothing published in this window. Try a wider one.'))
    return
  }
  list.replaceChildren(...docs.slice(0, 300).map((d) => card(d, used.has(d.uri))))
}

function card(d, used) {
  const badges = []
  if (d.sources.includes('subscribed')) badges.push(el('span', { class: 'badge sub' }, 'subscribed'))
  if (d.recommendedBy.length) badges.push(el('span', { class: 'badge' }, `recommended by ${d.recommendedBy.length}`))
  if (d.sources.includes('own')) badges.push(el('span', { class: 'badge sub' }, 'yours'))
  if (d.sources.includes('added')) badges.push(el('span', { class: 'badge sub' }, 'added'))
  const node = el(
    'li',
    { class: `card${used ? ' used' : ''}`, draggable: 'true', 'data-uri': d.uri },
    el('div', { class: 'card-meta' }, d.pub?.icon ? el('img', { src: d.pub.icon.thumb, alt: '', loading: 'lazy' }) : null, el('span', { class: 'pub' }, d.pubName || '(no publication)'), el('span', {}, '· ' + fmtDate(d.publishedAt))),
    el('h3', {}, d.title),
    d.description ? el('p', {}, d.description) : null,
    d.cover ? el('img', { class: 'thumb', src: d.cover.thumb, alt: '', loading: 'lazy' }) : null,
    el(
      'div',
      { class: 'card-actions' },
      used ? el('span', { class: 'meta' }, 'On the page') : el('button', { type: 'button', onclick: () => addToNext(d) }, 'Add'),
      d.url ? el('a', { href: d.url, target: '_blank', rel: 'noopener' }, 'Read ↗') : null,
      badges,
    ),
  )
  node.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/x-broadsheet-doc', d.uri)
    e.dataTransfer.effectAllowed = 'copyMove'
    node.classList.add('dragging')
  })
  node.addEventListener('dragend', () => node.classList.remove('dragging'))
  return node
}

// ── The board ────────────────────────────────────────────────────────────

function changed() {
  saveDraft()
  renderPaperNow()
  renderWire()
}

function place(slotId, d) {
  // A document lives in one slot: placing it elsewhere moves it.
  for (const [k, v] of Object.entries(state.board)) if (v?.uri === d.uri) delete state.board[k]
  state.board[slotId] = { uri: d.uri, cid: d.cid }
  changed()
}

function addToNext(d) {
  const free = B.SLOTS.find((s) => !state.board[s.id])
  if (!free) return setStatus('The page is full. Remove a piece first.', 'bad')
  place(free.id, d)
  setStatus(`Added to ${free.label.toLowerCase()}.`)
}

function swap(a, b) {
  const t = state.board[a]
  if (state.board[b]) state.board[a] = state.board[b]
  else delete state.board[a]
  if (t) state.board[b] = t
  else delete state.board[b]
  changed()
}

function remove(slotId) {
  delete state.board[slotId]
  changed()
}

// ── The page ─────────────────────────────────────────────────────────────

function wrap(slot, node) {
  const def = B.SLOTS.find((s) => s.id === slot.slotId)
  const filled = !!state.board[slot.slotId]
  const wrapper = el('div', { class: `slot role-${def.role}`, 'data-slot': def.id })
  const move = el(
    'select',
    {
      'aria-label': `Move ${def.label}`,
      onchange: (e) => e.target.value && swap(def.id, e.target.value),
    },
    el('option', { value: '' }, 'Move to…'),
    B.SLOTS.filter((s) => s.id !== def.id).map((s) => el('option', { value: s.id }, s.label + (state.board[s.id] ? ' (swap)' : ''))),
  )
  const bar = el(
    'div',
    { class: 'slot-bar' },
    el('span', { class: 'label' }, def.label),
    filled ? move : null,
    filled ? el('button', { type: 'button', onclick: () => ((state.editingSlot = state.editingSlot === def.id ? null : def.id), renderPaperNow()) }, state.editingSlot === def.id ? 'Done' : 'Headline') : null,
    filled ? el('button', { type: 'button', onclick: () => remove(def.id), 'aria-label': `Remove from ${def.label}` }, 'Remove') : null,
  )
  wrapper.append(bar)
  if (filled && !slot.doc) wrapper.append(el('p', { class: 'slot-empty' }, 'Loading this piece…'))
  else if (filled) {
    wrapper.append(node)
    if (slot.changed) wrapper.append(el('p', { class: 'changed' }, 'The author has edited this piece since it was picked.'))
    if (state.editingSlot === def.id) wrapper.append(editForm(slot.doc))
  } else {
    wrapper.append(el('div', { class: 'slot-empty' }, def.role === 'lead' ? 'The lead. Drag a piece here, or press Add on one.' : `${def.label}. Drag a piece here.`))
  }
  if (filled) {
    bar.querySelector('.label').setAttribute('draggable', 'true')
    bar.querySelector('.label').addEventListener('dragstart', (e) => e.dataTransfer.setData('text/x-broadsheet-slot', def.id))
  }
  wrapper.addEventListener('dragover', (e) => {
    if (![...e.dataTransfer.types].some((t) => t.startsWith('text/x-broadsheet'))) return
    e.preventDefault()
    wrapper.classList.add('over')
  })
  wrapper.addEventListener('dragleave', (e) => !wrapper.contains(e.relatedTarget) && wrapper.classList.remove('over'))
  wrapper.addEventListener('drop', (e) => {
    e.preventDefault()
    wrapper.classList.remove('over')
    const from = e.dataTransfer.getData('text/x-broadsheet-slot')
    if (from) return from !== def.id && swap(from, def.id)
    const d = state.byUri.get(e.dataTransfer.getData('text/x-broadsheet-doc'))
    if (d) place(def.id, d)
  })
  return wrapper
}

function editForm(doc) {
  const e = state.edits[doc.uri] ?? { headline: '', deck: '' }
  const hed = el('input', { value: e.headline, placeholder: doc.title, maxlength: 300, 'aria-label': 'Your headline' })
  const deck = el('textarea', { rows: 2, maxlength: 600, placeholder: doc.description || 'A line under the headline', 'aria-label': 'Your deck' })
  deck.value = e.deck
  const save = () => {
    state.edits[doc.uri] = { headline: hed.value.trim(), deck: deck.value.trim() }
    if (!state.edits[doc.uri].headline && !state.edits[doc.uri].deck) delete state.edits[doc.uri]
    state.editingSlot = null
    changed()
  }
  return el(
    'div',
    { class: 'slot-edit' },
    hed,
    deck,
    el('p', { class: 'hint' }, 'Your headline and deck replace the author’s on this page only. Leave blank to keep theirs. The byline is always the author’s.'),
    el('div', { class: 'actions' }, el('button', { type: 'button', onclick: save }, 'Save'), el('button', { type: 'button', onclick: () => ((state.editingSlot = null), renderPaperNow()) }, 'Cancel')),
  )
}

let missingFetch = null
function renderPaperNow() {
  const slots = B.SLOTS.map((s) => {
    const it = state.board[s.id]
    const doc = it ? state.byUri.get(it.uri) ?? null : null
    const e = it ? state.edits[it.uri] ?? {} : {}
    return { slotId: s.id, role: s.role, doc, headline: e.headline ?? '', deck: e.deck ?? '', changed: !!doc && !!it?.cid && doc.cid !== it.cid }
  })
  // Pieces on the page but not on the wire (an older draft, an edition being revised).
  const missing = Object.values(state.board).filter((b) => b && !state.byUri.has(b.uri)).map((b) => b.uri)
  if (missing.length && !missingFetch) {
    missingFetch = B.loadDocs(missing)
      .then((m) => {
        for (const [u, d] of m) {
          if (d) state.byUri.set(u, d)
          else for (const [k, v] of Object.entries(state.board)) if (v?.uri === u) delete state.board[k]
        }
      })
      .finally(() => ((missingFetch = null), renderPaperNow()))
  }
  renderPaper($('paper'), {
    masthead: state.masthead || 'Your broadsheet',
    number: state.editing ? state.editing.value.content.number : state.editions.length + 1,
    publishedAt: state.editing?.value?.publishedAt,
    editor: state.me ? { handle: state.myHandle ?? null, displayName: '' } : null,
    note: state.note,
    slots,
  }, { wrap })
  const filled = Object.keys(state.board).length
  $('publish').textContent = state.editing ? 'Update edition' : 'Publish'
  $('publish').disabled = !filled
}

// ── Editions ─────────────────────────────────────────────────────────────

async function loadMine() {
  if (!state.me) return
  try {
    state.editions = await B.listEditions(state.me)
    const { pds } = await B.resolveDid(state.me)
    const mast = await B.findMasthead(pds, state.me)
    if (mast && !state.masthead) {
      state.masthead = mast.value.name
      $('masthead').value = state.masthead
    }
  } catch (e) {
    console.warn(e)
  }
  renderMine()
  renderPaperNow()
}

function renderMine() {
  const box = $('mine')
  box.hidden = !state.editions.length
  const handle = state.myHandle ?? state.me
  $('mine-list').replaceChildren(
    ...state.editions.map((e) => {
      let armed = false
      const del = el('button', {
        type: 'button',
        onclick: async () => {
          if (!armed) return ((armed = true), (del.textContent = 'Really delete?'))
          try {
            await B.deleteEdition(state.agent, state.me, e)
            state.editions = state.editions.filter((x) => x.uri !== e.uri)
            renderMine()
            setStatus('Edition deleted.', 'ok')
          } catch (err) {
            setStatus(err.message, 'bad')
          }
        },
      }, 'Delete')
      return el('li', {}, el('a', { href: `../newsstand/?at=${handle}/${e.rkey}`, target: '_blank' }, e.value.title), el('button', { type: 'button', onclick: () => openEdition(e) }, 'Revise'), del)
    }),
  )
}

function openEdition(e) {
  const c = B.readEditionContent(e.value.content)
  const { board, edits } = B.boardFromSlots(c.slots)
  Object.assign(state, { editing: e, board, edits, note: c.note })
  $('note').value = c.note
  saveDraft()
  renderPaperNow()
  renderWire()
  setStatus(`Revising “${e.value.title}”. Update edition writes over it.`)
  scrollTo({ top: 0, behavior: 'smooth' })
}

async function publish() {
  if (!state.agent) return setStatus('Sign in to publish.', 'bad')
  const btn = $('publish')
  btn.disabled = true
  setStatus(state.editing ? 'Updating…' : 'Publishing…')
  try {
    const slots = B.slotsFromBoard(state.board, state.edits)
    const docs = new Map(slots.map((s) => [s.item.uri, state.byUri.get(s.item.uri)]))
    const r = await B.publishEdition(state.agent, state.me, { masthead: state.masthead, note: state.note, slots, docs, recommend: state.recommend }, state.editing)
    const url = `../newsstand/?at=${state.myHandle ?? state.me}/${r.rkey}`
    store.del(draftKey())
    Object.assign(state, { editing: null, board: {}, edits: {}, note: '' })
    $('note').value = ''
    $('status').replaceChildren(
      `Published${r.recommended ? `, and recommended ${r.recommended} piece${r.recommended === 1 ? '' : 's'}` : ''}. `,
      el('a', { href: url }, 'Read it'),
    )
    $('status').dataset.tone = 'ok'
    await loadMine()
  } catch (e) {
    console.error(e)
    setStatus(e?.error === 'InvalidSwap' ? 'That edition changed somewhere else. Reload and try again.' : e.message, 'bad')
  }
  btn.disabled = !Object.keys(state.board).length
}

// ── Start ────────────────────────────────────────────────────────────────

function bindControls() {
  $('masthead').addEventListener('input', (e) => ((state.masthead = e.target.value), saveDraft(), renderPaperNow()))
  $('note').addEventListener('input', (e) => ((state.note = e.target.value), saveDraft(), renderPaperNow()))
  $('recommend').addEventListener('change', (e) => ((state.recommend = e.target.checked), saveDraft()))
  $('autofill').addEventListener('click', () => {
    const before = Object.keys(state.board).length
    state.board = B.autoFill(state.board, visibleDocs())
    const added = Object.keys(state.board).length - before
    setStatus(added ? `Placed ${added} piece${added === 1 ? '' : 's'} from the wire as it’s filtered now.` : 'Nothing left to place.')
    changed()
  })
  $('clear').addEventListener('click', () => {
    Object.assign(state, { board: {}, edits: {}, editing: null })
    setStatus('')
    changed()
  })
  $('publish').addEventListener('click', publish)
  attachTypeahead($('writer'), () => $('add-writer').requestSubmit())
  $('add-writer').addEventListener('submit', async (e) => {
    e.preventDefault()
    const h = $('writer').value.trim().replace(/^@/, '')
    if (!h) return
    $('wire-status').textContent = `Reading @${h}…`
    try {
      const docs = await B.writerDocs(h, { days: 45 })
      const fresh = docs.filter((d) => !state.byUri.has(d.uri))
      for (const d of docs) {
        const have = state.byUri.get(d.uri)
        if (have) have.sources = [...new Set([...have.sources, 'added'])]
      }
      acceptPool(B.rank([...state.docs, ...fresh]))
      const added = store.get(addedKey()) ?? []
      if (!added.includes(h)) store.set(addedKey(), [...added, h])
      $('writer').value = ''
      $('wire-status').textContent = docs.length ? `Added ${docs.length} piece${docs.length === 1 ? '' : 's'} from @${h}.` : `@${h} has published nothing on standard.site in 45 days.`
      if (docs.length) ((state.source = 'added'), renderWire())
    } catch (err) {
      $('wire-status').textContent = `Couldn't add @${h}: ${err.message}`
    }
  })
  let t
  $('q').addEventListener('input', (e) => {
    clearTimeout(t)
    t = setTimeout(() => ((state.q = e.target.value), renderWire()), 120)
  })
  for (const b of document.querySelectorAll('.views button'))
    b.addEventListener('click', () => {
      document.body.dataset.view = b.dataset.view
      for (const x of document.querySelectorAll('.views button')) x.setAttribute('aria-pressed', String(x === b))
    })
}

async function start() {
  bindControls()
  renderAccount()
  let session = null
  try {
    session = await initAuth()
  } catch (e) {
    console.error(e)
    setStatus(`Sign-in is unavailable right now: ${e.message}`, 'bad')
  }
  await setSession(session)
  const editingRkey = restoreDraft()
  $('masthead').value = state.masthead
  $('note').value = state.note
  $('recommend').checked = state.recommend
  // Whose follows feed the wire: yours when signed in, else ?as=handle, else Jason's.
  const as = new URLSearchParams(location.search).get('as')
  try {
    const who = state.me ? { did: state.me } : await B.resolveActor(as || B.DEFAULT_EDITOR)
    state.reader = who.did
    const prof = await B.profiles([state.reader]).catch(() => new Map())
    state.readerHandle = prof.get(state.reader)?.handle ?? state.reader
    $('wire-who').textContent = state.me ? 'your follows' : `@${state.readerHandle}’s follows`
    if (!state.me) setStatus(`Browsing @${state.readerHandle}’s follows. Sign in to build from yours and publish.`)
  } catch (e) {
    $('wire-status').textContent = `Couldn't find that account: ${e.message}`
  }
  renderPaperNow()
  if (state.me) {
    await loadMine()
    if (editingRkey) {
      const e = state.editions.find((x) => x.rkey === editingRkey)
      if (e) state.editing = e
    }
    renderPaperNow()
  }
  if (state.reader) loadWire().then(loadAdded)
}

start()
