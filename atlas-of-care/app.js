// Atlas of Care: a place for finding each other.
//
// There is nothing on it but what people have added: one sentence about what they do, in
// their own words and beginning with "I"; a vouch for a sentence someone else has written;
// or a like for one. Nobody can say what another person does. The page draws the people
// as a graph, joined by their vouches and likes, and lists what each of them says. The
// rules for what people add are in atlas.js. Sign-in and the backlink index reuse the
// Library's code and its vendored SDK (../library/), so this folder depends on that one.
import * as A from "./atlas.js";
import { backlinks, resolveDid, resolveHandle, getRecord, HANDLE_RESOLVER } from "../library/lib.js";

const here = p => new URL(p, import.meta.url).href;
const getJson = p => fetch(here(p)).then(r => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });
const el = id => document.getElementById(id);
const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const href = u => (/^https?:\/\//.test(u || "") ? esc(u) : "#");

// What people have said they do, filled in once the index has been asked (loadPeople), and
// the vouches and likes for those statements, one per person each.
const STORIES = [];
let VOUCHES = [], LIKES = [];
// Read off the lists whenever any changes. A vouch or a like counts only for a statement
// that is shown and still reads as it did when it was vouched for or liked.
let IDX = { by: new Map(), from: new Map(), likes: new Map(), likeFrom: new Map(), n: 0, nl: 0 };
function reindex() {
  const current = new Map(STORIES.filter(s => !s.gone && s.cid).map(s => [s.uri, s.cid]));
  const group = (list, key) => { const m = new Map(); for (const v of list) (m.get(v[key]) || m.set(v[key], []).get(v[key])).push(v); return m; };
  const sv = A.standingVouches(VOUCHES, current), sl = A.standingLikes(LIKES, current);
  IDX = { by: group(sv, "subject"), from: group(sv, "did"), likes: group(sl, "subject"), likeFrom: group(sl, "did"), n: sv.length, nl: sl.length };
}
const vouchesFor = s => IDX.by.get(s.uri) || [];
const likesFor = s => IDX.likes.get(s.uri) || [];
const iVouch = s => !!state.me && vouchesFor(s).some(v => v.did === state.me);
const iLike = s => !!state.me && likesFor(s).some(v => v.did === state.me);
const isHere = did => STORIES.some(s => !s.gone && s.did === did);
const handleOf = did => (STORIES.find(s => s.did === did && s.handle) || VOUCHES.find(v => v.did === did && v.handle) || LIKES.find(v => v.did === did && v.handle) || {}).handle || (did === state.me && state.handle) || did;
const profileLink = did => `<a href="https://bsky.app/profile/${encodeURIComponent(did)}">@${esc(handleOf(did))}</a>`;
const countPeople = n => (n === 1 ? "one person" : n + " people");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const when = iso => { const d = iso && new Date(iso); return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""; };

// ---- places: a statement may name one, picked from a list. There is no map.
// The lists are the countries of the world, the counties of the United States, the
// districts of India and the regions of Europe; a record carries the list and the unit's id.
const LISTS = ["world", "us", "in", "eu"];
const unitNames = {};
function namesFor(scope) {
  if (!unitNames[scope]) unitNames[scope] = getJson(`data/${scope}.names.json`).catch(() => ({}));
  return unitNames[scope];
}
let placeIndex;   // every place by its name, for the form: loaded the first time the form opens
function allPlaces() {
  placeIndex ??= Promise.all(LISTS.map(namesFor)).then(sets => {
    const byName = new Map();
    sets.forEach((names, k) => { for (const [unit, name] of Object.entries(names)) if (!byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), { scope: LISTS[k], unit, name }); });
    return byName;
  });
  return placeIndex;
}
const placeKey = s => (s.scope ? s.scope + ":" + s.unit : "");
async function display(e) {
  const place = e.scope ? (await namesFor(e.scope))[e.unit] || null : null;
  return { ...e, cid: e.recordCid || null, key: e.uri, by: e.handle || e.did, place };
}

// ---- filters: which statements show, in the graph and in the list
let fk = "all", fp = "";   // fk: all, vouched, or follows. fp: a place key, or "" for everywhere
const fkinds = () => [["all", "Everyone"], ["vouched", "Vouched for"], ...(state.me && state.follows ? [["follows", "People you follow"]] : [])];
const passes = s => !s.gone && (fk === "all" || (fk === "vouched" ? IDX.by.has(s.uri) : !!state.follows && state.follows.has(s.did))) && (!fp || placeKey(s) === fp);
// The filter buttons are rebuilt only when the list of them changes (signing in adds one),
// and the place list only when the places do: rebuilding a control under a click swallows it.
function renderFilters() {
  const ks = fkinds(); if (!ks.some(([key]) => key === fk)) fk = "all";
  if (el("filters").dataset.ks !== ks.map(x => x[0]).join()) { el("filters").dataset.ks = ks.map(x => x[0]).join(); el("filters").innerHTML = ks.map(([key, l]) => `<button type="button" data-k="${key}">${l}</button>`).join(""); }
  const tally = new Map(); for (const s of STORIES) if (!s.gone && s.place) tally.set(placeKey(s), [s.place, (tally.get(placeKey(s))?.[1] || 0) + 1]);
  if (fp && !tally.has(fp)) fp = "";
  const opts = [...tally].sort((a, b) => a[1][0].localeCompare(b[1][0])), sig = opts.map(([key, [, n]]) => key + n).join();
  const sel = el("placefilter"); sel.parentElement.hidden = !opts.length;
  if (sel.dataset.sig !== sig) { sel.dataset.sig = sig; sel.innerHTML = `<option value="">Everywhere</option>` + opts.map(([key, [name, n]]) => `<option value="${esc(key)}">${esc(name)} (${n})</option>`).join(""); }
  sel.value = fp;
}
function applyFilters() {
  document.querySelectorAll(".story").forEach(n => n.classList.toggle("off", !passes(STORIES[+n.id.slice(6)])));
  el("filters").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === fk));
  dimGraph();
}
el("filters").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; fk = b.dataset.k; applyFilters(); });
el("placefilter").addEventListener("change", e => { fp = e.target.value; applyFilters(); });

// ---- what people say they do
const likeButton = (s, i) => { const n = likesFor(s).length, on = iLike(s); return `<button type="button" class="like" data-i="${i}" aria-pressed="${on}">${on ? "Liked" : "Like"}${n ? ` <b>${n}</b>` : ""}</button>`; };
const vouchButton = (s, i) => (iVouch(s) ? `<button type="button" class="unvouch" data-i="${i}" aria-pressed="true">Vouched</button>` : `<button type="button" class="vouch" data-i="${i}">Vouch</button>`);
// Their own sentence. Under it, everyone who vouches for it and how many like it. Whoever
// wrote it can decline a vouch.
function card(s, i) {
  const mine = state.me && s.did === state.me, vs = vouchesFor(s), nl = likesFor(s).length;
  const vouched = !vs.length ? "" : `\n  <p class="byline vouched">${vs.length === 1 ? "One person vouches" : vs.length + " people vouch"} for this: ${vs.slice(0, 8).map(v => profileLink(v.did) + (mine ? ` <button type="button" class="link decline" data-d="${esc(v.did)}" data-i="${i}">decline</button>` : "")).join(", ")}${vs.length > 8 ? ` and ${vs.length - 8} more` : ""}.</p>`;
  return `<article class="story" id="story-${i}">
  <h3>${esc(s.text)}</h3>
  <p class="where">${profileLink(s.did)}${s.place ? " · " + esc(s.place) : ""}${when(s.createdAt) ? " · " + when(s.createdAt) : ""}</p>${s.url ? `\n  <p class="url"><a href="${href(s.url)}" rel="nofollow noopener">${esc(s.url)}</a></p>` : ""}${vouched}${mine && nl ? `\n  <p class="byline">${plural(nl, "like", "likes")}.</p>` : ""}
  <div class="acts">${mine ? "" : likeButton(s, i) + vouchButton(s, i)}<button type="button" class="show" data-d="${esc(s.did)}">Show in the graph</button>${mine ? `<button type="button" class="remove" data-i="${i}">Remove</button>` : `<button type="button" class="takedown" data-i="${i}">Request takedown</button>`}</div></article>`;
}
function renderCards() { el("stories").innerHTML = STORIES.map((s, i) => (s.gone ? "" : card(s, i))).join(""); }
// One statement as a row with its buttons: for people you follow, a handle looked up, and the person picked in the graph.
const statementRow = (s, i) => `<li><div><a class="said" href="#story-${i}" data-i="${i}">${esc(s.text)}</a> <span>${profileLink(s.did)}${s.place ? " · " + esc(s.place) : ""}</span></div> ${s.did === state.me ? "" : `<span class="rowacts">${likeButton(s, i)}${vouchButton(s, i)}</span>`}</li>`;
function showStory(i) {
  if (!passes(STORIES[i])) { fk = "all"; fp = ""; renderFilters(); applyFilters(); }
  document.querySelectorAll(".story").forEach(n => n.classList.toggle("sel", +n.id.slice(6) === i));
  el("story-" + i)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
// Like, vouch, withdraw, decline and "go to it" work the same wherever they sit.
function actClick(e) {
  const b = e.target.closest("button, a[data-i]"); if (!b) return false;
  const i = +b.dataset.i;
  if (b.matches("a[data-i]")) { e.preventDefault(); showStory(i); return true; }
  if (b.classList.contains("like")) return toggleLike(i), true;
  if (b.classList.contains("vouch")) return vouchFor(i), true;
  if (b.classList.contains("unvouch")) return unvouch(i), true;
  if (b.classList.contains("decline")) return decline(b.dataset.d, i), true;
  return false;
}
el("stories").addEventListener("click", e => {
  if (actClick(e)) return;
  const b = e.target.closest("button.show"); if (b) { pick(b.dataset.d); return document.querySelector(".mapbox").scrollIntoView({ behavior: "smooth", block: "center" }); }
  const r = e.target.closest("button.remove"); if (r) return removeMine(+r.dataset.i);
  const t = e.target.closest("button.takedown"); if (t) requestTakedown(+t.dataset.i);
});
// Everything on the page that depends on what people have added, redrawn together.
function refresh() { reindex(); renderFilters(); renderAccount(); renderCards(); renderConnections(); drawGraph(); applyFilters(); renderPerson(); renderFollows(); renderSteps(); notePeople(); }
// The numbered instructions under the two questions tick off as the signed-in person does each.
function renderSteps() {
  const me = state.me, done = { in: !!me, say: !!me && isHere(me), like: !!me && LIKES.some(v => v.did === me), vouch: !!me && VOUCHES.some(v => v.did === me) };
  document.querySelectorAll("#steps li").forEach(li => { const d = done[li.dataset.step]; li.classList.toggle("done", d); });
}
el("steps").addEventListener("click", e => {
  const b = e.target.closest("button[data-go]"); if (!b) return;
  if (b.dataset.go === "do") return openAsk("do");
  el("entries").scrollIntoView({ behavior: "smooth", block: "start" });
});

// ---- the graph: one mark for each person who has said what they do, joined to the people
// whose statements they vouch for (amber) or like (green). It settles by itself: marks
// push apart, lines pull together, so circles of people who affirm each other gather.
const narrow = matchMedia("(max-width: 640px)").matches, still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const W = narrow ? 440 : 980, H = narrow ? 460 : 520;
const svg = d3.select("#graph").attr("viewBox", `0 0 ${W} ${H}`);
// An arrowhead for each kind of line: it points at whoever is vouched for or liked.
svg.append("defs").selectAll("marker").data(["vouch", "like"]).join("marker").attr("id", d => "arrow-" + d).attr("class", d => "arrow " + d)
  .attr("viewBox", "0 0 10 10").attr("refX", 9).attr("refY", 5).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto").attr("markerUnits", "userSpaceOnUse")
  .append("path").attr("d", "M0,1 L10,5 L0,9 z");
const gAll = svg.append("g"), gEdges = gAll.append("g"), gNodes = gAll.append("g");
let k = 1, picked = null, sim = null, nodeSel = null, edgeSel = null, nodes = [], edges = [];
const zoom = d3.zoom().scaleExtent([0.5, 6])
  .filter(e => (e.type === "wheel" ? e.ctrlKey || k !== 1 : e.touches ? e.touches.length > 1 || k !== 1 : !e.button))
  .on("zoom", e => { k = e.transform.k; gAll.attr("transform", e.transform); svg.style("touch-action", k !== 1 ? "none" : "pan-y"); });
svg.call(zoom).on("dblclick.zoom", null);
d3.select("#zin").on("click", () => svg.transition().duration(200).call(zoom.scaleBy, 1.6));
d3.select("#zout").on("click", () => svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.6));
const radius = n => 7 + 2.2 * Math.sqrt(2 * n.vouched + n.liked);
function drawGraph() {
  const at = new Map(nodes.map(n => [n.id, n])), byDid = new Map();
  for (const s of STORIES) if (!s.gone) (byDid.get(s.did) || byDid.set(s.did, { id: s.did, said: [], vouched: 0, liked: 0 }).get(s.did)).said.push(s);
  for (const n of byDid.values()) {
    for (const s of n.said) { n.vouched += vouchesFor(s).length; n.liked += likesFor(s).length; }
    const was = at.get(n.id); n.x = was ? was.x : W / 2 + (Math.random() - 0.5) * 120; n.y = was ? was.y : H / 2 + (Math.random() - 0.5) * 120;
  }
  const author = new Map(STORIES.filter(s => !s.gone).map(s => [s.uri, s.did])), pairs = new Map();
  const join = (list, kind) => { for (const v of list) { const to = author.get(v.subject); if (!to || !byDid.has(v.did) || to === v.did) continue;
    const key = v.did + ">" + to, e = pairs.get(key) || pairs.set(key, { source: v.did, target: to, vouch: 0, like: 0 }).get(key); e[kind]++; } };
  join([...IDX.from.values()].flat(), "vouch"); join([...IDX.likeFrom.values()].flat(), "like");
  nodes = [...byDid.values()]; edges = [...pairs.values()];
  if (picked && !byDid.has(picked)) picked = null;
  el("graphempty").hidden = nodes.length > 0;
  edgeSel = gEdges.selectAll("line").data(edges, e => e.source + ">" + e.target).join("line").attr("class", e => "edge " + (e.vouch ? "vouch" : "like")).attr("marker-end", e => `url(#arrow-${e.vouch ? "vouch" : "like"})`);
  nodeSel = gNodes.selectAll("g.node").data(nodes, n => n.id).join(enter => { const g = enter.append("g").attr("class", "node").attr("tabindex", 0).attr("role", "button"); g.append("circle").attr("class", "dot"); g.append("text"); return g; });
  nodeSel.attr("aria-label", n => `${handleOf(n.id)}: ${plural(n.said.length, "thing", "things")}${n.vouched ? `, ${plural(n.vouched, "vouch", "vouches")}` : ""}${n.liked ? `, ${plural(n.liked, "like", "likes")}` : ""}`)
    .on("click", (e, n) => pick(n.id)).on("keydown", (e, n) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(n.id); } })
    .on("pointerenter", (e, n) => { if (e.pointerType === "mouse") readout(n); }).on("pointerleave", e => { if (e.pointerType === "mouse") readout(nodes.find(n => n.id === picked)); })
    .call(d3.drag().on("start", (e, n) => { if (!still && !e.active) sim.alphaTarget(0.25).restart(); n.fx = n.x; n.fy = n.y; })
      .on("drag", (e, n) => { n.fx = e.x; n.fy = e.y; if (still) { n.x = e.x; n.y = e.y; place(); } })
      .on("end", (e, n) => { if (!still && !e.active) sim.alphaTarget(0); n.fx = null; n.fy = null; }));
  nodeSel.select("circle").attr("r", radius);
  nodeSel.select("text").attr("x", n => radius(n) + 5).attr("y", 4).text(n => "@" + handleOf(n.id));
  svg.classed("crowded", nodes.length > 40);   // past this, a name shows only for whoever is picked or under the pointer
  if (sim) sim.stop();
  sim = d3.forceSimulation(nodes).force("link", d3.forceLink(edges).id(n => n.id).distance(e => (e.vouch ? 100 : 150)).strength(e => (e.vouch ? 0.5 : 0.18)))
    .force("charge", d3.forceManyBody().strength(narrow ? -260 : -520).distanceMax(420)).force("x", d3.forceX(W / 2).strength(0.035)).force("y", d3.forceY(H / 2).strength(narrow ? 0.04 : 0.07))
    .force("collide", d3.forceCollide(n => radius(n) + 16)).on("tick", place);
  if (still) { sim.stop(); for (let i = 0; i < 240; i++) sim.tick(); place(); }
  mark(); el("swatches").innerHTML = `<span><i class="dotkey"></i>someone who has said what they do</span><span><i class="linekey vouch"></i>vouches for</span><span><i class="linekey like"></i>likes</span><span>a mark grows with the vouches and likes it is given</span>`;
  readout(nodes.find(n => n.id === picked));
}
function place() {
  for (const n of nodes) { const r = radius(n); n.x = Math.max(r + 4, Math.min(W - r - 4, n.x)); n.y = Math.max(r + 4, Math.min(H - r - 4, n.y)); }
  nodeSel.attr("transform", n => `translate(${n.x},${n.y})`);
  // A line stops at the edge of the mark it points to, so its arrowhead shows.
  edgeSel.each(function (e) {
    const dx = e.target.x - e.source.x, dy = e.target.y - e.source.y, d = Math.hypot(dx, dy) || 1, r = radius(e.target) + 3;
    d3.select(this).attr("x1", e.source.x).attr("y1", e.source.y).attr("x2", e.target.x - (dx / d) * r).attr("y2", e.target.y - (dy / d) * r);
  });
}
// Whoever is picked, and the people joined to them, stand out; filtered-out people fade.
function mark() {
  if (!nodeSel) return;
  const near = new Set(picked ? [picked] : []);
  for (const e of edges) { const a = e.source.id || e.source, b = e.target.id || e.target; if (a === picked) near.add(b); if (b === picked) near.add(a); }
  nodeSel.classed("sel", n => n.id === picked).classed("near", n => picked && near.has(n.id) && n.id !== picked);
  edgeSel.classed("lit", e => picked && ((e.source.id || e.source) === picked || (e.target.id || e.target) === picked));
}
function dimGraph() { if (nodeSel) { nodeSel.classed("off", n => !n.said.some(passes)); edgeSel.classed("off", e => !e.source.said?.some(passes) || !e.target.said?.some(passes)); } }
function readout(n) {
  el("readout").innerHTML = !nodes.length ? "" : !n ? "Pick someone to see what they do."
    : `<h3>@${esc(handleOf(n.id))}</h3><p>${n.said.length === 1 ? esc(n.said[0].text) : plural(n.said.length, "thing", "things") + " they say they do"}.${n.vouched ? ` ${plural(n.vouched, "vouch", "vouches")}.` : ""}${n.liked ? ` ${plural(n.liked, "like", "likes")}.` : ""}</p>`;
}
function pick(did) { picked = picked === did ? null : did; mark(); readout(nodes.find(n => n.id === picked)); renderPerson(); }

// ---- one person: what they say they do, who vouches for them, who they vouch for
function renderPerson() {
  const box = el("profile"), n = picked && nodes.find(x => x.id === picked);
  if (!n) { box.innerHTML = nodes.length ? `<h2>Who is here</h2><p>Pick someone in the graph to see what they do and what they vouch for.</p>` : ""; box.hidden = !nodes.length; return; }
  box.hidden = false;
  const mine = (IDX.from.get(n.id) || []).map(v => STORIES.findIndex(s => !s.gone && s.uri === v.subject)).filter(i => i >= 0);
  box.innerHTML = `<h2>${profileLink(n.id)}</h2>
    <ul class="flist">${n.said.map(s => statementRow(s, STORIES.indexOf(s))).join("")}</ul>
    ${mine.length ? `<p class="also">Vouches for ${mine.map(i => `${profileLink(STORIES[i].did)}: <a href="#story-${i}" data-i="${i}">${esc(STORIES[i].text)}</a>`).join("; ")}.</p>` : ""}`;
}
el("profile").addEventListener("click", actClick);

// ---- people: sign-in, saying what you do, removing it, asking for one to be taken down.
// The records live in people's own atproto accounts; this site stores nothing.
// Sign-in follows the Library (../library/app.js).
const state = { client: null, session: null, agent: null, me: null, handle: null, authError: false, notice: "", busy: false, draft: "", urlDraft: "", placeDraft: "", errors: [], ask: null, vouchDraft: "", vouchErrors: [], found: null,
  follows: null, followsError: false, followsAll: false };   // follows: the accounts here that the signed-in person follows; null until asked
let people = { loaded: false, error: null, unreachable: 0, withheld: 0 };

async function initAuth() {
  const { BrowserOAuthClient } = await import("../library/vendor/oauth-client-browser.js");
  let clientId = here("client-metadata.json");
  if (["127.0.0.1", "[::1]", "localhost"].includes(location.hostname)) {
    // Development: atproto's loopback client needs no hosted metadata.
    const host = location.hostname === "localhost" ? "127.0.0.1" : location.hostname;
    const redirect = `http://${host}:${location.port}${location.pathname}`;
    clientId = `http://localhost?redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(A.SCOPE)}`;
  }
  state.client = await BrowserOAuthClient.load({ clientId, handleResolver: HANDLE_RESOLVER,
    onSessionDeleted: sub => { if (state.me !== sub) return; state.notice = "You were signed out: the session ended."; setSession(null); } });
  const r = await state.client.init();
  if (r?.session) await setSession(r.session);
  renderAccount();
}
let Agent;
async function setSession(session) {
  // The SDK's Agent loads only once someone signs in; reading the map needs plain fetches only.
  if (session) Agent ??= (await import("../library/vendor/atproto-api.js")).Agent;
  state.session = session; state.agent = session ? new Agent(session) : null; state.me = session?.did ?? null; state.handle = null;
  state.follows = null; state.followsError = false; state.followsAll = false;
  if (session) resolveDid(session.did).then(id => { state.handle = id.handle; renderAccount(); }).catch(() => {});
  refresh(); renderAdd(); loadFollows();
}
function renderAccount() {
  el("notice").innerHTML = state.notice ? `<p class="notice">${esc(state.notice)}</p>` : "";
  el("account").innerHTML = state.me
    ? `<span>Signed in as <b>@${esc(state.handle || state.me)}</b>.</span> <button type="button" class="link" id="signout">Sign out</button>`
    : state.authError ? `<span>Sign-in is unavailable right now. You can still read the page.</span>`
    : `<form id="signin"><label for="handle">Sign in with your Bluesky handle. Any other atproto handle works too.</label> <input id="handle" name="handle" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="you.bsky.social"> <button type="submit">Sign in</button></form>`;
}
el("account").addEventListener("submit", async e => {
  e.preventDefault();
  const h = String(new FormData(e.target).get("handle") || "").trim().replace(/^@/, "");
  if (!h) return;
  if (!state.client) { state.notice = "Sign-in is still loading. Try again in a moment."; return renderAccount(); }
  try { await state.client.signIn(h); }   // redirects away; resolves only if the person comes back
  catch (err) { state.notice = `Sign-in failed: ${err.message}`; renderAccount(); }
});
el("account").addEventListener("click", async e => {
  if (e.target.id !== "signout") return;
  const session = state.session; state.notice = "";
  await setSession(null);
  try { await session?.signOut(); } catch {}
});

// The two questions at the top of the page open this panel. Both need an account.
function openAsk(ask) { state.ask = ask; renderAdd(); el("add").scrollIntoView({ behavior: "smooth", block: "start" }); }
function renderAdd() {
  const box = el("addbox");
  el("contribute").hidden = !state.ask;
  document.querySelectorAll(".askbtn").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.ask === state.ask)));
  if (!state.ask || !state.me) { box.innerHTML = ""; return; }
  if (state.ask === "who") { box.innerHTML = vouchForm(); return; }
  box.innerHTML = `<form class="addform" id="addform" novalidate>
    ${state.errors.length ? `<p class="errors" role="alert">${state.errors.map(esc).join(" ")}</p>` : ""}
    <div class="row say"><label class="i" for="addtext">I</label>
      <input id="addtext" name="text" autocomplete="off" placeholder="feed the birds" maxlength="${A.MAX_TEXT}" value="${esc(state.draft)}"></div>
    <p class="eg">I feed the birds. I cook for my kids. I clean toilets.</p>
    <div class="two"><label>Where, if you want to say
        <input id="addplace" name="place" list="places" autocomplete="off" spellcheck="false" placeholder="A country, county, district or region" value="${esc(state.placeDraft)}"></label>
      <label>A web address, if there is one
        <input id="addurl" name="url" inputmode="url" autocapitalize="none" spellcheck="false" placeholder="https://" maxlength="${A.MAX_URL}" value="${esc(state.urlDraft)}"></label></div>
    <div><button type="submit"${state.busy ? " disabled" : ""}>${state.busy ? "Saving" : "Add it"}</button></div>
    <p class="warn">Say what you do, in your own words: one line of up to ${A.MAX_TEXT} characters, with no web address or @ in it. It can only be about you. It is public, and it is saved in your own Bluesky (atproto) account under your handle. Anyone signed in can ask for it to be taken down.</p>
  </form>`;
  if (!el("places").childElementCount) allPlaces().then(byName => { el("places").innerHTML = [...byName.values()].map(p => `<option value="${esc(p.name)}"></option>`).join(""); });
}
// A vouch is for one thing one person has said they do. This finds a person's by their handle.
function vouchForm() {
  const list = state.found ? STORIES.map((s, i) => [s, i]).filter(([s]) => !s.gone && s.did === state.found) : [];
  return `<form class="addform" id="vouchform" novalidate>
    <p class="warn">A vouch affirms something someone has said they do: you know it to be so, and it holds your world together. A like says less: you are glad of it. You cannot write their sentence for them: it has to be on this page already, in their words. Both are public under your handle.</p>
    ${state.vouchErrors.length ? `<p class="errors" role="alert">${state.vouchErrors.map(esc).join(" ")}</p>` : ""}
    <div class="row"><label class="sr-only" for="vouchsubject">Their handle</label>
      <input id="vouchsubject" name="subject" autocapitalize="none" spellcheck="false" placeholder="their.handle" maxlength="253" value="${esc(state.vouchDraft)}">
      <button type="submit"${state.busy ? " disabled" : ""}>${state.busy ? "Looking" : "Find what they do"}</button></div>
    ${list.length ? `<ul class="flist">${list.map(([s, i]) => statementRow(s, i)).join("")}</ul>` : `<p>Or use the Like and Vouch buttons on anything in the list further down the page.</p>`}
  </form>`;
}
document.querySelectorAll(".askbtn").forEach(b => b.addEventListener("click", () => { state.ask = state.ask === b.dataset.ask ? null : b.dataset.ask; renderAdd(); }));
el("contribute").addEventListener("input", e => {
  const t = e.target;
  if (t.id === "addtext") state.draft = t.value;
  else if (t.id === "addurl") state.urlDraft = t.value;
  else if (t.id === "addplace") state.placeDraft = t.value;
  else if (t.id === "vouchsubject") state.vouchDraft = t.value;
});
el("contribute").addEventListener("submit", e => {
  if (e.target.id === "addform") { e.preventDefault(); addStatement(); }
  if (e.target.id === "vouchform") { e.preventDefault(); findPerson(); }
});
el("contribute").addEventListener("click", actClick);

// ---- people you follow: shown to someone signed in, with an invitation to like and vouch.
// Who they follow is asked of Bluesky's public service, about the accounts here only.
let followsRun = 0;
async function loadFollows() {
  const me = state.me, run = ++followsRun;
  if (!me || !people.loaded || people.error) return renderFollows();
  let got, failed = false;
  try { got = await A.loadFollowing(u => fetch(u).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }), me, STORIES.filter(s => !s.gone).map(s => s.did)); }
  catch { got = new Set(); failed = true; }
  if (run !== followsRun || state.me !== me) return;
  state.follows = got; state.followsError = failed;
  renderFilters(); applyFilters(); renderFollows();
}
function renderFollows() {
  const box = el("follows");
  box.hidden = !state.me || !people.loaded || !!people.error;
  if (box.hidden) return;
  if (!state.follows) { box.innerHTML = `<h2>People you follow</h2><p>Looking for the people you follow.</p>`; return; }
  if (state.followsError) { box.innerHTML = `<h2>People you follow</h2><p>Who you follow could not be checked right now. You can still like and vouch from the list further down the page.</p>`; return; }
  const rows = STORIES.map((s, i) => [s, i]).filter(([s]) => !s.gone && state.follows.has(s.did));
  if (!rows.length) { box.innerHTML = `<h2>People you follow</h2><p>Nobody you follow on Bluesky has said what they do here yet.</p>`; return; }
  const who = new Set(rows.map(([s]) => s.did)).size, show = state.followsAll ? rows : rows.slice(0, 6);
  box.innerHTML = `<h2>People you follow are here</h2>
    <p>${who === 1 ? "One person you follow has" : who + " people you follow have"} said what they do. Like it if you are glad of it. Vouch if it holds your world together.</p>
    <ul class="flist">${show.map(([s, i]) => statementRow(s, i)).join("")}</ul>
    ${rows.length > show.length ? `<p><button type="button" class="link" id="followsall">Show all ${rows.length}</button></p>` : ""}`;
}
el("follows").addEventListener("click", e => { if (actClick(e)) return; if (e.target.id === "followsall") { state.followsAll = true; renderFollows(); } });

// ---- liking and vouching: one record in your own account, pointing at one statement as it stands
function needSignIn(why) { state.notice = why; state.ask = state.ask || "who"; renderAccount(); renderAdd(); el("add").scrollIntoView({ behavior: "smooth", block: "start" }); }
async function affirm(i, kind) {   // kind: "vouch" or "like"
  const s = STORIES[i]; if (!s || s.gone) return;
  if (!state.agent) return needSignIn(`Sign in here to ${kind === "like" ? "like this" : "vouch"}.`);
  if (s.did === state.me) { state.notice = "That one is yours, and you cannot like or vouch for your own."; return renderAccount(); }
  const built = (kind === "like" ? A.buildLike : A.buildVouch)({ uri: s.uri, cid: s.cid });
  if (!built.ok) { state.notice = "That could not be saved right now. Reload the page and try again."; return renderAccount(); }
  try {
    const res = await state.agent.com.atproto.repo.createRecord({ repo: state.me, collection: A.COL[kind], record: built.record });
    (kind === "like" ? LIKES : VOUCHES).push({ did: state.me, handle: state.handle, subject: s.uri, cid: s.cid, createdAt: built.record.createdAt, records: [{ uri: res.data.uri, rkey: res.data.uri.split("/").pop() }] });
    state.notice = kind === "like" ? "" : `You vouch for what @${s.by} does. It is saved in your own account.`;
  } catch (err) { state.notice = `It could not be saved: ${err.message}`; }
  refresh(); renderAdd();
}
async function withdraw(i, kind) {
  const s = STORIES[i], list = kind === "like" ? LIKES : VOUCHES, v = s && list.find(x => x.did === state.me && x.subject === s.uri); if (!v || !state.agent) return;
  try {
    for (const r of v.records) await state.agent.com.atproto.repo.deleteRecord({ repo: state.me, collection: A.COL[kind], rkey: r.rkey });
    if (kind === "like") LIKES = LIKES.filter(x => x !== v); else VOUCHES = VOUCHES.filter(x => x !== v);
    state.notice = kind === "like" ? "" : "Your vouch is withdrawn.";
  } catch (err) { state.notice = `It could not be withdrawn: ${err.message}`; }
  refresh(); renderAdd();
}
const vouchFor = i => (STORIES[i] && iVouch(STORIES[i]) ? undefined : affirm(i, "vouch"));
const unvouch = i => withdraw(i, "vouch");
const toggleLike = i => (STORIES[i] && iLike(STORIES[i]) ? withdraw(i, "like") : affirm(i, "like"));
// The form: a handle, turned into its account, whose statements are then listed.
async function findPerson() {
  if (!state.agent || state.busy) return;
  const raw = state.vouchDraft.trim().replace(/^@/, "");
  state.busy = true; state.vouchErrors = []; state.found = null; renderAdd();
  try {
    const did = !raw ? "" : raw.startsWith("did:") ? raw : await resolveHandle(raw);
    if (!did) state.vouchErrors = ["Give someone's handle."];
    else if (did === state.me) state.vouchErrors = ["That is you. Use the first question to say what you do."];
    else if (!isHere(did)) state.vouchErrors = [`@${raw} has not said what they do here. Only they can.`];
    else state.found = did;
  } catch (err) { state.vouchErrors = [`That handle could not be found: ${err.message}`]; }
  state.busy = false; renderAdd();
}
// Whoever wrote a statement can decline a vouch for it: a takedown request against each record behind it.
async function decline(voucher, i) {
  const s = STORIES[i], v = s && s.did === state.me && VOUCHES.find(x => x.did === voucher && x.subject === s.uri); if (!v || !state.agent) return;
  try {
    for (const r of v.records) { const built = A.buildTakedown(r.uri); if (built.ok) await state.agent.com.atproto.repo.createRecord({ repo: state.me, collection: A.COL.takedown, record: built.record }); }
    VOUCHES = VOUCHES.filter(x => x !== v); people.withheld += v.records.length; state.notice = "Declined. That vouch is no longer shown here.";
  } catch (err) { state.notice = `The request could not be saved: ${err.message}`; }
  refresh();
}

async function addStatement() {
  if (!state.agent || state.busy) return;
  const wanted = state.placeDraft.trim(), found = wanted ? (await allPlaces()).get(wanted.toLowerCase()) : null;
  if (wanted && !found) { state.errors = ["That place is not on the list. Pick one from the list, or leave it out."]; return renderAdd(); }
  const built = A.buildStatement({ text: state.draft, url: state.urlDraft, ...(found ? { scope: found.scope, unit: found.unit } : {}) });
  if (!built.ok) { state.errors = built.errors; return renderAdd(); }
  state.busy = true; state.errors = []; renderAdd();
  try {
    const res = await state.agent.com.atproto.repo.createRecord({ repo: state.me, collection: A.COL.statement, record: built.record });
    const uri = res.data.uri, shown = await display({ ...A.parseStatement(built.record), uri, rkey: uri.split("/").pop(), did: state.me, handle: state.handle, recordCid: res.data.cid });
    STORIES.push(shown); picked = state.me;
    state.draft = ""; state.urlDraft = ""; state.placeDraft = ""; state.busy = false; state.notice = "Added. It is saved in your own account.";
    refresh(); renderAdd();
  } catch (err) { state.busy = false; state.errors = [`It could not be saved: ${err.message}`]; renderAdd(); }
}
async function removeMine(i) {
  const s = STORIES[i]; if (!s || s.did !== state.me || !state.agent) return;
  try { await state.agent.com.atproto.repo.deleteRecord({ repo: state.me, collection: A.COL.statement, rkey: s.rkey }); s.gone = true; state.notice = "Removed from your account and from this page."; }
  catch (err) { state.notice = `It could not be removed: ${err.message}`; }
  refresh();
}
// A takedown request is a record in the requester's account that points at the statement.
// The page stops showing it at once.
async function requestTakedown(i) {
  const s = STORIES[i]; if (!s) return;
  if (!state.agent) return needSignIn("Sign in here to ask for this to be taken down.");
  try {
    const built = A.buildTakedown(s.uri); if (built.ok) await state.agent.com.atproto.repo.createRecord({ repo: state.me, collection: A.COL.takedown, record: built.record });
    s.gone = true; people.withheld += 1; state.notice = "Takedown requested. It is no longer shown here.";
  } catch (err) { state.notice = `The request could not be saved: ${err.message}`; }
  refresh();
}
function notePeople() {
  const said = STORIES.filter(s => !s.gone).length;
  el("communitynote").textContent = !people.loaded ? "Looking for what people have added."
    : people.error ? "What people have added cannot be shown right now. The outside index this page uses to find it, and to find takedown requests against it, did not answer."
    : (said ? `${plural(said, "thing", "things")} people say they do. ${plural(IDX.n, "vouch", "vouches")}. ${plural(IDX.nl, "like", "likes")}.` : "Nobody has added anything yet. The first question at the top of the page is how to start.")
      + (people.withheld ? ` ${people.withheld} withheld after a takedown request.` : "")
      + (people.unreachable ? ` ${people.unreachable} could not be read from their authors' servers.` : "");
  el("graphempty").textContent = !people.loaded ? "Looking for who is here." : people.error ? "Who is here cannot be shown right now." : "Nobody is here yet. Say what you do, and you will be the first.";
}
async function loadPeople() {
  notePeople();
  let hidden = {}; try { hidden = await getJson("hidden.json"); } catch {}
  const out = await A.loadCommunity({ backlinks, resolveDid, getRecord }, hidden);
  const have = new Set(STORIES.map(s => s.key));
  for (const e of out.statements) if (!have.has(e.uri)) STORIES.push(await display(e));
  const fresh = (mine, got) => mine.filter(v => !got.some(o => v.records.some(r => r.uri === o.uri)));   // written here before the index answered
  VOUCHES = [...A.cleanVouches(out.vouches), ...fresh(VOUCHES, out.vouches)];
  LIKES = [...A.cleanLikes(out.likes), ...fresh(LIKES, out.likes)];
  people = { loaded: true, error: out.error, unreachable: out.unreachable, withheld: out.withheld };
  refresh(); loadFollows();
}

// ---- who vouches for whom: the connections between people, read off the vouches
function renderConnections() {
  el("connections").hidden = !IDX.from.size;
  el("connlist").innerHTML = [...IDX.from].sort((a, b) => b[1].length - a[1].length || handleOf(a[0]).localeCompare(handleOf(b[0]))).map(([did, vs]) =>
    `<li>${profileLink(did)} vouches for ${vs.map(v => { const i = STORIES.findIndex(s => !s.gone && s.uri === v.subject), s = STORIES[i];
      return `@${esc(s.by)}: <a href="#story-${i}" data-i="${i}">${esc(s.text)}</a>`; }).join("; ")}.</li>`).join("");
}
el("connlist").addEventListener("click", actClick);

// ---- prior work: what came before this atlas, each entry checked against the page it links to
const PRIOR_KINDS = [["maps", "Maps and directories of care"], ["counting", "Counting unpaid work"], ["ideas", "Care, maintenance and repair"], ["commons", "Commons and counter-mapping"]];
async function loadPrior() {
  let list; try { list = await getJson("data/prior.json"); } catch { return; }
  if (!Array.isArray(list) || !list.length) return;
  el("prior").hidden = false; el("priornav").hidden = false;
  el("priorlist").innerHTML = PRIOR_KINDS.map(([key, label]) => {
    const items = list.filter(w => w.kind === key); if (!items.length) return "";
    return `<h3>${label}</h3><ul>` + items.map(w => `<li><span class="cite">${w.authors ? esc(w.authors) + ". " : ""}<a href="${href(w.url)}">${esc(w.title)}</a>${w.publisher || w.year ? ". " + [w.publisher, w.year].filter(Boolean).map(esc).join(", ") : ""}.</span>
      ${esc(w.what)}${w.status ? ` <span class="meta">${esc(w.status)}</span>` : ""}${w.quote ? ` <q>${esc(w.quote)}</q>` : ""}</li>`).join("") + `</ul>`;
  }).join("");
}

const LIMITS = [
  "Everything here is something a person said about themselves, and this site does not check any of it. A vouch only means another person says it is so, and a like only means someone is glad of it.",
  "The form makes every sentence begin with I, and will not save one with a web address or an @ in it. It cannot stop someone using a sentence that begins with I to talk about somebody else. If that happens, anyone signed in can ask for the sentence to be taken down, and it stops showing on this page straight away.",
  "Everything you add is public. A sentence, a vouch or a like is a record in the account of whoever made it, under their handle, and anyone can read it there whether or not this page shows it.",
  "The graph shows only the people who have found this page and added a sentence. A person who is not in it may be holding their world together all the same.",
  "Only people who have said what they do are drawn. Someone who only likes and vouches has no mark of their own.",
  "Saying what you do, liking, vouching and asking for a takedown all need an atproto account. Someone without one cannot do any of them here.",
  "A vouch or a like is for one sentence in the wording it had at the time. If the sentence is changed or removed, the vouch or like stops counting. Whoever wrote the sentence can decline a vouch, and it stops showing on this page straight away, though the record stays in the voucher's own account.",
  "Who you follow is read from Bluesky's public service, about the accounts here only. Follows kept anywhere else are not seen.",
  "A place is optional, and it is a name from a list: a country, a US county, an Indian district or a European region.",
  "What people have added is found through Constellation, an outside index of atproto records. When Constellation does not answer, none of it is shown.",
];
const SOURCES = [
  ["The index that finds what people have added: Constellation", "https://constellation.microcosm.blue/"],
  ["Who you follow: Bluesky's public service for reading the network (its AppView)", "https://docs.bsky.app/docs/api/app-bsky-graph-get-relationships"],
  ["Country names: Natural Earth, through the world-atlas package", "https://github.com/topojson/world-atlas"],
  ["United States county names: County Health Rankings & Roadmaps, 2025, and the US Census Bureau through the us-atlas package", "https://www.countyhealthrankings.org/"],
  ["India district names: geoBoundaries (Open Database License 1.0)", "https://www.geoboundaries.org/"],
  ["Europe region names: Eurostat GISCO, NUTS 2021, level 2", "https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics"],
];
el("limits").innerHTML = LIMITS.map(t => `<li>${t}</li>`).join("");
el("sources").innerHTML = SOURCES.map(([t, u]) => `<li><a href="${u}">${t}</a></li>`).join("");
refresh();
initAuth().catch(() => { state.authError = true; renderAccount(); });
loadPeople();
loadPrior();
