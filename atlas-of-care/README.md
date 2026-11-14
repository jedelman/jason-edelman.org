# Atlas of Care

A map for finding each other, served at `jason-edelman.org/atlas-of-care/`. Plain
browser JavaScript, no build step. Subtitle: "find each other."

The page opens on two questions. "What do you do to hold your world together?" takes a
link to it, in a place. "Who holds your world together?" takes a vouch for an
organisation or a person, in a place. Those answers are the only things on the map:

- a place is tinted when someone is there, brighter the more there are;
- a round amber mark is what someone does, a square one is someone vouched for;
- a line joins what a person does to whoever they vouch for, when both are on the map;
- picking a place, on the map or by name in the search box, lists who is there;
- "Who vouches for whom" lists each person with everyone they vouch for, and a link's
  card names whoever vouches for the person behind it.

The world map is by country. Three parts of it open to smaller places: US counties,
Indian districts and European NUTS-2 regions. Each entry carries the handle of whoever
added it, and anyone signed in can ask for one to be taken down.

**What was here before.** The atlas began 2026-11-14 as statistics tinted onto the map
(29 world layers and local ones, from Our World in Data, the WHO, the ILO, County Health
Rankings, NFHS-5 and Eurostat) with 56 researched case studies. Jason dropped the case
studies and then the statistics the same day, to put all of it on people finding each
other. Both are in this folder's git history: `data/entries.json`, `data/*.values.json`
and `build/` before that date, with the rebuild steps in this README's history.

It is styled to the rest of the site: the field-notes palette, Epilogue and Charis SIL,
no rounded corners, shadows or gradients (`.impeccable.md`).

## Files

| File | What it is |
|---|---|
| `index.html` | Markup and styles. |
| `app.js` | The map, the place search, who is in a place, who vouches for whom, sign-in, adding a link, vouching and asking for a takedown. |
| `atlas.js` | The rules for links, vouches and takedown requests: building, checking and loading them. No DOM, so it runs in Node tests. |
| `atlas.test.mjs` | `node --test atlas-of-care/atlas.test.mjs` |
| `client-metadata.json` | The atproto OAuth client. Its scope is the three collections below. |
| `lexicons/` | The schemas of a link, a vouch and a takedown request. |
| `hidden.json` | What this page declines to show (`dids`, `uris`), and links it shows despite a takedown request (`keep`). |
| `data/` | Map shapes (`*.topo.json`, `in.geo.json`), the name of every place (`*.names.json`) and the prior-work list (`prior.json`). |
| `vendor/` | d3 7.9.0 and topojson-client 3.1.0, checked in; `vendor/LICENSES.txt` has the notices. |

Sign-in and the backlink index reuse the Library's code: `app.js` imports
`../library/lib.js` and the SDK under `../library/vendor/`. If the Library moves, this
breaks.

The services it calls: Google Fonts; then, for links people add, Constellation
(backlinks), plc.directory (DID documents), each author's PDS (their records), and
bsky.social (handle resolution at sign-in). No code loads from a CDN at runtime.

## What people can add

| Record | Repo | Meaning |
|---|---|---|
| `org.jason-edelman.atlas.link` | whoever added it | A web address and a place. No text of the person's own. |
| `org.jason-edelman.atlas.vouch` | whoever vouched | "This one holds my world together, here": an atproto account or a web address, and a place. No text of the voucher's own. |
| `org.jason-edelman.atlas.takedown` | whoever asked | A request that one link or vouch come off the page. It points at the record and gives no reason. |

Nobody keeps a list of contributors and this site stores nothing. Both records name
the atlas's DID (`did:plc:zz4wcje4a2nbbtc7pdoth3f2`, jason-edelman.org) in their
`atlas` field. [Constellation](https://constellation.microcosm.blue/) answers "which
records point at this DID?", and each one it reports is read from its author's own PDS.

**A link** holds `url`, `scope`, `unit`, `lat`, `lon` and `createdAt`. The unit is the
country, county, district or region that was selected when it was added; the
coordinates are that unit's centre, rounded to two decimal places, as strings (atproto
records hold no floats). A link is never placed at an address. Its place name is looked
up from the unit id, so a record cannot supply one; a link whose unit this atlas does
not have is not shown. The heading on its card is the address's host name.

### Vouches

A vouch names who it is for in one of two ways: an atproto account, stored as its DID
(the form takes a handle and looks the DID up), or an http(s) address. It cannot hold a
name typed as text, so nobody is put on the map who has neither an account nor a web
page. It is placed in the selected unit, like a link.

Vouches for the same one in the same unit show as one entry with everyone who vouched;
a voucher counts once, and a vouch for oneself is not counted (`groupVouches`). The
entry's heading is the account's handle, or the address's host name. "I vouch too" adds
the signed-in person's own record. "Withdraw my vouch" deletes it.

Whoever is vouched for has the same remedy as anyone: a takedown request, which takes
the entry off at once. Because an entry stands for one record per voucher, the button
writes one takedown record for each. Listing a DID or an address under `dids` or `uris`
in `hidden.json` also stops anyone showing as vouched for under it.

**A takedown request** takes effect at once: the link or vouch stops being shown. Any signed-in account can make one. If a request has been looked at and
turned down, list the record's URI under `keep` in `hidden.json` and it is shown again.

Nothing in a record is trusted. `parseLink` keeps only its own six fields, whatever
else the record holds. `cleanUrl` accepts an address only if it is http(s), has a real
host name (no IP addresses, no localhost), carries no credentials, contains no
whitespace or direction-changing characters, and is at most 400 characters; it drops
the fragment. A unit id is letters, digits, dot, underscore and hyphen, at most 64.

`loadCommunity` fails closed: if the index cannot be asked about links, vouches or
takedown requests, nothing people have added is shown, because
something that someone asked to have removed might otherwise come back.

### Hiding a link, or keeping one

`hidden.json`:

- `dids`: nothing added by these accounts is shown.
- `uris`: these links (`at://did/org.jason-edelman.atlas.link/rkey`) are not shown.
- `keep`: these links are shown even though someone has asked for a takedown.

Hiding does not delete: the record stays in its author's account. Its author can
delete it with the Remove button.

## Known limits

- **Links are public.** A link sits in the public repo of whoever added it, under their
  handle, readable by anyone whether or not this page shows it. The form says so.
- **Nobody checks where a link leads.** The page shows the host name and the address
  and says it is unchecked.
- **A web address can still carry words** in its path or query. That is the only text a
  person can put on the page.
- **The map is empty until people use it.** There are no marks of the atlas's own.
- **Anyone signed in can take a link down, and can do it to every link.** That is the
  chosen trade: a wrongly hidden link costs little, a wrongly shown one can cost a
  great deal. `keep` is the way back.
- **A vouch places someone on a map who did not ask to be there.** It is limited to
  public accounts and web addresses, sits at the level of a county or district and not
  an address, and comes off at once on request. It is still a claim about a named
  organisation or person made by someone else.
- **A takedown request needs an atproto account.** Someone without one cannot make one
  here.
- **Constellation is a dependency.** If it does not answer, nothing is shown but the
  bare map, and the page says so.
- **No village or city level, and no street map.** The finest units are US counties,
  Indian districts and European regions. The map is drawn from boundary files with
  d3; there are no tiles.
- **Lines need both ends.** A line is drawn only from someone who has added what they
  do. A person who only vouches appears in "Who vouches for whom" and has no place of
  their own on the map.
- **Small island states are missing** from the world map (Natural Earth at 1:110m).
- **Sign-in and writing were not tested end to end** when this was first committed:
  the rules are unit-tested and the page was tested against a simulated index and
  simulated accounts, but no real account signed in and wrote a record.

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
