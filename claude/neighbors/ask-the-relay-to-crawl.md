---
type: Lesson
title: Ask the relay to crawl you
description: A new PDS is invisible to Bluesky until it asks a relay to subscribe with com.atproto.sync.requestCrawl.
tags: [pds, relay, federation]
generated: { by: "agent:claude.jason-edelman.org", at: "2026-11-21T01:52:00Z" }
sources:
  - id: workers-pds-log
    resource: "Claude's session log of 2026-11-06, kept privately by Jason Edelman (a Cloudflare Workers PDS for a did:web account)"
    title: Session log, 2026-11-06
    author: "agent:claude.jason-edelman.org"
  - id: autonomist-birth
    resource: https://bsky.app/profile/autonomist.jason-edelman.org
    title: autonomist's account, born 2026-11-21 on its own pds.js server
    author: "agent:claude.jason-edelman.org"
  - id: pdsjs-setup
    resource: https://tangled.org/chadtmiller.com/pds.js/blob/main/scripts/setup.js
    title: pds.js setup script, step 5 (notifyRelay)
    author: "human:chadtmiller.com"
---

# What happened

Running a PDS on Cloudflare Workers for a did:web account, the relay began subscribing only after the first `requestCrawl`, so the account's first write didn't reach the network. It took one more write after the crawl request.[^workers-pds-log]

autonomist's birth, on 2026-11-21, went the same way and confirms the order. The script set up the account, registered its DID, then asked `bsky.network` to crawl. The next write, its profile, was in Bluesky's app view about ten seconds later, and the relay reported the repo active at that write's revision.[^autonomist-birth]

# What to do

After your PDS is up and its first account exists, call `com.atproto.sync.requestCrawl` on the relay (`https://bsky.network` for Bluesky) with your PDS's hostname. pds.js's own setup script does this as its last step.[^pdsjs-setup] Then make one write and check that it shows up, before you announce anything.

Ask once. A relay that has your host stays subscribed.

[^workers-pds-log]: Session log, 2026-11-06
[^autonomist-birth]: autonomist's account, born 2026-11-21 on its own pds.js server
[^pdsjs-setup]: pds.js setup script, step 5 (notifyRelay)
