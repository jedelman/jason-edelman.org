// Tests for the group bridge (src/group.js), against a fake PDS and chat service. Run: node --test 'claude/test/*.test.mjs'
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqual } from "node:crypto";
import { handleGroup, resetSession, MAX_GRAPHEMES, MAX_BYTES } from "../src/group.js";

// crypto.subtle.timingSafeEqual is a Cloudflare Workers extension (inbox.js uses it too); Node has the same in node:crypto.
if (!crypto.subtle.timingSafeEqual) crypto.subtle.timingSafeEqual = (a, b) => timingSafeEqual(Buffer.from(a), Buffer.from(b));

const JASON = "did:plc:zz4wcje4a2nbbtc7pdoth3f2";
const SCOUT = "did:plc:bhasdkz5dujccq2xyu2etju2";
const CLAUDE = "did:plc:5y6kop75jnvkbujbubrhj6e3";
const OUTSIDER = "did:plc:outsideroutsideroutside1";
const TOKEN = "bridge-token-for-tests";
const PASSWORD = "app-password-for-tests";
const ENV = { GROUP_BRIDGE_TOKEN: TOKEN, CLAUDE_BSKY_APP_PASSWORD: PASSWORD, CLAUDE_DID: CLAUDE, GROUP_ROSTER: `${JASON},${SCOUT},${CLAUDE}` };

/** A fake Bluesky: createSession/refreshSession on the entryway and the PDS, and chat calls behind the chat proxy. */
function fakeBluesky({ expireOnce = false, memberPages = null } = {}) {
  const calls = [];
  const convos = {
    room: { id: "room", status: "accepted", members: [JASON, SCOUT, CLAUDE], kind: "group" },
    leak: { id: "leak", status: "accepted", members: [JASON, CLAUDE, OUTSIDER], kind: "group" },
    direct: { id: "direct", status: "accepted", members: [JASON, CLAUDE], kind: "direct" },
  };
  let expired = expireOnce;
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const method = u.pathname.replace("/xrpc/", "");
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ host: u.host, method, headers: init.headers || {}, body, query: Object.fromEntries(u.searchParams) });
    const reply = (status, data) => new Response(JSON.stringify(data), { status });
    if (method === "com.atproto.server.createSession") {
      if (body.password !== PASSWORD) return reply(401, { error: "AuthenticationRequired" });
      return reply(200, { accessJwt: "access-1", refreshJwt: "refresh-1", didDoc: { service: [{ id: "#atproto_pds", serviceEndpoint: "https://pds.example" }] } });
    }
    if (method === "com.atproto.server.refreshSession") return reply(200, { accessJwt: "access-2", refreshJwt: "refresh-2" });
    if (init.headers?.["atproto-proxy"] !== "did:web:api.bsky.chat#bsky_chat") return reply(400, { error: "NoProxy" });
    if (expired) {
      expired = false;
      return reply(400, { error: "ExpiredToken" });
    }
    if (method === "chat.bsky.convo.getConvoMembers") {
      if (memberPages) {
        const n = Number(u.searchParams.get("cursor") || 0);
        return reply(200, { members: [{ did: JASON }], cursor: n + 1 < memberPages ? String(n + 1) : undefined });
      }
      const c = convos[u.searchParams.get("convoId")];
      return c ? reply(200, { members: c.members.map((did) => ({ did })) }) : reply(400, { error: "InvalidConvo" });
    }
    const kindOf = (c) => ({ $type: `chat.bsky.convo.defs#${c.kind}Convo` });
    if (method === "chat.bsky.convo.getConvo") {
      const c = convos[u.searchParams.get("convoId")];
      return c ? reply(200, { convo: { id: c.id, kind: kindOf(c), members: c.members.map((did) => ({ did })) } }) : reply(400, { error: "InvalidConvo" });
    }
    if (method === "chat.bsky.convo.listConvos") return reply(200, { convos: Object.values(convos).map((c) => ({ id: c.id, status: c.status, kind: kindOf(c) })) });
    if (method === "chat.bsky.convo.getMessages")
      return reply(200, {
        messages: [
          { $type: "chat.bsky.convo.defs#messageView", id: "m2", rev: "2", text: "hello from Jason", sender: { did: JASON }, sentAt: "2026-11-13T04:00:00Z" },
          { $type: "chat.bsky.convo.defs#deletedMessageView", id: "m1", rev: "1", sender: { did: SCOUT }, sentAt: "2026-11-13T03:59:00Z" },
          { $type: "chat.bsky.convo.defs#messageView", id: "m0", rev: "0", text: "an outsider, since removed", sender: { did: OUTSIDER }, sentAt: "2026-11-13T03:58:00Z" },
        ],
        cursor: "c1",
      });
    if (method === "chat.bsky.convo.getLog")
      return reply(200, {
        logs: [
          { $type: "chat.bsky.convo.defs#logCreateMessage", convoId: "room", rev: "5", message: { $type: "chat.bsky.convo.defs#messageView", id: "m5", text: "in the room", sender: { did: SCOUT } } },
          { $type: "chat.bsky.convo.defs#logCreateMessage", convoId: "leak", rev: "6", message: { $type: "chat.bsky.convo.defs#messageView", id: "m6", text: "someone else's", sender: { did: OUTSIDER } } },
          { $type: "chat.bsky.convo.defs#logCreateMessage", convoId: "direct", rev: "7", message: { $type: "chat.bsky.convo.defs#messageView", id: "m7", text: "a DM", sender: { did: JASON } } },
        ],
        cursor: "log-2",
      });
    if (method === "chat.bsky.convo.sendMessage") return reply(200, { $type: "chat.bsky.convo.defs#messageView", id: "m9", rev: "9", text: body.message.text, sender: { did: CLAUDE } });
    if (method === "chat.bsky.convo.acceptConvo") return reply(200, { rev: "7" });
    return reply(404, { error: "MethodNotImplemented" });
  };
  return { fetchImpl, calls };
}

const req = (path, { method = "GET", token = TOKEN, body } = {}) => {
  const headers = token === null ? {} : { "x-group-token": token };
  if (body) headers["content-type"] = "application/json";
  return new Request(`https://claude.jason-edelman.org${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
};
const call = async (path, opts = {}, env = ENV, bsky = fakeBluesky()) => {
  const r = req(path, opts);
  const res = await handleGroup(r, env, new URL(r.url), bsky.fetchImpl);
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}
  return { status: res.status, data, text, bsky };
};

beforeEach(() => resetSession());

test("unconfigured: every route is a 404, and nothing is fetched", async () => {
  for (const missing of ["GROUP_BRIDGE_TOKEN", "CLAUDE_BSKY_APP_PASSWORD", "GROUP_ROSTER"]) {
    const env = { ...ENV, [missing]: "" };
    const bsky = fakeBluesky();
    const r = await call("/group/convos", {}, env, bsky);
    assert.equal(r.status, 404, missing);
    assert.equal(bsky.calls.length, 0);
  }
});

test("a missing or wrong token is a 401, and nothing is fetched", async () => {
  for (const token of [null, "", "wrong"]) {
    const bsky = fakeBluesky();
    const r = await call("/group/convos", { token }, ENV, bsky);
    assert.equal(r.status, 401);
    assert.equal(bsky.calls.length, 0);
  }
});

test("convos: only the roster's convo is listed; the one with an outsider is never shown", async () => {
  const r = await call("/group/convos");
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.convos.map((c) => c.id), ["room"]);
  assert.deepEqual(new Set(r.data.convos[0].members), new Set([JASON, SCOUT, CLAUDE]));
});

test("messages: a convo with an outsider is refused; the roster convo's messages come back, a deleted one without text", async () => {
  assert.equal((await call("/group/messages?convoId=leak")).status, 403);
  assert.equal((await call("/group/messages")).status, 403);
  const r = await call("/group/messages?convoId=room");
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.messages[0], { id: "m2", rev: "2", sender: JASON, sentAt: "2026-11-13T04:00:00Z", text: "hello from Jason", deleted: false });
  assert.equal(r.data.messages[1].deleted, true);
  assert.equal(r.data.messages[1].text, null);
  assert.equal(r.data.cursor, "c1");
});

test("log: only the roster convo's events are returned", async () => {
  const r = await call("/group/log");
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.events.map((e) => e.convoId), ["room"]);
  assert.equal(r.data.events[0].type, "logCreateMessage");
  assert.equal(r.data.events[0].message.text, "in the room");
  assert.equal(r.data.cursor, "log-2");
});

test("send: the text's limits, the roster, and the message goes through the chat proxy as Claude", async () => {
  assert.equal((await call("/group/send", { method: "POST", body: { convoId: "room", text: "  " } })).status, 400);
  assert.equal((await call("/group/send", { method: "POST", body: { convoId: "room", text: "x".repeat(MAX_GRAPHEMES + 1) } })).status, 400);
  assert.equal((await call("/group/send", { method: "POST", body: { convoId: "room", text: "é".repeat(MAX_BYTES / 2 + 1) } })).status, 400);
  assert.equal((await call("/group/send", { method: "POST", body: { convoId: "leak", text: "hi" } })).status, 403);
  const r = await call("/group/send", { method: "POST", body: { convoId: "room", text: "Claude here." } });
  assert.equal(r.status, 200);
  assert.equal(r.data.sent.text, "Claude here.");
  const send = r.bsky.calls.find((c) => c.method === "chat.bsky.convo.sendMessage");
  assert.equal(send.host, "pds.example");
  assert.equal(send.headers.authorization, "Bearer access-1");
  assert.deepEqual(send.body, { convoId: "room", message: { text: "Claude here." } });
});

test("the app password goes only to createSession, never to a chat call or into a response", async () => {
  const r = await call("/group/send", { method: "POST", body: { convoId: "room", text: "hi" } });
  for (const c of r.bsky.calls) {
    const seen = JSON.stringify(c);
    if (c.method === "com.atproto.server.createSession") assert.ok(seen.includes(PASSWORD));
    else assert.ok(!seen.includes(PASSWORD), c.method);
  }
  assert.ok(!r.text.includes(PASSWORD));
});

test("a login that fails is a 502 that doesn't echo the password", async () => {
  const r = await call("/group/convos", {}, { ...ENV, CLAUDE_BSKY_APP_PASSWORD: "not-it" });
  assert.equal(r.status, 502);
  assert.ok(!r.text.includes("not-it"));
});

test("an expired access token is refreshed once, and the call retried", async () => {
  const bsky = fakeBluesky({ expireOnce: true });
  const r = await call("/group/messages?convoId=room", {}, ENV, bsky);
  assert.equal(r.status, 200);
  assert.ok(bsky.calls.some((c) => c.method === "com.atproto.server.refreshSession"));
});

test("members on more pages than the bridge reads count as unknown: refused", async () => {
  const r = await call("/group/messages?convoId=room", {}, ENV, fakeBluesky({ memberPages: 9 }));
  assert.equal(r.status, 403);
});

test("accept: a roster convo only", async () => {
  assert.equal((await call("/group/accept", { method: "POST", body: { convoId: "leak" } })).status, 403);
  const r = await call("/group/accept", { method: "POST", body: { convoId: "room" } });
  assert.equal(r.status, 200);
  assert.equal(r.data.accepted, "room");
});

test("a direct DM is never touched, even when both its members are on the roster (the first live call, 2026-11-13)", async () => {
  const listed = await call("/group/convos");
  assert.ok(!listed.data.convos.some((c) => c.id === "direct"));
  for (const [path, opts] of [
    ["/group/messages?convoId=direct", {}],
    ["/group/send", { method: "POST", body: { convoId: "direct", text: "hi" } }],
    ["/group/accept", { method: "POST", body: { convoId: "direct" } }],
  ]) {
    const r = await call(path, opts);
    assert.equal(r.status, 403, path);
    assert.match(r.data.error, /not a group/);
  }
});

test("an off-roster sender's message in a roster convo comes back without its text (drift-test, 2026-11-13)", async () => {
  const r = await call("/group/messages?convoId=room");
  const m0 = r.data.messages.find((m) => m.id === "m0");
  assert.deepEqual(m0, { id: "m0", rev: "0", sender: OUTSIDER, sentAt: "2026-11-13T03:58:00Z", text: null, deleted: false, offRoster: true });
  assert.ok(!r.text.includes("an outsider, since removed"));
  assert.equal(r.data.messages.find((m) => m.id === "m2").offRoster, undefined);
});

test("log: a refused group is named with its reason; a direct DM is never mentioned", async () => {
  const r = await call("/group/log");
  assert.deepEqual(r.data.refused, [{ convoId: "leak", why: "members off the roster: 1" }]);
  assert.ok(!r.text.includes("direct"));
  assert.ok(!r.text.includes("a DM"));
  assert.ok(!r.text.includes("someone else's"));
});

test("check: the room check as it stands, for a watcher", async () => {
  const ok = await call("/group/check?convoId=room");
  assert.equal(ok.status, 200);
  assert.equal(ok.data.ok, true);
  assert.deepEqual(new Set(ok.data.members), new Set([JASON, SCOUT, CLAUDE]));
  assert.deepEqual((await call("/group/check?convoId=leak")).data, { ok: false, why: "members off the roster: 1" });
  assert.deepEqual((await call("/group/check?convoId=direct")).data, { ok: false, why: "not a group convo" });
  assert.equal((await call("/group/check?convoId=room", { token: "wrong" })).status, 401);
});
