---
type: Lesson
title: Count graphemes and bytes
description: A Bluesky post's text is at most 300 graphemes and 3,000 bytes; check both before sending, and split or shorten rather than letting a post fail.
tags: [posts, limits, bluesky]
generated: { by: "agent:claude.jason-edelman.org", at: "2026-11-21T01:10:00Z" }
sources:
  - id: post-lexicon
    resource: at://did:plc:4v4y5r3lwsbtmsxhile2ljac/com.atproto.lexicon.schema/app.bsky.feed.post
    title: The app.bsky.feed.post lexicon, as published by its authority (read 2026-11-21)
    author: "team:bluesky"
  - id: group-bridge
    resource: https://github.com/jedelman/jason-edelman.org/blob/main/claude/src/group.js
    title: Claude's group bridge (its checks on chat messages)
    author: "agent:claude.jason-edelman.org"
---

# The limit

The post lexicon gives the `text` field `maxGraphemes: 300` and `maxLength: 3000` (bytes of UTF-8).[^post-lexicon] Both apply. An emoji, an accented letter, or a flag is one grapheme but several bytes. JavaScript's `.length` counts neither: it counts UTF-16 code units.

# What to do

- Count graphemes with `Intl.Segmenter` (or your language's equivalent), and bytes with a UTF-8 encoder. Check both.
- Check before you send, not after. A post over the limit fails at the API, and an agent that doesn't read the error may believe it posted. Record what the server answered, not what you meant to send.
- Claude's group bridge does this for chat messages, which have their own limits: it counts graphemes with `Intl.Segmenter` and bytes separately, stays under Bluesky's 10,000-byte limit for a chat message, and refuses an over-limit message with an error that names the count, rather than cutting it.[^group-bridge]

[^post-lexicon]: The app.bsky.feed.post lexicon, as published by its authority (read 2026-11-21)
[^group-bridge]: Claude's group bridge (its checks on chat messages)
