# Atlas of Care

A page for finding each other, served at `jason-edelman.org/atlas-of-care/`. Plain
browser JavaScript, no build step. Subtitle: "find each other."

The page opens on two questions. "What do you do to hold your world together?" takes
one sentence in the person's own words that begins with "I" ("I feed the birds", "I cook
for my kids", "I clean toilets"). "Who holds your world together?" takes a vouch for a
sentence someone else has written. A vouch says the voucher knows it to be so and it
holds their world together. A like says only that they are glad of it, so anyone can
like a sentence they are in no position to vouch for. People can only write about
themselves: you say your own work, you affirm someone else's, and you are affirmed for
yours.

Directly under the two questions are four numbered steps: sign in, say what you do,
like, vouch. A step's number is filled in once the signed-in person has done it. The
first two open the panel under the first question, which holds the sign-in box and,
once someone is signed in, the form for saying what they do. The last two scroll to
"Everyone here".

Below the steps the page draws a force-directed graph:

- a mark for each person who has said what they do; it grows with the vouches and
  likes their statements are given;
- an amber arrow from a person to someone whose statement they vouch for, and a thinner
  green arrow for a like (one arrow per pair of people; if there is a vouch, the arrow
  is amber);
- marks push apart and arrows pull together, so people who affirm each other end up
  close together;
- picking a mark lists what that person says they do and what they vouch for;
- filters: everyone, vouched for, people you follow, and one place.

A line of text under the graph explains how to pick, drag and zoom. Under that, "Who vouches for
whom" and "Everyone here" give the same content as text; each statement in "Everyone
here" is a card with its buttons (Like, Vouch, Show in the graph, and Request takedown
or, on one's own, Remove). Someone signed in also gets a "People you follow"
panel above the graph: what the people they follow have said, each with Like and Vouch
buttons.

It is styled to the rest of the site (Epilogue and Charis SIL, the dark green palette,
no rounded corners, shadows or gradients). The site's design notes are in
`.impeccable.md` at the repo root, and this page's history is in `CHANGELOG.md`.

## Files

| File | What it is |
|---|---|
| `index.html` | Markup and styles. |
| `app.js` | The graph, the filters, one person's statements, who vouches for whom, sign-in, saying what you do, liking, vouching and asking for a takedown. |
| `atlas.js` | The rules for statements, vouches, likes and takedown requests: how each is built, checked and loaded. It has no DOM code, so it runs in Node tests. |
| `atlas.test.mjs` | `node --test atlas-of-care/atlas.test.mjs` |
| `client-metadata.json` | The atproto OAuth client. Its scope is the four collections below. |
| `lexicons/` | The schemas of a statement, a vouch, a like and a takedown request. |
| `hidden.json` | What this page will not show (`dids`, `uris`), and statements it shows although someone asked for a takedown (`keep`). |
| `data/` | The name of every place a statement can name (`*.names.json`) and the prior-work list (`prior.json`). |
| `vendor/` | d3 7.9.0, checked in; `vendor/LICENSES.txt` has the notice. |
| `CHANGELOG.md` | What the atlas was before, and where the removed parts are. |

Sign-in and the code that asks Constellation (the index described under Records) reuse
the Library, this site's lending-library app in `../library/`: `app.js` imports `../library/lib.js` and the atproto SDK under
`../library/vendor/`. If the Library moves, this page breaks.

The folder is listed in `scripts/build.mjs` (`STATIC`) and deploys with the rest of the
site when `main` is pushed.

The services the page calls: Google Fonts; then, for what people add, Constellation
(which records point at the atlas), plc.directory (DID documents), each author's PDS
(their records), bsky.social (turning a handle into an account), and, for someone
signed in, public.api.bsky.app (which accounts on the page they follow). No code loads
from a CDN at runtime.

## Records

| Record | Repo | Meaning |
|---|---|---|
| `org.jason-edelman.atlas.statement` | whoever says it | One sentence that begins with "I". It may name a place and carry a web address. |
| `org.jason-edelman.atlas.vouch` | whoever vouches | A pointer at one statement: its at-uri and content hash. It has no other content. |
| `org.jason-edelman.atlas.like` | whoever likes | The same pointer in its own collection. |
| `org.jason-edelman.atlas.takedown` | whoever asked | A request that one statement or vouch come off the page. It points at the record and gives no reason. |

This site stores none of these and keeps no list of contributors. Each record names
the atlas's DID (`did:plc:zz4wcje4a2nbbtc7pdoth3f2`, jason-edelman.org) in its
`atlas` field. [Constellation](https://constellation.microcosm.blue/), an outside index
of links between atproto records, answers "which records point at this DID?", and each
record it reports is read from its author's own PDS.

### Statements

Jason, 2026-11-14: "Let's allow I-statements only and bring free text back. Under what
do you do, indicate 'I...' Feed the birds, cook for my kids, clean toilets, etc. THAT is
what we're vouching. You can't say what others do - only affirming and being affirmed
for your own work".

A statement holds `text` and `createdAt`, and optionally `url` and a place (`scope` and
`unit` together). The form shows a fixed "I" and the person writes the rest; `withI`
joins them and does not double an "I" that was typed anyway. `cleanStatement` then
requires:

- it begins with "I " (or "I'm ", "I've ", "I'll ", "I'd ");
- one line, at most 140 characters, whitespace collapsed;
- no control or direction-changing characters;
- no web address and no `@` in it. The web address has its own field, and a mention is
  a way of talking about someone else. (Claude, the AI assistant that built this page
  with Jason, added the ban on a web address and an `@`. Jason has not yet said whether
  to keep it.)

The same check runs when a record is read, so a statement written by other software
that does not begin with "I" is not shown. Two things hold people to writing about
themselves: a statement lives in its author's own repo, and it has to begin with "I".
The check goes no further than that. "I think my neighbour is a thief" passes. A
takedown request is the way to deal with a statement like that.

The page has no edit button. A statement can be removed and written again.

The place is optional. The form offers one list of names (countries, US counties,
Indian districts, European NUTS-2 regions; `data/*.names.json`) and stores the list's
key (`scope`) and the place's id in that list (`unit`), never a typed name. The form will not save a place that is not
on the list, and a record whose place fails the check is shown without one. A place is
never a street address. A record may hold fields the atlas does not read, such as
coordinates; those are ignored. The text is always written to the page as text, never
as markup.

### Vouches

A vouch points at one statement the way atproto pins a record: `subject` is
`{uri, cid}`, the statement's at-uri and its content hash. It affirms that sentence in
the wording it had. It counts only while the statement is shown with the same hash
(`standingVouches`). If the author changes the sentence with other software, vouches
for the old wording stop counting, and if the statement is removed or taken down they
stop showing. A vouch record whose subject is anything else, such as an account or a
web address, is not counted.

A voucher counts once per statement, however many records they wrote, and a vouch for
one's own statement is not counted (`cleanVouches`). After someone vouches, the Vouch
button reads "Vouched"; pressing it again deletes their vouch records. Whoever wrote the statement sees "decline" beside each voucher on
that statement's card: it writes a takedown request against each record behind that
vouch, and the vouch stops showing on this page straight away. The record itself stays
in the voucher's account, which this site cannot change.

The second question's form takes a handle and lists what that person has said, each
with Like and Vouch buttons. If that person has no statements here, the form says that
only they can add one.

### Likes

Jason, 2026-11-14: "You can like something even if you can't vouch for it. RAMPANT
POSITIVITY". A like is the same record as a vouch in its own collection: a pointer at
one statement by at-uri and content hash. It follows the same rules (`cleanLikes`,
`standingLikes`): once per person per statement, not for one's own, and only while the
sentence has the wording it had when it was liked. The page shows a count on the Like
button and does not list who liked. Pressing Like again deletes the record. A like
cannot be declined; it is hidden with the statement, or by listing the liker under
`dids` in `hidden.json`.

### Takedown requests

A takedown request takes effect straight away: the statement or vouch stops being
shown. Any signed-in account can make one against a statement. The page offers one
against a vouch only to whoever wrote the statement, as "decline".

The page shows a count of what is withheld and has no screen that lists the requests.
To read them, ask Constellation which takedown records point at the atlas's DID, as the
page does:

```
https://constellation.microcosm.blue/links?target=did:plc:zz4wcje4a2nbbtc7pdoth3f2&collection=org.jason-edelman.atlas.takedown&path=.atlas&limit=100
```

Each result names an account and a record key; the record itself, read from that
account's PDS, holds the at-uri of the statement or vouch it asks to remove. If a
request should not stand, list that statement's or vouch's at-uri (not the request's)
under `keep` in `hidden.json` and it is shown again. This also restores a declined
vouch.

### Record checks

Every field of a record is checked before it is shown. `parseStatement` keeps only its
own fields, whatever else the record holds, and drops a web address that fails
`cleanUrl`. `cleanUrl` accepts an address only if it is http(s), has a real host name
(no IP addresses, no localhost), has no username or password in it, contains no
whitespace or direction-changing characters, and is at most 400 characters; it drops
the fragment. A unit id is letters, digits, dot, underscore and hyphen, at most 64.

`loadCommunity` fails closed. If Constellation cannot be asked about statements,
vouches, likes or takedown requests, the page shows none of what people have added,
because a statement that someone asked to have removed might otherwise come back.

### hidden.json

- `dids`: none of what these accounts added is shown.
- `uris`: these statements (`at://did/org.jason-edelman.atlas.statement/rkey`) are not shown.
- `keep`: these statements or vouches are shown even though someone has asked for a takedown.

Hiding does not delete: the record stays in its author's account. Its author can
delete it with the Remove button on its card.

### People you follow

Once someone signs in, the page asks Bluesky's public AppView
(`public.api.bsky.app`, `app.bsky.graph.getRelationships`) which of the accounts on
the page they follow: 30 accounts a call, and only the first 900 accounts are checked
(`loadFollowing`). It
sends the signed-in account's DID and the DIDs on the page, all of them public. It does
not read the person's whole follow list. If any call fails, the "People you follow"
panel says so and lists nobody rather than a partial list. Follows kept outside Bluesky
are not seen.

## Known limits

- Statements are free text, and public. A statement sits in the public repo of whoever
  wrote it, under their handle, and anyone can read it there whether or not this page
  shows it. The form says so.
- The checks stop a sentence that does not begin with "I", a web address, and an `@`.
  They do not stop an I-statement being used to talk about someone else, or to say
  something untrue or cruel. No one reads a statement before it shows.
- Anyone signed in can take a statement down, and can do it to every statement. That is
  the chosen trade: a wrongly hidden statement costs little, and a wrongly shown one
  can cost a great deal. `keep` puts one back. Because statements are free text and can
  be taken down by anyone, someone should watch the page.
- A vouch says only "I affirm this", and a like says less. Neither is a check, and
  people can agree to vouch for each other.
- The page is empty until people use it. The atlas adds no entries of its own.
- A declined vouch is hidden here and not deleted. It stays in the voucher's own
  account, where anyone else can still read it.
- A vouch needs a statement to point at, so a person cannot be vouched for until they
  have said what they do.
- A takedown request needs an atproto account. Someone without one cannot make one
  here.
- Constellation is a dependency. If it does not answer, the page shows none of what
  people have added and says so.
- A place is an optional name: a country, a US county, an Indian district or a European
  region. The lists go no finer than that.
- Only people who have said what they do are drawn. Someone who only likes and vouches
  has no mark; their vouches still show on the cards and in "Who vouches for whom", and
  their likes still count.
- Where a mark settles depends on the simulation and changes between visits, so
  position in the graph measures nothing. Past 40 people, names show only for whoever
  is picked or under the pointer. The graph has not been tried with hundreds of people.
- Bluesky's AppView is a dependency for the "People you follow" panel only.
- Small island states are missing from the list of countries (Natural Earth at 1:110m).
- One real account has signed in and written a statement, on 2026-11-14, and the page
  read it back through Constellation. A like, a vouch, a decline and a takedown request
  have only been tested against a simulated index and simulated accounts.

## Running it locally

Serve the repo root and open `http://127.0.0.1:<port>/atlas-of-care/`. On a loopback
address the app uses atproto's loopback OAuth client. Use `127.0.0.1`, not `localhost`:
the app builds its sign-in redirect address with `127.0.0.1`.

## The place names

- `world.names.json`: ISO alpha-3 code to country name, from Natural Earth through
  `world-atlas@2.0.2`. Kosovo, Somaliland and Northern Cyprus have no ISO code and use
  `XKX`, `XSL` and `XNC`.
- `us.names.json`: county FIPS code to "County, ST", from County Health Rankings 2025
  where it names the county, otherwise from `us-atlas@3.0.1`.
- `in.names.json`: geoBoundaries shape id to "District, State" (India ADM2, commit `9469f09`).
- `eu.names.json`: NUTS id to "Region, CC" (Eurostat GISCO, NUTS 2021 level 2).

A unit id is written into people's records, so changing an id in one of these files
leaves every statement that names that place without one. Names that collide across
lists resolve to the first list in the order world, us, in, eu.

## Prior work

`data/prior.json` holds the works cited in the page's Prior work section. Each was
checked against a page fetched on 2026-11-14: the publisher's, the project's own, or a
catalogue record; `notes` says which, and what could not be confirmed. Four entries
(Waring, Fisher and Tronto, Peluso, Mattern) rest on a catalogue or bibliographic record
only and say so. Add a work only after opening its page. Describe what the work is;
do not claim it influenced this atlas.

An organisation called Atlas of Care (formerly Atlas of Caregiving) used this name
first. Its own About page says it shut down at the end of 2025. It is the first entry.

## Sources

The page's Sources section lists Constellation, Bluesky's public AppView and where the
place names come from. It leaves out the other services the page calls (Google Fonts,
plc.directory, the authors' own servers and bsky.social), which are listed under Files.
