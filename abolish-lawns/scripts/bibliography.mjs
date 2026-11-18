#!/usr/bin/env node
// Writes the bibliography's entries into site/bibliography.html from data/bibliography.mjs.
// No dependencies, like scripts/cv.mjs at the repo root.
//
//   node abolish-lawns/scripts/bibliography.mjs           rewrite the generated part of the page
//   node abolish-lawns/scripts/bibliography.mjs --check   exit 1 if the page is out of date with the data
//
// Only the part between <!-- generated:bibliography --> and <!-- /generated:bibliography --> is
// written; the rest of the page (masthead, styles, back link) is edited by hand.
// This replaces the SvelteKit template that rendered the same markup until 2026-11-18.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = resolve(HERE, 'site/bibliography.html');
const { references, claimIndex } = await import(pathToFileURL(resolve(HERE, 'data/bibliography.mjs')).href);

const typeLabels = {
	'peer-reviewed': 'Peer-reviewed',
	'government': 'Government',
	'advocacy': 'Advocacy org',
	'industry': 'Industry',
	'news': 'News',
	'primary': 'Primary source',
};
const statusLabels = {
	'verified': 'Verified',
	'needs-update': 'Needs update',
	'watch': 'Use with care',
};

const text = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// Only show real entries, not TODOs
const real = references.filter((r) => r.authors.length > 0);
const todos = references.filter((r) => r.authors.length === 0);
const needsUpdate = references.filter((r) => r.status === 'needs-update');

// The first sentence of a note, with its closing punctuation. A period ends a sentence only when
// a space or the end follows it (a closing quote or bracket may come between), so "$188.8B" and
// "78.1 million" stay whole.
const firstSentence = (s = '') => {
	const m = s.match(/^[\s\S]*?[.!?]["'”’)]?(?=\s|$)/);
	return m ? m[0] : s.replace(/\s+$/, '') + '.';
};

const out = [];
const put = (tabs, line) => out.push('\t'.repeat(tabs) + line);

if (needsUpdate.length > 0) {
	put(1, '<section class="section section--alert">');
	put(2, '<div class="section__header">');
	put(3, '<span class="section__number">⚠</span>');
	put(3, '<h2 class="section__title">Known corrections needed</h2>');
	put(2, '</div>');
	put(2, '<hr class="rule rule--thin" />');
	put(2, '<div class="prose">');
	for (const ref of needsUpdate) put(3, `<p><strong>${text(ref.id)}</strong> — ${text(firstSentence(ref.notes))}</p>`);
	put(2, '</div>');
	put(1, '</section>');
	out.push('');
}

put(1, '<section class="section">');
put(2, '<div class="section__header">');
put(3, '<span class="section__number">§</span>');
put(3, `<h2 class="section__title">Sources (${real.length})</h2>`);
put(2, '</div>');
put(2, '<hr class="rule rule--thin" />');
out.push('');
put(2, '<div class="ref-list">');
for (const ref of real) {
	put(3, `<div class="ref" id="${attr(ref.id)}">`);
	put(4, '<div class="ref__meta">');
	put(5, `<span class="badge badge--type">${text(typeLabels[ref.type])}</span>`);
	put(5, `<span class="badge badge--${attr(ref.status)}">${text(statusLabels[ref.status])}</span>`);
	put(5, `<span class="ref__year">${text(ref.year)}</span>`);
	put(4, '</div>');
	put(4, '<div class="ref__body">');
	put(5, `<p class="ref__authors">${text(ref.authors.join(', '))}</p>`);
	put(5, ref.url
		? `<p class="ref__title"><a href="${attr(ref.url)}" target="_blank" rel="noopener noreferrer">${text(ref.title)}</a></p>`
		: `<p class="ref__title">${text(ref.title)}</p>`);
	put(5, `<p class="ref__source">${text(ref.source)}</p>`);
	if (ref.notes) put(5, `<p class="ref__notes">${text(ref.notes)}</p>`);
	// No whitespace between the tags: the template that preceded this rendered none.
	if (ref.claims.length > 0) put(5, `<div class="ref__claims">${ref.claims.map((c) => `<span class="claim-tag">${text(claimIndex[c] ?? c)}</span>`).join('')}</div>`);
	put(4, '</div>');
	put(3, '</div>');
}
put(2, '</div>');
put(1, '</section>');

if (todos.length > 0) {
	out.push('');
	put(1, '<section class="section">');
	put(2, '<div class="section__header">');
	put(3, '<span class="section__number">→</span>');
	put(3, `<h2 class="section__title">Research needed (${todos.length})</h2>`);
	put(2, '</div>');
	put(2, '<hr class="rule rule--thin" />');
	put(2, '<div class="ref-list">');
	for (const ref of todos) {
		put(3, '<div class="ref ref--todo">');
		put(4, '<div class="ref__body">');
		put(5, `<p class="ref__title">${text(ref.title.replace('PLACEHOLDER: ', ''))}</p>`);
		if (ref.notes) put(5, `<p class="ref__notes">${text(ref.notes)}</p>`);
		put(4, '</div>');
		put(3, '</div>');
	}
	put(2, '</div>');
	put(1, '</section>');
}

const START = '<!-- generated:bibliography (abolish-lawns/scripts/bibliography.mjs) -->';
const END = '<!-- /generated:bibliography -->';
const page = readFileSync(PAGE, 'utf8');
const a = page.indexOf(START), b = page.indexOf(END);
if (a < 0 || b < a) throw new Error(`${PAGE}: generated markers not found`);
const next = page.slice(0, a + START.length) + '\n' + out.join('\n') + '\n\t' + page.slice(b);

if (process.argv.includes('--check')) {
	if (next !== page) {
		console.error('abolish-lawns/site/bibliography.html is out of date with data/bibliography.mjs: run node abolish-lawns/scripts/bibliography.mjs');
		process.exit(1);
	}
	console.log('bibliography.html is up to date');
} else {
	writeFileSync(PAGE, next);
	console.log(`bibliography.html: ${real.length} sources, ${todos.length} to research, ${needsUpdate.length} corrections`);
}
