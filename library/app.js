// Library UI: OAuth via the official SDK, camera scanning, tabs.
// Protocol logic lives in lib.js. Everything third-party is checked in under
// vendor/, built from pinned npm versions by scripts/vendor-library.
import { BrowserOAuthClient } from './vendor/oauth-client-browser.js'
import * as L from './lib.js'

const DEFAULT_LIBRARY = 'jason-edelman.org'
// The SDK's Agent (~140 KB gzipped) loads only once someone signs in;
// browsing the catalog needs plain reads only.
const API = './vendor/atproto-api.js'
// Used only where the browser has no native BarcodeDetector (iOS Safari, Firefox).
// It fetches its decoder, vendor/zxing_reader.wasm, from beside itself.
const POLYFILL = './vendor/barcode-detector.js'
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code']

const state = { client: null, session: null, agent: null, me: null, myHandle: null, lib: null, snap: null, busy: false }

// ── Small helpers ────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id)

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v)
    else if (k === 'class') n.className = v
    else n.setAttribute(k, v === true ? '' : v)
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : String(k))
  return n
}

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
}

const thisYear = (d) => d.getFullYear() === new Date().getFullYear()
const fmtDate = (iso) => {
  const d = new Date(iso)
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: thisYear(d) ? undefined : 'numeric' })
}
// For stamps and the date card: "NOV 7", or "NOV 7 2025" from another year.
const fmtStamp = (iso) => {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const m = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return `${m} ${d.getDate()}${thisYear(d) ? '' : ' ' + d.getFullYear()}`
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const isOwner = () => !!state.me && state.lib && state.me === state.lib.did
const at = (did) => '@' + L.handleOf(state.snap, did)
const ownerAt = () => '@' + (state.lib.handle ?? state.lib.did)
const itemByUri = (uri) => state.snap.items.find((i) => i.uri === uri)

function notice(msg) {
  const n = $('notice')
  n.textContent = msg || ''
  n.hidden = !msg
}

const buzz = () => navigator.vibrate?.(60)

// A photo, or the title's first letter set as a tile.
function thumb(item) {
  const src = item && L.blobUrl(state.lib, item.value?.photo)
  if (src) return el('img', { class: 'thumb', src, alt: '', loading: 'lazy' })
  const letter = String(item?.value?.title || '?').trim().charAt(0) || '?'
  return el('span', { class: 'monogram', 'aria-hidden': 'true' }, letter)
}

function outLine(item) {
  const loans = state.snap.active.get(item.uri) ?? []
  if (!loans.length) return 'On the shelf.'
  const [first, ...rest] = loans
  const who = first.did === state.me ? 'you' : at(first.did)
  let s = `Out with ${who} since ${fmtDate(first.value.createdAt)}.`
  if (rest.length) s += ` Also claimed by ${rest.map((l) => at(l.did)).join(', ')}.`
  return s
}

// The small typed status beside a code: IN, or OUT with who and since when.
function statusTag(item) {
  const loan = L.holderOf(state.snap, item)
  if (!loan) return [el('span', { class: 'tag in' }, 'In')]
  const who = loan.did === state.me ? 'you' : at(loan.did)
  const extra = (state.snap.active.get(item.uri)?.length ?? 1) - 1
  return [el('span', { class: 'tag out' }, `Out ${fmtStamp(loan.value.createdAt)}`), el('span', { class: 'tag-note' }, who + (extra ? ` +${extra}` : ''))]
}

// "you", or the handle.
const whoIs = (did) => (did === state.me ? 'you' : at(did))

// Who holds a title's copies: "you", "@a, @b", "@a ×2".
function holders(pool) {
  const counts = new Map()
  for (const l of pool.loans) counts.set(l.did, (counts.get(l.did) ?? 0) + 1)
  return [...counts].map(([did, n]) => whoIs(did) + (n > 1 ? ` ×${n}` : '')).join(', ')
}

// One sentence on where a title's copies are.
function poolLine(pool) {
  const n = pool.copies.length
  if (n === 1) return outLine(pool.copies[0])
  if (pool.free.length) return `${pool.free.length} of ${n} copies on the shelf.`
  return `All ${n} copies are out: ${pool.loans.map((l) => `${whoIs(l.did)} since ${fmtDate(l.value.createdAt)}`).join('; ')}.`
}

const shelfNote = (pool) => (pool.copies.length > 1 ? ` ${pool.free.length} of ${pool.copies.length} copies on the shelf now.` : '')

// A copy that comes back can't say whose it was, so the owner picks: one
// button per borrower (not the owner; their own scan returns their copy).
function backButtons(pool) {
  const oldest = new Map()
  for (const l of pool.loans) if (l.did !== state.me && !oldest.has(l.did)) oldest.set(l.did, l)
  return [...oldest.values()].map((l) => [`Back from ${at(l.did)}`, () => checkInFor(l)])
}

// ── Auth ─────────────────────────────────────────────────────────────────

async function initAuth() {
  let clientId = new URL('client-metadata.json', import.meta.url).href
  if (['127.0.0.1', '[::1]', 'localhost'].includes(location.hostname)) {
    // Development: atproto's loopback client needs no hosted metadata.
    const host = location.hostname === 'localhost' ? '127.0.0.1' : location.hostname
    const redirect = `http://${host}:${location.port}${location.pathname}`
    clientId = `http://localhost?redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(L.SCOPE)}`
  }
  const client = await BrowserOAuthClient.load({
    clientId,
    handleResolver: L.HANDLE_RESOLVER,
    // Refresh failed or the token was revoked elsewhere.
    onSessionDeleted: (sub) => {
      if (state.me !== sub) return
      setSession(null)
      notice('You were signed out: the session ended.')
    },
  })
  state.client = client
  const r = await client.init()
  if (r?.session) await setSession(r.session)
}

let Agent
async function setSession(session) {
  if (session) Agent ??= (await import(API)).Agent
  state.session = session
  state.agent = session ? new Agent(session) : null
  state.me = session?.did ?? null
  state.myHandle = null
  if (session) {
    L.resolveDid(session.did)
      .then((id) => {
        state.myHandle = id.handle
        renderAccount()
      })
      .catch(() => {})
  }
  renderAccount()
  renderAll()
}

async function signIn(handle) {
  const h = handle.trim().replace(/^@/, '')
  if (!h) return
  if (!state.client) return notice('Sign-in is unavailable right now.')
  try {
    await state.client.signIn(h) // redirects away; resolves only if the user comes back
  } catch (e) {
    notice(`Sign-in failed: ${e.message}`)
  }
}

async function signOut() {
  const session = state.session
  await setSession(null)
  try {
    await session?.signOut()
  } catch {}
}

// ── Data ─────────────────────────────────────────────────────────────────

async function refresh() {
  state.snap = await L.loadLibrary(state.lib, { me: state.me })
  // Loans the owner checked in for me become receipts, once, quietly.
  if (state.agent && L.closedLoansOf(state.snap, state.me).length) {
    try {
      await L.tidy(state.agent, state.me, state.snap)
      state.snap = await L.loadLibrary(state.lib, { me: state.me })
    } catch (e) {
      console.warn('tidy failed', e)
    }
  }
  const n = state.snap.unreachable.length
  if (state.snap.indexError) notice(`Couldn't reach the backlink index (Constellation), so other people's checkouts may be missing: ${state.snap.indexError.message}`)
  else if (n) notice(`Couldn't reach ${n} borrower repo${n === 1 ? '' : 's'}; some items may show as on the shelf when they aren't.`)
  else if (/^Couldn't reach/.test($('notice').textContent)) notice('')
  renderAll()
}

async function guarded(statusEl, fn) {
  if (state.busy) return
  state.busy = true
  try {
    await fn()
  } catch (e) {
    console.error(e)
    // A swapRecord guard tripped: the record changed since we read it.
    const msg = e?.error === 'InvalidSwap' ? 'That record changed somewhere else. Refresh and try again.' : e.message
    if (statusEl?.isConnected) {
      statusEl.textContent = `Error: ${msg}`
      statusEl.dataset.tone = 'bad'
    } else notice(`Error: ${msg}`)
  } finally {
    state.busy = false
  }
}

// ── Scanning ─────────────────────────────────────────────────────────────

let detectorPromise
function getDetector() {
  detectorPromise ??= (async () => {
    if ('BarcodeDetector' in window) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats()
        const formats = FORMATS.filter((f) => supported.includes(f))
        if (formats.length) return new window.BarcodeDetector({ formats })
      } catch {}
    }
    const { BarcodeDetector } = await import(POLYFILL)
    return new BarcodeDetector({ formats: FORMATS })
  })()
  detectorPromise.catch(() => (detectorPromise = null))
  return detectorPromise
}

class Scanner {
  constructor(video, onCode) {
    this.video = video
    this.onCode = onCode
    this.running = false
  }
  async start() {
    const detector = await getDetector()
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
    this.video.srcObject = this.stream
    await this.video.play()
    this.running = true
    this.last = null
    this.loop(detector)
  }
  stop() {
    this.running = false
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.video.srcObject = null
  }
  async loop(detector) {
    while (this.running) {
      try {
        if (this.video.readyState >= 2) {
          const [hit] = await detector.detect(this.video)
          const t = performance.now()
          if (hit?.rawValue) {
            // One scan per presentation: a code that stays in view never fires
            // twice. Take it out of frame for 1.5 s to scan it again.
            if (hit.rawValue === this.last && t - this.lastSeen < 1500) this.lastSeen = t
            else {
              this.last = hit.rawValue
              this.lastSeen = t
              this.onCode(hit.rawValue)
            }
          }
        }
      } catch (e) {
        console.warn(e)
      }
      await new Promise((r) => setTimeout(r, 120))
    }
  }
}

function cameraError(e) {
  if (e?.name === 'NotAllowedError') return 'Camera permission was denied. Type the code instead, or use a handheld scanner.'
  if (e?.name === 'NotFoundError') return 'No camera found. Type the code, or use a handheld scanner.'
  return `Camera unavailable: ${e?.message || e}`
}

const scanScanner = new Scanner($('scan-video'), (code) => onScan(code))
const addScanner = new Scanner($('add-video'), (code) => {
  stopAddCamera()
  buzz()
  setAddCode(code)
})

async function startScanCamera() {
  const start = $('scan-cam')
  start.firstChild.textContent = 'Starting…'
  try {
    await scanScanner.start()
    start.hidden = true
    $('scan-stop').hidden = false
  } catch (e) {
    scanScanner.stop()
    showStatus(cameraError(e), 'bad')
  } finally {
    start.firstChild.textContent = 'Tap to scan'
  }
}

function stopScanCamera() {
  scanScanner.stop()
  $('scan-cam').hidden = false
  $('scan-stop').hidden = true
}

async function toggleAddCamera() {
  if (addScanner.running) return stopAddCamera()
  $('add-finder').hidden = false
  $('add-cam').textContent = 'Starting…'
  try {
    await addScanner.start()
    $('add-cam').textContent = 'Stop'
  } catch (e) {
    stopAddCamera()
    $('add-status').textContent = cameraError(e)
    $('add-status').dataset.tone = 'bad'
  }
}

function stopAddCamera() {
  addScanner.stop()
  $('add-finder').hidden = true
  $('add-cam').textContent = $('add-cam').dataset.idle
}

// ── Scan tab: one scan checks out or checks in ───────────────────────────

// A plain line where the slip will go: "Checking…", "Not in this catalog", errors.
function showStatus(text, tone, actions = []) {
  $('scan-hint').hidden = true
  const p = el('p', { class: 'scan-status', 'data-tone': tone || null }, text)
  const row = actions.length ? [el('div', { class: 'actions' }, actions.map(([label, fn]) => el('button', { type: 'button', onclick: fn }, label)))] : []
  $('scan-result').replaceChildren(p, ...row)
  return p
}

// The date slip: the item, an ink stamp for what just happened, one plain sentence.
function showSlip({ item, ink, stamp, who, line, actions = [] }) {
  $('scan-hint').hidden = true
  const src = L.blobUrl(state.lib, item.value?.photo)
  const slip = el(
    'article',
    { class: 'slip', 'data-ink': ink, 'aria-label': `${item.value.title}: ${line}` },
    el(
      'div',
      { class: 'slip-head' },
      src ? el('img', { class: 'slip-photo', src, alt: '' }) : null,
      el('div', {}, el('p', { class: 'slip-title' }, item.value.title), el('p', { class: 'slip-code' }, item.value.barcode)),
    ),
    el('div', { class: 'slip-mark' }, el('span', { class: 'stamp' }, stamp), who ? el('span', { class: 'slip-who' }, who) : null),
    el('p', { class: 'slip-line' }, line),
    actions.length ? el('div', { class: 'actions' }, actions.map(([label, fn]) => el('button', { type: 'button', onclick: fn }, label))) : null,
  )
  $('scan-result').replaceChildren(slip)
  slip.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
}

async function onScan(raw) {
  if (state.busy || !state.lib) return
  const code = L.normalizeCode(raw)
  if (!code) return
  buzz()
  const status = showStatus(`Checking ${code}…`)
  await guarded(status, async () => {
    await refresh() // act on fresh status, not what was on screen
    const d = L.decide(state.snap, code, state.me)
    const today = fmtStamp(new Date().toISOString())
    switch (d.kind) {
      case 'unknown':
        return showStatus(`${code} isn't in this catalog.`, null, isOwner() ? [['Add it to the catalog', () => startAdd(code)]] : [])
      case 'signed-out': {
        const n = d.pool.copies.length
        if (d.pool.free.length) return showSlip({ item: d.item, ink: 'in', stamp: 'On shelf', line: n > 1 ? `${d.pool.free.length} of ${n} copies on the shelf. Sign in to borrow one.` : 'Sign in to borrow it.' })
        return showSlip({ item: d.item, ink: 'out', stamp: `Out ${fmtStamp(d.loan.value.createdAt)}`, who: holders(d.pool), line: poolLine(d.pool) })
      }
      case 'out':
        return showSlip({
          item: d.item,
          ink: 'out',
          stamp: `Out ${fmtStamp(d.loan.value.createdAt)}`,
          who: holders(d.pool),
          line: poolLine(d.pool),
          actions: isOwner() ? backButtons(d.pool) : [],
        })
      case 'checkout': {
        await L.checkOut(state.agent, state.me, state.snap, d.item)
        await refresh()
        return showSlip({ item: d.item, ink: 'out', stamp: `Out ${today}`, who: 'to you', line: 'Checked out. Scan it again when you give it back.' + shelfNote(L.poolOf(state.snap, code)) })
      }
      case 'checkin': {
        const { deleted } = await L.checkIn(state.agent, state.me, d.loan)
        await refresh()
        return showSlip({ item: d.item, ink: 'in', stamp: `Returned ${today}`, line: (deleted ? 'Checked in. Thank you.' : 'It was already checked in.') + shelfNote(L.poolOf(state.snap, code)) })
      }
    }
  })
}

async function checkInFor(loan) {
  const item = itemByUri(loan.value.subject.uri)
  const who = at(loan.did)
  await guarded(null, async () => {
    await L.checkInFor(state.agent, state.me, loan)
    await refresh()
    if (item) showSlip({ item, ink: 'in', stamp: `Returned ${fmtStamp(new Date().toISOString())}`, line: `Checked in for ${who}.` + shelfNote(L.poolOf(state.snap, item.value.barcode)) })
  })
}

async function checkInMine(loan) {
  await guarded(null, async () => {
    await L.checkIn(state.agent, state.me, loan)
    await refresh()
  })
}

// ── Rendering ────────────────────────────────────────────────────────────

// The bookplate: whose shelf this is. The handle, not the display name: it's
// the identity the records hang on, and display names are often slogans.
function renderHeader() {
  const handle = state.lib.handle ?? state.lib.did
  const name = $('lib-name')
  // Let a long handle break after its dots rather than mid-word.
  name.replaceChildren(...handle.split('.').flatMap((part, i, all) => (i < all.length - 1 ? [part + '.', el('wbr')] : [part])))
  name.classList.toggle('long', handle.length > 16)
  $('lib-line').textContent = 'Lending library'
  document.title = `Library · ${handle}`
}

let accountKey = null
function renderAccount() {
  // Rebuild only when something shown changes, so a refresh never wipes a
  // handle someone is halfway through typing.
  const role = state.snap && isOwner() ? 'your library' : ''
  const key = `${state.me}|${state.myHandle}|${role}`
  if (key === accountKey) return
  accountKey = key
  const box = $('account')
  if (state.me) {
    box.replaceChildren(
      el('span', { class: 'meta' }, 'Signed in as ', el('strong', {}, '@' + (state.myHandle ?? state.me)), role ? ` · ${role}` : ''),
      el('button', { type: 'button', class: 'link', onclick: signOut }, 'Sign out'),
    )
  } else {
    const input = el('input', { id: 'signin-handle', name: 'handle', placeholder: 'your.handle', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Your handle' })
    box.replaceChildren(
      el('form', { class: 'row', onsubmit: (e) => (e.preventDefault(), signIn(input.value)) }, input, el('button', { type: 'submit' }, 'Sign in to borrow')),
      el('p', { class: 'meta' }, 'Checkouts are public: each one is a record in your own repo.'),
    )
    attachTypeahead(input, (handle) => signIn(handle))
  }
}

// Handle suggestions under an input, as an ARIA combobox. Picking one calls onPick.
function attachTypeahead(input, onPick) {
  const list = el('ul', { class: 'typeahead', role: 'listbox', id: `${input.id}-list`, hidden: true })
  input.after(list)
  input.setAttribute('role', 'combobox')
  input.setAttribute('aria-autocomplete', 'list')
  input.setAttribute('aria-expanded', 'false')
  input.setAttribute('aria-controls', list.id)
  input.autocomplete = 'off'
  let actors = []
  let active = -1
  let timer
  let ctrl
  const close = () => {
    list.hidden = true
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
    active = -1
  }
  const pick = (i) => {
    input.value = actors[i].handle
    close()
    onPick(actors[i].handle)
  }
  const render = () => {
    list.replaceChildren(
      ...actors.map((a, i) =>
        el(
          'li',
          { role: 'option', id: `${list.id}-${i}`, 'aria-selected': String(i === active), onmousedown: (e) => (e.preventDefault(), pick(i)) },
          a.avatar ? el('img', { src: a.avatar, alt: '', loading: 'lazy' }) : el('span', { class: 'avatar', 'aria-hidden': 'true' }),
          el('span', { class: 'who' }, a.displayName ? el('strong', {}, a.displayName) : null, el('span', { class: 'meta' }, '@' + a.handle)),
        ),
      ),
    )
    list.hidden = !actors.length
    input.setAttribute('aria-expanded', String(!!actors.length))
    if (active >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${active}`)
    else input.removeAttribute('aria-activedescendant')
  }
  input.addEventListener('input', () => {
    clearTimeout(timer)
    ctrl?.abort()
    const q = input.value.trim().replace(/^@/, '')
    if (!q) return ((actors = []), close())
    timer = setTimeout(async () => {
      ctrl = new AbortController()
      try {
        actors = await L.searchActors(q, ctrl.signal)
        active = -1
        if (document.activeElement === input) render()
      } catch (e) {
        if (e.name !== 'AbortError') close()
      }
    }, 150)
  })
  input.addEventListener('keydown', (e) => {
    if (list.hidden || !actors.length) return
    if (e.key === 'ArrowDown') active = (active + 1) % actors.length
    else if (e.key === 'ArrowUp') active = (active - 1 + actors.length) % actors.length
    else if (e.key === 'Enter' && active >= 0) return e.preventDefault(), pick(active)
    else if (e.key === 'Escape') return close()
    else return
    e.preventDefault()
    render()
  })
  input.addEventListener('blur', () => setTimeout(close, 120))
}

const tabs = () => [...document.querySelectorAll('[role=tab]')].filter((t) => !t.hidden)

function renderTabs() {
  const owner = isOwner()
  for (const b of document.querySelectorAll('[role=tab]')) if (b.dataset.owner != null) b.hidden = !owner
  const mine = state.me ? L.openLoansOf(state.snap, state.me).length : 0
  $('count-borrowed').textContent = mine ? String(mine) : ''
  const titles = L.pools(state.snap).length
  $('count-catalog').textContent = titles ? String(titles) : ''
  const current = document.querySelector('[role=tab][aria-selected=true]')
  if (!current || current.hidden) showTab('scan')
}

function showTab(name, { focus = false } = {}) {
  for (const b of document.querySelectorAll('[role=tab]')) {
    const on = b.dataset.tab === name
    b.setAttribute('aria-selected', String(on))
    b.tabIndex = on ? 0 : -1
    if (on && focus) b.focus()
  }
  for (const p of document.querySelectorAll('[role=tabpanel]')) p.hidden = p.id !== `tab-${name}`
  if (scanScanner.running && name !== 'scan') stopScanCamera()
  if (addScanner.running && name !== 'add') stopAddCamera()
  if (name === 'scan' && !focus && matchMedia('(pointer: fine)').matches) $('scan-code').focus({ preventScroll: true })
}

function renderAll() {
  if (!state.snap) return
  renderAccount()
  renderTabs()
  renderCatalog()
  renderBorrowed()
}

function itemRow(item, extra = []) {
  return el(
    'li',
    { class: 'item' },
    thumb(item),
    el(
      'div',
      {},
      el('p', { class: 'title' }, item.value.title || '(untitled)'),
      el('p', { class: 'item-meta' }, el('span', { class: 'code' }, item.value.barcode), ...statusTag(item)),
      extra.length ? el('div', { class: 'actions' }, extra) : null,
    ),
  )
}

function emptyState(lines, action) {
  return el('div', { class: 'empty' }, lines.map((t) => el('p', {}, t)), action ? el('button', { type: 'button', class: 'primary', onclick: action[1] }, action[0]) : null)
}

// One row per title. A single copy shows its own status; a pool shows how
// many are in and who has the rest.
function poolRow(pool, extra = []) {
  const face = L.faceOf(pool)
  const n = pool.copies.length
  const status =
    n === 1
      ? statusTag(face)
      : [
          el('span', { class: pool.free.length ? 'tag in' : 'tag out' }, pool.free.length ? `${pool.free.length} of ${n} in` : `All ${n} out`),
          pool.loans.length ? el('span', { class: 'tag-note' }, 'out: ' + holders(pool)) : null,
        ]
  return el(
    'li',
    { class: 'item' },
    thumb(face),
    el(
      'div',
      {},
      el('p', { class: 'title' }, face.value.title || '(untitled)'),
      el('p', { class: 'item-meta' }, el('span', { class: 'code' }, face.value.barcode), ...status),
      extra.length ? el('div', { class: 'actions' }, extra) : null,
    ),
  )
}

function renderCatalog() {
  const q = $('catalog-filter').value.trim().toLowerCase()
  const title = (pool) => String(L.faceOf(pool).value.title)
  const all = L.pools(state.snap).sort((a, b) => title(a).localeCompare(title(b)))
  const shown = q ? all.filter((pool) => title(pool).toLowerCase().includes(q) || pool.code.includes(q)) : all
  const copies = state.snap.items.length
  const out = state.snap.items.filter((i) => L.holderOf(state.snap, i)).length
  const count = $('catalog-count')
  count.hidden = !copies
  count.textContent =
    (all.length === copies ? `${copies} item${copies === 1 ? '' : 's'}` : `${all.length} titles, ${copies} copies`) + ` · ${out} out · ${copies - out} on the shelf`
  $('catalog-filter').hidden = all.length < 6
  const list = $('catalog-list')
  if (!all.length) {
    list.replaceChildren(
      el(
        'li',
        {},
        isOwner()
          ? emptyState(['Your shelf is empty.', 'Add the first item: scan its barcode, take a photo, save.'], ['Add an item', () => showTab('add', { focus: true })])
          : emptyState([`Nothing on ${ownerAt()}'s shelf yet.`]),
      ),
    )
    return
  }
  if (!shown.length) return list.replaceChildren(el('li', {}, emptyState([`Nothing matches “${q}”.`])))
  list.replaceChildren(
    ...shown.map((pool) => {
      const extra = []
      if (isOwner()) {
        const mine = pool.loans.find((l) => l.did === state.me)
        if (mine) extra.push(el('button', { type: 'button', onclick: () => checkInMine(mine) }, 'Check in'))
        for (const [label, fn] of backButtons(pool)) extra.push(el('button', { type: 'button', onclick: fn }, label))
        if (pool.free.length) {
          const newest = [...pool.free].sort((a, b) => String(b.value.createdAt).localeCompare(String(a.value.createdAt)))[0]
          extra.push(el('button', { type: 'button', class: 'quiet', onclick: () => removeItem(newest, pool) }, pool.copies.length > 1 ? 'Remove a copy' : 'Remove'))
        }
      }
      return poolRow(pool, extra)
    }),
  )
}

function renderBorrowed() {
  const box = $('borrowed-list')
  if (!state.me) return box.replaceChildren(emptyState(['Sign in to see what you’ve borrowed.']))
  const open = L.openLoansOf(state.snap, state.me)
  const history = [
    ...state.snap.receipts.map((r) => ({ uri: r.value.subject?.uri, from: r.value.borrowedAt, to: r.value.returnedAt, owner: false })),
    ...L.closedLoansOf(state.snap, state.me).map((l) => ({ uri: l.value.subject?.uri, from: l.value.createdAt, to: state.snap.closed.get(l.uri).value.createdAt, owner: true })),
  ].sort((a, b) => String(b.to).localeCompare(String(a.to)))
  const kids = [el('h2', {}, 'Out with you')]
  if (!open.length) kids.push(emptyState(['Nothing right now. To borrow, scan an item’s barcode on the Scan tab.']))
  else
    kids.push(
      el(
        'ul',
        { class: 'items' },
        open.map((l) => itemRow(itemByUri(l.value.subject.uri), [el('button', { type: 'button', onclick: () => checkInMine(l) }, 'Give it back')])),
      ),
    )
  if (history.length) {
    kids.push(el('h2', {}, 'Your card'))
    kids.push(
      el(
        'table',
        { class: 'card' },
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Out'), el('th', { scope: 'col' }, 'Back'), el('th', { scope: 'col' }, 'Item'))),
        el(
          'tbody',
          {},
          history.map((h) => {
            const item = itemByUri(h.uri)
            return el(
              'tr',
              {},
              el('td', { class: 'date' }, fmtStamp(h.from)),
              el('td', { class: 'date' }, fmtStamp(h.to)),
              el('td', {}, item ? item.value.title : '(removed from the catalog)', h.owner ? el('span', { class: 'meta' }, ' · checked in by the library') : null),
            )
          }),
        ),
      ),
    )
  }
  box.replaceChildren(...kids)
}

// ── Owner actions ────────────────────────────────────────────────────────

async function removeItem(item, pool) {
  const n = pool?.copies.length ?? 1
  const ask = n > 1 ? `Remove one copy of "${item.value.title}"? ${n - 1} will remain.` : `Remove "${item.value.title}" from the catalog?`
  if (!confirm(ask)) return
  await guarded(null, async () => {
    await L.removeItem(state.agent, state.me, item)
    await refresh()
  })
}

function startAdd(code) {
  showTab('add')
  setAddCode(code)
  $('add-title').focus()
}

async function setAddCode(raw) {
  const code = L.normalizeCode(raw)
  $('add-code').value = code
  const copies = state.snap?.items.filter((i) => L.normalizeCode(i.value.barcode) === code).length ?? 0
  const status = $('add-status')
  status.dataset.tone = 'plain'
  status.textContent = copies ? `Already in the catalog (${copies === 1 ? 'one copy' : copies + ' copies'}). This adds another copy to the pool.` : ''
  const isbn = L.isbnOf(code)
  if (isbn && !$('add-title').value) {
    $('add-title').placeholder = 'Looking up the title…'
    const title = await L.lookupIsbn(isbn)
    $('add-title').placeholder = ''
    if (title && !$('add-title').value && $('add-code').value === code) $('add-title').value = title
  }
}

// Re-encoding drops EXIF, including GPS, before the photo goes into a public repo.
async function shrink(file, max = 1200) {
  const bmp = await createImageBitmap(file)
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = el('canvas', { width: Math.round(bmp.width * s), height: Math.round(bmp.height * s) })
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode the photo'))), 'image/jpeg', 0.85))
}

function resetPhoto() {
  const img = $('add-preview')
  if (img.src) URL.revokeObjectURL(img.src)
  img.removeAttribute('src')
  img.hidden = true
  $('add-photo-label').textContent = 'Take a photo'
}

async function submitAdd(e) {
  e.preventDefault()
  const status = $('add-status')
  await guarded(status, async () => {
    const file = $('add-photo').files[0]
    status.dataset.tone = 'plain'
    status.textContent = file ? 'Uploading the photo…' : 'Saving…'
    const photo = file ? await shrink(file) : null
    const title = $('add-title').value
    await L.addItem(state.agent, state.me, { barcode: $('add-code').value, title, notes: $('add-notes').value, photo })
    $('add-form').reset()
    resetPhoto()
    await refresh()
    status.dataset.tone = 'good'
    status.textContent = `Added “${title.trim()}”. Scan the next one, or check the Catalog tab.`
  })
}

// ── Wiring ───────────────────────────────────────────────────────────────

for (const b of document.querySelectorAll('[role=tab]')) b.addEventListener('click', () => showTab(b.dataset.tab))
// Tabs pattern: arrows move between tabs, Home and End jump to the ends.
document.querySelector('[role=tablist]').addEventListener('keydown', (e) => {
  const list = tabs()
  const i = list.indexOf(document.activeElement)
  if (i < 0) return
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: list.length - 1 }[e.key]
  if (next == null) return
  e.preventDefault()
  showTab(list[(next + list.length) % list.length].dataset.tab, { focus: true })
})

$('scan-cam').addEventListener('click', startScanCamera)
$('scan-stop').addEventListener('click', stopScanCamera)
$('add-cam').addEventListener('click', toggleAddCamera)

// Handheld scanners type the code and press Enter, so this form is also the
// fastest desk workflow.
$('scan-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const v = $('scan-code').value
  $('scan-code').value = ''
  onScan(v)
})

$('catalog-filter').addEventListener('input', () => state.snap && renderCatalog())
$('add-code').addEventListener('change', (e) => setAddCode(e.target.value))
$('add-photo').addEventListener('change', (e) => {
  const f = e.target.files[0]
  resetPhoto()
  if (!f) return
  const img = $('add-preview')
  img.src = URL.createObjectURL(f)
  img.hidden = false
  $('add-photo-label').textContent = 'Retake'
})
$('add-form').addEventListener('submit', submitAdd)

$('lib-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const v = $('lib-input').value.trim().replace(/^@/, '')
  if (v) location.search = `?library=${encodeURIComponent(v)}`
})
attachTypeahead($('lib-input'), (handle) => (location.search = `?library=${encodeURIComponent(handle)}`))

async function boot() {
  const param = new URLSearchParams(location.search).get('library')
  const wanted = param || store.get('library') || DEFAULT_LIBRARY
  $('lib-input').value = wanted
  const [auth, lib] = await Promise.allSettled([initAuth(), L.resolveIdentity(wanted)])
  if (auth.status === 'rejected') {
    console.error(auth.reason)
    notice(`Sign-in is unavailable: ${auth.reason?.message || auth.reason}`)
  }
  renderAccount()
  if (lib.status === 'rejected') {
    $('lib-name').textContent = 'No library here'
    $('lib-line').textContent = `Couldn't find "${wanted}": ${lib.reason?.message || lib.reason}`
    $('lib-change').open = true
    return
  }
  state.lib = lib.value
  store.set('library', wanted)
  renderHeader()
  try {
    await refresh()
  } catch (e) {
    notice(`Couldn't load the catalog: ${e.message}`)
  }
}

boot()
