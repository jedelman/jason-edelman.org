/**
 * pull.ts — Mithlond Bluesky interaction sync
 *
 * Fetches notifications (likes, reposts, replies, follows, mentions)
 * since the last pull cursor and saves them to interactions/.
 *
 * Outputs:
 *   interactions/latest.json       — current batch, overwritten each run
 *   interactions/cursor.json       — last seen notification cursor
 *   interactions/YYYY-MM-DD.json   — daily archive, appended
 */

import fs from 'fs'
import path from 'path'
import { AtpAgent } from '@atproto/api'

const IDENTIFIER = process.env.ATPROTO_IDENTIFIER
const APP_PASSWORD = process.env.ATPROTO_APP_PASSWORD
const SERVICE = 'https://bsky.social'
const INTERACTIONS_DIR = './interactions'
const CURSOR_FILE = path.join(INTERACTIONS_DIR, 'cursor.json')

interface NotificationRecord {
  uri: string
  cid: string
  reason: string
  author: {
    handle: string
    displayName?: string
    did: string
  }
  record?: Record<string, unknown>
  indexedAt: string
}

async function main() {
  if (!IDENTIFIER || !APP_PASSWORD) {
    console.error('ATPROTO_IDENTIFIER and ATPROTO_APP_PASSWORD required')
    process.exit(1)
  }

  if (!fs.existsSync(INTERACTIONS_DIR)) {
    fs.mkdirSync(INTERACTIONS_DIR, { recursive: true })
  }

  const agent = new AtpAgent({ service: SERVICE })
  await agent.login({ identifier: IDENTIFIER!, password: APP_PASSWORD! })
  console.log(`Authenticated as ${agent.session?.did}`)

  // Load cursor from last run
  let cursor: string | undefined
  if (fs.existsSync(CURSOR_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf8'))
      cursor = saved.cursor
      console.log(`Resuming from cursor: ${cursor}`)
    } catch {
      console.warn('Could not parse cursor.json, starting fresh')
    }
  } else {
    console.log('No cursor found — fetching recent notifications')
  }

  // Fetch notifications
  const res = await agent.listNotifications({ cursor, limit: 50 })
  const notifications = res.data.notifications

  console.log(`Fetched ${notifications.length} notification(s)`)

  if (notifications.length === 0) {
    console.log('No new notifications.')
    return
  }

  // Shape the data
  const records: NotificationRecord[] = notifications.map(n => ({
    uri: n.uri,
    cid: n.cid,
    reason: n.reason,
    author: {
      handle: n.author.handle,
      displayName: n.author.displayName,
      did: n.author.did,
    },
    record: n.record as Record<string, unknown> | undefined,
    indexedAt: n.indexedAt,
  }))

  // Summary by type
  const summary: Record<string, number> = {}
  for (const r of records) {
    summary[r.reason] = (summary[r.reason] ?? 0) + 1
  }
  console.log('Summary:', summary)

  // Write latest.json
  const latestPath = path.join(INTERACTIONS_DIR, 'latest.json')
  fs.writeFileSync(latestPath, JSON.stringify({ fetchedAt: new Date().toISOString(), summary, notifications: records }, null, 2))
  console.log(`Wrote ${latestPath}`)

  // Append to daily archive
  const today = new Date().toISOString().slice(0, 10)
  const dailyPath = path.join(INTERACTIONS_DIR, `${today}.json`)
  let daily: NotificationRecord[] = []
  if (fs.existsSync(dailyPath)) {
    try { daily = JSON.parse(fs.readFileSync(dailyPath, 'utf8')) } catch { daily = [] }
  }
  // Deduplicate by URI
  const existingUris = new Set(daily.map(r => r.uri))
  const newRecords = records.filter(r => !existingUris.has(r.uri))
  daily.push(...newRecords)
  fs.writeFileSync(dailyPath, JSON.stringify(daily, null, 2))
  console.log(`Appended ${newRecords.length} new record(s) to ${dailyPath}`)

  // Save new cursor
  const newCursor = res.data.cursor
  if (newCursor) {
    fs.writeFileSync(CURSOR_FILE, JSON.stringify({ cursor: newCursor, updatedAt: new Date().toISOString() }, null, 2))
    console.log(`Saved new cursor: ${newCursor}`)
  }

  // Print replies so they're visible in CI logs
  const replies = records.filter(r => r.reason === 'reply' || r.reason === 'mention')
  if (replies.length > 0) {
    console.log('\n--- Replies / Mentions ---')
    for (const r of replies) {
      const text = (r.record as { text?: string })?.text ?? '[no text]'
      console.log(`@${r.author.handle}: ${text}`)
    }
  }

  // Mark all as read
  await agent.updateSeenNotifications()
  console.log('\nMarked notifications as seen.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
