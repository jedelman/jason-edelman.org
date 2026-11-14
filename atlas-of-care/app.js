// Atlas of Care: the map, the layers, the place profile, and what people add.
// The rules for what people add (a link, or a takedown request) are in atlas.js. Sign-in and the backlink index reuse
// the Library's code and its vendored SDK (../library/), so this folder depends on that one.
import * as A from "./atlas.js";
import { backlinks, resolveDid, getRecord, HANDLE_RESOLVER } from "../library/lib.js";

const here = p => new URL(p, import.meta.url).href;
const getJson = p => fetch(here(p)).then(r => { if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); });
let DATA, WORLD, SOURCED;
try { [DATA, WORLD, SOURCED] = await Promise.all([getJson("data/world.values.json"), getJson("data/world.topo.json"), getJson("data/entries.json")]); }
catch (err) { document.getElementById("finding").textContent = "The atlas could not load its data. Try again in a moment."; throw err; }
// Every mark on the map: the sourced entries first, then the links people have added.
const STORIES = SOURCED.map((s, i) => ({ ...s, key: "src:" + i }));

const el = id => document.getElementById(id);
const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const href = u => (/^https?:\/\//.test(u || "") ? esc(u) : "#");
const fmt = (v, d = 1) => Number(v).toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d });
const WL = DATA.layers, C = DATA.countries;
const wcount = (k, test) => Object.values(WL[k]).filter(test).length;
const wsize = k => Object.keys(WL[k]).length;
const wyears = k => { const y = Object.values(WL[k]).map(d => d.y); return [Math.min(...y), Math.max(...y)]; };
const fam = Object.values(WL.family).reduce((a, d) => [a[0] + d.n, a[1] + d.nf], [0, 0]);
const sub3 = Object.entries(WL.subsistence).sort((a, b) => b[1].v - a[1].v).slice(0, 3);

// Groups, in order of how soon it is felt when the work stops.
const GROUPS = [
  ["life", "How long people live", "The sum of everything below"],
  ["birth", "Birth and the first year", "Felt within hours"],
  ["care", "Daily care and unpaid work", "Felt within days"],
  ["food", "Food and water", "Felt within days to weeks"],
  ["disease", "Health care within reach", "Felt within a season"],
  ["land", "Land and other species", "Felt over years"],
];
const pc = (lo, hi) => [`under ${lo[0]}%`, ...lo.slice(1).map((v, i) => `${lo[i]} to ${v}%`), `${hi}% and over`];
const WORLD_LAYERS = [
  { id: "life", group: "life", name: "Life expectancy", order: "low",
    finding: `A child born in ${wcount("life", d => d.v < 65)} of ${wsize("life")} countries and territories can expect fewer than 65 years. In ${wcount("life", d => d.v >= 80)}, 80 or more.`,
    measure: "Average years a newborn would live at current death rates.",
    cuts: [60, 68, 75, 80], labels: ["under 60", "60 to 68", "68 to 75", "75 to 80", "80 and over"], val: d => fmt(d.v) + " years", scaleMax: 90,
    read: d => `Years, in ${d.y}.`, rank: "Where lives are shortest", src: "UN World Population Prospects and others, as processed by Our World in Data. 2023." },
  { id: "births", group: "birth", name: "A trained hand at the birth", order: "low",
    finding: `In ${wcount("births", d => d.v < 80)} of ${wsize("births")} countries, fewer than 80 of every 100 births have a skilled attendant.`,
    measure: "Share of births attended by skilled health staff, from the latest survey since 2005.",
    cuts: [50, 70, 90, 98], labels: pc([50, 70, 90, 98], 98), val: d => fmt(d.v) + "%", scaleMax: 100,
    read: d => `Of births. Survey year ${d.y}.`, rank: "Where the fewest births are attended",
    src: `Demographic and Health Surveys and UNICEF, via the World Bank, as processed by Our World in Data. Survey years ${wyears("births").join(" to ")}.` },
  { id: "dtp3", group: "birth", name: "Vaccinated by age one", order: "low",
    finding: `In ${wcount("dtp3", d => d.v < 80)} of ${wsize("dtp3")} countries, fewer than 80 of every 100 one-year-olds have had their three doses against diphtheria, tetanus and whooping cough.`,
    measure: "Share of one-year-olds with three doses of the combined diphtheria, tetanus and pertussis vaccine. Every new child needs the doses, so this figure has to be earned again each year.",
    cuts: [60, 80, 90, 95], labels: pc([60, 80, 90, 95], 95), val: d => fmt(d.v, 0) + "%", scaleMax: 100,
    read: d => `Of one-year-olds, in ${d.y}.`, rank: "Where the fewest children are reached",
    src: `WHO and UNICEF estimates of national immunisation coverage, as processed by Our World in Data. ${wyears("dtp3")[1]}.` },
  { id: "hours", group: "care", name: "Unpaid work at home", gendered: true, order: "high",
    finding: `In ${wcount("hours", d => d.v >= 2)} of ${wsize("hours")} countries with a survey, women do at least twice the unpaid housework and care that men do. In ${wcount("hours", d => d.v >= 3)}, three times.`,
    measure: "Hours a day women spend on unpaid domestic and care work for each hour men spend. People aged 15 and over, from national time-use surveys.",
    cuts: [1.5, 2, 3, 5], labels: ["under 1.5", "1.5 to 2", "2 to 3", "3 to 5", "5 and over"], val: d => fmt(d.v, 2) + " to 1", f: d => fmt(d.f, 2) + " h", m: d => fmt(d.m, 2) + " h", scaleMax: 6,
    read: d => `Women ${fmt(d.f, 2)} hours a day, men ${fmt(d.m, 2)}. Survey year ${d.y}.`, rank: "Where the split is widest",
    src: `UN Statistics Division and UN Women, SDG indicator 5.4.1, as processed by Our World in Data. Survey years ${wyears("hours").join(" to ")}.` },
  { id: "carers", group: "care", name: "Out of paid work to care", gendered: true, order: "high",
    finding: `In ${wcount("carers", d => d.f > d.m)} of ${wsize("carers")} countries, more of the women outside the labour force than of the men are there because someone needs looking after.`,
    measure: "Share of women outside the labour force who give care responsibilities as the reason. Countries word this survey question differently, so compare neighbours with caution.",
    cuts: [10, 25, 50, 70], labels: pc([10, 25, 50, 70], 70), val: d => fmt(d.v) + "%", f: d => fmt(d.f) + "%", m: d => fmt(d.m) + "%", scaleMax: 90,
    read: d => `Women ${fmt(d.f)}%, men ${fmt(d.m)}%. Survey year ${d.y}.`, rank: "Where care keeps the most women out of paid work",
    src: `International Labour Organization, share of persons outside the labour force due to care responsibilities by sex. Survey years ${wyears("carers").join(" to ")}.` },
  { id: "family", group: "care", name: "Unpaid in the family farm or shop", gendered: true, order: "high",
    finding: `About ${Math.round(fam[0] / 1000)} million people work without pay in a relative's farm or business. About ${Math.round(fam[1] / 1000)} million of them are women.`,
    measure: "Contributing family workers as a share of all employed women. A model's estimate, not a count.",
    cuts: [2, 10, 25, 50], labels: pc([2, 10, 25, 50], 50), val: d => fmt(d.v) + "%", f: d => fmt(d.f) + "%", m: d => fmt(d.m) + "%", scaleMax: 75,
    read: d => `${fmt(d.f)}% of employed women and ${fmt(d.m)}% of employed men, about ${d.n >= 1000 ? fmt(d.n / 1000, 1) + " million" : fmt(d.n, 0) + " thousand"} people. Estimate for ${d.y}.`, rank: "Where the share of women is highest",
    src: "International Labour Organization, employment by sex and status in employment, modelled estimates, November 2025 edition, for 2024." },
  { id: "subsistence", group: "food", name: "Food grown to eat, not to sell", gendered: true, order: "high",
    finding: `In ${C[sub3[0][0]].n}, ${Math.round(sub3[0][1].v)} of every 100 working-age people grow food for their own household. In ${C[sub3[1][0]].n}, ${Math.round(sub3[1][1].v)}. In ${C[sub3[2][0]].n}, ${Math.round(sub3[2][1].v)}.`,
    measure: `Subsistence foodstuff producers as a share of the working-age population. Women's rate is the higher one in ${wcount("subsistence", d => d.f > d.m)} of ${wsize("subsistence")} countries.`,
    cuts: [5, 15, 30, 50], labels: pc([5, 15, 30, 50], 50), val: d => fmt(d.v) + "%", f: d => fmt(d.f) + "%", m: d => fmt(d.m) + "%", scaleMax: 85,
    read: d => `Women ${fmt(d.f)}%, men ${fmt(d.m)}%. Survey year ${d.y}.`, rank: "Where the most people feed their own households",
    src: `International Labour Organization, subsistence foodstuff production rate by sex, from the DBnomics copy indexed in February 2024. Survey years ${wyears("subsistence").join(" to ")}.` },
  { id: "nets", group: "disease", name: "Children under a treated net", order: "high",
    finding: `In ${wcount("nets", d => d.v >= 50)} of ${wsize("nets")} countries with a survey, at least half of the children under five sleep under an insecticide-treated net.`,
    measure: "Share of children under five who slept under an insecticide-treated bed net, from the latest survey since 2005. Countries without malaria are not surveyed. A net wears out and has to be replaced.",
    cuts: [10, 25, 50, 70], labels: pc([10, 25, 50, 70], 70), val: d => fmt(d.v) + "%", scaleMax: 100,
    read: d => `Of children under five. Survey year ${d.y}.`, rank: "Where the most children sleep under a net",
    src: `Demographic and Health Surveys and UNICEF, via the World Bank, as processed by Our World in Data. Survey years ${wyears("nets").join(" to ")}.` },
  { id: "contra", group: "disease", name: "Modern contraception in use", order: "low",
    finding: `In ${wcount("contra", d => d.v < 25)} of ${wsize("contra")} countries, fewer than one in four married women uses a modern method of contraception.`,
    measure: "Share of married or in-union women aged 15 to 49 using any modern method, from the latest survey since 2005. Unmarried women are not counted.",
    cuts: [15, 30, 45, 60], labels: pc([15, 30, 45, 60], 60), val: d => fmt(d.v) + "%", scaleMax: 85,
    read: d => `Of married women aged 15 to 49. Survey year ${d.y}.`, rank: "Where the fewest women use a modern method",
    src: `Demographic and Health Surveys, Multiple Indicator Cluster Surveys and the UN Population Division, via the World Bank, as processed by Our World in Data. Survey years ${wyears("contra").join(" to ")}.` },
  { id: "protected", group: "land", name: "Land under protection", order: "high",
    finding: `${wcount("protected", d => d.v >= 30)} of ${wsize("protected")} countries and territories have put at least 30% of their land under protection. ${wcount("protected", d => d.v < 10)} have protected less than 10%.`,
    measure: "Share of land area inside a designated protected or conserved area. A designation is a line on a map. It does not say whether anyone is there to keep it.",
    cuts: [5, 10, 20, 30], labels: pc([5, 10, 20, 30], 30), val: d => fmt(d.v) + "%", scaleMax: 70,
    read: d => `Of land area, in ${d.y}.`, rank: "Where the most land is designated",
    src: `Protected Planet (UNEP-WCMC and IUCN), via the World Bank, as processed by Our World in Data. ${wyears("protected")[1]}.` },
];

const W = 980, H = 520;
const byNum = {}; for (const [a3, m] of Object.entries(C)) byNum[m.id] = a3;
const EUROPE = new Set("AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE NOR CHE ISL".split(" "));
const SCOPES = {
  world: { label: "World", units: "countries", unit: "country", ready: true,
    features: topojson.feature(WORLD, WORLD.objects.countries).features.filter(f => f.id !== "010"),
    idOf: f => byNum[f.id], nameOf: f => (byNum[f.id] && C[byNum[f.id]].n) || f.properties.name, layers: WORLD_LAYERS,
    get: (L, id) => WL[L.id][id], ids: L => Object.keys(WL[L.id]),
    projection: fs => d3.geoEqualEarth().fitExtent([[6, 6], [W - 6, H - 6]], { type: "FeatureCollection", features: fs }) },
  us: { label: "United States", units: "counties", unit: "county", files: ["data/us.topo.json", "data/us.values.json"],
    build: ([t, v]) => ({ features: topojson.feature(t, t.objects.counties).features, mesh: topojson.mesh(t, t.objects.states, (a, b) => a !== b), pack: v }),
    keep: s => s.country === "United States", idOf: f => f.id, projection: fs => d3.geoAlbersUsa().fitExtent([[10, 10], [W - 10, H - 10]], { type: "FeatureCollection", features: fs }) },
  in: { label: "India", units: "districts", unit: "district", files: ["data/in.geo.json", "data/in.values.json"],
    build: ([g, v]) => ({ features: g.features, pack: v }),
    keep: s => s.country === "India", idOf: f => f.id, projection: fs => d3.geoMercator().fitExtent([[10, 10], [W - 10, H - 10]], { type: "FeatureCollection", features: fs }) },
  eu: { label: "Europe", units: "regions", unit: "region", files: ["data/eu.topo.json", "data/eu.values.json"],
    build: ([t, v]) => ({ features: topojson.feature(t, t.objects[Object.keys(t.objects)[0]]).features.map(f => (f.id = f.properties.NUTS_ID, f)), pack: v }),
    idOf: f => f.id, projection: () => d3.geoConicConformal().rotate([-12, 0]).parallels([40, 62]).fitExtent([[10, 10], [W - 10, H - 10]],
      { type: "MultiPoint", coordinates: [[-24, 64], [-10, 36], [34, 35], [32, 70], [10, 71]] }),
    keep: s => /^(Spain|United Kingdom|Netherlands|France|Germany|Italy|Portugal|Ireland|Belgium|Austria|Switzerland|Norway|Sweden|Finland|Denmark|Poland|Czechia|Greece|Hungary|Romania|Bulgaria|Croatia|Iceland|Türkiye|Turkey)$/.test(s.country) },
};
const OPENS = a3 => (a3 === "USA" ? "us" : a3 === "IND" ? "in" : EUROPE.has(a3) ? "eu" : null);

function adoptPack(S, built) {
  Object.assign(S, built);
  const P = S.pack, idx = {};
  S.layers = P.layers.map((L, i) => {
    idx[L.id] = i;
    const f = v => fmt(v, L.dec) + L.unit, bare = v => fmt(v, L.dec);
    const ids = Object.keys(P.values).filter(id => P.values[id][i] != null);
    return { ...L, i, ids, val: d => f(d.v), scaleMax: L.max, order: "high",
      labels: [`under ${bare(L.cuts[0])}`, ...[1, 2, 3].map(j => `${bare(L.cuts[j - 1])} to ${bare(L.cuts[j])}`), `${bare(L.cuts[3])} and over`],
      finding: `${L.name}: from ${f(L.min)} to ${f(L.max)} across ${L.n.toLocaleString("en")} ${S.units}.`,
      read: () => L.measure, rank: `${L.name}: the highest`, src: L.src + "." };
  });
  S.get = (L, id) => { const r = P.values[id]; return r && r[L.i] != null ? { v: r[L.i] } : undefined; };
  S.ids = L => L.ids;
  S.nameOf = f => P.names[S.idOf(f)] || (f.properties && (f.properties.name || f.properties.NAME_LATN)) || "Unnamed";
  S.ready = true;
}

const svg = d3.select("#map");
const g = svg.append("g"), gUnits = g.append("g"), gMesh = g.append("path").attr("fill", "none").attr("class", "mesh"), gPins = g.append("g");
let scopeKey = "world", S = SCOPES.world, layer = S.layers[0], picked = null, proj, pathGen, shapes, pins, pinInner, k = 1;
let fg = "all", fm = "all";
const zoom = d3.zoom().scaleExtent([1, 14]).translateExtent([[0, 0], [W, H]])
  .filter(e => (e.type === "wheel" ? e.ctrlKey || k > 1 : e.touches ? e.touches.length > 1 || k > 1 : !e.button))
  .on("zoom", e => { k = e.transform.k; g.attr("transform", e.transform); if (pinInner) pinInner.attr("transform", `scale(${1 / k})`);
    svg.style("touch-action", k > 1 ? "none" : "pan-y"); });
svg.call(zoom).on("dblclick.zoom", null);
d3.select("#zin").on("click", () => svg.transition().duration(200).call(zoom.scaleBy, 1.8));
d3.select("#zout").on("click", () => svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.8));

const bin = (L, v) => L.cuts.filter(c => v >= c).length;
const featureOf = id => S.features.find(f => S.idOf(f) === id);

// ---- entries (stories and interventions)
const DOMAIN = { farming: "Farming and seed", care: "Care", commons: "Shared water, forest and land", kitchen: "Kitchens and mutual aid",
  wetland: "Wetlands, mangroves and reefs", trees: "Trees and regrowth", land: "Land and fire", species: "Species",
  vector: "Vector control", vaccine: "Vaccination", eradication: "Eradication",
  abortion: "Abortion care", contraception: "Contraception", birth: "Birth and newborn care", repair: "Repair" };
const GROUP_OF = { farming: "tending", care: "tending", commons: "tending", kitchen: "tending", wetland: "land", trees: "land", land: "land", species: "species",
  vector: "disease", vaccine: "disease", eradication: "disease", abortion: "repro", contraception: "repro", birth: "repro", repair: "repro" };
const FGROUPS = [["all", "Everything"], ["tending", "Unpaid and local tending"], ["land", "Land and water"], ["species", "Species"], ["disease", "Disease"], ["repro", "Reproductive care"], ["people", "Links people added"]];
const FMODES = [["all", "Both"], ["repeats", "Maintenance"], ["turns", "Leverage"]];
const rich = t => esc(t).replace(/\(?(https?:\/\/[^\s<)]+)\)?/g, (m, u) => { let h = ""; try { h = new URL(u.replace(/&amp;/g, "&")).hostname.replace(/^www\./, ""); } catch (_) { return ""; } return `(<a href="${u}">${h}</a>)`; });
const said = t => t && !/^(not stated|none found|not shown|not verified)\b/i.test(String(t).trim());
const where = s => esc(s.place) + (s.place.includes(s.country) ? "" : ", " + esc(s.country));
const modeName = s => (s.by ? "Link" : s.mode === "turns" ? "Leverage" : "Maintenance");
const passes = s => !s.gone && (fg === "all" || (fg === "people" ? !!s.by : GROUP_OF[s.domain] === fg)) && (fm === "all" || (!s.by && (s.mode === "turns" ? "turns" : "repeats") === fm));

const when = iso => { const d = iso && new Date(iso); return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""; };
function sourcedCard(s, i) {
  return `<article class="story" id="story-${i}">
  <div class="caps">${esc(DOMAIN[s.domain] || s.domain)}</div>
  <h3>${esc(s.title)}</h3>
  <p class="where">${where(s)}</p>
  <p class="mode"><i class="mark ${s.mode === "turns" ? "t" : "r"}"></i>${modeName(s)}${said(s.mode_reason) ? ". " + esc(s.mode_reason) : ""}</p>
  <div><q>${esc(s.quote)}</q><p class="by">${esc(s.quote_speaker)}</p></div>
  <dl><dt>Who</dt><dd>${esc(s.who)}</dd><dt>Does</dt><dd>${esc(s.does)}</dd>
  <dt>Paid by</dt><dd>${said(s.pays) ? rich(s.pays) : "The source does not say."}</dd>
  ${said(s.result) ? `<dt>Result</dt><dd>${rich(s.result)}</dd>` : ""}
  ${said(s.contested) ? `<dt>Disputed</dt><dd>${rich(s.contested)}</dd>` : ""}
  ${said(s.when_it_stops) ? `<dt>When it stops</dt><dd>${rich(s.when_it_stops)}</dd>` : ""}
  ${said(s.cost) ? `<dt>Cost</dt><dd>${esc(s.cost)}</dd>` : ""}</dl>
  <p class="src">Source: <a href="${href(s.source_url)}">${esc(s.source_title)}</a>, ${esc(s.source_publisher)}${said(s.source_date) ? ", " + esc(s.source_date) : ""}</p>
  <button type="button" class="show" data-i="${i}">Show on the map</button></article>`;
}
// A link someone added: a web address and a place, nothing of their own wording.
function linkCard(s, i) {
  const mine = state.me && s.did === state.me;
  return `<article class="story people" id="story-${i}">
  <div class="caps">Link</div>
  <h3>${esc(s.title)}</h3>
  <p class="where">${esc(s.place)}</p>
  <p class="url"><a href="${href(s.url)}" rel="nofollow noopener">${esc(s.url)}</a></p>
  <p class="byline">Added by <a href="https://bsky.app/profile/${encodeURIComponent(s.did)}">@${esc(s.by)}</a>${when(s.createdAt) ? ", " + when(s.createdAt) : ""}. Not checked by the atlas.</p>
  <div class="acts"><button type="button" class="show" data-i="${i}">Show on the map</button>${mine ? `<button type="button" class="remove" data-i="${i}">Remove</button>` : `<button type="button" class="takedown" data-i="${i}">Request takedown</button>`}</div></article>`;
}
function renderCards() {
  const order = STORIES.map((s, i) => i).filter(i => !STORIES[i].gone).sort((a, b) => (STORIES[b].by ? 1 : 0) - (STORIES[a].by ? 1 : 0) || a - b);
  el("stories").innerHTML = order.map(i => (STORIES[i].by ? linkCard(STORIES[i], i) : sourcedCard(STORIES[i], i))).join("");
}

function applyFilters() {
  if (pins) pins.classed("off", s => !passes(s));
  document.querySelectorAll(".story").forEach(n => n.classList.toggle("off", !passes(STORIES[+n.id.slice(6)])));
  const shown = STORIES.filter(passes), links = shown.filter(s => s.by).length, t = shown.filter(s => !s.by && s.mode === "turns").length;
  el("count").textContent = `${shown.length} of ${STORIES.filter(s => !s.gone).length} shown: ${shown.length - links - t} maintenance, ${t} leverage${links ? `, ${links} ${links === 1 ? "link" : "links"} added by people` : ""}.`;
  el("filters").innerHTML = `<div class="grp">` + FGROUPS.map(([key, l]) => `<button type="button" data-g="${key}" aria-pressed="${fg === key}">${l}</button>`).join("") + `</div><div class="grp">` +
    FMODES.map(([key, l]) => `<button type="button" data-m="${key}" aria-pressed="${fm === key}">${key === "all" ? "" : `<i class="mark ${key === "turns" ? "t" : "r"}" style="width:8px;height:8px;border-color:currentColor;background:none"></i>`}${l}</button>`).join("") + `</div>`;
}
el("filters").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.g) fg = b.dataset.g; if (b.dataset.m) fm = b.dataset.m; applyFilters(); });
function pinReadout(s) { el("readout").innerHTML = `<h3>${esc(s.title)}</h3><p>${where(s)}${s.by ? "" : ". " + esc(s.does)}</p><p>${s.by ? "A link added by @" + esc(s.by) + "." : modeName(s) + "."}</p>`; }
function selectStory(i, scroll) {
  if (pins) pins.classed("sel", s => STORIES.indexOf(s) === i);
  document.querySelectorAll(".story").forEach(n => n.classList.toggle("sel", +n.id.slice(6) === i));
  if (i == null) return;
  if (scroll === "story") { if (!passes(STORIES[i])) { fg = "all"; fm = "all"; applyFilters(); } el("story-" + i).scrollIntoView({ behavior: "smooth", block: "start" }); }
  if (scroll === "map") {
    const s = STORIES[i], want = s.by ? s.scope : "world";   // an added entry belongs to the map it was placed on
    if (scopeKey !== want) return setScope(want).then(() => selectStory(i, "map"));
    if (s.by && featureOf(s.unit)) { picked = s.unit; draw(); pins.classed("sel", x => x === s); }
    document.querySelector(".mapbox").scrollIntoView({ behavior: "smooth", block: "center" }); pinReadout(s); }
}
el("stories").addEventListener("click", e => {
  const b = e.target.closest("button.show"); if (b) return selectStory(+b.dataset.i, "map");
  const r = e.target.closest("button.remove"); if (r) return removeLink(+r.dataset.i);
  const t = e.target.closest("button.takedown"); if (t) requestTakedown(+t.dataset.i);
});

// ---- map
function buildMap() {
  proj = S.projection(S.features); pathGen = d3.geoPath(proj);
  svg.call(zoom.transform, d3.zoomIdentity);
  shapes = gUnits.selectAll("path").data(S.features, f => scopeKey + ":" + S.idOf(f) + ":" + f.id).join("path").attr("d", pathGen)
    .on("pointerenter", (e, f) => { if (e.pointerType === "mouse") hover(f); })
    .on("pointerleave", e => { if (e.pointerType === "mouse") hover(picked ? featureOf(picked) : null); })
    .on("click", (e, f) => { const id = S.idOf(f); picked = picked === id ? null : id; selectStory(null); draw(); if (picked) el("profile").scrollIntoView({ behavior: "smooth", block: "nearest" }); });
  gMesh.attr("d", S.mesh ? pathGen(S.mesh) : null);
  drawPins();
}
function drawPins() {
  const onMap = s => !s.gone && (s.by ? scopeKey === "world" || s.scope === scopeKey : !S.keep || S.keep(s));
  const vis = STORIES.filter(onMap).map(s => ({ s, p: proj([s.lon, s.lat]) })).filter(o => o.p && o.p[0] >= 0 && o.p[0] <= W && o.p[1] >= 0 && o.p[1] <= H);
  pins = gPins.selectAll("g.pin").data(vis.map(o => o.s), s => s.key).join("g").attr("class", s => "pin" + (s.by ? " people" : "")).attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", s => (s.by ? `Link to ${s.title}, ${s.place}, added by ${s.by}` : `${modeName(s)}: ${s.title}, ${s.place}`)).attr("transform", s => `translate(${proj([s.lon, s.lat])})`);
  pins.selectAll("*").remove();
  pinInner = pins.append("g").attr("transform", `scale(${1 / k})`);
  pinInner.filter(s => s.by).append("circle").attr("class", "halo").attr("r", 5.5);
  pinInner.filter(s => !s.by && s.mode !== "turns").append("circle").attr("class", "halo").attr("r", 7);
  pinInner.filter(s => !s.by && s.mode === "turns").append("rect").attr("class", "halo").attr("x", -6).attr("y", -6).attr("width", 12).attr("height", 12).attr("transform", "rotate(45)");
  pinInner.filter(s => !s.by).append("circle").attr("class", "core").attr("r", 2.6);
  pinInner.append("circle").attr("r", 16).attr("fill", "transparent");
  pins.on("click", (e, s) => selectStory(STORIES.indexOf(s), "story"))
    .on("keydown", (e, s) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectStory(STORIES.indexOf(s), "story"); } })
    .on("pointerenter", (e, s) => { if (e.pointerType === "mouse") pinReadout(s); });
  applyFilters();
}
function pair(L, d) {
  const max = L.id === "hours" ? 6 : L.scaleMax, w = x => Math.max(1, Math.min(100, 100 * x / max)) + "%";
  return `<div class="pair"><span>Women</span><div><div class="bar w" style="width:${w(d.f)}"></div></div><span class="val">${L.f(d)}</span>
    <span>Men</span><div><div class="bar m" style="width:${w(d.m)}"></div></div><span class="val">${L.m(d)}</span></div>`;
}
function hover(f) {
  const r = el("readout");
  if (!f) { r.innerHTML = `<h3>Point at a ${S.unit}</h3><p>Tinted ${S.units} have a figure on this layer. Pale ones have none published. Click one to see every layer for that place.</p>`; return; }
  const d = S.get(layer, S.idOf(f));
  r.innerHTML = d ? `<h3>${esc(S.nameOf(f))}: ${layer.val(d)}</h3><p>${esc(layer.read(d))}</p>${layer.gendered ? pair(layer, d) : ""}` : `<h3>${esc(S.nameOf(f))}</h3><p>No figure published on this layer.</p>`;
}
function draw() {
  shapes.attr("class", f => { const id = S.idOf(f), d = id && S.get(layer, id); return "country " + (d ? "has b" + bin(layer, d.v) : "nodata") + (picked && picked === id ? " sel" : ""); });
  shapes.filter(f => picked && S.idOf(f) === picked).raise();
  el("finding").textContent = layer.finding; el("measure").textContent = layer.measure; el("srcline").textContent = layer.src;
  el("swatches").innerHTML = layer.labels.map((t, i) => `<span><i style="background:var(--s${i + 1})"></i>${t}</span>`).join("") +
    `<span><i class="none"></i>no figure</span><span><i class="pinkey"></i>maintenance</span><span><i class="pinkey t"></i>leverage</span><span><i class="pinkey p"></i>a link someone added</span>`;
  el("layers").innerHTML = `<p class="caps">Layers, by how soon it is felt when the work stops</p>` + GROUPS.map(([gk, gl, gw]) => {
    const ls = S.layers.filter(L => L.group === gk);
    return ls.length ? `<div class="lgroup"><div class="lg"><b>${gl}</b><span>${gw}</span></div>` + ls.map(L => `<button type="button" data-id="${L.id}" aria-pressed="${L.id === layer.id}">${esc(L.name)}</button>`).join("") + `</div>` : "";
  }).join("");
  el("scopes").innerHTML = `<span class="caps">Map</span>` + Object.entries(SCOPES).map(([key, s]) => `<button type="button" data-s="${key}" aria-pressed="${key === scopeKey}">${key === "world" ? "World, by country" : s.label + ", by " + s.unit}</button>`).join("");
  // rank
  el("rankhead").textContent = layer.rank; el("ranknote").textContent = S.units[0].toUpperCase() + S.units.slice(1) + " with a figure: " + S.ids(layer).length.toLocaleString("en") + ".";
  el("rankkey").hidden = !layer.gendered;
  const dir = layer.order === "low" ? 1 : -1, w = x => Math.max(.5, Math.min(100, 100 * x / (layer.id === "hours" ? 6 : layer.scaleMax))) + "%";
  const sorted = S.ids(layer).map(id => [id, S.get(layer, id)]).sort((a, b) => dir * (a[1].v - b[1].v));
  const nm = id => (scopeKey === "world" ? C[id].n : S.pack.names[id] || id);
  el("rank").innerHTML = sorted.slice(0, 10).map(([id, d]) => `<div class="row"><div class="nm">${esc(nm(id))}</div><div class="bars">` + (layer.gendered
    ? `<div class="b"><div style="width:${w(d.f)};background:var(--women)"></div><span>${layer.f(d)}</span></div><div class="b"><div style="width:${w(d.m)};background:var(--men)"></div><span>${layer.m(d)}</span></div>`
    : `<div class="b"><div style="width:${w(d.v)};background:var(--s4)"></div><span>${layer.val(d)}</span></div>`) + `</div></div>`).join("");
  el("tabledetails").open = false; el("table").innerHTML = "";
  el("tabledetails").ontoggle = () => { if (!el("tabledetails").open || el("table").innerHTML) return;
    el("table").innerHTML = `<thead><tr><th>${S.unit[0].toUpperCase() + S.unit.slice(1)}</th><th>Figure</th>${layer.gendered ? "<th>Women</th><th>Men</th>" : ""}</tr></thead><tbody>` +
      sorted.map(([id, d]) => `<tr><td>${esc(nm(id))}</td><td>${layer.val(d)}</td>${layer.gendered ? `<td>${layer.f(d)}</td><td>${layer.m(d)}</td>` : ""}</tr>`).join("") + "</tbody>"; };
  hover(picked ? featureOf(picked) : null);
  profile();
}

// ---- the place profile: every layer for one unit, in order of significance
function profile() {
  const box = el("profile"), f = picked && featureOf(picked);
  if (!f) { box.innerHTML = `<h2>What life is like in one place</h2><p>Click a ${S.unit} on the map. Every layer for that place will be listed here in the same order, each with its position among the other ${S.units}.</p>`; return; }
  const rows = GROUPS.map(([gk, gl, gw]) => {
    const ls = S.layers.filter(L => L.group === gk); if (!ls.length) return "";
    return `<div class="pgroup"><div class="lg"><b>${gl}</b><span>${gw}</span></div>` + ls.map(L => {
      const d = S.get(L, picked);
      if (!d) return `<button type="button" class="prow none" data-id="${L.id}"><span class="pn">${esc(L.name)}</span><span class="pv">no figure</span><span></span></button>`;
      const ids = S.ids(L), below = ids.reduce((n, id) => n + (S.get(L, id).v < d.v ? 1 : 0), 0), p = ids.length > 1 ? below / (ids.length - 1) : .5;
      return `<button type="button" class="prow${L.id === layer.id ? " on" : ""}" data-id="${L.id}"><span class="pn">${esc(L.name)}</span><span class="pv">${L.val(d)}${L.gendered ? ` <small>women ${L.f(d)}, men ${L.m(d)}</small>` : ""}</span>
        <span class="strip" title="Higher than ${Math.round(p * 100)}% of ${S.units}"><i style="left:${(p * 100).toFixed(1)}%"></i></span><span class="pp">higher than ${Math.round(p * 100)}% of ${S.units}</span></button>`;
    }).join("") + `</div>`;
  }).join("");
  const here = STORIES.map((s, i) => [s, i]).filter(([s]) => !s.gone && ((s.by && s.scope === scopeKey && s.unit === picked) || d3.geoContains(f, [s.lon, s.lat])));
  const a3 = scopeKey === "world" ? picked : null, open = a3 && OPENS(a3);
  box.innerHTML = `<h2>${esc(S.nameOf(f))}</h2>
    <p>${scopeKey === "world" ? "A country" : "A " + S.unit + " in " + (scopeKey === "us" ? "the United States" : S.label)}. The strip shows where it sits among all ${S.units} with a figure, lowest at the left.</p>
    ${open ? `<p><button type="button" class="open" data-s="${open}">Open ${SCOPES[open].label} by ${SCOPES[open].unit}</button></p>` : ""}
    <div class="prows">${rows}</div>
    <h3 class="heretitle">Recorded here</h3>
    ${here.length ? `<ul class="here">` + here.map(([s, i]) => `<li><a href="#story-${i}" data-i="${i}"><i class="mark ${s.by ? "p" : s.mode === "turns" ? "t" : "r"}"></i>${esc(s.title)}</a> <span>${s.by ? "a link added by @" + esc(s.by) : esc(DOMAIN[s.domain] || "") + ", " + modeName(s).toLowerCase()}</span></li>`).join("") + `</ul>`
      : `<p class="none">No story or intervention is pinned inside this ${S.unit} yet. The statistics above say what life is like here. Who keeps it going is still unrecorded.</p>`}
    <div class="addbox" id="addbox"></div>`;
  renderAdd();
}
el("profile").addEventListener("click", e => {
  if (e.target.closest("#addbox")) return;
  const o = e.target.closest("button.open"); if (o) return setScope(o.dataset.s);
  const r = e.target.closest("button.prow"); if (r) { layer = S.layers.find(L => L.id === r.dataset.id); draw(); document.querySelector(".mapbox").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
  const a = e.target.closest("a[data-i]"); if (a) { e.preventDefault(); selectStory(+a.dataset.i, "story"); }
});
el("layers").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; layer = S.layers.find(L => L.id === b.dataset.id); draw(); });
el("scopes").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setScope(b.dataset.s); });

async function setScope(key) {
  const T = SCOPES[key];
  if (!T.ready) {
    el("loading").hidden = false;
    try { adoptPack(T, T.build(await Promise.all(T.files.map(u => fetch(here(u)).then(r => { if (!r.ok) throw new Error(u); return r.json(); }))))); }
    catch (err) { el("loading").textContent = "The local map could not be loaded."; return; }
    el("loading").hidden = true;
  }
  scopeKey = key; S = T; picked = null;
  layer = S.layers.find(L => L.group === layer.group) || S.layers[0];
  buildMap(); draw();
}

// ---- people: sign-in, adding a link, removing it, asking for one to be taken down.
// The records live in people's own atproto accounts; this site stores nothing.
// Sign-in follows the Library (../library/app.js).
const state = { client: null, session: null, agent: null, me: null, handle: null, authError: false, notice: "", busy: false, draft: "", errors: [] };
let people = { loaded: false, error: null, unreachable: 0, withheld: 0, unplaced: 0 };
// A link carries a unit id, never a place name, so the name is looked up here.
// A link whose unit this atlas doesn't have is not shown.
const unitNames = { world: Object.fromEntries(Object.entries(C).map(([a3, m]) => [a3, m.n])) };
async function namesFor(scope) {
  if (!unitNames[scope]) unitNames[scope] = (async () => (SCOPES[scope].ready ? SCOPES[scope].pack.names : (await getJson(`data/${scope}.values.json`)).names))().catch(() => ({}));
  return unitNames[scope];
}
async function display(e) {
  const name = (await namesFor(e.scope))[e.unit];
  return name ? { ...e, key: e.uri, by: e.handle || e.did, title: e.host, place: name, country: "" } : null;
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
  const note = state.notice ? `<p class="notice">${esc(state.notice)}</p>` : "";
  el("account").innerHTML = note + (state.me
    ? `<span>Signed in as <b>@${esc(state.handle || state.me)}</b>. Pick a place on the map, then add what you do there.</span> <button type="button" class="link" id="signout">Sign out</button>`
    : state.authError ? `<span>Sign-in is unavailable right now. The map still works.</span>`
    : `<form id="signin"><label for="handle">To add to the map, sign in with your atproto handle</label> <input id="handle" name="handle" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="you.bsky.social"> <button type="submit">Sign in</button></form>`);
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

function renderAdd() {
  const box = el("addbox"); if (!box) return;
  const f = picked && featureOf(picked); if (!f) { box.innerHTML = ""; return; }
  const name = S.nameOf(f);
  if (!state.me) { box.innerHTML = `<h3>Know of something that keeps ${esc(name)} going?</h3><p>Sign in at the top of the page with an atproto handle, such as a Bluesky one, to add a link to it here.</p>`; return; }
  box.innerHTML = `<h3>Add a link to ${esc(name)}</h3>
  <form class="addform" id="addform" novalidate>
    <p class="warn">A link is a web address and this place, nothing else. It is public, saved in your own account under your handle. Add pages that are already public. Do not add one that locates a person who could be harmed by being found. Anyone signed in can ask for it to be taken down.</p>
    ${state.errors.length ? `<p class="errors" role="alert">${state.errors.map(esc).join(" ")}</p>` : ""}
    <div class="row"><label class="sr-only" for="addurl">Web address</label>
      <input id="addurl" name="url" inputmode="url" autocapitalize="none" spellcheck="false" placeholder="https://" maxlength="${A.MAX_URL}" value="${esc(state.draft)}">
      <button type="submit"${state.busy ? " disabled" : ""}>${state.busy ? "Saving" : "Add link"}</button></div>
  </form>`;
}
el("profile").addEventListener("input", e => { if (e.target.id === "addurl") state.draft = e.target.value; });
el("profile").addEventListener("submit", e => { if (e.target.id === "addform") { e.preventDefault(); addLink(); } });

async function addLink() {
  const f = picked && featureOf(picked); if (!f || !state.agent || state.busy) return;
  const [lon, lat] = d3.geoCentroid(f), name = S.nameOf(f);
  const built = A.buildLink({ url: state.draft, scope: scopeKey, unit: picked, lat, lon });
  if (!built.ok) { state.errors = built.errors; return renderAdd(); }
  state.busy = true; state.errors = []; renderAdd();
  try {
    const res = await state.agent.com.atproto.repo.createRecord({ repo: state.me, collection: A.COL.link, record: built.record });
    const uri = res.data.uri, shown = await display({ ...A.parseLink(built.record), uri, rkey: uri.split("/").pop(), did: state.me, handle: state.handle });
    if (shown) STORIES.push(shown);
    state.draft = ""; state.busy = false; state.notice = `Link added to ${name}. It is saved in your own account.`;
    renderAccount(); renderCards(); drawPins(); profile(); notePeople();
  } catch (err) { state.busy = false; state.errors = [`It could not be saved: ${err.message}`]; renderAdd(); }
}
async function removeLink(i) {
  const s = STORIES[i]; if (!s?.by || s.did !== state.me || !state.agent) return;
  try { await state.agent.com.atproto.repo.deleteRecord({ repo: state.me, collection: A.COL.link, rkey: s.rkey }); s.gone = true; state.notice = "Removed from your account and from the map."; }
  catch (err) { state.notice = `It could not be removed: ${err.message}`; }
  renderAccount(); renderCards(); drawPins(); profile(); notePeople();
}
// A takedown request is a record in the requester's account that points at the link.
// The page stops showing the link at once.
async function requestTakedown(i) {
  const s = STORIES[i]; if (!s?.by) return;
  if (!state.agent) { state.notice = "Sign in at the top of the page to ask for a link to be taken down."; renderAccount(); return el("account").scrollIntoView({ behavior: "smooth", block: "center" }); }
  const built = A.buildTakedown(s.uri); if (!built.ok) return;
  try {
    await state.agent.com.atproto.repo.createRecord({ repo: state.me, collection: A.COL.takedown, record: built.record });
    s.gone = true; people.withheld++; state.notice = "Takedown requested. The link is no longer shown here.";
  } catch (err) { state.notice = `The request could not be saved: ${err.message}`; }
  renderAccount(); renderCards(); drawPins(); profile(); notePeople();
}
function notePeople() {
  const n = STORIES.filter(s => s.by && !s.gone).length;
  el("communitynote").textContent = !people.loaded ? "Looking for links people have added."
    : people.error ? "Links added by people are not shown right now: the index that finds them, and the takedown requests against them, did not answer."
    : (n ? `${n} ${n === 1 ? "link" : "links"} added by people.` : "Nobody has added a link yet.")
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
  people = { loaded: true, error: out.error, unreachable: out.unreachable, withheld: out.withheld, unplaced };
  notePeople(); renderCards(); drawPins(); if (picked) profile();
}

const LIMITS = [
  `Coverage is thin exactly where the work is thickest. Unpaid work at home has ${wsize("hours")} countries and subsistence food growing has ${wsize("subsistence")}; most of Africa and much of Asia are blank because no survey has been published, not because nothing happens there.`,
  "Only three parts of the world open to local units, because those are the ones with open local statistics that could be reached today. A village, a city block or a parish is finer than any of them.",
  "The local layers are not the same from place to place. Each country measures what its own surveys ask, so a county in Virginia and a district in Bihar cannot be laid side by side.",
  "The local layers say what life is like. They rarely say who keeps it going. The unpaid hours on the world map have no county or district version yet.",
  `Of India's 709 surveyed districts, about 690 could be matched to a boundary. The rest are districts created or renamed since the boundaries were drawn.`,
  "The order of the layers is an editorial judgement about how soon harm arrives when the work stops. It is not a measurement.",
  "The subsistence layer comes from a copy of the ILO's figures made in February 2024. The ILO's current catalogue, checked on 14 November 2026, no longer lists the indicator under the same name.",
  "The reach layers count the people or the land reached. They do not count the people doing the reaching.",
  "Maintenance and leverage are a judgement made from each entry's source, and the line moves. Eradicating the screwworm from North America was leverage; holding the barrier that keeps it out is maintenance.",
  "None of these numbers says who pays. For most of the unpaid work nobody does.",
  "A link added by someone is a web address and a place. Nobody has checked where it leads. Links are found through Constellation, an outside index of atproto records; when it does not answer, none are shown.",
  "A takedown request needs an atproto account. Someone without one cannot make one here.",
];
const SOURCES = [
  ["Our World in Data: life expectancy; unpaid care and domestic work (UN SDG 5.4.1); DTP3 coverage (WHO and UNICEF); births attended by skilled staff; modern contraceptive use; children under treated nets; protected land", "https://ourworldindata.org/"],
  ["International Labour Organization, ILOSTAT: status in employment (modelled estimates); persons outside the labour force due to care responsibilities", "https://ilostat.ilo.org/data/"],
  ["International Labour Organization, subsistence foodstuff production rate by sex, via DBnomics", "https://db.nomics.world/ILO/FOW_5SFP_SEX_RT"],
  ["United States counties: County Health Rankings & Roadmaps, 2025 analytic data (University of Wisconsin Population Health Institute)", "https://www.countyhealthrankings.org/"],
  ["India districts: National Family Health Survey 5 (2019-21) district fact sheets, International Institute for Population Sciences, from the CSV compiled by Sai Siddhardha Kalla", "https://github.com/SaiSiddhardhaKalla/NFHS"],
  ["Europe regions: Eurostat regional statistics (life expectancy, infant mortality, physicians, employment rates by sex, NUTS 2)", "https://ec.europa.eu/eurostat/web/regions/database"],
  ["Boundaries: Natural Earth through world-atlas and us-atlas; geoBoundaries (India, Open Database License); Eurostat GISCO NUTS 2021. Small island states are missing from the world map and appear only in the tables.", "https://www.geoboundaries.org/"],
];
el("limits").innerHTML = LIMITS.map(t => `<li>${t}</li>`).join("");
el("sources").innerHTML = SOURCES.map(([t, u]) => `<li><a href="${u}">${t}</a></li>`).join("");
renderCards(); buildMap(); draw();
renderAccount();
initAuth().catch(() => { state.authError = true; renderAccount(); });
loadPeople();
