#!/usr/bin/env node
// Writes each project's research-watch pages from its data. No dependencies, no network.
//
//   node research-watch/render.mjs           write the pages
//   node research-watch/render.mjs --check   exit 1 if any page is behind its data (the pre-commit hook runs this)
//
// For each project in projects.json: an index, one page per daily digest and per weekly analysis, the claims
// ledger, and an Atom feed, all in the project's own page chrome (templates/<id>.tpl). Every claim's status is
// computed here from its sources' distinct origins (lib.mjs claimStatus); nothing unverified is published.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, projects, loadProject, claimStatus, esc, longDate, markdown } from './lib.mjs';

const CHECK = process.argv.includes('--check');
const errors = [];
const stale = [];

const STATUS_NOTE = {
  provisional: 'one origin says so',
  corroborated: 'independent origins agree',
  disputed: 'origins disagree',
};
const badge = (status) => `<span class="w-status w-status--${status}">${status}</span>`;
const short = (s, n = 90) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);

function page(tpl, { title, description, label, h1, deck, body }) {
  return tpl
    .replaceAll('{{TITLE}}', esc(title))
    .replaceAll('{{DESCRIPTION}}', esc(description))
    .replaceAll('{{LABEL}}', esc(label))
    .replaceAll('{{H1}}', esc(h1))
    .replaceAll('{{DECK}}', deck)
    .replaceAll('{{BODY}}', body);
}

function renderProject(p) {
  const tpl = readFileSync(resolve(ROOT, 'research-watch/templates', `${p.id}.tpl`), 'utf8');
  const { digests, weeklies, claims } = loadProject(p);
  const byId = new Map(claims.map((c) => [c.id, c]));
  const status = new Map(claims.map((c) => [c.id, claimStatus(c)]));
  const files = new Map();

  // Nothing unverified goes out.
  for (const d of digests) for (const [i, it] of (d.items || []).entries()) {
    if (!it.verified) errors.push(`${p.id} ${d.date} item ${i + 1}: not verified (run research-watch/verify.mjs)`);
    for (const id of it.claims || []) if (!byId.has(id)) errors.push(`${p.id} ${d.date} item ${i + 1}: unknown claim "${id}"`);
  }
  for (const c of claims) for (const [i, s] of (c.sources || []).entries()) {
    if (!s.verified) errors.push(`${p.id} claim ${c.id} source ${i + 1}: not verified`);
  }

  const claimLink = (id) => {
    const c = byId.get(id), st = status.get(id)?.status || 'provisional';
    return c ? `<a href="./claims#${esc(id)}">${esc(short(c.statement))}</a> ${badge(st)}` : esc(id);
  };
  const cite = (id) => {
    const c = byId.get(id);
    if (!c) { errors.push(`${p.id} weekly: unknown claim [[${id}]]`); return esc(id); }
    const st = status.get(id).status;
    return `<a class="w-cite w-status--${st}" href="./claims#${esc(id)}" title="${esc(c.statement)}">${st}</a>`;
  };

  // ── Digest pages ──
  digests.forEach((d, i) => {
    const newer = digests[i - 1], older = digests[i + 1];
    const items = (d.items || []).map((it) => `
<article class="w-item">
  <h3>${esc(it.title)}</h3>
  <p class="w-src"><a href="${esc(it.url)}">${esc(it.publisher)}</a>${it.origin && it.origin !== it.publisher ? ` · origin: ${esc(it.origin)}` : ''} · ${esc(it.kind)}${it.published ? ` · ${esc(it.published)}` : ''}</p>
  <blockquote class="w-quote">${esc(it.quote)}</blockquote>
  <p class="w-note">${esc(it.note)}</p>
  ${(it.claims || []).length ? `<ul class="w-claims">${it.claims.map((id) => `<li>${claimLink(id)}</li>`).join('')}</ul>` : ''}
</article>`).join('\n');
    const unreachable = (d.unreachable || []).length ? `
<section class="w-unreachable">
  <h2>Couldn't open</h2>
  <ul>${d.unreachable.map((u) => `<li><a href="${esc(u.url)}">${esc(u.url)}</a>: ${esc(u.why)}</li>`).join('')}</ul>
</section>` : '';
    const body = `
<p class="w-meta">${esc(longDate(d.date))} · ${d.items.length} item${d.items.length === 1 ? '' : 's'}${d.checked ? ` · ${d.checked.length} sources checked` : ''}${d.run ? ` · <a href="${esc(d.run)}">run</a>` : ''}</p>
${items}
${unreachable}
<div class="w-pager">${older ? `<a href="./${older.date}">← ${esc(older.date)}</a>` : '<span></span>'}<a href="./">All digests</a>${newer ? `<a href="./${newer.date}">${esc(newer.date)} →</a>` : '<span></span>'}</div>`;
    files.set(`${d.date}.html`, page(tpl, {
      title: `${p.name} watch: ${d.date}`, description: d.summary, label: `Daily digest · ${d.date}`,
      h1: longDate(d.date), deck: esc(d.summary), body,
    }));
  });

  // ── Weekly analyses ──
  weeklies.forEach((w) => {
    if (!w.title) errors.push(`${p.id} weekly ${w.week}: no title in front matter`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date || '')) errors.push(`${p.id} weekly ${w.week}: front matter needs date: YYYY-MM-DD`);
    const body = `<article class="w-analysis">\n${markdown(w.body, cite)}\n</article>
<p class="w-legend">Every factual statement links to the claims ledger and shows its status: ${badge('provisional')} ${STATUS_NOTE.provisional}, ${badge('corroborated')} ${STATUS_NOTE.corroborated}, ${badge('disputed')} ${STATUS_NOTE.disputed}.</p>
<div class="w-pager"><span></span><a href="./">The watch</a><span></span></div>`;
    files.set(`week-${w.week}.html`, page(tpl, {
      title: `${p.name} watch: ${w.title}`, description: w.summary, label: `Weekly analysis · ${w.week}`,
      h1: w.title, deck: esc(w.summary), body,
    }));
  });

  // ── Claims ledger ──
  const groups = ['disputed', 'corroborated', 'provisional'].map((st) => {
    const list = claims.filter((c) => status.get(c.id).status === st)
      .sort((a, b) => (b.first_seen || '').localeCompare(a.first_seen || '') || a.id.localeCompare(b.id));
    if (!list.length) return '';
    return `
<section class="w-group">
  <h2>${badge(st)} ${list.length} ${st} (${STATUS_NOTE[st]})</h2>
  ${list.map((c) => {
    const s = status.get(c.id);
    return `
  <article class="w-claim" id="${esc(c.id)}">
    <h3>${esc(c.statement)}</h3>
    <p class="w-meta">${esc(c.topic || '')}${c.topic ? ' · ' : ''}first seen ${esc(c.first_seen || '')} · asserted by ${s.asserting} origin${s.asserting === 1 ? '' : 's'}${s.disputing ? `, disputed by ${s.disputing}` : ''}</p>
    <ul class="w-sources">${(c.sources || []).map((src) => `
      <li><span class="w-stance w-stance--${src.stance === 'disputes' ? 'disputes' : 'asserts'}">${src.stance === 'disputes' ? 'disputes' : 'asserts'}</span> <a href="${esc(src.url)}">${esc(src.publisher)}</a>${src.origin && src.origin !== src.publisher ? ` (origin: ${esc(src.origin)})` : ''}${src.date ? `, ${esc(src.date)}` : ''}: <q>${esc(src.quote)}</q></li>`).join('')}
    </ul>
  </article>`;
  }).join('')}
</section>`;
  }).join('');
  files.set('claims.html', page(tpl, {
    title: `${p.name} watch: claims`, description: `Every claim the ${p.name} watch has recorded, with who asserts and who disputes it.`,
    label: 'Claims ledger', h1: 'Claims',
    deck: 'Every claim the watch has recorded, with every source that asserts or disputes it. A claim is corroborated only when independent origins agree; two outlets repeating one press release count once.',
    body: groups || '<p class="w-summary">No claims recorded yet.</p>',
  }));

  // ── Index ──
  const counts = { provisional: 0, corroborated: 0, disputed: 0 };
  for (const s of status.values()) counts[s.status]++;
  const body = `
<section class="w-intro">
  <p>A daily record of what's newly said about ${esc(p.subject)}, and by whom, with a weekly analysis. It runs on one rule, <strong>attribution over trust</strong>: nothing here is taken as true. Every item quotes its source, checked against the page, and every claim is recorded as who says what.</p>
  <p>${badge('provisional')} ${STATUS_NOTE.provisional} · ${badge('corroborated')} ${STATUS_NOTE.corroborated} · ${badge('disputed')} ${STATUS_NOTE.disputed}</p>
</section>
${weeklies.length ? `
<section>
  <h2>Weekly analysis</h2>
  ${weeklies.map((w) => `<div class="w-entry"><p class="w-meta">${esc(w.week)}${w.date ? ` · ${esc(w.date)}` : ''}</p><h3><a href="./week-${esc(w.week)}">${esc(w.title)}</a></h3><p>${esc(w.summary)}</p></div>`).join('\n  ')}
</section>` : ''}
<section>
  <h2>Daily digests</h2>
  ${digests.length ? digests.map((d) => `<div class="w-entry"><p class="w-meta">${esc(longDate(d.date))} · ${d.items.length} item${d.items.length === 1 ? '' : 's'}</p><h3><a href="./${d.date}">${esc(d.date)}</a></h3><p>${esc(d.summary)}</p></div>`).join('\n  ') : '<p>No digests yet.</p>'}
</section>
<section>
  <h2>Claims</h2>
  <p><a href="./claims">The ledger</a>: ${claims.length} claim${claims.length === 1 ? '' : 's'}, ${counts.corroborated} corroborated, ${counts.disputed} disputed, ${counts.provisional} provisional.</p>
  <p class="w-meta"><a href="./feed.xml">Atom feed</a> · researched and published by a scheduled Claude Code routine · <a href="https://github.com/jedelman/jason-edelman.org/tree/main/research-watch">how it works</a></p>
</section>`;
  files.set('index.html', page(tpl, {
    title: `${p.name} watch`, description: `What's newly said about ${p.subject}, and by whom. Attribution over trust.`,
    label: 'Research watch', h1: 'Watch', deck: esc(`What's newly said about ${p.subject}, and by whom.`), body,
  }));

  // ── Atom feed ──
  const entries = [
    ...digests.map((d) => ({ slug: d.date, title: `Digest: ${d.date}`, date: d.date, summary: d.summary })),
    ...weeklies.map((w) => ({ slug: `week-${w.week}`, title: `Analysis: ${w.title}`, date: w.date || '', summary: w.summary })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug)).slice(0, 60);
  const updated = entries[0] ? `${entries[0].date}T12:00:00Z` : '2026-11-18T12:00:00Z';
  files.set('feed.xml', `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(p.name)} watch</title>
  <subtitle>${esc(`What's newly said about ${p.subject}, and by whom. Attribution over trust.`)}</subtitle>
  <link href="${esc(p.url)}"/>
  <link rel="self" href="${esc(p.url)}feed.xml"/>
  <id>${esc(p.url)}</id>
  <updated>${updated}</updated>
  <author><name>${esc(p.name)} research watch</name></author>
${entries.map((e) => `  <entry>
    <title>${esc(e.title)}</title>
    <link href="${esc(p.url + e.slug)}"/>
    <id>${esc(p.url + e.slug)}</id>
    <updated>${e.date}T12:00:00Z</updated>
    <summary>${esc(e.summary)}</summary>
  </entry>`).join('\n')}
</feed>
`);

  // ── Write or check ──
  const out = resolve(ROOT, p.out);
  const ours = (f) => /^(index|claims|\d{4}-\d{2}-\d{2}|week-\d{4}-W\d{2})\.html$|^feed\.xml$/.test(f);
  if (!CHECK) mkdirSync(out, { recursive: true });
  for (const [name, content] of files) {
    const f = join(out, name);
    const cur = existsSync(f) ? readFileSync(f, 'utf8') : null;
    if (cur === content) continue;
    if (CHECK) stale.push(`${p.out}/${name}`);
    else writeFileSync(f, content);
  }
  if (existsSync(out)) for (const f of readdirSync(out)) {
    if (ours(f) && !files.has(f)) { if (CHECK) stale.push(`${p.out}/${f} (no longer made)`); else rmSync(join(out, f)); }
  }
  return { id: p.id, digests: digests.length, weeklies: weeklies.length, claims: claims.length };
}

const results = projects().map(renderProject);
if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  process.exit(1);
}
if (CHECK) {
  if (stale.length) {
    console.error(`research watch pages are behind their data (run node research-watch/render.mjs):\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  console.log('research watch pages are up to date');
} else {
  for (const r of results) console.log(`${r.id}: ${r.digests} digests, ${r.weeklies} weekly, ${r.claims} claims`);
}
