<script lang="ts">
	import { base } from '$app/paths';
	import { references, claimIndex } from '$lib/data/bibliography';

	const typeLabels: Record<string, string> = {
		'peer-reviewed': 'Peer-reviewed',
		'government': 'Government',
		'advocacy': 'Advocacy org',
		'industry': 'Industry',
		'news': 'News',
		'primary': 'Primary source',
	};

	const statusLabels: Record<string, string> = {
		'verified': 'Verified',
		'needs-update': 'Needs update',
		'watch': 'Use with care',
	};

	// Only show real entries, not TODOs
	const real = references.filter(r => r.authors.length > 0);
	const todos = references.filter(r => r.authors.length === 0);
	const needsUpdate = references.filter(r => r.status === 'needs-update');
</script>

<svelte:head>
	<title>Abolish Lawns — Bibliography</title>
	<meta name="description" content="Sources, citations, and research status for Abolish Lawns." />
</svelte:head>

<main>

	<header class="masthead">
		<div class="kicker">
			<span class="label">Reference Library</span>
		</div>
		<hr class="rule rule--acid" />
		<h1 class="page-title">Bibliography</h1>
		<hr class="rule" />
		<p class="deck">
			All claims on this site are sourced. This page documents every reference,
			its evidentiary status, and known limitations. Entries marked
			<span class="badge badge--watch">Use with care</span> are used cautiously;
			entries marked <span class="badge badge--update">Needs update</span> flag
			corrections needed in the site text.
		</p>
	</header>

	{#if needsUpdate.length > 0}
	<section class="section section--alert">
		<div class="section__header">
			<span class="section__number">⚠</span>
			<h2 class="section__title">Known corrections needed</h2>
		</div>
		<hr class="rule rule--thin" />
		<div class="prose">
			{#each needsUpdate as ref}
			<p><strong>{ref.id}</strong> — {ref.notes?.split('.')[0]}.</p>
			{/each}
		</div>
	</section>
	{/if}

	<section class="section">
		<div class="section__header">
			<span class="section__number">§</span>
			<h2 class="section__title">Sources ({real.length})</h2>
		</div>
		<hr class="rule rule--thin" />

		<div class="ref-list">
			{#each real as ref}
			<div class="ref" id={ref.id}>
				<div class="ref__meta">
					<span class="badge badge--type">{typeLabels[ref.type]}</span>
					<span class="badge badge--{ref.status}">{statusLabels[ref.status]}</span>
					<span class="ref__year">{ref.year}</span>
				</div>
				<div class="ref__body">
					<p class="ref__authors">{ref.authors.join(', ')}</p>
					<p class="ref__title">
						{#if ref.url}
							<a href={ref.url} target="_blank" rel="noopener noreferrer">
								{ref.title}
							</a>
						{:else}
							{ref.title}
						{/if}
					</p>
					<p class="ref__source">{ref.source}</p>
					{#if ref.notes}
					<p class="ref__notes">{ref.notes}</p>
					{/if}
					{#if ref.claims.length > 0}
					<div class="ref__claims">
						{#each ref.claims as claim}
						<span class="claim-tag">{claimIndex[claim] ?? claim}</span>
						{/each}
					</div>
					{/if}
				</div>
			</div>
			{/each}
		</div>
	</section>

	{#if todos.length > 0}
	<section class="section">
		<div class="section__header">
			<span class="section__number">→</span>
			<h2 class="section__title">Research needed ({todos.length})</h2>
		</div>
		<hr class="rule rule--thin" />
		<div class="ref-list">
			{#each todos as ref}
			<div class="ref ref--todo">
				<div class="ref__body">
					<p class="ref__title">{ref.title.replace('PLACEHOLDER: ', '')}</p>
					{#if ref.notes}
					<p class="ref__notes">{ref.notes}</p>
					{/if}
				</div>
			</div>
			{/each}
		</div>
	</section>
	{/if}

	<div class="back">
		<a href="{base}/">← Return to manifesto</a>
	</div>

</main>

<style>
main {
	max-width: 1100px;
	margin: 0 auto;
	padding: 0 var(--space-6);
}

.masthead { padding: var(--space-12) 0 var(--space-8); }

.kicker { display: flex; gap: var(--space-4); margin-bottom: var(--space-4); }

.label {
	font-family: var(--font-display);
	font-size: var(--text-sm);
	font-weight: 600;
	letter-spacing: .12em;
	text-transform: uppercase;
	color: var(--text-secondary);
}

.page-title {
	font-family: var(--font-display);
	font-size: clamp(3rem, 7vw, 6rem);
	font-weight: 900;
	line-height: .92;
	letter-spacing: -.02em;
	text-transform: uppercase;
	color: var(--ink);
	margin: var(--space-6) 0;
}

.deck {
	font-size: var(--text-lg);
	line-height: 1.6;
	max-width: 68ch;
	margin-top: var(--space-6);
	color: var(--text-primary);
}

.section { padding: var(--space-12) 0; border-top: 1px solid var(--border); }

.section--alert {
	border-top: none;
	background: var(--bg-raised);
	margin: 0 calc(-1 * var(--space-6));
	padding: var(--space-8) var(--space-6);
	border-bottom: 1px solid var(--border);
}

.section__header {
	display: flex;
	align-items: baseline;
	gap: var(--space-4);
	margin-bottom: var(--space-4);
}

.section__number {
	font-family: var(--font-display);
	font-size: var(--text-sm);
	font-weight: 600;
	letter-spacing: .1em;
	color: var(--acid-dim);
	text-transform: uppercase;
}

.section__title {
	font-family: var(--font-display);
	font-size: clamp(1.5rem, 3vw, 2.25rem);
	font-weight: 700;
	text-transform: uppercase;
}

.prose { margin-top: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
.prose p { color: var(--text-secondary); max-width: 72ch; font-size: var(--text-sm); }

/* ── Refs ─── */
.ref-list { margin-top: var(--space-8); display: flex; flex-direction: column; }

.ref {
	display: grid;
	grid-template-columns: 160px 1fr;
	gap: var(--space-6);
	padding: var(--space-6) 0;
	border-bottom: 1px solid var(--border);
	align-items: start;
}

.ref:last-child { border-bottom: none; }

.ref--todo { grid-template-columns: 1fr; opacity: .7; }

.ref__meta {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	align-items: flex-start;
	padding-top: 2px;
}

.ref__year {
	font-family: var(--font-display);
	font-size: var(--text-sm);
	font-weight: 600;
	color: var(--text-tertiary);
	letter-spacing: .04em;
}

.ref__body { display: flex; flex-direction: column; gap: var(--space-2); }

.ref__authors {
	font-size: var(--text-sm);
	color: var(--text-secondary);
	font-weight: 500;
	max-width: none;
}

.ref__title {
	font-size: var(--text-base);
	font-weight: 700;
	color: var(--ink);
	max-width: none;
}

.ref__title a {
	color: var(--ink);
	text-decoration-color: var(--acid);
}

.ref__source {
	font-size: var(--text-sm);
	color: var(--text-secondary);
	font-style: italic;
	max-width: none;
}

.ref__notes {
	font-size: var(--text-sm);
	color: var(--text-secondary);
	line-height: 1.6;
	max-width: 70ch;
	border-left: 2px solid var(--border);
	padding-left: var(--space-4);
	margin-top: var(--space-2);
}

.ref__claims {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
	margin-top: var(--space-2);
}

/* ── Badges ─── */
.badge {
	font-family: var(--font-display);
	font-size: 11px;
	font-weight: 600;
	letter-spacing: .08em;
	text-transform: uppercase;
	padding: 2px 6px;
	display: inline-block;
}

.badge--type { background: var(--bg-raised); color: var(--text-secondary); }
.badge--verified { background: oklch(88% 0.12 128); color: oklch(25% 0.1 128); }
.badge--watch { background: oklch(93% 0.12 75); color: oklch(30% 0.12 75); }
.badge--update { background: oklch(90% 0.10 20); color: oklch(30% 0.12 20); }
.badge--needs-update { background: oklch(90% 0.10 20); color: oklch(30% 0.12 20); }

.claim-tag {
	font-size: var(--text-xs);
	color: var(--text-tertiary);
	background: var(--bg-raised);
	padding: 2px 6px;
	font-family: var(--font-display);
	letter-spacing: .05em;
}

.back {
	padding: var(--space-8) 0 var(--space-12);
	font-family: var(--font-display);
	font-weight: 600;
	font-size: var(--text-sm);
	letter-spacing: .06em;
	text-transform: uppercase;
}

@media (max-width: 640px) {
	.ref { grid-template-columns: 1fr; gap: var(--space-3); }
	.ref__meta { flex-direction: row; flex-wrap: wrap; }
}

@media print {
	.ref__notes { border-left: 1pt solid black; }
}
</style>
