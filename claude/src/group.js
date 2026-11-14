/**
 * The group bridge: Claude's account in one Bluesky group chat, for attended sessions only.
 *
 * Why it exists (Jason, 2026-11-13): the group of Jason, Claude and Scout is meant to be a primary surface for talking
 * to both agents at once. Scout reads it through scout-harness's group ingest. Claude has no standing process; it takes
 * part only from a Claude Code session Jason is attending, which polls this bridge and answers through it. The bridge
 * holds Claude's Bluesky app password so no session ever sees it, and it talks only in a convo whose members are all on
 * the roster, so it can't read or write Claude's other conversations.
 *
 * Routes, every one behind the `X-Group-Token` header (env.GROUP_BRIDGE_TOKEN, a secret; a session gets it injected by
 * its network proxy, never in hand). Not `Authorization`: the inbox (inbox.js) uses that header for its own token.
 *   GET  /group/convos                      the roster's group convos Claude is in (id, status, members)
 *   POST /group/accept   {convoId}          accept an invite to a roster convo
 *   GET  /group/messages?convoId=&cursor=   a roster convo's messages, newest first
 *   GET  /group/log?cursor=                 Claude's chat log, only the events of roster convos, and the groups it refused
 *   GET  /group/check?convoId=              whether a convo passes the room check now, and why not
 *   POST /group/send     {convoId, text}    send one message (at most 1000 graphemes and 9,500 bytes)
 *
 * Fails closed: without GROUP_BRIDGE_TOKEN, CLAUDE_BSKY_APP_PASSWORD or GROUP_ROSTER every route answers 404, as if
 * there were none. A convo with any member off the roster is refused (403), whatever the route, and so is any convo that
 * isn't a group: Claude's direct DMs, Jason's included, are never read or written here (found on the first live call,
 * 2026-11-13, when the Claude–Jason DM was the only roster convo listed).
 *
 * Within a convo that passes, a message whose sender is off the roster comes back with its text withheld (offRoster:
 * true): someone outside the roster may have been a member earlier, and their words never pass through here either. Found
 * on 2026-11-13, when the drift-test account joined, posted and left.
 */

const CHAT_PROXY = "did:web:api.bsky.chat#bsky_chat";
export const GROUP_KIND = "chat.bsky.convo.defs#groupConvo";
const DEFAULT_SERVICE = "https://bsky.social";
export const MAX_GRAPHEMES = 1000;
export const MAX_BYTES = 9500; // under Bluesky's 10,000-byte maxLength for a chat message, as scout-harness keeps it
const MAX_MEMBER_PAGES = 5;
const utf8 = new TextEncoder();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function roster(env) {
  return new Set(
    String(env.GROUP_ROSTER || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("did:")),
  );
}

export function configured(env) {
  return Boolean(env.GROUP_BRIDGE_TOKEN && env.CLAUDE_BSKY_APP_PASSWORD && env.CLAUDE_DID && roster(env).size > 0);
}

async function authorized(request, env) {
  const given = request.headers.get("x-group-token") || "";
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", utf8.encode(given)),
    crypto.subtle.digest("SHA-256", utf8.encode(env.GROUP_BRIDGE_TOKEN)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

export function textProblem(text) {
  if (typeof text !== "string" || !text.trim()) return "text must be a non-empty string";
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;
  if (graphemes > MAX_GRAPHEMES) return `text is ${graphemes} graphemes; the limit is ${MAX_GRAPHEMES}`;
  const bytes = utf8.encode(text).length;
  if (bytes > MAX_BYTES) return `text is ${bytes} bytes; the limit is ${MAX_BYTES}`;
  return null;
}

// ---- Claude's session: per isolate, and shared through KV ----------------------------------------------------------
//
// Bluesky allows 30 createSession calls per 5 minutes and 300 a day per account (docs.bsky.app, rate limits), and a
// watcher polls every 15 s. A session kept only in an isolate's memory would log in again on every new isolate, and
// running out would lock Claude's account out of logging in for a day, the inbox routine included (found 2026-11-14,
// after a "login failed (500)"). So the session is also kept in KV (the INBOX namespace, one key; the same trust as the
// app password secret beside it), read by a new isolate before it logs in, and replaced on every login and refresh.
// Each login and refresh logs a line, so they can be counted in the Worker's logs.

const SESSION_KEY = "group:claude-session";
const SESSION_TTL_SECONDS = 7 * 24 * 3600;
let session = null; // { accessJwt, refreshJwt, pds }

async function loadStored(env) {
  try {
    const s = await env.INBOX?.get(SESSION_KEY, "json");
    return s && typeof s.accessJwt === "string" && typeof s.refreshJwt === "string" && typeof s.pds === "string" ? s : null;
  } catch {
    return null;
  }
}

async function keep(env, s, how) {
  session = s;
  console.log(JSON.stringify({ group: how }));
  try {
    await env.INBOX?.put(SESSION_KEY, JSON.stringify(s), { expirationTtl: SESSION_TTL_SECONDS });
  } catch {}
  return s;
}

async function xrpc(fetchImpl, base, method, { query, body, token, proxy } = {}) {
  const url = new URL(`/xrpc/${method}`, base);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (proxy) headers["atproto-proxy"] = CHAT_PROXY;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetchImpl(url, { method: body === undefined ? "GET" : "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, data };
}

function pdsOf(didDoc, fallback) {
  const svc = didDoc?.service?.find?.((s) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer");
  return typeof svc?.serviceEndpoint === "string" ? svc.serviceEndpoint : fallback;
}

async function login(env, fetchImpl) {
  const service = env.CLAUDE_BSKY_SERVICE || DEFAULT_SERVICE;
  const r = await xrpc(fetchImpl, service, "com.atproto.server.createSession", {
    body: { identifier: env.CLAUDE_DID, password: env.CLAUDE_BSKY_APP_PASSWORD },
  });
  if (!r.ok) throw new Error(`login failed (${r.status} ${r.data?.error || ""})`);
  return keep(env, { accessJwt: r.data.accessJwt, refreshJwt: r.data.refreshJwt, pds: pdsOf(r.data.didDoc, service) }, "login");
}

async function refresh(env, fetchImpl) {
  if (!session?.refreshJwt) return login(env, fetchImpl);
  const r = await xrpc(fetchImpl, session.pds, "com.atproto.server.refreshSession", { body: {}, token: session.refreshJwt });
  if (!r.ok) return login(env, fetchImpl);
  return keep(env, { accessJwt: r.data.accessJwt, refreshJwt: r.data.refreshJwt, pds: pdsOf(r.data.didDoc, session.pds) }, "refresh");
}

/** A token the PDS no longer takes: expired, or revoked (a stored session another isolate has since refreshed). */
const staleToken = (r) => r.status === 401 || (r.status === 400 && (r.data?.error === "ExpiredToken" || r.data?.error === "InvalidToken"));

/** A chat call as Claude, through the PDS's chat proxy; one refresh on an expired token. */
async function chat(env, fetchImpl, method, opts = {}) {
  if (!session) session = await loadStored(env);
  if (!session) await login(env, fetchImpl);
  let r = await xrpc(fetchImpl, session.pds, method, { ...opts, token: session.accessJwt, proxy: true });
  if (staleToken(r)) {
    await refresh(env, fetchImpl);
    r = await xrpc(fetchImpl, session.pds, method, { ...opts, token: session.accessJwt, proxy: true });
  }
  return r;
}

/** Test seam: forget the cached session. */
export function resetSession() {
  session = null;
}

// ---- The roster check --------------------------------------------------------------------------------------------

/** Every member of the convo, by DID, or null if they can't all be read. getConvoMembers pages; getConvo's own list
 *  is the fallback for a convo kind that has no member listing. */
async function membersOf(env, fetchImpl, convoId) {
  const dids = new Set();
  let cursor;
  for (let page = 0; page < MAX_MEMBER_PAGES; page++) {
    const r = await chat(env, fetchImpl, "chat.bsky.convo.getConvoMembers", { query: { convoId, cursor, limit: 100 } });
    if (!r.ok) break;
    for (const m of r.data?.members || []) if (m?.did) dids.add(m.did);
    cursor = r.data?.cursor;
    if (!cursor) return dids;
  }
  if (dids.size) return cursor ? null : dids; // more pages than we read: not all known
  const c = await chat(env, fetchImpl, "chat.bsky.convo.getConvo", { query: { convoId } });
  if (!c.ok) return null;
  for (const m of c.data?.convo?.members || []) if (m?.did) dids.add(m.did);
  return dids.size ? dids : null;
}

export async function rosterConvo(env, fetchImpl, convoId) {
  if (typeof convoId !== "string" || !convoId) return { ok: false, why: "convoId is required" };
  const c = await chat(env, fetchImpl, "chat.bsky.convo.getConvo", { query: { convoId } });
  if (!c.ok) return { ok: false, why: "could not read the convo" };
  if (c.data?.convo?.kind?.$type !== GROUP_KIND) return { ok: false, why: "not a group convo" };
  const members = await membersOf(env, fetchImpl, convoId);
  if (!members) return { ok: false, why: "could not read the convo's members" };
  const allowed = roster(env);
  const outside = [...members].filter((d) => !allowed.has(d));
  if (outside.length) return { ok: false, why: `members off the roster: ${outside.length}` };
  return { ok: true, members: [...members] };
}

// ---- Routes ------------------------------------------------------------------------------------------------------

/** `allowed` is the roster (a Set); every caller passes it, so a missing one fails loudly rather than showing text. */
function messageView(m, allowed) {
  if (!m || typeof m !== "object") return null;
  const deleted = String(m.$type || "").endsWith("#deletedMessageView");
  // No sender: one of the chat service's own notices (a member added or removed). Its text is withheld like an
  // outsider's, since it can name one, but it is labelled for what it is (found on 2026-11-13, when two notices of
  // drift-test's add and removal came back marked offRoster).
  if (!m.sender?.did) return { id: m.id, rev: m.rev, sender: null, sentAt: m.sentAt, text: null, deleted, system: String(m.$type || "").split("#")[1] || "unknown" };
  const offRoster = !allowed.has(m.sender.did);
  return { id: m.id, rev: m.rev, sender: m.sender.did, sentAt: m.sentAt, text: deleted || offRoster ? null : (m.text ?? null), deleted, ...(offRoster ? { offRoster: true } : {}) };
}

export async function handleGroup(request, env, url, fetchImpl = fetch) {
  if (!configured(env)) return new Response("not found", { status: 404 });
  if (!(await authorized(request, env))) return json({ error: "unauthorized" }, 401);
  const route = url.pathname;
  try {
    if (route === "/group/convos" && request.method === "GET") {
      const out = [];
      let cursor;
      for (let page = 0; page < 5; page++) {
        const r = await chat(env, fetchImpl, "chat.bsky.convo.listConvos", { query: { limit: 100, cursor } });
        if (!r.ok) return json({ error: "listConvos failed", status: r.status, detail: r.data?.error }, 502);
        for (const c of r.data?.convos || []) {
          if (c.kind?.$type !== GROUP_KIND) continue; // only groups, never a direct DM
          const check = await rosterConvo(env, fetchImpl, c.id);
          if (check.ok) out.push({ id: c.id, status: c.status, members: check.members });
        }
        cursor = r.data?.cursor;
        if (!cursor) break;
      }
      return json({ convos: out });
    }

    if (route === "/group/accept" && request.method === "POST") {
      const { convoId } = await request.json().catch(() => ({}));
      const check = await rosterConvo(env, fetchImpl, convoId);
      if (!check.ok) return json({ error: check.why }, 403);
      const r = await chat(env, fetchImpl, "chat.bsky.convo.acceptConvo", { body: { convoId } });
      return r.ok ? json({ accepted: convoId }) : json({ error: "acceptConvo failed", status: r.status, detail: r.data?.error }, 502);
    }

    if (route === "/group/messages" && request.method === "GET") {
      const convoId = url.searchParams.get("convoId");
      const check = await rosterConvo(env, fetchImpl, convoId);
      if (!check.ok) return json({ error: check.why }, 403);
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 30, 1), 100);
      const r = await chat(env, fetchImpl, "chat.bsky.convo.getMessages", { query: { convoId, limit, cursor: url.searchParams.get("cursor") } });
      if (!r.ok) return json({ error: "getMessages failed", status: r.status, detail: r.data?.error }, 502);
      const allowed = roster(env);
      return json({ messages: (r.data?.messages || []).map((m) => messageView(m, allowed)).filter(Boolean), cursor: r.data?.cursor || null });
    }

    if (route === "/group/log" && request.method === "GET") {
      const r = await chat(env, fetchImpl, "chat.bsky.convo.getLog", { query: { cursor: url.searchParams.get("cursor") } });
      if (!r.ok) return json({ error: "getLog failed", status: r.status, detail: r.data?.error }, 502);
      const allowed = roster(env);
      const checked = new Map();
      const events = [];
      const refused = [];
      for (const e of r.data?.logs || []) {
        const convoId = e?.convoId;
        if (!convoId) continue;
        if (!checked.has(convoId)) {
          const check = await rosterConvo(env, fetchImpl, convoId);
          checked.set(convoId, check.ok);
          // A group that fails the room check is named, with the reason, so a watcher can say so instead of going quiet.
          // A direct DM is not: it was never this bridge's to mention.
          if (!check.ok && check.why !== "not a group convo") refused.push({ convoId, why: check.why });
        }
        if (!checked.get(convoId)) continue;
        events.push({ type: String(e.$type || "").split("#")[1] || e.$type, convoId, rev: e.rev, message: messageView(e.message, allowed) });
      }
      return json({ events, refused, cursor: r.data?.cursor || null });
    }

    if (route === "/group/check" && request.method === "GET") {
      const check = await rosterConvo(env, fetchImpl, url.searchParams.get("convoId"));
      return json(check.ok ? { ok: true, members: check.members } : { ok: false, why: check.why });
    }

    if (route === "/group/send" && request.method === "POST") {
      const { convoId, text } = await request.json().catch(() => ({}));
      const problem = textProblem(text);
      if (problem) return json({ error: problem }, 400);
      const check = await rosterConvo(env, fetchImpl, convoId);
      if (!check.ok) return json({ error: check.why }, 403);
      const r = await chat(env, fetchImpl, "chat.bsky.convo.sendMessage", { body: { convoId, message: { text } } });
      console.log(JSON.stringify({ group: "send", convoId, ok: r.ok, status: r.status }));
      return r.ok ? json({ sent: messageView(r.data, roster(env)) }) : json({ error: "sendMessage failed", status: r.status, detail: r.data?.error }, 502);
    }

    return json({ error: "no such route" }, 404);
  } catch (err) {
    // Never echo the password or a token: the only thrown errors here are login failures and fetch errors.
    return json({ error: String(err?.message || err).slice(0, 200) }, 502);
  }
}
