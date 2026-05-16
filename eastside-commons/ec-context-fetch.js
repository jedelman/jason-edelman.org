// ec-context-fetch.js
// Fetches Norfolk GIS building footprints + street centerlines outside the EDA bbox,
// rasterizes them onto the GPU grid, and returns Float32Arrays for:
//   F0: comfort (building density proxy)
//   F1: movement (street vector direction)
//   F2: interest_z (building mass as latent activity goal)
//
// These become boundary conditions (non-EDA IC values) so the existing city
// fabric diffuses inward rather than the void starting at zero.
//
// Runs in main thread (needs fetch). Result cached in localStorage for 7 days.
// Returns: { f0: Float32Array(GW*GH*4), f1: Float32Array(GW*GH*4), f2: Float32Array(GW*GH*4) }
// All RGBA32F layout (r=value, g=b=a=0 for scalar; r/g = vector components for movement)

const EC_CONTEXT_CACHE_KEY = 'ec-context-fields-v2';
const EC_CONTEXT_CACHE_TTL = 7 * 24 * 3600 * 1000; // 7 days

// ArcGIS REST endpoints
const NORFOLK_BUILDINGS_URL =
  'https://gisshare.norfolk.gov/pubserver/rest/services/OpenData/Parcels/FeatureServer/1/query';
const NORFOLK_STREETS_URL =
  'https://gisshare.norfolk.gov/pubserver/rest/services/OpenData/Public_Works/MapServer/0/query';

// Virginia statewide buildings fallback
const VDEM_BUILDINGS_URL =
  'https://gismaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Building_Footprints/FeatureServer/0/query';

/**
 * Main entry point.
 * @param {object} bounds  - { minLon, maxLon, minLat, maxLat } WGS84
 * @param {object} MAP     - { x0, x1, y0, y1 } in feet (proj output space)
 * @param {function} proj  - (lon, lat) => [x_ft, y_ft]
 * @param {number} GW      - grid width in cells
 * @param {number} GH      - grid height in cells
 * @param {number} CELL_FT - feet per cell
 * @param {function} [onStatus] - optional (msg) => void progress callback
 * @returns {Promise<{f0, f1, f2}>} three RGBA32F Float32Arrays of length GW*GH*4
 */
async function fetchContextFields(bounds, MAP, proj, GW, GH, CELL_FT, onStatus = () => {}) {
  // ── Cache check ─────────────────────────────────────────────────────────
  try {
    const raw = localStorage.getItem(EC_CONTEXT_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      const age = Date.now() - (cached.ts || 0);
      if (age < EC_CONTEXT_CACHE_TTL && cached.GW === GW && cached.GH === GH) {
        onStatus('context: loaded from cache');
        return {
          f0: new Float32Array(cached.f0),
          f1: new Float32Array(cached.f1),
          f2: new Float32Array(cached.f2),
        };
      }
    }
  } catch (_) {}

  const N = GW * GH;
  // RGBA32F layout: f0=comfort, f1=movement(xy), f2=interest_z
  const f0 = new Float32Array(N * 4);
  const f1 = new Float32Array(N * 4);
  const f2 = new Float32Array(N * 4);

  // Raster accumulators (single-channel)
  const bldgDensity = new Float32Array(N); // building footprint coverage [0,1]
  const bldgHeight  = new Float32Array(N); // normalized height proxy [0,1]
  const streetMag   = new Float32Array(N); // street presence [0,1]
  const streetDX    = new Float32Array(N); // street direction X
  const streetDY    = new Float32Array(N); // street direction Y

  // ── Helper: lon/lat → cell index ────────────────────────────────────────
  function cellIdx(lon, lat) {
    const [fx, fy] = proj(lon, lat);
    const cx = Math.round((fx - MAP.x0) / CELL_FT);
    const cy = Math.round((fy - MAP.y0) / CELL_FT);
    if (cx < 0 || cx >= GW || cy < 0 || cy >= GH) return -1;
    return cy * GW + cx;
  }

  function cellFromFt(fx, fy) {
    const cx = Math.round((fx - MAP.x0) / CELL_FT);
    const cy = Math.round((fy - MAP.y0) / CELL_FT);
    if (cx < 0 || cx >= GW || cy < 0 || cy >= GH) return -1;
    return cy * GW + cx;
  }

  // ── Helper: ArcGIS REST bbox query ──────────────────────────────────────
  // Returns GeoJSON features (WGS84). Paginates up to maxFeatures.
  async function arcgisQuery(baseUrl, params, maxFeatures = 2000) {
    const features = [];
    let offset = 0;
    const pageSize = Math.min(maxFeatures, 1000);
    while (features.length < maxFeatures) {
      const url = new URL(baseUrl);
      Object.entries({ ...params, resultOffset: offset, resultRecordCount: pageSize,
                       f: 'geojson', outSR: '4326' })
            .forEach(([k, v]) => url.searchParams.set(k, v));
      try {
        const r = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
        if (!r.ok) break;
        const json = await r.json();
        const batch = json.features || [];
        features.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
      } catch (_) { break; }
    }
    return features;
  }

  // Bounding box string for ArcGIS geometry filter (WGS84)
  const bboxStr = `${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}`;
  const commonParams = {
    geometry: bboxStr,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
  };

  // ── Fetch buildings ──────────────────────────────────────────────────────
  onStatus('context: fetching Norfolk buildings…');
  let buildingFeatures = [];
  try {
    buildingFeatures = await arcgisQuery(NORFOLK_BUILDINGS_URL, commonParams, 2000);
    onStatus(`context: ${buildingFeatures.length} Norfolk building footprints`);
  } catch (_) {}

  // Fallback to VDEM statewide if Norfolk GIS fails or returns nothing
  if (buildingFeatures.length === 0) {
    onStatus('context: Norfolk GIS failed, trying VDEM statewide…');
    try {
      buildingFeatures = await arcgisQuery(VDEM_BUILDINGS_URL, commonParams, 2000);
      onStatus(`context: ${buildingFeatures.length} VDEM building footprints`);
    } catch (_) {}
  }

  // ── Rasterize building footprints ────────────────────────────────────────
  // For each polygon, mark cells inside with bldgDensity=1 and height proxy.
  for (const feat of buildingFeatures) {
    const geom = feat.geometry;
    if (!geom) continue;
    const rings = geom.type === 'Polygon'    ? geom.coordinates :
                  geom.type === 'MultiPolygon' ? geom.coordinates.flat() : [];
    for (const ring of rings) {
      if (!ring.length) continue;
      // Bounding box scan-line rasterization
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [lon, lat] of ring) {
        const [fx, fy] = proj(lon, lat);
        minX = Math.min(minX, fx); maxX = Math.max(maxX, fx);
        minY = Math.min(minY, fy); maxY = Math.max(maxY, fy);
      }
      // Project ring to cell space for PIP
      const ringCells = ring.map(([lon, lat]) => {
        const [fx, fy] = proj(lon, lat);
        return [(fx - MAP.x0) / CELL_FT, (fy - MAP.y0) / CELL_FT];
      });
      const cxMin = Math.max(0, Math.floor((minX - MAP.x0) / CELL_FT) - 1);
      const cxMax = Math.min(GW - 1, Math.ceil((maxX - MAP.x0) / CELL_FT) + 1);
      const cyMin = Math.max(0, Math.floor((minY - MAP.y0) / CELL_FT) - 1);
      const cyMax = Math.min(GH - 1, Math.ceil((maxY - MAP.y0) / CELL_FT) + 1);

      // Rough height: prefer BLDG_HT field, else assume 1 story (10ft → normalized 0.15)
      const rawHt = feat.properties?.BLDG_HT || feat.properties?.HEIGHT_FT || feat.properties?.height || 10;
      const normHt = Math.min(1.0, Number(rawHt) / 65.0); // normalize to max 65ft

      for (let cy = cyMin; cy <= cyMax; cy++) {
        for (let cx = cxMin; cx <= cxMax; cx++) {
          if (pip2D(cx + 0.5, cy + 0.5, ringCells)) {
            const idx = cy * GW + cx;
            bldgDensity[idx] = Math.max(bldgDensity[idx], 1.0);
            bldgHeight[idx]  = Math.max(bldgHeight[idx], normHt);
          }
        }
      }
    }
  }

  // ── Fetch street centerlines ─────────────────────────────────────────────
  onStatus('context: fetching Norfolk streets…');
  let streetFeatures = [];
  try {
    streetFeatures = await arcgisQuery(NORFOLK_STREETS_URL, commonParams, 1000);
    onStatus(`context: ${streetFeatures.length} street segments`);
  } catch (_) {}

  // ── Rasterize street centerlines ─────────────────────────────────────────
  // Bresenham-like walk along each polyline, writing direction vector.
  // Buffer radius: CELL_FT * 1.5 (half-lane approximation)
  const STREET_RADIUS = Math.ceil(1.5);
  for (const feat of streetFeatures) {
    const geom = feat.geometry;
    if (!geom) continue;
    const lines = geom.type === 'LineString'      ? [geom.coordinates] :
                  geom.type === 'MultiLineString'  ? geom.coordinates : [];
    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const [lon0, lat0] = line[i];
        const [lon1, lat1] = line[i + 1];
        const [fx0, fy0] = proj(lon0, lat0);
        const [fx1, fy1] = proj(lon1, lat1);
        const dx = (fx1 - fx0) / CELL_FT;
        const dy = (fy1 - fy0) / CELL_FT;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.01) continue;
        const ndx = dx / len, ndy = dy / len;
        // Walk along segment in cell steps
        const steps = Math.ceil(len) + 1;
        for (let t = 0; t <= steps; t++) {
          const cx = Math.round((fx0 - MAP.x0) / CELL_FT + ndx * t);
          const cy = Math.round((fy0 - MAP.y0) / CELL_FT + ndy * t);
          // Stamp a radius
          for (let ry = -STREET_RADIUS; ry <= STREET_RADIUS; ry++) {
            for (let rx = -STREET_RADIUS; rx <= STREET_RADIUS; rx++) {
              const pcx = cx + rx, pcy = cy + ry;
              if (pcx < 0 || pcx >= GW || pcy < 0 || pcy >= GH) continue;
              const dist = Math.sqrt(rx * rx + ry * ry);
              if (dist > STREET_RADIUS) continue;
              const w = 1.0 - dist / (STREET_RADIUS + 1);
              const idx = pcy * GW + pcx;
              if (w > streetMag[idx]) {
                streetMag[idx] = w;
                streetDX[idx]  = ndx;
                streetDY[idx]  = ndy;
              }
            }
          }
        }
      }
    }
  }

  // ── Convolve a small Gaussian blur on bldgDensity for smooth falloff ────
  // 3×3 box filter × 2 passes ≈ Gaussian σ≈1
  boxBlur(bldgDensity, GW, GH, 3);
  boxBlur(bldgDensity, GW, GH, 3);
  boxBlur(bldgHeight, GW, GH, 3);
  boxBlur(bldgHeight, GW, GH, 3);

  // ── Pack into RGBA32F output arrays ─────────────────────────────────────
  // F0.r = comfort  (building density + height → human-scale enclosure)
  // F1.r = movement_x  F1.g = movement_y  (street direction)
  // F2.r = interest_z  (building mass as latent activity)
  for (let i = 0; i < N; i++) {
    const comfort   = Math.min(1.0, bldgDensity[i] * 0.5 + bldgHeight[i] * 0.3 + streetMag[i] * 0.2);
    const interest  = Math.min(1.0, bldgDensity[i] * 0.6 + streetMag[i] * 0.4);
    const mvx       = streetDX[i] * streetMag[i] * 0.4;
    const mvy       = streetDY[i] * streetMag[i] * 0.4;

    f0[i * 4]     = comfort;   // F0.r = comfort
    f1[i * 4]     = mvx;       // F1.r = movement_x
    f1[i * 4 + 1] = mvy;       // F1.g = movement_y
    f2[i * 4]     = interest;  // F2.r = interest_z
  }

  onStatus('context: fields built — caching');

  // ── Cache ────────────────────────────────────────────────────────────────
  try {
    localStorage.setItem(EC_CONTEXT_CACHE_KEY, JSON.stringify({
      ts: Date.now(), GW, GH,
      f0: Array.from(f0),
      f1: Array.from(f1),
      f2: Array.from(f2),
    }));
  } catch (_) {} // quota exceeded — skip cache

  return { f0, f1, f2 };
}

// ── 2D point-in-polygon (cell coordinates) ───────────────────────────────
function pip2D(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// ── Simple box blur (in-place) ───────────────────────────────────────────
function boxBlur(arr, W, H, radius) {
  const tmp = new Float32Array(W * H);
  const r = Math.floor(radius / 2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, count = 0;
      for (let ky = -r; ky <= r; ky++) {
        for (let kx = -r; kx <= r; kx++) {
          const nx = x + kx, ny = y + ky;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
            sum += arr[ny * W + nx]; count++;
          }
        }
      }
      tmp[y * W + x] = sum / count;
    }
  }
  arr.set(tmp);
}

// Export for use in pipeline
window.EC_Context = { fetchContextFields };
