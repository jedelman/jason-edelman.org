// Muster UI: OAuth via the official SDK (shared with the library), the map,
// the tally, posting, desks. Protocol logic lives in lib.js.
import { BrowserOAuthClient } from '../library/vendor/oauth-client-browser.js'
import * as L from './lib.js'

// The SDK's Agent loads only once someone signs in; reading needs plain GETs.
const API = '../library/vendor/atproto-api.js'
const MAPLIBRE = './vendor/maplibre-gl.mjs'
const STYLE = 'https://tiles.openfreemap.org/styles/dark'
const PHOTON = 'https://photon.komoot.io/api/'
const COLORS = { accent: '#60a563', warn: '#daa75d', bg: '#040504', text: '#cdd3cd' }
const US = { center: [-96, 38.5], zoom: 2.6 }

const state = {
  client: null, session: null, agent: null, me: null, myHandle: null,
  deskUri: null, desk: null, // desk: the loadDesk result, when viewing one
  actions: [], handles: new Map(), unreachable: [], loaded: false,
  issue: null, selected: null,
  map: null, mapReady: false, pick: null,
  myDesks: null, editingDesk: undefined, // undefined: no form; null: a new desk; a desk: editing it
}

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

const num = (n) => n.toLocaleString('en-US')
const plural = (n, one, many = one + 's') => `${num(n)} ${n === 1 ? one : many}`
const today = () => L.localDate()
function stamp(date) {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const mon = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return { day: `${mon} ${d}`, year: y === new Date().getFullYear() ? '' : String(y) }
}
const crowdLabel = (v) => L.CROWD.find((c) => c.value === v)?.label
const handleOf = (did) => state.handles.get(did)
const who = (did) => (did === state.me ? 'you' : handleOf(did) ? '@' + handleOf(did) : did.slice(0, 18) + '…')
const profileUrl = (did) => `https://bsky.app/profile/${handleOf(did) ?? did}`

function notice(msg) {
  const n = $('notice')
  n.textContent = msg || ''
  n.hidden = !msg
}

function setStatus(node, msg, tone = '') {
  node.textContent = msg
  node.dataset.tone = tone
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
  state.myDesks = null
  if (session) {
    L.verifiedHandles([session.did])
      .then((m) => {
        state.myHandle = m.get(session.did) ?? null
        if (state.myHandle) state.handles.set(session.did, state.myHandle)
        renderAccount()
      })
      .catch(() => {})
    loadMine()
  }
  renderAccount()
  renderPost()
  renderDesks()
  renderList()
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

// The signed-in person's own actions (read straight from their repo, so a
// fresh post shows before the relay indexes it) and desks.
async function loadMine() {
  const me = state.me
  try {
    const id = await L.resolveDid(me)
    const [acts, desks] = await Promise.all([L.listRecords(id.pds, me, L.COL.action), L.listRecords(id.pds, me, L.COL.desk)])
    if (state.me !== me) return
    state.myDesks = desks.map((d) => ({ ...d, did: me, value: L.readDesk(d.value) })).filter((d) => d.value)
    if (!state.desk) {
      const have = new Set(state.actions.map((a) => a.uri))
      for (const a of acts) {
        const value = L.readAction(a.value)
        if (value && !have.has(a.uri)) state.actions.push({ ...a, did: me, value })
      }
    }
  } catch (e) {
    console.warn('Could not read your repo', e)
    state.myDesks = []
  }
  renderDesks()
  renderAll()
}

let accountKey = null
function renderAccount() {
  const key = `${state.me}|${state.myHandle}`
  if (key === accountKey) return
  accountKey = key
  const box = $('account')
  if (state.me) {
    box.replaceChildren(
      el('span', { class: 'meta' }, 'Signed in as ', el('strong', {}, '@' + (state.myHandle ?? state.me))),
      el('button', { type: 'button', class: 'link', onclick: signOut }, 'Sign out'),
    )
  } else {
    const input = el('input', { id: 'signin-handle', name: 'handle', placeholder: 'your.handle', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Your handle' })
    box.replaceChildren(
      el('form', { class: 'row', onsubmit: (e) => (e.preventDefault(), signIn(input.value)) }, el('div', { class: 'combo' }, input), el('button', { type: 'submit' }, 'Sign in to post')),
      el('p', { class: 'meta' }, 'With a Bluesky account. Reading needs none.'),
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
    onPick(actors[i].handle, actors[i])
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

// ── Loading ──────────────────────────────────────────────────────────────

async function load() {
  const deskParam = new URLSearchParams(location.search).get('desk')
  try {
    let dids
    if (deskParam) {
      state.deskUri = await L.resolveDeskRef(deskParam)
      state.desk = await L.loadDesk(state.deskUri)
      dids = state.desk.dids
      if (state.desk.missing.length) notice(`Couldn't read ${plural(state.desk.missing.length, 'included desk')}; their posts are missing.`)
    } else {
      try {
        dids = await L.reposWithCollection(L.COL.action)
      } catch (e) {
        notice(`Couldn't reach the relay's index, so only your own posts can show: ${e.message}`)
        dids = []
      }
    }
    const { actions, handles, unreachable } = await L.loadActions(dids)
    const have = new Set(actions.map((a) => a.uri))
    state.actions = [...actions, ...state.actions.filter((a) => !have.has(a.uri))]
    for (const [k, v] of handles) state.handles.set(k, v)
    state.unreachable = unreachable
  } catch (e) {
    console.error(e)
    notice(deskParam ? `Couldn't open that desk: ${e.message}` : `Couldn't load: ${e.message}`)
  }
  state.loaded = true
  renderHeader()
  renderAll()
  fitToActions()
  renderDesks()
}

// ── Filtering and counting ───────────────────────────────────────────────

const byIssue = () => (state.issue ? state.actions.filter((a) => a.value.issues.includes(state.issue)) : state.actions)

let wholeWorld = true
function inView(a) {
  const map = state.map
  if (!state.mapReady || wholeWorld) return true
  const [lon, lat] = L.geohashCenter(a.value.area.geohash)
  return map.getBounds().contains([lon, lat])
}

const visible = () => byIssue().filter(inView)

function renderTally(list) {
  if (!state.loaded) return
  const p = L.pulse(list, { today: today() })
  $('t-actions').textContent = num(p.actions)
  $('t-areas').textContent = num(p.areas)
  $('t-floor').textContent = p.floor ? num(p.floor) : '–'
  $('t-soon').textContent = num(p.upcoming)
  const scope = [`Last ${p.days} days`]
  if (state.issue) scope.push(`“${state.issue}”`)
  scope.push(wholeWorld ? 'everywhere on the map' : 'in this part of the map')
  let line = scope.join(', ') + '.'
  if (p.actions && p.reported < p.actions) line += ` ${num(p.reported)} of ${num(p.actions)} reported a crowd.`
  if (state.unreachable.length) line += ` ${plural(state.unreachable.length, 'repo')} couldn't be reached.`
  $('tally-scope').textContent = line
}

function renderIssues() {
  const issues = L.topIssues(state.actions, 8)
  const chip = (label, value) =>
    el('button', { type: 'button', class: 'chip', 'aria-pressed': String(state.issue === value), onclick: () => setIssue(value) }, label)
  $('issues').replaceChildren(chip('all', null), ...issues.map((i) => chip(i, i)))
}

function setIssue(value) {
  state.issue = state.issue === value ? null : value
  renderIssues()
  updateMapData()
  renderCounts()
}

function renderCounts() {
  const list = visible()
  renderTally(list)
  renderList(list)
}

function renderAll() {
  renderIssues()
  updateMapData()
  renderCounts()
}

// ── Header ───────────────────────────────────────────────────────────────

function renderHeader() {
  if (state.desk) {
    const d = state.desk.desk
    $('title').textContent = d.value.name
    const owner = d.handle ? '@' + d.handle : d.did
    const vouched = state.desk.dids.filter((x) => x !== d.did).length
    $('subtitle').replaceChildren(
      `A desk kept by ${owner}, showing their posts and those of ${plural(vouched, 'poster')} it vouches for`,
      state.desk.desks.length > 1 ? `, through ${plural(state.desk.desks.length - 1, 'included desk')}` : '',
      '. ',
      el('a', { href: './' }, 'Open wire'),
    )
    document.title = `${d.value.name} · Muster`
  } else {
    $('title').textContent = 'Open wire'
    $('subtitle').textContent = 'Public actions, posted by the people in them, counted by area and week. Anyone can post here; a desk shows only what a collective vouches for.'
    document.title = 'Muster'
  }
}

// ── The list ─────────────────────────────────────────────────────────────

const confirming = new Set()

function actionItem(a) {
  const v = a.value
  const s = stamp(v.date)
  const soon = v.date > today()
  const mine = a.did === state.me
  const del = mine
    ? el('button', {
        type: 'button',
        class: 'link',
        onclick: async (e) => {
          if (!confirming.has(a.uri)) {
            confirming.add(a.uri)
            e.currentTarget.textContent = 'Really delete?'
            return
          }
          e.currentTarget.disabled = true
          try {
            await L.deleteAction(state.agent, state.me, a)
            state.actions = state.actions.filter((x) => x.uri !== a.uri)
            renderAll()
          } catch (err) {
            notice(`Couldn't delete: ${err.message}`)
            e.currentTarget.disabled = false
          }
        },
      }, confirming.has(a.uri) ? 'Really delete?' : 'Delete')
    : null
  const meta = [v.area.name, v.crowd ? crowdLabel(v.crowd) : null].filter(Boolean).join(' · ')
  return el(
    'li',
    { class: `action${soon ? ' soon' : ''}${state.selected === a.uri ? ' lit' : ''}`, 'data-uri': a.uri },
    el('div', { class: 'stamp' }, s.day, s.year ? el('small', {}, s.year) : soon ? el('small', {}, 'coming') : null),
    el(
      'div',
      {},
      el('h3', {}, el('button', { type: 'button', onclick: () => focusAction(a), title: 'Show on the map' }, v.title)),
      el('p', { class: 'meta' }, meta, ' · ', el('a', { href: profileUrl(a.did), target: '_blank', rel: 'noopener' }, who(a.did))),
      v.note ? el('p', { class: 'note' }, v.note) : null,
      v.issues.length ? el('p', { class: 'tags' }, v.issues.map((i) => el('span', {}, i))) : null,
      v.link || del ? el('p', { class: 'foot' }, v.link ? el('a', { href: v.link, target: '_blank', rel: 'noopener noreferrer nofollow ugc' }, 'Organizers’ link') : null, del) : null,
    ),
  )
}

function renderList(list = visible()) {
  if (!state.loaded) return
  const sorted = L.sortActions(list, today())
  $('count-actions').textContent = sorted.length ? String(sorted.length) : ''
  const box = $('actions')
  if (!sorted.length) {
    const lines = state.actions.length
      ? ['Nothing here for this filter or this part of the map.']
      : state.desk
        ? ['This desk has nothing to show yet.']
        : ['Nothing posted yet.', 'Sign in and post the first action: one you were at, or one the organizers have announced.']
    box.replaceChildren(el('li', { class: 'empty' }, lines.map((t) => el('p', {}, t))))
    return
  }
  box.replaceChildren(...sorted.slice(0, 200).map(actionItem))
}

function focusAction(a) {
  state.selected = a.uri
  if (state.mapReady) state.map.easeTo({ center: L.geohashCenter(a.value.area.geohash), zoom: Math.max(state.map.getZoom(), 9) })
  else renderList()
}

function selectFromMap(uri) {
  state.selected = uri
  showTab('actions')
  renderList()
  document.querySelector(`.action[data-uri="${CSS.escape(uri)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

// ── Map ──────────────────────────────────────────────────────────────────

function toGeoJSON(list) {
  const t = today()
  return {
    type: 'FeatureCollection',
    features: list.map((a) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: L.geohashCenter(a.value.area.geohash) },
      properties: { uri: a.uri, soon: a.value.date > t ? 1 : 0 },
    })),
  }
}

function cellPolygon(hash) {
  const b = L.geohashBounds(hash)
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[b.west, b.south], [b.east, b.south], [b.east, b.north], [b.west, b.north], [b.west, b.south]]] },
    properties: {},
  }
}

function updateMapData() {
  if (!state.mapReady) return
  state.map.getSource('actions').setData(toGeoJSON(byIssue()))
}

function updatePick() {
  if (!state.mapReady) return
  state.map.getSource('pick').setData({ type: 'FeatureCollection', features: state.pick ? [cellPolygon(state.pick)] : [] })
}

function fitToActions() {
  if (!state.mapReady || !state.loaded) return
  const pts = state.actions.map((a) => L.geohashCenter(a.value.area.geohash))
  if (!pts.length) return state.map.jumpTo(US)
  if (pts.length === 1) return state.map.jumpTo({ center: pts[0], zoom: 8 })
  let [w, s, e, n] = [180, 90, -180, -90]
  for (const [lon, lat] of pts) (w = Math.min(w, lon)), (e = Math.max(e, lon)), (s = Math.min(s, lat)), (n = Math.max(n, lat))
  state.map.fitBounds([[w, s], [e, n]], { padding: 48, maxZoom: 9, duration: 0 })
}

async function initMap() {
  let maplibre
  try {
    maplibre = await import(MAPLIBRE)
  } catch (e) {
    console.warn('Map unavailable', e)
    return hideMap()
  }
  let map
  try {
    map = new maplibre.Map({
      container: 'map',
      style: STYLE,
      ...US,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    })
  } catch (e) {
    console.warn('Map unavailable (WebGL?)', e)
    return hideMap()
  }
  state.map = map
  map.touchZoomRotate.disableRotation()
  map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right')
  map.on('error', (e) => console.warn('map', e.error?.message ?? e))
  map.on('load', () => {
    if (map.getLayer('background')) map.setPaintProperty('background', 'background-color', '#0a0c0a')
    map.addSource('actions', { type: 'geojson', data: toGeoJSON([]), cluster: true, clusterRadius: 42, clusterMaxZoom: 16, clusterProperties: { soon: ['+', ['get', 'soon']] } })
    map.addSource('pick', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'pick-fill', type: 'fill', source: 'pick', paint: { 'fill-color': COLORS.accent, 'fill-opacity': 0.18 } })
    map.addLayer({ id: 'pick-line', type: 'line', source: 'pick', paint: { 'line-color': COLORS.accent, 'line-width': 1.5 } })
    map.addLayer({
      id: 'clusters', type: 'circle', source: 'actions', filter: ['has', 'point_count'],
      paint: {
        'circle-color': COLORS.accent, 'circle-opacity': 0.82,
        'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'point_count']], 1, 11, 10, 34],
        'circle-stroke-width': ['case', ['>', ['get', 'soon'], 0], 2.5, 1],
        'circle-stroke-color': ['case', ['>', ['get', 'soon'], 0], COLORS.warn, COLORS.bg],
      },
    })
    map.addLayer({
      id: 'cluster-count', type: 'symbol', source: 'actions', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-allow-overlap': true },
      paint: { 'text-color': COLORS.bg },
    })
    map.addLayer({
      id: 'point', type: 'circle', source: 'actions', filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['case', ['==', ['get', 'soon'], 1], COLORS.warn, COLORS.accent],
        'circle-radius': 7, 'circle-stroke-width': 1, 'circle-stroke-color': COLORS.bg,
      },
    })
    state.mapReady = true
    updateMapData()
    updatePick()
    fitToActions()
  })
  map.on('moveend', () => {
    wholeWorld = map.getZoom() < 2.2
    renderCounts()
  })
  map.on('click', async (e) => {
    if (pickingActive()) {
      state.pick = L.geohashEncode(e.lngLat.lat, e.lngLat.lng)
      updatePick()
      renderPickStatus()
      return
    }
    const [cluster] = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
    if (cluster) {
      const zoom = await map.getSource('actions').getClusterExpansionZoom(cluster.properties.cluster_id)
      const target = Math.min(zoom, 16)
      if (target > map.getZoom() + 0.1) return map.easeTo({ center: cluster.geometry.coordinates, zoom: target })
      // Everything here sits in one cell: list it.
      const leaves = await map.getSource('actions').getClusterLeaves(cluster.properties.cluster_id, 1, 0)
      if (leaves[0]) selectFromMap(leaves[0].properties.uri)
      return
    }
    const [point] = map.queryRenderedFeatures(e.point, { layers: ['point'] })
    if (point) selectFromMap(point.properties.uri)
  })
  for (const layer of ['clusters', 'point']) {
    map.on('mouseenter', layer, () => !pickingActive() && (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
  }
}

function hideMap() {
  $('map').hidden = true
  $('map-hint').textContent = 'The map needs WebGL, which this browser has turned off. The counts cover everything.'
}

// ── Tabs ─────────────────────────────────────────────────────────────────

const tabs = () => [...document.querySelectorAll('[role=tab]')]
const currentTab = () => document.querySelector('[role=tab][aria-selected=true]')?.dataset.tab
const pickingActive = () => currentTab() === 'post' && !!state.me

function showTab(name, { focus = false } = {}) {
  for (const b of tabs()) {
    const on = b.dataset.tab === name
    b.setAttribute('aria-selected', String(on))
    b.tabIndex = on ? 0 : -1
    if (on && focus) b.focus()
  }
  for (const p of document.querySelectorAll('[role=tabpanel]')) p.hidden = p.id !== `tab-${name}`
  $('map').classList.toggle('picking', pickingActive())
  $('map-hint').textContent = pickingActive() ? 'Tap the map where the action is. Muster keeps a square about 5 km across.' : 'Move the map to count a region.'
  if (state.mapReady && !$('map').hidden) $('map-hint').hidden = false
}

function initTabs() {
  for (const b of tabs()) b.addEventListener('click', () => showTab(b.dataset.tab))
  document.querySelector('[role=tablist]').addEventListener('keydown', (e) => {
    const list = tabs()
    const i = list.findIndex((t) => t.getAttribute('aria-selected') === 'true')
    let j
    if (e.key === 'ArrowRight') j = (i + 1) % list.length
    else if (e.key === 'ArrowLeft') j = (i - 1 + list.length) % list.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = list.length - 1
    else return
    e.preventDefault()
    showTab(list[j].dataset.tab, { focus: true })
  })
}

// ── Posting ──────────────────────────────────────────────────────────────

let pickStatusEl = null
function renderPickStatus() {
  if (!pickStatusEl) return
  pickStatusEl.textContent = state.pick ? `Area set: square ${state.pick}` : 'No area yet: tap the map.'
  pickStatusEl.classList.toggle('set', !!state.pick)
}

async function findPlace(query) {
  const q = new URLSearchParams({ q: query, limit: '1', lang: 'en' })
  const res = await fetch(`${PHOTON}?${q}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const { features } = await res.json()
  const f = features?.[0]
  if (!f) return null
  const [lon, lat] = f.geometry.coordinates
  const p = f.properties
  return { lat, lon, label: [p.name, p.state, p.countrycode].filter(Boolean).join(', ') }
}

function renderPost() {
  const box = $('tab-post')
  if (!state.me) {
    box.replaceChildren(
      el('div', { class: 'empty' }, el('p', {}, 'Sign in above to post an action. It becomes a record in your own repo, which you can delete.')),
    )
    showTab(currentTab() ?? 'actions')
    return
  }
  const title = el('input', { id: 'f-title', required: true, maxlength: 140, placeholder: 'Weekly Tesla Takedown' })
  const date = el('input', { id: 'f-date', type: 'date', required: true, value: today() })
  const crowd = el('select', { id: 'f-crowd' }, el('option', { value: '' }, 'Not sure, or not yet'), L.CROWD.map((c) => el('option', { value: c.value }, `${c.label} (${c.value})`)))
  const place = el('input', { id: 'f-place', required: true, maxlength: 80, placeholder: 'Cherry Hill, NJ' })
  const findBtn = el('button', { type: 'button' }, 'Find')
  pickStatusEl = el('p', { class: 'picked', 'aria-live': 'polite' })
  renderPickStatus()
  const link = el('input', { id: 'f-link', type: 'url', placeholder: 'https://…', inputmode: 'url' })
  const note = el('textarea', { id: 'f-note', rows: 2, maxlength: 300, placeholder: 'Optional' })
  const chosen = new Set()
  const issueBox = el('div', { class: 'issues', style: 'margin-top:0' })
  const extra = el('input', { id: 'f-issue', placeholder: 'another issue', maxlength: 32, 'aria-label': 'Add another issue' })
  const renderChoices = () => {
    const opts = [...new Set([...L.topIssues(state.actions, 8), ...chosen])]
    issueBox.replaceChildren(
      ...opts.map((i) =>
        el('button', {
          type: 'button', class: 'chip', 'aria-pressed': String(chosen.has(i)),
          onclick: () => {
            if (chosen.has(i)) chosen.delete(i)
            else if (chosen.size < 4) chosen.add(i)
            renderChoices()
          },
        }, i),
      ),
    )
  }
  renderChoices()
  const addIssue = () => {
    const i = L.normalizeIssue(extra.value)
    if (i && chosen.size < 4) chosen.add(i)
    extra.value = ''
    renderChoices()
  }
  extra.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), addIssue()))
  const status = el('p', { class: 'status', role: 'status' })
  const submit = el('button', { type: 'submit' }, 'Post it')

  findBtn.addEventListener('click', async () => {
    if (!place.value.trim()) return setStatus(status, 'Type a place name first.', 'bad')
    setStatus(status, 'Looking it up…')
    try {
      const hit = await findPlace(place.value.trim())
      if (!hit) return setStatus(status, 'No match. Tap the map instead.', 'bad')
      state.pick = L.geohashEncode(hit.lat, hit.lon)
      updatePick()
      renderPickStatus()
      if (state.mapReady) state.map.easeTo({ center: [hit.lon, hit.lat], zoom: 10 })
      setStatus(status, `Found ${hit.label}. Tap the map to adjust.`)
    } catch (e) {
      setStatus(status, `Lookup failed (${e.message}). Tap the map instead.`, 'bad')
    }
  })

  const form = el(
    'form',
    {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault()
        if (extra.value.trim()) addIssue()
        submit.disabled = true
        setStatus(status, 'Posting…')
        try {
          const fields = { title: title.value, date: date.value, geohash: state.pick, place: place.value, issues: [...chosen], crowd: crowd.value, link: link.value, note: note.value }
          const record = L.makeAction(fields) // check before writing
          const { data } = await L.postAction(state.agent, state.me, fields)
          const posted = { uri: data.uri, cid: data.cid, rkey: data.uri.split('/').pop(), did: state.me, value: L.readAction(record) }
          const shown = !state.desk || state.desk.dids.includes(state.me)
          if (shown) state.actions.push(posted)
          state.pick = null
          updatePick()
          renderPost()
          renderAll()
          if (shown) {
            showTab('actions')
            focusAction(posted)
            notice('Posted. It lives in your repo; delete it from the list any time.')
          } else notice('Posted to your repo. This desk doesn’t vouch for you, so it won’t show here; it’s on the open wire.')
        } catch (err) {
          setStatus(status, err.message, 'bad')
          submit.disabled = false
        }
      },
    },
    el('div', { class: 'field' }, el('label', { for: 'f-title' }, 'What'), title),
    el('div', { class: 'two' },
      el('div', { class: 'field' }, el('label', { for: 'f-date' }, 'When'), date),
      el('div', { class: 'field' }, el('label', { for: 'f-crowd' }, 'How many'), crowd),
    ),
    el('div', { class: 'field' },
      el('label', { for: 'f-place' }, 'Where'),
      el('div', { class: 'row' }, place, findBtn),
      pickStatusEl,
      el('p', { class: 'meta' }, 'A town or neighbourhood, not an address. Find it, or tap the map.'),
    ),
    el('div', { class: 'field' }, el('span', { class: 'label' }, 'Issues'), issueBox, extra, el('p', { class: 'meta' }, 'Up to four.')),
    el('div', { class: 'field' }, el('label', { for: 'f-link' }, 'Organizers’ link'), link, el('p', { class: 'meta' }, 'Their own announcement or a report, so people can check it before they go.')),
    el('div', { class: 'field' }, el('label', { for: 'f-note' }, 'Note'), note),
    el('p', { class: 'warning' }, 'This is public and permanent. Post only what the organizers already made public. Never post who is in a group or anything that could identify someone at risk.'),
    el('div', { class: 'row' }, submit),
    status,
  )
  box.replaceChildren(form)
  showTab(currentTab() ?? 'actions')
}

// ── Desks ────────────────────────────────────────────────────────────────

const deskLink = (d) => `${location.origin}${location.pathname}?desk=${encodeURIComponent(L.deskRef(d))}`

function deskCard(info) {
  const d = info.desk
  const owner = d.handle ? '@' + d.handle : d.did
  const vouched = info.dids.filter((x) => x !== d.did)
  const copy = el('button', {
    type: 'button', class: 'link',
    onclick: async (e) => {
      try {
        await navigator.clipboard.writeText(deskLink(d))
        e.currentTarget.textContent = 'Copied'
      } catch {
        e.currentTarget.textContent = deskLink(d)
      }
    },
  }, 'Copy this desk’s link')
  return el(
    'div',
    { class: 'desk-card' },
    el('h3', {}, d.value.name),
    el('p', { class: 'meta' }, `Kept by ${owner}`),
    d.value.about ? el('p', {}, d.value.about) : null,
    el('details', {}, el('summary', {}, `Vouches for ${plural(vouched.length, 'poster')}`), el('ul', {}, vouched.map((x) => el('li', {}, el('a', { href: profileUrl(x), target: '_blank', rel: 'noopener' }, handleOf(x) ? '@' + handleOf(x) : x))))),
    info.desks.length > 1
      ? el('details', {}, el('summary', {}, `Includes ${plural(info.desks.length - 1, 'desk')}`), el('ul', {}, info.desks.slice(1).map((x) => el('li', {}, el('a', { href: `?desk=${encodeURIComponent(L.deskRef(x))}` }, x.value.name), ` (${x.handle ? '@' + x.handle : x.did})`))))
      : null,
    el('p', {}, copy),
  )
}

function renderDesks() {
  const box = $('tab-desks')
  const kids = []
  if (state.desk) kids.push(el('p', { class: 'section-title' }, 'This desk'), deskCard(state.desk))
  else kids.push(el('p', {}, 'A desk is a collective’s public list of the posters it vouches for, and the other desks it trusts. Open one to see only what it vouches for. A regional desk is a desk that includes local ones.'))

  const ref = el('input', { id: 'desk-ref', placeholder: 'Paste a desk link', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Desk link' })
  const openStatus = el('p', { class: 'status', role: 'status' })
  kids.push(
    el('p', { class: 'section-title' }, 'Open a desk'),
    el('form', {
      class: 'row',
      onsubmit: async (e) => {
        e.preventDefault()
        try {
          const uri = await L.resolveDeskRef(ref.value)
          const p = L.parseAtUri(uri)
          location.search = `?desk=${encodeURIComponent(p ? uri : ref.value)}`
        } catch (err) {
          setStatus(openStatus, err.message, 'bad')
        }
      },
    }, ref, el('button', { type: 'submit' }, 'Open')),
    openStatus,
  )

  if (state.me) {
    kids.push(el('p', { class: 'section-title' }, 'Your desks'))
    if (state.myDesks === null) kids.push(el('p', { class: 'meta' }, 'Loading…'))
    else {
      if (!state.myDesks.length && state.editingDesk === undefined) kids.push(el('p', { class: 'meta' }, 'None yet.'))
      for (const d of state.myDesks) {
        const dd = { ...d, handle: state.myHandle }
        kids.push(
          el('div', { class: 'desk-card' },
            el('h3', {}, d.value.name),
            el('p', { class: 'meta' }, `Vouches for ${plural(d.value.vouches.length, 'poster')}`, d.value.includes.length ? `, includes ${plural(d.value.includes.length, 'desk')}` : ''),
            el('p', { class: 'foot', style: 'display:flex;gap:16px;flex-wrap:wrap' },
              el('a', { href: `?desk=${encodeURIComponent(L.deskRef(dd))}` }, 'Open'),
              el('button', { type: 'button', class: 'link', onclick: () => ((state.editingDesk = d), renderDesks()) }, 'Edit'),
              deleteDeskButton(d),
            ),
          ),
        )
      }
      if (state.editingDesk !== undefined) kids.push(deskForm(state.editingDesk))
      else kids.push(el('div', {}, el('button', { type: 'button', class: 'primary', onclick: () => ((state.editingDesk = null), renderDesks()) }, 'Start a desk')))
    }
  } else kids.push(el('p', { class: 'meta' }, 'Sign in to start a desk.'))
  box.replaceChildren(...kids)
}

function deleteDeskButton(d) {
  let armed = false
  const b = el('button', {
    type: 'button', class: 'link',
    onclick: async () => {
      if (!armed) return ((armed = true), (b.textContent = 'Really delete?'))
      b.disabled = true
      try {
        await L.deleteDesk(state.agent, state.me, d)
        state.myDesks = state.myDesks.filter((x) => x.uri !== d.uri)
        renderDesks()
      } catch (e) {
        notice(`Couldn't delete the desk: ${e.message}`)
        b.disabled = false
      }
    },
  }, 'Delete')
  return b
}

function deskForm(existing) {
  const v = existing?.value
  const name = el('input', { id: 'd-name', required: true, maxlength: 64, value: v?.name ?? '', placeholder: 'Hampton Roads' })
  const about = el('textarea', { id: 'd-about', rows: 2, maxlength: 300, placeholder: 'Who keeps this desk, and what it covers' })
  about.value = v?.about ?? ''
  const vouches = new Map((v?.vouches ?? []).map((d) => [d, handleOf(d) ? '@' + handleOf(d) : d]))
  const includes = new Map((v?.includes ?? []).map((u) => [u, u]))
  const status = el('p', { class: 'status', role: 'status' })

  const vouchPills = el('div', { class: 'pills' })
  const incPills = el('div', { class: 'pills' })
  const pills = (box, map) =>
    box.replaceChildren(...[...map.entries()].map(([k, label]) => el('span', { class: 'pill' }, label, el('button', { type: 'button', 'aria-label': `Remove ${label}`, onclick: () => (map.delete(k), pills(box, map)) }, '×'))))
  pills(vouchPills, vouches)
  pills(incPills, includes)

  const vouchInput = el('input', { id: 'd-vouch', placeholder: 'their.handle', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Vouch for a handle' })
  const addVouch = async (handle) => {
    try {
      const id = await L.resolveIdentity(handle || vouchInput.value)
      vouches.set(id.did, '@' + (id.handle ?? id.did))
      vouchInput.value = ''
      pills(vouchPills, vouches)
      setStatus(status, '')
    } catch (e) {
      setStatus(status, `Couldn't find that account: ${e.message}`, 'bad')
    }
  }
  const inc = el('input', { id: 'd-include', placeholder: 'Paste another desk’s link', autocapitalize: 'none', spellcheck: 'false', 'aria-label': 'Include a desk' })
  const addInclude = async () => {
    try {
      const uri = await L.resolveDeskRef(inc.value)
      if (existing && uri === existing.uri) throw new Error('A desk can’t include itself.')
      const info = await L.loadDesk(uri)
      includes.set(uri, info.desk.value.name)
      inc.value = ''
      pills(incPills, includes)
      setStatus(status, '')
    } catch (e) {
      setStatus(status, e.message, 'bad')
    }
  }
  const save = el('button', { type: 'submit' }, existing ? 'Save desk' : 'Create desk')
  const form = el(
    'form',
    {
      class: 'stack desk-card',
      onsubmit: async (e) => {
        e.preventDefault()
        save.disabled = true
        setStatus(status, 'Saving…')
        try {
          const fields = { name: name.value, about: about.value, vouches: [...vouches.keys()], includes: [...includes.keys()] }
          const { data } = await L.saveDesk(state.agent, state.me, fields, existing)
          state.editingDesk = undefined
          const rkey = data.uri.split('/').pop()
          location.search = `?desk=${encodeURIComponent(state.myHandle ? `${state.myHandle}/${rkey}` : data.uri)}`
        } catch (err) {
          setStatus(status, err.message, 'bad')
          save.disabled = false
        }
      },
    },
    el('h3', {}, existing ? `Edit ${v.name}` : 'Start a desk'),
    el('div', { class: 'field' }, el('label', { for: 'd-name' }, 'Name'), name),
    el('div', { class: 'field' }, el('label', { for: 'd-about' }, 'About'), about),
    el('div', { class: 'field' },
      el('label', { for: 'd-vouch' }, 'Vouch for'),
      el('div', { class: 'row' }, el('div', { class: 'combo' }, vouchInput), el('button', { type: 'button', onclick: () => addVouch() }, 'Add')),
      vouchPills,
      el('p', { class: 'meta' }, 'Posters whose actions you know are real. Your own always show. This list is public: it says their posts are real, not that they belong to anything.'),
    ),
    el('div', { class: 'field' },
      el('label', { for: 'd-include' }, 'Include desks'),
      el('div', { class: 'row' }, inc, el('button', { type: 'button', onclick: addInclude }, 'Add')),
      incPills,
      el('p', { class: 'meta' }, 'Everything those desks vouch for shows here too, three levels down.'),
    ),
    el('div', { class: 'row' }, save, el('button', { type: 'button', class: 'quiet', onclick: () => ((state.editingDesk = undefined), renderDesks()) }, 'Cancel')),
    status,
  )
  queueMicrotask(() => attachTypeahead(vouchInput, (handle) => addVouch(handle)))
  return form
}

// ── Start ────────────────────────────────────────────────────────────────

initTabs()
if (new URLSearchParams(location.search).get('desk')) {
  $('title').textContent = 'Opening desk…'
  $('subtitle').textContent = ''
}
renderAccount()
renderPost()
renderDesks()
initMap()
initAuth().catch((e) => {
  console.error(e)
  notice(`Sign-in is unavailable right now: ${e.message}`)
})
load()
