<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Abolish Lawns — Zines</title>
	<meta name="description" content="Printable zines for shifting public opinion on lawns. Free to reproduce." />
</svelte:head>

<main>

	<header class="masthead">
		<div class="kicker">
			<span class="label">Print &amp; Distribute</span>
		</div>
		<hr class="rule rule--acid" />
		<h1 class="page-title">Zines</h1>
		<hr class="rule" />
		<p class="deck">
			Single-sheet, fold-in-half pamphlets. Print at home. Leave somewhere.
			Every zine contains instructions to print more. That is the point.
		</p>
	</header>

	<section class="section">
		<hr class="rule rule--thin" />

		<div class="zine-list">

			<div class="zine-item">
				<div class="zine-item__meta">
					<span class="zine-item__number">No. 01</span>
					<span class="zine-item__year">2025</span>
				</div>
				<div class="zine-item__body">
					<h2 class="zine-item__title">Hate Mowing Your Lawn?</h2>
					<p class="zine-item__desc">
						The hook for everyone who already knows the lawn is wrong
						but hasn't had the language to say so. Four pages.
						Prints on one sheet of letter paper, folded in half.
					</p>
					<div class="zine-item__actions">
						<a class="btn btn--primary" href="{base}/zines/abolish-lawns-zine-01.pdf" download>
							↓ Download PDF
						</a>
						<a class="btn btn--ghost" href="{base}/zines/abolish-lawns-zine-01.pdf" target="_blank">
							Preview →
						</a>
					</div>
					<p class="zine-item__print">
						Print instructions: print double-sided on letter paper,
						fold in half lengthwise. No staple needed.
						Free to reproduce without permission.
					</p>
				</div>
			</div>

			<div class="zine-item">
				<div class="zine-item__meta">
					<span class="zine-item__number">No. 02</span>
					<span class="zine-item__year">2025</span>
				</div>
				<div class="zine-item__body">
					<h2 class="zine-item__title">Your Water Bill Is a Lawn Bill</h2>
					<p class="zine-item__desc">
						Water bills up 24% in five years. Up to 70% of your summer
						water goes to the lawn. Half evaporates. You pay sewer rates
						on all of it. The city mandates the lawn. You pay the bill.
					</p>
					<div class="zine-item__actions">
						<a class="btn btn--primary" href="{base}/zines/abolish-lawns-zine-02.pdf" download>
							↓ Download PDF
						</a>
						<a class="btn btn--ghost" href="{base}/zines/abolish-lawns-zine-02.pdf" target="_blank">
							Preview →
						</a>
					</div>
					<p class="zine-item__print">
						Print double-sided on letter paper, fold in half lengthwise.
						Leave on a neighbor's doorstep. Leave at your utility company's
						public counter. Free to reproduce without permission.
					</p>
				</div>
			</div>


			<div class="zine-item">
				<div class="zine-item__meta">
					<span class="zine-item__number">No. 03</span>
					<span class="zine-item__year">2025</span>
				</div>
				<div class="zine-item__body">
					<h2 class="zine-item__title">Your Lawn Uses More Water Than AI</h2>
					<p class="zine-item__desc">
						For environmentalists already writing their senators about data centers.
						US lawns consume 170 times more water than all US data centers combined.
						Your anger is correct. Here is where to aim it.
					</p>
					<div class="zine-item__actions">
						<a class="btn btn--primary" href="{base}/zines/abolish-lawns-zine-03.pdf" download>
							↓ Download PDF
						</a>
						<a class="btn btn--ghost" href="{base}/zines/abolish-lawns-zine-03.pdf" target="_blank">
							Preview →
						</a>
					</div>
					<p class="zine-item__print">
						For climate meetings, water board hearings, environmental orgs.
						Leave at your Sierra Club chapter table. Free to reproduce.
					</p>
				</div>
			</div>
		</div>

		<div class="coming-soon">
			<p>More zines in production. <a href="{base}/">Return to the manifesto →</a></p>
		</div>
	</section>

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
	font-size: clamp(3rem, 8vw, 7rem);
	font-weight: 900;
	line-height: .9;
	letter-spacing: -.02em;
	text-transform: uppercase;
	color: var(--ink);
	margin: var(--space-6) 0;
}

.deck {
	font-size: var(--text-lg);
	line-height: 1.6;
	max-width: 60ch;
	margin-top: var(--space-6);
	color: var(--text-primary);
}

.section { padding: var(--space-8) 0 var(--space-16); }

.zine-list { margin-top: var(--space-8); }

.zine-item {
	display: grid;
	grid-template-columns: 100px 1fr;
	gap: var(--space-8);
	padding: var(--space-8) 0;
	border-bottom: 1px solid var(--border);
}

.zine-item__meta {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	padding-top: 4px;
}

.zine-item__number {
	font-family: var(--font-display);
	font-size: var(--text-lg);
	font-weight: 900;
	color: var(--acid-dim);
	letter-spacing: .02em;
}

.zine-item__year {
	font-family: var(--font-display);
	font-size: var(--text-sm);
	color: var(--text-tertiary);
	letter-spacing: .08em;
}

.zine-item__body {
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}

.zine-item__title {
	font-family: var(--font-display);
	font-size: var(--text-2xl);
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: -.01em;
	color: var(--ink);
}

.zine-item__desc {
	font-size: var(--text-base);
	color: var(--text-secondary);
	line-height: 1.6;
	max-width: 55ch;
}

.zine-item__actions {
	display: flex;
	gap: var(--space-4);
	align-items: center;
}

.btn {
	font-family: var(--font-display);
	font-size: var(--text-sm);
	font-weight: 700;
	letter-spacing: .06em;
	text-transform: uppercase;
	text-decoration: none;
	padding: var(--space-3) var(--space-6);
	transition: background .15s, color .15s;
}

.btn--primary {
	background: var(--ink);
	color: var(--bg-base);
}

.btn--primary:hover {
	background: var(--acid-dim);
	color: var(--bg-base);
}

.btn--ghost {
	background: transparent;
	color: var(--ink);
	border: 1.5px solid var(--rule);
}

.btn--ghost:hover {
	background: var(--bg-raised);
}

.zine-item__print {
	font-size: var(--text-xs);
	color: var(--text-tertiary);
	line-height: 1.5;
	max-width: 55ch;
	border-top: 1px solid var(--border);
	padding-top: var(--space-3);
}

.coming-soon {
	padding: var(--space-8) 0;
	font-size: var(--text-sm);
	color: var(--text-tertiary);
}

@media (max-width: 480px) {
	.zine-item { grid-template-columns: 1fr; gap: var(--space-4); }
	.zine-item__actions { flex-direction: column; align-items: flex-start; }
}

@media print { .zine-item__actions { display: none; } }
</style>
