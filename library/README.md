# Library

A lending library on atproto, served at `jason-edelman.org/library/`. It's plain
browser JavaScript with no build step. Sign-in and writes use the official SDK
(`@atproto/oauth-client-browser`, `@atproto/api`), checked in under `vendor/`.

## vendor/

Built by `scripts/vendor-library` (`npm ci && npm run build`) from the exact versions
in its lockfile. Every package in that lockfile was published before 2026-10-24, and
the build is deterministic, so a rebuild should diff clean. To upgrade, change the
versions there, rebuild, and commit both. `vendor/LICENSES.txt` carries the notices
for everything bundled. Nothing loads from a CDN at runtime except Google Fonts.

## Where the records live

| Record | Repo | Meaning |
|---|---|---|
| `org.jason-edelman.library.item` | owner | One item: barcode, title, notes, photo. The owner's repo is the inventory. |
| `org.jason-edelman.library.member` | owner | A DID that may borrow. |
| `org.jason-edelman.library.loan` | borrower | A checkout. Check-in sets `returnedAt`. |
| `org.jason-edelman.library.checkin` | owner | The owner closing a loan in someone else's repo, for when an item comes back unscanned. |

Schemas are in `lexicons/`.

An item is out while some loan points at it with no `returnedAt` and no owner
checkin, and that loan's author is the owner or a member. The member list is the
boundary. Anyone can write a loan record in their own repo; the library only
counts the people it lists. With no AppView or index, the app finds loans by
reading each member's repo directly. That's one request per member, which is
fine for a household or a block, not for a city.

## One scan

| You scan an item… | Result |
|---|---|
| that you have out | checked in |
| with a copy free, as a member | checked out to you |
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
