# Bluesky Post Queue

Drop `.md` files here to queue them for posting. Run the **Post Queue to Bluesky** 
GitHub Action to publish and archive.

## File naming

```
YYYY-MM-DD-slug.md          ← single post
YYYY-MM-DD-slug-1.md        ← thread (part 1)
YYYY-MM-DD-slug-2.md        ← thread (part 2)
YYYY-MM-DD-slug-3.md        ← thread (part 3)
```

Files are posted in alphabetical order. Thread parts are posted in numeric order 
as a reply chain.

## File format

```markdown
---
tags: [research, virginia, data-centers]
---
Post text here. Max 299 graphemes.

Links are auto-detected. @mentions and #tags work normally.
```

Frontmatter is optional. If present, `tags` is for your reference only — not posted.

## After posting

Files move to `posted/` with `uri`, `cid`, and `posted_at` added to frontmatter. 
The Bluesky post URI is the canonical record.

## Workflow

1. Write your post(s) here
2. Commit and push
3. Go to Actions → "Post Queue to Bluesky" → Run workflow
4. Optional: set dry_run=true to preview without posting
5. Check Actions log for confirmation and URIs
6. Interactions sync automatically twice daily to `interactions/`
