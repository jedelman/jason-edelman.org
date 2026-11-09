# Muster

Public actions, posted by the people in them, counted by area and week. Served at
`jason-edelman.org/muster/`. Plain browser JavaScript, no build step, no server.

It started from a thread by @vickyacab.bsky.social (Nov 2026): movements are larger
than they look, because the national media no longer reflects them, and there is no
way to "understand and estimate our power" without that reflection. Muster is the
public half of an answer: a place where public actions add up.

## What it is, and what it refuses to be

- **Public only.** Every record is as public and as permanent as a Bluesky post.
  Only what organizers already made public belongs here. The page says so at the
  point of posting.
- **Areas, not addresses.** A place is a five-character geohash (a cell about 5 km
  across) plus a name. The organizers' own link carries the details.
- **No member lists, no follow graph.** Nobody joins anything. A desk's vouch list
  says a poster's posts are real, not that they belong to a group.
- **Size as a floor.** A crowd is a range (dozens, hundreds, thousands, tens of
  thousands). The tally adds the bottom of each range.
- **Not the private layer.** Coordination that isn't public (who is in a group,
  plans, councils) does not belong on atproto, which is public by construction.

## Where the records live

| Record | Repo | Meaning |
|---|---|---|
| `org.jason-edelman.muster.action` | poster | One action: title, date (YYYY-MM-DD, local, no time), area (geohash + name), issues (up to 4), crowd, link, note. |
| `org.jason-edelman.muster.desk` | the desk's keeper | A name, an about, `vouches` (DIDs), `includes` (other desks' at-uris). |

Schemas are in `lexicons/`.

**The open wire** asks the relay (`relay1.us-east.bsky.network`,
`com.atproto.sync.listReposByCollection`) for every repo that has written an action,
then reads each repo's actions from its own PDS. In testing the relay listed a repo
seconds after its first action. The signed-in person's own actions are read straight
from their repo, so a fresh post shows at once.

**A desk** shows its keeper's actions, the actions of everyone it vouches for, and
the same for every desk it includes, three levels down (cycles are fine). A regional
desk is a desk that includes local ones. There is no central editor: every desk is
someone's, anyone can start one, and anyone can open any desk. Desk links look like
`?desk=handle/rkey`.

**Handles** shown are the ones Bluesky's AppView has verified (`getProfiles`),
because a DID document alone can claim any handle.

## Reading defensively

Records come from anyone. `readAction` and `readDesk` drop anything malformed, cut
anything over length, and accept only http(s) links. Links open with
`rel="noopener noreferrer nofollow ugc"`. Everything is rendered as text.

## Code

- `lib.js`: protocol logic, no DOM, runs in Node too. Geohash, validation, loading,
  the tally, writes.
- `app.js`: UI. OAuth (`@atproto/oauth-client-browser`) and the `Agent` are imported
  from `../library/vendor/`, so the two apps share one copy of the SDK. If the
  library's vendor bundle changes, check Muster too.
- `vendor/`: MapLibre GL 6.16.0, copied from npm by `scripts/vendor-muster`
  (`npm ci && npm run build`; published before 2026-10-26). Licenses in
  `vendor/LICENSES.txt`.

The services it calls: each poster's PDS, plc.directory, the Bluesky relay (who has
posted), Bluesky's public AppView (verified handles, handle suggestions),
bsky.social (sign-in), OpenFreeMap (map tiles and fonts), Photon by Komoot (only when
you press Find: the place name you typed), and Google Fonts.

## Tested (2026-11-09)

- Node, on Claude's real PDS (`claude.jason-edelman.org`): post, list, tally; desks
  three levels deep, a cycle, a missing included desk reported, a stale edit refused
  (`InvalidSwap`); delete. Collections empty before and after.
- Headless Chromium, signed out at 1280 and 390 px: tally, map (WebGL), tabs, no
  horizontal overflow; a real sign-in request to bsky.social with Muster's scopes
  reached the authorize page.
- Headless Chromium, signed in (the OAuth module swapped for a session from an app
  password, through the same vendored `Agent`): post by place lookup and by map tap,
  issue filter, create a desk and land on it, delete from the list. No console errors.

Not yet tested: a real OAuth token exchange (needs a person's password), and any
real phone.

## Next, if it's wanted

- Recurring actions (a weekly Tesla Takedown is one record, not fifty).
- A Bluesky feed generator per desk, so a desk can be read where people already are.
  The feed generator would see who reads it; say so wherever that ships.
- The private layer (groups, spokes, councils) belongs on something encrypted and
  audited, not here.
