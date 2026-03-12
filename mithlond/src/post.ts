/**
 * post.ts — Mithlond Bluesky queue poster
 *
 * Reads markdown files from queue/, posts them to Bluesky, then moves
 * them to posted/ with the AT URI appended as a frontmatter field.
 *
 * Queue file format (queue/YYYY-MM-DD-slug.md):
 * ---
 * thread: optional-thread-slug   # group posts into a thread; same slug, numbered suffix
 * tags: [research, virginia]     # for reference only, not posted
 * ---
 * Post text here. Max 300 graphemes. Links are auto-detected as facets.
 *
 * Thread support: files named queue/2026-03-12-slug-1.md, -2.md, -3.md
 * are posted as a thread in numeric order.
 *
 * DRY_RUN=true: prints what would be posted without actually posting.
 */

import fs from 'fs'
import path from 'path'
import { AtpAgent, RichText } from '@atproto/api'

const IDENTIFIER = process.env.ATPROTO_IDENTIFIER
const APP_PASSWORD = process.env.ATPROTO_APP_PASSWORD
const DRY_RUN = process.env.DRY_RUN === 'true'
const QUEUE_DIR = './queue'
const POSTED_DIR = './posted'
const SERVICE = 'https://bsky.social'
const GRAPHEME_LIMIT = 299

// ---------------------------------------------------------------------------
// Queue file parsing
// ---------------------------------------------------------------------------

interface QueueFile {
  filepath: string
  filename: string
  text: string
  meta: Record<string, string>
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const meta: Record<string, string> = {}
  if (!raw.startsWith('---')) return { meta, body: raw.trim() }
  const end = raw.indexOf('---', 3)
  if (end === -1) return { meta, body: raw.trim() }
  const fmLines = raw.slice(3, end).trim().split('\n')
  for (const line of fmLines) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '')
    meta[key] = val
  }
  return { meta, body: raw.slice(end + 3).trim() }
}

function loadQueue(): QueueFile[] {
  if (!fs.existsSync(QUEUE_DIR)) return []
  const files = fs.readdirSync(QUEUE_DIR)
    .filter(f => f.endsWith('.md'))
    .sort() // alphabetical = date order if named YYYY-MM-DD-*

  return files.map(filename => {
    const filepath = path.join(QUEUE_DIR, filename)
    const raw = fs.readFileSync(filepath, 'utf8')
    const { meta, body } = parseFrontmatter(raw)
    return { filepath, filename, text: body, meta }
  })
}

// ---------------------------------------------------------------------------
// Thread grouping: files with same base name + numeric suffix are a thread
// e.g. 2026-03-12-budget-1.md, 2026-03-12-budget-2.md
// ---------------------------------------------------------------------------

interface ThreadGroup {
  key: string
  posts: QueueFile[]
}

function groupIntoThreads(files: QueueFile[]): ThreadGroup[] {
  const groups: Map<string, QueueFile[]> = new Map()
  const threadRe = /-(\d+)\.md$/

  for (const f of files) {
    const match = f.filename.match(threadRe)
    if (match) {
      const base = f.filename.replace(threadRe, '')
      if (!groups.has(base)) groups.set(base, [])
      groups.get(base)!.push(f)
    } else {
      // Standalone post — key is the full filename without .md
      const key = f.filename.replace(/\.md$/, '')
      groups.set(key, [f])
    }
  }

  // Sort thread members by numeric suffix
  const result: ThreadGroup[] = []
  for (const [key, posts] of groups) {
    posts.sort((a, b) => {
      const na = parseInt(a.filename.match(/-(\d+)\.md$/)?.[1] ?? '0')
      const nb = parseInt(b.filename.match(/-(\d+)\.md$/)?.[1] ?? '0')
      return na - nb
    })
    result.push({ key, posts })
  }

  return result
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

function validateLength(text: string, filename: string): boolean {
  const graphemes = [...text]
  if (graphemes.length > GRAPHEME_LIMIT) {
    console.error(`  ✗ ${filename}: too long (${graphemes.length} graphemes, limit ${GRAPHEME_LIMIT})`)
    return false
  }
  return true
}

async function postOne(
  agent: AtpAgent,
  text: string,
  reply?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } }
): Promise<{ uri: string; cid: string }> {
  const rt = new RichText({ text })
  await rt.detectFacets(agent)
  const res = await agent.post({
    text: rt.text,
    facets: rt.facets,
    reply,
    createdAt: new Date().toISOString(),
  })
  return { uri: res.uri, cid: res.cid }
}

function archivePost(qf: QueueFile, uri: string, cid: string) {
  const dest = path.join(POSTED_DIR, qf.filename)
  const existing = fs.readFileSync(qf.filepath, 'utf8')

  // Append URI/CID to frontmatter (or add frontmatter if none)
  let archived: string
  if (existing.startsWith('---')) {
    const closeIdx = existing.indexOf('---', 3)
    const fm = existing.slice(0, closeIdx)
    const body = existing.slice(closeIdx)
    archived = `${fm}posted_at: ${new Date().toISOString()}\nuri: ${uri}\ncid: ${cid}\n${body}`
  } else {
    archived = `---\nposted_at: ${new Date().toISOString()}\nuri: ${uri}\ncid: ${cid}\n---\n${existing}`
  }

  if (!fs.existsSync(POSTED_DIR)) fs.mkdirSync(POSTED_DIR, { recursive: true })
  fs.writeFileSync(dest, archived)
  fs.unlinkSync(qf.filepath)
  console.log(`  → archived to posted/${qf.filename}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!DRY_RUN && (!IDENTIFIER || !APP_PASSWORD)) {
    console.error('ATPROTO_IDENTIFIER and ATPROTO_APP_PASSWORD required')
    process.exit(1)
  }

  const queue = loadQueue()
  if (queue.length === 0) {
    console.log('Queue is empty. Nothing to post.')
    return
  }

  const agent = new AtpAgent({ service: SERVICE })

  if (!DRY_RUN) {
    await agent.login({ identifier: IDENTIFIER!, password: APP_PASSWORD! })
    console.log(`Authenticated as ${agent.session?.did}\n`)
  } else {
    console.log('[DRY RUN] Skipping authentication\n')
  }

  const threads = groupIntoThreads(queue)
  console.log(`Queue: ${queue.length} file(s) → ${threads.length} post(s)/thread(s)\n`)

  for (const thread of threads) {
    if (thread.posts.length === 1) {
      // Single post
      const qf = thread.posts[0]
      console.log(`Posting: ${qf.filename}`)
      console.log(`  Text: "${qf.text.slice(0, 100)}${qf.text.length > 100 ? '...' : ''}"`)

      if (!validateLength(qf.text, qf.filename)) continue

      if (DRY_RUN) {
        console.log('  [DRY RUN] Would post.')
        continue
      }

      try {
        const { uri, cid } = await postOne(agent, qf.text)
        console.log(`  ✓ Posted: ${uri}`)
        archivePost(qf, uri, cid)
      } catch (e) {
        console.error(`  ✗ Failed: ${e}`)
      }
    } else {
      // Thread
      console.log(`Posting thread: ${thread.key} (${thread.posts.length} posts)`)
      let rootRef: { uri: string; cid: string } | undefined
      let parentRef: { uri: string; cid: string } | undefined
      let allOk = true

      for (const qf of thread.posts) {
        if (!validateLength(qf.text, qf.filename)) { allOk = false; break }
        console.log(`  [${qf.filename}] "${qf.text.slice(0, 80)}${qf.text.length > 80 ? '...' : ''}"`)
      }

      if (!allOk) continue

      if (DRY_RUN) {
        console.log('  [DRY RUN] Would post thread.')
        continue
      }

      for (const qf of thread.posts) {
        try {
          const reply = rootRef && parentRef
            ? { root: rootRef, parent: parentRef }
            : undefined
          const { uri, cid } = await postOne(agent, qf.text, reply)
          if (!rootRef) rootRef = { uri, cid }
          parentRef = { uri, cid }
          console.log(`  ✓ ${qf.filename}: ${uri}`)
          archivePost(qf, uri, cid)
        } catch (e) {
          console.error(`  ✗ ${qf.filename} failed: ${e}`)
          break
        }
      }
    }
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
