// Shared helpers for the research watch. No dependencies.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const projects = () => JSON.parse(readFileSync(resolve(ROOT, 'research-watch/projects.json'), 'utf8'));

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const readJSON = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);

/** The data a project's pages are made from. */
export function loadProject(p) {
  const dir = resolve(ROOT, p.data);
  const digests = existsSync(join(dir, 'digests'))
    ? readdirSync(join(dir, 'digests')).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse()
        .map((f) => readJSON(join(dir, 'digests', f)))
    : [];
  const weeklies = existsSync(join(dir, 'weekly'))
    ? readdirSync(join(dir, 'weekly')).filter((f) => /^\d{4}-W\d{2}\.md$/.test(f)).sort().reverse()
        .map((f) => ({ week: f.slice(0, -3), ...frontMatter(readFileSync(join(dir, 'weekly', f), 'utf8')) }))
    : [];
  const claims = readJSON(join(dir, 'claims.json'), { claims: [] }).claims;
  return { dir, digests, weeklies, claims };
}

// ── Claim status: computed from distinct origins, never written by hand ────────
const originKey = (o) => String(o || '').trim().toLowerCase().replace(/\s+/g, ' ');

export function claimStatus(claim) {
  const asserts = new Set(), disputes = new Set();
  for (const s of claim.sources || []) (s.stance === 'disputes' ? disputes : asserts).add(originKey(s.origin));
  asserts.delete(''); disputes.delete('');
  const status = disputes.size && asserts.size ? 'disputed' : asserts.size >= 2 ? 'corroborated' : 'provisional';
  return { status, asserting: asserts.size, disputing: disputes.size };
}

// ── Text normalization for quote matching ──────────────────────────────────────
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”',
  ldquo: '“', mdash: '—', ndash: '–', hellip: '…', shy: '­', sect: '§', para: '¶',
  copy: '©', reg: '®', trade: '™', deg: '°', frac12: '½', times: '×', middot: '·', bull: '•', eacute: 'é',
};
export const decodeEntities = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z][a-z0-9]*);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

export function htmlToText(html) {
  return decodeEntities(String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

/** Folds the differences a quote picks up in copying: case, curly quotes, dashes, spaces, soft hyphens. */
export function normalize(s) {
  return String(s).normalize('NFKC')
    .replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/­/g, '')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Text with words broken across lines (a PDF's "regu- lation") joined back up. */
export const dehyphenate = (s) => s.replace(/(\p{L})- (\p{L})/gu, '$1$2');

// ── robots.txt ─────────────────────────────────────────────────────────────────
export const AGENT = 'jason-edelman-research-watch';
export const UA = `Mozilla/5.0 (compatible; ${AGENT}/1.0; +https://github.com/jedelman/jason-edelman.org/tree/main/research-watch)`;

/**
 * Whether robots.txt lets this watch fetch a URL. Uses the group naming this agent, else "*"; the longest matching
 * Allow/Disallow rule wins (with * and $). Also refuses a site whose Content-Signal says ai-input=no. A missing or
 * unreadable robots.txt allows. Returns { ok, why }.
 */
const robotsCache = new Map();
export async function robotsAllows(url) {
  const u = new URL(url);
  if (!robotsCache.has(u.origin)) {
    let txt = '';
    try {
      const r = await fetch(`${u.origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      if (r.ok) txt = await r.text();
    } catch {}
    robotsCache.set(u.origin, parseRobots(txt));
  }
  const { groups, signals } = robotsCache.get(u.origin);
  const group = groups.find((g) => g.agents.includes(AGENT)) || groups.find((g) => g.agents.includes('*'));
  if (signals.some((s) => /\bai-input\s*=\s*no\b/i.test(s))) return { ok: false, why: 'Content-Signal ai-input=no' };
  if (!group) return { ok: true, why: '' };
  const path = u.pathname + u.search;
  let best = null;
  for (const rule of group.rules) {
    if (!rule.path) continue;
    const re = new RegExp('^' + rule.path.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'));
    if (re.test(path) && (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow))) best = rule;
  }
  return best && !best.allow ? { ok: false, why: `robots.txt disallows ${best.path}` } : { ok: true, why: '' };
}

function parseRobots(txt) {
  const groups = [], signals = [];
  let cur = null, lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === 'content-signal') signals.push(val);
    else if (cur && (key === 'allow' || key === 'disallow')) cur.rules.push({ allow: key === 'allow', path: val.replace(/\$$/, '') });
  }
  return { groups, signals };
}

// ── Dates ──────────────────────────────────────────────────────────────────────
/** The ISO 8601 week a date falls in, as "YYYY-Www" (weeks run Monday to Sunday). */
export function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));       // the week's Thursday decides its year
  const week = Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const longDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

// ── A small markdown renderer, for the weekly analyses ─────────────────────────
export function frontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { title: '', summary: '', body: src };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return { title: meta.title || '', summary: meta.summary || '', body: m[2] };
}

/**
 * Markdown: ## and ### headings, paragraphs, - lists, > quotes; **bold**, *italic*, [text](url), and
 * [[claim-id]], which `cite(id)` turns into a status-marked link to the ledger.
 */
export function markdown(src, cite) {
  const inline = (s) => esc(s)
    .replace(/\[\[([a-z0-9][a-z0-9-]*)\]\]/g, (_, id) => cite(id))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\.{0,2}\/[^)\s]*)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  const out = [];
  let para = [], list = [], quote = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    if (list.length) out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`);
    if (quote.length) out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
    para = []; list = []; quote = [];
  };
  for (const line of src.split('\n')) {
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) { flush(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { if (para.length || quote.length) flush(); list.push(m[1]); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { if (para.length || list.length) flush(); quote.push(m[1]); continue; }
    if (list.length && /^\s{2,}\S/.test(line)) { list[list.length - 1] += ' ' + line.trim(); continue; }
    if (list.length || quote.length) flush();
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}
