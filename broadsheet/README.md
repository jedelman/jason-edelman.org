# Broadsheet

A front page of standard.site writing, picked by a person. Served at
`jason-edelman.org/broadsheet/`: `index.html` reads an edition, `edit.html` builds one.
Plain browser JavaScript, no build step, no server.

Publishing on atproto is solved (Leaflet, pckt, GreenGale, WhiteWind, all writing
`site.standard.document`). Curation wasn't. This is a curation tool: slots on a page,
a wire of recent writing from the publications and people you follow, and a renderer
that sets it as a broadsheet. Every piece links to its author's own site; nothing is
copied but a short excerpt.

## An edition is a standard.site document

An edition is a `site.standard.document` in the editor's own repo, in a broadsheet
publication (a `site.standard.publication` whose `url` is
`https://jason-edelman.org/broadsheet`, created on first publish and renamed when the
masthead changes). Its `content` is an `org.jason-edelman.broadsheet.content`
(`lexicons/`): an edition number, an editor's note, and up to ten slots, each a
`com.atproto.repo.strongRef` to the picked document plus an optional editor's headline
and deck. The edition's `path` is `/?at=<did>/<rkey>`, so its canonical URL is the
reader page.

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

Signed out, the builder browses `?as=<handle>`'s follows, or Jason's.

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

- `lib.js`: discovery, normalizing, ranking, auto-fill, editions (publish, revise,
  delete, load). No DOM; runs in Node.
- `render.js`: the paper, for both pages. `paper.css`: its type and grid.
- `edit.js`: the builder. OAuth and the `Agent` come from `../library/vendor/`.

The services it calls: each author's PDS, plc.directory, the Bluesky relay, Bluesky's
public AppView (profiles) and image CDN, bsky.social (sign-in), Google Fonts.

## Tested (2026-11-09)

- Node: discovery on Jason's account; on Claude's real PDS, publish, load by link and
  as latest, edition numbering, masthead rename (one publication), revise in place, a
  stale revise refused, the guards; recommends with a mock agent (none written for
  real). Claude's existing standard.site records were left untouched.
- Headless Chromium: the builder signed out on Jason's follows (wire, filters, search,
  auto-fill, swap, editor's headline, remove, add, draft after reload; 1440 and 390
  px); signed in as Claude, publish, revise and delete through the UI (the test edition
  held only Jason's own document, in a masthead kept out of discovery); the reader on
  that edition, and on a full ten-piece edition assembled locally from real documents
  (never written), by day, by night, and at 390 px.

Not yet tested: a real OAuth sign-in (needs a person's password), a real phone, and
self-hosted PDSes that send no CORS headers (they show up as "couldn't be read").
