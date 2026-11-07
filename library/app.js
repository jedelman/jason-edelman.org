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

const fmtDate = (iso) => {
  const d = new Date(iso)
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

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

function thumb(item, cls = 'thumb') {
  const src = item && L.blobUrl(state.lib, item.value?.photo)
  return src ? el('img', { class: cls, src, alt: '', loading: 'lazy' }) : el('div', { class: `${cls} blank`, 'aria-hidden': 'true' })
}

function outLine(item) {
  const loans = state.snap.active.get(item.uri) ?? []
  if (!loans.length) return 'Available.'
  const [first, ...rest] = loans
  const who = first.did === state.me ? 'you' : at(first.did)
  let s = `Out with ${who} since ${fmtDate(first.value.createdAt)}.`
  if (rest.length) s += ` Also claimed by ${rest.map((l) => at(l.did)).join(', ')}.`
  return s
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
  else if (n) notice(`Couldn't reach ${n} borrower repo${n === 1 ? '' : 's'}; some items may show as available when they aren't.`)
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
    if (statusEl) {
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
  if (e?.name === 'NotAllowedError') return 'Camera permission was denied.'
  if (e?.name === 'NotFoundError') return 'No camera found. Type the code, or use a handheld scanner.'
  return `Camera unavailable: ${e?.message || e}`
}

async function toggleCamera(scanner, finder, button, status) {
  if (scanner.running) {
    scanner.stop()
    finder.hidden = true
    button.textContent = button.dataset.idle
    return
  }
  finder.hidden = false
  button.textContent = 'Starting…'
  try {
    await scanner.start()
    button.textContent = 'Stop camera'
  } catch (e) {
    scanner.stop()
    finder.hidden = true
    button.textContent = button.dataset.idle
    status.textContent = cameraError(e)
    status.dataset.tone = 'bad'
  }
}

const scanScanner = new Scanner($('scan-video'), (code) => onScan(code))
const addScanner = new Scanner($('add-video'), (code) => {
  addScanner.stop()
  $('add-finder').hidden = true
  $('add-cam').textContent = $('add-cam').dataset.idle
  buzz()
  setAddCode(code)
})

// ── Scan tab: one scan checks out or checks in ───────────────────────────

function showResult({ item, code, line, tone, actions = [] }) {
  const box = $('scan-result')
  box.replaceChildren(
    el(
      'div',
      { class: 'result', 'data-tone': tone || 'plain' },
      item && L.blobUrl(state.lib, item.value?.photo) ? thumb(item, 'thumb big') : null,
      el(
        'div',
        {},
        el('p', { class: 'result-line' }, line),
        item ? el('p', { class: 'result-title' }, item.value.title) : null,
        el('p', { class: 'meta mono' }, item ? item.value.barcode : code),
        actions.length ? el('div', { class: 'actions' }, actions.map(([label, fn]) => el('button', { type: 'button', onclick: fn }, label))) : null,
      ),
    ),
  )
}

async function onScan(raw) {
  if (state.busy || !state.lib) return
  const code = L.normalizeCode(raw)
  if (!code) return
  buzz()
  showResult({ code, line: 'Checking…' })
  await guarded($('scan-result').querySelector('.result-line'), async () => {
    await refresh() // act on fresh status, not what was on screen
    const d = L.decide(state.snap, code, state.me)
    switch (d.kind) {
      case 'unknown':
        return showResult({ code, line: 'Not in this catalog.', actions: isOwner() ? [['Add it', () => startAdd(code)]] : [] })
      case 'signed-out':
        return showResult({ item: d.item, line: d.loan ? outLine(d.item) : 'Available. Sign in to check it out.' })
      case 'out':
        return showResult({
          item: d.item,
          line: outLine(d.item),
          tone: 'warn',
          actions: isOwner() ? [[`Check in for ${at(d.loan.did)}`, () => checkInFor(d.loan)]] : [],
        })
      case 'checkout':
        await L.checkOut(state.agent, state.me, state.snap, d.item)
        await refresh()
        return showResult({ item: d.item, line: 'Checked out to you.', tone: 'good' })
      case 'checkin':
        const { deleted } = await L.checkIn(state.agent, state.me, d.loan)
        await refresh()
        return showResult({ item: d.item, line: deleted ? 'Checked in. Thank you.' : 'Already checked in.', tone: 'good' })
    }
  })
}

async function checkInFor(loan) {
  const item = itemByUri(loan.value.subject.uri)
  const who = at(loan.did)
  await guarded(null, async () => {
    await L.checkInFor(state.agent, state.me, loan)
    await refresh()
    if (item) showResult({ item, line: `Checked in for ${who}.`, tone: 'good' })
  })
}

async function checkInMine(loan) {
  await guarded(null, async () => {
    await L.checkIn(state.agent, state.me, loan)
    await refresh()
  })
}

// ── Rendering ────────────────────────────────────────────────────────────

function renderHeader() {
  const line = $('lib-line')
  line.replaceChildren('Lending collection of ', el('strong', {}, ownerAt()))
}

let accountKey = null
function renderAccount() {
  // Rebuild only when something shown changes, so a refresh never wipes a
  // handle someone is halfway through typing.
  const role = state.snap && isOwner() ? 'owner' : ''
  const key = `${state.me}|${state.myHandle}|${role}`
  if (key === accountKey) return
  accountKey = key
  const box = $('account')
  if (state.me) {
    box.replaceChildren(
      el('span', {}, el('strong', {}, '@' + (state.myHandle ?? state.me)), role ? ` · ${role}` : ''),
      el('button', { type: 'button', class: 'link', onclick: signOut }, 'Sign out'),
    )
  } else {
    const input = el('input', { id: 'signin-handle', name: 'handle', placeholder: 'your.handle', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Your handle' })
    box.replaceChildren(
      el('form', { class: 'row', onsubmit: (e) => (e.preventDefault(), signIn(input.value)) }, input, el('button', { type: 'submit' }, 'Sign in')),
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
          a.avatar ? el('img', { src: a.avatar, alt: '', loading: 'lazy' }) : el('span', { class: 'avatar blank', 'aria-hidden': 'true' }),
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

function renderTabs() {
  const owner = isOwner()
  for (const b of document.querySelectorAll('[role=tab]')) if (b.dataset.owner != null) b.hidden = !owner
  const current = document.querySelector('[role=tab][aria-selected=true]')
  if (!current || current.hidden) showTab('scan')
}

function showTab(name) {
  for (const b of document.querySelectorAll('[role=tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === name))
  for (const p of document.querySelectorAll('[role=tabpanel]')) p.hidden = p.id !== `tab-${name}`
  for (const [s, f, b] of [
    [scanScanner, 'scan-finder', 'scan-cam'],
    [addScanner, 'add-finder', 'add-cam'],
  ]) {
    if (s.running) {
      s.stop()
      $(f).hidden = true
      $(b).textContent = $(b).dataset.idle
    }
  }
  if (name === 'scan' && matchMedia('(pointer: fine)').matches) $('scan-code').focus({ preventScroll: true })
}

function renderAll() {
  if (!state.snap) return
  renderAccount()
  renderTabs()
  renderCatalog()
  renderBorrowed()
}

function itemRow(item, extra = []) {
  const loan = L.holderOf(state.snap, item)
  return el(
    'li',
    { class: 'item' },
    thumb(item),
    el(
      'div',
      {},
      el('p', { class: 'title' }, item.value.title || '(untitled)'),
      el('p', { class: 'meta' }, el('span', { class: 'mono' }, item.value.barcode), ' · ', el('span', { class: loan ? 'out' : 'in' }, outLine(item))),
      extra.length ? el('div', { class: 'actions' }, extra) : null,
    ),
  )
}

function renderCatalog() {
  const q = $('catalog-filter').value.trim().toLowerCase()
  const all = [...state.snap.items].sort((a, b) => String(a.value.title).localeCompare(String(b.value.title)))
  const shown = q ? all.filter((i) => String(i.value.title).toLowerCase().includes(q) || String(i.value.barcode).includes(q)) : all
  const out = all.filter((i) => L.holderOf(state.snap, i)).length
  $('catalog-count').textContent = all.length ? `${all.length} item${all.length === 1 ? '' : 's'}, ${out} out` : ''
  const list = $('catalog-list')
  if (!all.length) {
    list.replaceChildren(el('li', { class: 'empty' }, isOwner() ? 'Nothing in the catalog yet. Use Add to catalog your first item.' : 'Nothing in the catalog yet.'))
    return
  }
  list.replaceChildren(
    ...shown.map((item) => {
      const extra = []
      if (isOwner()) {
        const loan = L.holderOf(state.snap, item)
        if (loan?.did === state.me) extra.push(el('button', { type: 'button', onclick: () => checkInMine(loan) }, 'Check in'))
        else if (loan) extra.push(el('button', { type: 'button', onclick: () => checkInFor(loan) }, `Check in for ${at(loan.did)}`))
        else extra.push(el('button', { type: 'button', class: 'quiet', onclick: () => removeItem(item) }, 'Remove'))
      }
      return itemRow(item, extra)
    }),
  )
}

function renderBorrowed() {
  const box = $('borrowed-list')
  if (!state.me) return box.replaceChildren(el('p', { class: 'empty' }, 'Sign in to see what you have out.'))
  const open = L.openLoansOf(state.snap, state.me)
  const history = [
    ...state.snap.receipts.map((r) => ({ uri: r.value.subject?.uri, from: r.value.borrowedAt, to: r.value.returnedAt, by: 'returned' })),
    ...L.closedLoansOf(state.snap, state.me).map((l) => ({ uri: l.value.subject?.uri, from: l.value.createdAt, to: state.snap.closed.get(l.uri).value.createdAt, by: 'checked in by the library' })),
  ].sort((a, b) => String(b.to).localeCompare(String(a.to)))
  const kids = [el('h2', {}, 'Out with you')]
  if (!open.length) kids.push(el('p', { class: 'empty' }, 'Nothing right now.'))
  else
    kids.push(
      el(
        'ul',
        { class: 'items' },
        open.map((l) => itemRow(itemByUri(l.value.subject.uri), [el('button', { type: 'button', onclick: () => checkInMine(l) }, 'Check in')])),
      ),
    )
  if (history.length) {
    kids.push(el('h2', {}, 'History'))
    kids.push(
      el(
        'ul',
        { class: 'history' },
        history.map((h) => {
          const item = itemByUri(h.uri)
          return el('li', {}, el('span', {}, item ? item.value.title : '(removed item)'), el('span', { class: 'meta' }, `${fmtDate(h.from)}, ${h.by} ${fmtDate(h.to)}`))
        }),
      ),
    )
  }
  box.replaceChildren(...kids)
}

// ── Owner actions ────────────────────────────────────────────────────────

async function removeItem(item) {
  if (!confirm(`Remove "${item.value.title}" from the catalog?`)) return
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
  status.textContent = copies ? `Already in the catalog (${copies}). Adding another copy.` : ''
  const isbn = L.isbnOf(code)
  if (isbn && !$('add-title').value) {
    $('add-title').placeholder = 'Looking up title…'
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

async function submitAdd(e) {
  e.preventDefault()
  const status = $('add-status')
  await guarded(status, async () => {
    const file = $('add-photo').files[0]
    status.dataset.tone = 'plain'
    status.textContent = file ? 'Uploading photo…' : 'Saving…'
    const photo = file ? await shrink(file) : null
    const title = $('add-title').value
    await L.addItem(state.agent, state.me, { barcode: $('add-code').value, title, notes: $('add-notes').value, photo })
    $('add-form').reset()
    $('add-preview').hidden = true
    await refresh()
    status.dataset.tone = 'good'
    status.textContent = `Added: ${title.trim()}.`
  })
}

// ── Wiring ───────────────────────────────────────────────────────────────

for (const b of document.querySelectorAll('[role=tab]')) b.addEventListener('click', () => showTab(b.dataset.tab))

$('scan-cam').addEventListener('click', () => toggleCamera(scanScanner, $('scan-finder'), $('scan-cam'), $('scan-result')))
$('add-cam').addEventListener('click', () => toggleCamera(addScanner, $('add-finder'), $('add-cam'), $('add-status')))

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
  const img = $('add-preview')
  if (img.src) URL.revokeObjectURL(img.src)
  img.hidden = !f
  if (f) img.src = URL.createObjectURL(f)
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
    $('lib-line').textContent = `Couldn't find a library at "${wanted}": ${lib.reason?.message || lib.reason}`
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
