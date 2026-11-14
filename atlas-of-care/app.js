// Atlas of Care: a map for finding each other.
//
// There is nothing on it but what people have added: a link to what they do in a place, or
// a vouch for someone else who has added what they do. The map
// itself only gives those somewhere to stand: countries, and inside the United States,
// India and Europe, counties, districts and regions. The rules for what people add are in
// atlas.js. Sign-in and the backlink index reuse the Library's code and its vendored SDK
// (../library/), so this folder depends on that one.
import * as A from "./atlas.js";
import { backlinks, resolveDid, resolveHandle, getRecord, HANDLE_RESOLVER } from "../library/lib.js";

const here = p => new URL(p, import.meta.url).href;
const getJson = p => fetch(here(p)).then(r => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });
const el = id => document.getElementById(id);
const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const href = u => (/^https?:\/\//.test(u || "") ? esc(u) : "#");
let WORLD, WNAMES;
try { [WORLD, WNAMES] = await Promise.all([getJson("data/world.topo.json"), getJson("data/world.names.json")]); }
catch (err) { el("readout").textContent = "The map could not be loaded. Try again in a moment."; throw err; }
// Every mark on the map: the links people have added, filled in once the index has been
// asked (loadPeople). VOUCHES are the vouches between accounts, one per voucher per account.
const STORIES = [];
let VOUCHES = [];
// Read off the two lists whenever either changes: who vouches for each account that is on
// the map, and who each voucher vouches for. A vouch for someone with no link of their own
// does not count, so nobody is named here who has not put themselves here.
let IDX = { by: new Map(), from: new Map(), n: 0 };
function reindex() {
  const here = new Set(STORIES.filter(s => !s.gone).map(s => s.did)), by = new Map(), from = new Map();
  const standing = A.standingVouches(VOUCHES, here);
  for (const v of standing) { (by.get(v.subject) || by.set(v.subject, []).get(v.subject)).push(v); (from.get(v.did) || from.set(v.did, []).get(v.did)).push(v); }
  IDX = { by, from, n: standing.length };
}
const onMap = did => STORIES.some(s => !s.gone && s.did === did);
const handleOf = did => (STORIES.find(s => s.did === did && s.handle) || VOUCHES.find(v => v.did === did && v.handle) || {}).handle || (did === state.me && state.handle) || did;
const profileLink = did => `<a href="https://bsky.app/profile/${encodeURIComponent(did)}">@${esc(handleOf(did))}</a>`;

// ---- the maps: the world by country, and three places that open to smaller units
const W = 980, H = 520;
const wkey = f => (f.id != null ? String(f.id) : "name:" + f.properties.name);
const SCOPES = {
  world: { label: "World", units: "countries", unit: "country", ready: true,
    features: topojson.feature(WORLD, WORLD.objects.countries).features.filter(f => f.id !== "010"),
    idOf: f => WNAMES[wkey(f)]?.a3, names: Object.fromEntries(Object.values(WNAMES).map(m => [m.a3, m.n])),
    projection: fs => d3.geoEqualEarth().fitExtent([[6, 6], [W - 6, H - 6]], { type: "FeatureCollection", features: fs }) },
  us: { label: "United States", units: "counties", unit: "county", files: ["data/us.topo.json", "data/us.names.json"],
    build: ([t, n]) => ({ features: topojson.feature(t, t.objects.counties).features, mesh: topojson.mesh(t, t.objects.states, (a, b) => a !== b), names: n }),
    idOf: f => f.id, projection: fs => d3.geoAlbersUsa().fitExtent([[10, 10], [W - 10, H - 10]], { type: "FeatureCollection", features: fs }) },
  in: { label: "India", units: "districts", unit: "district", files: ["data/in.geo.json", "data/in.names.json"],
    build: ([g, n]) => ({ features: g.features, names: n }),
    idOf: f => f.id, projection: fs => d3.geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], { type: "FeatureCollection", features: fs }) },
  eu: { label: "Europe", units: "regions", unit: "region", files: ["data/eu.topo.json", "data/eu.names.json"],
    build: ([t, n]) => ({ features: topojson.feature(t, t.objects[Object.keys(t.objects)[0]]).features.map(f => (f.id = f.properties.NUTS_ID, f)), names: n }),
    idOf: f => f.id, projection: () => d3.geoConicConformal().rotate([-12, 0]).parallels([40, 62]).fitExtent([[10, 10], [W - 10, H - 10]],
      { type: "MultiPoint", coordinates: [[-24, 64], [-10, 36], [34, 35], [32, 70], [10, 71]] }) },
};
const EUROPE = new Set("AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE NOR CHE ISL".split(" "));
const OPENS = a3 => (a3 === "USA" ? "us" : a3 === "IND" ? "in" : EUROPE.has(a3) ? "eu" : null);

const svg = d3.select("#map");
const g = svg.append("g"), gUnits = g.append("g"), gMesh = g.append("path").attr("fill", "none").attr("class", "mesh"), gTies = g.append("g"), gPins = g.append("g");
let scopeKey = "world", S = SCOPES.world, picked = null, proj, pathGen, shapes, pins, ties, pinInner, k = 1;
let fk = "all";   // which marks show: all, link ("what I do") or vouch ("who holds my world together")
const zoom = d3.zoom().scaleExtent([1, 16]).translateExtent([[0, 0], [W, H]])
  .filter(e => (e.type === "wheel" ? e.ctrlKey || k > 1 : e.touches ? e.touches.length > 1 || k > 1 : !e.button))
  .on("zoom", e => { k = e.transform.k; g.attr("transform", e.transform); if (pinInner) pinInner.attr("transform", `scale(${1 / k})`);
    svg.style("touch-action", k > 1 ? "none" : "pan-y"); });
svg.call(zoom).on("dblclick.zoom", null);
d3.select("#zin").on("click", () => svg.transition().duration(200).call(zoom.scaleBy, 1.8));
d3.select("#zout").on("click", () => svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.8));
const featureOf = id => S.features.find(f => S.idOf(f) === id);
const nameOf = f => S.names[S.idOf(f)] || (f.properties && (f.properties.name || f.properties.NAME_LATN)) || "Unnamed";
function zoomTo(f) {
  const [[x0, y0], [x1, y1]] = pathGen.bounds(f), kk = Math.max(1, Math.min(12, 0.5 / Math.max((x1 - x0) / W, (y1 - y0) / H)));
  svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(kk).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
}

// ---- what people have added
const fkinds = () => [["all", "Everyone"], ["vouched", "Vouched for"], ...(state.me && state.follows ? [["follows", "People you follow"]] : [])];
const where = s => esc(s.place);
const passes = s => !s.gone && (fk === "all" || (fk === "vouched" ? IDX.by.has(s.did) : !!state.follows && state.follows.has(s.did)));
const when = iso => { const d = iso && new Date(iso); return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""; };
const countPeople = n => (n === 1 ? "one person" : n + " people");
// A link someone added: a web address and a place, nothing of their own wording. Under it,
// everyone who vouches for the person behind it. Whoever it is about can decline a vouch.
function linkCard(s, i) {
  const mine = state.me && s.did === state.me, vs = IDX.by.get(s.did) || [], iv = state.me && vs.some(v => v.did === state.me);
  const vouched = !vs.length ? "" : `\n  <p class="byline vouched">${vs.length === 1 ? "One person says" : vs.length + " people say"} @${esc(s.by)} holds their world together: ${vs.slice(0, 8).map(v => profileLink(v.did) + (mine ? ` <button type="button" class="link decline" data-d="${esc(v.did)}">decline</button>` : "")).join(", ")}${vs.length > 8 ? ` and ${vs.length - 8} more` : ""}.</p>`;
  return `<article class="story people" id="story-${i}">
  <div class="caps">What someone does</div>
  <h3>${esc(s.title)}</h3>
  <p class="where">${esc(s.place)}</p>
  <p class="url"><a href="${href(s.url)}" rel="nofollow noopener">${esc(s.url)}</a></p>
  <p class="byline">Added by <a href="https://bsky.app/profile/${encodeURIComponent(s.did)}">@${esc(s.by)}</a>${when(s.createdAt) ? ", " + when(s.createdAt) : ""}. Not checked by the atlas.</p>${vouched}
  <div class="acts"><button type="button" class="show" data-i="${i}">Show on the map</button>${mine ? `<button type="button" class="remove" data-i="${i}">Remove</button>`
    : (iv ? `<button type="button" class="unvouch" data-d="${esc(s.did)}">Withdraw my vouch</button>` : `<button type="button" class="vouch" data-d="${esc(s.did)}">Vouch for @${esc(s.by)}</button>`) + `<button type="button" class="takedown" data-i="${i}">Request takedown</button>`}</div></article>`;
}
function renderCards() {
  el("stories").innerHTML = STORIES.map((s, i) => (s.gone ? "" : linkCard(s, i))).join("");
}
function applyFilters() {
  if (pins) pins.classed("off", s => !passes(s));
  if (ties) ties.classed("off", d => !passes(d[0]) || !passes(d[1]));
  document.querySelectorAll(".story").forEach(n => n.classList.toggle("off", !passes(STORIES[+n.id.slice(6)])));
  el("filters").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === fk));
}
// The filter buttons are rebuilt only when the list of them changes (signing in adds one).
function renderFilters() {
  const ks = fkinds(); if (!ks.some(([key]) => key === fk)) fk = "all";
  if (el("filters").dataset.ks !== ks.map(x => x[0]).join()) { el("filters").dataset.ks = ks.map(x => x[0]).join(); el("filters").innerHTML = ks.map(([key, l]) => `<button type="button" data-k="${key}">${l}</button>`).join(""); }
}
el("filters").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; fk = b.dataset.k; draw(); applyFilters(); });
// Everything on the page that depends on what people have added, redrawn together.
function refresh() { reindex(); renderFilters(); renderAccount(); renderCards(); renderConnections(); drawPins(); draw(); renderFollows(); notePeople(); }
function pinReadout(s) {
  const n = (IDX.by.get(s.did) || []).length;
  el("readout").innerHTML = `<h3>${esc(s.title)}</h3><p>${where(s)}</p><p>What @${esc(s.by)} does.${n ? ` Vouched for by ${countPeople(n)}.` : ""}</p>`;
}
function selectStory(i, scroll) {
  if (pins) pins.classed("sel", s => STORIES.indexOf(s) === i);
  document.querySelectorAll(".story").forEach(n => n.classList.toggle("sel", +n.id.slice(6) === i));
  if (i == null) return;
  if (scroll === "story") { if (!passes(STORIES[i])) { fk = "all"; draw(); applyFilters(); } el("story-" + i).scrollIntoView({ behavior: "smooth", block: "start" }); }
  if (scroll === "map") {
    const s = STORIES[i], want = s.scope;   // an entry belongs to the map it was placed on
    if (scopeKey !== want) return setScope(want).then(() => selectStory(i, "map"));
    if (featureOf(s.unit)) { picked = s.unit; draw(); pins.classed("sel", x => x === s); }
    document.querySelector(".mapbox").scrollIntoView({ behavior: "smooth", block: "center" }); pinReadout(s); }
}
// Vouch, withdraw and decline buttons work the same wherever they sit.
function vouchClick(e) {
  const v = e.target.closest("button.vouch"); if (v) return vouchFor(v.dataset.d), true;
  const u = e.target.closest("button.unvouch"); if (u) return unvouch(u.dataset.d), true;
  const d = e.target.closest("button.decline"); if (d) return decline(d.dataset.d), true;
  return false;
}
el("stories").addEventListener("click", e => {
  if (vouchClick(e)) return;
  const b = e.target.closest("button.show"); if (b) return selectStory(+b.dataset.i, "map");
  const r = e.target.closest("button.remove"); if (r) return removeMine(+r.dataset.i);
  const t = e.target.closest("button.takedown"); if (t) requestTakedown(+t.dataset.i);
});

// ---- map
function buildMap() {
  proj = S.projection(S.features); pathGen = d3.geoPath(proj);
  svg.call(zoom.transform, d3.zoomIdentity);
  shapes = gUnits.selectAll("path").data(S.features, f => scopeKey + ":" + S.idOf(f) + ":" + wkey(f)).join("path").attr("d", pathGen)
    .on("pointerenter", (e, f) => { if (e.pointerType === "mouse") hover(f); })
    .on("pointerleave", e => { if (e.pointerType === "mouse") hover(picked ? featureOf(picked) : null); })
    .on("click", (e, f) => { const id = S.idOf(f); if (!id) return; picked = picked === id ? null : id; selectStory(null); draw();
      // Someone in the middle of adding stays with the form; otherwise go to who is there.
      if (picked) el(state.ask && state.me ? "add" : "profile").scrollIntoView({ behavior: "smooth", block: "nearest" }); });
  gMesh.attr("d", S.mesh ? pathGen(S.mesh) : null);
  el("places").innerHTML = Object.values(S.names).sort((a, b) => a.localeCompare(b)).map(n => `<option value="${esc(n)}"></option>`).join("");
  el("placesearch").value = ""; el("placesearch").placeholder = `Find a ${S.unit}`;
  drawPins();
}
function drawPins() {
  const onThisMap = s => !s.gone && (scopeKey === "world" || s.scope === scopeKey);
  const vis = STORIES.filter(onThisMap).map(s => ({ s, p: proj([s.lon, s.lat]) })).filter(o => o.p && o.p[0] >= 0 && o.p[0] <= W && o.p[1] >= 0 && o.p[1] <= H);
  // A line from what someone does to what each person they vouch for does, when both are on this map.
  const mine = new Map();
  for (const { s } of vis) (mine.get(s.did) || mine.set(s.did, []).get(s.did)).push(s);
  const joins = [];
  for (const [did, vs] of IDX.from) for (const l of mine.get(did) || []) for (const v of vs) for (const m of mine.get(v.subject) || []) if (l.lon !== m.lon || l.lat !== m.lat) joins.push([l, m]);
  ties = gTies.selectAll("line").data(joins).join("line").attr("class", "tie")
    .attr("x1", d => proj([d[0].lon, d[0].lat])[0]).attr("y1", d => proj([d[0].lon, d[0].lat])[1])
    .attr("x2", d => proj([d[1].lon, d[1].lat])[0]).attr("y2", d => proj([d[1].lon, d[1].lat])[1]);
  const vn = s => (IDX.by.get(s.did) || []).length;
  pins = gPins.selectAll("g.pin").data(vis.map(o => o.s), s => s.key).join("g").attr("class", s => "pin people" + (vn(s) ? " vouched" : "")).attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", s => `What ${s.by} does: ${s.title}, ${s.place}${vn(s) ? `, vouched for by ${countPeople(vn(s))}` : ""}`).attr("transform", s => `translate(${proj([s.lon, s.lat])})`);
  pins.selectAll("*").remove();
  pinInner = pins.append("g").attr("transform", `scale(${1 / k})`);
  pinInner.filter(s => vn(s)).append("circle").attr("class", "ring").attr("r", 10);
  pinInner.append("circle").attr("class", "halo").attr("r", 5.5);
  pinInner.append("circle").attr("r", 16).attr("fill", "transparent");
  pins.on("click", (e, s) => selectStory(STORIES.indexOf(s), "story"))
    .on("keydown", (e, s) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectStory(STORIES.indexOf(s), "story"); } })
    .on("pointerenter", (e, s) => { if (e.pointerType === "mouse") pinReadout(s); });
  applyFilters();
}
// The country an entry stands in: its own unit on the world map, otherwise the country
// its county, district or region lies inside.
function countryOf(s) {
  if (s.scope === "world") return s.unit;
  if (s.country3 === undefined) { const w = SCOPES.world, f = w.features.find(x => d3.geoContains(x, [s.lon, s.lat])); s.country3 = (f && w.idOf(f)) || null; }
  return s.country3;
}
// How many entries stand in each unit of the map being shown. On the world map, something
// placed in a county or a district counts for its country.
function counts() {
  const n = new Map();
  for (const s of STORIES) {
    if (!passes(s)) continue;
    const id = s.scope === scopeKey ? s.unit : scopeKey === "world" ? countryOf(s) : null;
    if (id) n.set(id, (n.get(id) || 0) + 1);
  }
  return n;
}
let tally = new Map();
function hover(f) {
  const r = el("readout");
  if (!f || !S.idOf(f)) { r.textContent = `Pick a ${S.unit} to see who is there.`; return; }
  const n = tally.get(S.idOf(f)) || 0;
  r.textContent = `${nameOf(f)}: ${n ? (n === 1 ? "one here" : n + " here") : "nobody yet"}.`;
}
function draw() {
  tally = counts();
  shapes.attr("class", f => { const id = S.idOf(f), n = id ? tally.get(id) || 0 : 0; return "unit" + (id ? " can" : "") + (n >= 5 ? " n3" : n >= 2 ? " n2" : n ? " n1" : "") + (picked && picked === id ? " sel" : ""); });
  shapes.filter(f => picked && S.idOf(f) === picked).raise();
  // The buttons are made once and only their state changes: rebuilding them under a
  // click that began as the search box lost focus would swallow the click.
  el("scopes").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.s === scopeKey));
  el("swatches").innerHTML = `<span><i class="tint"></i>someone is here</span><span><i class="pinkey"></i>what someone does</span><span><i class="pinkey pv"></i>vouched for</span>${ties && ties.size() ? `<span><i class="tie"></i>vouches for</span>` : ""}`;
  hover(picked ? featureOf(picked) : null);
  profile();
}

// ---- one place: who is there
function profile() {
  const box = el("profile"), f = picked && featureOf(picked);
  if (!f) { box.innerHTML = `<h2>Who is here</h2><p>Pick a ${S.unit} on the map, or find one by name, to see who is there and to add yourself or vouch for someone.</p>`; return renderAdd(); }
  const there = STORIES.map((s, i) => [s, i]).filter(([s]) => !s.gone && ((s.scope === scopeKey && s.unit === picked) || (scopeKey === "world" && countryOf(s) === picked)));
  const open = scopeKey === "world" && OPENS(picked);
  box.innerHTML = `<h2>${esc(nameOf(f))}</h2>
    ${open ? `<p><button type="button" class="open" data-s="${open}">Open ${SCOPES[open].label} by ${SCOPES[open].unit}</button></p>` : ""}
    ${there.length ? `<ul class="here">` + there.map(([s, i]) => `<li><a href="#story-${i}" data-i="${i}"><i class="mark p"></i>${esc(s.title)}</a> <span>what @${esc(s.by)} does${IDX.by.has(s.did) ? ", vouched for by " + countPeople(IDX.by.get(s.did).length) : ""}${s.scope !== scopeKey ? ", in " + esc(s.place) : ""}</span></li>`).join("") + `</ul>`
      : `<p class="none">Nobody has added anything in this ${S.unit} yet. If you are here, you can be the first.</p>`}
    <p class="askhere"><button type="button" data-ask="do">Add what you do here</button> <button type="button" data-ask="who">Vouch for someone who is here</button></p>`;
  renderAdd();
}
el("profile").addEventListener("click", e => {
  const ask = e.target.closest(".askhere button"); if (ask) return openAsk(ask.dataset.ask);
  const o = e.target.closest("button.open"); if (o) return setScope(o.dataset.s);
  const a = e.target.closest("a[data-i]"); if (a) { e.preventDefault(); selectStory(+a.dataset.i, "story"); }
});
el("scopes").innerHTML = `<span class="caps">Map</span>` + Object.entries(SCOPES).map(([key, s]) => `<button type="button" data-s="${key}" aria-pressed="${key === scopeKey}">${s.label}<span class="by">, by ${s.unit}</span></button>`).join("");
el("scopes").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setScope(b.dataset.s); });
el("placesearch").addEventListener("change", e => {
  const want = e.target.value.trim().toLowerCase(); if (!want) return;
  const f = S.features.find(x => S.idOf(x) && nameOf(x).toLowerCase() === want) || S.features.find(x => S.idOf(x) && nameOf(x).toLowerCase().startsWith(want));
  if (!f) { el("readout").textContent = `No ${S.unit} by that name on this map.`; return; }
  picked = S.idOf(f); draw(); zoomTo(f);
});

async function setScope(key) {
  const T = SCOPES[key];
  if (!T.ready) {
    el("loading").hidden = false;
    try { Object.assign(T, T.build(await Promise.all(T.files.map(getJson)))); T.ready = true; }
    catch (err) { el("loading").textContent = "That map could not be loaded."; return; }
    el("loading").hidden = true;
  }
  scopeKey = key; S = T; picked = null;
  buildMap(); draw();
}

// ---- people: sign-in, adding a link, removing it, asking for one to be taken down.
// The records live in people's own atproto accounts; this site stores nothing.
// Sign-in follows the Library (../library/app.js).
const state = { client: null, session: null, agent: null, me: null, handle: null, authError: false, notice: "", busy: false, draft: "", errors: [], ask: null, vouchDraft: "", vouchErrors: [],
  follows: null, followsError: false, followsAll: false };   // follows: the accounts on the map that the signed-in person follows; null until asked
let people = { loaded: false, error: null, unreachable: 0, withheld: 0, unplaced: 0 };
// A link carries a unit id, never a place name, so the name is looked up here.
// A link whose unit this atlas doesn't have is not shown.
const unitNames = { world: SCOPES.world.names };
async function namesFor(scope) {
  if (!unitNames[scope]) unitNames[scope] = (async () => SCOPES[scope].names || await getJson(`data/${scope}.names.json`))().catch(() => ({}));
  return unitNames[scope];
}
async function display(e) {
  const name = (await namesFor(e.scope))[e.unit];
  return name ? { ...e, key: e.uri, by: e.handle || e.did, link: true, title: e.host, place: name, country: "" } : null;
}

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
    : state.authError ? `<span>Sign-in is unavailable right now. The map still works.</span>`
    : `<form id="signin"><label for="handle">Sign in with your atproto handle. A Bluesky handle is one.</label> <input id="handle" name="handle" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="you.bsky.social"> <button type="submit">Sign in</button></form>`;
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

// The two questions at the top of the page open this panel. Both need an account. A link
// also needs a place picked on the map; a vouch needs only the account it is for.
function openAsk(ask) { state.ask = ask; renderAdd(); el("add").scrollIntoView({ behavior: "smooth", block: "start" }); }
function renderAdd() {
  const box = el("addbox");
  el("contribute").hidden = !state.ask;
  document.querySelectorAll(".askbtn").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.ask === state.ask)));
  if (!state.ask || !state.me) { box.innerHTML = ""; return; }
  if (state.ask === "who") { box.innerHTML = vouchForm(); return; }
  const f = picked && featureOf(picked);
  if (!f) { box.innerHTML = `<p class="pick">Now pick a place on the map below. A country will do. Open the United States, India or Europe to pick a county, a district or a region.</p>`; return; }
  box.innerHTML = `<p class="placed">In <b>${esc(nameOf(f))}</b>. Pick another place on the map to change it.</p><form class="addform" id="addform" novalidate>
    <p class="warn">A link is a web address and this place, nothing else. It is public, saved in your own account under your handle. Add pages that are already public. Do not add one that locates a person who could be harmed by being found. Anyone signed in can ask for it to be taken down.</p>
    ${state.errors.length ? `<p class="errors" role="alert">${state.errors.map(esc).join(" ")}</p>` : ""}
    <div class="row"><label class="sr-only" for="addurl">Web address</label>
      <input id="addurl" name="url" inputmode="url" autocapitalize="none" spellcheck="false" placeholder="https://" maxlength="${A.MAX_URL}" value="${esc(state.draft)}">
      <button type="submit"${state.busy ? " disabled" : ""}>${state.busy ? "Saving" : "Add link"}</button></div>
  </form>`;
}
// A vouch is for an account that has added what it does here, and holds nothing else.
function vouchForm() {
  return `<form class="addform" id="vouchform" novalidate>
    <p class="warn">A vouch says that someone holds your world together. It can only be for someone who has added what they do here, so nobody is named on this map who has not put themselves on it. It holds their account and nothing else, and it is public under your handle. They can decline it.</p>
    ${state.vouchErrors.length ? `<p class="errors" role="alert">${state.vouchErrors.map(esc).join(" ")}</p>` : ""}
    <div class="row"><label class="sr-only" for="vouchsubject">Their handle</label>
      <input id="vouchsubject" name="subject" autocapitalize="none" spellcheck="false" placeholder="their.handle" maxlength="253" value="${esc(state.vouchDraft)}">
      <button type="submit"${state.busy ? " disabled" : ""}>${state.busy ? "Saving" : "Vouch"}</button></div>
    <p>Or use the Vouch button on anyone's entry, further down the page.</p>
  </form>`;
}
document.querySelectorAll(".askbtn").forEach(b => b.addEventListener("click", () => { state.ask = state.ask === b.dataset.ask ? null : b.dataset.ask; renderAdd(); }));
el("contribute").addEventListener("input", e => {
  const t = e.target;
  if (t.id === "addurl") state.draft = t.value;
  else if (t.id === "vouchsubject") state.vouchDraft = t.value;
});
el("contribute").addEventListener("submit", e => {
  if (e.target.id === "addform") { e.preventDefault(); addLink(); }
  if (e.target.id === "vouchform") { e.preventDefault(); addVouch(); }
});

// ---- people you follow: shown to someone signed in, with an invitation to vouch.
// Who they follow is asked of Bluesky's public service, about the accounts on this map only.
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
  if (state.followsError) { box.innerHTML = `<h2>People you follow</h2><p>Who you follow could not be checked right now. You can still vouch from anyone's entry, further down the page.</p>`; return; }
  const byDid = new Map();
  STORIES.forEach((s, i) => { if (!s.gone && state.follows.has(s.did)) (byDid.get(s.did) || byDid.set(s.did, []).get(s.did)).push([s, i]); });
  if (!byDid.size) { box.innerHTML = `<h2>People you follow</h2><p>Nobody you follow on Bluesky has added what they do yet.</p>`; return; }
  const rows = [...byDid], show = state.followsAll ? rows : rows.slice(0, 6);
  box.innerHTML = `<h2>People you follow are here</h2>
    <p>${rows.length === 1 ? "One person you follow has" : rows.length + " people you follow have"} added what they do. Do they hold your world together? A vouch is public, under your handle.</p>
    <ul class="flist">${show.map(([did, list]) => { const iv = (IDX.by.get(did) || []).some(v => v.did === state.me);
      return `<li><div>${profileLink(did)} <span>${list.map(([s, i]) => `<a href="#story-${i}" data-i="${i}">${esc(s.title)}</a> in ${esc(s.place)}`).join("; ")}</span></div>
        ${iv ? `<span class="done">You vouch for them.</span> <button type="button" class="link unvouch" data-d="${esc(did)}">Withdraw</button>` : `<button type="button" class="vouch" data-d="${esc(did)}">Vouch</button>`}</li>`; }).join("")}</ul>
    ${rows.length > show.length ? `<p><button type="button" class="link" id="followsall">Show all ${rows.length}</button></p>` : ""}`;
}
el("follows").addEventListener("click", e => {
  if (vouchClick(e)) return;
  if (e.target.id === "followsall") { state.followsAll = true; return renderFollows(); }
  const a = e.target.closest("a[data-i]"); if (a) { e.preventDefault(); selectStory(+a.dataset.i, "story"); }
});

// ---- vouching: one record in the voucher's account, pointing at the account vouched for
function needSignIn(why) { state.notice = why; state.ask = state.ask || "who"; renderAccount(); renderAdd(); el("add").scrollIntoView({ behavior: "smooth", block: "start" }); }
async function vouchFor(did) {
  if (!state.agent) return needSignIn("Sign in here to vouch.");
  if (did === state.me) { state.notice = "That is you."; return renderAccount(); }
  if (!onMap(did)) { state.notice = "A vouch can only be for someone who has added what they do here."; return renderAccount(); }
  if (VOUCHES.some(v => v.did === state.me && v.subject === did)) return;
  const built = A.buildVouch({ subject: did });
  if (!built.ok) { state.notice = built.errors.join(" "); return renderAccount(); }
  try {
    const res = await state.agent.com.atproto.repo.createRecord({ repo: state.me, collection: A.COL.vouch, record: built.record });
    VOUCHES.push({ did: state.me, handle: state.handle, subject: did, createdAt: built.record.createdAt, records: [{ uri: res.data.uri, rkey: res.data.uri.split("/").pop() }] });
    state.notice = `You vouch for @${handleOf(did)}. It is saved in your own account.`;
  } catch (err) { state.notice = `It could not be saved: ${err.message}`; }
  refresh();
}
// The form: a handle, turned into its account, which must already be on the map.
async function addVouch() {
  if (!state.agent || state.busy) return;
  const raw = state.vouchDraft.trim().replace(/^@/, "");
  state.busy = true; state.vouchErrors = []; renderAdd();
  try {
    const did = !raw ? "" : raw.startsWith("did:") ? raw : await resolveHandle(raw);
    if (!A.vouchSubject(did)) state.vouchErrors = ["Give the handle of someone who has added what they do."];
    else if (did === state.me) state.vouchErrors = ["That is you. Use the first question for your own work."];
    else if (!onMap(did)) state.vouchErrors = [`@${raw} has not added what they do here. A vouch can only be for someone who has.`];
    else { await vouchFor(did); state.vouchDraft = ""; }
  } catch (err) { state.vouchErrors = [`That handle could not be found: ${err.message}`]; }
  state.busy = false; renderAdd();
}
async function unvouch(did) {
  const v = VOUCHES.find(x => x.did === state.me && x.subject === did); if (!v || !state.agent) return;
  try {
    for (const r of v.records) await state.agent.com.atproto.repo.deleteRecord({ repo: state.me, collection: A.COL.vouch, rkey: r.rkey });
    VOUCHES = VOUCHES.filter(x => x !== v); state.notice = "Your vouch is withdrawn.";
  } catch (err) { state.notice = `It could not be withdrawn: ${err.message}`; }
  refresh();
}
// Whoever is vouched for can decline a vouch: a takedown request against each record behind it.
async function decline(voucher) {
  const v = VOUCHES.find(x => x.did === voucher && x.subject === state.me); if (!v || !state.agent) return;
  try {
    for (const r of v.records) { const built = A.buildTakedown(r.uri); if (built.ok) await state.agent.com.atproto.repo.createRecord({ repo: state.me, collection: A.COL.takedown, record: built.record }); }
    VOUCHES = VOUCHES.filter(x => x !== v); people.withheld += v.records.length; state.notice = "Declined. That vouch is no longer shown here.";
  } catch (err) { state.notice = `The request could not be saved: ${err.message}`; }
  refresh();
}

async function addLink() {
  const f = picked && featureOf(picked); if (!f || !state.agent || state.busy) return;
  const [lon, lat] = d3.geoCentroid(f), name = nameOf(f);
  const built = A.buildLink({ url: state.draft, scope: scopeKey, unit: picked, lat, lon });
  if (!built.ok) { state.errors = built.errors; return renderAdd(); }
  state.busy = true; state.errors = []; renderAdd();
  try {
    const res = await state.agent.com.atproto.repo.createRecord({ repo: state.me, collection: A.COL.link, record: built.record });
    const uri = res.data.uri, shown = await display({ ...A.parseLink(built.record), uri, rkey: uri.split("/").pop(), did: state.me, handle: state.handle });
    if (shown) STORIES.push(shown);
    state.draft = ""; state.busy = false; state.notice = `Link added to ${name}. It is saved in your own account.`;
    refresh();
  } catch (err) { state.busy = false; state.errors = [`It could not be saved: ${err.message}`]; renderAdd(); }
}
async function removeMine(i) {
  const s = STORIES[i]; if (!s || s.did !== state.me || !state.agent) return;
  try { await state.agent.com.atproto.repo.deleteRecord({ repo: state.me, collection: A.COL.link, rkey: s.rkey }); s.gone = true; state.notice = "Removed from your account and from the map."; }
  catch (err) { state.notice = `It could not be removed: ${err.message}`; }
  refresh();
}
// A takedown request is a record in the requester's account that points at the link.
// The page stops showing the link at once.
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
  const links = STORIES.filter(s => !s.gone).length;
  el("communitynote").textContent = !people.loaded ? "Looking for what people have added."
    : people.error ? "What people have added is not shown right now: the index that finds it, and the takedown requests against it, did not answer."
    : (links ? `${links} ${links === 1 ? "link" : "links"} to what people do. ${IDX.n} ${IDX.n === 1 ? "vouch" : "vouches"} between them.` : "Nobody has added anything yet. The first question at the top of the page is how to start.")
      + (people.withheld ? ` ${people.withheld} withheld after a takedown request.` : "")
      + (people.unreachable ? ` ${people.unreachable} could not be read from their authors' servers.` : "");
}
async function loadPeople() {
  notePeople();
  let hidden = {}; try { hidden = await getJson("hidden.json"); } catch {}
  const out = await A.loadCommunity({ backlinks, resolveDid, getRecord }, hidden);
  const have = new Set(STORIES.map(s => s.key));
  let unplaced = 0;
  for (const e of out.links) { if (have.has(e.uri)) continue; const shown = await display(e); if (shown) STORIES.push(shown); else unplaced++; }
  const mine = VOUCHES.filter(v => !out.vouches.some(o => v.records.some(r => r.uri === o.uri)));   // written here before the index answered
  VOUCHES = [...A.cleanVouches(out.vouches), ...mine];
  people = { loaded: true, error: out.error, unreachable: out.unreachable, withheld: out.withheld, unplaced };
  refresh(); loadFollows();
}

// ---- who vouches for whom: the connections between people, read off the vouches
function renderConnections() {
  el("connections").hidden = !IDX.from.size;
  el("connlist").innerHTML = [...IDX.from].sort((a, b) => b[1].length - a[1].length || handleOf(a[0]).localeCompare(handleOf(b[0]))).map(([did, vs]) =>
    `<li>${profileLink(did)} vouches for ${vs.map(v => { const i = STORIES.findIndex(s => !s.gone && s.did === v.subject), s = STORIES[i];
      return `<a href="#story-${i}" data-i="${i}">@${esc(handleOf(v.subject))}</a> <span>in ${esc(s.place)}</span>`; }).join(", ")}.</li>`).join("");
}
el("connlist").addEventListener("click", e => { const a = e.target.closest("a[data-i]"); if (a) { e.preventDefault(); selectStory(+a.dataset.i, "story"); } });

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
  "Everything here is something a person added. Nobody has checked any of it.",
  "It is public. A link or a vouch is a record in the account of whoever added it, under their handle, and anyone can read it there whether or not this page shows it.",
  "It is as full as the people who have found it. An empty place on the map says nothing about who is there.",
  "Adding, vouching and asking for a takedown all need an atproto account. Someone without one cannot do any of them here.",
  "A vouch can only be for an account that has added what it does here. Nobody is put on this map by someone else. Whoever is vouched for can decline a vouch and it comes off this page at once, though the record stays in the voucher's own account.",
  "Who you follow is read from Bluesky's public service, about the accounts on this map only. Follows kept anywhere else are not seen.",
  "The finest places are US counties, Indian districts and European regions. Elsewhere it is the country. There is no street map.",
  "What people have added is found through Constellation, an outside index of atproto records. When that does not answer, none of it is shown.",
];
const SOURCES = [
  ["Country shapes: Natural Earth, 1:110m, through the world-atlas package. Small island states are missing from the world map.", "https://github.com/topojson/world-atlas"],
  ["United States counties: US Census Bureau cartographic boundaries, through the us-atlas package", "https://github.com/topojson/us-atlas"],
  ["India districts: geoBoundaries (Open Database License 1.0)", "https://www.geoboundaries.org/"],
  ["Europe regions: Eurostat GISCO, NUTS 2021, level 2", "https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics"],
  ["The index that finds what people have added: Constellation", "https://constellation.microcosm.blue/"],
];
el("limits").innerHTML = LIMITS.map(t => `<li>${t}</li>`).join("");
el("sources").innerHTML = SOURCES.map(([t, u]) => `<li><a href="${u}">${t}</a></li>`).join("");
buildMap(); refresh();
initAuth().catch(() => { state.authError = true; renderAccount(); });
loadPeople();
loadPrior();
