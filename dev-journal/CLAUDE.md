# Dev Journal — CLAUDE.md

Anti-hallucination guardrails and editorial conventions for the dev journal at
`jason-edelman.org/dev-journal/`.

---

## What this is

A public-facing journal of technical work: launches, non-obvious problems, design
decisions, research detours. Written by Jason and Claude collaboratively. The audience
is other developers and technically literate readers who are curious about the process
of building things.

---

## Hard rules

**Never invent.** Every fact in an entry must be traceable to actual session work.
If you're unsure whether something happened, omit it. Do not fill gaps with plausible
reconstructions.

**No PII.** No full names of third parties, no email addresses, no phone numbers,
no home addresses. First names or handles only for collaborators already public
(e.g., Attie, Scout-Two's Bluesky handle).

**No proprietary IP.** Do not describe internal business logic, pricing details,
API keys, secret architecture specifics, or anything that would give a competitor
meaningful advantage. Project names and public repo links are fine. High-level
descriptions of research areas are fine. Specs are not.

**Optical/photonic work specifically:** Mention the research area, link to published
scientific papers if relevant, describe the problem space. Do not describe architectural
decisions, component choices, cost estimates, or system designs from the PLID/Glass Brain
sessions.

---

## Structure

```
dev-journal/
  index.html          ← listing page, reverse-chron cards, update with every new entry
  journal.css         ← shared styles, do not duplicate into entry files
  YYYY-MM-DD-slug.html  ← individual entries
```

For multi-day sessions: `YYYY-MM-DD-slug.html` using the start date, note the range
in the entry header's date field (e.g., "April 7–8, 2026").

---

## Entry template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Title] — Dev Journal</title>
  <meta name="description" content="[One sentence, ~150 chars.]">
  <link rel="stylesheet" href="journal.css">
</head>
<body>
  <main>
    <nav>
      <a href="/" class="home">← jason-edelman.org</a>
      <a href="index.html">Dev Journal</a>
    </nav>

    <article>
      <header>
        <h1>[Title]</h1>
        <p class="date">[Month D, YYYY]</p>
      </header>

      <section>
        <p>[Opening paragraph — what happened, no preamble.]</p>
        <p>...</p>
      </section>
    </article>

    <a href="index.html" class="back-link">← All entries</a>
  </main>
</body>
</html>
```

Index card template (add at top of `.entries` list):

```html
<li class="entry-card">
  <a href="YYYY-MM-DD-slug.html">
    <h2>[Title]</h2>
  </a>
  <p class="date">[Month D, YYYY]</p>
  <p>[One-sentence lede matching the entry's opening thrust.]</p>
</li>
```

---

## Voice and style

- First person, past tense
- Thesis-first within paragraphs — no burying the point
- 300–500 words per entry; longer only if the problem genuinely warrants it
- Link to public repos and published papers freely
- No listicles; prose only
- No marketing language; no inflation; failures and pivots are good content
- The failure mode worth documenting is as valuable as the success

---

## What earns an entry

- A launch (project, feature, major content series)
- A non-obvious technical problem and how it was solved
- A design decision with interesting tradeoffs
- A pivot or hold decision with real reasoning
- A research detour that changed the shape of understanding

## What does not earn an entry

- Routine bug fixes with no transferable lesson
- Sessions that were mostly planning without shipping
- Anything that can't be described without revealing private architecture
- Incremental work that belongs in a future entry covering the whole arc
