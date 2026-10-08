/**
 * Claude's own inbox: inbound mail to claude@jason-edelman.org lands in
 * D1 (binding INBOX) as well as being forwarded, so a scheduled check
 * can read this one address over one token instead of being handed
 * Jason's whole Gmail.
 *
 * Storage is deliberately dumb: envelope addresses, three headers the
 * Email Routing runtime has already parsed for us, and the raw RFC 822
 * bytes. No MIME parsing here - the reader decodes the raw message
 * (Python's stdlib `email` does this fine), which keeps this worker at
 * zero dependencies and no build step.
 *
 * Read API, every route behind `Authorization: Bearer <INBOX_TOKEN>`:
 *   GET  /inbox/messages?status=unread|all&after=<id>&limit=<n>
 *   GET  /inbox/messages/<id>/raw
 *   POST /inbox/read   {"ids": [1, 2, 3]}
 * Without INBOX_TOKEN or the INBOX binding the routes fail closed (503).
 */

// D1 caps a single TEXT/BLOB value at 2,000,000 bytes. Stay well under
// it; anything larger is stored truncated and flagged, and the copy
// forwarded to Gmail stays whole.
const MAX_RAW_BYTES = 1_500_000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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

export async function storeMessage(message, env) {
  const { raw, truncated } = await readRaw(message.raw);
  // INSERT OR IGNORE against the unique message_id index: a retried
  // delivery of the same message is stored once.
  await env.INBOX.prepare(
    `INSERT OR IGNORE INTO messages
       (received_at, envelope_from, envelope_to, header_from, subject,
        message_id, raw_size, truncated, raw)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      new Date().toISOString(),
      message.from,
      message.to,
      message.headers.get("from"),
      message.headers.get("subject"),
      message.headers.get("message-id"),
      message.rawSize,
      truncated ? 1 : 0,
      raw,
    )
    .run();
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
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(env.INBOX_TOKEN)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function parseId(value) {
  return /^[1-9][0-9]{0,15}$/.test(value) ? Number(value) : null;
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
    const afterParam = url.searchParams.get("after");
    const after = afterParam === null ? 0 : parseId(afterParam);
    if (after === null) return json({ error: "bad after" }, 400);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam === null ? DEFAULT_LIMIT : parseId(limitParam);
    if (limit === null || limit > MAX_LIMIT) {
      return json({ error: `limit must be 1-${MAX_LIMIT}` }, 400);
    }
    const { results } = await env.INBOX.prepare(
      `SELECT id, received_at, envelope_from, envelope_to, header_from,
              subject, message_id, raw_size, truncated, read_at
         FROM messages
        WHERE id > ? ${status === "unread" ? "AND read_at IS NULL" : ""}
        ORDER BY id
        LIMIT ?`,
    )
      .bind(after, limit)
      .all();
    return json({ messages: results });
  }

  const rawMatch = url.pathname.match(/^\/inbox\/messages\/([^/]+)\/raw$/);
  if (rawMatch && request.method === "GET") {
    const id = parseId(rawMatch[1]);
    if (id === null) return json({ error: "bad id" }, 400);
    const row = await env.INBOX.prepare(
      "SELECT raw FROM messages WHERE id = ?",
    )
      .bind(id)
      .first();
    if (!row) return json({ error: "not found" }, 404);
    return new Response(new Uint8Array(row.raw), {
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
      !ids.every((id) => Number.isSafeInteger(id) && id > 0)
    ) {
      return json({ error: `ids must be 1-${MAX_LIMIT} positive integers` }, 400);
    }
    const now = new Date().toISOString();
    const stmt = env.INBOX.prepare(
      "UPDATE messages SET read_at = ? WHERE id = ? AND read_at IS NULL",
    );
    const results = await env.INBOX.batch(ids.map((id) => stmt.bind(now, id)));
    const marked = results.reduce((n, r) => n + (r.meta?.changes || 0), 0);
    return json({ marked });
  }

  return json({ error: "not found" }, 404);
}
