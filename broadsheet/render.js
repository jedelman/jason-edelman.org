// Renders a broadsheet into a .paper element. Used by the reader and by the
// builder's live preview; in the builder, `edit` wraps every slot (empty ones
// included) with drop targets and a small toolbar.
import { excerpt, LAYOUT } from './lib.js'

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v)
    else if (k === 'class') n.className = v
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? n.style.setProperty(sk, sv) : (n.style[sk] = sv)
    else n.setAttribute(k, v === true ? '' : v)
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : String(k))
  return n
}

// ── Colour: each publication's own accent for its kicker, darkened (or, at
// night, lightened) until it reads at 4.5:1 on the paper. ──────────────────

const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
function readable(rgb, bg, toward) {
  for (let t = 0; t <= 1; t += 0.05) {
    const c = mix(rgb, toward, t)
    if (contrast(c, bg) >= 4.5) return `rgb(${c.join(' ')})`
  }
  return `rgb(${toward.join(' ')})`
}
const DAY = { bg: [246, 243, 236], ink: [36, 31, 26] }
const NIGHT = { bg: [33, 30, 26], ink: [236, 232, 225] }
function kickerColors(accent) {
  if (!accent) return {}
  return { '--k-day': readable(accent, DAY.bg, DAY.ink), '--k-night': readable(accent, NIGHT.bg, NIGHT.ink) }
}

// ── Pieces ───────────────────────────────────────────────────────────────

const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
export const fmtDate = (iso, long = false) =>
  new Date(iso).toLocaleDateString('en-US', long ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' })

function img(urls, size, alt = '') {
  if (!urls) return null
  const i = el('img', { src: size === 'full' ? urls.full : urls.thumb, alt, loading: 'lazy', decoding: 'async' })
  i.addEventListener('error', () => {
    // CDN miss: fall back to the thumbnail, then give up quietly.
    if (size === 'full' && i.src !== urls.thumb) i.src = urls.thumb
    else i.closest('.art')?.remove()
  })
  return i
}

// Headline size for the lead, from its length: short headlines get big.
function leadSize(text) {
  const n = text.length
  return n < 32 ? '4.1rem' : n < 56 ? '3.5rem' : n < 90 ? '2.9rem' : '2.4rem'
}

// Excerpt lengths by slot: the editor and reader (page), the newsstand rack
// (stand, kept short so a whole page fits a screen), and an expanded story.
const BODY = {
  page: { lead: 900, second: 260, feature: 0, brief: 0 },
  stand: { lead: 520, second: 170, feature: 0, brief: 0 },
}

// The body minus an opening that just repeats the deck (many platforms use the
// first sentence as the description).
function withoutLead(text, dek) {
  const norm = (x) => String(x ?? '').replace(/\s+/g, ' ').trim()
  const t = norm(text)
  const d = norm(dek).replace(/…$/, '')
  if (d.length > 12 && t.toLowerCase().startsWith(d.toLowerCase())) return t.slice(d.length).replace(/^[\s.,;:–—-]+/, '')
  return t
}

function author(doc) {
  const c = doc.contributors.find((x) => x.displayName)
  return c?.displayName || doc.author?.displayName || (doc.author?.handle ? '@' + doc.author.handle : '')
}

export function story(slot, variant = 'page') {
  const { role, doc } = slot
  const lengths = BODY[variant] ?? BODY.page
  if (!doc) {
    return el('article', { class: `story ${role}` }, el('p', { class: 'gone' }, 'This piece is no longer available.'))
  }
  const hed = slot.headline || doc.title
  const dek = slot.deck || doc.description
  const href = doc.url
  const wantArt = role !== 'brief' && doc.cover
  const bodyText = lengths[role] ? excerpt(withoutLead(doc.text, dek) || (slot.deck ? doc.description : ''), lengths[role]) : ''
  const a = (kids, cls) => (href ? el('a', { href, class: cls, target: '_blank', rel: 'noopener' }, kids) : el('span', { class: cls }, kids))
  const art = wantArt ? el('div', { class: 'art' }, a(img(doc.cover, role === 'lead' ? 'full' : 'thumb'))) : null
  const kids = [
    el('p', { class: 'kicker', style: kickerColors(doc.pub?.accent) }, doc.pub?.icon ? img(doc.pub.icon, 'thumb') : null, el('span', {}, doc.pubName || 'standard.site')),
    el('h2', { class: 'hed' }, a(hed)),
    dek && role !== 'brief' ? el('p', { class: 'dek' }, excerpt(dek, role === 'lead' ? 320 : 200)) : null,
    dek && role === 'brief' ? el('p', { class: 'dek' }, excerpt(dek, 110)) : null,
    art,
    bodyText ? el('p', { class: 'body' }, bodyText) : null,
    role !== 'brief' ? el('p', { class: 'byline' }, author(doc) ? el('span', { class: 'who' }, author(doc)) : null, el('span', {}, fmtDate(doc.publishedAt)), doc.words > 150 ? el('span', {}, `${Math.max(1, Math.round(doc.words / 230))} min`) : null) : el('p', { class: 'byline' }, el('span', {}, fmtDate(doc.publishedAt))),
    role === 'lead' || role === 'second' ? (href ? el('a', { class: 'more', href, target: '_blank', rel: 'noopener' }, `Continue at ${host(href)} →`) : null) : null,
  ]
  const node = el('article', { class: `story ${role}${art ? ' with-art' : ''}` }, kids)
  if (role === 'lead') node.style.setProperty('--hed-size', leadSize(hed))
  return node
}

// model: { masthead, number, publishedAt, editor: { handle, displayName }, note,
//          slots: [{ role, doc, headline, deck, slotId?, label? }] }
// edit (builder only): { wrap(slot, storyNode|null) -> Node }
// variant: 'page' or 'stand'. Returns the slots as rendered; in the reader
// each story carries data-i, its index in that list.
export function renderPaper(root, model, edit = null, variant = 'page') {
  // In the reader, a piece its author deleted drops out; if that was the lead,
  // the next piece moves up.
  let filled = edit ? model.slots : model.slots.filter((s) => s.doc)
  if (!edit && filled.length && filled[0].role !== 'lead') filled = [{ ...filled[0], role: 'lead' }, ...filled.slice(1)]
  const byRole = (r) => filled.filter((s) => s.role === r)
  const pieces = (r) =>
    byRole(r).map((s) => {
      if (edit) return edit.wrap(s, s.doc ? story(s) : null)
      const n = story(s, variant)
      n.dataset.i = String(filled.indexOf(s))
      return n
    })
  const pubs = new Set(model.slots.filter((s) => s.doc).map((s) => s.doc.pubName))
  const editor = model.editor?.handle ? '@' + model.editor.handle : model.editor?.displayName || ''
  const seconds = pieces('second')
  const features = pieces('feature')
  const briefs = pieces('brief')
  const hasSeconds = edit ? true : seconds.length > 0
  root.replaceChildren(
    ...[
    el(
      'header',
      { class: 'mast' },
      el('div', { class: 'mast-top' }, el('span', {}, model.number ? `No. ${model.number}` : 'Broadsheet'), el('span', {}, fmtDate(model.publishedAt || new Date().toISOString(), true)), el('span', {}, 'Syndicated from standard.site')),
      el('h1', { class: 'mast-name' }, model.masthead || 'Broadsheet'),
      el('div', { class: 'mast-bottom' }, el('span', {}, ((n) => `${n} piece${n === 1 ? '' : 's'}`)(model.slots.filter((s) => s.doc).length)), el('span', {}, editor ? `Edited by ${editor}` : ''), el('span', {}, `${pubs.size} publication${pubs.size === 1 ? '' : 's'}`)),
    ),
    model.note ? el('p', { class: 'note' }, model.note) : null,
    el(
      'section',
      { class: `front${hasSeconds ? '' : ' solo'}` },
      pieces('lead'),
      hasSeconds ? el('div', { class: 'seconds' }, seconds) : null,
      features.length ? el('div', { class: 'features', style: { '--n': String(features.length) } }, features) : null,
      briefs.length ? el('div', { class: 'briefs', style: { '--n': String(briefs.length) } }, el('p', { class: 'briefs-label' }, 'Also worth your time'), briefs) : null,
    ),
    ].filter(Boolean), // replaceChildren would print a null as the text "null"
  )
  return filled
}

export const ROLE_ORDER = LAYOUT.map((l) => l.role)

// One story, expanded to read: the newsstand's zoom. A longer excerpt, the
// cover at full size, and the way to the author's own site.
export function expandedStory(slot) {
  const { doc } = slot
  if (!doc) return el('article', { class: 'story' }, el('p', { class: 'gone' }, 'This piece is no longer available.'))
  const hed = slot.headline || doc.title
  const dek = slot.deck || doc.description
  const body = excerpt(withoutLead(doc.text, dek), 1300)
  return el(
    'article',
    { class: 'story' },
    el('p', { class: 'kicker', style: kickerColors(doc.pub?.accent) }, doc.pub?.icon ? img(doc.pub.icon, 'thumb') : null, el('span', {}, doc.pubName || 'standard.site')),
    el('h2', { class: 'hed' }, hed),
    dek ? el('p', { class: 'dek' }, excerpt(dek, 400)) : null,
    doc.cover ? el('div', { class: 'art' }, img(doc.cover, 'full')) : null,
    body ? el('p', { class: 'body' }, body) : null,
    el('p', { class: 'byline' }, author(doc) ? el('span', { class: 'who' }, author(doc)) : null, el('span', {}, fmtDate(doc.publishedAt)), doc.words > 150 ? el('span', {}, `${Math.max(1, Math.round(doc.words / 230))} min read`) : null),
    doc.url ? el('a', { class: 'read', href: doc.url, target: '_blank', rel: 'noopener' }, `Read it at ${host(doc.url)} →`) : null,
  )
}
