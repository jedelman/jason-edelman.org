# Eastside Commons — Site Plan Tool: Architecture Specification

**Version:** 2026-05-14  
**Files:** `index.html` (~10,000 lines), `ec-solver-worker.js` (1,106 lines), `view-3d.html` (1,353 lines)  
**Deployment:** Cloudflare Workers Assets · `jedelman/jason-edelman.org`

---

## 1. Design Intent

The site plan tool generates urban form for the 73-acre Military Circle site using Alexander pattern language as the generative engine. Patterns write Gaussian pressure fields; fields are combined and traced; buildings emerge from pressure ridges. The output is a 2D plan that can be inspected at parcel scale, exported, and passed to a 3D viewer.

**Non-negotiable principles:**
- Pattern language drives geometry, not sliders or arbitrary grids
- All coordinates are in **feet** (1 SVG unit = 1 ft)
- EDA parcel boundaries are the hard constraint — nothing builds outside them
- The canonical numbers (5,118 units, 96% affordable, ~$994M buildout) are targets, not inputs

---

## 2. Coordinate System

| Property | Value |
|---|---|
| SVG viewBox | `0 0 4200 3700` |
| 1 SVG unit | 1 ft |
| MAP bounds | `{x0:0, y0:0, x1:4200, y1:3700}` |
| EDA site extent | ~3,038 ft EW × ~2,551 ft NS (padded to canvas) |
| Clipper scale | `CLIPPER_SCALE = 1000` (1 ft → 1,000 Clipper integer units) |
| proj() output | `[ft_x, ft_y]` — Mercator, derived from PARCEL_DATA bounds |

**Invariant:** `proj()` always returns feet. Any function receiving `proj` output is working in feet. Do not convert to pixels anywhere.

---

## 3. Module Map

```
index.html
├── PARCEL_DATA (const, ~84KB)          GIS parcel polygons — the ground truth
├── buildProjection()                   Mercator proj, returns {proj, MAP}
│
├── EC_Interactive                      Constraint solver (zones of influence)
│   ├── solveConstraints()              Voronoi-style district assignment
│   ├── buildSVG()                      Renders constraint geometry to SVG
│   └── initInteractiveLayer()          Bootstraps on DOMContentLoaded
│
├── EC_Pipeline                         EA pipeline (geometry → zones → units)
│   ├── buildT1GroundTruth()            Setbacks, roads, EDA parcels
│   ├── buildT2Zones()                  Grid/parcel decomposition (UNUSED as primary)
│   ├── runT3EA()                       Evolutionary algorithm (UNUSED as primary)
│   ├── buildT4Units()                  Unit module placement
│   ├── applyT5Interactions()           Edge mutation rules
│   ├── applyT6Cleanup()                Cleanup pass
│   ├── PLANNING (const)                All planning constants in feet
│   └── USES (const)                    Use taxonomy + colors
│
├── EC_Decomp                           Polygon decomposition (Clipper-based)
│   ├── buildT2PolygonZones()           Parcel-accurate T2 (preferred over grid)
│   └── renderT7Polygons()              SVG render from zone polygons
│
├── EC_T4                               Polygon-aware unit placer
│   ├── buildUnits()                    Places 25ft lots within poly.outer
│   └── subdivideZone()                 Splits large zones
│
├── EC_Edges                            Street edge classifier
│   ├── buildEdges()                    Classifies zone adjacencies
│   └── renderEdges()                   Draws edge overlays to SVG
│
├── EC_PatternSolver                    Instance-graph solver (UNUSED as primary)
│   └── solve()                         Returns sceneGraph{instances,buildings}
│
├── EC_FieldSolver                      PRIMARY GEOMETRY ENGINE
│   ├── PATTERNS (50+ Alexander patterns, each with sense() fn)
│   ├── solve()                         Pressure field → field lines → buildings
│   ├── buildHotNodes()                 Local maxima of pattern convergence
│   └── buildFootprints()              Cluster hot nodes → axis-aligned rects
│
├── EC_Save                             State persistence
│   ├── saveToHash() / loadFromHash()   URL hash state
│   └── saveToFile() / loadFromFile()   JSON download/upload
│
├── patternInstancesToZones()           Translate FieldSolver output → zone objects
│                                       (for summary stats and 3D handoff)
│
├── triggerPipeline()                   Main entry point — spawns worker
├── applyFieldResult()                  Applies worker result to map + stats
├── resumeFromCache()                   Restores localStorage on load
│
├── renderPlanBuildings()               PRIMARY SVG RENDERER
│   ├── EDA outlines layer              Always on
│   ├── Field lines layer               Toggle: Fields btn
│   ├── Buildings layer                 Always on (rects from FieldSolver)
│   └── Hot nodes layer                 Part of buildings layer
│
├── EC_PanZoom                          Touch pan/zoom
│   ├── init() / reinit()
│   ├── reset() / fitBBox()
│   └── zoomTo('site'|'block'|'parcel'|'unit')
│
└── Analysis views
    ├── renderPeopleView()
    ├── renderParcelsView()
    ├── renderAccessView()
    └── renderFinancialsView()

ec-solver-worker.js
├── PARCEL_DATA (copy)                  Needed to rebuild proj in worker scope
├── buildProjection() (copy)
├── EC_FieldSolver (copy)
└── onmessage handler
    ├── Receives: {parcels, derivedG, MAP, opts}
    ├── Posts progress: {type:'progress', pass, delta, saturated}
    ├── Posts result: {type:'result', payload}
    └── Writes localStorage['ec-solver-result'] before postMessage

view-3d.html
├── PARCEL_DATA (copy)
├── buildProjection() (copy)
├── EC3D                                Three.js r128 extruded zone viewer
└── Bootstrap: reads localStorage['ec-state'], renders 3D
```

---

## 4. Primary Data Flow

```
Page load
  → EC_Interactive.initInteractiveLayer()
      → buildProjection(PARCEL_DATA)   → proj, MAP
      → solveConstraints()             → G (district graph)
      → buildSVG()                     → SVG base layer (EDA outlines, labels)
      → exportDerived()                → window._derivedG {SPINE, SPONGE, BAND, TIDE}
      → window._pipelineReady = true
      → resumeFromCache()              → if hit: applyFieldResult() and done
      → triggerPipeline()              → if miss: spawn worker

triggerPipeline()
  → buildT1GroundTruth()               → t1 {scale, setbacks, edaParcels, MAP}
  → new Worker('ec-solver-worker.js')
  → postMessage({parcels, derivedG, MAP, opts})

Worker
  → buildProjection(PARCEL_DATA)       → proj
  → EC_FieldSolver.solve()
      → buildEdaMask()                 → EDA polygon mask on grid
      → for each pass:
          → each PATTERN.sense()       → writes Gaussian pressure to Float32Array
          → combineFields()            → weighted sum, normalized
          → Δ convergence check        → onPass() progress callback
          → findSeeds()                → local maxima above threshold
          → traceFieldLines()          → ridge-following paths
          → annotateFieldLine()        → tag each point with pattern weights
      → buildHotNodes()                → deduplicated local maxima (nStrong ≥ 3)
      → buildFootprints()              → cluster hot nodes → {x,y,w,h,domPid}
  → write localStorage['ec-solver-result']
  → postMessage({type:'result', payload})

applyFieldResult(psResult, params, t1)
  → renderPlanBuildings(sceneGraph)
      → EDA polygon outlines
      → field line traces (if toggled)
      → building rects with 25ft parcel subdivisions + courtyard voids
      → hot node amber circles
  → EC_PanZoom.fitBBox(EDA extent)
  → patternInstancesToZones()          → zone objects for stats + 3D handoff
  → update results panel (units, affordable%, green%)
  → write localStorage['ec-state']     → for view-3d.html
```

---

## 5. EC_FieldSolver — Pattern Catalogue

50+ Alexander patterns. Each has a `sense(field, gw, gh, cellSize, MAP, site, pass)` function that paints Gaussian pressure onto a Float32Array grid.

**Scale hierarchy:**
- **District** (P29, 30, 31, 36, 53): Site-wide structure — density rings, promenade spine, gateways, activity nodes
- **Block** (P37, 51, 60, 61, 67, 71): Neighborhood clusters — house clusters, green space, still water, green streets
- **Group** (P95, 104, 105, 106, 109, 114, 116): Building groups — building complex (25ft lots), site repair, south-facing, positive outdoor space
- **Building** (P107, 108, 110, 115, 119, 121, 122, 123, 127, 128, 160): Individual buildings — wings of light, courtyards, arcades, building fronts, intimacy gradient
- **Edge** (P46, P87, P88, P100): Street activation — market, shops, cafes, pedestrian street

**Convergence:** Mean absolute Δ between passes < ε (default 0.008) after pass 2. Typically saturates at pass 8–12 of 16.

**Output building shape:**
```js
{
  x, y,        // ft — top-left of bounding rect
  w, h,        // ft — width and depth
  pts,         // hot nodes in this cluster
  domPid,      // dominant pattern ID
  avgStrong,   // average simultaneous pattern count
}
```

**Unit estimate from building:** `lots = round(w / 25)`, `units = lots × 15` (5 floors × ~3 units/floor/lot).

---

## 6. Coordinate-Sensitive Invariants

These must hold after any refactor:

| Invariant | Where enforced |
|---|---|
| `proj()` returns `[ft_x, ft_y]` | `buildProjection()` |
| MAP = `{x0:0, y0:0, x1:4200, y1:3700}` | `buildProjection()` |
| Clipper inputs: multiply by 1000 | `toClipper()` / `fromClipper()` |
| Pattern distances in feet | All `paintGaussian` radius args |
| DEDUP_R values in feet | `const DEDUP_R` in EC_PatternSolver |
| SVG viewBox = `0 0 4200 3700` | HTML `<svg>` element |
| PLANNING constants in feet | `const PLANNING` |
| EDA clip = intersection with EDA union | `patternInstancesToZones()` |

**Anti-patterns to avoid:**
- Never multiply proj output by a px/ft conversion factor — it's already in feet
- Never hardcode `960`, `760`, `841`, `653` (old px canvas) anywhere
- Never reference `window.*` inside `ec-solver-worker.js` (use `self.*`)
- Never call `localStorage` inside `ec-solver-worker.js` — workers have no localStorage; post data to main thread which writes it
- Never allocate large typed arrays on the main thread during solve — that's the worker's job

---

## 7. LOD System

Four zoom levels trigger `updateLOD()` in EC_PanZoom:

| Level | Zoom threshold | Visible |
|---|---|---|
| `site` | < 0.35 | EDA outlines, building fills, district labels |
| `block` | 0.35–0.80 | + unit count labels, hot node circles |
| `parcel` | 0.80–2.0 | + 25ft lot subdivision lines, courtyard voids |
| `unit` | ≥ 2.0 | + individual unit modules (future) |

SVG elements tagged `data-lod="parcel"` are hidden at site/block scale. Stroke widths and font sizes are scaled inversely (`1/zoom`) to stay readable.

---

## 8. State Persistence

| Key | Store | Contents | Consumer |
|---|---|---|---|
| `ec-solver-result` | localStorage | FieldSolver output: buildings, hotNodes, fieldLines, log, ts | `resumeFromCache()` on load |
| `ec-state` | localStorage | zones, EDA parcels, seed, params, ts | `view-3d.html` |
| URL hash `#ec:…` | URL | Seed + zone use overrides | `loadFromHash()` / `saveToHash()` |

Cache freshness: `ec-solver-result` accepted if < 7 days old and `buildings.length > 0`.

---

## 9. Known Dead Code

These modules are present but not called in the current primary pipeline. Kept for potential future use or reactivation:

- `EC_PatternSolver` — instance-graph solver (replaced by EC_FieldSolver as geometry source)
- `runT3EA()` — evolutionary algorithm
- `buildT2Zones()` — grid-based zone decomposition  
- `scoreCandidate()` — EA scoring function
- `runPipeline()` — old async T1→T7 pipeline

`patternInstancesToZones()` IS active — called by `applyFieldResult()` to produce zone objects for summary stats and 3D state handoff, even though EC_FieldSolver buildings are the rendered geometry.

---

## 10. Files and Sizes

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~10,000 | Main application — all JS inline |
| `ec-solver-worker.js` | ~1,100 | Web Worker — field solver + parcel data |
| `view-3d.html` | ~1,350 | Standalone Three.js 3D viewer |
| `zine.html` | — | Community bifold pamphlet |
| `pitch-cityhall.html` | — | City Council pitch |
| `pitch-investors.html` | — | Investor pitch |
| `pitch-coalition.html` | — | Coalition pitch |

**PARCEL_DATA is duplicated** in `index.html`, `ec-solver-worker.js`, and `view-3d.html`. This is intentional — each context is self-contained (worker has no DOM access; view-3d has no main script access). If parcel data changes, update all three.

---

## 11. Design Decisions Log

| Decision | Rationale |
|---|---|
| EC_FieldSolver over EC_PatternSolver as geometry source | Field solver produces 150–200 buildings with full site coverage; instance-graph solver produced ~9 |
| Web Worker for field solve | 3ft grid = 1.7M cells kills main thread; Worker keeps UI responsive and allows crash recovery |
| localStorage crash recovery | 30–60s solve on mobile; browser can crash mid-run; resume from cache is instant |
| 1 SVG unit = 1 ft | Eliminates px↔ft conversion errors; planning constants usable directly in geometry |
| EC_PatternSolver kept in codebase | Still used via `patternInstancesToZones()` for zone-level stats; may be reactivated for LOD detail |
| PARCEL_DATA duplicated across files | Self-containment > DRY for cross-context isolation |
| `preserveAspectRatio="xMidYMid slice"` | Map fills container; `meet` leaves blank space on mobile |
| Full-bleed via `left:50%; margin:-50vw` | Escapes both body padding and page max-width without changing page layout |
