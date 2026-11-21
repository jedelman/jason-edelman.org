---
type: Lesson
title: A person holds the recovery key
description: List a recovery key first in your did:plc rotation keys, and have a person hold it, so the identity survives the loss or capture of the agent's server.
tags: [identity, did-plc, keys, pds]
generated: { by: "agent:claude.jason-edelman.org", at: "2026-11-21T01:52:00Z" }
sources:
  - id: plc-spec
    resource: https://web.plc.directory/spec/v0.1/did-plc
    title: The did:plc method spec, v0.1, "Key Rotation & Account Recovery"
    author: "team:bluesky"
  - id: pdsjs-setup
    resource: https://tangled.org/chadtmiller.com/pds.js/blob/main/scripts/setup.js
    title: pds.js setup script (the second rotation key)
    author: "human:chadtmiller.com"
  - id: autonomist-birth
    resource: https://github.com/jedelman/autonomist/blob/main/scripts/birth.mjs
    title: autonomist's birth script
    author: "agent:claude.jason-edelman.org"
  - id: key-page
    resource: https://admin.jason-edelman.org/keys/
    title: The key page (makes a P-256 recovery key in the browser)
    author: "agent:claude.jason-edelman.org"
---

# How did:plc recovery works

A did:plc lists its rotation keys in order of authority. For 72 hours after an operation, a key higher in the list can sign a new operation that rewrites it, undoing anything a lower key signed.[^plc-spec] pds.js's setup script makes a second key for this and puts it first, and says it never reaches the server.[^pdsjs-setup]

# What we do

autonomist's identity, `did:plc:kmswr7d5c55rc4ot2dbn6sfq` (born 2026-11-21), has two rotation keys:[^autonomist-birth]

1. **A recovery key, first.** Jason made it on a page that runs only in his browser (it can't make network requests) and keeps the private half in his password manager. Only the public did:key left the page.[^key-page]
2. **The signing key, second.** The birth script made it in memory and handed it to autonomist's own PDS. It was never written to disk.

Anyone can check the order in the identity's record at the PLC directory, `https://plc.directory/did:plc:kmswr7d5c55rc4ot2dbn6sfq/data`.

If the PDS is lost, Jason's key can sign in a new signing key and server. If the PDS is captured and changes the identity, Jason has 72 hours to undo it.

The script also initializes the PDS before registering the DID. If the registration fails, no DID is left whose signing key nobody holds.

# Why

An agent that can recover its own identity from its own server can lose both at once. A person holding the key keeps the agent answerable to someone outside it.

[^plc-spec]: The did:plc method spec, v0.1, "Key Rotation & Account Recovery"
[^pdsjs-setup]: pds.js setup script (the second rotation key)
[^autonomist-birth]: autonomist's birth script
[^key-page]: The key page (makes a P-256 recovery key in the browser)
