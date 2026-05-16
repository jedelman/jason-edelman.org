# Alexander Pattern ML Pipeline

Validates Christopher Alexander's Pattern Language rules against real neighborhoods
using OSM-derived field arrays. Target: train a model to score pattern presence
and generate Military Circle site geometry conditioned on high-scoring patterns.

## Architecture

**Near term (Python):** OSM fetch → rasterization → feature extraction → pattern scoring
**Target (Rust + Ferrotorch):** same pipeline, GPU-accelerated, production inference

## Data

`data/osm_fields/` — 1000×1000 float32 numpy arrays at ~1px=1m for 5 neighborhoods:

| Neighborhood | Label | Notes |
|---|---|---|
| barcelona_eixample | positive | Cerda grid, superblocks, high Alexander density |
| greenwich_village_nyc | positive | Pre-grid organic pattern, mixed use |
| kyoto_gion | positive | Traditional machiya, fine-grained grain |
| tysons_corner_va | negative | Edge city, car-centric, low vitality |
| military_circle_norfolk | target | Our site — 73ac, current baseline |

### Field Arrays (per neighborhood)
- `*_built.npy` — binary building footprint mask [0,1]
- `*_street.npy` — binary street centerline mask [0,1]
- `*_amenity.npy` — amenity point density, gaussian σ=50m, normalized [0,1]
- `*_building_height.npy` — height proxy in stories (from OSM tags, default 3)
- `*_connectivity.npy` — intersection density, gaussian σ=50m, normalized [0,1]

### Baseline Scores (mean field values)

| | built | amenity | connectivity |
|---|---|---|---|
| Barcelona | 0.434 | 0.467 | 0.324 |
| Kyoto | 0.360 | 0.230 | 0.293 |
| Greenwich | 0.342 | 0.117 | 0.309 |
| Tysons | 0.254 | 0.093 | 0.258 |
| **Military Circle** | **0.115** | **0.028** | **0.188** |

Military Circle is dead last on every metric — the baseline we're building against.

## Next Steps

1. **Pattern feature extractor** — compute per-pattern scores from field arrays
   (P29 density gradient, P30 activity node clustering, P46 shop diversity, etc.)
2. **Expand dataset** — add 10-15 more neighborhoods (positive + negative examples)
3. **Interaction weight matrix** — 40×40 pattern co-occurrence, train on real neighborhoods
4. **Synthetic sampler** — generate neighborhoods from Alexander grammar for data augmentation
5. **Rust port** — rewrite pipeline with Ferrotorch for GPU inference

## Scripts

- `scripts/fetch_osm.py` — Overpass API fetch, saves `osm_raw.json`
- `scripts/rasterize.py` — rasterize raw OSM to field arrays
