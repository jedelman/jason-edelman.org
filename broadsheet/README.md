# Broadsheet

Front pages of standard.site writing, picked by people. Two rooms under
`jason-edelman.org/broadsheet/`:

- `newsstand/` (an SPA): every front page from the editors you follow, then everyone
  else. Swipe left and right between editors, up and down through an editor's back
  issues; tap a story to zoom into it. No scrolling: each page is fit to the screen.
  **Back editions** is a calendar of an editor's issues (only days with an edition can
  be picked). **Reshare** sends a whole front page, or one story, to your own.
- `editor/`: make a front page from the writers you follow, and publish it: the day's
  edition, or a **morning** and an **evening** edition, and revise one after it's out.

Plain browser JavaScript, no build step, no server. `broadsheet/` itself redirects to
the newsstand.

Publishing on atproto is solved (Leaflet, pckt, GreenGale, WhiteWind, all writing
`site.standard.document`). Curation wasn't. This is a curation tool: slots on a page,
a wire of recent writing from the publications and people you follow, and a renderer
that sets it as a broadsheet. Every piece links to its author's own site; nothing is
copied but a short excerpt.

## An edition is a standard.site document

An edition is a `site.standard.document` in the editor's own repo, in a broadsheet
publication (a `site.standard.publication` whose `url` is
`https://jason-edelman.org/broadsheet/newsstand`, created on first publish and renamed
when the masthead changes). Its `content` is an `org.jason-edelman.broadsheet.content`
(`lexicons/`): an edition number, the editor's local `date`, an optional `period`
(`am` or `pm`), an editor's note, and up to ten slots, each a
`com.atproto.repo.strongRef` to the picked document plus an optional editor's headline
and deck, and, for a reshare, a `via`: the edition it came from and that broadsheet's
name, shown as "via The Atmosphere".

**One edition per date and period:** the day's edition, the morning edition, the
evening edition. Publishing a second one for the same slot is refused; revise the one
that's out instead (Your editions → Revise), which writes over it and keeps its date,
period, number and publish time. Titles carry the period: "The Atmosphere, Morning
Edition, November 9, 2026".

**Reshare** in the newsstand writes the picked pieces (with their slot and `via`) to a
same-origin hand-off in localStorage; the editor takes them on load, onto the page
where there's room (in the slot they had, if free) and onto the wire under
"reshared" otherwise. The edition's `path` is `/?at=<did>/<rkey>`, so its canonical URL is the edition on the
newsstand. Links people share use the handle: `newsstand/?at=handle/rkey`, or
`?at=handle` for someone's latest.

So editions move through the same ecosystem as everything else: a reader that doesn't
know the content type still sees a document with a title, a description and a
plaintext list of headlines, and anyone can subscribe to a broadsheet like any other
publication.

**Recommend each pick** (on by default) also writes a `site.standard.graph.recommend`
for each piece not already recommended, so authors whose apps show recommendations
see they were picked.

## The wire

`discover()` in `lib.js` gathers the last 45 days from four places:

| Source | How |
|---|---|
| subscribed | `site.standard.graph.subscription` in your repo → each publication's owner's documents whose `site` is that publication |
| following | your `app.bsky.graph.follow` list ∩ the relay's list of repos with `site.standard.document` (`listReposByCollection`) → their newest 100 documents |
| recommended | your follows ∩ repos with `site.standard.graph.recommend` → their recent recommends → those documents |
| yours | your own documents |

Ranked by recency, plus a lift for subscriptions and for each follow who recommended
the piece. Search covers title, description, publication, author, tags and text.
For `jason-edelman.org` on 2026-11-09: 1,572 follows, 155 of whom publish, 55 of whom
recommend; 144 documents from 64 publications in about 15 s in Node, 23 s in the
browser. The pool is cached in localStorage for 10 minutes.

Excerpts come from `textContent` where the platform writes it (pckt, GreenGale), else
from the `plaintext` fields in the content tree (Leaflet), cleaned of checkbox and
list debris. Cover images come through Bluesky's image CDN (thumbnails for the wire
and small slots), falling back to the thumbnail if the full size fails.

Signed out, the editor browses `?as=<handle>`'s follows, or Jason's. **Add a writer by
handle** pulls anyone's recent documents into the wire (remembered per reader), for
writers you don't follow.

## The newsstand

Every masthead on the network comes from one query: Constellation indexes the `url`
field of every `site.standard.publication`, so `links?target=<newsstand url>&
collection=site.standard.publication&path=.url` lists them all. Each masthead's
editions are then read from its owner's repo. The rack puts the reader first, then
editors they follow (`?as=handle`, remembered), then everyone else, each by latest
edition. Constellation is eventually consistent: in testing a new masthead appeared
after 0 to 12 s and a deleted one dropped after about 12 s. A deep link to an edition
the index hasn't caught up with is read directly.

Each front page is laid out at several broadsheet widths (820 to 1880 px) and the one
that comes out largest when scaled to fit the screen wins. The paper lays itself out by
its frame's width (container queries, `cqi` units), and at 1400 px and up it turns
landscape: features move into a third column. So phones get a portrait broadsheet and
desktops a landscape one, both whole. A tap zooms a story out of its place on the page
into a readable card (a FLIP animation from the story's position); swipe or arrow keys
step between stories, and "Read it at …" stays pinned in view. Back, Escape or the
backdrop close it. Keyboard: arrow keys for editors and issues, Enter on a focused
story. Every network read times out after 15 s, so a dead server can't stall the page.

**Back editions** (a tab beside Front page) shows the editor's issues as a month
calendar: only days with an edition are buttons, marked AM/PM; a day with one edition
opens it, a day with two offers both; month arrows skip to months that have editions.

## The page

One lead, two seconds, three features, four briefs. Empty slots drop out of the
reader; a lead without a second spreads full width; headline size follows headline
length; each kicker uses its publication's own `basicTheme.accent`, darkened (or
lightened at night) until it reads at 4.5:1. Night edition via `prefers-color-scheme`,
and a print stylesheet. Auto-fill places the best of the wire as currently filtered,
so search first for a themed page. Drafts live in localStorage until published.

## Permissions, and what could go wrong

The OAuth scope is `repo:site.standard.document repo:site.standard.publication
repo:site.standard.graph.recommend`. Granular scopes are per collection, so this
grants write access to all of the editor's standard.site documents, including ones
written by Leaflet or pckt. The code only ever writes documents it creates, finds the
masthead by its URL, and `deleteEdition` refuses any document whose content isn't a
broadsheet edition. That's a code guarantee, not a protocol one.

Records come from anyone: `readDocument`, `readPublication` and `readEditionContent`
drop anything malformed and cut anything over length, links must be http(s), and
everything renders as text.

## Code

- `lib.js`: discovery, writers by handle, normalizing, ranking, auto-fill, editions
  (publish, revise, delete, load), the masthead index and the rack. No DOM; runs in Node.
- `render.js`: the paper (page and stand variants) and the expanded story.
  `paper.css`: its type and grid.
- `editor/editor.js`: the builder. OAuth and the `Agent` come from `../../library/vendor/`.
- `newsstand/newsstand.js`: the newsstand. No SDK, no sign-in: everything it reads is public.
- `typeahead.js`: handle suggestions (Bluesky's public AppView) as an ARIA combobox, on
  every handle box: the editor's sign-in and "Add a writer", and the newsstand's "Yours
  first". Arrow keys and Enter pick, Escape closes, Enter with nothing highlighted
  submits what you typed.

The services it calls: each author's PDS, plc.directory, the Bluesky relay,
Constellation (the masthead index), Bluesky's public AppView (profiles) and image CDN,
bsky.social (sign-in, editor only), Google Fonts.

## Tested (2026-11-09)

- Node: discovery on Jason's account; on Claude's real PDS, publish, load by link and
  as latest, edition numbering, masthead rename (one publication), revise in place, a
  stale revise refused, the guards; recommends with a mock agent (none written for
  real). Claude's existing standard.site records were left untouched.
- Headless Chromium: the editor signed out on Jason's follows (wire, filters, search,
  auto-fill, swap, editor's headline, remove, add, draft after reload; 1440 and 390
  px); signed in as Claude, publish, revise and delete through the UI (the test edition
  held only Jason's own document, in a masthead kept out of discovery); the reader on
  that edition, and on a full ten-piece edition assembled locally from real documents
  (never written), by day, by night, and at 390 px.

Newsstand (same day): the root redirect and the empty state; Claude's account published
two one-piece test editions (Jason's own document, masthead kept out of discovery),
Constellation indexed the masthead, and the real newsstand found it with no fakes;
swipe up and down between its issues; tap to zoom, Escape to close. A full ten-piece
edition, served locally and never written: fit with no scroll at 1440x900 (landscape
layout, shown 692x763) and on an iPhone 13 (portrait, 270x529), zoom stepping, the
Read link in view, arrow keys between editors, `?at=handle/rkey` in the address bar.
Claude's repo was identical before and after.

Reshare, editions and back editions (same day): in Node on Claude's PDS, a morning, an
evening and a day's edition for one date, a second of each refused, numbering, `via`
round trip; in Chromium, the calendar over five local-only editions across two months
(a day with both AM and PM), opening older issues, reshare of a story and a whole page
into the editor (10 pieces, all credited), publishing a morning edition from the
editor, the same edition refused, the evening edition published, both on Claude's
calendar. Claude's repo identical before and after.

Not yet tested: a real OAuth sign-in (needs a person's password), a real phone (the
iPhone runs were emulated), and self-hosted PDSes that send no CORS headers (they show
up as "couldn't be read").
