/**
 * Claude's edits to the knowledge commons' wiki on Lichen (lichen.wiki), from attended sessions only.
 *
 * Why it exists (Jason, 2026-11-25): the knowledge commons (claude-memory `plans/knowledge-commons.md`) keeps its prose
 * in a Lichen wiki that Jason owns, with Claude a contributor. On Lichen, every member's edit is a record in that
 * member's own atproto repo, so Claude's edits have to be written as Claude's account, and its app password lives only
 * here. This route writes those records and nothing else.
 *
 * Routes, behind the group bridge's X-Group-Token (group.js): the same trust, a session Jason is attending, with the
 * token injected by its network proxy and never held in hand.
 *   GET  /wiki/note?wiki=&slug=   the note as Lichen's appview has it: title, content, head revision
 *   POST /wiki/write   {wiki?, slug?, title?, content, message, baseRevision?, dryRun?}
 *     A slug Lichen doesn't hold makes a new note (title needed; the slug comes from the title unless given).
 *     A slug it holds makes an edit, which must name the head revision it was written against as baseRevision.
 *     dryRun runs every check and returns the records without writing them.
 *
 * What holds:
 * - Only the wikis in WIKI_ALLOW, and only while the wiki's owner lists Claude as a contributor or admin.
 * - Only three record types, built by @lichen-wiki/client and checked against its lexicons: wiki.lichen.note,
 *   wiki.lichen.noteRevision and wiki.lichen.noteSnapshot. Never a wiki, membership or bookmark record, never a delete,
 *   and never a revision that changes a note's status (that's how Lichen deletes a note). A mistake is fixed by a new
 *   revision, so the history stays.
 * - An edit whose baseRevision isn't the head is refused (409), so it can't quietly undo someone else's edit.
 * - Before anything is written: no email address, phone number or secret, and no account (a DID, an @handle, an at://
 *   address or a bsky.app profile link) other than the wiki's members'. That's what a machine can check. Whether prose is
 *   about a person is the writing session's judgment, as it is in the group (claude-memory `protocols/group-chat.md`).
 * - Content up to MAX_CONTENT_BYTES, a message on every write, and at most WIKI_DAILY_WRITES writes a day, counted in KV.
 *   A count that can't be read refuses the write.
 * - Every write logs one line, without the content. The permanent record is the records themselves, in Claude's repo.
 *
 * Lichen's appview answers only for public wikis (its src/server/routes/xrpc.ts, requirePublicWiki), and this route
 * needs it to learn a note's head, so it refuses a private wiki and says so. A private wiki's records are public all the
 * same: atproto repos are public, and "private" only keeps lichen.wiki from showing the wiki to non-members.
 */

import { newNoteWrites, revisionWrite, snapshotWrite } from "@lichen-wiki/client/writes";
import { checkNewNoteTitle, checkNoteTitle, checkRevision } from "@lichen-wiki/client/check";
import { isServableNoteSlug, normalizeSlug, toNoteSlug } from "@lichen-wiki/client/slug";
import { parseAtUri } from "@lichen-wiki/client/at-uri";
import { COLLECTIONS } from "@lichen-wiki/client/collections";
import { mainSchema as NOTE_SCHEMA } from "@lichen-wiki/client/lexicons/types/wiki/lichen/note";
import { mainSchema as REVISION_SCHEMA } from "@lichen-wiki/client/lexicons/types/wiki/lichen/noteRevision";
import { mainSchema as SNAPSHOT_SCHEMA } from "@lichen-wiki/client/lexicons/types/wiki/lichen/noteSnapshot";
import { createDiff } from "@lichen-wiki/client/diff";
import { safeParse } from "@atcute/lexicons/validations";
import * as TID from "@atcute/tid";
import { authorized, configured as groupConfigured, pdsOf, repoCall, xrpc } from "./group.js";

const DEFAULT_APPVIEW = "https://lichen.wiki";
const PLC = "https://plc.directory";
/** Lichen allows a million bytes; a field note is a page. */
export const MAX_CONTENT_BYTES = 100_000;
export const WIKI_DAILY_WRITES = 30;
const MEMBER_PAGES = 5;
const LANDING_TRIES = 4;
const LANDING_WAIT_MS = 1500;
const MEMBERS_TTL_MS = 10 * 60 * 1000;
const utf8 = new TextEncoder();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

export function allowList(env) {
  return String(env.WIKI_ALLOW || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => parseAtUri(s)?.collection === COLLECTIONS.wiki);
}

export function configured(env) {
  return groupConfigured(env) && allowList(env).length > 0 && Boolean(env.INBOX);
}

// ---- Reading what Lichen and the owner's repo say ------------------------------------------------------------------

/** A DID's PDS and handle, from its DID document (did:plc through plc.directory, did:web from its host). */
export async function resolveDid(fetchImpl, did) {
  let url;
  if (did.startsWith("did:plc:")) url = `${PLC}/${did}`;
  else if (did.startsWith("did:web:")) url = `https://${did.slice("did:web:".length).replaceAll(":", "/")}/.well-known/did.json`;
  else return null;
  const res = await fetchImpl(url);
  if (!res.ok) return null;
  const doc = await res.json().catch(() => null);
  if (!doc) return null;
  const aka = Array.isArray(doc.alsoKnownAs) ? doc.alsoKnownAs.find((a) => typeof a === "string" && a.startsWith("at://")) : null;
  return { pds: pdsOf(doc, null), handle: aka ? aka.slice("at://".length).toLowerCase() : null };
}

let membersCache = new Map(); // wiki URI -> { at, value }

/** Test seam. */
export function resetWikiCache() {
  membersCache = new Map();
}

/** The wiki record and its members, from the owner's repo: the only place Lichen takes memberships from. */
export async function readWiki(fetchImpl, wikiUri, now = Date.now()) {
  const hit = membersCache.get(wikiUri);
  if (hit && now - hit.at < MEMBERS_TTL_MS) return hit.value;
  const { repo: owner, rkey: slug } = parseAtUri(wikiUri);
  const ownerDoc = await resolveDid(fetchImpl, owner);
  if (!ownerDoc?.pds) throw new Error("could not resolve the wiki owner's PDS");
  const rec = await xrpc(fetchImpl, ownerDoc.pds, "com.atproto.repo.getRecord", { query: { repo: owner, collection: COLLECTIONS.wiki, rkey: slug } });
  if (!rec.ok) throw new Error(`could not read the wiki record (${rec.status})`);
  const roles = new Map([[owner, "admin"]]);
  let cursor;
  for (let page = 0; page < MEMBER_PAGES; page++) {
    const r = await xrpc(fetchImpl, ownerDoc.pds, "com.atproto.repo.listRecords", { query: { repo: owner, collection: COLLECTIONS.membership, limit: 100, cursor } });
    if (!r.ok) throw new Error(`could not read the wiki's memberships (${r.status})`);
    for (const m of r.data?.records || []) {
      const val = m?.value;
      if (val?.wikiRef === wikiUri && typeof val.memberDid === "string" && typeof val.role === "string") roles.set(val.memberDid, val.role);
    }
    cursor = r.data?.cursor;
    if (!cursor) break;
    if (page === MEMBER_PAGES - 1) throw new Error("the wiki has more memberships than this route reads");
  }
  const handles = new Map();
  for (const did of roles.keys()) {
    const doc = did === owner ? ownerDoc : await resolveDid(fetchImpl, did);
    if (doc?.handle) handles.set(doc.handle, did);
  }
  const value = { owner, slug, ownerHandle: ownerDoc.handle, visibility: rec.data?.value?.visibility ?? null, roles, handles };
  membersCache.set(wikiUri, { at: now, value });
  return value;
}

/** The note as Lichen's appview holds it: { note } if it's there, { absent: true } if not, or { refused } with why. */
export async function getNote(fetchImpl, appview, wikiUri, slug) {
  const r = await xrpc(fetchImpl, appview, "wiki.lichen.getNote", { query: { wiki: wikiUri, slug } });
  if (r.ok && typeof r.data?.latestRevisionUri === "string" && typeof r.data?.content === "string") return { note: r.data };
  const error = r.data?.error;
  const message = String(r.data?.message || "");
  if (error === "NotFound" && /note not found/i.test(message)) return { absent: true };
  if (error === "NotFound" && /wiki not found/i.test(message)) return { refused: "Lichen's appview doesn't serve this wiki: it's private, hidden, or not indexed yet" };
  if (error === "NoteDeleted") return { refused: "that note is deleted, and restoring one isn't this route's to do" };
  throw new Error(`Lichen's appview answered ${r.status}${error ? ` ${error}` : ""}`);
}

// ---- The checks before anything is written -------------------------------------------------------------------------

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/;
const SECRET_SHAPES = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:sk-ant-|sk-proj-|ghp_|gho_|ghs_|ghu_|github_pat_|xox[abpr]-|art_v1_)[A-Za-z0-9_-]{10,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
];
const DID = /did:(?:plc|web):[A-Za-z0-9._:%-]*[A-Za-z0-9]/g;
const HANDLE = /(?:^|[^\w@.])@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)/gi;
const AT_AUTHORITY = /at:\/\/([^/\s)\]>"'`]+)/g;
const PROFILE = /bsky\.app\/profile\/([^/\s)\]>"'`?#]+)/g;

/** Why this text can't go into the commons, or null. `wiki` is readWiki's answer; `secrets` are this Worker's own. */
export function personDataProblem(text, wiki, secrets = []) {
  for (const s of secrets) if (typeof s === "string" && s.length >= 8 && text.includes(s)) return "contains a secret this Worker holds";
  for (const shape of SECRET_SHAPES) if (shape.test(text)) return "contains something shaped like a key or token";
  if (EMAIL.test(text)) return "contains an email address";
  if (PHONE.test(text)) return "contains a phone number";
  // A DID is compared as written; a handle without case, and without the sentence's own full stop.
  const isMember = (id) => wiki.roles.has(id) || wiki.handles.has(id.toLowerCase().replace(/[.,;:]+$/, ""));
  for (const m of text.matchAll(DID)) if (!isMember(m[0])) return `names an account that isn't a member of the wiki (${m[0].slice(0, 40)})`;
  for (const m of text.matchAll(HANDLE)) if (!isMember(m[1])) return `names an account that isn't a member of the wiki (@${m[1].slice(0, 60)})`;
  for (const re of [AT_AUTHORITY, PROFILE]) {
    for (const m of text.matchAll(re)) if (!isMember(decodeURIComponent(m[1]))) return `points at an account that isn't a member of the wiki (${m[1].slice(0, 60)})`;
  }
  return null;
}

function contentProblem(content, message) {
  if (typeof content !== "string") return "content must be a string";
  if (utf8.encode(content).length > MAX_CONTENT_BYTES) return `content is over ${MAX_CONTENT_BYTES} bytes`;
  if (typeof message !== "string" || !message.trim()) return "every write needs a message saying what changed and why";
  const p = checkRevision(content, message, []);
  return p ? `Lichen's check refused it: ${p.code}${p.max ? ` (limit ${p.max})` : ""}` : null;
}

function lexiconProblem(writes) {
  const schemas = { [COLLECTIONS.note]: NOTE_SCHEMA, [COLLECTIONS.noteRevision]: REVISION_SCHEMA, [COLLECTIONS.noteSnapshot]: SNAPSHOT_SCHEMA };
  for (const w of writes) {
    const schema = schemas[w.collection];
    if (!schema) return `refusing to write a ${w.collection} record`;
    const r = safeParse(schema, w.record);
    if (!r.ok) return `${w.collection} failed its lexicon: ${String(r.message).slice(0, 200)}`;
  }
  return null;
}

// ---- The daily count -----------------------------------------------------------------------------------------------

const countKey = (now) => `wiki:writes:${new Date(now).toISOString().slice(0, 10)}`;

async function writesToday(env, now) {
  const raw = await env.INBOX.get(countKey(now)); // throws if KV can't be read: the caller refuses
  const n = Number(raw || 0);
  if (!Number.isFinite(n) || n < 0) throw new Error("the day's write count is unreadable");
  return n;
}

async function countWrite(env, now, before) {
  await env.INBOX.put(countKey(now), String(before + 1), { expirationTtl: 3 * 24 * 3600 });
}

// ---- Writing -------------------------------------------------------------------------------------------------------

const createOp = (w) => ({ $type: "com.atproto.repo.applyWrites#create", collection: w.collection, rkey: w.rkey, value: w.record });
const updateOp = (w) => ({ $type: "com.atproto.repo.applyWrites#update", collection: w.collection, rkey: w.rkey, value: w.record });

/** Plans a write: the records, the applyWrites ops, or a refusal { status, error }. Reads, never writes. */
export async function planWrite(env, fetchImpl, body, now = Date.now()) {
  const allowed = allowList(env);
  const wikiUri = body.wiki ?? (allowed.length === 1 ? allowed[0] : undefined);
  if (typeof wikiUri !== "string" || !allowed.includes(wikiUri)) return { status: 403, error: "that wiki isn't on this route's allow-list" };
  if (body.status !== undefined || body.blobs !== undefined) return { status: 400, error: "this route never changes a note's status or adds images" };

  const problem = contentProblem(body.content, body.message);
  if (problem) return { status: 400, error: problem };

  const wiki = await readWiki(fetchImpl, wikiUri, now);
  const role = wiki.roles.get(env.CLAUDE_DID);
  if (role !== "contributor" && role !== "admin") return { status: 403, error: "the wiki's owner doesn't list Claude as a contributor" };
  if (wiki.visibility !== "public") return { status: 409, error: `the wiki is ${wiki.visibility ?? "of unknown visibility"}; Lichen's appview serves only public wikis, so this route can't learn a note's head` };

  const secrets = [env.GROUP_BRIDGE_TOKEN, env.CLAUDE_BSKY_APP_PASSWORD, env.INBOX_TOKEN];
  for (const [field, text] of [["title", body.title], ["content", body.content], ["message", body.message]]) {
    if (typeof text !== "string") continue;
    const why = personDataProblem(text, wiki, secrets);
    if (why) return { status: 422, error: `refused before writing: the ${field} ${why}` };
  }

  const slugGiven = typeof body.slug === "string" && body.slug ? normalizeSlug(body.slug) : null;
  if (slugGiven && !isServableNoteSlug(slugGiven)) return { status: 400, error: "that slug isn't one Lichen serves" };
  const slug = slugGiven ?? (typeof body.title === "string" ? toNoteSlug(body.title) : "");
  if (!slug) return { status: 400, error: "give a slug, or a title to make one from" };

  const appview = env.LICHEN_APPVIEW || DEFAULT_APPVIEW;
  const found = await getNote(fetchImpl, appview, wikiUri, slug);
  if (found.refused) return { status: 409, error: found.refused };
  const createdAt = new Date(now).toISOString();
  const me = env.CLAUDE_DID;

  if (found.absent) {
    if (body.baseRevision !== undefined) return { status: 409, error: `there's no note at ${slug}, so there's no base revision to edit from` };
    const titled = checkNewNoteTitle(typeof body.title === "string" ? body.title : "", slugGiven ?? undefined);
    if (titled.problem) return { status: 400, error: `Lichen's check refused the title: ${titled.problem.code}` };
    const w = newNoteWrites(me, { slug: titled.slug, title: body.title, wikiRef: wikiUri, content: body.content, message: body.message, createdAt });
    const writes = [w.note, w.revision, w.snapshot];
    const bad = lexiconProblem(writes);
    if (bad) return { status: 400, error: bad };
    return { action: "create", wiki, wikiUri, slug: titled.slug, appview, note: w.note.uri, revision: w.revision.uri, writes, ops: writes.map(createOp) };
  }

  const note = found.note;
  if (body.baseRevision !== note.latestRevisionUri) {
    return { status: 409, error: "the note's head isn't the baseRevision given: read it again (GET /wiki/note) and write against the new head", head: note.latestRevisionUri };
  }
  let title;
  if (typeof body.title === "string" && body.title !== note.title) {
    const p = checkNoteTitle(body.title);
    if (p) return { status: 400, error: `Lichen's check refused the title: ${p.code}` };
    title = body.title;
  }
  if (body.content === note.content && !title) return { status: 409, error: "nothing changed: an empty revision would sit in Claude's repo for good" };
  const revision = revisionWrite(me, TID.now(), {
    noteRef: note.uri,
    parentRevision: note.latestRevisionUri,
    diff: createDiff(note.content, body.content),
    message: body.message,
    title,
    createdAt,
  });
  const snapshot = snapshotWrite(me, { noteRef: note.uri, wikiRef: wikiUri, slug: note.slug, title: title ?? note.title, content: body.content, atRevision: revision.uri, createdAt });
  const writes = [revision, snapshot];
  const bad = lexiconProblem(writes);
  if (bad) return { status: 400, error: bad };
  return { action: "edit", wiki, wikiUri, slug: note.slug, appview, note: note.uri, revision: revision.uri, writes, snapshotRkey: snapshot.rkey };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function handleWiki(request, env, url, fetchImpl = fetch, deps = {}) {
  if (!configured(env)) return new Response("not found", { status: 404 });
  if (!(await authorized(request, env))) return json({ error: "unauthorized" }, 401);
  const now = deps.now ?? Date.now();
  const wait = deps.sleep ?? sleep;
  try {
    if (url.pathname === "/wiki/note" && request.method === "GET") {
      const allowed = allowList(env);
      const wikiUri = url.searchParams.get("wiki") || (allowed.length === 1 ? allowed[0] : "");
      if (!allowed.includes(wikiUri)) return json({ error: "that wiki isn't on this route's allow-list" }, 403);
      const slug = url.searchParams.get("slug") || "";
      if (!slug) return json({ error: "slug is required" }, 400);
      const found = await getNote(fetchImpl, env.LICHEN_APPVIEW || DEFAULT_APPVIEW, wikiUri, normalizeSlug(slug));
      if (found.refused) return json({ error: found.refused }, 409);
      if (found.absent) return json({ absent: true, slug }, 404);
      const n = found.note;
      return json({ uri: n.uri, slug: n.slug, title: n.title, content: n.content, latestRevisionUri: n.latestRevisionUri, author: n.did, updatedAt: n.updatedAt });
    }

    if (url.pathname === "/wiki/write" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return json({ error: "the body must be a JSON object" }, 400);
      const plan = await planWrite(env, fetchImpl, body, now);
      if (plan.error) return json({ error: plan.error, ...(plan.head ? { head: plan.head } : {}) }, plan.status);
      const view = `https://lichen.wiki/@${plan.wiki.ownerHandle || plan.wiki.owner}/${plan.wiki.slug}/${encodeURIComponent(plan.slug)}`;
      const summary = { action: plan.action, slug: plan.slug, note: plan.note, revision: plan.revision, view };
      if (body.dryRun === true) return json({ dryRun: true, ...summary, records: plan.writes.map((w) => ({ uri: w.uri, record: w.record })) });

      let before;
      try {
        before = await writesToday(env, now);
      } catch {
        return json({ error: "the day's write count can't be read, so nothing was written" }, 503);
      }
      if (before >= WIKI_DAILY_WRITES) return json({ error: `the wiki route has written ${before} times today; the limit is ${WIKI_DAILY_WRITES}` }, 429);

      let ops = plan.ops;
      if (plan.action === "edit") {
        // A snapshot is keyed by the note's rkey in the writer's repo, so Claude's first edit of a note creates it and
        // later ones replace it (Lichen's writes.js). The revisions are the history; the snapshot is the latest text.
        const have = await repoCall(env, fetchImpl, "com.atproto.repo.getRecord", { query: { repo: env.CLAUDE_DID, collection: COLLECTIONS.noteSnapshot, rkey: plan.snapshotRkey } });
        const [revision, snapshot] = plan.writes;
        ops = [createOp(revision), have.ok ? updateOp(snapshot) : createOp(snapshot)];
      }
      const r = await repoCall(env, fetchImpl, "com.atproto.repo.applyWrites", { body: { repo: env.CLAUDE_DID, writes: ops } });
      console.log(JSON.stringify({ wiki: "write", action: plan.action, slug: plan.slug, revision: plan.revision, ok: r.ok, status: r.status }));
      if (!r.ok) return json({ error: "applyWrites failed", status: r.status, detail: r.data?.error }, 502);
      await countWrite(env, now, before).catch(() => {});

      // Lichen learns of the write from the firehose, so its head moves a moment later, or not at all if another edit
      // reached it first (then this revision stays in the note's history).
      let landed = false;
      for (let i = 0; i < LANDING_TRIES && !landed; i++) {
        await wait(LANDING_WAIT_MS);
        const seen = await getNote(fetchImpl, plan.appview, plan.wikiUri, plan.slug).catch(() => null);
        landed = seen?.note?.latestRevisionUri === plan.revision;
      }
      return json({ written: true, ...summary, landed, ...(landed ? {} : { note_on_landing: "written to Claude's repo; Lichen hasn't shown it as the note's head yet" }) });
    }

    return json({ error: "no such route" }, 404);
  } catch (err) {
    return json({ error: String(err?.message || err).slice(0, 200) }, 502);
  }
}
