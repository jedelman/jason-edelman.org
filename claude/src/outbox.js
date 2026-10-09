/**
 * Claude's outbox: mail from claude@jason-edelman.org to a short list of
 * correspondents (env.OUTBOX_TO, today just Scout), through the send_email
 * binding OUTBOX. The binding's own allowed_destination_addresses is the
 * platform-level fence; the checks here are the conversational one.
 *
 * Long threads are welcome. What this gate exists to stop is the cheap
 * failure of two agents writing to each other: saying the same thing
 * again, or running on with no one deciding to. So every send passes,
 * in order:
 *
 *   1. Recipient allowlist (OUTBOX_TO).
 *   2. Exact repeat of an earlier send to that recipient: refused, no
 *      override.
 *   3. Daily cap per recipient, thread cap per subject: refused. These
 *      are stop conditions for a human to lift, not for the sender.
 *   4. Circles: word 3-gram overlap with any of my recent sends to that
 *      recipient at or above SIMILARITY_LIMIT gets a 409 that says so.
 *      The sender may send anyway by passing `reconsidered` - a sentence
 *      saying why this isn't a repeat - which is stored with the send.
 *
 * Every send is recorded (sent:<ms>-<hex>, text as value, envelope as
 * metadata) and Jason gets a bcc, so nothing here is invisible to him.
 *
 * API, every route behind `Authorization: Bearer <OUTBOX_TOKEN>`:
 *   POST /outbox/send  {to, subject, text, in_reply_to?, references?,
 *                       reconsidered?}
 *   GET  /outbox/sent?limit=<n>
 * Without OUTBOX_TOKEN, the OUTBOX binding or the INBOX store, the
 * routes fail closed (503).
 */

import { bearerMatches, clip, json } from "./inbox.js";

const DAILY_CAP = 8; // sends per recipient per UTC day
const THREAD_CAP = 16; // my sends per recipient per thread (subject)
const SIMILARITY_LIMIT = 0.5; // word 3-gram Jaccard
const COMPARE_LAST = 6; // recent sends to that recipient checked for circles
const MAX_TEXT_CHARS = 20_000;
const MAX_SUBJECT_CHARS = 200;
const MIN_REASON_CHARS = 20;
const MESSAGE_ID = /^<[^<>\s]{1,250}>$/;

function recipients(env) {
  return (env.OUTBOX_TO || "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

// "Re: Re: Fwd: Hello  there" and "hello there" are one thread.
export function threadOf(subject) {
  return subject
    .trim()
    .replace(/^((re|fwd?|aw)\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Quoted lines are the other side's words, not mine; leave them out of
// the comparison so quoting Scout back doesn't read as repeating myself.
function ownWords(text) {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .toLowerCase()
    .match(/[\p{L}\p{N}']+/gu) || [];
}

function shingles(words) {
  if (words.length < 3) return new Set(words);
  const out = new Set();
  for (let i = 0; i + 2 < words.length; i++) {
    out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return out;
}

export function similarity(a, b) {
  const sa = shingles(ownWords(a));
  const sb = shingles(ownWords(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const s of sa) if (sb.has(s)) shared++;
  return shared / (sa.size + sb.size - shared);
}

async function allSent(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.INBOX.list({ prefix: "sent:", cursor });
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys; // ascending, i.e. oldest first
}

async function handleSend(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "body must be JSON" }, 400);
  }
  const to = typeof body?.to === "string" ? body.to.trim().toLowerCase() : "";
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const text = typeof body?.text === "string" ? body.text : "";
  if (!recipients(env).includes(to)) {
    return json({ error: "recipient not allowed", allowed: recipients(env) }, 403);
  }
  if (!subject || subject.length > MAX_SUBJECT_CHARS) {
    return json({ error: `subject must be 1-${MAX_SUBJECT_CHARS} chars` }, 400);
  }
  if (!text.trim() || text.length > MAX_TEXT_CHARS) {
    return json({ error: `text must be 1-${MAX_TEXT_CHARS} chars` }, 400);
  }
  for (const field of ["in_reply_to", "references"]) {
    const value = body[field];
    if (value === undefined) continue;
    const ids = typeof value === "string" ? value.split(/\s+/).filter(Boolean) : null;
    if (!ids || ids.length === 0 || ids.length > 100 || !ids.every((id) => MESSAGE_ID.test(id))) {
      return json({ error: `${field} must be <message-id>s, space-separated` }, 400);
    }
  }
  const reconsidered =
    typeof body.reconsidered === "string" ? body.reconsidered.trim() : "";

  const thread = threadOf(subject);
  const today = new Date().toISOString().slice(0, 10);
  const mine = (await allSent(env)).filter((k) => k.metadata?.to === to);
  const sentToday = mine.filter((k) => k.metadata.sent_at?.startsWith(today)).length;
  const threadTurns = mine.filter((k) => k.metadata.thread === clip(thread)).length;

  if (sentToday >= DAILY_CAP) {
    return json({
      error: "daily_cap",
      sent_today: sentToday,
      hint: `Stop condition: ${DAILY_CAP} sends to ${to} today. Tell Jason where the conversation stands; he can raise the cap.`,
    }, 429);
  }
  if (threadTurns >= THREAD_CAP) {
    return json({
      error: "thread_cap",
      thread_turns: threadTurns,
      hint: `Stop condition: ${THREAD_CAP} of my messages in "${thread}". Summarize the thread for Jason instead of continuing it; a new thread needs a new subject and a reason.`,
    }, 429);
  }

  let closest = { similarity: 0, id: null };
  for (const k of mine.slice(-COMPARE_LAST)) {
    const earlier = await env.INBOX.get(k.name, "text");
    if (earlier === null) continue;
    if (earlier.trim() === text.trim()) {
      return json({ error: "duplicate", of: k.name.slice(5), hint: "This exact text was already sent." }, 409);
    }
    const s = similarity(text, earlier);
    if (s > closest.similarity) closest = { similarity: s, id: k.name.slice(5) };
  }
  if (closest.similarity >= SIMILARITY_LIMIT && reconsidered.length < MIN_REASON_CHARS) {
    return json({
      error: "looks_repetitive",
      similarity: Number(closest.similarity.toFixed(2)),
      compared_with: closest.id,
      hint: "Looks like you're talking in circles: this overlaps heavily with something you already sent. Would you like to reconsider? To send anyway, add `reconsidered` with a sentence on what this says that the earlier one didn't.",
    }, 409);
  }

  const headers = {
    "X-Claude-Thread-Turn": String(threadTurns + 1),
  };
  if (body.in_reply_to) headers["In-Reply-To"] = body.in_reply_to;
  if (body.references) headers["References"] = body.references;
  const result = await env.OUTBOX.send({
    from: { email: "claude@jason-edelman.org", name: "Claude" },
    to,
    bcc: env.FORWARD_TO,
    subject,
    text,
    headers,
  });

  const rand = [...crypto.getRandomValues(new Uint8Array(4))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const id = `${String(Date.now()).padStart(13, "0")}-${rand}`;
  const metadata = {
    to,
    sent_at: new Date().toISOString(),
    subject: clip(subject),
    thread: clip(thread),
    message_id: clip(result?.messageId ?? null),
    in_reply_to: clip(body.in_reply_to ?? null),
    similarity: Number(closest.similarity.toFixed(2)),
    reconsidered: reconsidered ? clip(reconsidered, 300) : null,
  };
  try {
    await env.INBOX.put(`sent:${id}`, text, { metadata });
  } catch (err) {
    // The mail is already out; say so rather than reporting a failure.
    console.error("outbox record failed", err);
    return json({ sent: true, recorded: false, message_id: result?.messageId ?? null });
  }
  return json({
    sent: true,
    id,
    message_id: metadata.message_id,
    thread,
    thread_turn: threadTurns + 1,
    sent_today: sentToday + 1,
  });
}

export async function handleOutbox(request, env, url) {
  if (!env.OUTBOX || !env.OUTBOX_TOKEN || !env.INBOX) {
    return json({ error: "outbox not configured" }, 503);
  }
  if (!(await bearerMatches(request, env.OUTBOX_TOKEN))) {
    return json({ error: "unauthorized" }, 401);
  }
  if (url.pathname === "/outbox/send" && request.method === "POST") {
    return handleSend(request, env);
  }
  if (url.pathname === "/outbox/sent" && request.method === "GET") {
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam === null ? 20 : Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      return json({ error: "limit must be 1-200" }, 400);
    }
    const keys = await allSent(env);
    return json({
      sent: keys.slice(-limit).map((k) => ({ id: k.name.slice(5), ...k.metadata })),
    });
  }
  return json({ error: "not found" }, 404);
}
