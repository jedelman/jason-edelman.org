// Tests for the wiki route (src/wiki.js), against a fake PLC directory, two PDSes and Lichen's appview.
// Run: node --test 'claude/test/*.test.mjs' (after npm install in claude/).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqual } from "node:crypto";
import { applyDiff } from "@lichen-wiki/client/diff";
import { handleWiki, personDataProblem, resetWikiCache, WIKI_DAILY_WRITES } from "../src/wiki.js";
import { resetSession } from "../src/group.js";

if (!crypto.subtle.timingSafeEqual) crypto.subtle.timingSafeEqual = (a, b) => timingSafeEqual(Buffer.from(a), Buffer.from(b));

const JASON = "did:plc:zz4wcje4a2nbbtc7pdoth3f2";
const SCOUT = "did:plc:bhasdkz5dujccq2xyu2etju2";
const CLAUDE = "did:plc:5y6kop75jnvkbujbubrhj6e3";
const AUTONOMIST = "did:plc:kmswr7d5c55rc4ot2dbn6sfq";
const WIKI = `at://${JASON}/wiki.lichen.wiki/public-knowledge`;
const TOKEN = "bridge-token-for-tests";
const PASSWORD = "app-password-for-tests";
const HOME = `at://${JASON}/wiki.lichen.note/3n35fbkqqy3un`;
const HOME_HEAD = `at://${JASON}/wiki.lichen.noteRevision/3n35fbkqqy43u`;

function kv({ broken = false } = {}) {
  const m = new Map();
  return {
    m,
    async get(k, type) {
      if (broken) throw new Error("KV down");
      const v = m.get(k);
      return v === undefined ? null : type === "json" ? JSON.parse(v) : v;
    },
    async put(k, v) {
      if (broken) throw new Error("KV down");
      m.set(k, v);
    },
  };
}

function env(over = {}) {
  return {
    GROUP_BRIDGE_TOKEN: TOKEN,
    CLAUDE_BSKY_APP_PASSWORD: PASSWORD,
    CLAUDE_DID: CLAUDE,
    GROUP_ROSTER: `${JASON},${SCOUT},${CLAUDE}`,
    WIKI_ALLOW: WIKI,
    LICHEN_APPVIEW: "https://lichen.test",
    INBOX: kv(),
    ...over,
  };
}

/** A fake network. `notes` is the appview's state by slug; a write that lands moves the head (unless `race`). */
function fakeNet({ visibility = "public", members = [CLAUDE, SCOUT, AUTONOMIST], claudeRole = "contributor", haveSnapshot = false, race = false } = {}) {
  const calls = [];
  const writes = [];
  const notes = {
    home: { uri: HOME, wiki: WIKI, did: JASON, slug: "home", title: "Home", content: "# Welcome to Public Knowledge \n\nThis is the home page of your wiki.", latestRevisionUri: HOME_HEAD, createdAt: "2026-11-25T14:40:30.936Z", updatedAt: "2026-11-25T14:40:30.936Z" },
  };
  const docs = {
    [JASON]: { pds: "https://owner.pds", handle: "jason-edelman.org" },
    [CLAUDE]: { pds: "https://claude.pds", handle: "claude.jason-edelman.org" },
    [SCOUT]: { pds: "https://scout.pds", handle: "scout.jason-edelman.org" },
    [AUTONOMIST]: { pds: "https://pds.autonomist.jason-edelman.org", handle: "autonomist.jason-edelman.org" },
  };
  const reply = (status, data) => new Response(JSON.stringify(data), { status });
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    const method = u.pathname.replace("/xrpc/", "");
    const q = Object.fromEntries(u.searchParams);
    calls.push({ host: u.host, method, headers: init.headers || {}, body, query: q });
    if (u.host === "plc.directory") {
      const did = u.pathname.slice(1);
      const d = docs[did];
      if (!d) return reply(404, { message: "DID not registered" });
      return reply(200, { id: did, alsoKnownAs: [`at://${d.handle}`], service: [{ id: "#atproto_pds", type: "AtprotoPersonalDataServer", serviceEndpoint: d.pds }] });
    }
    if (method === "com.atproto.server.createSession") {
      if (body.password !== PASSWORD) return reply(401, { error: "AuthenticationRequired" });
      return reply(200, { accessJwt: "access-1", refreshJwt: "refresh-1", didDoc: { service: [{ id: "#atproto_pds", serviceEndpoint: "https://claude.pds" }] } });
    }
    if (u.host === "owner.pds" && method === "com.atproto.repo.getRecord" && q.collection === "wiki.lichen.wiki") {
      return q.rkey === "public-knowledge" ? reply(200, { uri: WIKI, value: { $type: "wiki.lichen.wiki", name: "Public Knowledge ", visibility, language: "en" } }) : reply(400, { error: "RecordNotFound" });
    }
    if (u.host === "owner.pds" && method === "com.atproto.repo.listRecords" && q.collection === "wiki.lichen.membership") {
      const records = [{ memberDid: JASON, role: "admin" }, ...members.map((d) => ({ memberDid: d, role: d === CLAUDE ? claudeRole : "contributor" }))].map((m, i) => ({
        uri: `at://${JASON}/wiki.lichen.membership/m${i}`,
        value: { $type: "wiki.lichen.membership", wikiRef: WIKI, createdAt: "2026-11-25T14:40:30.936Z", ...m },
      }));
      records.push({ uri: `at://${JASON}/wiki.lichen.membership/other`, value: { $type: "wiki.lichen.membership", wikiRef: `at://${JASON}/wiki.lichen.wiki/another`, memberDid: "did:plc:elsewhereelsewhereelse1", role: "admin" } });
      return reply(200, { records });
    }
    if (u.host === "lichen.test" && method === "wiki.lichen.getNote") {
      if (visibility !== "public") return reply(400, { error: "NotFound", message: "Wiki not found" });
      const n = notes[q.slug];
      return n ? reply(200, n) : reply(400, { error: "NotFound", message: "Note not found" });
    }
    if (u.host === "claude.pds" && method === "com.atproto.repo.getRecord") {
      return haveSnapshot ? reply(200, { value: { $type: "wiki.lichen.noteSnapshot" } }) : reply(400, { error: "RecordNotFound" });
    }
    if (u.host === "claude.pds" && method === "com.atproto.repo.applyWrites") {
      if (init.headers?.authorization !== "Bearer access-1") return reply(401, { error: "AuthRequired" });
      writes.push(body);
      if (!race) {
        const rev = body.writes.find((w) => w.collection === "wiki.lichen.noteRevision");
        const snap = body.writes.find((w) => w.collection === "wiki.lichen.noteSnapshot");
        notes[snap.value.slug] = { uri: rev.value.noteRef, wiki: WIKI, did: CLAUDE, slug: snap.value.slug, title: snap.value.title, content: snap.value.content, latestRevisionUri: `at://${CLAUDE}/wiki.lichen.noteRevision/${rev.rkey}` };
      }
      return reply(200, { commit: { cid: "bafy", rev: "r" } });
    }
    return reply(404, { error: "unexpected", url: String(url) });
  };
  return { fetchImpl, calls, writes, notes };
}

const deps = { sleep: async () => {} };
const req = (path, { method = "POST", body, token = TOKEN } = {}) =>
  new Request(`https://claude.jason-edelman.org${path}`, { method, headers: { "x-group-token": token, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
async function call(e, net, path, opts) {
  const r = await handleWiki(req(path, opts), e, new URL(`https://claude.jason-edelman.org${path}`), net.fetchImpl, deps);
  return { status: r.status, body: await r.json().catch(() => null) };
}
const write = (e, net, body) => call(e, net, "/wiki/write", { body });
const note = { title: "Workers Builds needs Artifacts Edit to clone", content: "Probe builds on 2026-11-23 showed it.\n", message: "First field note" };

beforeEach(() => {
  resetSession();
  resetWikiCache();
});

test("answers 404 without the allow-list, as if there were no route", async () => {
  const net = fakeNet();
  const r = await call(env({ WIKI_ALLOW: "" }), net, "/wiki/write", { body: note });
  assert.equal(r.status, 404);
  assert.equal(net.calls.length, 0);
});

test("refuses a wrong token and touches nothing", async () => {
  const net = fakeNet();
  const r = await call(env(), net, "/wiki/write", { body: note, token: "nope" });
  assert.equal(r.status, 401);
  assert.equal(net.calls.length, 0);
});

test("refuses a wiki that isn't on the allow-list", async () => {
  const net = fakeNet();
  const r = await write(env(), net, { ...note, wiki: `at://${JASON}/wiki.lichen.wiki/another` });
  assert.equal(r.status, 403);
  assert.equal(net.writes.length, 0);
});

test("refuses while the owner doesn't list Claude as a contributor", async () => {
  const net = fakeNet({ members: [SCOUT] });
  const r = await write(env(), net, note);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /contributor/);
  const viewer = fakeNet({ claudeRole: "viewer" });
  assert.equal((await write(env(), viewer, note)).status, 403);
});

test("refuses a private wiki and says why (the wiki as Jason made it, 2026-11-25)", async () => {
  const net = fakeNet({ visibility: "private" });
  const r = await write(env(), net, note);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /private.*only public wikis/);
  assert.equal(net.writes.length, 0);
});

test("a new note: one commit of three creates in Claude's repo, and it lands", async () => {
  const net = fakeNet();
  const e = env();
  const r = await write(e, net, note);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.action, "create");
  assert.equal(r.body.slug, "workers-builds-needs-artifacts-edit-to-clone");
  assert.equal(r.body.landed, true);
  assert.equal(r.body.view, "https://lichen.wiki/@jason-edelman.org/public-knowledge/workers-builds-needs-artifacts-edit-to-clone");
  assert.equal(net.writes.length, 1);
  const [commit] = net.writes;
  assert.equal(commit.repo, CLAUDE);
  assert.deepEqual(commit.writes.map((w) => [w.$type.split("#")[1], w.collection]), [
    ["create", "wiki.lichen.note"],
    ["create", "wiki.lichen.noteRevision"],
    ["create", "wiki.lichen.noteSnapshot"],
  ]);
  const [n, rev, snap] = commit.writes;
  assert.equal(n.value.wikiRef, WIKI);
  assert.equal(rev.value.noteRef, `at://${CLAUDE}/wiki.lichen.note/${n.rkey}`);
  assert.equal(rev.value.parentRevision, undefined);
  assert.equal(applyDiff("", rev.value.diff), note.content);
  assert.equal(rev.value.message, "First field note");
  assert.equal(snap.rkey, n.rkey);
  assert.equal(snap.value.content, note.content);
  assert.equal(snap.value.atRevision, `at://${CLAUDE}/wiki.lichen.noteRevision/${rev.rkey}`);
  assert.equal(e.INBOX.m.get(`wiki:writes:${new Date().toISOString().slice(0, 10)}`), "1");
  // Repo writes go to Claude's PDS with its session, never through the chat proxy.
  for (const c of net.calls.filter((c) => c.host === "claude.pds")) assert.equal(c.headers["atproto-proxy"], undefined);
});

test("a dry run checks everything and writes nothing, and isn't counted", async () => {
  const net = fakeNet();
  const e = env();
  const r = await write(e, net, { ...note, dryRun: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.dryRun, true);
  assert.equal(r.body.records.length, 3);
  assert.equal(net.writes.length, 0);
  assert.equal(net.calls.filter((c) => c.method === "com.atproto.server.createSession").length, 0, "a dry run doesn't even log in");
  assert.equal(e.INBOX.m.size, 0);
});

test("an edit must name the head it was written against", async () => {
  const net = fakeNet();
  const content = "# Welcome to Public Knowledge\n\nWhat the agents here have learned, with where it came from.";
  const stale = await write(env(), net, { slug: "home", content, message: "Say what the wiki is for", baseRevision: `at://${JASON}/wiki.lichen.noteRevision/3n35aaaaaaaaa` });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.head, HOME_HEAD);
  const missing = await write(env(), net, { slug: "home", content, message: "Say what the wiki is for" });
  assert.equal(missing.status, 409);
  assert.equal(net.writes.length, 0);
});

test("an edit: a revision on the head, and Claude's first snapshot of the note", async () => {
  const net = fakeNet();
  const before = net.notes.home.content;
  const content = "# Welcome to Public Knowledge\n\nWhat the agents here have learned, with where it came from.";
  const r = await write(env(), net, { slug: "home", content, message: "Say what the wiki is for", baseRevision: HOME_HEAD });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.action, "edit");
  assert.equal(r.body.landed, true);
  const [commit] = net.writes;
  assert.deepEqual(commit.writes.map((w) => [w.$type.split("#")[1], w.collection]), [
    ["create", "wiki.lichen.noteRevision"],
    ["create", "wiki.lichen.noteSnapshot"],
  ]);
  const [rev, snap] = commit.writes;
  assert.equal(rev.value.noteRef, HOME);
  assert.equal(rev.value.parentRevision, HOME_HEAD);
  assert.equal(applyDiff(before, rev.value.diff), content);
  assert.equal(rev.value.title, undefined, "no rename unless asked");
  assert.equal(snap.rkey, "3n35fbkqqy3un", "keyed by the note's rkey");
  assert.equal(snap.value.title, "Home");
});

test("a later edit replaces Claude's snapshot, and a rename rides on the revision", async () => {
  const net = fakeNet({ haveSnapshot: true });
  const r = await write(env(), net, { slug: "home", title: "Start here", content: "Hello.", message: "Rename", baseRevision: HOME_HEAD });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const [rev, snap] = net.writes[0].writes;
  assert.equal(rev.$type, "com.atproto.repo.applyWrites#create");
  assert.equal(snap.$type, "com.atproto.repo.applyWrites#update");
  assert.equal(rev.value.title, "Start here");
  assert.equal(snap.value.title, "Start here");
});

test("an unchanged note isn't written: an empty revision would stay in the repo for good", async () => {
  const net = fakeNet();
  const r = await write(env(), net, { slug: "home", content: net.notes.home.content, message: "nothing", baseRevision: HOME_HEAD });
  assert.equal(r.status, 409);
  assert.equal(net.writes.length, 0);
});

test("a write that loses the head race is reported as not landed", async () => {
  const net = fakeNet({ race: true });
  const r = await write(env(), net, note);
  assert.equal(r.status, 200);
  assert.equal(r.body.written, true);
  assert.equal(r.body.landed, false);
});

test("never a status change, an image, or a write without a message", async () => {
  const net = fakeNet();
  for (const extra of [{ status: "deleted" }, { blobs: [] }, { message: "" }, { message: undefined }]) {
    const r = await write(env(), net, { ...note, ...extra });
    assert.equal(r.status, 400, JSON.stringify(extra));
  }
  assert.equal(net.writes.length, 0);
});

test("refuses person-data and secrets before anything is written", async () => {
  const cases = [
    "write to someone@example.com",
    "call 757-555-0123",
    "call (757) 555 0123",
    "per did:plc:someoneelsesomeoneelse1 on Bluesky",
    "as @stranger.bsky.social said",
    "see https://bsky.app/profile/stranger.bsky.social/post/3abc",
    "at://did:web:stranger.example/app.bsky.feed.post/3abc",
    `token ${TOKEN}`,
    `pass ${PASSWORD}`,
    "key sk-ant-api03-abcdefghijklmnop",
    "-----BEGIN OPENSSH PRIVATE KEY-----",
  ];
  for (const text of cases) {
    const net = fakeNet();
    const r = await write(env(), net, { ...note, content: text });
    assert.equal(r.status, 422, text);
    assert.equal(net.writes.length, 0, text);
  }
  const net = fakeNet();
  const viaMessage = await write(env(), net, { ...note, message: "from someone@example.com" });
  assert.equal(viaMessage.status, 422);
  const viaTitle = await write(env(), net, { ...note, title: "What @stranger.bsky.social thinks" });
  assert.equal(viaTitle.status, 422);
});

test("members, package names, dates and the wiki's own addresses pass the person-data check", () => {
  const wiki = {
    roles: new Map([[JASON, "admin"], [CLAUDE, "contributor"], [SCOUT, "contributor"]]),
    handles: new Map([["jason-edelman.org", JASON], ["claude.jason-edelman.org", CLAUDE], ["scout.jason-edelman.org", SCOUT]]),
  };
  const fine = [
    "Scout (@scout.jason-edelman.org) and Claude (@claude.jason-edelman.org) agree.",
    `Jason is ${JASON}; the wiki is ${WIKI}.`,
    "It's written with @lichen-wiki/client and @atcute/lexicons.",
    "Checked 2026-11-23T14:40:30Z, 2,450 tests, version 4.90.1, commit b78d20e.",
    "See https://bsky.app/profile/jason-edelman.org for the owner.",
    "Ask @Jason-Edelman.org.",
  ];
  for (const text of fine) assert.equal(personDataProblem(text, wiki, [TOKEN]), null, text);
});

test("the day's limit holds, and an unreadable count refuses", async () => {
  const e = env();
  e.INBOX.m.set(`wiki:writes:${new Date().toISOString().slice(0, 10)}`, String(WIKI_DAILY_WRITES));
  const net = fakeNet();
  const full = await write(e, net, note);
  assert.equal(full.status, 429);
  const broken = await write(env({ INBOX: kv({ broken: true }) }), fakeNet(), note);
  assert.equal(broken.status, 503);
  assert.equal(net.writes.length, 0);
});

test("GET /wiki/note reads the note and its head; a private wiki is refused", async () => {
  const net = fakeNet();
  const r = await call(env(), net, "/wiki/note?slug=home", { method: "GET" });
  assert.equal(r.status, 200);
  assert.equal(r.body.latestRevisionUri, HOME_HEAD);
  assert.equal(r.body.title, "Home");
  const gone = await call(env(), net, "/wiki/note?slug=nope", { method: "GET" });
  assert.equal(gone.status, 404);
  const priv = await call(env(), fakeNet({ visibility: "private" }), "/wiki/note?slug=home", { method: "GET" });
  assert.equal(priv.status, 409);
});

test("every op this route sends is a create or update of the three note records", async () => {
  const net = fakeNet({ haveSnapshot: true });
  await write(env(), net, note);
  await write(env(), net, { slug: "home", content: "x", message: "y", baseRevision: HOME_HEAD });
  const ops = net.writes.flatMap((w) => w.writes);
  assert.ok(ops.length >= 5);
  for (const op of ops) {
    assert.match(op.$type, /#(create|update)$/);
    assert.ok(["wiki.lichen.note", "wiki.lichen.noteRevision", "wiki.lichen.noteSnapshot"].includes(op.collection));
  }
  assert.equal(net.calls.filter((c) => c.method === "com.atproto.server.createSession").length, 1, "one login, shared");
});
