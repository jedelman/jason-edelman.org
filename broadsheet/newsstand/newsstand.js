// The newsstand: front pages from the editors you follow (and everyone else),
// one at a time, each fit to the screen. Swipe left and right between editors,
// up and down through an editor's back issues; tap a story to zoom into it.
import * as B from '../lib.js'
import { renderPaper, expandedStory, el, fmtDate } from '../render.js'
import { attachTypeahead } from '../typeahead.js'

const WIDTHS = [820, 1040, 1280, 1560, 1880] // broadsheet widths to try; the best fit wins
const PAD = 14
const params = new URLSearchParams(location.search)
const state = {
  reader: null, readerHandle: null,
  editors: [], i: 0, ed: new Map(), // ed: editor did -> which edition (0 = latest)
  cache: new Map(), // edition uri -> Promise(loadEdition result)
  slide: null, slots: [], current: null,
  zoom: null, busy: false,
  tab: 'front', // 'front' or 'back' (back editions)
  calMonth: null, calDay: null,
}
const INBOX = 'broadsheet:inbox' // reshares handed to the editor, same origin

const $ = (id) => document.getElementById(id)
const stage = $('stage')
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {}
  },
  del: (k) => {
    try {
      localStorage.removeItem(k)
    } catch {}
  },
}
const EASE_IN = 'cubic-bezier(.2,.8,.2,1)'
const EASE_OUT = 'cubic-bezier(.4,0,.6,1)'
const mastheadOf = (e) => e.masthead || e.editions[0].title.replace(/(, (Morning|Evening) Edition)?, [A-Z][a-z]+ \d{1,2}, \d{4}$/, '')
const whoOf = (e) => (e.handle ? '@' + e.handle : e.did.slice(0, 18) + '…')

function message(title, ...lines) {
  stage.replaceChildren(el('div', { class: 'state' }, el('h1', {}, title), ...lines.map((l) => el('p', {}, l))))
}

// ── Whose newsstand ──────────────────────────────────────────────────────

async function initReader() {
  const as = params.get('as') ?? store.get('broadsheet:reader')
  if (!as) return
  try {
    const { did } = await B.resolveActor(as)
    state.reader = did
    state.readerHandle = (await B.profiles([did]).catch(() => new Map())).get(did)?.handle ?? as
  } catch {
    state.reader = null
  }
}

function renderWho() {
  const box = $('who')
  if (state.reader) {
    box.replaceChildren(el('span', {}, 'Newsstand for ', el('strong', {}, '@' + state.readerHandle)), el('button', { class: 'link', type: 'button', onclick: () => setReader('') }, 'change'))
  } else {
    const input = el('input', { placeholder: 'your.handle', 'aria-label': 'Your handle', autocapitalize: 'none', autocomplete: 'username', spellcheck: 'false' })
    box.replaceChildren(el('form', { onsubmit: (e) => (e.preventDefault(), setReader(input.value)) }, input, el('button', { type: 'submit' }, 'Yours first')))
    attachTypeahead(input, (h) => setReader(h))
  }
}

function setReader(h) {
  h = String(h ?? '').trim().replace(/^@/, '')
  if (h) store.set('broadsheet:reader', h)
  else store.del('broadsheet:reader')
  const p = new URLSearchParams(location.search)
  if (h) p.set('as', h)
  else p.delete('as')
  location.search = p.toString()
}

// ── Editions and slides ──────────────────────────────────────────────────

function edition(editor, k) {
  const e = editor.editions[k]
  if (!e) return Promise.resolve({ error: new Error('No such edition') })
  if (!state.cache.has(e.uri)) state.cache.set(e.uri, B.loadEdition(`${editor.did}/${e.rkey}`).catch((error) => ({ error })))
  return state.cache.get(e.uri)
}

async function buildSlide(i, k) {
  const editor = state.editors[i]
  const r = await edition(editor, k)
  const slide = el('section', { class: 'slide', 'aria-roledescription': 'slide', 'aria-label': `${mastheadOf(editor)} by ${whoOf(editor)}` })
  if (r.error || !r.edition) {
    slide.append(el('div', { class: 'state' }, el('p', {}, 'This front page couldn’t be loaded.')))
    return { slide, slots: [], r }
  }
  const paper = el('article', { class: 'paper' })
  slide.append(el('div', { class: 'paper-frame' }, paper))
  const slots = renderPaper(paper, { masthead: r.pub?.name || r.edition.title, number: r.edition.number, publishedAt: r.edition.publishedAt, date: r.edition.date, period: r.edition.period, editor: r.editor, note: r.edition.note, slots: r.slots }, null, 'stand')
  for (const s of paper.querySelectorAll('.story[data-i]')) {
    s.tabIndex = 0
    s.setAttribute('role', 'button')
    s.setAttribute('aria-label', `Read: ${s.querySelector('.hed')?.textContent ?? 'this story'}`)
  }
  return { slide, slots, r }
}

// Lay the page out at each candidate width and keep the one that, scaled to
// fit the stage, comes out biggest. No scrolling: the whole page is in view.
function fit(slide) {
  const frame = slide?.querySelector('.paper-frame')
  if (!frame) return
  const aw = stage.clientWidth - PAD * 2
  const ah = stage.clientHeight - PAD * 2
  let best
  for (const W of WIDTHS) {
    frame.style.width = `${W}px`
    const s = Math.min(aw / W, ah / frame.offsetHeight, 1)
    if (!best || s > best.s + 0.001) best = { W, s }
  }
  frame.style.width = `${best.W}px`
  const H = frame.offsetHeight
  const x = PAD + (aw - best.W * best.s) / 2
  const y = PAD + Math.max(0, (ah - H * best.s) / 2)
  frame.style.transform = `translate(${x}px, ${y}px) scale(${best.s})`
}

async function show(i, dir = 0, axis = 'x') {
  if (state.busy) return
  state.busy = true
  try {
    const editor = state.editors[i]
    const built = await buildSlide(i, state.ed.get(editor.did) ?? 0)
    stage.querySelector(':scope > .state')?.remove()
    const old = state.slide
    stage.append(built.slide)
    fit(built.slide)
    if (old && dir && !reduced()) {
      const fn = axis === 'x' ? 'translateX' : 'translateY'
      const dist = (axis === 'x' ? stage.clientWidth : stage.clientHeight) * 0.55
      old.animate([{ transform: old.style.transform || 'none', opacity: 1 }, { transform: `${fn}(${-dir * dist}px)`, opacity: 0 }], { duration: 260, easing: EASE_OUT, fill: 'forwards' })
      await built.slide.animate([{ transform: `${fn}(${dir * dist}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: EASE_IN }).finished
    }
    old?.remove()
    if (state.i !== i) Object.assign(state, { calMonth: null, calDay: null })
    Object.assign(state, { slide: built.slide, slots: built.slots, current: built.r, i })
    updateChrome()
    prefetch()
  } finally {
    state.busy = false
  }
}

function prefetch() {
  const near = [state.i - 1, state.i + 1].filter((n) => n >= 0 && n < state.editors.length)
  for (const n of near) edition(state.editors[n], state.ed.get(state.editors[n].did) ?? 0)
  const ed = state.editors[state.i]
  edition(ed, (state.ed.get(ed.did) ?? 0) + 1)
}

const go = (delta) => {
  const n = state.i + delta
  if (n < 0 || n >= state.editors.length) return snapBack(true)
  show(n, delta, 'x')
}
const issue = (delta) => {
  const ed = state.editors[state.i]
  const k = (state.ed.get(ed.did) ?? 0) + delta
  if (k < 0 || k >= ed.editions.length) return snapBack(true)
  state.ed.set(ed.did, k)
  show(state.i, delta, 'y')
}

function snapBack(bounce = false) {
  const s = state.slide
  if (!s) return
  const from = s.style.transform || 'none'
  s.style.transform = ''
  if (reduced()) return
  if (from !== 'none') s.animate([{ transform: from }, { transform: 'none' }], { duration: 220, easing: EASE_IN })
  else if (bounce) s.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 })
}

// ── Chrome: rack, URL, title, hint ───────────────────────────────────────

const GROUP_LABEL = { you: 'You', following: 'Following', everyone: 'Everyone', linked: 'Linked' }

function renderRack() {
  const kids = []
  let group = null
  state.editors.forEach((e, i) => {
    if (e.group !== group) {
      group = e.group
      kids.push(el('span', { class: 'group' }, group === 'everyone' && state.reader ? 'Everyone else' : GROUP_LABEL[group]))
    }
    kids.push(
      el('button', { class: 'chip', type: 'button', 'data-i': String(i), 'aria-current': 'false', onclick: () => i !== state.i && show(i, i > state.i ? 1 : -1) },
        el('b', {}, mastheadOf(e)),
        el('span', {}, `${whoOf(e)} · ${fmtDate(e.editions[0].publishedAt)}`),
      ),
    )
  })
  $('rack').replaceChildren(...kids)
}

let hintTimer
function updateChrome() {
  const editor = state.editors[state.i]
  const k = state.ed.get(editor.did) ?? 0
  const ed = editor.editions[k]
  for (const c of $('rack').querySelectorAll('.chip')) {
    const on = Number(c.dataset.i) === state.i
    c.setAttribute('aria-current', String(on))
    if (on) c.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' })
  }
  // Built by hand so the link reads ?at=handle/rkey, not handle%2Frkey.
  const as = params.get('as')
  history.replaceState(history.state, '', `?at=${editor.handle ?? editor.did}/${ed.rkey}${as ? `&as=${encodeURIComponent(as)}` : ''}`)
  document.title = `${ed.title} · Newsstand`
  for (const b of stage.querySelectorAll('.nav')) b.remove()
  stage.append(
    el('button', { class: 'nav prev', type: 'button', 'aria-label': 'Previous front page', disabled: state.i === 0, onclick: () => go(-1) }, '‹'),
    el('button', { class: 'nav next', type: 'button', 'aria-label': 'Next front page', disabled: state.i === state.editors.length - 1, onclick: () => go(1) }, '›'),
  )
  renderActions()
  const parts = []
  if (editor.editions.length > 1) parts.push(`Issue ${editor.editions.length - k} of ${editor.editions.length}: swipe ${k < editor.editions.length - 1 ? 'up for older' : 'down for newer'}`)
  if (!store.get('broadsheet:hinted')) parts.unshift('Swipe for more front pages · tap a story to read it')
  stage.querySelector('.hint')?.remove()
  if (parts.length) {
    const h = el('p', { class: 'hint', 'aria-live': 'polite' }, parts.join(' · '))
    stage.append(h)
    clearTimeout(hintTimer)
    hintTimer = setTimeout(() => ((h.style.opacity = '0'), store.set('broadsheet:hinted', '1')), 4200)
  }
}

// ── Zoom: a story, expanded ──────────────────────────────────────────────

function flip(frame, src, reverse = false) {
  const a = src.getBoundingClientRect()
  const b = frame.getBoundingClientRect()
  const at = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`
  const keys = [{ transformOrigin: '0 0', transform: at, opacity: 0.3 }, { transformOrigin: '0 0', transform: 'none', opacity: 1 }]
  return frame.animate(reverse ? keys.reverse() : keys, { duration: reverse ? 280 : 380, easing: reverse ? EASE_OUT : EASE_IN, fill: 'forwards' })
}

function expand(i) {
  const slot = state.slots[i]
  if (!slot || state.zoom) return
  const z = $('zoom')
  const paper = el('article', { class: 'paper expanded' }, expandedStory(slot))
  const frame = el('div', { class: 'paper-frame card-frame' }, el('button', { class: 'close', type: 'button', 'aria-label': 'Close', onclick: () => collapse() }, '×'), paper)
  const count = el('span', { class: 'count' }, `${i + 1} of ${state.slots.length}`)
  const bar = el('div', { class: 'zbar' },
    el('button', { type: 'button', 'aria-label': 'Previous story', onclick: () => step(-1) }, '‹'),
    count,
    el('button', { type: 'button', 'aria-label': 'Next story', onclick: () => step(1) }, '›'),
    el('button', { type: 'button', class: 'reshare', onclick: () => reshare([state.slots[state.zoom?.i ?? i]]) }, 'Reshare'),
  )
  const backdrop = el('div', { class: 'backdrop', onclick: () => collapse() })
  z.replaceChildren(backdrop, frame, bar)
  z.hidden = false
  state.zoom = { i, frame, paper, count }
  const src = state.slide?.querySelector(`.story[data-i="${i}"]`)
  if (src && !reduced()) {
    flip(frame, src)
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 })
  }
  // Horizontal swipes move between stories; vertical ones scroll the card.
  let g
  frame.addEventListener('pointerdown', (e) => (g = { x: e.clientX, y: e.clientY }))
  frame.addEventListener('pointerup', (e) => {
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    g = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1)
  })
  frame.querySelector('.close').focus({ preventScroll: true })
  history.pushState({ zoom: true }, '')
}

function step(d) {
  const z = state.zoom
  if (!z) return
  const n = z.i + d
  if (n < 0 || n >= state.slots.length) return
  const next = el('article', { class: 'paper expanded' }, expandedStory(state.slots[n]))
  z.paper.replaceWith(next)
  if (!reduced()) next.animate([{ transform: `translateX(${d * 48}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: EASE_IN })
  Object.assign(z, { i: n, paper: next })
  z.count.textContent = `${n + 1} of ${state.slots.length}`
}

async function collapse(fromHistory = false) {
  const z = state.zoom
  if (!z) return
  state.zoom = null
  const box = $('zoom')
  const src = state.slide?.querySelector(`.story[data-i="${z.i}"]`)
  if (src && !reduced()) {
    box.querySelector('.backdrop')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' })
    box.querySelector('.zbar')?.remove()
    await flip(z.frame, src, true).finished.catch(() => {})
  }
  box.hidden = true
  box.replaceChildren()
  src?.focus({ preventScroll: true })
  if (!fromHistory && history.state?.zoom) history.back()
}

addEventListener('popstate', () => state.zoom && collapse(true))

// ── Gestures and keys ────────────────────────────────────────────────────

let g = null
stage.addEventListener('pointerdown', (e) => {
  if (state.zoom || state.tab === 'back' || e.button > 0 || e.target.closest('.nav')) return
  g = { x: e.clientX, y: e.clientY, id: e.pointerId, target: e.target, moved: false }
  stage.setPointerCapture(e.pointerId)
})
stage.addEventListener('pointermove', (e) => {
  if (!g || e.pointerId !== g.id) return
  const dx = e.clientX - g.x
  const dy = e.clientY - g.y
  if (!g.moved && Math.hypot(dx, dy) > 8) g.moved = true
  if (g.moved && state.slide && !state.busy) state.slide.style.transform = Math.abs(dx) > Math.abs(dy) ? `translateX(${dx * 0.9}px)` : `translateY(${dy * 0.9}px)`
})
stage.addEventListener('pointerup', (e) => {
  if (!g || e.pointerId !== g.id) return
  const { moved, target } = g
  const dx = e.clientX - g.x
  const dy = e.clientY - g.y
  g = null
  if (!moved) {
    const s = target.closest?.('.story[data-i]')
    if (s) expand(Number(s.dataset.i))
    return
  }
  if (state.busy) return snapBack()
  if (Math.abs(dx) > Math.max(50, Math.abs(dy))) go(dx < 0 ? 1 : -1)
  else if (Math.abs(dy) > 50) issue(dy < 0 ? 1 : -1)
  else snapBack()
})
stage.addEventListener('pointercancel', () => ((g = null), snapBack()))
// Links on the rack page are for the zoomed view; a tap there zooms instead.
stage.addEventListener('click', (e) => e.target.closest('a') && e.preventDefault(), true)

addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea')) return
  if (state.zoom) {
    if (e.key === 'Escape') collapse()
    else if (e.key === 'ArrowRight') step(1)
    else if (e.key === 'ArrowLeft') step(-1)
    else return
    e.preventDefault()
    return
  }
  if (!state.editors.length) return
  if (state.tab === 'back') {
    if (e.key === 'Escape') (setTab('front'), e.preventDefault())
    return
  }
  if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
  else if (e.key === 'ArrowDown') issue(1)
  else if (e.key === 'ArrowUp') issue(-1)
  else if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('.story[data-i]')) expand(Number(e.target.closest('.story').dataset.i))
  else return
  e.preventDefault()
})

let resizeTimer
addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => fit(state.slide), 120)
})
document.fonts?.addEventListener?.('loadingdone', () => fit(state.slide))

// ── Actions: tabs and reshare ────────────────────────────────────────────

function renderActions() {
  const editor = state.editors[state.i]
  if (!editor) return
  const k = state.ed.get(editor.did) ?? 0
  const ed = editor.editions[k]
  const tab = (name, label) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(state.tab === name), onclick: () => setTab(name) }, label)
  $('actions').replaceChildren(
    el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'View' }, tab('front', 'Front page'), tab('back', `Back editions${editor.editions.length > 1 ? ` (${editor.editions.length})` : ''}`)),
    el('span', { class: 'issue' }, [ed.number ? `No. ${ed.number}` : null, B.PERIODS[ed.period], B.longDate(ed.date)].filter(Boolean).join(' · ')),
    el('span', { class: 'spacer' }),
    el('button', { type: 'button', class: 'reshare', 'aria-label': 'Reshare this front page to yours', disabled: !state.slots.some((s) => s.doc), onclick: () => reshare(state.slots) }, el('span', { class: 'long' }, 'Reshare front page'), el('span', { class: 'short' }, 'Reshare')),
  )
}

function setTab(name) {
  state.tab = name
  stage.querySelector('.back')?.remove()
  if (name === 'back') renderBack()
  renderActions()
}

// Hand pieces to the editor (same origin): it puts them on your page, each
// credited "via" this broadsheet.
function reshare(slots) {
  const ed = state.current?.edition
  const editor = state.editors[state.i]
  const items = slots.filter((s) => s?.doc).map((s) => ({ uri: s.doc.uri, cid: s.doc.cid, role: s.role, via: { uri: ed.uri, cid: ed.cid, masthead: state.current.pub?.name || mastheadOf(editor) } }))
  if (!items.length) return
  let inbox = []
  try {
    inbox = JSON.parse(localStorage.getItem(INBOX)) || []
  } catch {}
  const have = new Set(inbox.map((x) => x.uri))
  const fresh = items.filter((x) => !have.has(x.uri))
  try {
    localStorage.setItem(INBOX, JSON.stringify([...inbox, ...fresh]))
  } catch {
    return toast('Couldn’t reshare: this browser blocks storage.')
  }
  const n = items.length
  toast(`${n === 1 ? 'Reshared to' : `Reshared ${n} pieces to`} your front page.`, el('a', { href: '../editor/' }, 'Open the editor →'))
}

let toastTimer
function toast(msg, ...extra) {
  const t = $('toast')
  t.replaceChildren(msg, ...extra)
  t.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (t.hidden = true), 5000)
}

// ── Back editions: pick a day from a calendar of the editor's issues ─────

const ym = (date) => date.slice(0, 7)
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function renderBack() {
  const editor = state.editors[state.i]
  const eds = editor.editions.map((e, k) => ({ ...e, k }))
  const byDay = new Map()
  for (const e of eds) {
    if (!byDay.has(e.date)) byDay.set(e.date, [])
    byDay.get(e.date).push(e)
  }
  for (const list of byDay.values()) list.sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)))
  const months = [...new Set(eds.map((e) => ym(e.date)))].sort()
  const current = editor.editions[state.ed.get(editor.did) ?? 0]
  if (!state.calMonth || !months.includes(state.calMonth)) state.calMonth = ym(current.date)
  if (!state.calDay || !byDay.has(state.calDay)) state.calDay = current.date
  const [y, m] = state.calMonth.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const days = new Date(y, m, 0).getDate()
  const idx = months.indexOf(state.calMonth)
  const go = (d) => ((state.calMonth = months[idx + d]), setTab('back'))
  const open = (e) => {
    state.ed.set(editor.did, e.k)
    setTab('front')
    show(state.i)
  }
  const cells = [...DOW.map((d) => el('span', { class: 'dow', 'aria-hidden': 'true' }, d))]
  for (let i = 0; i < first.getDay(); i++) cells.push(el('span', { class: 'day' }))
  for (let d = 1; d <= days; d++) {
    const date = `${state.calMonth}-${String(d).padStart(2, '0')}`
    const list = byDay.get(date)
    if (!list) {
      cells.push(el('span', { class: 'day' }, String(d)))
      continue
    }
    const label = `${B.longDate(date)}: ${list.map((e) => B.PERIODS[e.period] ?? 'edition').join(' and ')}`
    cells.push(
      el('button', {
        type: 'button', class: 'day', 'aria-label': label, 'aria-pressed': String(date === state.calDay),
        onclick: () => (list.length === 1 ? open(list[0]) : ((state.calDay = date), setTab('back'))),
      }, String(d), el('span', { class: 'marks', 'aria-hidden': 'true' }, list.map((e) => (e.period ? e.period.toUpperCase() : '•')).join(' '))),
    )
  }
  const shown = (byDay.get(state.calDay) ?? []).length > 1 ? byDay.get(state.calDay) : eds.filter((e) => ym(e.date) === state.calMonth)
  stage.append(
    el('section', { class: 'back', 'aria-label': 'Back editions' },
      el('div', { class: 'back-in' },
        el('h2', {}, mastheadOf(editor)),
        el('p', { class: 'sub' }, `${editor.editions.length} edition${editor.editions.length === 1 ? '' : 's'} edited by ${whoOf(editor)}. Pick a day to read what they picked.`),
        el('div', { class: 'cal-head' },
          el('button', { type: 'button', 'aria-label': 'Earlier month', disabled: idx <= 0, onclick: () => go(-1) }, '‹'),
          el('b', {}, first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })),
          el('button', { type: 'button', 'aria-label': 'Later month', disabled: idx >= months.length - 1, onclick: () => go(1) }, '›'),
        ),
        el('div', { class: 'cal', role: 'group', 'aria-label': 'Days with editions' }, cells),
        el('ul', { class: 'issues' },
          shown.map((e) =>
            el('li', {}, el('button', { type: 'button', class: e.uri === current.uri ? 'current' : '', onclick: () => open(e) },
              el('b', {}, [B.longDate(e.date), B.PERIODS[e.period]].filter(Boolean).join(', ')),
              el('span', {}, e.number ? `No. ${e.number}` : ''),
            )),
          ),
        ),
      ),
    ),
  )
}

// ── Start ────────────────────────────────────────────────────────────────

async function start() {
  await initReader()
  renderWho()
  let editors = []
  try {
    editors = await B.rack(state.reader)
  } catch (e) {
    console.error(e)
    return message('The newsstand is closed', `Couldn’t reach the index of front pages: ${e.message}`)
  }
  let startI = 0
  const at = params.get('at')
  if (at) {
    try {
      const { did, rkey } = await B.resolveEditionRef(at)
      let idx = editors.findIndex((e) => e.did === did)
      if (idx < 0) {
        // Linked, but not indexed yet (a brand-new masthead): read it directly.
        const eds = await B.listEditions(did)
        if (eds.length) {
          const prof = (await B.profiles([did]).catch(() => new Map())).get(did)
          editors.unshift({ did, handle: prof?.handle ?? null, displayName: prof?.displayName ?? '', masthead: null, group: 'linked', editions: B.editionList(eds) })
          idx = 0
        }
      }
      if (idx >= 0) {
        startI = idx
        const k = rkey ? editors[idx].editions.findIndex((x) => x.rkey === rkey) : 0
        state.ed.set(did, Math.max(0, k))
      }
    } catch (e) {
      console.warn('Couldn’t open the linked edition', e)
    }
  }
  state.editors = editors
  if (!editors.length) {
    return message('No front pages yet', 'Nobody has published one. ', el('a', { href: '../editor/' }, 'Make the first one from the writers you follow.'))
  }
  renderRack()
  await document.fonts?.ready
  await show(startI)
}

start()
