// Atlas of Care: a map for finding each other.
//
// There is nothing on it but what people have added: a link to what they do in a place, or
// a vouch for an organisation or a person who holds their world together there. The map
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
// Every mark on the map, filled in once the index has been asked (loadPeople).
const STORIES = [];

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
const FKINDS = [["all", "Everything"], ["link", "What people do"], ["vouch", "Who people vouch for"]];
const where = s => esc(s.place);
const passes = s => !s.gone && (fk === "all" || (fk === "link" ? !!s.link : !!s.vouch));
const when = iso => { const d = iso && new Date(iso); return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""; };
// Everyone who vouches for the person behind a link, wherever they placed the vouch.
function vouchedFor(did) {
  const who = new Map();
  for (const v of STORIES) if (v.vouch && !v.gone && v.subject === did) for (const p of v.vouchers) who.set(p.did, p.handle || p.did);
  if (!who.size) return "";
  return `\n  <p class="byline">Vouched for by ${[...who].slice(0, 8).map(([d, h]) => `<a href="https://bsky.app/profile/${encodeURIComponent(d)}">@${esc(h)}</a>`).join(", ")}${who.size > 8 ? ` and ${who.size - 8} more` : ""}.</p>`;
}
// A link someone added: a web address and a place, nothing of their own wording.
function linkCard(s, i) {
  const mine = state.me && s.did === state.me;
  return `<article class="story people" id="story-${i}">
  <div class="caps">What someone does</div>
  <h3>${esc(s.title)}</h3>
  <p class="where">${esc(s.place)}</p>
  <p class="url"><a href="${href(s.url)}" rel="nofollow noopener">${esc(s.url)}</a></p>
  <p class="byline">Added by <a href="https://bsky.app/profile/${encodeURIComponent(s.did)}">@${esc(s.by)}</a>${when(s.createdAt) ? ", " + when(s.createdAt) : ""}. Not checked by the atlas.</p>${vouchedFor(s.did)}
  <div class="acts"><button type="button" class="show" data-i="${i}">Show on the map</button>${mine ? `<button type="button" class="remove" data-i="${i}">Remove</button>` : `<button type="button" class="takedown" data-i="${i}">Request takedown</button>`}</div></article>`;
}
// "Who holds your world together": one card for each organisation or person in each place,
// with everyone who vouched.
function vouchCard(s, i) {
  const n = s.vouchers.length, mine = state.me && s.vouchers.some(v => v.did === state.me);
  const who = s.vouchers.slice(0, 8).map(v => `<a href="https://bsky.app/profile/${encodeURIComponent(v.did)}">@${esc(v.handle || v.did)}</a>`).join(", ") + (n > 8 ? ` and ${n - 8} more` : "");
  return `<article class="story people" id="story-${i}">
  <div class="caps">Vouched for</div>
  <h3>${s.isAccount ? `<a href="https://bsky.app/profile/${encodeURIComponent(s.subject)}">${esc(s.title)}</a>` : esc(s.title)}</h3>
  <p class="where">${esc(s.place)}</p>
  ${s.isAccount ? "" : `<p class="url"><a href="${href(s.subject)}" rel="nofollow noopener">${esc(s.subject)}</a></p>`}
  <p class="byline">${n === 1 ? "One person says" : n + " people say"} this holds their world together: ${who}. Not checked by the atlas.</p>
  <div class="acts"><button type="button" class="show" data-i="${i}">Show on the map</button>${mine ? `<button type="button" class="remove" data-i="${i}">Withdraw my vouch</button>` : `<button type="button" class="vouchtoo" data-i="${i}">I vouch too</button>`}<button type="button" class="takedown" data-i="${i}">Request takedown</button></div></article>`;
}
function renderCards() {
  renderConnections();
  const order = STORIES.map((s, i) => i).filter(i => !STORIES[i].gone);
  el("stories").innerHTML = order.map(i => (STORIES[i].link ? linkCard(STORIES[i], i) : vouchCard(STORIES[i], i))).join("");
}
function applyFilters() {
  if (pins) pins.classed("off", s => !passes(s));
  if (ties) ties.classed("off", d => !passes(d[0]) || !passes(d[1]));
  document.querySelectorAll(".story").forEach(n => n.classList.toggle("off", !passes(STORIES[+n.id.slice(6)])));
  el("filters").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === fk));
}
el("filters").innerHTML = FKINDS.map(([key, l]) => `<button type="button" data-k="${key}" aria-pressed="${fk === key}">${l}</button>`).join("");
el("filters").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; fk = b.dataset.k; draw(); applyFilters(); });
function pinReadout(s) {
  const last = s.link ? "What @" + esc(s.by) + " does." : `Vouched for by ${s.vouchers.length === 1 ? "one person" : s.vouchers.length + " people"}.`;
  el("readout").innerHTML = `<h3>${esc(s.title)}</h3><p>${where(s)}</p><p>${last}</p>`;
}
function selectStory(i, scroll) {
  if (pins) pins.classed("sel", s => STORIES.indexOf(s) === i);
  document.querySelectorAll(".story").forEach(n => n.classList.toggle("sel", +n.id.slice(6) === i));
  if (i == null) return;
  if (scroll === "story") { if (!passes(STORIES[i])) { fk = "all"; applyFilters(); } el("story-" + i).scrollIntoView({ behavior: "smooth", block: "start" }); }
  if (scroll === "map") {
    const s = STORIES[i], want = s.scope;   // an entry belongs to the map it was placed on
    if (scopeKey !== want) return setScope(want).then(() => selectStory(i, "map"));
    if (featureOf(s.unit)) { picked = s.unit; draw(); pins.classed("sel", x => x === s); }
    document.querySelector(".mapbox").scrollIntoView({ behavior: "smooth", block: "center" }); pinReadout(s); }
}
el("stories").addEventListener("click", e => {
  const b = e.target.closest("button.show"); if (b) return selectStory(+b.dataset.i, "map");
  const r = e.target.closest("button.remove"); if (r) return removeMine(+r.dataset.i);
  const v = e.target.closest("button.vouchtoo"); if (v) return vouchToo(+v.dataset.i);
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
  const onMap = s => !s.gone && (scopeKey === "world" || s.scope === scopeKey);
  const vis = STORIES.filter(onMap).map(s => ({ s, p: proj([s.lon, s.lat]) })).filter(o => o.p && o.p[0] >= 0 && o.p[0] <= W && o.p[1] >= 0 && o.p[1] <= H);
  // A line from what someone does to whoever they vouch for, when both are on this map.
  const shown = new Set(vis.map(o => o.s)), mine = new Map();
  for (const s of shown) if (s.link) { if (!mine.has(s.did)) mine.set(s.did, []); mine.get(s.did).push(s); }
  const joins = [];
  for (const v of shown) if (v.vouch) for (const p of v.vouchers) for (const l of mine.get(p.did) || []) if (l.lon !== v.lon || l.lat !== v.lat) joins.push([l, v]);
  ties = gTies.selectAll("line").data(joins).join("line").attr("class", "tie")
    .attr("x1", d => proj([d[0].lon, d[0].lat])[0]).attr("y1", d => proj([d[0].lon, d[0].lat])[1])
    .attr("x2", d => proj([d[1].lon, d[1].lat])[0]).attr("y2", d => proj([d[1].lon, d[1].lat])[1]);
  pins = gPins.selectAll("g.pin").data(vis.map(o => o.s), s => s.key).join("g").attr("class", s => "pin people" + (s.vouch ? " vouch" : "")).attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", s => (s.link ? `What ${s.by} does: ${s.title}, ${s.place}` : `${s.title}, ${s.place}, vouched for by ${s.vouchers.length}`)).attr("transform", s => `translate(${proj([s.lon, s.lat])})`);
  pins.selectAll("*").remove();
  pinInner = pins.append("g").attr("transform", `scale(${1 / k})`);
  pinInner.filter(s => s.link).append("circle").attr("class", "halo").attr("r", 5.5);
  pinInner.filter(s => s.vouch).append("rect").attr("class", "halo").attr("x", -5).attr("y", -5).attr("width", 10).attr("height", 10);
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
  el("swatches").innerHTML = `<span><i class="tint"></i>someone is here</span><span><i class="pinkey p"></i>what someone does</span><span><i class="pinkey pv"></i>someone vouched for</span>${ties && ties.size() ? `<span><i class="tie"></i>vouches for</span>` : ""}`;
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
    ${there.length ? `<ul class="here">` + there.map(([s, i]) => `<li><a href="#story-${i}" data-i="${i}"><i class="mark ${s.link ? "p" : "pv"}"></i>${esc(s.title)}</a> <span>${s.link ? "what @" + esc(s.by) + " does" : `vouched for by ${s.vouchers.length === 1 ? "one person" : s.vouchers.length + " people"}`}${s.scope !== scopeKey ? ", in " + esc(s.place) : ""}</span></li>`).join("") + `</ul>`
      : `<p class="none">Nobody has added anything in this ${S.unit} yet. If you are here, or you know who holds it together, you can be the first.</p>`}
    <p class="askhere"><button type="button" data-ask="do">Add what you do here</button> <button type="button" data-ask="who">Vouch for who holds it together</button></p>`;
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
const state = { client: null, session: null, agent: null, me: null, handle: null, authError: false, notice: "", busy: false, draft: "", errors: [], ask: null, vouchDraft: "", vouchErrors: [] };
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
// One entry for everyone who vouched for the same organisation or person in the same place.
async function displayVouch(g) {
  const name = (await namesFor(g.scope))[g.unit]; if (!name) return null;
  let title = g.isAccount ? g.subject : A.hostOf(g.subject);
  if (g.isAccount) { try { const id = await resolveDid(g.subject); if (id.handle) title = "@" + id.handle; } catch {} }
  return { ...g, vouch: true, by: g.vouchers[0].handle || g.vouchers[0].did, title, place: name, country: "" };
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
  if (session) resolveDid(session.did).then(id => { state.handle = id.handle; renderAccount(); }).catch(() => {});
  renderAccount(); renderCards(); applyFilters(); renderAdd();
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

// The two questions at the top of the page open this panel. It needs three things in order:
// an account, a place picked on the map, and then the link, case study or vouch itself.
function openAsk(ask) { state.ask = ask; renderAdd(); el("add").scrollIntoView({ behavior: "smooth", block: "start" }); }
function renderAdd() {
  const box = el("addbox");
  el("contribute").hidden = !state.ask;
  document.querySelectorAll(".askbtn").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.ask === state.ask)));
  if (!state.ask || !state.me) { box.innerHTML = ""; return; }
  const f = picked && featureOf(picked);
  if (!f) { box.innerHTML = `<p class="pick">Now pick a place on the map below. A country will do. Open the United States, India or Europe to pick a county, a district or a region.</p>`; return; }
  const name = nameOf(f), placed = `<p class="placed">In <b>${esc(name)}</b>. Pick another place on the map to change it.</p>`;
  if (state.ask === "who") { box.innerHTML = placed + vouchForm(); return; }
  box.innerHTML = placed + `<form class="addform" id="addform" novalidate>
    <p class="warn">A link is a web address and this place, nothing else. It is public, saved in your own account under your handle. Add pages that are already public. Do not add one that locates a person who could be harmed by being found. Anyone signed in can ask for it to be taken down.</p>
    ${state.errors.length ? `<p class="errors" role="alert">${state.errors.map(esc).join(" ")}</p>` : ""}
    <div class="row"><label class="sr-only" for="addurl">Web address</label>
      <input id="addurl" name="url" inputmode="url" autocapitalize="none" spellcheck="false" placeholder="https://" maxlength="${A.MAX_URL}" value="${esc(state.draft)}">
      <button type="submit"${state.busy ? " disabled" : ""}>${state.busy ? "Saving" : "Add link"}</button></div>
  </form>`;
}
// A vouch: their atproto handle or their web address, and the place. Nothing of the voucher's own wording.
function vouchForm() {
  return `<form class="addform" id="vouchform" novalidate>
    <p class="warn">A vouch says that an organisation or a person holds your world together in this place. It holds their atproto handle or their web address and the place, nothing else, and it is public under your handle. Vouch only for people and groups whose work is already public. They, or anyone signed in, can ask for it to be taken down, and it comes off at once.</p>
    ${state.vouchErrors.length ? `<p class="errors" role="alert">${state.vouchErrors.map(esc).join(" ")}</p>` : ""}
    <div class="row"><label class="sr-only" for="vouchsubject">Their handle or web address</label>
      <input id="vouchsubject" name="subject" autocapitalize="none" spellcheck="false" placeholder="their.handle or https://" maxlength="${A.MAX_URL}" value="${esc(state.vouchDraft)}">
      <button type="submit"${state.busy ? " disabled" : ""}>${state.busy ? "Saving" : "Vouch"}</button></div>
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

// Put one vouch on the page: into the entry for that one in that place, or a new entry.
async function showVouch(v) {
  const key = `vouch:${v.subject}|${v.scope}|${v.unit}`, have = STORIES.find(s => s.key === key && !s.gone);
  if (have) { if (!have.vouchers.some(x => x.did === v.did)) have.vouchers.push({ did: v.did, handle: v.handle, uri: v.uri, rkey: v.rkey }); return have; }
  const shown = await displayVouch(A.groupVouches([v])[0]);
  if (shown) STORIES.push(shown);
  return shown;
}
async function writeVouch(input) {
  const built = A.buildVouch(input);
  if (!built.ok) return built;
  const res = await state.agent.com.atproto.repo.createRecord({ repo: state.me, collection: A.COL.vouch, record: built.record });
  const uri = res.data.uri;
  await showVouch({ ...A.parseVouch(built.record), uri, rkey: uri.split("/").pop(), did: state.me, handle: state.handle });
  return built;
}
async function addVouch() {
  const f = picked && featureOf(picked); if (!f || !state.agent || state.busy) return;
  const [lon, lat] = d3.geoCentroid(f), name = nameOf(f), raw = state.vouchDraft.trim();
  state.busy = true; state.vouchErrors = []; renderAdd();
  try {
    // A web address is kept as it is. Anything else is read as a handle and turned into its account.
    const subject = /^https?:\/\//i.test(raw) ? raw : raw.startsWith("did:") ? raw : raw ? await resolveHandle(raw.replace(/^@/, "")) : "";
    if (subject === state.me) throw new Error("That is you. Use the first question for your own work.");
    const built = await writeVouch({ subject, scope: scopeKey, unit: picked, lat, lon });
    if (!built.ok) { state.vouchErrors = built.errors; }
    else { state.vouchDraft = ""; state.notice = `Vouch added in ${name}. It is saved in your own account.`; }
  } catch (err) { state.vouchErrors = [/^That is you/.test(err.message) ? err.message : `It could not be saved: ${err.message}`]; }
  state.busy = false; renderAccount(); renderCards(); drawPins(); draw(); notePeople();
}
async function vouchToo(i) {
  const s = STORIES[i]; if (!s?.vouch) return;
  if (!state.agent) { state.notice = "Sign in here to vouch."; state.ask = "who"; renderAccount(); renderAdd(); return el("add").scrollIntoView({ behavior: "smooth", block: "start" }); }
  if (s.subject === state.me) { state.notice = "That is you."; return renderAccount(); }
  try { await writeVouch({ subject: s.subject, scope: s.scope, unit: s.unit, lat: s.lat, lon: s.lon }); state.notice = "Your vouch is added. It is saved in your own account."; }
  catch (err) { state.notice = `It could not be saved: ${err.message}`; }
  renderAccount(); renderCards(); drawPins(); draw(); notePeople();
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
    renderAccount(); renderCards(); drawPins(); draw(); notePeople();
  } catch (err) { state.busy = false; state.errors = [`It could not be saved: ${err.message}`]; renderAdd(); }
}
async function removeMine(i) {
  const s = STORIES[i]; if (!s?.by || !state.agent) return;
  try {
    if (s.vouch) {   // withdraw my own vouch; other people's stay
      for (const v of s.vouchers.filter(v => v.did === state.me)) await state.agent.com.atproto.repo.deleteRecord({ repo: state.me, collection: A.COL.vouch, rkey: v.rkey });
      s.vouchers = s.vouchers.filter(v => v.did !== state.me); if (!s.vouchers.length) s.gone = true;
      state.notice = "Your vouch is withdrawn.";
    } else {
      if (s.did !== state.me) return;
      await state.agent.com.atproto.repo.deleteRecord({ repo: state.me, collection: A.COL.link, rkey: s.rkey }); s.gone = true; state.notice = "Removed from your account and from the map.";
    }
  } catch (err) { state.notice = `It could not be removed: ${err.message}`; }
  renderAccount(); renderCards(); drawPins(); draw(); notePeople();
}
// A takedown request is a record in the requester's account that points at the link.
// The page stops showing the link at once.
async function requestTakedown(i) {
  const s = STORIES[i]; if (!s?.by) return;
  if (!state.agent) { state.notice = "Sign in here to ask for this to be taken down."; state.ask = state.ask || "do"; renderAccount(); renderAdd(); return el("add").scrollIntoView({ behavior: "smooth", block: "start" }); }
  // A vouch entry stands for one record per voucher, so each of them is asked to come down.
  const uris = s.vouch ? s.vouchers.map(v => v.uri) : [s.uri];
  try {
    for (const uri of uris) { const built = A.buildTakedown(uri); if (built.ok) await state.agent.com.atproto.repo.createRecord({ repo: state.me, collection: A.COL.takedown, record: built.record }); }
    s.gone = true; people.withheld += uris.length; state.notice = "Takedown requested. It is no longer shown here.";
  } catch (err) { state.notice = `The request could not be saved: ${err.message}`; }
  renderAccount(); renderCards(); drawPins(); draw(); notePeople();
}
function notePeople() {
  const links = STORIES.filter(s => s.link && !s.gone).length, vouched = STORIES.filter(s => s.vouch && !s.gone).length;
  el("communitynote").textContent = !people.loaded ? "Looking for what people have added."
    : people.error ? "What people have added is not shown right now: the index that finds it, and the takedown requests against it, did not answer."
    : (links || vouched ? `${links} ${links === 1 ? "link" : "links"} to what people do. ${vouched} vouched for.` : "Nobody has added anything yet. The two questions at the top of the page are how to start.")
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
  for (const g of A.groupVouches(out.vouches)) { if (have.has(g.key)) continue; const shown = await displayVouch(g); if (shown) STORIES.push(shown); else unplaced++; }
  people = { loaded: true, error: out.error, unreachable: out.unreachable, withheld: out.withheld, unplaced };
  notePeople(); renderCards(); drawPins(); draw();
}

// ---- who vouches for whom: the connections between people, read off the vouches
function renderConnections() {
  const by = new Map();
  for (const s of STORIES) if (s.vouch && !s.gone) for (const v of s.vouchers) {
    if (!by.has(v.did)) by.set(v.did, { label: v.handle || v.did, did: v.did, to: [] });
    by.get(v.did).to.push(s);
  }
  el("connections").hidden = !by.size;
  el("connlist").innerHTML = [...by.values()].sort((a, b) => b.to.length - a.to.length || a.label.localeCompare(b.label)).map(p =>
    `<li><a href="https://bsky.app/profile/${encodeURIComponent(p.did)}">@${esc(p.label)}</a> vouches for ` + p.to.map(s =>
      (s.isAccount ? `<a href="https://bsky.app/profile/${encodeURIComponent(s.subject)}">${esc(s.title)}</a>` : `<a href="${href(s.subject)}" rel="nofollow noopener">${esc(s.title)}</a>`) + ` <span>in ${esc(s.place)}</span>`).join(", ") + `.</li>`).join("");
}

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
  "A vouch puts an organisation or a person on a map without asking them. It can only point at a public account or a web address, it sits in a county or a district and never at an address, and it comes off as soon as anyone signed in asks.",
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
renderCards(); buildMap(); draw();
renderAccount();
initAuth().catch(() => { state.authError = true; renderAccount(); });
loadPeople();
loadPrior();
