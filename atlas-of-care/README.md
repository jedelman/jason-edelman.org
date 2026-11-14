# Atlas of Care

A map for finding each other, served at `jason-edelman.org/atlas-of-care/`. Plain
browser JavaScript, no build step. Subtitle: "find each other."

The page opens on two questions. "What do you do to hold your world together?" takes
one sentence in the person's own words that begins with "I" ("I feed the birds", "I cook
for my kids", "I clean toilets"), in a place. "Who holds your world together?" takes a
vouch for a sentence someone else has written. Nobody can say what another person does:
you say your own work, you affirm someone else's, and you are affirmed for yours.

- a place is tinted when someone is there, brighter the more there are;
- an amber mark is something someone says they do; it carries a ring when it is vouched for;
- a line joins what a person does to each thing they vouch for;
- picking a place, on the map or by name in the search box, lists what is said there;
- "Who vouches for whom" lists each person with everything they vouch for;
- someone signed in is shown what the people they follow have said, each with a Vouch
  button, and can filter the map to them.

The world map is by country. Three parts of it open to smaller places: US counties,
Indian districts and European NUTS-2 regions. Each entry carries the handle of whoever
added it, and anyone signed in can ask for one to be taken down.

**What was here before.** The atlas began 2026-11-14 as statistics tinted onto the map
(29 world layers and local ones, from Our World in Data, the WHO, the ILO, County Health
Rankings, NFHS-5 and Eurostat) with 56 researched case studies. Jason dropped the case
studies and then the statistics the same day, to put all of it on people finding each
other. For a few hours an entry was a bare web address ("no free text"); Jason then
brought free text back, as I-statements only. Both are in this folder's git history: `data/entries.json`, `data/*.values.json`
and `build/` before that date, with the rebuild steps in this README's history.

It is styled to the rest of the site: the field-notes palette, Epilogue and Charis SIL,
no rounded corners, shadows or gradients (`.impeccable.md`).

## Files

| File | What it is |
|---|---|
| `index.html` | Markup and styles. |
| `app.js` | The map, the place search, who is in a place, who vouches for whom, sign-in, saying what you do, vouching and asking for a takedown. |
| `atlas.js` | The rules for statements, vouches and takedown requests: building, checking and loading them. No DOM, so it runs in Node tests. |
| `atlas.test.mjs` | `node --test atlas-of-care/atlas.test.mjs` |
| `client-metadata.json` | The atproto OAuth client. Its scope is the three collections below. |
| `lexicons/` | The schemas of a statement, a vouch and a takedown request. |
| `hidden.json` | What this page declines to show (`dids`, `uris`), and statements it shows despite a takedown request (`keep`). |
| `data/` | Map shapes (`*.topo.json`, `in.geo.json`), the name of every place (`*.names.json`) and the prior-work list (`prior.json`). |
| `vendor/` | d3 7.9.0 and topojson-client 3.1.0, checked in; `vendor/LICENSES.txt` has the notices. |

Sign-in and the backlink index reuse the Library's code: `app.js` imports
`../library/lib.js` and the SDK under `../library/vendor/`. If the Library moves, this
breaks.

The services it calls: Google Fonts; then, for what people add, Constellation
(backlinks), plc.directory (DID documents), each author's PDS (their records),
bsky.social (handle resolution), and, for someone signed in, public.api.bsky.app
(which accounts on the map they follow). No code loads from a CDN at runtime.

## What people can add

| Record | Repo | Meaning |
|---|---|---|
| `org.jason-edelman.atlas.statement` | whoever says it | One sentence that begins with "I", and a place. It may carry a web address. |
| `org.jason-edelman.atlas.vouch` | whoever vouches | A pointer at one statement, by address and content hash. Nothing else. |
| `org.jason-edelman.atlas.takedown` | whoever asked | A request that one statement or vouch come off the page. It points at the record and gives no reason. |

Nobody keeps a list of contributors and this site stores nothing. Each record names
the atlas's DID (`did:plc:zz4wcje4a2nbbtc7pdoth3f2`, jason-edelman.org) in its
`atlas` field. [Constellation](https://constellation.microcosm.blue/) answers "which
records point at this DID?", and each one it reports is read from its author's own PDS.

### Statements

Jason, 2026-11-14: "Let's allow I-statements only and bring free text back. Under what
do you do, indicate 'I...' Feed the birds, cook for my kids, clean toilets, etc. THAT is
what we're vouching. You can't say what others do - only affirming and being affirmed
for your own work".

**A statement** holds `text`, `scope`, `unit`, `lat`, `lon`, `createdAt` and optionally
`url`. The form shows a fixed "I" and the person writes the rest; `withI` joins them
and does not double an "I" typed anyway. `cleanStatement` then requires:

- it begins with "I " (or "I'm ", "I've ", "I'll ", "I'd ");
- one line, at most 140 characters, whitespace collapsed;
- no control or direction-changing characters;
- no web address and no `@` in it. The address has its own field, and a mention is a
  way of talking about someone else. (This second rule is Claude's addition.)

The same check runs when a record is read, so a statement written by other software
that does not begin with "I" is not shown. Two things carry the rule that nobody says
what others do: a statement lives in its author's own repo, and it has to say "I".
Grammar cannot do more than that. "I think my neighbour is a thief" passes. The
takedown request is the remedy.

The unit is the country, county, district or region that was selected when it was
added; the coordinates are that unit's centre, rounded to two decimal places, as
strings (atproto records hold no floats). A statement is never placed at an address.
Its place name is looked up from the unit id, so a record cannot supply one; one whose
unit this atlas does not have is not shown. The text is always written to the page as
text, never as markup.

### Vouches

A vouch points at one statement the way atproto pins a record: `subject` is
`{uri, cid}`, the statement's address and its content hash. It affirms that sentence as
it stood. It counts only while the statement is on the map with the same hash
(`standingVouches`), so if the author rewrites the sentence with other software the
vouches for the old wording fall away, and if the statement is removed or taken down
they stop showing.

A voucher counts once per statement, however many records they wrote, and a vouch for
one's own statement is not counted (`cleanVouches`). "Withdraw my vouch" deletes the
voucher's records. Whoever wrote the statement sees "decline" beside each voucher on
their own card: it writes a takedown request against each record behind that vouch, and
the vouch comes off this page at once. The record itself stays in the voucher's
account, where this site cannot reach it. Listing a DID under `dids` in `hidden.json`
also stops that account's statements showing as vouched for.

The second question's form takes a handle and lists what that person has said, each
with a Vouch button. If they have said nothing here, it says only they can.

Vouch records written under the two earlier rules (for a web address or an account;
then for an account only) are no longer vouches. As far as is known none were ever
written outside tests.

### People you follow

Once someone signs in, the page asks Bluesky's public AppView
(`public.api.bsky.app`, `app.bsky.graph.getRelationships`) which of the accounts on
the map they follow: 30 accounts a call, at most 900 accounts (`loadFollowing`). It
sends the signed-in account's DID and the DIDs on the map, all of them public. It does
not read the person's whole follow list. If any call fails the panel says so and shows
nobody, so a partial answer is never shown as the whole. Follows kept outside Bluesky
are not seen.

**A takedown request** takes effect at once: the statement or vouch stops being shown. Any signed-in account can make one against a statement; the page offers one against a vouch only to whoever wrote the statement. If a request has been looked at and
turned down, list the record's URI under `keep` in `hidden.json` and it is shown again.

Nothing in a record is trusted. `parseStatement` keeps only its own fields, whatever
else the record holds, and drops a web address that does not pass. `cleanUrl` accepts
an address only if it is http(s), has a real host name (no IP addresses, no localhost),
carries no credentials, contains no whitespace or direction-changing characters, and is
at most 400 characters; it drops the fragment. A unit id is letters, digits, dot,
underscore and hyphen, at most 64.

`loadCommunity` fails closed: if the index cannot be asked about statements, vouches or
takedown requests, nothing people have added is shown, because something that someone
asked to have removed might otherwise come back.

### Hiding a statement, or keeping one

`hidden.json`:

- `dids`: nothing added by these accounts is shown.
- `uris`: these statements (`at://did/org.jason-edelman.atlas.statement/rkey`) are not shown.
- `keep`: these are shown even though someone has asked for a takedown.

Hiding does not delete: the record stays in its author's account. Its author can
delete it with the Remove button.

## Known limits

- **Free text is back, and it is public.** A statement sits in the public repo of
  whoever wrote it, under their handle, readable by anyone whether or not this page
  shows it. The form says so.
- **"I" is a form, not a guarantee.** The rules stop a sentence that does not begin
  with "I", a web address, and an `@`. They do not stop an I-statement being used to
  talk about someone else, or to say something untrue or cruel. Nobody reads statements
  before they show.
- **Anyone signed in can take a statement down, and can do it to every statement.**
  That is the chosen trade: a wrongly hidden one costs little, a wrongly shown one can
  cost a great deal. `keep` is the way back. With free text this matters more than it
  did, and so does someone watching the page.
- **A vouch says only "I affirm this".** It is not a check. Vouches can be traded.
- **The map is empty until people use it.** There are no marks of the atlas's own.
- **A declined vouch is hidden here, not deleted.** It stays in the voucher's own
  account, where anyone else can still read it.
- **Nobody can be vouched for before they speak.** A vouch needs a statement to point
  at, so finding each other starts with saying what you do.
- **A takedown request needs an atproto account.** Someone without one cannot make one
  here.
- **Constellation is a dependency.** If it does not answer, nothing is shown but the
  bare map, and the page says so.
- **No village or city level, and no street map.** The finest units are US counties,
  Indian districts and European regions. The map is drawn from boundary files with
  d3; there are no tiles.
- **Lines need both ends.** A line is drawn only from someone who has said what they
  do. A person who only vouches appears in "Who vouches for whom" and has no place of
  their own on the map.
- **Bluesky's AppView is a dependency for the follows panel** and for nothing else.
- **Small island states are missing** from the world map (Natural Earth at 1:110m).
- **Sign-in and writing have not been tested end to end**: the rules are unit-tested
  and the page was tested against a simulated index and simulated accounts, but no
  real account has signed in and written a record.

## Running it locally

Serve the repo root and open `http://127.0.0.1:<port>/atlas-of-care/`. On a loopback
address the app uses atproto's loopback OAuth client. Use `127.0.0.1`, not `localhost`.

## The map files

- `world.topo.json`: `world-atlas@2.0.2/countries-110m.json` (Natural Earth).
  `world.names.json` maps each shape's numeric id to an ISO alpha-3 code and a name;
  the alpha-3 code is the unit id a record carries. Kosovo, Somaliland and Northern
  Cyprus have no ISO code and use `XKX`, `XSL` and `XNC`.
- `us.topo.json`: `us-atlas@3.0.1/counties-10m.json`. Unit ids are county FIPS codes.
- `in.geo.json`: geoBoundaries India ADM2 (commit `9469f09`), simplified with shapely
  (`buffer(0)`, `simplify(0.012, preserve_topology=True)`, exterior rings clockwise for
  d3-geo, coordinates to three places). Unit ids are geoBoundaries shape ids.
- `eu.topo.json`: Eurostat GISCO `NUTS_RG_20M_2021_4326_LEVL_2`. Unit ids are NUTS ids.

A unit id is written into people's records, so changing a boundary file's ids orphans
whatever was placed there. The names files were written once, from the value files this
folder used to hold.

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

Boundaries only: Natural Earth through world-atlas and us-atlas; geoBoundaries (India,
Open Database License 1.0); Eurostat GISCO NUTS 2021. The page lists them.
