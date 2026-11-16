#!/usr/bin/env node
// Builds cv/index.html from cv/cv.md, Jason's CV as he writes it. No dependencies.
//   node scripts/cv.mjs
//
// The markdown it understands is the small set the CV uses:
//   # Name · ## Section · ### Entry heading · _place_ (the line under an entry) · - bullet · paragraphs,
//   with **bold**, *italic* / _italic_, and [text](url) inline.
// As a guard for a public page, it drops any line that looks like a phone number or an email address,
// and any section named References.
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'cv/cv.md');
const OUT = resolve(ROOT, 'cv/index.html');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (s) => esc(s)
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>')
  .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PRIVATE = /@|\(\d{3}\)\s*\d{3}[-.\s]\d{4}|\b\d{3}[-.]\d{3}[-.]\d{4}\b/;

const md = readFileSync(SRC, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
let name = '', place = '', links = '', summary = '';
const sections = [];
let sec = null, entry = null, skip = false;
for (const raw of md.split('\n')) {
  const line = raw.trim();
  if (!line) continue;
  if (line.startsWith('## ')) {
    const title = line.slice(3).trim();
    skip = /^references?$/i.test(title);
    if (skip) continue;
    sec = { title, id: slug(title), entries: [], paras: [] };
    sections.push(sec); entry = null;
    continue;
  }
  if (skip) continue;
  if (PRIVATE.test(line.replace(/\]\([^)]*\)/g, ''))) continue;
  if (line.startsWith('# ')) { name = line.slice(2).trim(); continue; }
  if (!sec) { if (/\]\(/.test(line)) links = line; else place = line; continue; }
  if (line.startsWith('### ')) { entry = { title: line.slice(4).trim().replace(/,$/, ''), place: '', bullets: [] }; sec.entries.push(entry); continue; }
  if (entry && !entry.place && !entry.bullets.length && /^_[^_].*_$/.test(line)) { entry.place = line.slice(1, -1); continue; }
  if (line.startsWith('- ')) { (entry ? entry.bullets : (sec.bullets ||= [])).push(line.slice(2)); continue; }
  (entry ? (entry.paras ||= []) : sec.paras).push(line);
}
const summarySec = sections.find((s) => /^summary$/i.test(s.title));
if (summarySec) summary = summarySec.paras.join(' ');
const body = sections.filter((s) => s !== summarySec);

const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV — ${esc(name)}</title>
  <meta name="description" content="${esc(summary.split('. ')[0].replace(/\.$/, ''))}.">
  <link rel="stylesheet" href="/style.css">
  <style>
    /* The CV: the site's masthead, then entries set like the rest of the site. */
    .cv-where { font-family: var(--font-mono); font-size: 0.8rem; color: var(--muted); margin-top: 0.4rem; }
    .cv-where a { color: var(--muted); }
    .cv-where a:hover { color: var(--link-hover); }
    .cv-summary { color: var(--text); max-width: 62ch; font-size: 1.08rem; }
    .cv-entry + .cv-entry { margin-top: 2rem; }
    .cv-entry.joined { margin-top: 0.6rem; }
    .cv-entry h3 { font-family: var(--font-display); font-size: 1.05rem; font-weight: 600; line-height: 1.35; color: var(--text); margin: 0; text-wrap: balance; }
    .cv-place { font-family: var(--font-mono); font-size: 0.78rem; letter-spacing: 0.02em; color: var(--muted); margin: 0.15rem 0 0; }
    .cv-entry ul { margin: 0.7rem 0 0; padding-left: 1.1rem; color: var(--text); }
    .cv-entry li { max-width: 62ch; }
    .cv-entry li + li { margin-top: 0.45rem; }
    .cv-entry li::marker { color: var(--accent-dim); }
    .cv-entry p { margin: 0.6rem 0 0; max-width: 62ch; }
    .cv-entry a, .cv-summary a { color: var(--link); text-underline-offset: 3px; }
    .cv-updated { font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); }
  </style>
</head>
<body>
  <main>

    <header>
      <div class="masthead">
        <h1>${esc(name)}</h1>
        <p class="tagline">Curriculum vitae</p>
        ${place ? `<p class="cv-where">${inline(place)}</p>` : ''}
        ${links ? `<p class="cv-where">${inline(links)}</p>` : ''}
        <nav class="sections" aria-label="CV">
          <a href="/">&larr; Home</a>
${body.map((s) => `          <a href="#${s.id}">${esc(s.title)}</a>`).join('\n')}
        </nav>
      </div>
      <div class="header-side">
        <a class="book-call" href="https://calendly.com/edelmanja/30min">Book a Call</a>
      </div>
    </header>

    ${summary ? `<section id="summary">
      <h2>Summary</h2>
      <p class="cv-summary">${inline(summary)}</p>
    </section>` : ''}
${body.map((s) => `
    <section id="${s.id}">
      <h2>${esc(s.title)}</h2>
${s.paras.map((p) => `      <p>${inline(p)}</p>`).join('\n')}
${s.entries.map((e, i) => {
  // An entry with no bullets of its own shares the next one's (a board seat over a membership, say).
  const joined = i > 0 && !s.entries[i - 1].bullets.length;
  return `      <div class="cv-entry${joined ? ' joined' : ''}">
        <h3>${inline(e.title)}</h3>${e.place ? `
        <p class="cv-place">${inline(e.place)}</p>` : ''}${(e.paras || []).map((p) => `
        <p>${inline(p)}</p>`).join('')}${e.bullets.length ? `
        <ul>
${e.bullets.map((b) => `          <li>${inline(b)}</li>`).join('\n')}
        </ul>` : ''}
      </div>`;
}).join('\n')}
    </section>`).join('\n')}

    <p class="cv-updated">Updated ${today}. References on request.</p>

  </main>
</body>
</html>
`;
writeFileSync(OUT, html);
console.log(`cv/index.html: ${body.length} sections, ${body.reduce((n, s) => n + s.entries.length, 0)} entries`);
