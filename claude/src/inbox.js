/**
 * Claude's own inbox: inbound mail to claude@jason-edelman.org lands in
 * KV (binding INBOX) as well as being forwarded, so a scheduled check
 * can read this one address over one token instead of being handed
 * Jason's whole Gmail.
 *
 * Storage is deliberately dumb. Each message is one KV entry:
 *   key       msg:<received ms, 13 digits>-<8 hex>   (lists in arrival order)
 *   value     the raw RFC 822 bytes
 *   metadata  envelope addresses, three headers the Email Routing runtime
 *             has already parsed, size, truncated flag, read timestamp
 * plus mid:<sha256(Message-ID)> -> message id, so a retried delivery is
 * stored once. No MIME parsing here - the reader decodes the raw message
 * (Python's stdlib `email` does this fine), which keeps this worker at
 * zero dependencies and no build step.
 *
 * KV is eventually consistent (a write can take up to ~60s to show up
 * everywhere). For a mailbox read a few times a day that is fine; it
 * also means the Message-ID dedupe is best-effort, not a guarantee.
 *
 * Read API, every route behind `Authorization: Bearer <INBOX_TOKEN>`:
 *   GET  /inbox/messages?status=unread|all&cursor=<c>&limit=<n>
 *   GET  /inbox/messages/<id>/raw
 *   POST /inbox/read   {"ids": ["<id>", ...]}
 * Without INBOX_TOKEN or the INBOX binding the routes fail closed (503).
 */

// KV caps a value at 25 MiB, which is also Email Routing's message size
// limit, so truncation should never fire; it is kept as a guard. The
// copy forwarded to Gmail is always whole.
const MAX_RAW_BYTES = 25 * 1024 * 1024 - 1024;
// KV metadata is capped at 1024 bytes serialized; string fields are
// clipped to a byte budget and fitMetadata() checks the total.
const MAX_FIELD_BYTES = 120;
const MAX_METADATA_BYTES = 1024;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const ID_PATTERN = /^[0-9]{13}-[0-9a-f]{8}$/;

async function readRaw(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > MAX_RAW_BYTES) {
      chunks.push(value.subarray(0, MAX_RAW_BYTES - size));
      size = MAX_RAW_BYTES;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const raw = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    raw.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { raw, truncated };
}

const utf8 = new TextEncoder();

// Clip to at most `budget` UTF-8 bytes without splitting a character.
function clip(value, budget = MAX_FIELD_BYTES) {
  if (value == null) return null;
  if (utf8.encode(value).byteLength <= budget) return value;
  let out = "";
  let used = 0;
  for (const ch of value) {
    const n = utf8.encode(ch).byteLength;
    if (used + n > budget - 3) break;
    out += ch;
    used += n;
  }
  return out + "…";
}

// JSON escaping (control characters become \uXXXX) can still push the
// object over KV's cap; halve the free-text fields until it fits.
function fitMetadata(metadata) {
  let budget = MAX_FIELD_BYTES;
  const size = () => utf8.encode(JSON.stringify(metadata)).byteLength;
  while (size() > MAX_METADATA_BYTES && budget > 8) {
    budget = Math.floor(budget / 2);
    for (const field of ["subject", "header_from", "message_id", "envelope_from", "envelope_to"]) {
      metadata[field] = clip(metadata[field], budget);
    }
  }
  return metadata;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", utf8.encode(text));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function storeMessage(message, env) {
  const messageId = message.headers.get("message-id");
  const midKey = messageId ? `mid:${await sha256Hex(messageId)}` : null;
  if (midKey && (await env.INBOX.get(midKey)) !== null) return;

  const { raw, truncated } = await readRaw(message.raw);
  const rand = [...crypto.getRandomValues(new Uint8Array(4))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const id = `${String(Date.now()).padStart(13, "0")}-${rand}`;
  const metadata = fitMetadata({
    received_at: new Date().toISOString(),
    envelope_from: clip(message.from),
    envelope_to: clip(message.to),
    header_from: clip(message.headers.get("from")),
    subject: clip(message.headers.get("subject")),
    message_id: clip(messageId),
    raw_size: message.rawSize,
    truncated,
    read_at: null,
  });
  await env.INBOX.put(`msg:${id}`, raw, { metadata });
  if (midKey) await env.INBOX.put(midKey, id);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Hash both sides first so timingSafeEqual always compares equal-length
// buffers and the token's length doesn't leak either.
async function authorized(request, env) {
  const header = request.headers.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", utf8.encode(given)),
    crypto.subtle.digest("SHA-256", utf8.encode(env.INBOX_TOKEN)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

export async function handleInbox(request, env, url) {
  if (!env.INBOX || !env.INBOX_TOKEN) {
    return json({ error: "inbox not configured" }, 503);
  }
  if (!(await authorized(request, env))) {
    return json({ error: "unauthorized" }, 401);
  }

  if (url.pathname === "/inbox/messages" && request.method === "GET") {
    const status = url.searchParams.get("status") || "unread";
    if (status !== "unread" && status !== "all") {
      return json({ error: "status must be unread or all" }, 400);
    }
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam === null ? DEFAULT_LIMIT : Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return json({ error: `limit must be 1-${MAX_LIMIT}` }, 400);
    }
    // One KV list page per request. With status=unread a page can come
    // back short (read messages are filtered out); keep following
    // `cursor` until it is null.
    const page = await env.INBOX.list({
      prefix: "msg:",
      limit,
      cursor: url.searchParams.get("cursor") || undefined,
    });
    const messages = page.keys
      .map((k) => ({ id: k.name.slice(4), ...k.metadata }))
      .filter((m) => status === "all" || !m.read_at);
    return json({ messages, cursor: page.list_complete ? null : page.cursor });
  }

  const rawMatch = url.pathname.match(/^\/inbox\/messages\/([^/]+)\/raw$/);
  if (rawMatch && request.method === "GET") {
    if (!ID_PATTERN.test(rawMatch[1])) return json({ error: "bad id" }, 400);
    const raw = await env.INBOX.get(`msg:${rawMatch[1]}`, "arrayBuffer");
    if (raw === null) return json({ error: "not found" }, 404);
    return new Response(raw, {
      headers: { "content-type": "message/rfc822" },
    });
  }

  if (url.pathname === "/inbox/read" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "body must be JSON" }, 400);
    }
    const ids = Array.isArray(body?.ids) ? body.ids : null;
    if (
      !ids ||
      ids.length === 0 ||
      ids.length > MAX_LIMIT ||
      !ids.every((id) => typeof id === "string" && ID_PATTERN.test(id))
    ) {
      return json({ error: `ids must be 1-${MAX_LIMIT} message ids` }, 400);
    }
    // KV has no metadata-only update, so marking read re-puts the value
    // with new metadata.
    const now = new Date().toISOString();
    let marked = 0;
    for (const id of ids) {
      const { value, metadata } = await env.INBOX.getWithMetadata(
        `msg:${id}`,
        "arrayBuffer",
      );
      if (value === null || metadata?.read_at) continue;
      await env.INBOX.put(`msg:${id}`, value, {
        metadata: { ...metadata, read_at: now },
      });
      marked++;
    }
    return json({ marked });
  }

  return json({ error: "not found" }, 404);
}
