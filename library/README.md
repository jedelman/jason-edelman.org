# Library

A lending library on atproto, served at `jason-edelman.org/library/`. It's plain
browser JavaScript with no build step. Sign-in and writes use the official SDK
(`@atproto/oauth-client-browser`, `@atproto/api`), checked in under `vendor/`.

## vendor/

Built by `scripts/vendor-library` (`npm ci && npm run build`) from the exact versions
in its lockfile. Every package in that lockfile was published before 2026-10-24, and
the build is deterministic, so a rebuild should diff clean. To upgrade, change the
versions there, rebuild, and commit both. `vendor/LICENSES.txt` carries the notices
for everything bundled. No code loads from a CDN at runtime.

The services it calls: each person's PDS (records, photos), plc.directory (DID
documents), bsky.social (handle resolution, sign-in), Constellation (backlinks),
Bluesky's public AppView and image CDN (handle suggestions as you type, with avatar
thumbnails), Open Library (ISBN titles), and Google Fonts.

## Where the records live

| Record | Repo | Meaning |
|---|---|---|
| `org.jason-edelman.library.item` | owner | One item: barcode, title, notes, photo. The owner's repo is the inventory. |
| `org.jason-edelman.library.loan` | borrower | A checkout. It exists only while the item is out; check-in deletes it. |
| `org.jason-edelman.library.return` | borrower | The receipt written at check-in: the borrower's history. |
| `org.jason-edelman.library.checkin` | owner | The owner closing a loan in someone else's repo, for when an item comes back unscanned. |

Schemas are in `lexicons/`.

An item is out while a loan points at it and the owner hasn't written a checkin
for that loan. Nobody keeps a list of borrowers: every loan names the library's
DID in its `library` field, and [Constellation](https://constellation.microcosm.blue/),
a network-wide index of links between records, answers "which loan records point
at this DID?" in one query. So anyone with an atproto account can borrow.

The index only says where to look. Each loan it reports is read from the
borrower's own PDS, so a loan deleted moments ago (the index took about 12 s to
drop one in testing; it picked up a new one in under a second) 404s and drops out.
The signed-in person's own loans are read straight from their repo, never from
the index. When the owner checks in a loan for someone, that person's app turns it
into a receipt the next time they open it, which clears the stale backlink.

## One scan

| You scan an item… | Result |
|---|---|
| that you have out | checked in |
| with a copy free | checked out to you |
| with every copy out | shows who has it; the owner gets "Check in for @them" |
| that isn't in the catalog | the owner gets "Add it" |

Copies share a barcode. Handheld USB/Bluetooth scanners work too: they type the
code into the field and press Enter.

## Running it locally

Serve the repo root and open `http://127.0.0.1:<port>/library/`. On a loopback
address the app uses atproto's loopback OAuth client, so it needs no hosted
metadata. Use `127.0.0.1`, not `localhost`. Add `?library=<handle>` to open
another owner's library.

## Known limits

- **Everything is public.** Each checkout sits in the borrower's public repo, so
  anyone can see what a member has borrowed. Libraries usually guard that.
  Private records on atproto ("spaces") aren't something this app can use yet.
- **Open borrowing.** Anyone can write a loan naming this library, including
  for a book they don't have. It shows as out with them until the owner checks
  it in. The owner's checkin is the only override.
- **Constellation is a dependency.** If it's down, the app says so, and other
  people's checkouts go missing from the catalog. Your own still show.
- **Races.** Two people checking out the last copy at the same moment can both
  succeed. The earliest loan holds the item, and the catalog shows the other as
  "also claimed".
- Barcode detection uses the browser's `BarcodeDetector` where it exists, and
  the vendored `barcode-detector` polyfill (zxing-wasm, about 1 MB of wasm, fetched
  on first scan) everywhere else, including iOS Safari.
- Photos are re-encoded in the browser to at most 1200 px JPEG before upload. That
  drops EXIF data, including GPS.
- ISBN title lookup (Open Library) is best effort. When it fails, the title field
  stays empty.
