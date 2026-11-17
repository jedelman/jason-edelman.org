// Ghent parcel explorer: HC-G2 in 3D from the City of Norfolk's own GIS. Pick a lot, see the
// assessor's photo and the rule, then watch the ground floor become a coffee shop, bookshop,
// bistro or design studio. Data: data/ghent.json, built by data/scripts/build_explorer.py.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (id) => document.getElementById(id);
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DARK = matchMedia('(prefers-color-scheme: dark)').matches;

// ── The rule, from Table 3.6.11 and the §4.2 definitions (checked 2026-11-14) ──
const RULES = {
  restaurant: {
    use: 'Restaurant',
    def: 'An establishment whose function is the preparation and selling of unpackaged food and beverages to the customer in a ready-to-consume state, where the customer consumes these foods and beverages while seated at tables or counters primarily located within a building.',
    g3: 'P/C',
  },
  retail: {
    use: 'Retail goods establishment',
    def: 'Establishments that sell consumer goods at retail.',
    g3: 'P/C',
  },
  office: {
    use: 'Office',
    def: 'A building primarily consisting of offices used for conducting the affairs of various businesses, professions, services, nonprofit organizations, or government agencies…',
    g3: 'P',
  },
};

const PALETTE = DARK ? {
  bg: 0x1e1b17, ground: 0x25211b, road: 0x16130f, lot: 0x2f2a22, corner: 0x7a5a2c, picked: 0xd4a060,
  building: 0xc9bfac, context: 0x6f675a, line: 0xd4a060, g3: 0x5d7a59, hover: 0x3a3329,
} : {
  bg: 0xe6dcc3, ground: 0xe0d5ba, road: 0xcfc3a6, lot: 0xf0e9da, corner: 0xe6c088, picked: 0xb07c2a,
  building: 0xfcf9f2, context: 0xe9e1d0, line: 0xb07c2a, g3: 0x8fae8b, hover: 0xf7f1e4,
};

// ── Storefront kits ──
const KITS = [
  { id: 'coffee', label: 'Coffee shop', rule: 'restaurant', sign: 'COFFEE', signFont: '700 120px "Cormorant Garamond", Georgia, serif',
    signBg: '#2f4a3a', signInk: '#f3ede0', stripes: ['#2f4a3a', '#efe6d2'], glow: 0xffb35a, glass: 0x3a2716,
    window: { bg: '#f3d6a6', marks: '#7a4a1e', kind: 'counter' }, props: 'cafe', tables: 3, people: 5 },
  { id: 'books', label: 'Bookshop', rule: 'retail', sign: 'BOOKS', signFont: '700 120px "Cormorant Garamond", Georgia, serif',
    signBg: '#6b2430', signInk: '#f3ede0', stripes: ['#6b2430', '#efe6d2'], glow: 0xffc879, glass: 0x2a1c14,
    window: { bg: '#f1d29a', marks: null, kind: 'shelves' }, props: 'books', tables: 0, people: 4 },
  { id: 'bistro', label: 'Bistro', rule: 'restaurant', sign: 'BISTRO', signFont: 'italic 600 120px "Cormorant Garamond", Georgia, serif',
    signBg: '#1f2a44', signInk: '#f0d9a8', stripes: ['#8a2b1f', '#f0e3c8'], glow: 0xff9e4a, glass: 0x2b1609,
    window: { bg: '#e8b67c', marks: '#5a2b10', kind: 'lamps' }, props: 'bistro', tables: 4, people: 6 },
  { id: 'studio', label: 'Design studio', rule: 'office', sign: 'STUDIO', signFont: '500 96px "DM Mono", monospace',
    signBg: '#f3f1ec', signInk: '#1a1714', stripes: null, glow: 0xdfe9ff, glass: 0x1b2026,
    window: { bg: '#e9eef3', marks: '#5b6670', kind: 'desks' }, props: 'studio', tables: 0, people: 3 },
];

// ── State ──
let data;
const parcels = new Map();          // gpin → parcel (+ plate mesh, building meshes)
const streetsByName = new Map();    // name → [[x, y], …][]
let three = null;                   // { renderer, scene, camera, controls } when WebGL runs
let picked = null;
let activeKit = null;               // { id, group, tweens, start }
let flight = null;

// ── Small helpers ──
const titleCase = (s) => (s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
const fmt = (n) => n == null ? '—' : n.toLocaleString('en-US');
const ease = (k) => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const to3 = (x, y, h = 0) => new THREE.Vector3(x, h, -y);

function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

function polyCentroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}

function nearestOnLines(pt, lines) {
  let best = null;
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1];
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / L2));
      const q = [ax + t * dx, ay + t * dy];
      const d = Math.hypot(pt[0] - q[0], pt[1] - q[1]);
      if (!best || d < best.d) best = { d, q };
    }
  }
  return best;
}

function streetViewUrl(sv) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${sv[0]},${sv[1]}&heading=${sv[2]}`;
}

// ── Boot ──
async function boot() {
  data = await (await fetch('data/ghent.json')).json();
  for (const p of data.parcels) parcels.set(p.gpin, { ...p, buildings: [], meshes: [] });
  for (const b of data.buildings) if (b.parcel && parcels.has(b.parcel)) parcels.get(b.parcel).buildings.push(b);
  for (const s of data.streets) {
    if (!streetsByName.has(s.name)) streetsByName.set(s.name, []);
    streetsByName.get(s.name).push(s.line);
  }
  buildPanel();
  // Street labels and signs are drawn into canvases, so let the web fonts arrive first (briefly).
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
  try {
    initThree();
  } catch (err) {
    three = null;
    const note = $('scene-note');
    note.textContent = "The 3D model needs WebGL, which this browser isn't offering. You can still pick a corner from the list.";
    note.hidden = false;
  }
  readHash();
  addEventListener('hashchange', readHash);
}

// ── Panel ──
function buildPanel() {
  const pick = $('corner-pick');
  const corners = [...parcels.values()].filter((p) => p.corner && p.address)
    .sort((a, b) => {
      const sa = a.address.replace(/^\d+\s+/, ''), sb = b.address.replace(/^\d+\s+/, '');
      return sa.localeCompare(sb) || parseInt(a.address, 10) - parseInt(b.address, 10);
    });
  for (const p of corners) {
    const o = document.createElement('option');
    o.value = p.gpin;
    o.textContent = titleCase(p.address);
    pick.append(o);
  }
  const cases = Object.keys(HEROES).filter((g) => HEROES[g].page && parcels.has(g))
    .sort((a, b) => parseInt(parcels.get(a).address, 10) - parseInt(parcels.get(b).address, 10));   // by street number, as the pages list them
  // The case studies, first in the intro: one tap goes to each (the hash link selects the lot and flies there).
  if (cases.length) {
    for (const g of cases) {
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = `#p=${g}`; a.textContent = titleCase(parcels.get(g).address);
      li.append(a); $('case-list').append(li);
    }
    $('case-links').hidden = false;
  }
  if (cases.length) {
    const group = document.createElement('optgroup');
    group.label = 'Case studies';
    for (const g of cases) { const o = document.createElement('option'); o.value = g; o.textContent = titleCase(parcels.get(g).address); group.append(o); }
    pick.append(group);
  }
  pick.addEventListener('change', () => { if (pick.value) select(pick.value); });
  $('back').addEventListener('click', () => deselect());

  const kits = $('kits');
  for (const kit of KITS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = kit.label;
    b.dataset.kit = kit.id;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => applyKit(kit.id));
    kits.append(b);
  }
  const before = document.createElement('button');
  before.type = 'button';
  before.className = 'before';
  before.textContent = 'Before';
  before.addEventListener('click', () => applyKit(null));
  kits.append(before);
}

function fillLot(p) {
  $('intro').hidden = true;
  $('lot').hidden = false;
  const [s0, s1] = p.streets || [];
  $('lot-corner').textContent = p.corner && s1 ? `Corner of ${titleCase(s0)} and ${titleCase(s1)}` : s0 ? `On ${titleCase(s0)}` : 'HC-G2';
  $('lot-address').textContent = p.address ? titleCase(p.address) : `Lot ${p.gpin}`;
  const facts = [
    ['Use today', p.use || '—'],
    ['Assessed as', (p.cls || '—').replace(/^\d+\s+/, '')],
    ['Built', p.built || '—'],
    ['Lot', p.lot_sqft ? `${fmt(p.lot_sqft)} sq ft` : '—'],
  ];
  const trees = treesFor(p);
  if (trees.length) {
    const named = trees.slice(0, 4).map((t) => `${(t[4] || 'tree').toLowerCase().replace(/^./, (c) => c.toUpperCase())}${t[3] ? ` ${t[3]}″` : ''}`);
    facts.push(['Trees', named.join(', ') + (trees.length > 4 ? `, and ${trees.length - 4} more` : '')]);
  }
  $('lot-facts').replaceChildren(...facts.flatMap(([k, v]) => {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    return [dt, dd];
  }));
  const fig = $('lot-photo'), img = $('lot-photo-img'), card = $('lot-card');
  if (p.photo) {
    fig.classList.remove('none');
    img.src = p.photo;
    img.alt = `${p.address ? titleCase(p.address) : 'This building'}, photographed from the street by the City of Norfolk's assessor.`;
  } else {
    fig.classList.add('none');
    img.removeAttribute('src');
  }
  card.href = p.pid ? `https://air.norfolk.gov/#/property/${p.pid}` : 'https://air.norfolk.gov/';
  card.textContent = p.photo ? 'property card ↗' : 'see the property card ↗';
  const sv = $('lot-sv');
  if (p.sv) { sv.href = streetViewUrl(p.sv); sv.parentElement.hidden = false; } else sv.parentElement.hidden = true;
  const page = HEROES[p.gpin] && HEROES[p.gpin].page;
  $('lot-case').hidden = !page;
  if (page) $('lot-case-link').href = page;
  const hasBuilding = p.buildings.length > 0 || !!HEROES[p.gpin];
  $('no-building').hidden = hasBuilding;
  $('kits').hidden = !hasBuilding;
  $('rule').hidden = true;
  setPressed(null);
  $('panel').scrollTop = 0;
}

function fillRule(kit) {
  if (!kit) { $('rule').hidden = true; return; }
  const r = RULES[kit.rule];
  $('rule-use').textContent = `${kit.label} → ${r.use}`;
  $('rule-def').textContent = `“${r.def}”`;
  const g2 = $('rule-g2'), g3 = $('rule-g3');
  g2.textContent = 'blank: prohibited'; g2.className = 'no';
  g3.textContent = `${r.g3}: allowed`; g3.className = 'yes';
  $('rule').hidden = false;
}

function setPressed(id) {
  for (const b of $('kits').querySelectorAll('button[data-kit]')) b.setAttribute('aria-pressed', String(b.dataset.kit === id));
}

// ── Selection ──
function select(gpin, kitId = null, { fly = true } = {}) {
  const p = parcels.get(gpin);
  if (!p) return;
  if (picked && picked !== p) unhighlight(picked);
  applyKit(null, { silent: true });
  picked = p;
  $('corner-pick').value = p.corner || (HEROES[gpin] && HEROES[gpin].page) ? gpin : '';
  fillLot(p);
  if (three) {
    highlight(p);
    p.front = p.hero ? null : frontage(p);
    if (fly) { if (p.hero) glide(p.hero.def.view('picked')); else flyTo(p); }
  }
  if (kitId) applyKit(kitId);
  else writeHash();
}

function deselect() {
  applyKit(null, { silent: true });
  if (picked) unhighlight(picked);
  picked = null;
  $('intro').hidden = false;
  $('lot').hidden = true;
  $('corner-pick').value = '';
  if (three) flyHome();
  writeHash();
}

function writeHash() {
  const h = picked ? `#p=${picked.gpin}${activeKit ? `&t=${activeKit.id}` : ''}` : ' ';
  if (location.hash !== h.trim()) history.replaceState(null, '', h.trim() || location.pathname + location.search);
}

function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const g = q.get('p');
  if (g && parcels.has(g)) {
    if (!picked || picked.gpin !== g) select(g, q.get('t'), { fly: true });
    else if ((activeKit && activeKit.id) !== q.get('t')) applyKit(q.get('t'));
  }
}

// ── 3D ──
function initThree() {
  const host = $('scene');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);
  scene.fog = new THREE.Fog(PALETTE.bg, 900, 2200);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 5000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = 1.565;   // down to eye level, never under the ground
  controls.minDistance = 12;
  controls.maxDistance = 1800;
  controls.screenSpacePanning = false;

  scene.add(new THREE.HemisphereLight(DARK ? 0x8a8070 : 0xfff6e6, DARK ? 0x1a1610 : 0xb8a888, DARK ? 0.9 : 1.6));
  const sun = new THREE.DirectionalLight(DARK ? 0xb0a8c0 : 0xfff1d6, DARK ? 0.9 : 2.2);
  sun.position.set(-260, 420, 300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -520, right: 520, top: 520, bottom: -520, near: 50, far: 1500 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: PALETTE.ground }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  three = { renderer, scene, camera, controls, host, sun, pickables: [] };
  buildRoads();
  buildLots();
  buildBuildings();
  buildTrees();
  buildLabels();
  flyHome(true);

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();
  wirePicking();
  renderer.setAnimationLoop(tick);
}

function ribbon(line, width, y) {
  const pos = [];
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1];
    const L = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / L * width / 2, ny = (bx - ax) / L * width / 2;
    const a1 = to3(ax + nx, ay + ny, y), a2 = to3(ax - nx, ay - ny, y);
    const b1 = to3(bx + nx, by + ny, y), b2 = to3(bx - nx, by - ny, y);
    pos.push(a1.x, a1.y, a1.z, b1.x, b1.y, b1.z, a2.x, a2.y, a2.z, a2.x, a2.y, a2.z, b1.x, b1.y, b1.z, b2.x, b2.y, b2.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function buildRoads() {
  // Drawn widths only: the city's layer classes streets (residential, arterial/collector) but gives no width.
  const geos = data.streets.map((s) => ribbon(s.line, /arterial|collector/i.test(s.kind || '') ? 13 : 9, 0.01));
  const roads = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ color: PALETTE.road, side: THREE.DoubleSide }));
  roads.receiveShadow = true;
  three.scene.add(roads);
}

function shapeOf(poly) {
  const s = new THREE.Shape();
  poly.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return s;
}

function flatMesh(poly, color, y) {
  const g = new THREE.ShapeGeometry(shapeOf(poly));
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

function buildLots() {
  const edges = [];
  for (const p of parcels.values()) {
    const plate = flatMesh(p.poly, p.corner ? PALETTE.corner : PALETTE.lot, 0.06);
    plate.userData.gpin = p.gpin;
    p.plate = plate;
    three.scene.add(plate);
    three.pickables.push(plate);
    const pts = [...p.poly, p.poly[0]].map(([x, y]) => to3(x, y, 0.08));
    for (let i = 0; i < pts.length - 1; i++) edges.push(pts[i], pts[i + 1]);
  }
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edges),
    new THREE.LineBasicMaterial({ color: DARK ? 0x4a4236 : 0xcdbf9f }));
  three.scene.add(lines);
  for (const ring of data.district) {
    three.scene.add(new THREE.Mesh(ribbon([...ring, ring[0]], 1.6, 0.12), new THREE.MeshBasicMaterial({ color: PALETTE.line, side: THREE.DoubleSide })));
  }
  for (const ring of data.g3) {
    three.scene.add(flatMesh(ring, PALETTE.g3, 0.05));
    three.scene.add(new THREE.Mesh(ribbon([...ring, ring[0]], 1.2, 0.13), new THREE.MeshBasicMaterial({ color: PALETTE.g3, side: THREE.DoubleSide })));
  }
}

const MAT = {};
function buildBuildings() {
  MAT.building = new THREE.MeshLambertMaterial({ color: PALETTE.building });
  MAT.picked = new THREE.MeshLambertMaterial({ color: DARK ? 0xe8c890 : 0xf6dcae });
  MAT.context = new THREE.MeshLambertMaterial({ color: PALETTE.context });
  const context = [];
  for (const b of data.buildings) {
    if (b.poly.length < 3) continue;
    const g = new THREE.ExtrudeGeometry(shapeOf(b.poly), { depth: b.h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const p = b.parcel && parcels.get(b.parcel);
    if (p && HEROES[p.gpin]) {   // drawn by hand: every footprint on the lot gives way to the model
      if (!p.hero) {
        p.hero = HEROES[p.gpin].build(p);
        p.hero.def = HEROES[p.gpin];
        three.scene.add(p.hero.group);
        three.pickables.push(...p.hero.pick);
      }
      continue;
    }
    if (p) {
      const m = new THREE.Mesh(g, MAT.building);
      m.castShadow = m.receiveShadow = true;
      m.userData.gpin = p.gpin;
      b.mesh = m;
      p.meshes.push(m);
      three.scene.add(m);
      three.pickables.push(m);
    } else {
      context.push(g);
    }
  }
  if (context.length) {
    const m = new THREE.Mesh(mergeGeometries(context), MAT.context);
    m.castShadow = m.receiveShadow = true;
    three.scene.add(m);
  }
}

// ── Trees: the city's inventory ──
// Where each tree stands, its species and its trunk diameter are the city's. Height and crown
// aren't in the inventory: they're drawn from the diameter with a rough growth curve per form
// (metres: base + per cm of trunk, up to a cap), so the shapes are approximate.
const TREE_FORMS = {
  oak:       { h: [4.9, 0.23, 24], r: [1.2, 0.105, 10], vs: 0.72, leaf: 0x5f7d4f, bark: 0x5a4636 },
  plane:     { h: [5, 0.24, 26], r: [1.2, 0.1, 10], vs: 0.78, leaf: 0x6f8a52, bark: 0xb9ae94 },
  maple:     { h: [4, 0.25, 20], r: [1.1, 0.11, 8], vs: 0.85, leaf: 0x6b8a4a, bark: 0x5f4d3d },
  round:     { h: [4, 0.24, 18], r: [1.1, 0.1, 7.5], vs: 0.8, leaf: 0x66844f, bark: 0x5a4636 },
  crape:     { h: [2.5, 0.22, 9], r: [0.9, 0.1, 4], vs: 0.75, leaf: 0x7a9455, bark: 0xa08770 },
  small:     { h: [2.5, 0.17, 9], r: [1, 0.1, 5], vs: 0.62, leaf: 0x6e8c55, bark: 0x5a4636 },
  pine:      { h: [5, 0.33, 28], r: [1, 0.06, 5], vs: 1, leaf: 0x3f5e45, bark: 0x6a5240 },
  cone:      { h: [3, 0.24, 15], r: [0.8, 0.05, 3], vs: 1, leaf: 0x3c5a40, bark: 0x5a4636 },
  evergreen: { h: [3.5, 0.2, 16], r: [1.2, 0.13, 11], vs: 0.6, leaf: 0x40603f, bark: 0x4f4134 },
};
const TREE_UNKNOWN_DBH = 7;   // the inventory's median, for the few trees it gives no size

function buildTrees() {
  const trees = (data.trees || []).map(([x, y, form, dbh, name]) => {
    const F = TREE_FORMS[form] || TREE_FORMS.round;
    const cm = (dbh || TREE_UNKNOWN_DBH) * 2.54;
    const rnd = rngFor(`${x},${y}`);
    const j = 0.9 + rnd() * 0.2;
    return { x, y, form, F, rnd, dbh, name,
      H: Math.min(F.h[0] + F.h[1] * cm, F.h[2]) * j,
      R: Math.min(F.r[0] + F.r[1] * cm, F.r[2]) * (0.9 + rnd() * 0.2),
      T: Math.max(0.07, (cm / 200) * 1.15) };
  });
  three.trees = trees;

  const trunks = [], lobes = [], cones = [];
  const add = (list, color, pos, scale, rot = [0, 0, 0]) => list.push({ color, pos, scale, rot });
  const leafColor = (t) => {
    const c = new THREE.Color(t.F.leaf).offsetHSL((t.rnd() - 0.5) * 0.03, (t.rnd() - 0.5) * 0.12, (t.rnd() - 0.5) * 0.08);
    return DARK ? c.multiplyScalar(0.55) : c;
  };
  const barkColor = (t) => { const c = new THREE.Color(t.F.bark); return DARK ? c.multiplyScalar(0.6) : c; };
  for (const t of trees) {
    const { x, y, H, R, T, F } = t;
    const P = (du, h, dv) => to3(x + du, y + dv, h);
    const yaw = t.rnd() * Math.PI * 2, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const off = (a, b) => [a * cy - b * sy, a * sy + b * cy];   // a crown offset, turned by the tree's yaw
    const lobe = (du, dv, h, sx, sv, c) => add(lobes, c, P(du, h, dv), [sx, sv, sx], [t.rnd() * 3, t.rnd() * 3, t.rnd() * 3]);
    const leaf = leafColor(t), bark = barkColor(t);
    // The crown as one ellipsoid (centre height, radii) and the trunk's top, for sight lines.
    if (t.form === 'cone') Object.assign(t, { cc: H * 0.5, cr: R * 0.75, cv: H * 0.42, top: H * 0.15 });
    else if (t.form === 'pine') { const Rv = Math.min(H * 0.17, R * 1.3); Object.assign(t, { cc: H - Rv * 1.3, cr: R, cv: Rv * 1.6, top: H - Rv * 2 }); }
    else { const Rv = R * F.vs; Object.assign(t, { cc: H - Rv, cr: R, cv: Rv, top: H - Rv * 1.8 }); }
    if (t.form === 'cone') {
      add(trunks, bark, P(0, 0, 0), [T, H * 0.2, T]);
      add(cones, leaf, P(0, H * 0.1, 0), [R, H * 0.9, R], [0, yaw, 0]);
    } else if (t.form === 'pine') {
      const Rv = Math.min(H * 0.17, R * 1.3), c = H - Rv;
      add(trunks, bark, P(0, 0, 0), [T, c + Rv * 0.4, T]);
      lobe(0, 0, c, R, Rv, leaf);
      const [a, b] = off(R * 0.55, 0), [a2, b2] = off(-R * 0.4, R * 0.35);
      lobe(a, b, c - Rv * 0.7, R * 0.6, Rv * 0.6, leaf);
      lobe(a2, b2, c - Rv * 1.1, R * 0.5, Rv * 0.5, leaf);
    } else if (t.form === 'crape') {
      // Several stems from the ground, splayed, each carrying a small crown: a vase.
      const Rv = R * F.vs, c = H - Rv;
      for (let k = 0; k < 3; k++) {
        const ang = yaw + (k * Math.PI * 2) / 3, lean = 0.22;
        const L = c / Math.cos(lean);
        // A cylinder leaning outward: rotate about the horizontal axis at right angles to its lean.
        const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)), lean));
        add(trunks, bark, P(0, 0, 0), [T * 0.55, L, T * 0.55], [e.x, e.y, e.z]);
        const reach = Math.sin(lean) * L;
        const du = Math.cos(ang) * reach, dv = Math.sin(ang) * reach;
        lobe(du, dv, c, R * 0.62, Rv * 0.7, leaf);
      }
      lobe(0, 0, c + Rv * 0.25, R * 0.6, Rv * 0.6, leaf);
    } else {
      const Rv = R * F.vs, c = H - Rv;
      add(trunks, bark, P(0, 0, 0), [T, c + Rv * 0.3, T]);
      lobe(0, 0, c, R * 0.92, Rv * 0.92, leaf);
      const [a, b] = off(R * 0.42, 0), [a2, b2] = off(-R * 0.32, R * 0.38);
      lobe(a, b, c + Rv * 0.3, R * 0.62, Rv * 0.62, leaf);
      lobe(a2, b2, c + Rv * 0.12, R * 0.58, Rv * 0.58, leaf);
    }
  }

  // Three instanced meshes for the whole district: trunks, leafy crowns, conifers.
  const trunkGeo = new THREE.CylinderGeometry(0.6, 1, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const coneGeo = new THREE.ConeGeometry(1, 1, 7);
  coneGeo.translate(0, 0.5, 0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
  const instanced = (geo, list, rough) => {
    if (!list.length) return null;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, metalness: 0, flatShading: true });
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => {
      q.setFromEuler(e.set(...o.rot));
      m.setMatrixAt(i, m4.compose(o.pos, q, sc.set(...o.scale)));
      m.setColorAt(i, o.color);
    });
    m.castShadow = true;
    m.receiveShadow = true;
    three.scene.add(m);
    return m;
  };
  instanced(trunkGeo, trunks, 0.95);
  instanced(new THREE.IcosahedronGeometry(1, 1), lobes, 0.9);
  instanced(coneGeo, cones, 0.9);
}

// The trees on a lot or at its curb: inside its lines, or within 6 m of one and abreast of it (not
// past its ends, which would be the neighbour's curb), and not on another lot.
function pointInPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function treesFor(p) {
  if (!data.trees) return [];
  const [cx, cy] = polyCentroid(p.poly);
  const reach = Math.max(...p.poly.map(([x, y]) => Math.hypot(x - cx, y - cy))) + 6;
  const abreast = ([x, y]) => p.poly.some(([ax, ay], i) => {
    const [bx, by] = p.poly[(i + 1) % p.poly.length];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const k = ((x - ax) * dx + (y - ay) * dy) / L2;
    return k > 0 && k < 1 && Math.abs((x - ax) * dy - (y - ay) * dx) / Math.sqrt(L2) <= 6;
  });
  const out = [];
  for (const t of data.trees) {
    if (Math.hypot(t[0] - cx, t[1] - cy) > reach) continue;
    const pt = [t[0], t[1]];
    if (!pointInPoly(pt, p.poly)) {
      if (!abreast(pt)) continue;
      let other = false;
      for (const q of parcels.values()) if (q !== p && pointInPoly(pt, q.poly)) { other = true; break; }
      if (other) continue;
    }
    out.push(t);
  }
  return out.sort((a, b) => b[3] - a[3]);
}

function textTexture(text, font, ink, bg, w = 1024, h = 256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.fillStyle = ink;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function buildLabels() {
  for (const [name, lines] of streetsByName) {
    let best = null;
    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const L = Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
        if (!best || L > best.L) best = { L, a: line[i], b: line[i + 1] };
      }
    }
    if (!best || best.L < 70) continue;
    const w = Math.min(best.L * 0.7, 70), h = w / 8;
    const tex = textTexture(titleCase(name), '500 92px "DM Mono", monospace', DARK ? '#cbbfa6' : '#7c6c4f', null);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    let ang = Math.atan2(best.b[1] - best.a[1], best.b[0] - best.a[0]);
    if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
    mesh.rotation.set(-Math.PI / 2, 0, ang);
    const mx = (best.a[0] + best.b[0]) / 2, my = (best.a[1] + best.b[1]) / 2;
    mesh.position.copy(to3(mx, my, 0.2));
    mesh.renderOrder = 2;
    three.scene.add(mesh);
  }
}

function highlight(p) {
  // The hero's lot reads as lawn up close; elsewhere the picked lot turns gold.
  p.plate.material.color.setHex(p.hero ? (DARK ? 0x3e4f36 : 0xa9b98f) : PALETTE.picked);
  for (const m of p.meshes) m.material = MAT.picked;
}

function unhighlight(p) {
  p.plate.material.color.setHex(p.corner ? PALETTE.corner : PALETTE.lot);
  for (const m of p.meshes) m.material = MAT.building;
}

function wirePicking() {
  const { renderer, camera } = three;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null, hover = null;
  const hit = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(three.pickables, false)[0];
    return h ? parcels.get(h.object.userData.gpin) : null;
  };
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const p = hit(e);
    if (p) select(p.gpin);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const p = hit(e);
    if (p === hover) return;
    if (hover && hover !== picked) hover.plate.material.color.setHex(hover.corner ? PALETTE.corner : PALETTE.lot);
    hover = p;
    if (p && p !== picked) p.plate.material.color.setHex(p.corner ? PALETTE.picked : PALETTE.hover);
    renderer.domElement.style.cursor = p ? 'pointer' : '';
  });
}

// The facade a storefront goes on: on the lot's largest building, the footprint edges that face
// its nearest named street; of those within 2.5 m of the front-most, the longest. (Length alone
// would pick a long wall set back in a courtyard.)
function frontage(p) {
  if (!p.buildings.length) return null;
  const b = p.buildings.reduce((a, c) => Math.abs(polyArea(c.poly)) > Math.abs(polyArea(a.poly)) ? c : a);
  const lines = p.streets?.length ? streetsByName.get(p.streets[0]) || [] : data.streets.map((s) => s.line);
  const cw = polyArea(b.poly) < 0;
  const edges = [];
  for (let i = 0; i < b.poly.length; i++) {
    const a = b.poly[i], c = b.poly[(i + 1) % b.poly.length];
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (len < 3) continue;
    const dir = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
    const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
    // Outward normal from the ring's winding: right of travel for a counter-clockwise ring.
    const n = cw ? [-dir[1], dir[0]] : [dir[1], -dir[0]];
    const near = nearestOnLines(mid, lines);
    if (!near) continue;
    const toward = ((near.q[0] - mid[0]) * n[0] + (near.q[1] - mid[1]) * n[1]) / (near.d || 1);
    if (toward < 0.5) continue;  // must face the street, within about 60°
    edges.push({ mid, dir, n, len, h: b.h, street: near.d, a, c, i, b });
  }
  if (!edges.length) return null;
  const nearest = Math.min(...edges.map((e) => e.street));
  const best = edges.filter((e) => e.street <= nearest + 2.5).reduce((x, y) => (y.len > x.len ? y : x));

  // A corner: an end of that face where the next wall along faces the lot's second street.
  if (p.corner && p.streets?.[1]) {
    const lines2 = streetsByName.get(p.streets[1]) || [];
    const n = b.poly.length;
    const ends = [
      { v: best.i, P: b.poly[(best.i - 1 + n) % n], Q: best.a, other: b.poly[(best.i - 1 + n) % n], awayA: best.dir },
      { v: (best.i + 1) % n, P: best.c, Q: b.poly[(best.i + 2) % n], other: b.poly[(best.i + 2) % n], awayA: [-best.dir[0], -best.dir[1]] },
    ];
    let pick = null;
    for (const e of ends) {
      const V = b.poly[e.v];
      const lenB = Math.hypot(e.other[0] - V[0], e.other[1] - V[1]);
      if (lenB < 3) continue;
      const ed = [(e.Q[0] - e.P[0]) / lenB, (e.Q[1] - e.P[1]) / lenB];
      const nB = cw ? [-ed[1], ed[0]] : [ed[1], -ed[0]];
      const mid = [(e.P[0] + e.Q[0]) / 2, (e.P[1] + e.Q[1]) / 2];
      const near = nearestOnLines(mid, lines2);
      if (!near || near.d > best.street + 10) continue;
      if (((near.q[0] - mid[0]) * nB[0] + (near.q[1] - mid[1]) * nB[1]) / (near.d || 1) < 0.5) continue;
      const toCorner = nearestOnLines(V, lines2).d;
      const awayB = [(e.other[0] - V[0]) / lenB, (e.other[1] - V[1]) / lenB];
      if (!pick || toCorner < pick.toCorner) pick = { v: e.v, awayA: e.awayA, awayB, nB, lenA: best.len, lenB, toCorner };
    }
    if (pick) best.corner = pick;
  }
  return best;
}

// ── Camera ──
function flyHome(instant = false) {
  const to = { pos: new THREE.Vector3(240, 560, 640), target: new THREE.Vector3(0, 0, 40) };
  fly(to, instant);
}

// How much of a facade the street trees hide from a camera: the share of sight lines, from the
// camera to points on the facade, that pass through a crown or a trunk. The trees stay; the camera
// looks for the gap between them.
function sightBlocked(pos, points) {
  const trees = three.trees || [];
  let blocked = 0;
  for (const q of points) {
    const x0 = Math.min(pos.x, q.x) - 12, x1 = Math.max(pos.x, q.x) + 12;
    const z0 = Math.min(pos.z, q.z) - 12, z1 = Math.max(pos.z, q.z) + 12;
    const dx = q.x - pos.x, dy = q.y - pos.y, dz = q.z - pos.z;
    for (const t of trees) {
      const tz = -t.y;
      if (t.x < x0 || t.x > x1 || tz < z0 || tz > z1) continue;
      // The crown, shrunk a little: its fringe is the part you see through.
      const rx = t.cr * 0.85, ry = t.cv * 0.85;
      const ax = (pos.x - t.x) / rx, ay = (pos.y - t.cc) / ry, az = (pos.z - tz) / rx;
      const bx = dx / rx, by = dy / ry, bz = dz / rx;
      const A = bx * bx + by * by + bz * bz, B = 2 * (ax * bx + ay * by + az * bz), C = ax * ax + ay * ay + az * az - 1;
      const disc = B * B - 4 * A * C;
      if (disc >= 0) {
        const r = Math.sqrt(disc), k0 = (-B - r) / (2 * A), k1 = (-B + r) / (2 * A);
        if (k1 > 0 && k0 < 1) { blocked++; break; }
      }
      // The trunk: closest approach in plan, below the crown.
      const L2 = dx * dx + dz * dz || 1;
      const k = Math.max(0, Math.min(1, ((t.x - pos.x) * dx + (tz - pos.z) * dz) / L2));
      if (Math.hypot(pos.x + k * dx - t.x, pos.z + k * dz - tz) < t.T + 0.2 && pos.y + k * dy < t.top) { blocked++; break; }
    }
  }
  return blocked / points.length;
}

// A trunk standing dead centre between the camera and what it looks at cuts the picture in half:
// a cost for each one, by how near the middle of the view it stands.
function trunksInMiddle(pos, target) {
  const vx = target.x - pos.x, vz = target.z - pos.z, D = Math.hypot(vx, vz) || 1;
  let cost = 0;
  for (const t of three.trees || []) {
    const tx = t.x - pos.x, tz = -t.y - pos.z;
    const ahead = (tx * vx + tz * vz) / D;
    if (ahead < 1 || ahead > D) continue;
    const ang = Math.abs(Math.atan2(tx * vz - tz * vx, tx * vx + tz * vz));
    if (ang < 0.2) cost += 1 - ang / 0.2;
  }
  return cost;
}

// Of several camera stands, the one that sees the most of the facade, then the one nearest the first.
function bestStand(stands, points, target = null) {
  let best = null;
  for (const s of stands) {
    const cost = sightBlocked(s.pos, points) * 10 + s.cost + (target ? trunksInMiddle(s.pos, target) * 2.5 : 0);
    if (!best || cost < best.cost) best = { ...s, cost };
  }
  return best;
}

function flyTo(p, view = null) {
  const f = p.front;
  let target, pos;
  const at = (q, h) => to3(q[0], q[1], h);
  const along = (o, d, n, a, b) => [o[0] + d[0] * a + n[0] * b, o[1] + d[1] * a + n[1] * b];
  if (view && f) {
    // Stand on the far side of the street at eye height, looking at the shop, between the trees.
    const stands = [];
    let points;
    if (view.corner) {
      const { V, nD } = view.corner;
      target = at([V[0] + nD[0] * 1.5, V[1] + nD[1] * 1.5], 1.95);
      for (const turn of [0, 0.18, -0.18, 0.35, -0.35]) for (const dist of [14, 11, 17]) {
        const c = Math.cos(turn), s2 = Math.sin(turn), dd = [nD[0] * c - nD[1] * s2, nD[0] * s2 + nD[1] * c];
        stands.push({ pos: at([V[0] + dd[0] * dist, V[1] + dd[1] * dist], 2.0), cost: Math.abs(turn) * 1.2 + Math.abs(dist - 14) * 0.08 });
      }
      points = [0.6, 2.2, 3.7].flatMap((h) => [-3, 0, 3].map((a) => at([V[0] - nD[1] * a * 0.7 + nD[0] * 0.5, V[1] + nD[0] * a * 0.7 + nD[1] * 0.5], h)));
    } else {
      const { o, d, n, W } = view.site;
      const back = Math.max(12, Math.min(19, f.street + 5));
      target = at(along(o, d, n, 0, 1.5), 1.95);
      for (const lat of [4.5, -4.5, 1.5, -1.5, 8, -8, 12, -12]) for (const b of [back, back - 3, back + 3, back + 7]) {
        stands.push({ pos: at(along(o, d, n, lat, b), 2.0), cost: Math.abs(lat - 4.5) * 0.05 + Math.abs(b - back) * 0.06 });
      }
      points = [0.8, 2.2, 3.7].flatMap((h) => [-0.35, 0, 0.35].map((a) => at(along(o, d, n, a * W, 0.6), h)));
    }
    pos = bestStand(stands, points, target).pos;
    fly({ pos, target });
    return;
  }
  if (f) {
    const mid = to3(f.mid[0], f.mid[1], 0);
    const n = new THREE.Vector3(f.n[0], 0, -f.n[1]);
    const u = new THREE.Vector3(f.dir[0], 0, -f.dir[1]);
    // Stand in the street, a little to one side, at about second-floor height; go higher or wider
    // where the street trees would hide the building.
    target = mid.clone().add(new THREE.Vector3(0, 3.2, 0)).addScaledVector(n, 2.2);
    const back = Math.max(19, Math.min(36, f.street + 10));
    const stands = [];
    for (const h of [7.5, 11, 15, 20, 26]) for (const s2 of [8, -8, 0, 16, -16]) for (const m of [1, 1.35]) {
      stands.push({ pos: mid.clone().addScaledVector(n, back * m).addScaledVector(u, s2).add(new THREE.Vector3(0, h, 0)),
        cost: (h - 7.5) * 0.07 + Math.abs(s2 - 8) * 0.03 + (m - 1) * 2 });
    }
    const top = Math.max(3, f.h || f.b.h);
    const points = [0.3, 0.65].flatMap((k) => [-0.35, 0, 0.35].map((a) => mid.clone().addScaledVector(u, a * f.len).addScaledVector(n, 0.3).add(new THREE.Vector3(0, top * k, 0))));
    pos = bestStand(stands, points).pos;
  } else {
    const [cx, cy] = polyCentroid(p.poly);
    target = to3(cx, cy, 0);
    pos = target.clone().add(new THREE.Vector3(30, 45, 45));
  }
  fly({ pos, target });
}

// (select() has an option named fly, so it moves the camera through this alias.)
const glide = (to, instant) => fly(to, instant);

function fly(to, instant = false) {
  const { camera, controls } = three;
  if (instant || REDUCE) {
    camera.position.copy(to.pos);
    controls.target.copy(to.target);
    controls.update();
    flight = null;
    return;
  }
  flight = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to, start: performance.now(), dur: 1300 };
}

// ── Kits ──
function std(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra }); }

function stripesTexture([a, b]) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 32, 0, 32, 32); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function lamp(g, x, y) {
  g.strokeStyle = 'rgba(40,25,10,0.7)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x, 0); g.lineTo(x, y - 12); g.stroke();
  const glow = g.createRadialGradient(x, y, 2, x, y, 34);
  glow.addColorStop(0, 'rgba(255,248,220,1)'); glow.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
}

function windowTexture(w) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = w.bg; g.fillRect(0, 0, 512, 256);
  if (w.kind === 'shelves') {
    const colors = ['#7a2430', '#2f4a3a', '#d9b46a', '#3d4f7a', '#a8643a', '#efe6d2', '#5b3a5e'];
    for (let row = 0; row < 4; row++) {
      let x = 6;
      while (x < 506) {
        const bw = 6 + Math.random() * 10;
        g.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        g.fillRect(x, 18 + row * 58, bw, 40 + Math.random() * 10);
        x += bw + 1;
      }
      g.fillStyle = '#5a3a1e'; g.fillRect(0, 60 + row * 58, 512, 6);
    }
  } else if (w.kind === 'counter') {
    // A coffee bar: pendant lamps, a menu board, the machine on the counter.
    g.fillStyle = '#3a2a1c'; g.fillRect(180, 22, 152, 70);
    g.fillStyle = '#efe6d2'; for (let i = 0; i < 4; i++) g.fillRect(196, 36 + i * 13, 70 + (i % 2) * 40, 4);
    lamp(g, 100, 40); lamp(g, 412, 40);
    g.fillStyle = '#6b4526'; g.fillRect(0, 186, 512, 70);
    g.fillStyle = '#b9b2a6'; g.fillRect(300, 150, 70, 38);
    g.fillStyle = '#e8e2d6'; for (let i = 0; i < 5; i++) g.fillRect(60 + i * 26, 172, 14, 14);
  } else if (w.kind === 'lamps') {
    // A bistro: low pendant light over tables, bottles along the back.
    g.fillStyle = '#7a3c18';
    for (let i = 0; i < 18; i++) g.fillRect(40 + i * 24, 92 + (i % 3) * 2, 9, 30);
    g.fillStyle = '#5a2b10'; g.fillRect(0, 124, 512, 8);
    for (let i = 0; i < 5; i++) lamp(g, 50 + i * 103, 52);
    g.fillStyle = '#4a2410';
    for (let i = 0; i < 4; i++) { g.fillRect(40 + i * 125, 200, 70, 8); g.fillRect(71 + i * 125, 208, 8, 48); }
  } else if (w.kind === 'desks') {
    // A studio: drawings pinned up, long desks with screens.
    g.strokeStyle = '#9aa4ad'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#ffffff'; g.fillRect(28 + i * 122, 26, 96, 70); g.strokeRect(28 + i * 122, 26, 96, 70);
      g.beginPath(); g.moveTo(40 + i * 122, 80); g.lineTo(70 + i * 122, 46); g.lineTo(110 + i * 122, 70); g.stroke();
    }
    g.fillStyle = '#5b6670';
    for (let i = 0; i < 2; i++) {
      g.fillRect(30 + i * 250, 178, 200, 8);
      g.fillRect(40 + i * 250, 186, 6, 70); g.fillRect(214 + i * 250, 186, 6, 70);
      g.fillStyle = '#2a3036'; g.fillRect(70 + i * 250, 134, 52, 38); g.fillRect(140 + i * 250, 134, 52, 38); g.fillStyle = '#5b6670';
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}


function table(top = 0xf2ece0) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 16), std(top));
  t.position.y = 0.74;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 6), std(0x2a2622));
  stem.position.y = 0.37;
  g.add(t, stem);
  for (const s of [-1, 1]) {
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.4), std(0x2a2622));
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.04), std(0x2a2622));
    back.position.set(0, 0.68, 0.2 * s);
    chair.add(seat, back);
    chair.position.z = 0.62 * s;
    g.add(chair);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function planter() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), std(0x6b5a46));
  box.position.y = 0.25;
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), std(0x55704a));
  leaves.position.y = 0.85;
  g.add(box, leaves);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function aFrame(text) {
  const g = new THREE.Group();
  const tex = textTexture(text, '600 70px "Cormorant Garamond", Georgia, serif', '#f3ede0', '#2b2b2b', 256, 256);
  for (const s of [-1, 1]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.03), [std(0x2b2b2b), std(0x2b2b2b), std(0x2b2b2b), std(0x2b2b2b), std(0xffffff, { map: tex }), std(0xffffff, { map: tex })]);
    board.position.set(0, 0.42, 0.13 * s);
    board.rotation.x = 0.2 * s;
    g.add(board);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function bookCart() {
  const g = new THREE.Group();
  const cart = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.6), std(0x5a3a1e));
  cart.position.y = 0.55;
  g.add(cart);
  const colors = [0x7a2430, 0x2f4a3a, 0xd9b46a, 0x3d4f7a, 0xa8643a, 0xefe6d2];
  for (let i = 0; i < 12; i++) {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.2), std(colors[i % colors.length]));
    book.position.set(-0.6 + i * 0.11, 1.03, 0);
    g.add(book);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function bench() {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.45), std(0x7a5a3a));
  seat.position.y = 0.45;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.05), std(0x7a5a3a));
  back.position.set(0, 0.72, -0.2);
  g.add(seat, back);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function bike() {
  const g = new THREE.Group();
  const wheelGeo = new THREE.TorusGeometry(0.33, 0.03, 6, 20);
  for (const x of [-0.5, 0.5]) {
    const w = new THREE.Mesh(wheelGeo, std(0x222222));
    w.position.set(x, 0.34, 0);
    g.add(w);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.05), std(0x2f6b8a));
  frame.position.y = 0.62;
  g.add(frame);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function stringLights(W, color) {
  const g = new THREE.Group();
  const bulb = new THREE.SphereGeometry(0.07, 8, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: color, emissiveIntensity: 2.2 });
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), std(0x2a2622));
    post.position.set(sx * W / 2, 1.6, 4.6);
    post.castShadow = true;
    g.add(post);
  }
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    const x = -W / 2 + k * W;
    const y = 3.15 - Math.sin(k * Math.PI) * 0.45;
    pts.push(new THREE.Vector3(x, y, 4.6));
  }
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    pts.push(new THREE.Vector3(-W / 2 + k * W, 3.1 - Math.sin(k * Math.PI) * 0.3, 2.4));
  }
  for (const p of pts) {
    const m = new THREE.Mesh(bulb, mat);
    m.position.copy(p);
    g.add(m);
  }
  g.userData.bulbs = mat;
  return g;
}


// ── Storefront architecture ──
// Grounded in Norfolk's Historic District Design Guidelines (adopted by the Architectural Review
// Board, May 26, 2026): keep doors and windows where they are on a primary elevation, keep front
// porches open, keep storefront glass transparent, canvas awnings shading the first floor, signs in
// sign bands, on windows and on awning panels, lit from outside. So the kind of storefront follows
// what the building already is (see variantFor):
//   shop    commercial buildings: the guidelines' 20th-century storefront (piers, bulkheads,
//           display glass, transom, sign band and cornice) with a recessed entry and splayed
//           display windows. The ground floor is notched and the animation pushes the entrance in.
//   corner  commercial buildings at the corner: the corner cut back at 45° on a cast-iron column,
//           the door on the diagonal, storefront bays down both streets.
//   porch   houses: the porch stays open and the windows and door stay put; the shop shows in lit,
//           lettered windows, a sign hung from the porch, tables on the porch.
//   flats   apartment buildings: their punched windows lit and lettered, the entry set back up a
//           few steps under a canvas canopy that carries the name.
// Variety (paint, trim, bay rhythm, entry position, columns) comes from a random seeded by the
// lot's GPIN, so a lot always gets the same storefront.

const HOUSE = /single family|duplex|triplex|fourplex/i;
const PAINTS = {
  coffee: ['#2f4a3a', '#34503c', '#2f5d62', '#3e5a3a'],
  books: ['#6b2430', '#5a2a2a', '#7a3b2e', '#4a2a3a'],
  bistro: ['#1f2a44', '#1a1714', '#3b2a3f', '#22313b'],
  studio: ['#1d1f22', '#2b2d31', '#3a3d42'],
};
const TRIMS = ['#efe6d2', '#e2d3ac', '#f6f1e7', '#c9b78a'];
const BRICKS = ['#8a4a36', '#9a5a40', '#7a3f30', '#a8705a'];
const ICONS = { coffee: 'cup', books: 'book', bistro: 'glass', studio: 'square' };

function rngFor(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickOf = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s];
const unit = (v) => { const L = Math.hypot(v[0], v[1]) || 1; return [v[0] / L, v[1] / L]; };

function variantFor(p, f) {
  const commercial = /commercial/i.test(p.use || '');
  // The guidelines care about the building, not the business. A commercial use in a house-sized
  // building from before the 1920s is a converted house and keeps its porch: 626 W Olney Rd, a
  // 1906 house that's now a restaurant, is the case in point.
  const convertedHouse = commercial && p.built && p.built < 1926 && Math.abs(polyArea(f.b.poly)) < 200;
  if (commercial && !convertedHouse) return f.corner ? 'corner' : 'shop';
  if (convertedHouse || HOUSE.test(p.use || '')) return 'porch';
  return 'flats';
}

// Gold-leaf lettering for a shop window: the name in an arc, on a transparent ground.
function letteringTex(text, font) {
  return canvasTex(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#d9b25a';
    g.strokeStyle = 'rgba(60,40,10,0.55)';
    g.lineWidth = 3;
    g.font = font.replace(/\d+px/, '64px');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const chars = [...text], R = 330, spread = Math.min(1.1, chars.length * 0.13);
    chars.forEach((ch, i) => {
      const a = -spread / 2 + (spread * (i + 0.5)) / chars.length;
      g.save();
      g.translate(w / 2 + Math.sin(a) * R, h / 2 + 300 - Math.cos(a) * R);
      g.rotate(a);
      g.strokeText(ch, 0, 0); g.fillText(ch, 0, 0);
      g.restore();
    });
  });
}

// A punched window as the building already has it: trim, sill and head, a lit double-hung sash.
function punchedWindow(ctx, parent, cx, sill, w, h, look, lettering = null) {
  const M = look.mats;
  const g = new THREE.Group();
  g.position.set(cx, 0, 0);
  box(g, w + 0.24, 0.1, 0.18, 0, sill - 0.05, 0.08, M.trim);
  box(g, w + 0.3, 0.16, 0.12, 0, sill + h + 0.08, 0.06, M.trim);
  for (const sd of [-1, 1]) box(g, 0.1, h, 0.1, sd * (w / 2 + 0.05), sill + h / 2, 0.05, M.trim);
  const glass = box(g, w, h, 0.04, 0, sill + h / 2, 0.02, M.glass, false);
  ctx.glass.push(glass.material);
  box(g, w, 0.06, 0.07, 0, sill + h * 0.52, 0.05, M.trim, false);
  if (lettering) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, w * 0.46), new THREE.MeshBasicMaterial({ map: lettering, transparent: true, depthWrite: false }));
    plane.position.set(0, sill + h * 0.3, 0.06);
    g.add(plane);
  }
  parent.add(g);
  return g;
}

// The ground-floor footprint with an entry notch cut into edge i, between s0 and s1 metres
// from its start, `depth` deep, the sides splayed by `splay`.
function notchPoly(poly, i, s0, s1, depth, splay) {
  const a = poly[i], c = poly[(i + 1) % poly.length];
  const dir = unit(sub(c, a));
  const inward = polyArea(poly) < 0 ? [dir[1], -dir[0]] : [-dir[1], dir[0]];
  const p1 = add(a, dir, s0), p2 = add(a, dir, s1);
  const d = Math.max(0.02, depth);
  const p1i = add(add(p1, dir, splay * (d / Math.max(depth, 0.02))), inward, d);
  const p2i = add(add(p2, dir, -splay * (d / Math.max(depth, 0.02))), inward, d);
  return [...poly.slice(0, i + 1), p1, p1i, p2i, p2, ...poly.slice(i + 1)];
}

// The footprint with corner v cut back k metres along both edges.
function chamferPoly(poly, v, k) {
  const n = poly.length, V = poly[v];
  const prev = poly[(v - 1 + n) % n], next = poly[(v + 1) % n];
  const kk = Math.max(0.02, k);
  return [...poly.slice(0, v), add(V, unit(sub(prev, V)), kk), add(V, unit(sub(next, V)), kk), ...poly.slice(v + 1)];
}

function extrudeMesh(poly, y0, y1, mat) {
  const g = new THREE.ExtrudeGeometry(shapeOf(poly), { depth: y1 - y0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.y = y0;
  m.castShadow = m.receiveShadow = true;
  return m;
}

// A group standing on the ground at 2D point o, local x along 2D direction d, local z along the
// outward normal n, y up. If that basis would be left-handed, x runs along -d instead (flipped).
function frame(o, d, n) {
  const g = new THREE.Group();
  const u = new THREE.Vector3(d[0], 0, -d[1]);
  const w = new THREE.Vector3(n[0], 0, -n[1]);
  const up = new THREE.Vector3(0, 1, 0);
  let flipped = false;
  if (new THREE.Vector3().crossVectors(u, up).dot(w) < 0) { u.negate(); flipped = true; }
  g.position.copy(to3(o[0], o[1], 0));
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, up, w));
  return { g, flipped };
}

function box(parent, w, h, d, x, y, z, mat, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// A thin slab standing on the line from (x0, z0) to (x1, z1) in a frame's ground plane.
function slab(parent, x0, z0, x1, z1, y0, y1, t, mat) {
  const L = Math.hypot(x1 - x0, z1 - z0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(L, y1 - y0, t), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A painted sign band: the shop's name in the trim colour on the paint colour, sized to the band.
function signBandTex(text, font, paint, trim, aspect) {
  const h = 128, w = Math.max(256, Math.min(2048, Math.round(h * aspect)));
  return canvasTex(w, h, (g) => {
    g.fillStyle = paint; g.fillRect(0, 0, w, h);
    g.strokeStyle = trim; g.lineWidth = 4; g.strokeRect(8, 10, w - 16, h - 20);
    g.fillStyle = trim;
    g.font = font.replace(/\d+px/, '78px');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}

function iconTex(kind, paint, trim) {
  return canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = paint; g.fillRect(0, 0, w, h);
    g.strokeStyle = trim; g.fillStyle = trim; g.lineWidth = 9; g.lineCap = 'round';
    g.strokeRect(10, 10, w - 20, h - 20);
    const cx = w / 2, cy = h / 2;
    g.beginPath();
    if (kind === 'cup') {
      g.moveTo(cx - 40, cy - 22); g.lineTo(cx - 32, cy + 32); g.lineTo(cx + 32, cy + 32); g.lineTo(cx + 40, cy - 22); g.closePath(); g.fill();
      g.beginPath(); g.arc(cx + 48, cy, 16, -Math.PI / 2, Math.PI / 2); g.stroke();
      g.beginPath(); g.moveTo(cx - 14, cy - 34); g.quadraticCurveTo(cx - 4, cy - 48, cx - 14, cy - 62); g.moveTo(cx + 10, cy - 34); g.quadraticCurveTo(cx + 20, cy - 48, cx + 10, cy - 62); g.stroke();
    } else if (kind === 'book') {
      g.moveTo(cx, cy - 30); g.lineTo(cx - 62, cy - 40); g.lineTo(cx - 62, cy + 34); g.lineTo(cx, cy + 44); g.lineTo(cx + 62, cy + 34); g.lineTo(cx + 62, cy - 40); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(cx, cy - 30); g.lineTo(cx, cy + 44); g.stroke();
    } else if (kind === 'glass') {
      g.moveTo(cx - 30, cy - 50); g.quadraticCurveTo(cx - 30, cy + 4, cx, cy + 6); g.quadraticCurveTo(cx + 30, cy + 4, cx + 30, cy - 50); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx, cy + 6); g.lineTo(cx, cy + 42); g.moveTo(cx - 24, cy + 46); g.lineTo(cx + 24, cy + 46); g.stroke();
    } else {
      g.strokeRect(cx - 40, cy - 40, 80, 80); g.beginPath(); g.moveTo(cx - 40, cy + 40); g.lineTo(cx + 40, cy - 40); g.stroke();
    }
  });
}

function valanceTex(stripes, paint) {
  const t = canvasTex(256, 48, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = stripes ? stripes[i % 2] : paint; g.fillRect(i * 32, 0, 32, h); }
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(i * 32 + 16, h + 4, 14, 0, Math.PI * 2); g.fill(); }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function mosaicTex() {
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#efe8da'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#2b2622'; g.lineWidth = 2;
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { g.strokeRect(x * 30 + (y % 2) * 15 - 15, y * 30, 30, 30); }
    g.strokeStyle = '#6b2430'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, w - 24);
  });
}

function transomTex() {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#f4e3bd'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#7a6a4a'; g.lineWidth = 2;
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}

// One storefront run along a facade: from 2D point S, `L` metres along d, facing n. Heights hang
// from the storefront top ST (the foot of the sign band), so a low ground floor gets shorter glass.
// entry: { at, w, depth, splay } in metres along the run (the building is notched to match).
function buildRun(ctx, S, d, n, L, opts) {
  const { kit, look, G, entry } = opts;
  const flip = isFlipped(d, n);
  const { g } = frame(flip ? add(S, d, L) : S, d, n);   // flipped frames run x from the far end
  const X = (r) => (flip ? L - r : r);
  const M = look.mats;
  const ST = G - 0.62;
  const glassTop = ST - 0.55;

  // Bays: piers about 3.3 m apart; the entry takes its own span.
  const nb = Math.max(1, Math.round(L / 3.3));
  const bounds = Array.from({ length: nb + 1 }, (_, i) => (L * i) / nb);
  const e0 = entry ? entry.at - entry.w / 2 : null, e1 = entry ? entry.at + entry.w / 2 : null;
  const spans = [];
  for (let i = 0; i < nb; i++) {
    const a = bounds[i], b = bounds[i + 1];
    if (entry && b > e0 && a < e1) {
      if (e0 - a > 0.9) spans.push([a, e0 - 0.18]);
      if (b - e1 > 0.9) spans.push([e1 + 0.18, b]);
      continue;
    }
    spans.push([a, b]);
  }
  const piers = new Set(bounds.filter((x) => !entry || x <= e0 - 0.3 || x >= e1 + 0.3));
  if (entry) { piers.add(e0 - 0.18); piers.add(e1 + 0.18); }

  const grow = [];   // [mesh, delay]: rises into place
  for (const x of piers) {
    grow.push([box(g, 0.36, ST, 0.22, X(x), ST / 2, 0.09, M.pier), 0]);
    grow.push([box(g, 0.3, 0.26, 0.3, X(x), ST - 0.1, 0.18, M.trim), 0.1]);
  }
  for (const [a0, b0] of spans) {
    const a = a0 + 0.2, b = b0 - 0.2, w = b - a, cx = X((a + b) / 2);
    if (w < 0.6) continue;
    grow.push([box(g, w, 0.55, 0.14, cx, 0.275, 0.06, M.paint), 0.05]);
    if (look.bulk === 'panel') grow.push([box(g, w - 0.2, 0.34, 0.02, cx, 0.28, 0.14, M.trim, false), 0.08]);
    grow.push([box(g, w + 0.1, 0.07, 0.24, cx, 0.58, 0.08, M.trim), 0.08]);
    const glass = box(g, w, glassTop - 0.62, 0.05, cx, (glassTop + 0.62) / 2, 0.03, M.glass, false);
    ctx.glass.push(glass.material);
    grow.push([glass, 0.1]);
    if (w > 2.4) grow.push([box(g, 0.07, glassTop - 0.62, 0.08, cx, (glassTop + 0.62) / 2, 0.06, M.paint), 0.12]);
    grow.push([box(g, w + 0.05, 0.08, 0.12, cx, glassTop + 0.04, 0.06, M.paint), 0.12]);
    grow.push([box(g, w, 0.42, 0.04, cx, ST - 0.26, 0.03, M.transom, false), 0.14]);
    if (look.awning) {   // a canvas awning per bay, with a scalloped valance
      const pivot = new THREE.Group();
      pivot.position.set(cx, ST - 0.02, 0.14);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.03, 1.25), M.awning);
      deck.position.z = 0.62;
      deck.castShadow = true;
      const val = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.15, 0.24), M.valance);
      val.position.set(0, -0.12, 1.25);
      pivot.add(deck, val);
      pivot.rotation.x = -Math.PI / 2;
      pivot.visible = false;
      g.add(pivot);
      ctx.awnings.push([pivot, look.awnTilt]);
    }
  }

  if (entry) {
    const D = entry.depth, sp = entry.splay;
    const x0 = X(e0), x1 = X(e1), xi0 = X(e0 + sp), xi1 = X(e1 - sp), xm = X(entry.at);
    for (const [xa, xb] of [[x0, xi0], [x1, xi1]]) {   // splayed display windows leading in
      grow.push([slab(g, xa, 0, xb, -D, 0, 0.55, 0.12, M.paint), 0.12]);
      const gl = slab(g, xa, 0, xb, -D, 0.6, glassTop, 0.05, M.glass);
      ctx.glass.push(gl.material);
      grow.push([gl, 0.14]);
      grow.push([slab(g, xa, 0, xb, -D, glassTop + 0.06, ST, 0.04, M.transom), 0.16]);
    }
    // The door at the back of the recess: a painted leaf with a glass light, under a transom.
    const back = Math.abs(xi1 - xi0);
    const door = new THREE.Group();
    door.position.set(xm, 0, -D + 0.04);
    box(door, 0.98, 2.24, 0.06, 0, 1.12, 0, M.paint);
    ctx.glass.push(box(door, 0.66, 1.2, 0.02, 0, 1.45, 0.04, M.glass, false).material);
    box(door, 0.06, 0.06, 0.08, 0.36, 1.05, 0.07, M.brass, false);
    box(door, 0.9, 0.18, 0.02, 0, 0.14, 0.04, M.brass, false);
    box(door, Math.max(1.0, back), 0.1, 0.12, 0, 2.3, 0, M.trim);
    box(door, Math.max(1.0, back), ST - 2.36, 0.04, 0, (2.36 + ST) / 2, 0, M.transom, false);
    if (back > 1.5) for (const sd of [-1, 1]) ctx.glass.push(box(door, (back - 1.1) / 2, 2.2, 0.04, sd * (0.55 + (back - 1.1) / 4), 1.12, 0, M.glass, false).material);
    g.add(door);
    grow.push([door, 0.16]);
    // Mosaic underfoot and a ceiling overhead, the vestibule's own small room.
    const shape = new THREE.Shape([new THREE.Vector2(x0, 0), new THREE.Vector2(x1, 0), new THREE.Vector2(xi1, D), new THREE.Vector2(xi0, D)]);
    for (const [y, mat] of [[0.02, M.mosaic], [ST, M.trim]]) {
      const plane = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
      plane.rotation.x = y > 1 ? Math.PI / 2 : -Math.PI / 2;
      if (y > 1) plane.scale.y = -1;
      plane.position.y = y;
      plane.receiveShadow = true;
      g.add(plane);
    }
    for (const xs of [X(e0 - 0.18), X(e1 + 0.18)]) {   // sconces either side
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), M.lantern);
      lamp.position.set(xs, Math.min(2.25, ST - 0.5), 0.32);
      g.add(lamp);
      ctx.lanterns.push(lamp);
    }
  }

  // Gooseneck lamps over the sign band: the guidelines want signs lit from outside.
  const nGoose = Math.max(2, Math.round(L / 2.6));
  for (let i = 0; i < nGoose; i++) {
    const gx = X(((i + 0.5) * L) / nGoose);
    const arm = box(g, 0.035, 0.035, 0.55, gx, G + 0.12, 0.38, M.iron, false);
    arm.rotation.x = -0.35;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.14, 10, 1, true), M.lantern);
    shade.position.set(gx, G + 0.02, 0.62);
    g.add(shade);
    ctx.lanterns.push(shade);
  }

  // The sign band and cornice over the whole run.
  const band = box(g, L - 0.1, 0.56, 0.12, X(L / 2), ST + 0.28, 0.16, new THREE.MeshStandardMaterial({
    map: signBandTex(kit.sign, kit.signFont, look.paint, look.trim, (L - 0.1) / 0.56), roughness: 0.7,
  }));
  band.scale.x = 0.001;
  ctx.bands.push(band);
  grow.push([box(g, L + 0.3, 0.16, 0.42, X(L / 2), G - 0.04, 0.2, M.trim), 0.2]);

  for (const [m] of grow) m.scale.y = 0.001;
  ctx.grow.push(...grow);
  return g;
}

// frame() flips x when (d, up, n) would be left-handed; a flipped run is placed from its far end.
function isFlipped(d, n) {
  const u = new THREE.Vector3(d[0], 0, -d[1]), w = new THREE.Vector3(n[0], 0, -n[1]);
  return new THREE.Vector3().crossVectors(u, new THREE.Vector3(0, 1, 0)).dot(w) < 0;
}

function bladeSign(ctx, parent, x, y, z, kit, look) {
  const arm = new THREE.Group();
  arm.position.set(x, y, z);
  box(arm, 0.05, 0.05, 1.05, 0, 0, 0.52, look.mats.iron);
  box(arm, 0.04, 0.4, 0.04, 0, -0.18, 0.05, look.mats.iron);
  const icon = new THREE.MeshStandardMaterial({ map: iconTex(ICONS[kit.id], look.paint, look.trim) });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.46, 0.62), [icon, icon, look.mats.paint, look.mats.paint, look.mats.paint, look.mats.paint]);
  panel.position.set(0, -0.32, 0.62);
  panel.castShadow = true;
  arm.add(panel);
  parent.add(arm);
  ctx.blades.push(arm);
}

function sidewalk(parent, x0, x1, z0, z1) {
  const tex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = DARK ? '#3a352d' : '#ece4d2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = DARK ? '#2a261f' : '#d6cbb2'; g.lineWidth = 2;
    for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(Math.abs(x1 - x0) / 12, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)), new THREE.MeshLambertMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, 0.03, (z0 + z1) / 2);
  m.receiveShadow = true;
  parent.add(m);
  const curb = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), 0.14, 0.18), std(DARK ? 0x4a443a : 0xd9cfb9));
  curb.position.set((x0 + x1) / 2, 0.07, Math.max(z0, z1));
  curb.receiveShadow = true;
  parent.add(curb);
}

function looksFor(p, kit) {
  const rng = rngFor(`${p.gpin}:${kit.id}`);
  const paint = pickOf(rng, PAINTS[kit.id]);
  const trim = kit.id === 'studio' ? '#d9d6cf' : pickOf(rng, TRIMS);
  const brick = pickOf(rng, BRICKS);
  const look = {
    rng, paint, trim, brick,
    bulk: kit.id === 'studio' ? 'plain' : pickOf(rng, ['panel', 'panel', 'brick']),
    awning: kit.id !== 'studio' && rng() < 0.85,
    awnTilt: 0.32 + rng() * 0.12,
    columns: pickOf(rng, ['round', 'round', 'pier']),
  };
  const glow = kit.glow;
  look.mats = {
    paint: std(paint, { roughness: 0.55 }),
    trim: std(trim, { roughness: 0.6 }),
    pier: look.bulk === 'brick' || rng() < 0.5 ? std(brick, { roughness: 0.9 }) : std(paint, { roughness: 0.55 }),
    glass: std(kit.glass, { emissive: 0xffffff, emissiveIntensity: 0, emissiveMap: windowTexture(kit.window), roughness: 0.2 }),
    transom: std(0x3a2f22, { emissive: 0xffffff, emissiveIntensity: 0, emissiveMap: transomTex(), roughness: 0.3 }),
    brass: std(0xb8913f, { metalness: 0.7, roughness: 0.35 }),
    iron: std(0x1d1b19, { metalness: 0.5, roughness: 0.5 }),
    lantern: new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: glow, emissiveIntensity: 0 }),
    mosaic: new THREE.MeshLambertMaterial({ map: mosaicTex() }),
    awning: kit.stripes ? std(0xffffff, { map: stripesTexture(kit.stripes), side: THREE.DoubleSide }) : std(paint, { side: THREE.DoubleSide }),
    valance: new THREE.MeshStandardMaterial({ map: valanceTex(kit.stripes, paint), transparent: true, side: THREE.DoubleSide, alphaTest: 0.4 }),
    deck: std(DARK ? 0x6b6458 : 0x8c8478),
    white: std(0xf4efe4),
  };
  look.mats.glass.userData.peak = 0.85;
  look.mats.transom.userData.peak = 0.6;
  return look;
}

// ── The three storefronts ──
function shopFront(ctx, p, f, kit, look) {
  const b = f.b, G = f.G;
  const m = 0.35;
  const L = Math.min(f.len - 2 * m, 12.5);
  const sStart = (f.len - L) / 2;
  const S = add(f.a, f.dir, sStart);
  const rng = look.rng;
  const nb = Math.max(1, Math.round(L / 3.3));
  const slots = nb >= 3 ? [0.5, 1, nb - 1, nb - 0.5].map((k) => (L * k) / nb) : [L / 2];
  const at = L < 4.2 ? L / 2 : pickOf(rng, slots.filter((x) => x > 1.4 && x < L - 1.4).concat([L / 2]));
  const entry = { at, w: 2.1, depth: 1.35, splay: 0.42 };
  // The notch, animated from flush to full depth.
  ctx.ground = (k) => notchPoly(b.poly, f.i, sStart + at - entry.w / 2, sStart + at + entry.w / 2, entry.depth * k, entry.splay);
  ctx.root.add(buildRun(ctx, S, f.dir, f.n, L, { kit, look, G, entry }));
  const { g } = frame(f.mid, f.dir, f.n);
  ctx.root.add(g);
  const flip = isFlipped(f.dir, f.n) ? -1 : 1;
  bladeSign(ctx, g, flip * (sStart + at + entry.w / 2 + 0.18 - f.len / 2), G - 1.1, 0.2, kit, look);
  return { site: { o: add(f.a, f.dir, sStart + L / 2), d: f.dir, n: f.n, W: L, front: 1.6 } };
}

function cornerShop(ctx, p, f, kit, look) {
  const b = f.b, G = f.G, c = f.corner;
  const k = 1.8;
  const V = b.poly[c.v];
  ctx.ground = (t) => chamferPoly(b.poly, c.v, k * t);
  // The column under the corner.
  const col = new THREE.Group();
  col.position.copy(to3(V[0], V[1], 0));
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, G - 0.35, 12), look.mats.iron);
  shaft.position.y = (G - 0.35) / 2 + 0.15;
  shaft.castShadow = true;
  col.add(shaft);
  box(col, 0.42, 0.15, 0.42, 0, 0.075, 0, look.mats.iron);
  box(col, 0.4, 0.2, 0.4, 0, G - 0.12, 0, look.mats.iron);
  col.scale.y = 0.001;
  ctx.root.add(col);
  ctx.grow.push([col, 0.05]);
  // Storefront runs down both streets, away from the corner.
  const runs = [[c.awayA, f.n, c.lenA], [c.awayB, c.nB, c.lenB]];
  for (const [away, n, len] of runs) {
    const L = Math.min(len - k - 0.3, 8.5);
    if (L < 1.8) continue;
    ctx.root.add(buildRun(ctx, add(V, away, k + 0.05), away, n, L, { kit, look, G, entry: null }));
  }
  // The door on the diagonal, with sidelights and a transom, and mosaic underfoot.
  const V1 = add(V, c.awayA, k), V2 = add(V, c.awayB, k);
  const nD = unit(add(f.n, c.nB));
  const mid = [(V1[0] + V2[0]) / 2, (V1[1] + V2[1]) / 2];
  const dD = unit(sub(V2, V1));
  const { g } = frame(add(mid, nD, -0.12), dD, nD);
  const Wd = Math.hypot(V2[0] - V1[0], V2[1] - V1[1]);
  box(g, 1.0, 2.26, 0.07, 0, 1.13, 0, look.mats.paint);
  const lite = box(g, 0.68, 1.25, 0.02, 0, 1.45, 0.05, look.mats.glass, false);
  ctx.glass.push(lite.material);
  box(g, 0.06, 0.06, 0.08, 0.37, 1.05, 0.08, look.mats.brass, false);
  for (const s of [-1, 1]) { const sl = box(g, (Wd - 1.1) / 2, 2.2, 0.04, s * (0.55 + (Wd - 1.1) / 4), 1.12, 0, look.mats.glass, false); ctx.glass.push(sl.material); }
  box(g, Wd, 0.1, 0.12, 0, 2.31, 0, look.mats.trim);
  box(g, Wd, 0.62, 0.04, 0, 2.68, 0, look.mats.transom, false);
  const band = box(g, Wd, 0.56, 0.12, 0, G - 0.34, 0.08, new THREE.MeshStandardMaterial({ map: signBandTex(kit.sign, kit.signFont, look.paint, look.trim, Wd / 0.56) }));
  band.scale.x = 0.001;
  ctx.bands.push(band);
  ctx.root.add(g);
  ctx.grow.push([g, 0.18]);
  g.scale.y = 0.001;
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([V, V1, V2].map(([x, y]) => new THREE.Vector2(x, y)))), look.mats.mosaic);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  ctx.root.add(floor);
  // A blade sign off the corner, turned to be read from both streets.
  const { g: cg } = frame(V, unit(sub(V2, V1)), nD);
  ctx.root.add(cg);
  bladeSign(ctx, cg, 0, G - 0.9, 0.3, kit, look);
  const LA = Math.max(2, Math.min(c.lenA - k - 0.3, 8.5));
  return { site: { o: add(V, c.awayA, k + LA / 2), d: c.awayA, n: f.n, W: LA, front: 1.6 }, corner: { V, nD } };
}

function porchShop(ctx, p, f, kit, look) {
  const rng = look.rng;
  const len = f.len;
  const Wp = Math.max(4, Math.min(len - 0.6, 10));
  const depth = 2.4 + rng() * 0.6;
  const deckH = 0.95 + rng() * 0.25;
  const roofY = deckH + 2.75;
  const { g, flipped } = frame(f.mid, f.dir, f.n);
  const X = (v) => (flipped ? -v : v);
  const M = look.mats;
  // Door and steps share a line: the middle, or one side for wider porches.
  const doorS = Wp > 6.5 ? pickOf(rng, [0, -Wp / 3.2, Wp / 3.2]) : 0;   // along the edge, from its middle
  const xd = X(doorS);
  // The door is set back into the house; the notch is cut where the door is.
  ctx.ground = (t) => notchPoly(f.b.poly, f.i, len / 2 + doorS - 0.7, len / 2 + doorS + 0.7, 0.6 * t, 0);
  ctx.groundTop = roofY + 0.2;

  const base = box(g, Wp, deckH, depth, 0, deckH / 2, depth / 2, std(look.brick, { roughness: 0.9 }));
  const deck = box(g, Wp + 0.12, 0.08, depth + 0.1, 0, deckH, depth / 2 + 0.02, M.deck);
  ctx.grow.push([base, 0], [deck, 0.02]);
  base.scale.y = deck.scale.y = 0.001;

  // Columns along the front edge.
  const nc = Wp > 7.5 ? 4 : 3;
  const xs = Array.from({ length: nc }, (_, i) => -Wp / 2 + 0.3 + (i * (Wp - 0.6)) / (nc - 1));
  const colGroup = new THREE.Group();
  for (const x of xs) {
    if (look.columns === 'pier') {
      box(colGroup, 0.44, 0.95, 0.44, x, deckH + 0.475, depth - 0.25, std(look.brick, { roughness: 0.9 }));
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, roofY - deckH - 0.95, 10), M.white);
      c.position.set(x, deckH + 0.95 + (roofY - deckH - 0.95) / 2, depth - 0.25);
      c.castShadow = true;
      colGroup.add(c);
    } else {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, roofY - deckH, 14), M.white);
      c.position.set(x, deckH + (roofY - deckH) / 2, depth - 0.25);
      c.castShadow = true;
      colGroup.add(c);
    }
  }
  g.add(colGroup);
  colGroup.scale.y = 0.001;
  colGroup.position.y = 0;
  ctx.grow.push([colGroup, 0.15]);

  // Balustrade between columns, leaving the stair open.
  const rails = new THREE.Group();
  const stairW = 1.7;
  const runs = [];
  for (let i = 0; i < xs.length - 1; i++) {
    let a = xs[i] + 0.16, b = xs[i + 1] - 0.16;
    if (xd + stairW / 2 > a && xd - stairW / 2 < b) {
      if (xd - stairW / 2 - a > 0.4) runs.push([a, xd - stairW / 2]);
      if (b - (xd + stairW / 2) > 0.4) runs.push([xd + stairW / 2, b]);
    } else runs.push([a, b]);
  }
  const baluster = new THREE.BoxGeometry(0.045, 0.7, 0.045);
  const count = runs.reduce((s, [a, b]) => s + Math.floor((b - a) / 0.14), 0) + 2 * Math.floor(depth / 0.14);
  const inst = new THREE.InstancedMesh(baluster, M.white, Math.max(1, count));
  let k = 0;
  const m4 = new THREE.Matrix4();
  for (const [a, b] of runs) {
    box(rails, b - a, 0.07, 0.1, (a + b) / 2, deckH + 0.86, depth - 0.25, M.white);
    box(rails, b - a, 0.05, 0.08, (a + b) / 2, deckH + 0.12, depth - 0.25, M.white);
    for (let x = a + 0.07; x < b; x += 0.14) inst.setMatrixAt(k++, m4.makeTranslation(x, deckH + 0.48, depth - 0.25));
  }
  for (const s of [-1, 1]) {
    box(rails, 0.1, 0.07, depth - 0.3, s * (Wp / 2 - 0.05), deckH + 0.86, (depth - 0.3) / 2, M.white);
    for (let z = 0.1; z < depth - 0.3; z += 0.14) inst.setMatrixAt(k++, m4.makeTranslation(s * (Wp / 2 - 0.05), deckH + 0.48, z));
  }
  inst.count = k;
  inst.castShadow = true;
  rails.add(inst);
  rails.visible = false;
  g.add(rails);
  ctx.reveal.push([rails, 0.3]);

  // Roof and a plain fascia: the porch keeps its look; the sign hangs from it instead.
  const roof = box(g, Wp + 0.5, 0.16, depth + 0.4, 0, roofY + 0.08, (depth + 0.4) / 2 - 0.1, M.trim);
  box(roof, Wp + 0.5, 0.3, 0.08, 0, -0.18, (depth + 0.4) / 2 + 0.05, M.trim);
  roof.visible = false;
  ctx.reveal.push([roof, 0.32]);

  // Steps from the walk up to the porch, between brick cheek walls.
  const rise = 0.18, run = 0.3, nSteps = Math.ceil(deckH / rise);
  const stairs = new THREE.Group();
  for (let i = 1; i <= nSteps; i++) {
    const h = Math.min(deckH, i * rise);
    box(stairs, stairW, h, run, xd, h / 2, depth + (nSteps - i + 0.5) * run, std(look.brick, { roughness: 0.9 }));
  }
  for (const s of [-1, 1]) box(stairs, 0.3, deckH + 0.1, nSteps * run, xd + s * (stairW / 2 + 0.15), (deckH + 0.1) / 2, depth + (nSteps * run) / 2, std(look.brick, { roughness: 0.9 }));
  stairs.scale.y = 0.001;
  g.add(stairs);
  ctx.grow.push([stairs, 0.05]);

  // The house's windows either side of the door, where they are: lit, one lettered.
  const front = new THREE.Group();
  const lettering = letteringTex(kit.sign, kit.signFont);
  const winW = 0.95, winH = 1.85;
  const slots = [];
  for (let x = xd - 1.5; x > -Wp / 2 + 0.7; x -= 1.7) slots.push(x);
  for (let x = xd + 1.5; x < Wp / 2 - 0.7; x += 1.7) slots.push(x);
  slots.sort((a, b) => Math.abs(a - xd) - Math.abs(b - xd));
  slots.slice(0, 4).forEach((x, i) => punchedWindow(ctx, front, x, deckH + 0.55, winW, winH, look, i === 0 ? lettering : null));
  const door = new THREE.Group();
  door.position.set(xd, deckH, -0.56);
  box(door, 0.98, 2.24, 0.06, 0, 1.12, 0, M.paint);
  const lite = box(door, 0.62, 1.15, 0.02, 0, 1.45, 0.04, M.glass, false);
  ctx.glass.push(lite.material);
  box(door, 0.06, 0.06, 0.08, 0.36, 1.05, 0.07, M.brass, false);
  box(door, 1.3, 0.5, 0.04, 0, 2.55, 0, M.transom, false);
  front.add(door);
  g.add(front);
  front.scale.y = 0.001;
  ctx.grow.push([front, 0.12]);
  for (const s of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), M.lantern);
    lamp.position.set(xd + s * 0.95, deckH + 2.1, 0.2);
    g.add(lamp);
    ctx.lanterns.push(lamp);
  }
  ctx.root.add(g);
  bladeSign(ctx, g, xd + (xd > 0 ? -1 : 1) * (stairW / 2 + 0.3), roofY - 0.25, depth - 0.25, kit, look);
  return { site: { o: f.mid, d: f.dir, n: f.n, W: Wp, front: depth + nSteps * run + 0.6 }, deckH, depth, xd, porch: true };
}

function flatsShop(ctx, p, f, kit, look) {
  const rng = look.rng;
  const len = f.len;
  const L = Math.min(len - 0.8, 16);
  const { g, flipped } = frame(f.mid, f.dir, f.n);
  const X = (v) => (flipped ? -v : v);
  const M = look.mats;
  const rise = 0.18, nSteps = 3, floorY = rise * nSteps;
  const entryS = L < 7 ? 0 : pickOf(rng, [0, -L / 4, L / 4]);   // along the edge, from its middle
  const xe = X(entryS), D = 1.1, We = 1.9;
  ctx.ground = (t) => notchPoly(f.b.poly, f.i, len / 2 + entryS - We / 2, len / 2 + entryS + We / 2, D * t, 0);

  // Steps up into the recess, the door at the back, a stone lintel across the opening.
  const entry = new THREE.Group();
  for (let i = 1; i <= nSteps; i++) box(entry, We - 0.1, i * rise, 0.32, xe, (i * rise) / 2, 0.16 + (nSteps - i) * 0.32, M.deck);
  box(entry, We - 0.1, floorY, D, xe, floorY / 2, -D / 2, M.deck);
  const door = new THREE.Group();
  door.position.set(xe, floorY, -D + 0.04);
  box(door, 1.0, 2.24, 0.06, 0, 1.12, 0, M.paint);
  ctx.glass.push(box(door, 0.66, 1.2, 0.02, 0, 1.45, 0.04, M.glass, false).material);
  box(door, 0.06, 0.06, 0.08, 0.37, 1.05, 0.07, M.brass, false);
  box(door, We - 0.1, 0.45, 0.04, 0, 2.5, 0, M.transom, false);
  entry.add(door);
  box(entry, We + 0.3, 0.3, 0.3, xe, floorY + 2.95, 0.1, M.trim);
  box(entry, We, 0.05, D, xe, floorY + 2.78, -D / 2, M.trim, false);
  g.add(entry);
  entry.scale.y = 0.001;
  ctx.grow.push([entry, 0.04]);
  for (const sd of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), M.lantern);
    lamp.position.set(xe + sd * (We / 2 + 0.3), floorY + 2.0, 0.2);
    g.add(lamp);
    ctx.lanterns.push(lamp);
  }

  // A canvas canopy over the steps, the name on its valance (signs on awning panels).
  const can = new THREE.Group();
  can.position.set(xe, floorY + 3.15, 0.1);
  const canW = We + 0.7, canD = 1.7;
  const top = new THREE.Mesh(new THREE.BoxGeometry(canW, 0.04, canD), M.awning);
  top.position.set(0, -0.18, canD / 2);
  top.rotation.x = 0.22;
  const vTex = signBandTex(kit.sign, kit.signFont, look.paint, look.trim, canW / 0.3);
  const val = new THREE.Mesh(new THREE.BoxGeometry(canW, 0.3, 0.03), new THREE.MeshStandardMaterial({ map: vTex }));
  val.position.set(0, -0.52, canD - 0.05);
  for (const sd of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, canD), M.awning);
    side.position.set(sd * canW / 2, -0.37, canD / 2);
    can.add(side);
  }
  can.add(top, val);
  can.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  can.scale.set(1, 1, 0.001);
  g.add(can);
  ctx.grow.push([can, 0.25]);
  ctx.canopy = can;

  // The ground-floor windows in a steady rhythm either side of the entry: lit, two lettered,
  // and on some buildings canvas window awnings.
  const lettering = letteringTex(kit.sign, kit.signFont);
  const sill = floorY + 0.75, winW = 1.0, winH = 1.75;
  const xs = [];
  for (let x = entryS - We / 2 - 1.3; x > -L / 2 + 0.6; x -= 2.3) xs.push(x);
  for (let x = entryS + We / 2 + 1.3; x < L / 2 - 0.6; x += 2.3) xs.push(x);
  xs.sort((a, b) => Math.abs(a - entryS) - Math.abs(b - entryS));
  const winAwnings = rng() < 0.5 && kit.stripes;
  const wins = new THREE.Group();
  xs.forEach((sAlong, i) => {
    const x = X(sAlong);
    punchedWindow(ctx, wins, x, sill, winW, winH, look, i < 2 ? lettering : null);
    if (winAwnings) {
      const pivot = new THREE.Group();
      pivot.position.set(x, sill + winH + 0.3, 0.1);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.3, 0.03, 0.8), M.awning);
      deck.position.z = 0.4;
      const v = new THREE.Mesh(new THREE.PlaneGeometry(winW + 0.3, 0.2), M.valance);
      v.position.set(0, -0.1, 0.8);
      pivot.add(deck, v);
      pivot.rotation.x = -Math.PI / 2;
      pivot.visible = false;
      g.add(pivot);
      ctx.awnings.push([pivot, 0.55]);
    }
  });
  g.add(wins);
  wins.scale.y = 0.001;
  ctx.grow.push([wins, 0.1]);
  ctx.root.add(g);
  return { site: { o: f.mid, d: f.dir, n: f.n, W: Math.min(L, 12), front: 2.0 }, entryX: xe, floorY };
}

// Build a storefront for the picked lot. Returns { root, tweens, view } and swaps the building's
// mesh for a split one (a notched ground floor under the original upper floors).
function buildStorefront(kit, p) {
  const f = p.front;
  const look = looksFor(p, kit);
  const ctx = { root: new THREE.Group(), grow: [], reveal: [], glass: [], bands: [], awnings: [], blades: [], lanterns: [], ground: null, groundTop: null };
  const variant = variantFor(p, f);
  const h = f.b.h;
  f.G = h < 5 ? Math.max(3.4, h) : Math.max(3.5, Math.min(4.1, h * 0.36));
  const res = variant === 'porch' ? porchShop(ctx, p, f, kit, look) : variant === 'corner' ? cornerShop(ctx, p, f, kit, look)
    : variant === 'flats' ? flatsShop(ctx, p, f, kit, look) : shopFront(ctx, p, f, kit, look);

  // The split building: ground floor (rebuilt as the notch or corner opens) and the floors above.
  const gTop = Math.min(h, ctx.groundTop || f.G);
  const upper = h - gTop > 0.3 ? extrudeMesh(f.b.poly, gTop, h, MAT.picked) : null;
  if (upper) ctx.root.add(upper);
  let ground = extrudeMesh(ctx.ground(0), 0, gTop, MAT.picked);
  ctx.root.add(ground);
  const setGround = (t) => {
    const next = new THREE.ExtrudeGeometry(shapeOf(ctx.ground(t)), { depth: gTop, bevelEnabled: false });
    next.rotateX(-Math.PI / 2);
    ground.geometry.dispose();
    ground.geometry = next;
  };

  // The street in front of the site: sidewalk and curb. (The trees are the city's, already standing.)
  const site = res.site;
  const sf = frame(site.o, site.d, site.n);
  const pg = sf.g;
  ctx.root.add(pg);
  const W = site.W;
  const curb = Math.max(site.front + 1.2, Math.min(f.street - 4.2, site.front + 6));
  sidewalk(pg, -W / 2 - 6, W / 2 + 6, curb - 2.4, curb);

  // On the sidewalk, or on the porch. (The porch site shares the porch's frame, so its local x
  // positions, like the door's xd, carry over.)
  const props = [];
  const onPorch = !!res.porch;
  const baseY = onPorch ? res.deckH : 0;
  // Props make room for the trees: nothing goes down within a metre of a trunk.
  pg.updateMatrixWorld(true);
  const trunks = (three.trees || []).filter((t) => Math.hypot(t.x - site.o[0], t.y - site.o[1]) < W + 20);
  const clear = (x, z) => {
    const w = pg.localToWorld(new THREE.Vector3(x, 0, z));
    return trunks.every((t) => Math.hypot(t.x - w.x, t.y + w.z) > 1 + t.T);
  };
  const placeOn = (obj, x, y, z, rotY = 0) => {
    if (!clear(x, z)) return false;
    obj.position.set(x, y, z); obj.rotation.y = rotY; obj.scale.setScalar(0.001); pg.add(obj); props.push(obj);
    return true;
  };
  const span = (onPorch ? W - 1.2 : W) - 1.6;
  const nT = onPorch ? Math.min(kit.tables, 2) : kit.tables;
  const tables = [];
  for (let i = 0; i < nT; i++) {
    let x = -span / 2 + (span * (i + 0.5)) / Math.max(nT, 1);
    if (onPorch && Math.abs(x - res.xd) < 1.3) x += x < res.xd ? -0.9 : 0.9;
    const z = onPorch ? 1.15 + (i % 2) * 0.5 : site.front + 0.9 + (i % 2) * 0.6;
    if (placeOn(table(kit.id === 'bistro' ? 0xf4ead6 : 0xf2ece0), x, baseY, z, Math.PI / 2)) tables.push([x, z]);
  }
  const walkZ = site.front + (onPorch ? 0.4 : 0.7);
  if (kit.props === 'cafe') { placeOn(aFrame('espresso'), W / 2 - 0.4, 0, walkZ + 0.6, -0.4); placeOn(planter(), -W / 2 + 0.2, 0, walkZ); }
  if (kit.props === 'books') { placeOn(bookCart(), onPorch ? 0 : -W / 4, 0, walkZ + 0.4, 0); placeOn(bench(), W / 4 + 0.6, 0, walkZ + 0.9, Math.PI); placeOn(aFrame('used & new'), W / 2 - 0.3, 0, walkZ + 0.7, -0.4); }
  if (kit.props === 'bistro') { placeOn(planter(), -W / 2 + 0.2, 0, walkZ); placeOn(planter(), W / 2 - 0.2, 0, walkZ); placeOn(aFrame('tonight'), W / 2 - 0.6, 0, walkZ + 0.8, -0.4); }
  if (kit.props === 'studio') { placeOn(bike(), -W / 3, 0, walkZ + 0.7, 0.1); placeOn(bike(), -W / 3 + 0.8, 0, walkZ + 0.8, 0.1); placeOn(planter(), W / 2 - 0.2, 0, walkZ); }
  if (kit.props === 'bistro' && !onPorch && variant !== 'corner') {
    const lights = stringLights(W, kit.glow);
    lights.position.z = site.front - 1.4;
    lights.visible = false;
    pg.add(lights);
    ctx.reveal.push([lights, 0.62]);
    ctx.bulbs = lights.userData.bulbs;
  }

  // Light spilling out of the shop.
  const lamp = new THREE.PointLight(kit.glow, 0, 16, 1.6);
  lamp.position.set(onPorch ? res.xd : 0, baseY + 2.3, onPorch ? 1.0 : 1.7);
  pg.add(lamp);

  // People.
  const rng = rngFor(`${p.gpin}:people:${kit.id}`);
  const folk = [];
  for (let i = 0; i < kit.people; i++) {
    const seated = i < tables.length;
    const who = person(rng);
    const side = i % 2 ? 1 : -1;
    const from = new THREE.Vector3(side * (W / 2 + 9 + i * 1.6), 0, curb - 1.2 + (i % 3) * 0.3);
    let to, face;
    if (seated) { to = new THREE.Vector3(tables[i][0] - 0.62, baseY, tables[i][1]); face = Math.PI / 2; }
    else if (onPorch && i % 2 === 0) { to = new THREE.Vector3(res.xd + (rng() - 0.5) * 0.6, 0, site.front - 0.2 + rng() * 0.6); face = Math.PI; }
    else { to = new THREE.Vector3((rng() - 0.5) * (W - 1), 0, walkZ + 0.2 + rng() * 1.4); face = Math.PI + (rng() - 0.5) * 1.2; }
    who.group.position.copy(from);
    who.group.visible = false;
    pg.add(who.group);
    folk.push({ who, from, to, face, seated, t0: 0.5 + i * 0.05 });
  }

  // ── The timeline ──
  const tweens = [];
  const at = (t0, t1, fn) => tweens.push({ t0, t1, fn });
  at(0.0, 0.24, (k) => setGround(ease(k)));
  ctx.grow.forEach(([m, delay]) => at(0.06 + delay, 0.3 + delay, (k) => { if (m === ctx.canopy) m.scale.z = Math.max(0.001, ease(k)); else m.scale.y = Math.max(0.001, ease(k)); }));
  ctx.reveal.forEach(([m, t]) => at(t, t + 0.02, (k) => { m.visible = k > 0; }));
  at(0.22, 0.5, (k) => { for (const m of ctx.glass) m.emissiveIntensity = (m.userData.peak || 0.85) * ease(k); look.mats.transom.emissiveIntensity = 0.6 * ease(k); });
  ctx.bands.forEach((b, i) => at(0.32 + i * 0.04, 0.5 + i * 0.04, (k) => { b.scale.x = Math.max(0.001, ease(k)); }));
  ctx.awnings.forEach(([pv, tilt], i) => at(0.4 + i * 0.05, 0.58 + i * 0.05, (k) => { pv.visible = k > 0; pv.rotation.x = -Math.PI / 2 + (Math.PI / 2 + tilt) * ease(k); }));
  ctx.blades.forEach((bl) => { const end = bl.rotation.y; bl.userData.end = end; bl.visible = false; at(0.5, 0.66, (k) => { bl.visible = k > 0; bl.rotation.y = end + (1 - ease(k)) * 1.4; }); });
  at(0.45, 0.7, (k) => { look.mats.lantern.emissiveIntensity = 2.2 * ease(k); lamp.intensity = (DARK ? 42 : 20) * ease(k); if (ctx.bulbs) ctx.bulbs.emissiveIntensity = 2.2 * ease(k); });
  props.forEach((obj, i) => at(0.55 + i * 0.03, 0.72 + i * 0.03, (k) => obj.scale.setScalar(Math.max(0.001, ease(k)))));
  for (const f2 of folk) {
    const t1 = Math.min(1, f2.t0 + 0.4);
    at(f2.t0, t1, (k) => {
      const { who, from, to } = f2;
      who.group.visible = k > 0;
      who.group.position.lerpVectors(from, to, ease(k));
      if (k < 1) {
        const d = new THREE.Vector3().subVectors(to, from);
        who.group.rotation.y = Math.atan2(d.x, d.z);
        who.walk(k * 22);
        if (f2.seated) who.group.position.y = 0;
      } else {
        who.group.rotation.y = f2.face;
        if (f2.seated) { who.sit(); who.group.position.y = to.y; } else who.stand();
      }
    });
  }
  return { root: ctx.root, tweens, variant, view: { ...res, site } };
}

// A person, about 1.6–1.85 m: legs that swing, arms, a head.
function person(rng) {
  const H = 1.6 + rng() * 0.25;
  const tops = [0x8a2b1f, 0x2f4a3a, 0x3d4f7a, 0xd9b46a, 0x5b3a5e, 0xe9dfc7, 0x6b5a46, 0x7a8f9a, 0xb5653a];
  const bottoms = [0x2b2b2b, 0x3d4f7a, 0x5a4a3a, 0x1f2a44, 0x7a6a55, 0x8c8478];
  const skins = [0xe2b996, 0xc68a62, 0x8d5a3b, 0xf1d0b0, 0xa86f4c, 0x6b4430];
  const top = std(pickOf(rng, tops)), bottom = std(pickOf(rng, bottoms)), skin = std(pickOf(rng, skins));
  const hair = std(pickOf(rng, [0x2a1d14, 0x4a3324, 0x8a6a3a, 0x1a1714, 0xc9b8a0]));
  const legL = H * 0.47, torso = H * 0.31, headR = H * 0.062;
  const g = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = legL;
  g.add(hips);
  const legs = [-1, 1].map((s) => {
    const hip = new THREE.Group();
    hip.position.x = s * 0.09;
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.13, legL / 2, 0.15), bottom);
    thigh.position.y = -legL / 4;
    const knee = new THREE.Group();
    knee.position.y = -legL / 2;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.11, legL / 2, 0.13), bottom);
    shin.position.y = -legL / 4;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.24), std(0x2a2622));
    shoe.position.set(0, -legL / 2 + 0.035, 0.04);
    knee.add(shin, shoe);
    hip.add(thigh, knee);
    hips.add(hip);
    return { hip, knee };
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, torso, 0.22), top);
  body.position.y = torso / 2;
  hips.add(body);
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group();
    sh.position.set(s * 0.24, torso - 0.05, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, H * 0.32, 6), top);
    arm.position.y = -H * 0.16;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), skin);
    hand.position.y = -H * 0.33;
    sh.add(arm, hand);
    hips.add(sh);
    return sh;
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 12, 10), skin);
  head.position.y = torso + headR + 0.04;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair);
  cap.position.copy(head.position);
  cap.rotation.x = -0.25;
  hips.add(head, cap);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // A negative hip angle swings a leg forward; a positive knee angle bends the shin back.
  const who = {
    group: g,
    walk(phase) {
      const s = Math.sin(phase);
      legs.forEach(({ hip, knee }, i) => { const a = i ? -s : s; hip.rotation.x = -a * 0.45; knee.rotation.x = Math.max(0, -a) * 0.7; });
      arms.forEach((arm, i) => { arm.rotation.x = (i ? s : -s) * 0.4; });
      hips.position.y = legL + Math.abs(Math.cos(phase)) * 0.03;
    },
    stand() {
      legs.forEach(({ hip, knee }) => { hip.rotation.x = 0; knee.rotation.x = 0; });
      arms.forEach((arm) => { arm.rotation.x = 0.05; });
      hips.position.y = legL;
    },
    sit() {
      legs.forEach(({ hip, knee }) => { hip.rotation.x = -Math.PI / 2; knee.rotation.x = Math.PI / 2; });
      arms.forEach((a) => { a.rotation.x = -0.7; });
      hips.position.y = 0.48;
    },
  };
  who.stand();
  return who;
}


function clearKit() {
  if (activeKit && three) {
    three.scene.remove(activeKit.root);
    activeKit.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    if (activeKit.hidden) activeKit.hidden.visible = true;
    if (activeKit.cleanup) activeKit.cleanup();
  }
  activeKit = null;
}

function applyKit(id, { silent = false } = {}) {
  clearKit();
  const kit = KITS.find((k) => k.id === id) || null;
  if (!silent) { setPressed(kit ? kit.id : null); fillRule(kit); }
  if (!kit || !picked) { if (!silent) writeHash(); return; }
  if (three && picked.hero) {
    const built = picked.hero.def.transform(kit, picked);
    three.scene.add(built.root);
    activeKit = { id: kit.id, root: built.root, tweens: built.tweens, hidden: null, cleanup: built.cleanup, variant: 'hero', start: performance.now(), dur: 4200 };
    if (REDUCE) for (const t of built.tweens) t.fn(1);
    fly(picked.hero.def.view('street'));
  } else if (three && picked.front) {
    const built = buildStorefront(kit, picked);
    const hidden = picked.front.b.mesh || null;
    if (hidden) hidden.visible = false;
    three.scene.add(built.root);
    activeKit = { id: kit.id, root: built.root, tweens: built.tweens, hidden, variant: built.variant, start: performance.now(), dur: 4200 };
    if (REDUCE) for (const t of built.tweens) t.fn(1);
    flyTo(picked, built.view);
  } else {
    activeKit = { id: kit.id, root: new THREE.Group(), tweens: [], start: 0, dur: 0 };
  }
  writeHash();
}


// ── Hero: 801 Stockley Gardens ──
// The district's showpiece, modelled by hand rather than extruded: a 1914 Mediterranean-revival
// house (assessor: 2½-story brick, 2,730 sq ft, with a 1,245 sq ft wraparound open porch and a
// 12 × 8 ft upper balcony over the entrance; assessor's photo 4/19/23). The city's footprint is the
// roof outline, porch included. In its own axes (u toward Stockley Gardens, v away from Raleigh
// Avenue) the pieces sit like this, in metres:
//   main block   u −9.0…6.9,   v −6.95…13.2   (2½ stories, red tile hip roof, bracketed eaves)
//   rear wing    u −15.8…−9.0, v −5.4…3.6     (two stories, low hip)
//   porch        front u 6.9…9.7 (v −8.5…13.2), entrance bump to u 10.5 (v −0.2…7.3),
//                Raleigh side v −10.3…−6.95 (u −8.8…6.9); floor 0.95 m up, roof at 3.95 m
// Bays with crenellated parapets on the front and the Raleigh side, a hipped dormer facing
// Stockley, four tall chimneys, the hedge along both walks.
const H801 = {
  c: [26.57, -104.45], U: [0.879, -0.477], V: [0.477, 0.879],
  main: [-9.0, 6.9, -6.95, 13.2], wing: [-15.8, -9.0, -5.4, 3.6],
  porchY: 0.95, porchTop: 3.95, eave: 7.8, wingEave: 6.6,
};

function heroMats() {
  const tile = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = DARK ? '#7a3528' : '#b5533a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = DARK ? '#5c271e' : '#8f3d2a'; g.fillRect(0, y + 12, w, 4);
      for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y, 3, 12); }
    }
  });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
  const brick = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = DARK ? '#9a8a70' : '#dcc7a4'; g.fillRect(0, 0, w, h);
    g.fillStyle = DARK ? '#857760' : '#cdb48e';
    for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 0 : 12; x < w; x += 24) g.fillRect(x, y, 22, 6);
  });
  brick.wrapS = brick.wrapT = THREE.RepeatWrapping;
  return {
    wall: new THREE.MeshLambertMaterial({ color: 0xffffff, map: brick }),
    roof: new THREE.MeshLambertMaterial({ color: 0xffffff, map: tile, side: THREE.DoubleSide }),
    trim: new THREE.MeshLambertMaterial({ color: DARK ? 0xcfc6b2 : 0xf3ecdc }),
    white: new THREE.MeshLambertMaterial({ color: DARK ? 0xd8d0c0 : 0xfaf6ee }),
    deck: new THREE.MeshLambertMaterial({ color: DARK ? 0x5d574d : 0x9a9488 }),
    base: new THREE.MeshLambertMaterial({ color: DARK ? 0x7d6a55 : 0xc4a986 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.3 }),
    shopGlass: new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0 }),
    chimney: new THREE.MeshLambertMaterial({ color: DARK ? 0x8e7d64 : 0xd2b993 }),
    cap: new THREE.MeshLambertMaterial({ color: DARK ? 0x4a4038 : 0x6e6052 }),
    hedge: new THREE.MeshLambertMaterial({ color: DARK ? 0x2f4a32 : 0x4f7a3f, flatShading: true }),
    path: new THREE.MeshLambertMaterial({ color: DARK ? 0x4a453c : 0xe7dfcd }),
  };
}

// World placement: a group at the footprint's centre turned so local x = u, local z = −v.
function heroGroup(h) {
  const g = new THREE.Group();
  g.position.copy(to3(h.c[0], h.c[1], 0));
  g.rotation.y = Math.atan2(h.U[1], h.U[0]);
  return g;
}
const huv = (h, u, v) => [h.c[0] + u * h.U[0] + v * h.V[0], h.c[1] + u * h.U[1] + v * h.V[1]];

// A box spanning [u0,u1] × [v0,v1] from y0 to y1, in the hero's frame.
function hbox(parent, u0, u1, v0, v1, y0, y1, mat, uvScale = 0) {
  const geo = new THREE.BoxGeometry(u1 - u0, y1 - y0, v1 - v0);
  if (uvScale) {   // world-scaled UVs so brick and tile textures keep their size
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (u0 + u1) / 2, y = pos.getY(i) + (y0 + y1) / 2, z = pos.getZ(i) - (v0 + v1) / 2;
      const ax = Math.abs(nor.getX(i)), az = Math.abs(nor.getZ(i));
      uv.setXY(i, (ax > 0.5 ? z : x) / uvScale, (ax > 0.5 || az > 0.5 ? y : z) / uvScale);
    }
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set((u0 + u1) / 2, (y0 + y1) / 2, -(v0 + v1) / 2);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

// A hip roof over [u0,u1] × [v0,v1] at eave height e, with overhang o and the given slope.
function hipRoof(parent, u0, u1, v0, v1, e, o, slope, mat) {
  u0 -= o; u1 += o; v0 -= o; v1 += o;
  const du = u1 - u0, dv = v1 - v0, hh = Math.min(du, dv) / 2 * slope;
  const along = du >= dv;   // ridge runs along the longer side
  const r = Math.min(du, dv) / 2;
  const P = (u, v, y) => new THREE.Vector3(u, y, -v);
  const a = P(u0, v0, e), b = P(u1, v0, e), c = P(u1, v1, e), d = P(u0, v1, e);
  const r1 = along ? P(u0 + r, (v0 + v1) / 2, e + hh) : P((u0 + u1) / 2, v0 + r, e + hh);
  const r2 = along ? P(u1 - r, (v0 + v1) / 2, e + hh) : P((u0 + u1) / 2, v1 - r, e + hh);
  const tris = along
    ? [[a, b, r2], [a, r2, r1], [c, d, r1], [c, r1, r2], [b, c, r2], [d, a, r1]]
    : [[a, b, r1], [b, c, r2], [b, r2, r1], [c, d, r2], [d, a, r1], [d, r1, r2]];
  const pos = [], uv = [];
  for (const t of tris) for (const p of t) { pos.push(p.x, p.y, p.z); uv.push((p.x + p.z) / 1.6, p.y / 0.8); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  if (parent.userData.brackets === false) return m;
  // Brackets under the eaves, the style's tell.
  const step = 1.1;
  for (const [x0, z0, x1, z1] of [[u0, v0, u1, v0], [u1, v0, u1, v1], [u1, v1, u0, v1], [u0, v1, u0, v0]]) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / step);
    for (let i = 1; i < n; i++) {
      const k = i / n, bu = x0 + (x1 - x0) * k, bv = z0 + (z1 - z0) * k;
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.14), parent.userData.trim);
      const pull = 0.35;   // tuck the bracket in from the eave edge toward the wall
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      const tu = bu + Math.sign(cu - bu) * (Math.abs(x1 - x0) < 0.1 ? pull : 0);
      const tv = bv + Math.sign(cv - bv) * (Math.abs(z1 - z0) < 0.1 ? pull : 0);
      br.position.set(tu, e - 0.12, -tv);
      parent.add(br);
    }
  }
  return m;
}

// Merlons along the top edge of a bay: the crenellated parapets in the photo.
function crenellate(parent, u0, u1, v0, v1, y, mat) {
  hbox(parent, u0, u1, v0, v1, y, y + 0.35, mat);
  const edges = [[u0, v0, u1, v0], [u1, v0, u1, v1], [u0, v1, u1, v1], [u0, v0, u0, v1]];
  for (const [a0, b0, a1, b1] of edges) {
    const L = Math.hypot(a1 - a0, b1 - b0), n = Math.max(2, Math.round(L / 0.7));
    for (let i = 0; i <= n; i += 2) {
      const k = i / n, cu = a0 + (a1 - a0) * k, cv = b0 + (b1 - b0) * k;
      hbox(parent, cu - 0.18, cu + 0.18, cv - 0.18, cv + 0.18, y + 0.35, y + 0.75, mat);
    }
  }
}

// A window on a wall facing ±u or ±v: dark glass in a cream surround.
function hwin(parent, face, at, along, y0, y1, w, mats, list) {
  const t = 0.12, out = 0.06;
  let win;
  if (face === 'u+' || face === 'u-') {
    const s = face === 'u+' ? 1 : -1;
    hbox(parent, at - t + s * out, at + t + s * out, along - w / 2 - 0.12, along + w / 2 + 0.12, y0 - 0.12, y1 + 0.16, mats.trim);
    win = hbox(parent, at - t + s * (out + 0.02), at + t + s * (out + 0.02), along - w / 2, along + w / 2, y0, y1, list ? mats.shopGlass : mats.glass);
  } else {
    const s = face === 'v+' ? 1 : -1;
    hbox(parent, along - w / 2 - 0.12, along + w / 2 + 0.12, at - t + s * out, at + t + s * out, y0 - 0.12, y1 + 0.16, mats.trim);
    win = hbox(parent, along - w / 2, along + w / 2, at - t + s * (out + 0.02), at + t + s * (out + 0.02), y0, y1, list ? mats.shopGlass : mats.glass);
  }
  win.castShadow = false;
  if (list) list.push({ face, at, along, y0, y1, w, mesh: win });
  return win;
}

function hedgeRun(parent, u0, v0, u1, v1, mats, rng, hgt = 1.7, dep = 1.3) {
  const x0 = u0, z0 = -v0, x1 = u1, z1 = -v1;
  const L = Math.hypot(x1 - x0, z1 - z0);
  const geo = new THREE.BoxGeometry(L, hgt, dep, Math.max(2, Math.round(L / 0.8)), 3, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setXYZ(i, pos.getX(i), y + (y > hgt * 0.3 ? (rng() - 0.3) * 0.28 * hgt / 1.7 : 0), pos.getZ(i) + (rng() - 0.5) * 0.18);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mats.hedge);
  m.position.set((x0 + x1) / 2, hgt / 2, (z0 + z1) / 2);
  m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
}

// The house, its porch, its hedge. Returns the group and what the transform needs.
function buildHero801(p) {
  const h = H801, M = heroMats();
  const g = heroGroup(h);
  g.userData.trim = M.trim;
  const rng = rngFor('801-hero');
  const [mu0, mu1, mv0, mv1] = h.main, [wu0, wu1, wv0, wv1] = h.wing;
  const pick = [];
  const wall = (...a) => { const m = hbox(g, ...a, M.wall, 2.4); m.userData.gpin = p.gpin; pick.push(m); return m; };

  // Raised base, the main block, the rear wing.
  hbox(g, mu0, mu1, mv0, mv1, 0, h.porchY, M.base);
  wall(mu0, mu1, mv0, mv1, h.porchY, h.eave);
  wall(wu0, wu1, wv0, wv1, 0, h.wingEave);
  // Bays: two on the front, one on the Raleigh side, one on the north side; crenellated tops.
  const bays = [[mu1, mu1 + 0.45, -5.6, -1.1], [mu1, mu1 + 0.45, 6.6, 11.1], [-4.0, 4.2, mv0 - 0.4, mv0], [2.0, 5.9, mv1, mv1 + 0.76]];
  for (const [a0, a1, b0, b1] of bays) { wall(a0, a1, b0, b1, h.porchY, h.eave + 0.2); crenellate(g, a0 - 0.05, a1 + 0.05, b0 - 0.05, b1 + 0.05, h.eave + 0.2, M.trim); }
  // A string course at the second floor.
  hbox(g, mu0 - 0.05, mu1 + 0.05, mv0 - 0.05, mv1 + 0.05, 4.55, 4.7, M.trim);

  // Roofs: the main hip with a hipped dormer facing Stockley, the wing's lower hip.
  hipRoof(g, mu0, mu1, mv0, mv1, h.eave, 0.85, 0.62, M.roof);
  hipRoof(g, wu0, wu1, wv0, wv1, h.wingEave, 0.6, 0.5, M.roof);
  hbox(g, mu1 - 2.6, mu1 - 0.6, 1.6, 5.2, h.eave + 0.6, h.eave + 2.1, M.wall, 2.4);
  hipRoof(g, mu1 - 2.6, mu1 - 0.6, 1.6, 5.2, h.eave + 2.1, 0.3, 0.55, M.roof);
  const winList = [];
  hwin(g, 'u+', mu1 - 0.55, 2.5, h.eave + 0.85, h.eave + 1.8, 0.8, M, null);
  hwin(g, 'u+', mu1 - 0.55, 4.3, h.eave + 0.85, h.eave + 1.8, 0.8, M, null);

  // Four tall chimneys.
  for (const [cu, cv, top] of [[1.8, mv0 - 0.35, 13.2], [4.2, mv1 + 0.3, 12.9], [-6.2, 3.2, 12.6], [-13.8, -1.0, 9.6]]) {
    hbox(g, cu - 0.45, cu + 0.45, cv - 0.38, cv + 0.38, 1.0, top, M.chimney);
    hbox(g, cu - 0.55, cu + 0.55, cv - 0.48, cv + 0.48, top, top + 0.22, M.cap);
  }

  // Windows: two floors on the front and the Raleigh side, the balcony door over the entrance.
  const f1 = [h.porchY + 0.55, h.porchY + 2.55], f2 = [5.1, 6.9];
  for (const v of [-4.4, -2.3, 7.8, 9.9, 12.2]) { hwin(g, 'u+', mu1 + (v > -5.6 && v < -1.1 || v > 6.6 && v < 11.1 ? 0.45 : 0), v, ...f2, 0.9, M, null); hwin(g, 'u+', mu1 + (v > -5.6 && v < -1.1 || v > 6.6 && v < 11.1 ? 0.45 : 0), v, ...f1, 1.0, M, winList); }
  hwin(g, 'u+', mu1, 3.5, 4.95, 7.1, 1.1, M, null);          // balcony door
  hwin(g, 'u+', mu1, 1.0, ...f2, 0.9, M, null);
  hwin(g, 'u+', mu1, 1.1, ...f1, 1.0, M, winList);
  hwin(g, 'u+', mu1, 5.9, ...f1, 1.0, M, winList);
  for (const u of [-7.5, -5.6, -2.7, -0.4, 1.9, 4.8]) { const bay = u > -4.0 && u < 4.2; hwin(g, 'v-', mv0 - (bay ? 0.4 : 0), u, ...f2, 0.9, M, null); hwin(g, 'v-', mv0 - (bay ? 0.4 : 0), u, ...f1, 1.0, M, winList); }
  for (const u of [-6.5, -3.0, 0.5]) hwin(g, 'v+', mv1, u, ...f2, 0.9, M, null);

  // The front door under the porch, with sidelights.
  hbox(g, mu1, mu1 + 0.12, 2.75, 4.25, h.porchY, h.porchY + 2.5, M.trim);
  const door = hbox(g, mu1 + 0.1, mu1 + 0.16, 3.05, 3.95, h.porchY, h.porchY + 2.3, new THREE.MeshLambertMaterial({ color: 0x5a3a24 }));

  // The porch: deck, skirt, columns (paired at the corners and the entrance), balustrade, roof.
  const pY = h.porchY, pT = h.porchTop;
  const strips = [[mu1, 9.7, -8.53, mv1], [9.7, 10.5, -0.2, 7.3], [-8.82, 4.11, -10.3, mv0], [4.11, mu1, -8.53, mv0]];
  for (const [a0, a1, b0, b1] of strips) { hbox(g, a0, a1, b0, b1, 0, pY - 0.08, M.base); hbox(g, a0, a1, b0, b1, pY - 0.08, pY, M.deck); }
  const colAt = [];
  const front = 9.45, side = -10.05;
  for (const v of [-8.25, -4.4, 2.6, 4.4]) colAt.push([front, v]);
  for (const v of [-0.05, 7.15]) colAt.push([10.3, v]);
  colAt.push([front, 10.2], [front, 12.9]);
  for (const u of [-8.5, -4.6, -0.7, 3.85]) colAt.push([u, side]);
  colAt.push([6.6, -8.3]);
  for (const [cu, cv] of colAt) {
    for (const off of [-0.17, 0.17]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, pT - pY - 0.3, 12), M.white);
      const pairAlongV = Math.abs(cu) > 9;   // front columns pair along v, side columns along u
      c.position.set(cu + (pairAlongV ? 0 : off), pY + 0.15 + (pT - pY - 0.3) / 2, -(cv + (pairAlongV ? off : 0)));
      c.castShadow = true;
      g.add(c);
    }
    hbox(g, cu - 0.32, cu + 0.32, cv - 0.32, cv + 0.32, pY, pY + 0.15, M.white);
    hbox(g, cu - 0.32, cu + 0.32, cv - 0.32, cv + 0.32, pT - 0.15, pT, M.white);
  }
  // Balustrade: top and bottom rails with instanced balusters, open at the front steps.
  const rails = [[front, -8.25, front, -0.2], [10.3, -0.05, 10.3, 2.4], [10.3, 4.6, 10.3, 7.15], [front, 7.3, front, 12.9],
    [-8.5, side, 3.85, side], [3.85, side, 3.85, -8.3], [3.85, -8.3, front, -8.3]];
  const balGeo = new THREE.BoxGeometry(0.05, 0.62, 0.05);
  const balCount = rails.reduce((s, [a0, b0, a1, b1]) => s + Math.ceil(Math.hypot(a1 - a0, b1 - b0) / 0.15), 0);
  const balusters = new THREE.InstancedMesh(balGeo, M.white, balCount);
  let k = 0;
  const m4 = new THREE.Matrix4();
  for (const [a0, b0, a1, b1] of rails) {
    const L = Math.hypot(a1 - a0, b1 - b0);
    if (Math.abs(a1 - a0) < 0.01) { hbox(g, a0 - 0.06, a0 + 0.06, Math.min(b0, b1), Math.max(b0, b1), pY + 0.8, pY + 0.88, M.white); hbox(g, a0 - 0.05, a0 + 0.05, Math.min(b0, b1), Math.max(b0, b1), pY + 0.08, pY + 0.13, M.white); }
    else { hbox(g, Math.min(a0, a1), Math.max(a0, a1), b0 - 0.06, b0 + 0.06, pY + 0.8, pY + 0.88, M.white); hbox(g, Math.min(a0, a1), Math.max(a0, a1), b0 - 0.05, b0 + 0.05, pY + 0.08, pY + 0.13, M.white); }
    for (let s = 0.08; s < L; s += 0.15) {
      const t = s / L;
      balusters.setMatrixAt(k++, m4.makeTranslation(a0 + (a1 - a0) * t, pY + 0.46, -(b0 + (b1 - b0) * t)));
    }
  }
  balusters.count = k;
  balusters.castShadow = true;
  g.add(balusters);
  // Porch roof: a low hip with a tiled edge and a white fascia.
  const roofs = [[mu1, 9.75, -8.6, mv1], [-8.9, mu1, -10.38, mv0]];
  for (const [a0, a1, b0, b1] of roofs) { hbox(g, a0, a1, b0, b1, pT, pT + 0.22, M.trim); }
  hbox(g, 9.75, 10.55, -0.25, 7.35, pT, pT + 0.22, M.trim);
  for (const [a0, a1, b0, b1] of [[mu1, 9.85, -8.7, mv1], [-9.0, mu1, -10.48, mv0]]) hbox(g, a0, a1, b0, b1, pT + 0.22, pT + 0.36, M.roof, 1.2);
  // The balcony on the porch roof over the entrance: a white balustrade.
  for (const [a0, b0, a1, b1] of [[mu1, 1.6, 10.4, 1.6], [10.4, 1.6, 10.4, 5.4], [10.4, 5.4, mu1, 5.4]]) {
    const L = Math.hypot(a1 - a0, b1 - b0);
    if (Math.abs(a1 - a0) < 0.01) hbox(g, a0 - 0.06, a0 + 0.06, Math.min(b0, b1), Math.max(b0, b1), pT + 1.15, pT + 1.25, M.white);
    else hbox(g, Math.min(a0, a1), Math.max(a0, a1), b0 - 0.06, b0 + 0.06, pT + 1.15, pT + 1.25, M.white);
    for (let s = 0.1; s < L; s += 0.22) { const t = s / L; hbox(g, a0 + (a1 - a0) * t - 0.05, a0 + (a1 - a0) * t + 0.05, b0 + (b1 - b0) * t - 0.05, b0 + (b1 - b0) * t + 0.05, pT + 0.36, pT + 1.15, M.white); }
  }
  // Front steps from the walk up to the entrance.
  const nSteps = 5, rise = pY / nSteps;
  for (let i = 1; i <= nSteps; i++) hbox(g, 10.5, 10.5 + (nSteps - i + 1) * 0.3, 2.45, 4.55, 0, i * rise, M.deck);
  // The walk through the hedge, and the hedge along both streets.
  // The lot lines, in the hero's frame, from the parcel itself.
  const lot = p.poly.map(([x, y]) => [(x - h.c[0]) * h.U[0] + (y - h.c[1]) * h.U[1], (x - h.c[0]) * h.V[0] + (y - h.c[1]) * h.V[1]]);
  const uMax = Math.max(...lot.map((q) => q[0])), uMin = Math.min(...lot.map((q) => q[0]));
  const vMin = Math.min(...lot.map((q) => q[1])), vMax = Math.max(...lot.map((q) => q[1]));
  const hu = uMax - 0.9, hv = vMin + 0.9;   // the hedge stands just inside the lot lines facing the streets
  hbox(g, 10.5, hu, 2.6, 4.4, 0, 0.03, M.path);
  hedgeRun(g, hu, hv, hu, 2.4, M, rng);          // along Stockley, from the corner to the walk
  hedgeRun(g, hu, 4.6, hu, vMax - 0.6, M, rng);  // along Stockley, past the walk
  hedgeRun(g, hu, hv, uMin + 1, hv, M, rng);     // along Raleigh

  return { group: g, pick, winList, door, mats: M, lot: { hu, hv } };
}

// The porch café: the house stays as it is; the porch fills, the shop floor lights up.
function heroTransform801(kit, p) {
  const h = H801, hero = p.hero, M = hero.mats;
  const g = heroGroup(h);
  const tweens = [];
  const at = (t0, t1, fn) => tweens.push({ t0, t1, fn });
  const pY = h.porchY, pT = h.porchTop, mu1 = h.main[1];
  const paint = PAINTS[kit.id][0], trim = '#efe6d2';
  const rng = rngFor(`801:${kit.id}`);

  // Shop windows and the door glow; the glass shows the kit's interior.
  M.shopGlass.emissiveMap = windowTexture(kit.window);
  M.shopGlass.needsUpdate = true;
  at(0.08, 0.4, (k) => { M.shopGlass.emissiveIntensity = 0.85 * ease(k); hero.door.material.emissive = new THREE.Color(0x6b3a10); hero.door.material.emissiveIntensity = 0.6 * ease(k); });
  // Gold lettering on the two windows flanking the door.
  const lettering = letteringTex(kit.sign, kit.signFont);
  for (const v of [1.1, 5.9]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: lettering, transparent: true, depthWrite: false, opacity: 0 }));
    plane.rotation.y = Math.PI / 2;
    plane.position.set(mu1 + 0.3, pY + 1.15, -v);
    g.add(plane);
    at(0.3, 0.5, (k) => { plane.material.opacity = ease(k); });
  }
  // A sign hung from the porch roof at the entrance, facing the street.
  const icon = new THREE.MeshStandardMaterial({ map: iconTex(ICONS[kit.id], paint, trim) });
  const signG = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.52, 0.72), [icon, icon, std(paint), std(paint), std(paint), std(paint)]);
  board.position.y = -0.62;
  board.castShadow = true;
  signG.add(board);
  for (const z of [-0.26, 0.26]) box(signG, 0.012, 0.36, 0.012, 0, -0.18, z, std(0x1d1b19), false);
  signG.position.set(10.25, pT, -3.5);
  signG.scale.y = 0.001;
  g.add(signG);
  at(0.32, 0.5, (k) => { signG.scale.y = Math.max(0.001, ease(k)); });
  // Lanterns at the entrance columns, a warm light on the porch.
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: kit.glow, emissiveIntensity: 0 });
  for (const v of [-0.05, 7.15]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), lanternMat); l.position.set(10.3, pY + 2.2, -(v + (v < 3 ? 0.45 : -0.45))); g.add(l); }
  const lamp = new THREE.PointLight(kit.glow, 0, 18, 1.6);
  lamp.position.set(8.6, pY + 2.3, -3.5);
  g.add(lamp);
  at(0.35, 0.6, (k) => { lanternMat.emissiveIntensity = 2.2 * ease(k); lamp.intensity = (DARK ? 50 : 26) * ease(k); });

  // Tables along the front porch and down the Raleigh side.
  const spots = [[8.35, -6.6, 0], [8.35, -3.0, 0], [8.35, 9.2, 0], [8.35, 11.8, 0], [-6.6, -8.55, 1], [-2.7, -8.55, 1], [1.2, -8.55, 1]];
  const n = kit.id === 'bistro' ? 7 : kit.id === 'coffee' ? 5 : kit.id === 'books' ? 2 : 0;
  const props = [];
  const seats = [];
  spots.slice(0, n).forEach(([u, v, side]) => {
    const t = table(kit.id === 'bistro' ? 0xf4ead6 : 0xf2ece0);
    t.position.set(u, pY, -v);
    t.rotation.y = side ? Math.PI / 2 : 0;
    t.scale.setScalar(0.001);
    g.add(t);
    props.push(t);
    seats.push(side ? [u - 0.62, v, Math.PI / 2] : [u, v - 0.62, 0]);
  });
  if (kit.id === 'books') { const c = bookCart(); c.position.set(8.4, pY, -1.0); c.rotation.y = Math.PI / 2; c.scale.setScalar(0.001); g.add(c); props.push(c); }
  if (kit.id === 'studio') { for (const [u, v] of [[8.4, -5.0], [8.4, 10.5]]) { const b = bench(); b.position.set(u, pY, -v); b.rotation.y = -Math.PI / 2; b.scale.setScalar(0.001); g.add(b); props.push(b); } }
  const af = aFrame(kit.id === 'bistro' ? 'tonight' : kit.id === 'books' ? 'used & new' : kit.id === 'studio' ? 'open studio' : 'espresso');
  af.position.set(hero.lot.hu + 1.4, 0, -5.2);
  af.rotation.y = Math.PI / 2 - 0.4;
  af.scale.setScalar(0.001);
  g.add(af);
  props.push(af);
  props.forEach((o, i) => at(0.45 + i * 0.03, 0.62 + i * 0.03, (k) => o.scale.setScalar(Math.max(0.001, ease(k)))));

  if (kit.id === 'bistro') {
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: kit.glow, emissiveIntensity: 0 });
    const bulb = new THREE.SphereGeometry(0.06, 8, 6);
    const runs = [[9.6, -8.4, 9.6, -0.2], [9.6, 7.3, 9.6, 12.9], [-8.6, -10.2, 3.8, -10.2]];
    for (const [u0, v0, u1, v1] of runs) {
      const L = Math.hypot(u1 - u0, v1 - v0), nB = Math.round(L / 0.45);
      for (let i = 0; i <= nB; i++) {
        const t = i / nB, m = new THREE.Mesh(bulb, bulbMat);
        m.position.set(u0 + (u1 - u0) * t, pT - 0.18 - Math.sin((t * L / 3.6) % 1 * Math.PI) * 0.22, -(v0 + (v1 - v0) * t));
        g.add(m);
      }
    }
    at(0.55, 0.75, (k) => { bulbMat.emissiveIntensity = 2.4 * ease(k); });
  }

  // People: seated at the tables, one at the door, two coming up the walk.
  const folk = [];
  seats.forEach(([u, v, rot], i) => {
    if (i >= kit.people) return;
    const who = person(rng);
    who.sit();
    who.group.position.set(u, pY, -v);
    who.group.rotation.y = rot === 0 ? Math.PI : Math.PI / 2;
    who.group.visible = false;
    g.add(who.group);
    at(0.5 + i * 0.04, 0.52 + i * 0.04, (k) => { who.group.visible = k > 0; });
  });
  const greeter = person(rng); greeter.stand(); greeter.group.position.set(9.9, pY, -2.9); greeter.group.rotation.y = Math.PI / 2; greeter.group.visible = false; g.add(greeter.group);
  at(0.55, 0.57, (k) => { greeter.group.visible = k > 0; });
  for (let i = 0; i < 2; i++) {
    const who = person(rng);
    const from = new THREE.Vector3(hero.lot.hu + 3.5, 0, -(3.0 + i * 0.8) + (i ? -6 : 6));
    const to = new THREE.Vector3(13.5 + i * 1.2, 0, -(3.2 + i * 0.6));
    who.group.position.copy(from);
    who.group.visible = false;
    g.add(who.group);
    at(0.55 + i * 0.08, 0.95, (k) => {
      who.group.visible = k > 0;
      const mid = new THREE.Vector3(hero.lot.hu + 1.0, 0, -(3.4 + i * 0.4));
      const kk = ease(k);
      if (kk < 0.4) who.group.position.lerpVectors(from, mid, kk / 0.4); else who.group.position.lerpVectors(mid, to, (kk - 0.4) / 0.6);
      who.group.rotation.y = kk < 0.4 ? Math.atan2(mid.x - from.x, mid.z - from.z) : -Math.PI / 2;
      if (k < 1) who.walk(k * 26); else who.stand();
    });
  }

  const cleanup = () => { M.shopGlass.emissiveIntensity = 0; hero.door.material.emissiveIntensity = 0; };
  return { root: g, tweens, variant: 'hero', cleanup, view: { hero: true } };
}

// Where to stand: the corner of Stockley and Raleigh, looking at the porch, like the assessor did.
function heroView(mode) {
  const h = H801;
  if (mode === 'street') {
    // A little above eye level, back toward the corner, so both arms of the porch show over the hedge.
    const [px, py] = huv(h, 27.5, -10.5), [tx, ty] = huv(h, 5.5, 0.5);
    return { pos: to3(px, py, 4.4), target: to3(tx, ty, 2.4) };
  }
  // Over the street trees on Raleigh, which stand between the corner and the porch.
  const [px, py] = huv(h, 36, -22), [tx, ty] = huv(h, 2, 0.5);
  return { pos: to3(px, py, 17), target: to3(tx, ty, 3.5) };
}

// ── Case studies: built by hand like 801, from the city's footprint, the assessor's photos and the FY2026 record ──

const dk = (hex) => DARK ? '#' + new THREE.Color(hex).multiplyScalar(0.62).getHexString() : hex;

// 801's materials, with this building's brick, roof and trim.
function heroMatsFor({ brick, mortar, roof, trim, base }) {
  const M = heroMats();
  const tex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = dk(mortar); g.fillRect(0, 0, w, h);
    g.fillStyle = dk(brick);
    for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 0 : 12; x < w; x += 24) g.fillRect(x, y, 22, 6);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  M.wall = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex });
  M.chimney = M.wall;
  M.roof = new THREE.MeshLambertMaterial({ color: dk(roof), side: THREE.DoubleSide, flatShading: true });
  M.trim = M.white = new THREE.MeshLambertMaterial({ color: dk(trim) });
  M.base = new THREE.MeshLambertMaterial({ color: dk(base) });
  return M;
}

// A box from a to b (local points) with a square section t: rake boards.
function beam(parent, a, b, t, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, t, a.distanceTo(b)), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}

// A front-facing gable: the ridge runs back along u over [u0,u1]; the gable ends face ±u.
function gableRoof(parent, u0, u1, v0, v1, e, rise, o, M) {
  const vm = (v0 + v1) / 2, s = rise / ((v1 - v0) / 2);
  const P = (u, v, y) => new THREE.Vector3(u, y, -v);
  const ue0 = u0 - 0.35, ue1 = u1 + 0.35, ye = e - o * s, yk = e + rise;
  const L0 = P(ue0, v0 - o, ye), L1 = P(ue1, v0 - o, ye), R0 = P(ue0, v1 + o, ye), R1 = P(ue1, v1 + o, ye);
  const K0 = P(ue0, vm, yk), K1 = P(ue1, vm, yk);
  const pos = [], uv = [];
  for (const t of [[L0, L1, K1], [L0, K1, K0], [R1, R0, K0], [R1, K0, K1]]) for (const q of t) { pos.push(q.x, q.y, q.z); uv.push(q.x / 1.6, (q.y - q.z) / 1.6); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const roof = new THREE.Mesh(geo, M.roof);
  roof.castShadow = roof.receiveShadow = true;
  parent.add(roof);
  // The gable walls in brick, and white rake boards on the front one.
  const gableMat = new THREE.MeshLambertMaterial({ map: M.wall.map, color: 0xffffff, side: THREE.DoubleSide });
  for (const u of [u0, u1]) {
    const tri = [P(u, v0, e), P(u, v1, e), P(u, vm, yk)];
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(tri.flatMap((q) => [q.x, q.y, q.z]), 3));
    g2.setAttribute('uv', new THREE.Float32BufferAttribute(tri.flatMap((q) => [-q.z / 2.4, q.y / 2.4]), 2));
    g2.computeVertexNormals();
    const w = new THREE.Mesh(g2, gableMat);
    w.castShadow = w.receiveShadow = true;
    parent.add(w);
  }
  beam(parent, P(ue1, v0 - o, ye), P(ue1, vm, yk), 0.18, M.trim);
  beam(parent, P(ue1, v1 + o, ye), P(ue1, vm, yk), 0.18, M.trim);
  return roof;
}

// A round-headed window on a +u face: hwin's sash under a half-round light and a white arch.
function archWin(parent, at, along, y0, y1, w, M) {
  hwin(parent, 'u+', at, along, y0, y1, w, M, null);
  const r = w / 2;
  const top = new THREE.Mesh(new THREE.CircleGeometry(r, 20, 0, Math.PI), M.glass);
  top.rotation.y = Math.PI / 2;
  top.position.set(at + 0.205, y1, -along);
  parent.add(top);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.16, 20, 1, 0, Math.PI), M.trim);
  ring.rotation.y = Math.PI / 2;
  ring.position.set(at + 0.21, y1, -along);
  parent.add(ring);
}

// A balustrade from (a0,b0) to (a1,b1), along u or along v, standing on height y.
function railRun(parent, a0, b0, a1, b1, y, M, h = 0.88) {
  const L = Math.hypot(a1 - a0, b1 - b0);
  if (Math.abs(a1 - a0) < 0.01) {
    hbox(parent, a0 - 0.06, a0 + 0.06, Math.min(b0, b1), Math.max(b0, b1), y + h - 0.08, y + h, M.white);
    hbox(parent, a0 - 0.05, a0 + 0.05, Math.min(b0, b1), Math.max(b0, b1), y + 0.08, y + 0.13, M.white);
  } else {
    hbox(parent, Math.min(a0, a1), Math.max(a0, a1), b0 - 0.06, b0 + 0.06, y + h - 0.08, y + h, M.white);
    hbox(parent, Math.min(a0, a1), Math.max(a0, a1), b0 - 0.05, b0 + 0.05, y + 0.08, y + 0.13, M.white);
  }
  const n = Math.max(1, Math.floor(L / 0.15));
  const bal = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, h - 0.26, 0.05), M.white, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; bal.setMatrixAt(i, m4.makeTranslation(a0 + (a1 - a0) * t, y + h / 2, -(b0 + (b1 - b0) * t))); }
  bal.castShadow = true;
  parent.add(bal);
}

// The black lamp post with a lantern head that stands in front of both buildings in the photos.
function postLamp(parent, u, v) {
  const iron = std(0x1d1b19);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 3.3, 10), iron);
  post.position.set(u, 1.65, -v);
  post.castShadow = true;
  parent.add(post);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.13, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0xf6f0e2, emissive: 0xfff1c9, emissiveIntensity: 0.12, roughness: 0.4 }));
  glass.rotation.y = Math.PI / 4;
  glass.position.set(u, 3.55, -v);
  parent.add(glass);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.24, 4), iron);
  cap.rotation.y = Math.PI / 4;
  cap.position.set(u, 3.92, -v);
  parent.add(cap);
}

function columnAt(parent, u, v, y0, y1, M) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, y1 - y0 - 0.3, 12), M.white);
  c.position.set(u, y0 + 0.15 + (y1 - y0 - 0.3) / 2, -v);
  c.castShadow = true;
  parent.add(c);
  hbox(parent, u - 0.24, u + 0.24, v - 0.24, v + 0.24, y0, y0 + 0.15, M.white);
  hbox(parent, u - 0.24, u + 0.24, v - 0.24, v + 0.24, y1 - 0.15, y1, M.white);
}

// The shop arrives, the same way at each case study: the shop windows light and show the kit's interior,
// gold lettering, a sign hung from the porch beam where there is one, canvas awnings where the
// building takes them, lanterns, tables, people. cfg places each piece in the building's frame.
function caseTransform(kit, p, cfg) {
  const h = cfg.h, hero = p.hero, M = hero.mats;
  const g = heroGroup(h);
  const tweens = [];
  const at = (t0, t1, fn) => tweens.push({ t0, t1, fn });
  const paint = PAINTS[kit.id][0], trim = '#efe6d2';
  const rng = rngFor(`${p.gpin}:${kit.id}`);
  M.shopGlass.emissiveMap = windowTexture(kit.window);
  M.shopGlass.needsUpdate = true;
  at(0.08, 0.4, (k) => { M.shopGlass.emissiveIntensity = 0.85 * ease(k); hero.door.material.emissive = new THREE.Color(0x6b3a10); hero.door.material.emissiveIntensity = 0.6 * ease(k); });
  const lettering = letteringTex(kit.sign, kit.signFont);
  for (const [u, v, y, w] of cfg.letters) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), new THREE.MeshBasicMaterial({ map: lettering, transparent: true, depthWrite: false, opacity: 0 }));
    plane.rotation.y = Math.PI / 2;
    plane.position.set(u, y, -v);
    g.add(plane);
    at(0.3, 0.5, (k) => { plane.material.opacity = ease(k); });
  }
  // A sign hung from the porch beam, facing the street.
  if (cfg.sign) {
    const icon = new THREE.MeshStandardMaterial({ map: iconTex(ICONS[kit.id], paint, trim) });
    const signG = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.52, 0.72), [icon, icon, std(paint), std(paint), std(paint), std(paint)]);
    board.position.y = -0.62;
    board.castShadow = true;
    signG.add(board);
    for (const z of [-0.26, 0.26]) box(signG, 0.012, 0.36, 0.012, 0, -0.18, z, std(0x1d1b19), false);
    signG.position.set(cfg.sign.u, cfg.sign.y, -cfg.sign.v);
    signG.scale.y = 0.001;
    g.add(signG);
    at(0.32, 0.5, (k) => { signG.scale.y = Math.max(0.001, ease(k)); });
  }
  // Canvas awnings over first-floor windows, in the kit's stripes.
  for (const [u, v, y, w] of cfg.awnings || []) {
    const mat = new THREE.MeshLambertMaterial({ map: stripesTexture(kit.stripes || [paint, trim]), side: THREE.DoubleSide });
    const aw = new THREE.Group();
    const tilt = new THREE.Group();
    const slope = new THREE.Mesh(new THREE.PlaneGeometry(0.95, w), mat);
    slope.rotation.x = -Math.PI / 2;
    slope.position.x = 0.4;
    tilt.add(slope);
    tilt.rotation.z = -0.55;
    aw.add(tilt);
    const valance = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, w), mat);
    valance.position.set(0.78, -0.58, 0);
    aw.add(valance);
    aw.position.set(u, y, -v);
    aw.scale.set(0.001, 1, 1);
    g.add(aw);
    at(0.25, 0.45, (k) => { aw.scale.x = Math.max(0.001, ease(k)); });
  }
  // Lanterns and a warm light, from outside.
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: kit.glow, emissiveIntensity: 0 });
  for (const [u, v, y] of cfg.lanterns) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), lanternMat); l.position.set(u, y, -v); g.add(l); }
  const lamp = new THREE.PointLight(kit.glow, 0, 16, 1.6);
  lamp.position.set(cfg.light[0], cfg.light[2], -cfg.light[1]);
  g.add(lamp);
  at(0.35, 0.6, (k) => { lanternMat.emissiveIntensity = 2.2 * ease(k); lamp.intensity = (DARK ? 44 : 22) * ease(k); });
  // Tables, a book cart or benches, the board out front.
  const n = kit.id === 'bistro' ? cfg.tables.length : kit.id === 'coffee' ? Math.min(cfg.tables.length, 3) : kit.id === 'books' ? 1 : 0;
  const props = [];
  cfg.tables.slice(0, n).forEach(([u, v, y]) => {
    const t = table(kit.id === 'bistro' ? 0xf4ead6 : 0xf2ece0);
    t.position.set(u, y, -v); t.scale.setScalar(0.001); g.add(t); props.push(t);
  });
  if (kit.id === 'books') { const c = bookCart(); c.position.set(cfg.cart[0], cfg.cart[2], -cfg.cart[1]); c.rotation.y = Math.PI / 2; c.scale.setScalar(0.001); g.add(c); props.push(c); }
  if (kit.id === 'studio') for (const [u, v, y] of cfg.benches) { const b = bench(); b.position.set(u, y, -v); b.rotation.y = -Math.PI / 2; b.scale.setScalar(0.001); g.add(b); props.push(b); }
  const af = aFrame(kit.id === 'bistro' ? 'tonight' : kit.id === 'books' ? 'used & new' : kit.id === 'studio' ? 'open studio' : 'espresso');
  af.position.set(cfg.board[0], 0, -cfg.board[1]); af.rotation.y = Math.PI / 2 - 0.4; af.scale.setScalar(0.001); g.add(af); props.push(af);
  props.forEach((o, i) => at(0.45 + i * 0.03, 0.62 + i * 0.03, (k) => o.scale.setScalar(Math.max(0.001, ease(k)))));
  if (kit.id === 'bistro' && cfg.bulbs) {
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: kit.glow, emissiveIntensity: 0 });
    const bulb = new THREE.SphereGeometry(0.06, 8, 6);
    for (const [u0, v0, u1, v1, y] of cfg.bulbs) {
      const L = Math.hypot(u1 - u0, v1 - v0), nB = Math.round(L / 0.45);
      for (let i = 0; i <= nB; i++) { const t = i / nB, m = new THREE.Mesh(bulb, bulbMat); m.position.set(u0 + (u1 - u0) * t, y - Math.sin((t * L / 3.6) % 1 * Math.PI) * 0.22, -(v0 + (v1 - v0) * t)); g.add(m); }
    }
    at(0.55, 0.75, (k) => { bulbMat.emissiveIntensity = 2.4 * ease(k); });
  }
  // People: one at each table (facing it), one at the door, two arriving along the sidewalk.
  cfg.tables.slice(0, n).forEach(([u, v, y], i) => {
    if (i >= kit.people) return;
    const who = person(rng); who.sit();
    const side = i % 2 ? 1 : -1;
    who.group.position.set(u, y, -(v + side * 0.62));
    who.group.rotation.y = side < 0 ? Math.PI : 0;
    who.group.visible = false; g.add(who.group);
    at(0.5 + i * 0.04, 0.52 + i * 0.04, (k) => { who.group.visible = k > 0; });
  });
  const greeter = person(rng); greeter.stand();
  greeter.group.position.set(cfg.greeter[0], cfg.greeter[2], -cfg.greeter[1]); greeter.group.rotation.y = Math.PI / 2; greeter.group.visible = false; g.add(greeter.group);
  at(0.55, 0.57, (k) => { greeter.group.visible = k > 0; });
  cfg.walkers.forEach(([fu, fv, tu, tv], i) => {
    const who = person(rng);
    const from = new THREE.Vector3(fu, 0, -fv), to = new THREE.Vector3(tu, 0, -tv);
    who.group.position.copy(from); who.group.visible = false; g.add(who.group);
    at(0.55 + i * 0.08, 0.95, (k) => {
      who.group.visible = k > 0;
      who.group.position.lerpVectors(from, to, ease(k));
      who.group.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      if (k < 1) who.walk(k * 26); else who.stand();
    });
  });
  const cleanup = () => { M.shopGlass.emissiveIntensity = 0; hero.door.material.emissiveIntensity = 0; };
  return { root: g, tweens, variant: 'hero', cleanup, view: { hero: true } };
}

// ── 715 Colonial Avenue (case study): an 1888 brick house with a front porch ──
// The city's footprint is the roof outline, porch included: 7.7 m on Colonial, 25 m deep, with a narrower
// rear ell. The assessor's photos (2007, 2023, 2026) show red brick and a steep front gable over two
// round-headed windows, a round-headed attic window between two small ones, a porch across the front on
// white columns, a balcony on the porch roof at the right, a tall chimney on the left, boxwood at the walk,
// a lamp post at the curb. The FY2026 record: built 1888, 3,759 sq ft, on a 3,063 sq ft lot.
const H715 = {
  c: [188.64, -257.91], U: [0.892, -0.452], V: [0.452, 0.892],
  wallU: 9.4, porchU: 11.8, v0: -4.3, v1: 3.7, gv1: 1.3, rearU: -5.1,
  baseY: 0.9, porchTop: 3.9, eave: 8.2,
};
function buildHero715(p) {
  const h = H715;
  const M = heroMatsFor({ brick: '#8e3b2a', mortar: '#b8836c', roof: '#5d6166', trim: '#f2ece0', base: '#7a4a38' });
  const g = heroGroup(h); g.userData.trim = M.trim; g.userData.brackets = false;
  const pick = [];
  const wall = (...a) => { const m = hbox(g, ...a, M.wall, 2.4); m.userData.gpin = p.gpin; pick.push(m); return m; };
  const { wallU: uw, porchU: up, v0, v1, gv1, rearU, baseY: y0, porchTop: pT, eave: e } = h;
  // The house, the rear ell, a stone band at the second floor.
  hbox(g, rearU, uw, v0, v1, 0, y0, M.base);
  wall(rearU, uw, v0, v1, y0, e);
  wall(-13.1, rearU, -2.1, 3.8, 0, 7.4);
  hbox(g, rearU, uw + 0.05, v0 - 0.05, v1 + 0.05, 4.5, 4.62, M.trim);
  // Roofs: the front gable over the left two-thirds, a lower hip over the right third and over the ell.
  gableRoof(g, rearU, uw, v0, gv1, e, 5.0, 0.45, M);
  hipRoof(g, rearU, uw, gv1, v1, e, 0.35, 0.6, M.roof);
  hipRoof(g, -13.1, rearU, -2.1, 3.8, 7.4, 0.4, 0.55, M.roof);
  hbox(g, 6.4, 7.3, v0 - 0.45, v0 + 0.25, 1.0, 14.0, M.chimney);
  hbox(g, 6.3, 7.4, v0 - 0.55, v0 + 0.35, 14.0, 14.2, M.cap);
  // Windows: round-headed on the second floor and in the attic, tall sash on the first floor.
  const winList = [];
  archWin(g, uw, -2.6, 5.0, 6.7, 1.0, M);
  archWin(g, uw, -0.5, 5.0, 6.7, 1.0, M);
  archWin(g, uw, -1.55, 9.4, 10.6, 0.8, M);
  hwin(g, 'u+', uw, -2.75, 9.1, 9.75, 0.5, M, null);
  hwin(g, 'u+', uw, -0.35, 9.1, 9.75, 0.5, M, null);
  hwin(g, 'u+', uw, 2.5, 4.75, 7.0, 0.9, M, null);            // the door onto the balcony
  hwin(g, 'u+', uw, -2.8, y0 + 0.6, y0 + 2.8, 1.0, M, winList);
  hwin(g, 'u+', uw, -1.0, y0 + 0.6, y0 + 2.8, 1.0, M, winList);
  for (const u of [-3.5, 0.5, 4.5]) { hwin(g, 'v-', v0, u, 5.0, 6.8, 0.9, M, null); hwin(g, 'v-', v0, u, y0 + 0.6, y0 + 2.7, 0.9, M, null); }
  hbox(g, uw, uw + 0.12, 1.25, 2.55, y0, y0 + 2.75, M.trim);  // the door's surround and transom
  const door = hbox(g, uw + 0.1, uw + 0.16, 1.45, 2.35, y0, y0 + 2.25, new THREE.MeshLambertMaterial({ color: 0x3a2418 }));
  // The porch: deck, white columns, a flat roof with a balustrade over the balcony end, steps, railings.
  hbox(g, uw, up, v0, v1, 0, y0 - 0.08, M.base); hbox(g, uw, up, v0, v1, y0 - 0.08, y0, M.deck);
  for (const v of [-4.05, -1.5, 1.05, 3.45]) columnAt(g, up - 0.25, v, y0, pT, M);
  hbox(g, uw, up + 0.05, v0 - 0.08, v1 + 0.08, pT, pT + 0.34, M.trim);
  hbox(g, uw, up + 0.1, v0 - 0.12, v1 + 0.12, pT + 0.34, pT + 0.44, M.roof);
  railRun(g, up - 0.15, gv1, up - 0.15, v1 - 0.05, pT + 0.44, M);
  railRun(g, uw + 0.05, gv1, up - 0.15, gv1, pT + 0.44, M);
  for (const [b0, b1] of [[-3.85, -1.7], [-1.3, 0.85], [2.75, 3.25]]) railRun(g, up - 0.25, b0, up - 0.25, b1, y0, M, 0.8);
  for (const b of [v0 + 0.12, v1 - 0.12]) railRun(g, uw + 0.1, b, up - 0.45, b, y0, M, 0.8);
  const nSteps = 4, rise = y0 / nSteps;
  for (let i = 1; i <= nSteps; i++) hbox(g, up, up + (nSteps - i + 1) * 0.3, 1.25, 2.6, 0, i * rise, M.deck);
  // Boxwood either side of the walk, and the lamp post.
  const rng = rngFor('715-hero');
  hedgeRun(g, up + 0.9, v0 + 0.1, up + 0.9, 0.9, M, rng, 0.9, 0.8);
  hedgeRun(g, up + 0.9, 2.95, up + 0.9, v1 + 0.6, M, rng, 0.9, 0.8);
  hbox(g, up, up + 2.6, 1.3, 2.55, 0, 0.03, M.path);
  postLamp(g, up + 2.2, -0.6);
  return { group: g, pick, winList, door, mats: M };
}
function heroTransform715(kit, p) {
  const h = H715, uw = h.wallU, up = h.porchU, y0 = h.baseY, pT = h.porchTop;
  return caseTransform(kit, p, {
    h,
    letters: [[uw + 0.3, -2.8, y0 + 1.4, 0.95], [uw + 0.3, -1.0, y0 + 1.4, 0.95]],
    sign: { u: up - 0.25, v: -0.2, y: pT },
    lanterns: [[uw + 0.25, 1.0, y0 + 2.05], [uw + 0.25, 2.8, y0 + 2.05]],
    light: [uw + 1.0, 0, y0 + 2.2],
    tables: [[uw + 1.25, -3.0, y0], [uw + 1.25, -0.3, y0], [uw + 1.25, 3.1, y0]],
    cart: [uw + 1.2, -2.0, y0],
    benches: [[uw + 1.4, -2.2, y0]],
    board: [up + 2.0, -1.8],
    bulbs: [[up - 0.15, h.v0 + 0.1, up - 0.15, h.v1 - 0.1, pT - 0.15]],
    greeter: [uw + 0.9, 1.9, y0],
    walkers: [[up + 3.6, -9, up + 2.6, 1.9], [up + 3.9, 11, up + 2.9, 2.2]],
  });
}
function heroView715(mode) {
  const h = H715;
  if (mode === 'street') { const [px, py] = huv(h, 27.5, 8.5), [tx, ty] = huv(h, 9.6, -0.6); return { pos: to3(px, py, 2.4), target: to3(tx, ty, 5.2) }; }
  const [px, py] = huv(h, 31, 13), [tx, ty] = huv(h, 3, -0.4);
  return { pos: to3(px, py, 15), target: to3(tx, ty, 5) };
}

// ── 740 W Princess Anne Road (case study): a 1919 apartment building ──
// The city's footprint: 20.8 m on Princess Anne, 20.6 m deep, the end bays standing 0.4 m proud; 15.7 m
// high. The assessor's photo (April 2025) shows dark red brick, four floors over a raised basement, porches
// stacked in the outer half of both end bays (white balustrades on all four floors), paired sash windows,
// a stone surround at the centre entrance up a short flight of steps, a white cornice, a lamp post by the
// steps. The FY2026 record: built 1919, an apartment building on a 7,049 sq ft lot.
const H740 = {
  c: [-41.59, 345.37], U: [-0.48, -0.878], V: [0.878, -0.48],
  front: 10.0, bay: 10.4, back: 8.4, rear: -10.4, v0: -10.4, v1: 10.2, bayIn: 4.9, porchDepth: 2.0,
  floors: [0.9, 4.2, 7.5, 10.8, 14.1], cornice: 14.7, top: 15.7,
};
const porches740 = (h) => [[h.v0 + 0.4, h.v0 + 3.4], [h.v1 - 3.4, h.v1 - 0.4]];
function buildHero740(p) {
  const h = H740;
  const M = heroMatsFor({ brick: '#6e2f22', mortar: '#8f5a48', roof: '#3d3a36', trim: '#f2ece0', base: '#5a3428' });
  const g = heroGroup(h); g.userData.trim = M.trim; g.userData.brackets = false;
  const pick = [];
  const wall = (...a) => { const m = hbox(g, ...a, M.wall, 2.4); m.userData.gpin = p.gpin; pick.push(m); return m; };
  const { front: uf, bay: ub, back: uk, rear: ur, v0, v1, bayIn: bi, floors: F, cornice: cy, top } = h;
  const ud = ub - h.porchDepth;   // the porches' back wall
  const solid = (u0, u1, a, b) => { hbox(g, u0, u1, a, b, 0, F[0], M.base); wall(u0, u1, a, b, F[0], cy); };
  // The body behind the porches, the centre between the bays, then each bay around its stack of porches.
  solid(ur, uk, v0, v1);
  solid(uk, uf, -bi, bi);
  const P = porches740(h);
  const bays = [[v0, -bi, P[0]], [bi, v1, P[1]]];
  const winList = [];
  for (const [a, b, [p0, p1]] of bays) {
    for (const [x, y] of [[a, p0], [p1, b]]) solid(uk, ub, x, y);
    solid(uk, ud, p0, p1);
    hbox(g, ud, ub, p0, p1, 0, F[0], M.base);
    for (let f = 1; f <= 4; f++) wall(ud, ub, p0, p1, F[f] - 0.55, f === 4 ? cy : F[f]);   // each porch's floor, the one below's ceiling
    const inner = a < 0 ? (p1 + b) / 2 : (a + p0) / 2;
    for (let f = 0; f < 4; f++) {
      railRun(g, ub - 0.08, p0 + 0.05, ub - 0.08, p1 - 0.05, F[f], M);
      hwin(g, 'u+', ud, (p0 + p1) / 2, F[f] + 0.05, F[f] + 2.4, 1.2, M, f === 0 ? winList : null);   // the porch's French door
      hwin(g, 'u+', ub, inner, F[f] + 0.75, F[f] + 2.55, 1.4, M, f === 0 ? winList : null);
    }
  }
  // Cornice, parapet and its cap; a band over the first floor.
  hbox(g, ur - 0.25, ub + 0.25, v0 - 0.25, v1 + 0.25, cy, cy + 0.3, M.trim);
  wall(ur, ub, v0, v1, cy + 0.3, top);
  hbox(g, ur - 0.05, ub + 0.05, v0 - 0.05, v1 + 0.05, top, top + 0.12, M.trim);
  hbox(g, ur - 0.03, ub + 0.03, v0 - 0.03, v1 + 0.03, F[1] - 0.14, F[1] - 0.02, M.trim);
  // The centre: three windows a floor above, two either side of the entrance on the first floor.
  for (let f = 1; f < 4; f++) for (const v of [-2.9, 0, 2.9]) hwin(g, 'u+', uf, v, F[f] + 0.75, F[f] + 2.55, 1.3, M, null);
  for (const v of [-2.9, 2.9]) hwin(g, 'u+', uf, v, F[0] + 0.7, F[0] + 2.6, 1.4, M, winList);
  hbox(g, uf, uf + 0.18, -1.05, 1.05, F[0], F[0] + 3.0, M.trim);       // the stone surround
  hbox(g, uf, uf + 0.32, -1.25, 1.25, F[0] + 3.0, F[0] + 3.3, M.trim);
  const door = hbox(g, uf + 0.18, uf + 0.22, -0.55, 0.55, F[0], F[0] + 2.5, new THREE.MeshLambertMaterial({ color: 0x3a2418 }));
  for (let i = 1; i <= 4; i++) hbox(g, uf, uf + (5 - i) * 0.3, -1.1, 1.1, 0, i * F[0] / 4, M.deck);
  // Windows down both sides.
  for (const [face, at] of [['v-', v0], ['v+', v1]]) for (let f = 0; f < 4; f++) for (const u of [-7.5, -3.5, 0.5, 4.5]) hwin(g, face, at, u, F[f] + 0.75, F[f] + 2.5, 1.0, M, null);
  // Low shrubs along the front, the lamp post by the steps.
  const rng = rngFor('740-hero');
  for (const [b0, b1] of [[-10.0, -8.6], [-7.4, -5.6], [-4.4, -1.6], [1.6, 4.4], [5.6, 7.4], [8.6, 10.0]]) hedgeRun(g, ub + 0.55, b0, ub + 0.55, b1, M, rng, 0.75, 0.6);
  postLamp(g, ub + 1.3, -2.4);
  return { group: g, pick, winList, door, mats: M };
}
function heroTransform740(kit, p) {
  const h = H740, uf = h.front, ub = h.bay, ud = ub - h.porchDepth, y = h.floors[0];
  const [[a0, a1], [b0, b1]] = porches740(h);
  const innerL = (a1 - h.bayIn) / 2, innerR = (h.bayIn + b0) / 2;
  return caseTransform(kit, p, {
    h,
    letters: [[uf + 0.3, -2.9, y + 1.5, 1.1], [uf + 0.3, 2.9, y + 1.5, 1.1]],
    awnings: [[uf + 0.05, -2.9, y + 3.0, 1.7], [uf + 0.05, 2.9, y + 3.0, 1.7], [ub + 0.05, innerL, y + 3.0, 1.6], [ub + 0.05, innerR, y + 3.0, 1.6]],
    lanterns: [[uf + 0.25, -1.4, y + 2.2], [uf + 0.25, 1.4, y + 2.2]],
    light: [uf + 1.2, 0, y + 2.4],
    tables: [[ud + 1.0, (a0 + a1) / 2, y], [ud + 1.0, (b0 + b1) / 2, y]],
    cart: [ud + 1.0, (a0 + a1) / 2, y],
    benches: [[ud + 1.0, (a0 + a1) / 2, y], [ud + 1.0, (b0 + b1) / 2, y]],
    board: [ub + 2.0, 2.0],
    bulbs: [[ub - 0.2, a0 + 0.1, ub - 0.2, a1 - 0.1, y + 2.6], [ub - 0.2, b0 + 0.1, ub - 0.2, b1 - 0.1, y + 2.6]],
    greeter: [uf + 0.45, 0.6, y * 0.75],
    walkers: [[ub + 3.2, -18, uf + 1.9, -0.6], [ub + 3.6, 18, uf + 2.1, 0.7]],
  });
}
function heroView740(mode) {
  const h = H740;
  if (mode === 'street') { const [px, py] = huv(h, 31, -13), [tx, ty] = huv(h, 10.4, -1.0); return { pos: to3(px, py, 2.2), target: to3(tx, ty, 5.2) }; }
  const [px, py] = huv(h, 40, -20), [tx, ty] = huv(h, 3, 0);
  return { pos: to3(px, py, 21), target: to3(tx, ty, 7) };
}

// ── 1012 Colley Avenue (case study): the end house of a 1908 row ──
// The city's footprint is one polygon for the whole row: 1012 and 1014 Colley and 741–747 Graydon, an L
// around the corner. The build cuts out 1012's piece (data/scripts/build_explorer.py), and this model
// replaces only that. In its own axes (u toward Colley, v along it, + to the south) the piece's front is
// 9.2 m on Colley (v −3.2…6.0), 6.6 m deep; behind 1014's entry bay it runs on to v −6.4. The row is 9.7 m
// high. The assessor's photos (2007, August 2025, June 2026) show painted white brick, two floors over a
// raised base, a raised stoop with dark railings, a black door with a transom, a wide window under a flat
// arch, dark shutters upstairs, a cornice, dormers in the roof, and at the south end a porch behind brick
// piers. The FY2026 record: built 1908, an attached single-family house, 2,028 sq ft, on a 1,149 sq ft lot.
const H1012 = {
  c: [-128.4, 233.26], U: [-0.916, 0.4], V: [-0.4, -0.916],
  front: 3.4, back: -3.2, v0: -3.2, vN: -6.4, uN: 1.8, v1: 6.0,
  baseY: 0.9, f2: 4.3, eave: 7.4, top: 9.7, stoop: 1.2, porchIn: 1.9, porchV: [2.4, 6.0],
};
function buildHero1012(p) {
  const h = H1012;
  const M = heroMatsFor({ brick: '#f7f4ee', mortar: '#e9e4da', roof: '#4a4d51', trim: '#fbf9f4', base: '#d6cdbd' });
  const iron = new THREE.MeshLambertMaterial({ color: dk('#23272b') });
  const tan = heroMatsFor({ brick: '#c9ab86', mortar: '#b39373', roof: '#4a4d51', trim: '#f7f3ea', base: '#b39373' }).wall;
  const dark = { white: iron };   // railRun draws in M.white; the railings here are painted dark
  const g = heroGroup(h); g.userData.trim = M.trim; g.userData.brackets = false;
  const pick = [];
  const wall = (...a) => { const m = hbox(g, ...a, M.wall, 2.4); m.userData.gpin = p.gpin; pick.push(m); return m; };
  const { front: uf, back: ub, v0, vN, uN, v1, baseY: y0, f2, eave: e, top, stoop: sd, porchIn: ui } = h;
  const [pv0, pv1] = h.porchV;
  // The house: the front block, its piece behind 1014's entry bay, and the south porch cut into the corner.
  hbox(g, ub, uf, v0, pv0, 0, y0, M.base);
  wall(ub, uf, v0, pv0, y0, e);
  hbox(g, ub, ui, pv0, v1, 0, y0, M.base);
  wall(ub, ui, pv0, v1, y0, e);
  wall(ui, uf, pv0, v1, f2, e);                      // the second floor runs on over the porch
  wall(ub, uN, vN, v0, 0, top);                      // behind 1014's bay, up to the row's flat roof
  // The cornice and a low hip roof that meets the row's height, with two dormers facing Colley.
  hbox(g, ub - 0.2, uf + 0.28, v0 - 0.05, v1 + 0.28, e, e + 0.32, M.trim);
  hipRoof(g, ub, uf, v0, v1, e + 0.32, 0.2, 0.55, M.roof);
  for (const v of [-1.3, 3.6]) {   // set forward on the slope so each window clears the roof
    hbox(g, uf - 2.0, uf - 0.7, v - 0.65, v + 0.65, e + 0.3, e + 2.0, M.wall);
    gableRoof(g, uf - 2.0, uf - 0.7, v - 0.65, v + 0.65, e + 2.0, 0.5, 0.12, M);
    hwin(g, 'u+', uf - 0.7, v, e + 1.0, e + 1.8, 0.7, M, null);
  }
  // First floor: the wide window under its flat arch, the door with its transom and a lamp.
  const winList = [];
  hwin(g, 'u+', uf, -1.3, y0 + 0.45, y0 + 2.55, 2.0, M, winList);
  hbox(g, uf, uf + 0.14, -2.55, -0.05, y0 + 2.7, y0 + 2.95, M.trim);
  hbox(g, uf, uf + 0.12, 0.35, 1.65, y0, y0 + 3.05, M.trim);
  const door = hbox(g, uf + 0.1, uf + 0.16, 0.5, 1.5, y0, y0 + 2.3, new THREE.MeshLambertMaterial({ color: dk('#1d2024') }));
  hwin(g, 'u+', uf, 1.0, y0 + 2.42, y0 + 2.88, 0.9, M, null);   // the transom
  hbox(g, uf + 0.12, uf + 0.3, 1.85, 2.0, y0 + 1.9, y0 + 2.3, iron);
  // Second floor: three windows with dark shutters.
  for (const [v, w] of [[-1.3, 1.0], [1.0, 0.9], [4.2, 1.0]]) {
    hwin(g, 'u+', uf, v, f2 + 0.55, f2 + 2.35, w, M, null);
    for (const s of [-1, 1]) hbox(g, uf + 0.02, uf + 0.08, v + s * (w / 2 + 0.16) - 0.22, v + s * (w / 2 + 0.16) + 0.22, f2 + 0.5, f2 + 2.4, iron);
  }
  // The stoop across the front, dark railings, steps down to the walk at the door.
  hbox(g, uf, uf + sd, v0 + 0.15, pv0, 0, y0 - 0.06, M.base);
  hbox(g, uf, uf + sd, v0 + 0.15, pv0, y0 - 0.06, y0, M.deck);
  railRun(g, uf + sd - 0.08, v0 + 0.2, uf + sd - 0.08, 0.35, y0, dark, 0.9);
  railRun(g, uf + sd - 0.08, 1.65, uf + sd - 0.08, pv0 - 0.05, y0, dark, 0.9);
  railRun(g, uf + 0.1, v0 + 0.2, uf + sd - 0.08, v0 + 0.2, y0, dark, 0.9);
  const nSteps = 4, rise = y0 / nSteps;
  for (let i = 1; i <= nSteps; i++) hbox(g, uf + sd, uf + sd + (nSteps - i + 1) * 0.3, 0.4, 1.6, 0, i * rise, M.deck);
  // The south porch: brick piers at its corners, a floor on a brick base, dark railings, a window at its back.
  hbox(g, ui, uf, pv0, v1, 0, y0 - 0.06, tan);
  hbox(g, ui, uf, pv0, v1, y0 - 0.06, y0, M.deck);
  for (const v of [pv0 + 0.25, v1 - 0.25]) hbox(g, uf - 0.5, uf, v - 0.25, v + 0.25, 0, f2, tan);
  railRun(g, uf - 0.25, pv0 + 0.55, uf - 0.25, v1 - 0.55, y0, dark, 0.9);
  railRun(g, ui + 0.1, v1 - 0.2, uf - 0.55, v1 - 0.2, y0, dark, 0.9);
  hwin(g, 'u+', ui, 4.2, y0 + 0.45, y0 + 2.55, 1.1, M, winList);
  // Plantings along the stoop and in the side yard, the walk to the steps.
  const rng = rngFor('1012-hero');
  hedgeRun(g, uf + sd + 0.55, v0 + 0.3, uf + sd + 0.55, 0.0, M, rng, 0.8, 0.7);
  hedgeRun(g, uf + sd + 0.55, 2.0, uf + 0.6, v1 + 0.6, M, rng, 0.8, 0.7);
  hedgeRun(g, uf - 0.4, v1 + 1.2, ub + 0.4, v1 + 1.2, M, rng, 1.1, 0.9);
  hbox(g, uf + sd + 1.2, uf + sd + 3.4, 0.45, 1.55, 0, 0.03, M.path);
  return { group: g, pick, winList, door, mats: M };
}
function heroTransform1012(kit, p) {
  const h = H1012, uf = h.front, y0 = h.baseY, f2 = h.f2, sd = h.stoop;
  const [pv0, pv1] = h.porchV;
  return caseTransform(kit, p, {
    h,
    letters: [[uf + 0.3, -1.3, y0 + 1.5, 1.2]],
    sign: { u: uf - 0.25, v: (pv0 + pv1) / 2, y: f2 },
    awnings: [[uf + 0.05, -1.3, y0 + 3.05, 2.3]],
    lanterns: [[uf + 0.25, 0.25, y0 + 2.0], [uf + 0.25, 1.75, y0 + 2.0]],
    light: [uf + 1.0, 0, y0 + 2.2],
    tables: [[uf + 0.62, -2.35, y0], [h.porchIn + 0.75, 4.4, y0]],
    cart: [uf + 0.62, -1.4, y0],
    benches: [[uf + 0.62, -1.3, y0]],
    board: [uf + sd + 2.6, 2.3],
    bulbs: [[uf - 0.25, pv0 + 0.5, uf - 0.25, pv1 + 0.2, f2 - 0.2]],
    greeter: [uf + 0.6, 1.0, y0],
    walkers: [[8.2, -16, uf + sd + 2.4, 0.9], [8.6, 15, uf + sd + 2.6, 1.3]],
  });
}
function heroView1012(mode) {
  const h = H1012;
  // From the south-west, across Colley: the house, its stoop and porch, with the stand of trees at the
  // corner beyond it rather than in front.
  if (mode === 'street') { const [px, py] = huv(h, 23, 10), [tx, ty] = huv(h, 3.4, 1.2); return { pos: to3(px, py, 2.3), target: to3(tx, ty, 4.6) }; }
  const [px, py] = huv(h, 27, 15), [tx, ty] = huv(h, 1, 1);
  return { pos: to3(px, py, 14), target: to3(tx, ty, 5) };
}

// The buildings drawn by hand, by GPIN: 801 Stockley Gardens and the case studies, which also get a page.
const HEROES = {
  '1428701712': { build: buildHero801, transform: heroTransform801, view: heroView },
  '1428706223': { build: buildHero715, transform: heroTransform715, view: heroView715, page: '../case-studies/715-colonial.html' },
  '1428629200': { build: buildHero740, transform: heroTransform740, view: heroView740, page: '../case-studies/740-w-princess-anne.html' },
  '1428615872': { build: buildHero1012, transform: heroTransform1012, view: heroView1012, page: '../case-studies/1012-colley.html' },
};

// ── Frame ──
function tick(now) {
  const { renderer, scene, camera, controls } = three;
  if (flight) {
    const k = clamp01((now - flight.start) / flight.dur), e = ease(k);
    camera.position.lerpVectors(flight.from.pos, flight.to.pos, e);
    controls.target.lerpVectors(flight.from.target, flight.to.target, e);
    if (k >= 1) flight = null;
  }
  if (activeKit && activeKit.tweens.length && !REDUCE) {
    const k = clamp01((now - activeKit.start) / activeKit.dur);
    for (const t of activeKit.tweens) t.fn(clamp01((k - t.t0) / (t.t1 - t.t0)));
  }
  controls.update();
  renderer.render(scene, camera);
}

boot().catch((err) => {
  const note = $('scene-note');
  note.textContent = `The explorer couldn't load its data (${err.message}).`;
  note.hidden = false;
});
