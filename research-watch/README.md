# Research watch

A daily digest and a weekly analysis for Mithlond and Abolish Lawns, researched and published by two scheduled Claude
Code routines. Set up 2026-11-18 at Jason's ask: "a spider agent for research, particularly on mithlond and
abolish-lawns; publishing summaries daily and analysis weekly on the topic."

Published at https://jason-edelman.org/mithlond/watch/ and https://jason-edelman.org/abolish-lawns/watch/.

## The rule: attribution over trust

Jason, 2026-11-18: "i'm inclined to take everything as provisional and only trust independent agreement.
attribution over trust."

So nothing here is believed. Everything is said as *who says what*:

- **Every item quotes its source**, exactly, from a page the routine opened in that run. `verify.mjs` fetches the page
  again and fails any quote it can't find. An unverified item is never published.
- **Every claim is attributed.** Write "Dominion's filing says the tariff applies above 25 MW", never "the tariff
  applies above 25 MW". The page records what was said, by whom, and when; it doesn't endorse it.
- **A claim is corroborated only when independent origins agree.** The status is computed from the ledger
  (`claims.json`), never written by hand:
  - **provisional**: one origin asserts it (the default, and most claims stay here);
  - **corroborated**: two or more distinct origins assert it, and none disputes it;
  - **disputed**: at least one origin asserts it and at least one disputes it.
- **The origin is who produced the information, not who carried it.** A news story that reports a press release has
  the release's issuer as its origin. Two outlets running the same wire story are one origin (the wire service). A
  study commissioned by a company has that company as its origin. An outlet's own reporting (its records requests,
  its interviews, its measurements) has the outlet as its origin. When in doubt, use the same origin: a false
  corroboration is worse than a missed one.
- **Prefer primary sources** (the agency's order, the docket filing, the paper, the bill text) to coverage of them,
  but take what's there: a news report is a source like any other, attributed to its outlet.
- **Short quotes, linked out.** One to three sentences (20–600 characters), attributed, with the link. Never reproduce
  an article. A paywalled page that can't be opened and quoted is listed as unreachable, not summarized from memory or
  from someone else's summary of it.
- **No private people.** Name officials, agencies, companies, and authors of published work. Don't name private
  residents, even if a source does.
- **Take only what's offered.** Honor robots.txt and Content-Signal (`node research-watch/verify.mjs --can <url>`;
  `verify.mjs` refuses closed URLs anyway). Never get around a block: no CAPTCHA solving, no disguised user agent, no
  archive or mirror to reach a page its publisher closed. A closed source is listed as unreachable, and its contents
  arrive, if at all, through someone else's attributed reporting. The State Corporation Commission's robots.txt closes
  its whole site to agents like this one, so SCC actions reach the watch only through coverage of them.

## Layout

```
research-watch/
  README.md            this protocol
  ROUTINES.md          the two scheduled tasks' prompts (daily digest, weekly analysis), versioned here
  projects.json        the projects: where their data lives, where their pages go, their public URL
  verify.mjs           re-fetches every unverified quote (HTML, PDF, or a rendered page) and marks it verified
  render.mjs           writes each project's watch pages and Atom feed from its data (--check: are they current?)
  lib.mjs              shared helpers (escaping, text normalization, claim status, a small markdown renderer)
  templates/<id>.tpl   each project's page chrome, so the pages look like the rest of that project

<project>/research/watch/
  sources.json         scope, seed sources and search queries
  seen.json            every URL considered (published or not), so tomorrow skips it
  claims.json          the claims ledger: each claim with every source that asserts or disputes it
  digests/YYYY-MM-DD.json
  weekly/YYYY-Www.md
```

Pages are written to `mithlond/watch/` and `abolish-lawns/site/watch/`: an index, one page per digest and per weekly
analysis, the claims ledger, and `feed.xml`. They're plain files, committed, like the rest of the site.

## Data

**Digest** (`digests/YYYY-MM-DD.json`), one per project per day, only when there's something new:

```json
{
  "date": "2026-11-19",
  "project": "mithlond",
  "run": "<the session link>",
  "summary": "Two to four plain sentences: what was newly said, and by whom.",
  "checked": ["seed ids looked at"],
  "items": [
    {
      "title": "Attributed headline, e.g. \"SCC staff: Dominion's large-load forecast is too high\"",
      "url": "https://…",
      "publisher": "who published the page",
      "origin": "who produced the information (see the rule above)",
      "kind": "primary | government | academic | news | advocacy | industry",
      "published": "YYYY-MM-DD, or null if the page doesn't say",
      "quote": "exact text from the page",
      "note": "one line on why it bears on the project; claims nothing the quote doesn't",
      "claims": ["claim ids this item asserts or disputes"]
    }
  ],
  "unreachable": [{ "url": "https://…", "why": "paywall | 403 | timeout | PDF without text" }]
}
```

**Claim** (in `claims.json`):

```json
{
  "id": "short-kebab-id",
  "statement": "What is claimed, stated neutrally, without endorsing it.",
  "topic": "a word or two",
  "first_seen": "YYYY-MM-DD",
  "sources": [
    {
      "url": "https://…", "publisher": "…", "origin": "…", "date": "YYYY-MM-DD", "seen": "YYYY-MM-DD",
      "stance": "asserts | disputes", "quote": "exact text from the page"
    }
  ]
}
```

A digest item that touches a claim adds itself to that claim's `sources` with the same quote. New sources for an old
claim are how corroboration (or dispute) arrives, sometimes weeks later: always check the ledger before minting a new
claim, and reuse an existing one when the statement matches.

**Weekly analysis** (`weekly/YYYY-Www.md`):

```markdown
---
title: A plain title
summary: One or two sentences for the index and the feed.
---

Markdown. Every factual statement cites a ledger claim as [[claim-id]], which renders as a link to the ledger with
the claim's status, so the reader always sees whether it's provisional, corroborated or disputed.
```

The analysis reads the week through the project's own frame (see each `sources.json` scope). It may argue, but it
argues only from claims in the ledger, says plainly which are provisional, and names what would settle them. No new
facts appear in an analysis that aren't in the ledger.

## Running it

```bash
node research-watch/verify.mjs            # verify every unverified quote; exit 1 if any fail
node research-watch/render.mjs            # write the pages
node research-watch/render.mjs --check    # exit 1 if the pages are behind the data (the pre-commit hook runs this)
```

`verify.mjs` needs the network; `render.mjs` doesn't. CI only builds what's committed.

## Publishing authority

Jason, 2026-11-18, answering how the watch should publish: daily digests "auto-publish"; weekly analysis "publish
directly and send me a notification"; "site pages only". The routines may open and merge PRs confined to the watch
lane (see the root `CLAUDE.md`, "Merge authority — research watch"). Anything outside it (a project's own pages, its
bibliography, its backlog) goes to Jason as a suggestion, in the weekly analysis or a draft PR, never straight in.
