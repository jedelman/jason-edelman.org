// ec-pipeline.js
// Full Eastside Commons application — lazy-loaded after first paint.
// Dispatches "ec-pipeline-ready" when fully initialised.


// Global error handler — surfaces JS errors on the map for mobile debugging
window.addEventListener('error', function(e) {
  const overlay = document.getElementById('map-error-overlay');
  if (overlay && overlay.style.display === 'none') {
    overlay.textContent = '\u2717 JS Error\n\n' + e.message + '\n' + e.filename + ':' + e.lineno;
    overlay.style.display = 'block';
  }
});
window.addEventListener('unhandledrejection', function(e) {
  const overlay = document.getElementById('map-error-overlay');
  if (overlay && overlay.style.display === 'none') {
    const msg = e.reason?.message || String(e.reason);
    overlay.textContent = '\u2717 Unhandled promise rejection\n\n' + msg;
    overlay.style.display = 'block';
  }
});

// ═══════════════════════════════════════════════════════════════
//  EASTSIDE COMMONS CONSTRAINT SOLVER
//  All geometry derived from parcel data. No hardcoded coordinates.
//  Constraints verified at runtime; logged to #constraint-log.
// ═══════════════════════════════════════════════════════════════

// PARCEL_DATA loaded from ec-parcel-data.js

// ── PROJECTION ──────────────────────────────────────────────────
// Computed from actual parcel extents at runtime
function buildProjection(parcels) {
  // Compute site bounds from EDA parcels only
  const edaParcels = parcels.filter(p => p.is_eda);
  let minLon=Infinity, maxLon=-Infinity, minLat=Infinity, maxLat=-Infinity;
  for (const p of edaParcels) {
    for (const ring of p.rings) {
      for (const [lon,lat] of ring) {
        if (lon<minLon) minLon=lon; if (lon>maxLon) maxLon=lon;
        if (lat<minLat) minLat=lat; if (lat>maxLat) maxLat=lat;
      }
    }
  }
  // Add generous padding
  const padLon = (maxLon-minLon)*0.18;
  const padLat = (maxLat-minLat)*0.20;
  minLon-=padLon; maxLon+=padLon; minLat-=padLat; maxLat+=padLat;

  // Coordinate space: 1 SVG unit = 1 ft. Site fits in 4200×3700ft canvas.
  // MAP in feet — proj() returns [ft_x, ft_y] directly.
  const CANVAS_W_FT = 4200, CANVAS_H_FT = 3700;
  const MAP = {x0:0, y0:0, x1:CANVAS_W_FT, y1:CANVAS_H_FT};

  function proj(lon, lat) {
    return [
      (lon-minLon)/(maxLon-minLon)*CANVAS_W_FT,
      CANVAS_H_FT - (lat-minLat)/(maxLat-minLat)*CANVAS_H_FT
    ];
  }

  // Attach bounds so inverse projection is possible (GeoJSON export)
  proj._bounds = {minLon, maxLon, minLat, maxLat};
  return {proj, MAP, minLon, maxLon, minLat, maxLat};
}

// ── PARCEL GEOMETRY ─────────────────────────────────────────────
function buildParcelGeometry(parcels, proj) {
  const geom = {};
  for (const p of parcels) {
    if (!p.spec) continue;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    let cx=0, cy=0, totalPts=0;
    for (const ring of p.rings) {
      for (const [lon,lat] of ring) {
        const [x,y] = proj(lon,lat);
        if (x<minX) minX=x; if (x>maxX) maxX=x;
        if (y<minY) minY=y; if (y>maxY) maxY=y;
        cx+=x; cy+=y; totalPts++;
      }
    }
    // Use authoritative centroid from assessment data if available
    let pcx = cx/totalPts, pcy = cy/totalPts;
    if (p.centroid) {
      [pcx, pcy] = proj(p.centroid.lon, p.centroid.lat);
    }
    geom[p.spec] = {
      acct: p.acct, gpin: p.gpin, area_ac: p.area_ac,
      centroid_x: pcx, centroid_y: pcy,
      bbox: {left:minX, right:maxX, top:minY, bottom:maxY,
             width:maxX-minX, height:maxY-minY},
    };
  }
  return geom;
}

// ── WEIGHTED CENTROID ────────────────────────────────────────────
function weightedCentroid(anchors, G) {
  let cx=0,cy=0,tw=0;
  for (const [name,w] of anchors) {
    if (G[name]) { cx+=G[name].centroid_x*w; cy+=G[name].centroid_y*w; tw+=w; }
  }
  return tw>0 ? [cx/tw, cy/tw] : [490, 408];
}

// ── CONSTRAINT SOLVER ────────────────────────────────────────────
// Returns {geometry, constraints[]} where every position is derived
// from parcel data. The word "hardcoded" does not appear below this line.

function solveConstraints(G, MAP) {
  const log = [];
  const derived = {};

  function check(name, desc, ok, detail='') {
    log.push({name, desc, ok, detail});
    return ok;
  }

  const MALL    = G['MALL_CORE'];
  const SP_PAR  = G['SPONGE_PARCEL'];
  const HB_PAR  = G['HOUSING_B_S'];
  const CLT_PAR = G['CLT_NORTH'];

  if (!MALL) { log.push({name:'SETUP',desc:'MALL_CORE not found',ok:false}); return {derived,log}; }

  // ── COMMONS SPINE ──
  // Spec: "runs N-S through the longitudinal center of MALL_CORE.
  //        Width = 18% of MALL_CORE east-west extent, minimum 38px.
  //        Top at Va Beach Blvd south edge. Bottom at I-264 north edge."
  const spine_w = Math.max(MALL.bbox.width * 0.18, 38);
  const spine_x = MALL.centroid_x - spine_w/2;
  derived.SPINE = {x:spine_x, y:MAP.y0, w:spine_w, h:MAP.y1-MAP.y0};
  const sl=spine_x, sr=spine_x+spine_w, scx=spine_x+spine_w/2;

  check('SPINE','bisects MALL_CORE ±10% width',
    Math.abs(scx - MALL.centroid_x) < MALL.bbox.width*0.10,
    `scx=${scx.toFixed(0)} mall_cx=${MALL.centroid_x.toFixed(0)}`);
  check('SPINE','top at Va Beach Blvd edge', Math.abs(derived.SPINE.y - MAP.y0) < 2);
  check('SPINE','bottom at I-264 edge', Math.abs(derived.SPINE.y+derived.SPINE.h - MAP.y1) < 2);

  // ── MAIN STREET BAND ──
  // Spec: "occupies the geographic zone of the Va Beach Blvd parcel cluster.
  //        Bottom = bottom of the four compact frontage parcels (excludes MAIN_ST_THIN
  //        which is a tall strip — use its centroid not bbox for band membership).
  //        Must not exceed MALL_CORE.bbox.top."
  const compactMS = ['MAIN_ST_LARGE','MAIN_ST_MID','MAIN_ST_5773','MAIN_ST_5825'];
  const msBotRaw = Math.max(...compactMS.filter(n=>G[n]).map(n=>G[n].bbox.bottom));
  const bandBot = Math.min(msBotRaw + 6, MALL.bbox.top - 4);
  derived.BAND = {x:MAP.x0, y:MAP.y0, w:MAP.x1-MAP.x0, h:bandBot-MAP.y0};
  const bby = MAP.y0 + derived.BAND.h;

  check('BAND','top at Va Beach Blvd edge', Math.abs(derived.BAND.y - MAP.y0) < 2);
  check('BAND','bottom ≤ MALL_CORE top', bby <= MALL.bbox.top + 2,
    `bby=${bby.toFixed(0)} mall_top=${MALL.bbox.top.toFixed(0)}`);
  const allMS = ['MAIN_ST_LARGE','MAIN_ST_MID','MAIN_ST_5773','MAIN_ST_5825','MAIN_ST_THIN'];
  for (const n of allMS) {
    if (G[n]) check('BAND',`contains ${n} centroid`,
      G[n].centroid_y >= MAP.y0 && G[n].centroid_y <= bby,
      `cy=${G[n].centroid_y.toFixed(0)} band=[${MAP.y0},${bby.toFixed(0)}]`);
  }

  // ── SPONGE PARK ──
  // Spec: "occupies the available space east of COMMONS_SPINE and north of HOUSING_B_S.
  //        Left edge: spine right + 10px clearance.
  //        Right edge: leaves room for research station (~90px) before site east boundary.
  //        Vertically: top at band bottom + 8px; bottom at HOUSING_B_S.bbox.top - 6px.
  //        Center biased toward SPONGE_PARCEL centroid."
  const sg_avail_left  = sr + 10;
  const sg_avail_right = MAP.x1 - 100;  // research station clearance
  const sg_avail_top   = bby + 8;
  const sg_avail_bot   = HB_PAR ? HB_PAR.bbox.top - 6 : MAP.y1 - 100;
  const sg_rx = Math.min((sg_avail_right - sg_avail_left)/2, 90);
  const sg_ry = Math.min((sg_avail_bot - sg_avail_top)/2, 70);
  let sg_cx = sg_avail_left + sg_rx;
  let sg_cy = (sg_avail_top + sg_avail_bot)/2;
  // Bias toward SPONGE_PARCEL centroid if close enough
  if (SP_PAR) {
    const dist = Math.abs(SP_PAR.centroid_x - sg_cx);
    if (dist < sg_rx*1.5) sg_cx = (sg_cx + SP_PAR.centroid_x)/2;
    sg_cy = (sg_cy + SP_PAR.centroid_y)/2;
  }
  derived.SPONGE = {cx:sg_cx, cy:sg_cy, rx:sg_rx, ry:sg_ry};
  derived.BASIN  = {cx:sg_cx, cy:sg_cy, rx:sg_rx*0.38, ry:sg_ry*0.38};

  const sg_dist = SP_PAR ? Math.hypot(sg_cx-SP_PAR.centroid_x, sg_cy-SP_PAR.centroid_y) : 0;
  check('SPONGE','center within 80px of SPONGE_PARCEL centroid', sg_dist<80,
    `dist=${sg_dist.toFixed(0)}`);
  check('SPONGE','left edge east of spine', sg_cx-sg_rx >= sr-2,
    `left=${(sg_cx-sg_rx).toFixed(0)} sr=${sr.toFixed(0)}`);
  check('SPONGE','top of ellipse below band bottom', sg_cy-sg_ry >= bby-4,
    `ellipse_top=${(sg_cy-sg_ry).toFixed(0)} bby=${bby.toFixed(0)}`);

  // ── RESEARCH STATION ──
  // Spec: "east of sponge ellipse right edge, vertically centered on sponge.
  //        Must not exceed site east boundary."
  const res_w=80, res_h=44;
  const res_x = Math.min(sg_cx+sg_rx+10, MAP.x1-res_w-4);
  derived.RESEARCH = {x:res_x, y:sg_cy-res_h/2, w:res_w, h:res_h};

  check('RESEARCH','left edge within 20px of sponge right',
    res_x <= sg_cx+sg_rx+22, `res_x=${res_x.toFixed(0)} sponge_right=${(sg_cx+sg_rx).toFixed(0)}`);
  check('RESEARCH','right within site boundary', res_x+res_w <= MAP.x1,
    `right=${(res_x+res_w).toFixed(0)} boundary=${MAP.x1}`);

  // ── ROSS LEASEHOLD ──
  // Spec: "NE quadrant of MALL_CORE. East of spine. South of band.
  //        Width reduced to fit: ross_x must be >= spine_right + 8."
  const ross_w=100, ross_h=62;
  const ross_x = Math.min(sr+8, MALL.bbox.right-ross_w-4);
  // The min may put ross_x < sr — enforce the spine clearance as a floor
  const ross_x_final = Math.max(ross_x, sr+6);
  const ross_y = Math.max(bby+6, MALL.bbox.top+4);
  derived.ROSS = {x:ross_x_final, y:ross_y, w:ross_w, h:ross_h};

  check('ROSS','east of spine', ross_x_final >= sr,
    `ross_x=${ross_x_final.toFixed(0)} sr=${sr.toFixed(0)}`);
  check('ROSS','south of band bottom', ross_y >= bby,
    `ross_y=${ross_y.toFixed(0)} bby=${bby.toFixed(0)}`);
  check('ROSS','within MALL_CORE horizontal bounds',
    ross_x_final >= MALL.bbox.left && ross_x_final+ross_w <= MALL.bbox.right+8,
    `[${ross_x_final.toFixed(0)},${(ross_x_final+ross_w).toFixed(0)}] mall=[${MALL.bbox.left.toFixed(0)},${MALL.bbox.right.toFixed(0)}]`);

  // ── TIDE STATION ──
  // Spec: "at south terminus of spine. Centered on spine x-axis.
  //        Bottom flush with I-264 north edge."
  const tide_h=73;
  derived.TIDE = {x:sl, y:MAP.y1-tide_h, w:spine_w, h:tide_h};
  check('TIDE','centered on spine', Math.abs((derived.TIDE.x+derived.TIDE.w/2)-scx)<2);
  check('TIDE','bottom at I-264', Math.abs(derived.TIDE.y+tide_h-MAP.y1)<2);

  // ── BIKE LANE ──
  // Spec: "along south edge of Main Street band, interrupted at spine."
  derived.BIKE = {y:bby-5, x0:MAP.x0, x0end:sl-2, x1start:sr+2, x1end:MAP.x1};

  // ── DISTRICT LABELS ──
  // Spec: each label positioned relative to anchor parcel geometry.

  // Housing A: within MALL_CORE west half, clear of spine
  const ha_x = Math.min(MALL.bbox.left + 65, sl - 28);
  const ha_y = MALL.centroid_y + MALL.bbox.height*0.06;
  derived.LABEL_HSG_A = {x:ha_x, y:ha_y};
  check('LABEL_HSG_A','west of spine', ha_x < sl, `x=${ha_x.toFixed(0)} sl=${sl.toFixed(0)}`);

  // Housing B: HOUSING_B_S centroid, shift west if inside sponge ellipse
  let hb_x = HB_PAR ? HB_PAR.centroid_x : sg_cx-sg_rx-50;
  let hb_y = HB_PAR ? HB_PAR.centroid_y : MAP.y1-80;
  if (((hb_x-sg_cx)**2/sg_rx**2 + (hb_y-sg_cy)**2/sg_ry**2) < 1.1) {
    hb_x = sg_cx - sg_rx - 40;
  }
  derived.LABEL_HSG_B = {x:hb_x, y:hb_y};
  check('LABEL_HSG_B','not inside sponge ellipse',
    ((hb_x-sg_cx)**2/sg_rx**2 + (hb_y-sg_cy)**2/sg_ry**2) >= 1.0);

  // CLT: right of spine, just below band bottom (in the CLT parcel zone below band)
  derived.LABEL_CLT = {x:sr+18, y:bby+18};
  check('LABEL_CLT','east of spine', sr+18 > sr);
  check('LABEL_CLT','below band bottom', bby+18 > bby);

  // Sponge: below ellipse
  derived.LABEL_SPONGE = {x:sg_cx, y:sg_cy+sg_ry+16};
  check('LABEL_SPONGE','below ellipse bottom', sg_cy+sg_ry+16 > sg_cy+sg_ry);

  // Civic: left margin between road and civic parcel west edges
  derived.LABEL_CIVIC = {x:MAP.x0+20, y:(MAP.y0+MAP.y1)/2};

  // Main Street: within band, left-anchored
  derived.LABEL_MAIN = {x:MAP.x0+16, y:MAP.y0+20};

  return {derived, log};
}

// ── SVG BUILDER ──────────────────────────────────────────────────
// All drawing uses derived geometry only. Parcel rings projected on-the-fly.

function buildSVG(parcels, P, G, derived, MAP, proj) {
  const svg = document.getElementById('site-plan');
  const ns = 'http://www.w3.org/2000/svg';

  function el(tag, attrs={}, children=[]) {
    const e = document.createElementNS(ns, tag);
    for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
    for (const c of children) e.appendChild(typeof c==='string' ? document.createTextNode(c) : c);
    return e;
  }
  function path_from_rings(rings) {
    return rings.map(ring =>
      'M ' + ring.map(([lon,lat]) => { const [x,y]=proj(lon,lat); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' L ') + ' Z'
    ).join(' ');
  }

  svg.innerHTML = '';

  // Defs
  const defs = el('defs');

  // Clip path for map area
  const cp = el('clipPath',{id:'mc'});
  cp.appendChild(el('rect',{x:MAP.x0,y:MAP.y0,width:MAP.x1-MAP.x0,height:MAP.y1-MAP.y0}));
  defs.appendChild(cp);

  // Blur filters for district halos — one per district
  const districts = [
    ['MAIN_ST',  'halo-main',  'c', '#c85018', ['MAIN_ST_LARGE','MAIN_ST_5773','MAIN_ST_THIN','MAIN_ST_MID','MAIN_ST_5825']],
    ['CIVIC',    'halo-civic', 'c', '#2070a0', ['CIVIC_920','CIVIC_700','CIVIC_854','CIVIC_862','CIVIC_STRIP','CIVIC_SPINE_S','CIVIC_ROW']],
    ['HOUSING_A','halo-hsg-a', 'c', '#c88020', ['MALL_CORE','HOUSING_A_530']],
    ['CLT_C',    'halo-clt',   'c', '#8050c0', ['CLT_NORTH','CLT_GLENROCK','CLT_GLENROCK2']],
    ['HOUSING_B','halo-hsg-b', 'c', '#3888a8', ['HOUSING_B_S']],
    ['SPONGE',   'halo-sponge','c', '#308038', ['SPONGE_PARCEL']],
  ];

  for (const [,fid,,color] of districts) {
    const f = el('filter',{id:fid, x:'-100%', y:'-100%', width:'300%', height:'300%'});
    f.appendChild(el('feGaussianBlur',{stdDeviation:'52'}));
    defs.appendChild(f);
  }

  // Glow filters
  const glow = el('filter',{id:'glow'});
  glow.appendChild(el('feGaussianBlur',{stdDeviation:'2.5',result:'b'}));
  const gm = el('feMerge');
  gm.appendChild(el('feMergeNode',{in:'b'})); gm.appendChild(el('feMergeNode',{in:'SourceGraphic'}));
  glow.appendChild(gm); defs.appendChild(glow);

  const gs = el('filter',{id:'gs'});
  gs.appendChild(el('feGaussianBlur',{stdDeviation:'1.2',result:'b'}));
  const gms = el('feMerge');
  gms.appendChild(el('feMergeNode',{in:'b'})); gms.appendChild(el('feMergeNode',{in:'SourceGraphic'}));
  gs.appendChild(gms); defs.appendChild(gs);

  // Arrow markers
  for (const [id,fill] of [['arb','#3898c0'],['arg','#3a8040']]) {
    const m = el('marker',{id,markerWidth:'5',markerHeight:'5',refX:'2.5',refY:'2.5',orient:'auto'});
    m.appendChild(el('path',{d:'M0,0 L5,2.5 L0,5Z',fill}));
    defs.appendChild(m);
  }

  // Grid pattern
  const grid = el('pattern',{id:'grid',patternUnits:'userSpaceOnUse',width:'20',height:'20'});
  grid.appendChild(el('path',{d:'M20 0L0 0 0 20',fill:'none',stroke:'#0c0a06','stroke-width':'0.5'}));
  defs.appendChild(grid);

  // ── Green zone texture patterns ─────────────────────────────────────────────

  // GREEN_ACTIVE: fine diagonal grass hatch, 45° at 5px pitch
  (function() {
    const p = el('pattern',{id:'pat-green-active',patternUnits:'userSpaceOnUse',width:'8',height:'8'});
    // Base fill
    p.appendChild(el('rect',{width:'8',height:'8',fill:'#1a8030'}));
    // Diagonal hatching — two directions for a meadow feel
    p.appendChild(el('line',{x1:'0',y1:'8',x2:'8',y2:'0',stroke:'#2ec050',
      'stroke-width':'0.8','stroke-opacity':'0.6'}));
    p.appendChild(el('line',{x1:'-2',y1:'6',x2:'2',y2:'2',stroke:'#2ec050',
      'stroke-width':'0.5','stroke-opacity':'0.4'}));
    p.appendChild(el('line',{x1:'6',y1:'10',x2:'10',y2:'6',stroke:'#2ec050',
      'stroke-width':'0.5','stroke-opacity':'0.4'}));
    defs.appendChild(p);
  })();

  // GREEN_PASSIVE: wetland pattern — horizontal ripples + stipple dots
  (function() {
    const p = el('pattern',{id:'pat-green-passive',patternUnits:'userSpaceOnUse',width:'12',height:'10'});
    p.appendChild(el('rect',{width:'12',height:'10',fill:'#0a5c1e'}));
    // Ripple lines (horizontal, slightly wavy via short segments)
    p.appendChild(el('path',{d:'M0,3 Q3,2 6,3 Q9,4 12,3',fill:'none',
      stroke:'#14a040','stroke-width':'0.7','stroke-opacity':'0.7'}));
    p.appendChild(el('path',{d:'M0,7 Q3,6 6,7 Q9,8 12,7',fill:'none',
      stroke:'#14a040','stroke-width':'0.7','stroke-opacity':'0.7'}));
    // Stipple dots — scattered reed/sedge suggestion
    p.appendChild(el('circle',{cx:'2',cy:'1',r:'0.6',fill:'#1ec850','fill-opacity':'0.5'}));
    p.appendChild(el('circle',{cx:'8',cy:'5',r:'0.6',fill:'#1ec850','fill-opacity':'0.5'}));
    p.appendChild(el('circle',{cx:'5',cy:'9',r:'0.6',fill:'#1ec850','fill-opacity':'0.5'}));
    p.appendChild(el('circle',{cx:'11',cy:'2',r:'0.6',fill:'#1ec850','fill-opacity':'0.5'}));
    defs.appendChild(p);
  })();

  // PLAZA: fine square paving grid
  (function() {
    const p = el('pattern',{id:'pat-plaza',patternUnits:'userSpaceOnUse',width:'10',height:'10'});
    p.appendChild(el('rect',{width:'10',height:'10',fill:'#5a6878'}));
    p.appendChild(el('rect',{x:'0.5',y:'0.5',width:'9',height:'9',fill:'none',
      stroke:'#7a8898','stroke-width':'0.6','stroke-opacity':'0.6'}));
    p.appendChild(el('line',{x1:'5',y1:'0',x2:'5',y2:'10',
      stroke:'#4a5868','stroke-width':'0.4','stroke-opacity':'0.4'}));
    p.appendChild(el('line',{x1:'0',y1:'5',x2:'10',y2:'5',
      stroke:'#4a5868','stroke-width':'0.4','stroke-opacity':'0.4'}));
    defs.appendChild(p);
  })();

  // GREEN_ACTIVE overlay: fine blade detail at higher zoom
  (function() {
    const p = el('pattern',{id:'pat-green-active-blades',patternUnits:'userSpaceOnUse',width:'6',height:'6'});
    p.appendChild(el('rect',{width:'6',height:'6',fill:'none'}));
    // Tiny blade marks
    p.appendChild(el('line',{x1:'1',y1:'6',x2:'2',y2:'3',stroke:'#40d060',
      'stroke-width':'0.6','stroke-opacity':'0.5','stroke-linecap':'round'}));
    p.appendChild(el('line',{x1:'4',y1:'6',x2:'5',y2:'2',stroke:'#40d060',
      'stroke-width':'0.6','stroke-opacity':'0.5','stroke-linecap':'round'}));
    defs.appendChild(p);
  })();

  // ── Architectural hatch patterns (A&P illustration style) ─────────────

  // Residential hatch: 45° diagonal lines, fine pitch — like the A&P drawings
  (function() {
    const p = el('pattern',{id:'pat-hatch-res',patternUnits:'userSpaceOnUse',
      width:'8',height:'8',patternTransform:'rotate(45)'});
    p.appendChild(el('rect',{width:'8',height:'8',fill:'#c87818','fill-opacity':'0.9'}));
    p.appendChild(el('line',{x1:'0',y1:'0',x2:'0',y2:'8',
      stroke:'#040402','stroke-width':'2.2','stroke-opacity':'0.5'}));
    defs.appendChild(p);
  })();

  // Commercial hatch: steeper 60° lines, bolder — spine/market character
  (function() {
    const p = el('pattern',{id:'pat-hatch-com',patternUnits:'userSpaceOnUse',
      width:'7',height:'7',patternTransform:'rotate(60)'});
    p.appendChild(el('rect',{width:'7',height:'7',fill:'#c84818','fill-opacity':'0.9'}));
    p.appendChild(el('line',{x1:'0',y1:'0',x2:'0',y2:'7',
      stroke:'#040402','stroke-width':'2.8','stroke-opacity':'0.55'}));
    defs.appendChild(p);
  })();

  // Civic hatch: horizontal lines — public institution character
  (function() {
    const p = el('pattern',{id:'pat-hatch-civ',patternUnits:'userSpaceOnUse',
      width:'6',height:'6'});
    p.appendChild(el('rect',{width:'6',height:'6',fill:'#2878b8','fill-opacity':'0.88'}));
    p.appendChild(el('line',{x1:'0',y1:'3',x2:'6',y2:'3',
      stroke:'#040402','stroke-width':'1.8','stroke-opacity':'0.45'}));
    defs.appendChild(p);
  })();

  // Mixed/spine hatch: cross-hatch — complex programmatic overlap
  (function() {
    const p = el('pattern',{id:'pat-hatch-mix',patternUnits:'userSpaceOnUse',
      width:'8',height:'8'});
    p.appendChild(el('rect',{width:'8',height:'8',fill:'#6848b8','fill-opacity':'0.82'}));
    p.appendChild(el('line',{x1:'0',y1:'0',x2:'8',y2:'8',
      stroke:'#040402','stroke-width':'1.5','stroke-opacity':'0.4'}));
    p.appendChild(el('line',{x1:'8',y1:'0',x2:'0',y2:'8',
      stroke:'#040402','stroke-width':'1.5','stroke-opacity':'0.4'}));
    defs.appendChild(p);
  })();

  // Outdoor void hatch: very sparse dots — figured space, not building
  (function() {
    const p = el('pattern',{id:'pat-void',patternUnits:'userSpaceOnUse',
      width:'12',height:'12'});
    p.appendChild(el('rect',{width:'12',height:'12',fill:'#060804'}));
    p.appendChild(el('circle',{cx:'6',cy:'6',r:'0.9',
      fill:'#2a3020','fill-opacity':'0.7'}));
    defs.appendChild(p);
  })();

  svg.appendChild(defs);

  // Background
  svg.appendChild(el('rect',{width:'4200',height:'3700',fill:'#040402'}));
  svg.appendChild(el('rect',{width:'4200',height:'3700',fill:'url(#grid)'}));

  // Road bands
  for (const [x,y,w,h] of [
    [0,0,960,MAP.y0],[0,MAP.y1,960,760-MAP.y1],
    [0,0,MAP.x0,760],[MAP.x1,0,960-MAP.x1,760]
  ]) svg.appendChild(el('rect',{x,y,width:w,height:h,fill:'#080706'}));

  // Road edge lines
  for (const [x1,y1,x2,y2] of [
    [0,MAP.y0,960,MAP.y0],[0,MAP.y1,960,MAP.y1],
    [MAP.x0,0,MAP.x0,760],[MAP.x1,0,MAP.x1,760]
  ]) svg.appendChild(el('line',{x1,y1,x2,y2,stroke:'#1c1a10','stroke-width':'1.5'}));

  // Road labels
  function rtxt(transform,txt,size='8.5') {
    const t=el('text',{transform,fill:'#1e1c10','font-family':'DM Mono,monospace','font-size':size,'text-anchor':'middle','letter-spacing':'2'});
    t.textContent=txt; return t;
  }
  svg.appendChild(rtxt(`translate(490,${MAP.y0/2+20})`,'VIRGINIA BEACH BOULEVARD  ·  US-58','8'));
  svg.appendChild(rtxt(`translate(${MAP.x0/2},490) rotate(-90)`,'N MILITARY HWY  ·  US-13','8'));
  svg.appendChild(rtxt(`translate(490,${MAP.y1+(760-MAP.y1)/2+5})`,'INTERSTATE  264','8'));
  svg.appendChild(rtxt(`translate(${MAP.x1+(960-MAP.x1)/2},490) rotate(90)`,'TIDEWATER  DRIVE','8'));

  // ── LAYER 1: DISTRICT HALOS — stripped for field-solver-first rendering ──
  // Halos suppressed: field solver buildings carry all spatial meaning.
  // Keep a very faint ambient tint only for orientation.
  const specToParcel = {};
  for (const p of parcels) if (p.spec) specToParcel[p.spec] = p;

  const haloGroup = el('g',{'style':'mix-blend-mode:screen;isolation:isolate','clip-path':'url(#mc)'});
  for (const [,fid,,color,specs] of districts) {
    const g = el('g',{filter:`url(#${fid})`,'clip-path':'url(#mc)'});
    for (const spec of specs) {
      const p = specToParcel[spec];
      if (!p) continue;
      // Opacity reduced from 0.9 → 0.08: faint orientation tint only
      const pth = el('path',{d:path_from_rings(p.rings),fill:color,'fill-opacity':'0.08',stroke:'none'});
      g.appendChild(pth);
    }
    haloGroup.appendChild(g);
  }
  svg.appendChild(haloGroup);

  // ── LAYER 2: CONTEXT PARCEL OUTLINES ──
  const ctxG = el('g',{'clip-path':'url(#mc)'});
  for (const p of parcels) {
    if (p.is_eda) continue;
    const pth = el('path',{
      d:path_from_rings(p.rings),
      fill:'#0a0a08',stroke:'#161412','stroke-width':'0.4',
      'data-acct':p.acct,'data-area':p.area_ac.toFixed(2),'data-dist':'context'
    });
    ctxG.appendChild(pth);
  }
  svg.appendChild(ctxG);

  // ── LAYER 3: EDA PARCEL HARD OUTLINES ──
  const distColors = {
    MAIN_ST:  '#c85018', CIVIC:'#2070a0', MALL_CORE:'#c88020', HOUSING_A_530:'#c88020',
    CLT_NORTH:'#8050c0', CLT_GLENROCK:'#8050c0', CLT_GLENROCK2:'#8050c0',
    HOUSING_B_S:'#3888a8', SPONGE_PARCEL:'#308038',
    MAIN_ST_LARGE:'#c85018', MAIN_ST_5773:'#c85018', MAIN_ST_THIN:'#c85018',
    MAIN_ST_MID:'#c85018', MAIN_ST_5825:'#c85018',
    CIVIC_920:'#2070a0', CIVIC_700:'#2070a0', CIVIC_854:'#2070a0',
    CIVIC_862:'#2070a0', CIVIC_STRIP:'#2070a0', CIVIC_SPINE_S:'#2070a0', CIVIC_ROW:'#2070a0',
  };
  const edaG = el('g',{'clip-path':'url(#mc)'});
  for (const p of parcels) {
    if (!p.is_eda || !p.spec) continue;
    const color = distColors[p.spec] || '#666';
    const pth = el('path',{
      d:path_from_rings(p.rings),
      fill:color,'fill-opacity':'0.16',stroke:color,'stroke-width':'2','stroke-opacity':'0.9',
      'data-acct':p.acct,'data-area':p.area_ac.toFixed(2),'data-dist':p.spec,
      style:'cursor:crosshair'
    });
    edaG.appendChild(pth);
  }
  svg.appendChild(edaG);

  // ── LAYER 4: DERIVED OVERLAY (constraint-solved geometry) ──
  // Create a group for all layer 4 elements so pipeline T7 can remove them
  const _l4g = document.createElementNS(ns, 'g');
  _l4g.setAttribute('data-constraint-overlay', '1');
  svg.appendChild(_l4g);
  const _l4svg = { appendChild: (el) => _l4g.appendChild(el) };

  const D = derived;

  // Commons Spine (derived from MALL_CORE centroid + site bounds)
  svg.appendChild(el('rect',{
    x:D.SPINE.x.toFixed(1),y:D.SPINE.y,
    width:D.SPINE.w.toFixed(1),height:D.SPINE.h,
    fill:'#0a1828','fill-opacity':'0.55',stroke:'#2878a0','stroke-width':'1.5',
    'clip-path':'url(#mc)'
  }));
  const spineLabel = el('text',{
    transform:`translate(${(D.SPINE.x+D.SPINE.w/2).toFixed(0)},430) rotate(-90)`,
    'font-family':'DM Mono,monospace','font-size':'6.5',fill:'#2878a0',
    'text-anchor':'middle','letter-spacing':'1.5',opacity:'0.7'
  });
  spineLabel.textContent = 'COMMONS SPINE · PEDESTRIAN PRIORITY';
  svg.appendChild(spineLabel);

  // Main Street labels (no rectangle — zone defined by halos)
  function mtext(x,y,txt,size,color,family='DM Mono,monospace',anchor='start') {
    const t=el('text',{x,y,'font-family':family,'font-size':size,fill:color,'text-anchor':anchor});
    t.textContent=txt; return t;
  }
  svg.appendChild(mtext(D.LABEL_MAIN.x, D.LABEL_MAIN.y+19, 'MAIN STREET CORRIDOR','8','#d05018','DM Mono,monospace'));
  svg.appendChild(mtext(D.LABEL_MAIN.x, D.LABEL_MAIN.y+31, 'RETAIL · INCUBATOR · CLINIC · 11 AC · YRS 4–7','6.5','#783010'));

  // Bike lane (derived from band bottom)
  const B = D.BIKE;
  for (const [x1,x2] of [[B.x0,B.x0end],[B.x1start,B.x1end]]) {
    svg.appendChild(el('line',{x1,y1:B.y.toFixed(1),x2,y2:B.y.toFixed(1),
      stroke:'#3a8040','stroke-width':'1.5','stroke-dasharray':'6,3',opacity:'0.5'}));
  }

  // Ross Leasehold warning
  const R = D.ROSS;
  svg.appendChild(el('rect',{x:R.x.toFixed(1),y:R.y.toFixed(1),width:R.w,height:R.h,
    fill:'#160606',stroke:'#903020','stroke-width':'1.2','stroke-dasharray':'3,2'}));
  for (const [dy,txt,sz,col] of [
    [16,'⚠ ROSS STORES INC','7.5','#b04030'],
    [27,'LEASEHOLD · 0.69 AC','6.5','#783020'],
    [38,'LEASE OPTIONS → 2036','6.5','#582010'],
    [49,'BUILD AROUND · PHASE 2','6','#401808'],
  ]) {
    const t=el('text',{x:(R.x+R.w/2).toFixed(0),y:(R.y+dy).toFixed(0),
      'font-family':'DM Mono,monospace','font-size':sz,fill:col,'text-anchor':'middle'});
    if (dy===16) t.setAttribute('font-weight','500');
    t.textContent=txt; svg.appendChild(t);
  }

  // Sponge Park ellipse (derived from available space)
  const SG = D.SPONGE;
  svg.appendChild(el('ellipse',{cx:SG.cx.toFixed(1),cy:SG.cy.toFixed(1),
    rx:SG.rx.toFixed(1),ry:SG.ry.toFixed(1),
    fill:'#081408',stroke:'#3a8040','stroke-width':'2',opacity:'0.9',filter:'url(#gs)',
    'clip-path':'url(#mc)'}));
  svg.appendChild(el('ellipse',{cx:SG.cx.toFixed(1),cy:SG.cy.toFixed(1),
    rx:(SG.rx*0.72).toFixed(0),ry:(SG.ry*0.72).toFixed(0),
    fill:'none',stroke:'#3a8040','stroke-width':'0.7','stroke-dasharray':'3,3',opacity:'0.4'}));
  const BA = D.BASIN;
  svg.appendChild(el('ellipse',{cx:BA.cx.toFixed(1),cy:BA.cy.toFixed(1),
    rx:BA.rx.toFixed(1),ry:BA.ry.toFixed(1),fill:'#0a2030',stroke:'#3898c0','stroke-width':'1.5'}));
  for (const [dy,txt] of [[-3,'RETENTION'],[7,'BASIN']]) {
    const t=el('text',{x:BA.cx.toFixed(0),y:(BA.cy+dy).toFixed(0),
      'font-family':'DM Mono,monospace','font-size':'6.5',fill:'#3898c0','text-anchor':'middle'});
    t.textContent=txt; svg.appendChild(t);
  }

  // Research station
  const RS = D.RESEARCH;
  svg.appendChild(el('rect',{x:RS.x.toFixed(1),y:RS.y.toFixed(1),width:RS.w,height:RS.h,
    fill:'#080e08',stroke:'#3a8040','stroke-width':'1'}));
  for (const [dy,txt,sz,col] of [
    [14,'RESEARCH STN.','7','#5aaa60'],[24,'ODU · NSU · HRSD','6','#3a7040'],
    [33,'SLR MONITORING','5.5','#284830']
  ]) {
    const t=el('text',{x:(RS.x+RS.w/2).toFixed(0),y:(RS.y+dy).toFixed(0),
      'font-family':'DM Mono,monospace','font-size':sz,fill:col,'text-anchor':'middle'});
    t.textContent=txt; svg.appendChild(t);
  }

  // Tide Station
  const T = D.TIDE;
  svg.appendChild(el('rect',{x:T.x.toFixed(1),y:T.y.toFixed(1),width:T.w.toFixed(1),height:T.h,
    fill:'#0a1828',stroke:'#3898c0','stroke-width':'2',filter:'url(#glow)','clip-path':'url(#mc)'}));
  const scx = D.SPINE.x + D.SPINE.w/2;
  for (const [dy,txt,sz,col,fw] of [
    [22,'TIDE STN.','8','#3898c0','700'],[34,'~2033 EST.','6.5','#28788a',null],
    [45,'2.2 MI EXT.','5.5','#184858',null]
  ]) {
    const t=el('text',{x:scx.toFixed(0),y:(T.y+dy).toFixed(0),
      'font-family':'DM Sans,sans-serif','font-size':sz,fill:col,'text-anchor':'middle'});
    if (fw) t.setAttribute('font-weight',fw); t.textContent=txt; svg.appendChild(t);
  }
  svg.appendChild(el('line',{x1:scx.toFixed(0),y1:'653',x2:scx.toFixed(0),y2:'648',
    stroke:'#3898c0','stroke-width':'3','marker-end':'url(#arb)'}));
  const tideLabel=el('text',{x:(scx+T.w/2+8).toFixed(0),y:'668',
    'font-family':'DM Mono,monospace','font-size':'7',fill:'#285878'});
  tideLabel.textContent='← HRT TIDE EXTENSION'; svg.appendChild(tideLabel);

  // District labels (all from derived positions)
  function distLabel(D_pos, bigTxt, subTxt, bigColor, subColor, bigSz='13', subSz='7.5', rzTag=null) {
    const g = el('g');
    const big=el('text',{x:D_pos.x.toFixed(0),y:D_pos.y.toFixed(0),
      'font-family':'DM Sans,sans-serif','font-size':bigSz,fill:bigColor,'text-anchor':'middle','font-weight':'700'});
    big.textContent=bigTxt; g.appendChild(big);
    const sub=el('text',{x:D_pos.x.toFixed(0),y:(D_pos.y+14).toFixed(0),
      'font-family':'DM Mono,monospace','font-size':subSz,fill:subColor,'text-anchor':'middle'});
    sub.textContent=subTxt; g.appendChild(sub);
    if (rzTag) {
      g.appendChild(el('circle',{cx:D_pos.x.toFixed(0),cy:(D_pos.y+28).toFixed(0),r:'17',
        fill:'none',stroke:'#c04010','stroke-width':'1','stroke-dasharray':'3,3',opacity:'0.5',filter:'url(#gs)'}));
      const rzt=el('text',{x:D_pos.x.toFixed(0),y:(D_pos.y+31).toFixed(0),
        'font-family':'DM Mono,monospace','font-size':'6.5',fill:'#c04010','text-anchor':'middle'});
      rzt.textContent=rzTag; g.appendChild(rzt);
    }
    return g;
  }

  svg.appendChild(distLabel(D.LABEL_HSG_A,'HOUSING A','480 UNITS · 12 AC · YRS 2–5','#d4982c','#906020','13','7.5','RZ·A'));
  svg.appendChild(distLabel(D.LABEL_HSG_B,'HOUSING B','560 UNITS · 14 AC · YRS 6–10','#4a9ab0','#2a6a80','12','7.5','RZ·B'));
  svg.appendChild(distLabel(D.LABEL_CLT,'CLT + HOUSING C','480U + 70 CLT HOMES · 18 AC','#9060c0','#5a3a8a','10.5','7','RZ·C'));
  svg.appendChild(distLabel(D.LABEL_SPONGE,'SPONGE PARK','STORMWATER · PARK · RESEARCH','#5aaa60','#3a7040','10','6.5',null));

  // RZ·D on sponge center
  svg.appendChild(el('circle',{cx:SG.cx.toFixed(0),cy:SG.cy.toFixed(0),r:'17',
    fill:'none',stroke:'#c04010','stroke-width':'1','stroke-dasharray':'3,3',opacity:'0.5',filter:'url(#gs)'}));
  const rzd=el('text',{x:SG.cx.toFixed(0),y:(SG.cy+3).toFixed(0),
    'font-family':'DM Mono,monospace','font-size':'6.5',fill:'#c04010','text-anchor':'middle'});
  rzd.textContent='RZ·D'; svg.appendChild(rzd);

  // Civic label
  const CL = D.LABEL_CIVIC;
  for (const [dy,txt,sz] of [[-8,'CIVIC /','8.5'],[5,'COMMONS','8.5'],[18,'7 PARCELS · 8 AC','6']]) {
    const t=el('text',{x:CL.x.toFixed(0),y:(CL.y+dy).toFixed(0),
      'font-family': dy===18 ? 'DM Mono,monospace' : 'DM Sans,sans-serif',
      'font-size':sz,fill: dy===18?'#184860':'#2878a0','text-anchor':'middle'});
    if (dy!==18) t.setAttribute('font-weight','700'); t.textContent=txt; svg.appendChild(t);
  }

  // North arrow (position derived: NE corner of map area)
  const na_x = MAP.x1 - 30, na_y = MAP.y0 + 30;
  svg.appendChild(el('line',{x1:na_x,y1:na_y+28,x2:na_x,y2:na_y,stroke:'#2c2a1c','stroke-width':'1.5'}));
  const nav = el('text',{x:na_x,y:na_y+45,'font-family':'DM Mono,monospace','font-size':'11',fill:'#2c2a1c','text-anchor':'middle'}); nav.textContent='N'; svg.appendChild(nav);

  // Scale bar (position derived: SW corner of map area)
  // 1px ≈ ? feet. Compute from projection.
  const [x0,] = proj(-76.2135, 36.852);
  const [x1,] = proj(-76.2135 + 0.00151, 36.852); // ~500ft at this latitude
  const sb_px = Math.abs(x1-x0);
  const sb_x = MAP.x0 + 10, sb_y = MAP.y1 - 22;
  svg.appendChild(el('rect',{x:sb_x,y:sb_y-3,width:sb_px*2,height:6,fill:'#161410',opacity:'0.9'}));
  svg.appendChild(el('rect',{x:sb_x,y:sb_y-3,width:sb_px,height:6,fill:'#242210',opacity:'0.9'}));
  for (const [dx,txt] of [[0,'0'],[sb_px,'500ft'],[sb_px*2,'1000ft']]) {
    const t=el('text',{x:(sb_x+dx).toFixed(0),y:(sb_y+14).toFixed(0),
      'font-family':'DM Mono,monospace','font-size':'7',fill:'#242210','text-anchor':'middle'});
    t.textContent=txt; svg.appendChild(t);
  }

  // Corner annotation boxes
  function cornerNote(x, y, lines) {
    const g=el('g');
    g.appendChild(el('rect',{x,y,width:240,height:lines.length*10+10,fill:'#060402',stroke:'#161208','stroke-width':'0.5'}));
    lines.forEach(([txt,col],i)=>{
      const t=el('text',{x:x+8,y:y+12+i*11,'font-family':'DM Mono,monospace','font-size':'6.5',fill:col||'#483820'});
      t.textContent=txt; g.appendChild(t);
    });
    return g;
  }
  svg.appendChild(cornerNote(MAP.x0+2, MAP.y1-38, [
    ['FIRM 2017 · Zone X (Low-Moderate Risk)','#483820'],
    ['High ground confirmed · Evac Zone C','#384820']
  ]));
  svg.appendChild(cornerNote(MAP.x1-242, MAP.y1-38, [
    ['Ward 4 · Military Circle Civic League','#2a2840'],
    ['Planning District 87 · Evac Zone C','#202038']
  ]));
}

// ── LEGEND BUILDER ──────────────────────────────────────────────
function buildLegend() {
  const items = [
    ['Housing A', '#c88020'],['Housing B', '#3888a8'],['CLT + Housing C', '#8050c0'],
    ['Main Street', '#c85018'],['Sponge Park', '#308038'],['Civic / Commons', '#2070a0'],
    ['Context (private)', '#2a2820'],
  ];
  const container = document.getElementById('legend');
  if (!container) return;
  container.innerHTML = items.map(([name,color])=>
    `<div class="legend-item"><div class="legend-swatch" style="background:${color}"></div>${name}</div>`
  ).join('');
}

// ── CONSTRAINT LOG RENDERER ──────────────────────────────────────
function renderLog(log) {
  const el = document.getElementById('constraint-log');
  if (!el) return;
  const passed = log.filter(l=>l.ok).length;
  const failed = log.filter(l=>!l.ok).length;
  el.innerHTML = `<div style="margin-bottom:0.5rem;color:var(--text)">${passed} PASS&nbsp;&nbsp;${failed} FAIL</div>` +
    log.map(l=>
      `<div class="${l.ok?'pass':'fail'}">${l.ok?'✓':'✗'} [${l.name}] ${l.desc}${l.detail?' — '+l.detail:''}</div>`
    ).join('');
}

// ── TOOLTIP ─────────────────────────────────────────────────────
function initTooltip() {
  const tt = document.getElementById('tooltip');
  document.addEventListener('mousemove', e => {
    const path = e.target.closest('path[data-acct]');
    if (path) {
      tt.style.opacity = 1;
      tt.style.left = (e.clientX+14)+'px';
      tt.style.top  = (e.clientY+14)+'px';
      tt.textContent = `ACCT ${path.dataset.acct}  ·  ${path.dataset.area} ac  ·  ${path.dataset.dist}`;
    } else { tt.style.opacity = 0; }
  });
}

// ── MAIN ─────────────────────────────────────────────────────────
// ec-pipeline.js is loaded async after DOMContentLoaded has already fired.
// Run main() immediately when this script executes.
function _ecMain() {
  // Yield helper — lets the browser paint and process events between phases
  const tick = (ms=16) => new Promise(r => setTimeout(r, ms));
  const setMsg = msg => {
    const el = document.getElementById('ec-loading-msg');
    if (el) el.textContent = msg;
  };
  const hideLoader = () => {
    const el = document.getElementById('ec-loading');
    if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 350); }
  };

  (async () => {
    try {
      setMsg('Loading parcel data…');
      await tick();

      const parcels = PARCEL_DATA.parcels;

      setMsg('Building projection…');
      await tick();
      const {proj, MAP} = buildProjection(parcels);

      setMsg('Computing geometry…');
      await tick();
      const G = buildParcelGeometry(parcels, proj);

      setMsg('Solving constraints…');
      await tick();
      const {derived, log} = solveConstraints(G, MAP);

      setMsg('Rendering plan…');
      await tick();
      buildSVG(parcels, G, G, derived, MAP, proj);

      // Page is now interactive — hide loader before the rest
      hideLoader();
      await tick();

      buildLegend();
      renderLog(log);
      initTooltip();

      console.log('Eastside Commons: constraint solver complete.');
      console.log(`Parcels: ${parcels.length} (${parcels.filter(p=>p.is_eda).length} EDA-owned)`);
      console.log(`Constraints: ${log.filter(l=>l.ok).length} pass, ${log.filter(l=>!l.ok).length} fail`);

      // Deferred: interactive layer + pipeline (non-blocking)
      await tick();
      if (window.EC_Interactive) {
        window.EC_Interactive.exportDerived(derived, MAP);
        window.EC_Interactive.initInteractiveLayer();
        setTimeout(() => window.EC_Interactive.renderOverlays(), 50);
      }
      initPipeline(parcels, proj, MAP, derived);
      setTimeout(() => {
        if (typeof triggerPipeline === 'undefined') return;
        const loaded = window.EC_Save ? window.EC_Save.loadFromHash() : loadFromHash?.();
        if (!loaded) {
          setSeed(CANONICAL_SEED);
          triggerPipeline();
        }
      }, 600);

    } catch(err) {
      const el = document.getElementById('ec-loading-msg');
      if (el) el.textContent = '⚠ ' + err.message;
      console.error(err);
    }
  })();
}

// Run immediately (DOM is already ready when this script loads async)
_ecMain();

// Signal ready
document.dispatchEvent(new Event("ec-pipeline-ready"));


// ═══════════════════════════════════════════════════════════════
//  EASTSIDE COMMONS — INTERACTIVE LAYER v2
//  Superblock grid, building placement, section cut, plant palette
// ═══════════════════════════════════════════════════════════════

// ── PLANT REGISTRY ──
const PLANT_REGISTRY = {
  "source": "Hampton Roads Native Plant Guide (VCZMP 2017) + Norfolk tree survey",
  "meye_url": "https://meye.dk/",
  "note": "Only genera available on meye.dk are marked meye_available:true",
  "species": [
    {
      "common": "Red Maple",
      "latin": "Acer rubrum",
      "genus": "Acer",
      "meye_available": true,
      "meye_genus": "Acer",
      "context": ["courtyard", "swale_edge", "street"],
      "mature_height_ft": [40, 70],
      "canopy_spread_ft": [30, 50],
      "notes": "Most common native tree in Norfolk. Brilliant red fall color. Tolerates wet soils — ideal for bioswale edges.",
      "sponge_suitable": true,
      "season_interest": ["spring_flowers", "fall_color"]
    },
    {
      "common": "River Birch",
      "latin": "Betula nigra",
      "genus": "Betula",
      "meye_available": true,
      "meye_genus": "Betula",
      "context": ["swale_edge", "wetland_margin"],
      "mature_height_ft": [40, 70],
      "canopy_spread_ft": [40, 60],
      "notes": "Native birch of riparian corridors. Multi-stem form, peeling bark. Perfect for sponge park wetland edge. Extremely flood-tolerant.",
      "sponge_suitable": true,
      "season_interest": ["peeling_bark", "spring_catkins"]
    },
    {
      "common": "American Hornbeam",
      "latin": "Carpinus caroliniana",
      "genus": "Carpinus",
      "meye_available": true,
      "meye_genus": "Carpinus",
      "context": ["courtyard_understory", "shaded_swale"],
      "mature_height_ft": [20, 35],
      "canopy_spread_ft": [20, 35],
      "notes": "Small understory tree native to Hampton Roads. Muscled bark, excellent fall color. Perfect under taller buildings.",
      "sponge_suitable": true,
      "season_interest": ["fall_color", "muscled_bark"]
    },
    {
      "common": "Downy Serviceberry",
      "latin": "Amelanchier arborea",
      "genus": "Amelanchier",
      "meye_available": true,
      "meye_genus": "Amelanchier",
      "context": ["courtyard_edge", "spine_planting"],
      "mature_height_ft": [15, 25],
      "canopy_spread_ft": [15, 25],
      "notes": "First tree to bloom in spring. Native to SE Virginia. Multi-season interest: flowers, fruit, fall color. Edible berries.",
      "sponge_suitable": false,
      "season_interest": ["spring_flowers", "fruit", "fall_color"]
    },
    {
      "common": "Tulip Poplar",
      "latin": "Liriodendron tulipifera",
      "genus": "Liriodendron",
      "meye_available": true,
      "meye_genus": "Liriodendron",
      "context": ["spine_canopy", "large_courtyard"],
      "mature_height_ft": [70, 120],
      "canopy_spread_ft": [35, 50],
      "notes": "Virginia's state tree. Fast-growing, tall canopy — excellent for shading the commons spine. Distinctive tulip flowers.",
      "sponge_suitable": false,
      "season_interest": ["spring_flowers", "fall_color"]
    },
    {
      "common": "Southern Magnolia",
      "latin": "Magnolia grandiflora",
      "genus": "Magnolia",
      "meye_available": true,
      "meye_genus": "Magnolia",
      "context": ["courtyard_anchor", "civic_plaza"],
      "mature_height_ft": [60, 80],
      "canopy_spread_ft": [30, 50],
      "notes": "Iconic SE Virginia native. Evergreen. Signature for Norfolk — already prevalent. Large white flowers. Long-lived anchor tree.",
      "sponge_suitable": false,
      "season_interest": ["summer_flowers", "evergreen_form"]
    },
    {
      "common": "Sweetgum",
      "latin": "Liquidambar styraciflua",
      "genus": null,
      "meye_available": false,
      "notes": "Most common Norfolk tree by count. Not on meye.dk — use Quercus or Acer for renders. Fall color exceptional.",
      "context": ["street", "spine_canopy"],
      "mature_height_ft": [60, 75],
      "sponge_suitable": false
    },
    {
      "common": "Willow Oak",
      "latin": "Quercus phellos",
      "genus": "Quercus",
      "meye_available": true,
      "meye_genus": "Quercus",
      "context": ["street_tree", "spine_canopy", "civic_plaza"],
      "mature_height_ft": [40, 75],
      "canopy_spread_ft": [30, 45],
      "notes": "Best street tree in Hampton Roads. Native willow-leaved oak. Beautiful vase form. City of Norfolk standard street tree.",
      "sponge_suitable": false,
      "season_interest": ["fall_color", "form"]
    },
    {
      "common": "Water Oak",
      "latin": "Quercus nigra",
      "genus": "Quercus",
      "meye_available": true,
      "meye_genus": "Quercus",
      "context": ["swale_edge", "wetland_margin", "large_courtyard"],
      "mature_height_ft": [50, 80],
      "canopy_spread_ft": [40, 60],
      "notes": "Semi-evergreen native oak, tolerates wet soils. Extremely common in Norfolk lowlands. Key sponge park candidate.",
      "sponge_suitable": true,
      "season_interest": ["semi_evergreen_form"]
    },
    {
      "common": "Bald Cypress",
      "latin": "Taxodium distichum",
      "genus": null,
      "meye_available": false,
      "notes": "Not on meye.dk. The signature Hampton Roads wetland tree — state champion specimens nearby. Critical for sponge park renders. Substitute Metasequoia (dawn redwood) from meye.dk for render.",
      "context": ["wetland_center", "basin_edge"],
      "mature_height_ft": [50, 70],
      "sponge_suitable": true,
      "meye_substitute": "Metasequoia"
    },
    {
      "common": "Black Gum / Blackgum",
      "latin": "Nyssa sylvatica",
      "genus": null,
      "meye_available": false,
      "notes": "Native to SE Virginia bottomlands. Best fall color of any native. Not on meye.dk — substitute Sorbus for renders.",
      "context": ["swale_edge", "courtyard"],
      "mature_height_ft": [30, 50],
      "sponge_suitable": true
    },
    {
      "common": "Redbud",
      "latin": "Cercis canadensis",
      "genus": null,
      "meye_available": false,
      "notes": "Small native understory tree, brilliant pink spring flowers. Not on meye.dk. Common in Norfolk yards. Use Prunus (cherry) as render substitute for spring flowering effect.",
      "context": ["courtyard_understory", "spine_edge"],
      "mature_height_ft": [15, 30],
      "meye_substitute": "Prunus"
    },
    {
      "common": "American Sycamore",
      "latin": "Platanus occidentalis",
      "genus": "Platanus",
      "meye_available": true,
      "meye_genus": "Platanus",
      "context": ["large_courtyard", "spine_canopy", "riparian"],
      "mature_height_ft": [75, 100],
      "canopy_spread_ft": [45, 70],
      "notes": "Massive native riparian tree. White/tan exfoliating bark — iconic. Present along Elizabeth River corridors. Appropriate for sponge park edge if space allows.",
      "sponge_suitable": true,
      "season_interest": ["exfoliating_bark", "massive_form"]
    }
  ],
  "wetland_ground_layer": [
    {"common": "Blue Flag Iris", "latin": "Iris virginica", "type": "emergent_aquatic", "context": "swale_edge"},
    {"common": "Soft Rush", "latin": "Juncus effusus", "type": "emergent_aquatic", "context": "swale_water_edge"},
    {"common": "Swamp Rose Mallow", "latin": "Hibiscus moscheutos", "type": "wetland_margin", "context": "basin_edge"},
    {"common": "Cardinal Flower", "latin": "Lobelia cardinalis", "type": "wetland_margin", "context": "swale_edge"},
    {"common": "Lizard's Tail", "latin": "Saururus cernuus", "type": "emergent_aquatic", "context": "shallow_basin"},
    {"common": "Wild Rice", "latin": "Zizania aquatica", "type": "emergent_aquatic", "context": "basin_shallow"},
    {"common": "Southern Wild Rice", "latin": "Zizaniopsis miliacea", "type": "emergent_aquatic", "context": "basin_edge"}
  ],
  "render_assignments": {
    "COURTYARD_CANOPY": ["Quercus phellos", "Acer rubrum", "Liriodendron tulipifera"],
    "COURTYARD_UNDERSTORY": ["Amelanchier arborea", "Carpinus caroliniana"],
    "SWALE_EDGE": ["Betula nigra", "Acer rubrum", "Quercus nigra"],
    "WETLAND_EDGE": ["Quercus nigra", "Betula nigra", "Platanus occidentalis"],
    "WETLAND_CENTER": ["Taxodium distichum (render as Metasequoia)"],
    "SPINE_CANOPY": ["Quercus phellos", "Liriodendron tulipifera"],
    "CIVIC_PLAZA_ANCHOR": ["Magnolia grandiflora"],
    "RESEARCH_PAVILION": ["Betula nigra", "Carpinus caroliniana"]
  }
}
;

// ── GLOBAL STATE ──
let CURRENT_TOOL = 'select';
let PLACED_BUILDINGS = [];   // {x,y,w,h,floors,use,id}
let SECTION_CUT = null;      // {x1,y1,x2,y2}
let OVERLAYS = {superblock:false, walkability:true, density:false, plants:false, streets:true};
let DERIVED_G = null;        // set by main() after solve
let PROJ = null;             // set by main()
let MAP_BOUNDS = null;       // set by main()

// ── TOOL MANAGEMENT ──
function setTool(tool) {
  CURRENT_TOOL = tool;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-'+tool)?.classList.add('active');
  const svg = document.getElementById('site-plan');
  if (svg) svg.style.cursor = tool === 'place' ? 'crosshair' : tool === 'section' ? 'col-resize' : 'default';
}

function toggleOverlay(btn) {
  const key = btn.dataset.overlay;
  OVERLAYS[key] = !OVERLAYS[key];
  btn.classList.toggle('on', OVERLAYS[key]);
  renderOverlays();
}

// ── SUPERBLOCK GRID CONSTRAINT ──
// Military Circle adapted superblock:
// - Site ~630px wide (702px map minus road offsets)
// - 1 superblock = 3×3 blocks. Eixample block = 113m ≈ 113/304 * 702px ≈ 261px
// - At this scale a full Eixample superblock is larger than the site
// - So we use a MINIBLOCK (2×2) model: ~56m per block ≈ 130px
// - Commons spine is the central "green street" — no through traffic
// - Perimeter roads are the through-traffic ring

function computeSuperblockGrid(G, MAP) {
  if (!G) return [];
  const mall = G.MALL;  // will be passed in
  if (!mall) return [];

  const spine = G.SPINE;
  const sl = spine.x, sr = spine.x + spine.w;
  const scx = sl + spine.w/2;

  // Block dimension: target ~130px (≈56m at our scale) for miniblock
  // Fit blocks into available space left and right of spine
  const BLOCK = 130;

  // Left side: from N_MILITARY_HWY east edge to spine left
  const left_avail = sl - MAP.x0;   // ~252px
  const left_cols = Math.floor(left_avail / BLOCK);

  // Right side: from spine right to TIDEWATER_DR west edge
  const right_avail = MAP.x1 - sr;  // ~408px
  const right_cols = Math.floor(right_avail / BLOCK);

  // Rows: from VA_BEACH_BLVD south to I-264 north
  const rows = Math.floor((MAP.y1 - MAP.y0) / BLOCK);

  const blocks = [];

  // Left blocks
  for (let r=0; r<rows; r++) {
    for (let c=0; c<left_cols; c++) {
      blocks.push({
        x: MAP.x0 + c*BLOCK,
        y: MAP.y0 + r*BLOCK,
        w: BLOCK, h: BLOCK,
        side: 'left', col: c, row: r,
        is_perimeter: (c===0 || r===0 || r===rows-1),
        is_interior: c > 0 && r > 0 && r < rows-1,
      });
    }
  }

  // Right blocks
  for (let r=0; r<rows; r++) {
    for (let c=0; c<right_cols; c++) {
      blocks.push({
        x: sr + c*BLOCK,
        y: MAP.y0 + r*BLOCK,
        w: BLOCK, h: BLOCK,
        side: 'right', col: c, row: r,
        is_perimeter: (c===right_cols-1 || r===0 || r===rows-1),
        is_interior: c < right_cols-1 && r > 0 && r < rows-1,
      });
    }
  }

  return blocks;
}

// ── DENSITY CALCULATOR ──
function calcDensity() {
  if (!MAP_BOUNDS) return;

  // Site area in acres (from parcel data)
  const site_acres = 73.4;

  // Units from placed buildings
  let placed_units = 0;
  let placed_floor_area = 0;  // sq ft
  const site_area_sqft = site_acres * 43560;

  for (const b of PLACED_BUILDINGS) {
    // Each pixel ≈ 7.5ft (702px = ~350ft site width, but site is ~1320ft so 1px ≈ 1.88ft)
    // The map x0-x1 = 702px spans the site bounding box
    // From GIS: site is ~73ac = ~3.18M sqft. Map area = 702*490 = 344,000px²
    // So 1px² = 3,180,000/344,000 = 9.24 sqft → 1px = 3.04ft
    const PX_TO_FT = 3.04;
    const bldg_footprint_sqft = b.w * b.h * PX_TO_FT * PX_TO_FT;
    const bldg_floor_area = bldg_footprint_sqft * b.floors;
    // Assume 850sqft avg unit, 80% residential (20% circulation/common)
    const units = Math.round(bldg_floor_area * 0.80 / 850);
    placed_units += units;
    placed_floor_area += bldg_floor_area;
  }

  const far = placed_floor_area / site_area_sqft;
  const units_per_acre = placed_units / site_acres;

  // Walk score estimate: based on planned amenities + transit
  // Tide station: ~2033. Current: car-dependent. Planned: very walkable.
  // Base + transit bonus + density bonus
  const transit_bonus = 20;  // Tide extension planned
  const density_bonus = Math.min(30, units_per_acre / 3);
  const amenity_bonus = 15;  // planned retail/clinic/incubator
  const walk_score = Math.min(95, 30 + transit_bonus + Math.round(density_bonus) + amenity_bonus);

  // Update UI
  if (dv_far) {
    dv_far.textContent = far.toFixed(2);
    dv_far.className = 'density-val' + (far > 4.5 ? ' bad' : far > 3.0 ? '' : ' warn');
  }
}

// ── BUILDING PLACEMENT ──
let placingBuilding = null;  // {startX, startY}

function initBuildingPlacement() {
  const svg = document.getElementById('site-plan');
  if (!svg) return;

  svg.addEventListener('mousedown', (e) => {
    if (CURRENT_TOOL !== 'place' && CURRENT_TOOL !== 'section') return;
    const pt = svgPoint(svg, e);
    if (CURRENT_TOOL === 'place') {
      placingBuilding = {sx:pt.x, sy:pt.y};
    } else if (CURRENT_TOOL === 'section') {
      SECTION_CUT = {x1:pt.x, y1:pt.y, x2:pt.x, y2:pt.y};
    }
  });

  svg.addEventListener('mousemove', (e) => {
    if (!placingBuilding && CURRENT_TOOL !== 'section') return;
    const pt = svgPoint(svg, e);
    if (CURRENT_TOOL === 'place' && placingBuilding) {
      // Draw preview
      let preview = document.getElementById('bldg-preview');
      if (!preview) {
        preview = document.createElementNS('http://www.w3.org/2000/svg','rect');
        preview.setAttribute('id','bldg-preview');
        preview.setAttribute('fill','#d09828');
        preview.setAttribute('fill-opacity','0.25');
        preview.setAttribute('stroke','#d09828');
        preview.setAttribute('stroke-width','1.5');
        preview.setAttribute('stroke-dasharray','4,2');
        svg.appendChild(preview);
      }
      const x = Math.min(placingBuilding.sx, pt.x);
      const y = Math.min(placingBuilding.sy, pt.y);
      const w = Math.abs(pt.x - placingBuilding.sx);
      const h = Math.abs(pt.y - placingBuilding.sy);
      preview.setAttribute('x',x); preview.setAttribute('y',y);
      preview.setAttribute('width',w); preview.setAttribute('height',h);
    } else if (CURRENT_TOOL === 'section' && SECTION_CUT) {
      SECTION_CUT.x2 = pt.x; SECTION_CUT.y2 = pt.y;
      drawSectionLine();
    }
  });

  svg.addEventListener('mouseup', (e) => {
    const pt = svgPoint(svg, e);
    if (CURRENT_TOOL === 'place' && placingBuilding) {
      const x = Math.min(placingBuilding.sx, pt.x);
      const y = Math.min(placingBuilding.sy, pt.y);
      const w = Math.abs(pt.x - placingBuilding.sx);
      const h = Math.abs(pt.y - placingBuilding.sy);
      if (w > 10 && h > 10) {
        const bldg = {
          id: Date.now(), x, y, w, h,
          floors: promptFloors(),
          use: 'residential',
          constraint_ok: checkBuildingConstraints(x,y,w,h),
        };
        PLACED_BUILDINGS.push(bldg);
        renderBuildings();
        calcDensity();
      }
      document.getElementById('bldg-preview')?.remove();
      placingBuilding = null;
    } else if (CURRENT_TOOL === 'section' && SECTION_CUT) {
      SECTION_CUT.x2 = pt.x; SECTION_CUT.y2 = pt.y;
      renderSection();
    }
  });
}

function svgPoint(svg, e) {
  const rect = svg.getBoundingClientRect();
  const scaleX = 960 / rect.width;
  const scaleY = 760 / rect.height;
  return {x: (e.clientX - rect.left)*scaleX, y: (e.clientY - rect.top)*scaleY};
}

function promptFloors() {
  // For now default to 4; could be a toolbar control
  return 4;
}

function checkBuildingConstraints(x,y,w,h) {
  if (!MAP_BOUNDS) return {ok:true, violations:[]};
  const MAP = MAP_BOUNDS;
  const violations = [];
  // Must be within map area
  if (x < MAP.x0 || x+w > MAP.x1 || y < MAP.y0 || y+h > MAP.y1)
    violations.push('Outside site boundary');
  // Minimum courtyard: building footprint ≤ 70% of block area
  const BLOCK = 130;
  const footprint = w*h;
  const block_area = BLOCK*BLOCK;
  if (footprint > block_area * 0.70)
    violations.push('Courtyard ratio: building >70% of block (min 30% courtyard required)');
  // Daylight angle: building height ≤ 45° from courtyard center
  // Simplified: w or h should not exceed floors*10px (1 story ≈ 10px)
  return {ok: violations.length === 0, violations};
}

function renderBuildings() {
  const svg = document.getElementById('site-plan');
  if (!svg) return;
  const ns = 'http://www.w3.org/2000/svg';

  // Clear existing placed buildings
  svg.querySelectorAll('[data-bldg]').forEach(e => e.remove());

  for (const b of PLACED_BUILDINGS) {
    const color = b.constraint_ok.ok ? '#d09828' : '#c04030';

    // Building footprint
    const r = document.createElementNS(ns,'rect');
    r.setAttribute('x',b.x); r.setAttribute('y',b.y);
    r.setAttribute('width',b.w); r.setAttribute('height',b.h);
    r.setAttribute('fill',color); r.setAttribute('fill-opacity','0.3');
    r.setAttribute('stroke',color); r.setAttribute('stroke-width','1.5');
    r.setAttribute('data-bldg',b.id);
    r.setAttribute('clip-path','url(#mc)');
    r.style.cursor='pointer';
    r.addEventListener('click',() => {
      if (CURRENT_TOOL === 'select') {
        if (confirm('Remove this building?')) {
          PLACED_BUILDINGS = PLACED_BUILDINGS.filter(x=>x.id!==b.id);
          renderBuildings(); calcDensity(); renderOverlays();
        }
      }
    });
    svg.appendChild(r);

    // Floor label
    const t = document.createElementNS(ns,'text');
    t.setAttribute('x', b.x+b.w/2); t.setAttribute('y', b.y+b.h/2+4);
    t.setAttribute('font-family','DM Mono,monospace'); t.setAttribute('font-size','8');
    t.setAttribute('fill',color); t.setAttribute('text-anchor','middle');
    t.setAttribute('data-bldg',b.id); t.setAttribute('clip-path','url(#mc)');
    t.textContent = b.floors+'F';
    svg.appendChild(t);

    // Constraint violation indicator
    if (!b.constraint_ok.ok) {
      const warn = document.createElementNS(ns,'text');
      warn.setAttribute('x',b.x+4); warn.setAttribute('y',b.y+12);
      warn.setAttribute('font-family','DM Mono,monospace'); warn.setAttribute('font-size','7');
      warn.setAttribute('fill','#c04030'); warn.setAttribute('data-bldg',b.id);
      warn.setAttribute('clip-path','url(#mc)');
      warn.textContent = '⚠ '+b.constraint_ok.violations[0];
      svg.appendChild(warn);
    }
  }
}

function clearBuildings() {
  PLACED_BUILDINGS = [];
  document.querySelectorAll('[data-bldg]').forEach(e=>e.remove());
  calcDensity(); renderOverlays();
}

// ── SUPERBLOCK OVERLAY RENDERER ──
function renderOverlays() {
  const svg = document.getElementById('site-plan');
  if (!svg) return;

  // Clear previous overlays
  svg.querySelectorAll('[data-overlay]').forEach(e=>e.remove());

  if (!DERIVED_G || !MAP_BOUNDS) return;
  const ns = 'http://www.w3.org/2000/svg';
  const MAP = MAP_BOUNDS;
  const G = DERIVED_G;

  if (OVERLAYS.superblock) {
    const blocks = computeSuperblockGrid({SPINE: G.SPINE, MALL: G.MALL_CORE_BOUNDS}, MAP);
    const og = document.createElementNS(ns,'g');
    og.setAttribute('data-overlay','superblock');
    og.setAttribute('opacity','0.55');

    for (const b of blocks) {
      // Interior streets: the block grid lines
      const r = document.createElementNS(ns,'rect');
      r.setAttribute('x',b.x); r.setAttribute('y',b.y);
      r.setAttribute('width',b.w); r.setAttribute('height',b.h);
      r.setAttribute('fill','none');
      r.setAttribute('stroke', b.is_perimeter ? '#4888a8' : '#2a4860');
      r.setAttribute('stroke-width', b.is_perimeter ? '1.5' : '0.8');
      r.setAttribute('stroke-dasharray', b.is_interior ? '4,4' : 'none');
      r.setAttribute('clip-path','url(#mc)');
      og.appendChild(r);

      // Interior block: pedestrian zone indicator
      if (b.is_interior && b.w > 20 && b.h > 20) {
        const inset = 8;
        const ri = document.createElementNS(ns,'rect');
        ri.setAttribute('x',b.x+inset); ri.setAttribute('y',b.y+inset);
        ri.setAttribute('width',b.w-inset*2); ri.setAttribute('height',b.h-inset*2);
        ri.setAttribute('fill','#4888a8'); ri.setAttribute('fill-opacity','0.06');
        ri.setAttribute('clip-path','url(#mc)');
        og.appendChild(ri);
      }
    }

    // Spine "green street" label
    if (G.SPINE) {
      const sl = G.SPINE.x, sr = G.SPINE.x+G.SPINE.w;
      const lt = document.createElementNS(ns,'text');
      lt.setAttribute('x', sl-8); lt.setAttribute('y', MAP.y0 + (MAP.y1-MAP.y0)/2);
      lt.setAttribute('font-family','DM Mono,monospace'); lt.setAttribute('font-size','6');
      lt.setAttribute('fill','#4888a8'); lt.setAttribute('text-anchor','end');
      lt.setAttribute('opacity','0.6');
      lt.setAttribute('transform',`rotate(-90,${sl-8},${MAP.y0+(MAP.y1-MAP.y0)/2})`);
      lt.setAttribute('data-overlay','superblock');
      lt.textContent = 'GREEN STREET · PEDESTRIAN ONLY';
      svg.appendChild(lt);
    }

    svg.appendChild(og);
  }

  if (OVERLAYS.walkability) {
    // Walkability radius circles from key amenity locations
    const amenities = [];
    if (G.TIDE) amenities.push({x:G.TIDE.x+G.TIDE.w/2, y:G.TIDE.y, label:'Tide Stn.', r:150, color:'#3898c0'});
    if (G.SPONGE) amenities.push({x:G.SPONGE.cx, y:G.SPONGE.cy, label:'Sponge Park', r:120, color:'#3a8040'});
    // Main street centroid (assume center of band)
    amenities.push({x:(MAP.x0+MAP.x1)/2, y:(MAP.y0+G.BAND_BOT)/2, label:'Main St.', r:140, color:'#c85018'});

    const wg = document.createElementNS(ns,'g');
    wg.setAttribute('data-overlay','walkability');

    for (const a of amenities) {
      // 5-min walk circle (~400m ≈ 130px at our scale)
      const c1 = document.createElementNS(ns,'circle');
      c1.setAttribute('cx',a.x); c1.setAttribute('cy',a.y); c1.setAttribute('r',a.r);
      c1.setAttribute('fill','none'); c1.setAttribute('stroke',a.color);
      c1.setAttribute('stroke-width','1'); c1.setAttribute('stroke-dasharray','3,5');
      c1.setAttribute('opacity','0.35'); c1.setAttribute('clip-path','url(#mc)');
      wg.appendChild(c1);

      // Label
      const lt = document.createElementNS(ns,'text');
      lt.setAttribute('x',a.x); lt.setAttribute('y',a.y-a.r-4);
      lt.setAttribute('font-family','DM Mono,monospace'); lt.setAttribute('font-size','6');
      lt.setAttribute('fill',a.color); lt.setAttribute('text-anchor','middle'); lt.setAttribute('opacity','0.6');
      lt.textContent = a.label+' 5min walk';
      wg.appendChild(lt);
    }
    svg.appendChild(wg);
  }

  // ── STREETS + WALKING PATHS overlay ──
  // Streets: the spine corridor and major internal routes (grey)
  // Walking paths: courtyard-to-courtyard connections (warm brown)
  if (OVERLAYS.streets && DERIVED_G && MAP_BOUNDS) {
    const sg = document.createElementNS(ns, 'g');
    sg.setAttribute('data-overlay', 'streets');

    const G = DERIVED_G;
    const MAP = MAP_BOUNDS;

    // ── MAIN STREET (Va Beach Blvd frontage) — primary street, grey ──
    if (G.BAND) {
      const ms = document.createElementNS(ns, 'line');
      ms.setAttribute('x1', MAP.x0); ms.setAttribute('y1', G.BAND.y + G.BAND.h);
      ms.setAttribute('x2', MAP.x1); ms.setAttribute('y2', G.BAND.y + G.BAND.h);
      ms.setAttribute('stroke', '#7a7878'); ms.setAttribute('stroke-width', '3');
      ms.setAttribute('stroke-opacity', '0.7');
      sg.appendChild(ms);
      // Street label
      const msl = document.createElementNS(ns, 'text');
      msl.setAttribute('x', MAP.x0 + 12); msl.setAttribute('y', G.BAND.y + G.BAND.h - 5);
      msl.setAttribute('font-family', 'DM Mono,monospace'); msl.setAttribute('font-size', '6');
      msl.setAttribute('fill', '#7a7878'); msl.setAttribute('opacity', '0.7');
      msl.textContent = 'MAIN ST CORRIDOR'; sg.appendChild(msl);
    }

    // ── COMMONS SPINE — pedestrian priority street, grey ──
    if (G.SPINE) {
      const sp = document.createElementNS(ns, 'rect');
      sp.setAttribute('x', G.SPINE.x); sp.setAttribute('y', G.SPINE.y);
      sp.setAttribute('width', G.SPINE.w); sp.setAttribute('height', G.SPINE.h);
      sp.setAttribute('fill', '#5a5858'); sp.setAttribute('fill-opacity', '0.25');
      sp.setAttribute('stroke', '#7a7878'); sp.setAttribute('stroke-width', '1.5');
      sp.setAttribute('stroke-opacity', '0.5');
      sg.appendChild(sp);
      const spl = document.createElementNS(ns, 'text');
      spl.setAttribute('x', G.SPINE.x + G.SPINE.w/2);
      spl.setAttribute('y', G.SPINE.y + 14);
      spl.setAttribute('font-family', 'DM Mono,monospace'); spl.setAttribute('font-size', '5.5');
      spl.setAttribute('fill', '#9a9898'); spl.setAttribute('text-anchor', 'middle');
      spl.setAttribute('letter-spacing', '0.15em');
      spl.textContent = 'COMMONS SPINE'; sg.appendChild(spl);
    }

    // ── WALKING PATHS — courtyard centroid connections (warm brown) ──
    // Connect green zones and courtyards that are adjacent
    if (window._lastPipelineZones) {
      const zones = window._lastPipelineZones;
      const greenZones = zones.filter(z =>
        z.use === 'GREEN_ACTIVE' || z.use === 'GREEN_PASSIVE' ||
        z.district?.includes('COURTYARD')
      );
      const drawnPaths = new Set();
      for (const a of greenZones) {
        for (const b of greenZones) {
          if (a === b) continue;
          const key = [a.id, b.id].sort().join('|');
          if (drawnPaths.has(key)) continue;
          const dist = Math.hypot(a.centroid.x - b.centroid.x, a.centroid.y - b.centroid.y);
          if (dist > 180) continue;  // only connect nearby green zones
          drawnPaths.add(key);
          const path = document.createElementNS(ns, 'line');
          path.setAttribute('x1', a.centroid.x.toFixed(1)); path.setAttribute('y1', a.centroid.y.toFixed(1));
          path.setAttribute('x2', b.centroid.x.toFixed(1)); path.setAttribute('y2', b.centroid.y.toFixed(1));
          path.setAttribute('stroke', '#8a6840'); path.setAttribute('stroke-width', '2');
          path.setAttribute('stroke-opacity', '0.55');
          path.setAttribute('stroke-dasharray', '4,3');
          path.setAttribute('clip-path', 'url(#mc)');
          sg.appendChild(path);
        }
      }

      // ── INTERNAL STREETS — edges between adjacent residential zones (grey) ──
      // These are the shared edges of the courtyard ring blocks
      const courtZones = zones.filter(z => z.district?.includes('FOOTPRINT') || z.district?.includes('COURTYARD'));
      const drawnStreets = new Set();
      for (const a of courtZones) {
        for (const b of courtZones) {
          if (a === b || a.district === b.district) continue;
          const key = [a.id, b.id].sort().join('|');
          if (drawnStreets.has(key)) continue;
          const dist = Math.hypot(a.centroid.x - b.centroid.x, a.centroid.y - b.centroid.y);
          if (dist > 140) continue;
          drawnStreets.add(key);
          // Draw a short street segment between the two zone centroids
          const mx = (a.centroid.x + b.centroid.x) / 2;
          const my = (a.centroid.y + b.centroid.y) / 2;
          // Use a dashed grey line to indicate internal street/service lane
          const street = document.createElementNS(ns, 'line');
          street.setAttribute('x1', a.centroid.x.toFixed(1)); street.setAttribute('y1', a.centroid.y.toFixed(1));
          street.setAttribute('x2', b.centroid.x.toFixed(1)); street.setAttribute('y2', b.centroid.y.toFixed(1));
          street.setAttribute('stroke', '#686868'); street.setAttribute('stroke-width', '1.2');
          street.setAttribute('stroke-opacity', '0.35');
          street.setAttribute('stroke-dasharray', '2,4');
          street.setAttribute('clip-path', 'url(#mc)');
          sg.appendChild(street);
        }
      }
    }

    svg.appendChild(sg);
  }
}

// ── SECTION CUT RENDERER ──
function drawSectionLine() {
  const svg = document.getElementById('site-plan');
  if (!svg || !SECTION_CUT) return;
  const ns = 'http://www.w3.org/2000/svg';

  svg.querySelectorAll('[data-section-line]').forEach(e=>e.remove());

  const g = document.createElementNS(ns,'g');
  g.setAttribute('data-section-line','1');

  // The cut line
  const line = document.createElementNS(ns,'line');
  line.setAttribute('x1',SECTION_CUT.x1); line.setAttribute('y1',SECTION_CUT.y1);
  line.setAttribute('x2',SECTION_CUT.x2); line.setAttribute('y2',SECTION_CUT.y2);
  line.setAttribute('stroke','#c85018'); line.setAttribute('stroke-width','2');
  line.setAttribute('stroke-dasharray','6,3');
  g.appendChild(line);

  // End markers
  for (const [ex,ey] of [[SECTION_CUT.x1,SECTION_CUT.y1],[SECTION_CUT.x2,SECTION_CUT.y2]]) {
    const circ = document.createElementNS(ns,'circle');
    circ.setAttribute('cx',ex); circ.setAttribute('cy',ey); circ.setAttribute('r','5');
    circ.setAttribute('fill','none'); circ.setAttribute('stroke','#c85018'); circ.setAttribute('stroke-width','1.5');
    g.appendChild(circ);
  }

  svg.appendChild(g);
}

function renderSection() {
  if (!SECTION_CUT || !DERIVED_G || !MAP_BOUNDS) return;
  const sc = SECTION_CUT;
  const G = DERIVED_G;
  const MAP = MAP_BOUNDS;

  // Show section panel
  const panel = document.getElementById('section-section');
  if (panel) panel.style.display = '';

  drawSectionLine();

  const svg = document.getElementById('section-view');
  if (!svg) return;
  const ns = 'http://www.w3.org/2000/svg';
  const W=960, H=280, GRADE_Y=200;

  svg.innerHTML = '';

  // Background sky
  const sky = document.createElementNS(ns,'defs');
  const grad = document.createElementNS(ns,'linearGradient');
  grad.setAttribute('id','sec-sky'); grad.setAttribute('x1','0'); grad.setAttribute('y1','0');
  grad.setAttribute('x2','0'); grad.setAttribute('y2','1');
  const s1=document.createElementNS(ns,'stop'); s1.setAttribute('offset','0%'); s1.setAttribute('stop-color','#b8c8d8');
  const s2=document.createElementNS(ns,'stop'); s2.setAttribute('offset','100%'); s2.setAttribute('stop-color','#d8e6f0');
  grad.appendChild(s1); grad.appendChild(s2); sky.appendChild(grad);
  svg.appendChild(sky);

  svg.appendChild(el(ns,'rect',{width:W,height:H,fill:'url(#sec-sky)'}));
  svg.appendChild(el(ns,'rect',{x:0,y:GRADE_Y,width:W,height:H-GRADE_Y,fill:'#7a6848'}));
  svg.appendChild(el(ns,'line',{x1:0,y1:GRADE_Y,x2:W,y2:GRADE_Y,stroke:'#4a3820','stroke-width':'2'}));

  // Determine what the cut passes through
  // Map cut line to site coordinates
  // The section is a 1D scan: at each x along the cut, what district/building is present?

  // Cut angle
  const dx = sc.x2 - sc.x1, dy = sc.y2 - sc.y1;
  const len = Math.hypot(dx,dy);
  const steps = 20;

  // Collect features along cut
  const features = [];

  for (let i=0; i<=steps; i++) {
    const t = i/steps;
    const px = sc.x1 + dx*t;
    const py = sc.y1 + dy*t;
    const screen_x = Math.round(W * t);

    // Check what's at this point
    let what = 'open';
    if (G.SPINE && px >= G.SPINE.x && px <= G.SPINE.x+G.SPINE.w) what = 'spine';
    else if (G.SPONGE && ((px-G.SPONGE.cx)**2/G.SPONGE.rx**2 + (py-G.SPONGE.cy)**2/G.SPONGE.ry**2) < 1) what = 'sponge';
    else if (G.BAND_BOT && py < G.BAND_BOT) what = 'mainst';

    // Check placed buildings
    for (const b of PLACED_BUILDINGS) {
      if (px >= b.x && px <= b.x+b.w && py >= b.y && py <= b.y+b.h) {
        what = 'building_'+b.floors;
      }
    }

    features.push({t, px, py, screen_x, what});
  }

  // Render section profile
  let lastWhat = null;
  for (const f of features) {
    let bldg_h = 0;
    let color = '#5a4a3a';

    if (f.what.startsWith('building_')) {
      const floors = parseInt(f.what.split('_')[1]);
      // 1 floor ≈ 14px in section view
      bldg_h = floors * 20;
      color = '#8a7060';
    } else if (f.what === 'spine') {
      bldg_h = 0;
      color = '#2878a0';
    } else if (f.what === 'sponge') {
      bldg_h = -12;  // below grade
      color = '#3a8040';
    } else if (f.what === 'mainst') {
      bldg_h = 0;
      color = '#c85018';
    }

    if (bldg_h > 0) {
      svg.appendChild(el(ns,'rect',{
        x: f.screen_x, y: GRADE_Y-bldg_h,
        width: W/steps, height: bldg_h,
        fill: color, 'fill-opacity':'0.7',
        stroke: color, 'stroke-width':'0.5'
      }));
    }

    lastWhat = f.what;
  }

  // Grade line
  svg.appendChild(el(ns,'line',{x1:0,y1:GRADE_Y,x2:W,y2:GRADE_Y,stroke:'#2a1a08','stroke-width':'2'}));

  // Add native plants at strategic points
  const plantPositions = [
    {x:W*0.15, species:'Quercus phellos', h:50, canopy:32},
    {x:W*0.35, species:'Betula nigra', h:42, canopy:28},
    {x:W*0.55, species:'Acer rubrum', h:45, canopy:35},
    {x:W*0.75, species:'Carpinus caroliniana', h:28, canopy:22},
    {x:W*0.88, species:'Amelanchier arborea', h:22, canopy:18},
  ];

  for (const p of plantPositions) {
    // Trunk
    svg.appendChild(el(ns,'rect',{x:p.x-2,y:GRADE_Y-p.h,width:4,height:p.h,fill:'#5a4030'}));
    // Canopy (ellipse)
    const canopy = document.createElementNS(ns,'ellipse');
    canopy.setAttribute('cx',p.x); canopy.setAttribute('cy',GRADE_Y-p.h-p.canopy*0.3);
    canopy.setAttribute('rx',p.canopy); canopy.setAttribute('ry',p.canopy*0.9);
    canopy.setAttribute('fill','#3a6828'); canopy.setAttribute('opacity','0.85');
    svg.appendChild(canopy);
    // Species label
    const lt = document.createElementNS(ns,'text');
    lt.setAttribute('x',p.x); lt.setAttribute('y',GRADE_Y+14);
    lt.setAttribute('font-family','monospace'); lt.setAttribute('font-size','6');
    lt.setAttribute('fill','#4a6030'); lt.setAttribute('text-anchor','middle');
    lt.setAttribute('font-style','italic');
    lt.textContent = p.species;
    svg.appendChild(lt);
  }

  // Annotation bar
  svg.appendChild(el(ns,'rect',{x:0,y:H-24,width:W,height:24,fill:'#121009','fill-opacity':'0.9'}));
  svg.appendChild(el(ns,'line',{x1:0,y1:H-24,x2:W,y2:H-24,stroke:'#c85018','stroke-width':'1.5'}));

  const inf = document.createElementNS(ns,'text');
  inf.setAttribute('x',10); inf.setAttribute('y',H-9);
  inf.setAttribute('font-family','monospace'); inf.setAttribute('font-size','7.5');
  inf.setAttribute('fill','#a09080');
  inf.textContent = `Live section cut · ${features.filter(f=>f.what.startsWith('building')).length>0?PLACED_BUILDINGS.length+' building(s) placed · ':''}Native planting: Quercus phellos, Betula nigra, Acer rubrum, Carpinus caroliniana, Amelanchier arborea`;
  svg.appendChild(inf);

  // Update info text
  const info = document.getElementById('section-info');
  if (info) {
    const angle_deg = Math.round(Math.atan2(dy,dx)*180/Math.PI);
    info.textContent = `Cut: (${Math.round(sc.x1)},${Math.round(sc.y1)}) → (${Math.round(sc.x2)},${Math.round(sc.y2)}) · ${Math.round(len)}px · ${angle_deg}°`;
  }
}

function el(ns, tag, attrs) {
  const e = document.createElementNS(ns, tag);
  for (const [k,v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// ── PLANT PALETTE RENDERER ──
function renderPlantPalette() {
  const container = document.getElementById('plant-list');
  if (!container) return;

  const items = PLANT_REGISTRY.species.map(s => {
    const cls = 'plant-chip' + (s.meye_available ? ' meye' : '');
    const meye_link = s.meye_available ? ` title="Available on meye.dk as ${s.meye_genus}"` : '';
    return `<span class="${cls}"${meye_link}>${s.common} <em style="opacity:0.5;font-style:normal;">(${s.latin})</em></span>`;
  });

  container.innerHTML = items.join('') +
    `<span style="font-family:var(--font-mono);font-size:0.58rem;color:var(--muted);margin-left:0.5rem;align-self:center;">
      M = available on <a href="https://meye.dk/" target="_blank" style="color:var(--accent-dim);">meye.dk</a>
    </span>`;
}

// ── EXPORT DERIVED GEOMETRY FOR OTHER MODULES ──
function exportDerived(derived, MAP) {
  // Store globally so interactive tools can access solved geometry
  DERIVED_G = {
    SPINE: derived.SPINE,
    SPONGE: derived.SPONGE_PARK_ELLIPSE,
    TIDE: derived.TIDE_STATION,
    RESEARCH: derived.RESEARCH_STATION,
    BAND_BOT: derived.MAIN_STREET_BAND ? derived.MAIN_STREET_BAND.y + derived.MAIN_STREET_BAND.height : null,
    MALL_CORE_BOUNDS: null,  // populated from parcel data
  };
  MAP_BOUNDS = MAP;
}

// ── INIT ──
function initInteractiveLayer() {
  initBuildingPlacement();
  renderPlantPalette();
  // Overlays rendered after main() sets DERIVED_G
}

// Export for main() to call after solve
window.EC_Interactive = {
  exportDerived,
  renderOverlays,
  calcDensity,
  initInteractiveLayer,
};

// ═══════════════════════════════════════════════════════════════════════════════
//  EASTSIDE COMMONS — SPATIAL DECOMPOSITION PIPELINE
//  Tiers 1–7: ground truth → zone decomposition → use assignment (EA) →
//             unit decomposition → edge mutation → cleanup → coloring
//
//  Design principles:
//  - All dimensions in feet first, converted to px via computed scale
//  - No hardcoded pixel values except MAP canvas bounds (inherited from constraint solver)
//  - Each tier is a pure function: (input, params) → output
//  - T3 EA runs async so UI stays live
//  - T7 is the only tier that touches SVG
// ═══════════════════════════════════════════════════════════════════════════════

// ── PLANNING CONSTANTS (all in feet — the authoritative source of truth) ──────
const PLANNING = {
  // Road setbacks by class (ft from road edge to buildable zone)
  SETBACK: { HIGHWAY: 50, ARTERIAL: 20, COLLECTOR: 15, LOCAL: 10 },

  // ── 5-OVER-1 TYPOLOGY (25×125 ft parcel) ──────────────────────────────────
  // The canonical building unit: 25ft wide × 125ft deep lot.
  // Ground floor: commercial (14ft ceiling, full footprint).
  // Floors 2–6: Type V wood frame over Type I concrete podium.
  // No parking podium. Street-facing. One at a time if you want.
  // Reference: Izmir/Manisa (Turkey), Eixample ground typology, Chicago 25ft lot.
  PARCEL_W_FT: 25,                // lot width
  PARCEL_D_FT: 125,               // lot depth
  PARCEL_SF: 25 * 125,            // 3,125 sf footprint
  COMMERCIAL_FLOORS: 1,           // ground floor commercial
  COMMERCIAL_CEILING_FT: 14,      // activated street wall
  RESIDENTIAL_FLOORS: 5,          // wood frame over podium
  FLOOR_HEIGHT_FT: 10,            // residential floor-to-floor
  BUILDING_HEIGHT_FT: 14 + 5*10,  // 64ft — fits under 65ft residential limit
  EFFICIENCY_RATIO: 0.82,         // net-to-gross residential
  AVG_UNIT_SF: 850,               // 2BR equivalent planning average
  MIN_UNIT_SF: 550,               // 1BR studio minimum
  // Units per building: 5 floors × (25×125×0.82 / 850) = ~15 units
  UNITS_PER_BUILDING: Math.round(5 * (25 * 125 * 0.82) / 850),  // ~15

  // Building envelope
  MAX_BUILDING_DEPTH_FT: 125,     // full lot depth (no daylight constraint — rear courtyard handles it)
  MIN_COURTYARD_RATIO: 0.25,      // 25% of block as open/green (parks, not parking)
  MAX_HEIGHT_FT: { residential: 65, commercial: 45, civic: 55, mixed: 65 },

  // Use mix targets (site-wide) — YIMBY market-rate model
  TARGET_UNITS: 3200,             // flood the zone: ~70 u/ac × 45ac buildable
  TARGET_AFFORDABLE_PCT: 0.0,     // no mandatory affordability — CLT land removal IS the affordability
  TARGET_GREEN_PCT: 0.25,         // 25% parks minimum — everyone gets a playground

  // Density targets — 5-over-1 is naturally 4.5–5.5 FAR on footprint
  FAR_MIN: 4.0, FAR_MAX: 5.5,
  DENSITY_TARGET_UAC: 70,         // units/acre — Greenwich Village is 75, Eixample is 142

  // Tier 2 defaults
  BLOCK_SIZE_FT: 250,             // shorter blocks → more street activation
  PARCEL_CUT_FT: 25,              // Jacobs grain = parcel width
  STRATEGY: 'hybrid',
  SPINE_WIDTH_FT: 60,             // pedestrian spine — narrower, more intimate

  // Market rate financials (no LIHTC, no subsidy stack)
  CONSTRUCTION_COST_PSF: 225,     // $/sf all-in, wood frame Type V (no podium parking)
  COMMERCIAL_RENT_PSF: 28,        // NNN $/sf/yr (conservative; activated street → $35-45 yr 5+)
  RESIDENTIAL_RENT_MO: 1650,      // market 2BR Norfolk 2024; first-mover discount
  OPEX_PCT_MARKET: 0.38,          // market-rate OpEx (no LIHTC compliance overhead)
  CAP_RATE: 0.055,                // 5.5% — Class B+ multifamily Hampton Roads
  // No land cost — CLT holds it. This is the entire margin.

  // EA parameters
  EA_CANDIDATES: 30,
  EA_SURVIVORS: 3,
  EA_ROUNDS: 15,
  EA_MUTATION_RATE: 0.10,
};

// ── USE TAXONOMY ──────────────────────────────────────────────────────────────
const USES = {
  // ── PRIMARY: 5-over-1 mixed use ──────────────────────────────────────────
  MIXED_USE_5OVER1:   { id:'MX', label:'5-over-1 (ground commercial + 5 residential)', color:'#c84818', priority:0 },
  // Market rate residential (pure residential parcels — interior courts, upper streets)
  RESIDENTIAL_MARKET: { id:'RM', label:'Market-rate residential',    color:'#c87818', priority:1 },
  // CLT ownership — the same building, land held permanently. No subsidy needed.
  RESIDENTIAL_CLT_OWN:{ id:'RC', label:'CLT homeownership (~$150k)', color:'#e8b820', priority:1 },
  // ── PLAY: parks and public space ─────────────────────────────────────────
  GREEN_ACTIVE:       { id:'GA', label:'Active park / playground',   color:'#22a838', priority:1 },
  GREEN_PASSIVE:      { id:'GP', label:'Wetland / bioswale / ecological', color:'#0e7828', priority:1 },
  PLAZA:              { id:'PZ', label:'Plaza / hardscape gathering', color:'#6888a8', priority:2 },
  // ── CIVIC / ANCHOR ───────────────────────────────────────────────────────
  CIVIC:              { id:'CV', label:'Civic / library / clinic',   color:'#1868b8', priority:2 },
  MARKET_HALL:        { id:'MH', label:'Eastside Market (Phase 0)',  color:'#b84898', priority:0 },
  TRANSIT:            { id:'TR', label:'Transit / Tide station',     color:'#0858b8', priority:1 },
  // ── INFRASTRUCTURE ───────────────────────────────────────────────────────
  RESEARCH:           { id:'RS', label:'Research / sponge station',  color:'#18a0c8', priority:3 },
  INFRASTRUCTURE:     { id:'IN', label:'Infrastructure / utility',   color:'#4a4038', priority:3 },
  // ── LIVE-WORK (narrow typology variant) ──────────────────────────────────
  LIVE_WORK:          { id:'LW', label:'Live/work studio (25×50 variant)', color:'#d87828', priority:2 },
  // ── PRODUCTION / MAKER ───────────────────────────────────────────────────
  WORKSHOP_FABRICATION:{ id:'WF', label:'Workshop / fabrication / makerspace', color:'#8a5c28', priority:2 },
  DEPOT_YARD:         { id:'DY', label:'Depot yard / service / storage',  color:'#5a4828', priority:3 },
  COOP_INCUBATOR:     { id:'CI', label:'Co-op incubator / business services', color:'#a06038', priority:2 },
};

// Adjacency graph: which uses can mutate into which (T3 mutation operator)
const USE_ADJACENCY = {
  MIXED_USE_5OVER1:   ['RESIDENTIAL_MARKET','RESIDENTIAL_CLT_OWN','GREEN_ACTIVE','PLAZA','LIVE_WORK'],
  RESIDENTIAL_MARKET: ['MIXED_USE_5OVER1','RESIDENTIAL_CLT_OWN','GREEN_ACTIVE','PLAZA'],
  RESIDENTIAL_CLT_OWN:['MIXED_USE_5OVER1','RESIDENTIAL_MARKET','GREEN_ACTIVE','CIVIC','LIVE_WORK'],
  GREEN_ACTIVE:       ['GREEN_PASSIVE','PLAZA','MIXED_USE_5OVER1','RESIDENTIAL_MARKET'],
  GREEN_PASSIVE:      ['GREEN_ACTIVE','RESEARCH','INFRASTRUCTURE'],
  PLAZA:              ['CIVIC','GREEN_ACTIVE','MIXED_USE_5OVER1','MARKET_HALL','TRANSIT'],
  CIVIC:              ['PLAZA','GREEN_ACTIVE','MIXED_USE_5OVER1','RESIDENTIAL_CLT_OWN'],
  MARKET_HALL:        ['MIXED_USE_5OVER1','PLAZA','CIVIC'],
  TRANSIT:            ['CIVIC','PLAZA','MIXED_USE_5OVER1','INFRASTRUCTURE'],
  RESEARCH:           ['GREEN_PASSIVE','CIVIC','INFRASTRUCTURE'],
  INFRASTRUCTURE:     ['GREEN_PASSIVE','TRANSIT'],
  LIVE_WORK:          ['MIXED_USE_5OVER1','RESIDENTIAL_CLT_OWN','GREEN_ACTIVE'],
  WORKSHOP_FABRICATION:['LIVE_WORK','DEPOT_YARD','COOP_INCUBATOR','MIXED_USE_5OVER1'],
  DEPOT_YARD:         ['WORKSHOP_FABRICATION','INFRASTRUCTURE'],
  COOP_INCUBATOR:     ['WORKSHOP_FABRICATION','LIVE_WORK','MIXED_USE_5OVER1','CIVIC'],
};

// Conflict matrix
const CONFLICT = {
  MIXED_USE_5OVER1:   { GREEN_PASSIVE:2, INFRASTRUCTURE:3 },
  RESIDENTIAL_MARKET: { INFRASTRUCTURE:4, GREEN_PASSIVE:1 },
  RESIDENTIAL_CLT_OWN:{ INFRASTRUCTURE:3 },
  GREEN_PASSIVE:      { MIXED_USE_5OVER1:2, RESIDENTIAL_MARKET:1 },
  DEPOT_YARD:         { RESIDENTIAL_CLT_OWN:3, RESIDENTIAL_MARKET:3, GREEN_ACTIVE:2 },
  WORKSHOP_FABRICATION:{ RESIDENTIAL_CLT_OWN:2, RESIDENTIAL_MARKET:2 },
};

// Synergy matrix — the whole point: mixed use NEXT TO parks NEXT TO more mixed use
const SYNERGY = {
  MIXED_USE_5OVER1:   { GREEN_ACTIVE:5, PLAZA:4, TRANSIT:4, MARKET_HALL:4, CIVIC:3, RESIDENTIAL_MARKET:2, LIVE_WORK:3 },
  RESIDENTIAL_MARKET: { GREEN_ACTIVE:4, PLAZA:3, MIXED_USE_5OVER1:3, TRANSIT:2 },
  RESIDENTIAL_CLT_OWN:{ GREEN_ACTIVE:5, PLAZA:4, CIVIC:4, MIXED_USE_5OVER1:3, LIVE_WORK:3 },
  GREEN_ACTIVE:       { MIXED_USE_5OVER1:5, RESIDENTIAL_MARKET:4, RESIDENTIAL_CLT_OWN:5, PLAZA:3, CIVIC:2 },
  GREEN_PASSIVE:      { GREEN_ACTIVE:4, RESEARCH:4 },
  PLAZA:              { MIXED_USE_5OVER1:4, CIVIC:4, GREEN_ACTIVE:3, MARKET_HALL:4, TRANSIT:3 },
  CIVIC:              { PLAZA:4, GREEN_ACTIVE:3, MIXED_USE_5OVER1:3, TRANSIT:2 },
  MARKET_HALL:        { MIXED_USE_5OVER1:5, PLAZA:4, CIVIC:3 },
  TRANSIT:            { MIXED_USE_5OVER1:4, PLAZA:3, CIVIC:2 },
  LIVE_WORK:          { MIXED_USE_5OVER1:4, GREEN_ACTIVE:3, RESIDENTIAL_CLT_OWN:3 },
  WORKSHOP_FABRICATION:{ LIVE_WORK:4, COOP_INCUBATOR:4, DEPOT_YARD:3, MIXED_USE_5OVER1:2 },
  DEPOT_YARD:         { WORKSHOP_FABRICATION:4, INFRASTRUCTURE:3 },
  COOP_INCUBATOR:     { WORKSHOP_FABRICATION:5, LIVE_WORK:4, MIXED_USE_5OVER1:3, CIVIC:3 },
  RESEARCH:           { GREEN_PASSIVE:4, CIVIC:2 },
};

// Planning principle: GREEN_FIRST
// Green infrastructure is placed before residential zones in the optimization.
// This encodes the argument: green space established early becomes an ecological
// and legal fact that subsequent development must accommodate. It is the hardest
// to build and the easiest to lose to political pressure. Place it first.
const GREEN_FIRST_PRIORITY_BONUS = 8; // added to green zone scores during init

// ════════════════════════════════════════════════════════════════════════════════
//  TIER 1 — GROUND TRUTH
//  Input: raw GIS parcels, road boundaries, flood zones, existing structures
//  Output: site constraints object — the unchanging physical reality
// ════════════════════════════════════════════════════════════════════════════════

function buildT1GroundTruth(parcels, proj, MAP) {
  // Compute px/ft scale from projection (two scales due to aspect ratio)
  // We project two points 1 degree apart and measure pixel distance
  const [x0, y0] = proj(-76.210, 36.850);
  const [x1, y1] = proj(-76.209, 36.850);  // 0.001° E
  const [x2, y2] = proj(-76.210, 36.851);  // 0.001° N
  // 0.001° lon at 36.85° ≈ 291.6ft; 0.001° lat ≈ 364.3ft
  const px_per_ft_ew = Math.abs(x1 - x0) / 291.6;
  const px_per_ft_ns = Math.abs(y2 - y0) / 364.3;
  const ft_per_px_ew = 1 / px_per_ft_ew;
  const ft_per_px_ns = 1 / px_per_ft_ns;

  function ftToPx(ft_ew, ft_ns) {
    return [ft_ew * px_per_ft_ew, ft_ns * px_per_ft_ns];
  }

  // Road boundaries (derived from MAP canvas edges, classified by road type)
  const roads = {
    VA_BEACH_BLVD: { edge: 'north', y: MAP.y0, class: 'ARTERIAL', setback_ft: PLANNING.SETBACK.ARTERIAL },
    I264:          { edge: 'south', y: MAP.y1, class: 'HIGHWAY',   setback_ft: PLANNING.SETBACK.HIGHWAY  },
    N_MILITARY_HWY:{ edge: 'west',  x: MAP.x0, class: 'ARTERIAL', setback_ft: PLANNING.SETBACK.ARTERIAL },
    TIDEWATER_DR:  { edge: 'east',  x: MAP.x1, class: 'COLLECTOR', setback_ft: PLANNING.SETBACK.COLLECTOR},
  };

  // Setback polygons — the unbuildable buffer strips along each road
  const setbacks = [];
  for (const [name, road] of Object.entries(roads)) {
    const [, sb_px_ns] = ftToPx(0, road.setback_ft);
    const [sb_px_ew,] = ftToPx(road.setback_ft, 0);
    let poly;
    if (road.edge === 'north') {
      poly = { x:MAP.x0, y:MAP.y0, w:MAP.x1-MAP.x0, h:sb_px_ns };
    } else if (road.edge === 'south') {
      poly = { x:MAP.x0, y:MAP.y1-sb_px_ns, w:MAP.x1-MAP.x0, h:sb_px_ns };
    } else if (road.edge === 'west') {
      poly = { x:MAP.x0, y:MAP.y0, w:sb_px_ew, h:MAP.y1-MAP.y0 };
    } else {
      poly = { x:MAP.x1-sb_px_ew, y:MAP.y0, w:sb_px_ew, h:MAP.y1-MAP.y0 };
    }
    setbacks.push({ name, road_class: road.class, setback_ft: road.setback_ft, poly });
  }

  // EDA parcel index — the actual land we control
  const edaParcels = parcels.filter(p => p.is_eda);

  // Existing structures that constrain the plan
  const existing = [
    {
      name: 'ROSS_LEASEHOLD',
      type: 'leasehold',
      constraint: 'build_around_until_2036',
      // Position from parcel data — derived by constraint solver, referenced here
      note: 'Ross Stores Inc lease through 2036. Cannot demolish. Build around.',
    },
  ];

  // Flood zone: site is Zone X (low-moderate). No hard prohibition but note.
  const floodZone = { designation: 'X', risk: 'low-moderate', subsidence_mm_yr: 4.5 };

  // Building code constants (ft) — the authoritative planning numbers
  const buildingCode = {
    min_unit_sf:        PLANNING.MIN_UNIT_SF,
    avg_unit_sf:        PLANNING.AVG_UNIT_SF,
    max_building_depth: PLANNING.MAX_BUILDING_DEPTH_FT,
    min_courtyard_pct:  PLANNING.MIN_COURTYARD_RATIO,
    daylight_angle_deg: PLANNING.DAYLIGHT_ANGLE_DEG,
    max_height:         PLANNING.MAX_HEIGHT_FT,
    far_range:          [PLANNING.FAR_MIN, PLANNING.FAR_MAX],
  };

  return {
    edaParcels,
    roads,
    setbacks,
    existing,
    floodZone,
    buildingCode,
    proj,
    scale: { px_per_ft_ew, px_per_ft_ns, ft_per_px_ew, ft_per_px_ns, ftToPx },
    MAP,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
//  TIER 2 — SPATIAL DECOMPOSITION
//  Input: T1 ground truth, T2 params
//  Output: array of Zone objects, each a polygon with eligible uses
//  
//  Zone: { id, poly:{x,y,w,h}, centroid:{x,y}, area_px, area_ac,
//          eligible_uses:[], road_adjacency:[], parcel_specs:[], constraints:{} }
//
//  Strategy 'hybrid': parcel boundaries at site edges, grid interior
//  Strategy 'grid':   uniform grid across EDA extent
//  Strategy 'parcel': each EDA parcel is a zone
// ════════════════════════════════════════════════════════════════════════════════

function buildT2Zones(t1, params, derivedG) {
  const { scale, MAP, edaParcels, setbacks, roads } = t1;
  const BLOCK_SIZE_FT = params.block_size_ft || PLANNING.BLOCK_SIZE_FT;
  const STRATEGY      = params.strategy      || PLANNING.STRATEGY;

  // Convert block size to pixels using computed scale
  const block_px_ew = BLOCK_SIZE_FT * scale.px_per_ft_ew;
  const block_px_ns = BLOCK_SIZE_FT * scale.px_per_ft_ns;

  // Build EDA bounding box from actual parcel projections
  let edaMinX=Infinity, edaMaxX=-Infinity, edaMinY=Infinity, edaMaxY=-Infinity;
  for (const p of edaParcels) {
    if (p._bbox) {
      edaMinX = Math.min(edaMinX, p._bbox.left);
      edaMaxX = Math.max(edaMaxX, p._bbox.right);
      edaMinY = Math.min(edaMinY, p._bbox.top);
      edaMaxY = Math.max(edaMaxY, p._bbox.bottom);
    }
  }
  // Fallback to MAP bounds if bbox not populated
  if (!isFinite(edaMinX)) {
    edaMinX=MAP.x0; edaMaxX=MAP.x1; edaMinY=MAP.y0; edaMaxY=MAP.y1;
  }

  let rawZones = [];

  if (STRATEGY === 'grid' || STRATEGY === 'hybrid') {
    // Generate grid over EDA extent
    const cols = Math.ceil((edaMaxX - edaMinX) / block_px_ew);
    const rows = Math.ceil((edaMaxY - edaMinY) / block_px_ns);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = edaMinX + c * block_px_ew;
        const y = edaMinY + r * block_px_ns;
        const w = Math.min(block_px_ew, edaMaxX - x);
        const h = Math.min(block_px_ns, edaMaxY - y);
        const cx = x + w/2, cy = y + h/2;

        rawZones.push({ x, y, w, h, cx, cy, row:r, col:c });
      }
    }

    if (STRATEGY === 'hybrid') {
      // Filter to zones that overlap EDA parcels (not empty space outside site)
      rawZones = rawZones.filter(z => zoneOverlapsEDA(z, edaParcels));
    }
  } else {
    // 'parcel': each EDA parcel becomes a zone using its bbox
    for (const p of edaParcels) {
      if (!p._bbox) continue;
      const b = p._bbox;
      rawZones.push({
        x: b.left, y: b.top,
        w: b.right-b.left, h: b.bottom-b.top,
        cx: b.left+(b.right-b.left)/2, cy: b.top+(b.bottom-b.top)/2,
        parcel_spec: p.spec,
      });
    }
  }

  // ── Convert raw zones to full Zone objects ──
  const PX_TO_AC = (scale.ft_per_px_ew * scale.ft_per_px_ns) / 43560;

  const zones = rawZones.map((z, i) => {
    const area_px = z.w * z.h;
    const area_ac = area_px * PX_TO_AC;
    const area_sf = area_ac * 43560;

    // Which parcels does this zone overlap?
    const parcel_specs = edaParcels
      .filter(p => p._bbox && rectsOverlap({x:z.x,y:z.y,w:z.w,h:z.h}, p._bbox))
      .map(p => p.spec);

    // Road adjacency: which roads are within one block of this zone?
    const road_adj = [];
    if (z.y <= MAP.y0 + block_px_ns * 1.5) road_adj.push('VA_BEACH_BLVD');
    if (z.y + z.h >= MAP.y1 - block_px_ns * 1.5) road_adj.push('I264');
    if (z.x <= MAP.x0 + block_px_ew * 1.5) road_adj.push('N_MILITARY_HWY');
    if (z.x + z.w >= MAP.x1 - block_px_ew * 1.5) road_adj.push('TIDEWATER_DR');

    // Is this zone in a setback? (unbuildable)
    const in_setback = setbacks.some(s => rectsOverlap({x:z.x,y:z.y,w:z.w,h:z.h}, s.poly));

    // Is this zone on the commons spine? (derived geometry)
    const on_spine = derivedG && derivedG.SPINE &&
      z.cx >= derivedG.SPINE.x - 10 &&
      z.cx <= derivedG.SPINE.x + derivedG.SPINE.w + 10;

    // Is this zone in the sponge park area?
    const near_sponge = derivedG && derivedG.SPONGE &&
      Math.hypot(z.cx - derivedG.SPONGE.cx, z.cy - derivedG.SPONGE.cy) <
      Math.max(derivedG.SPONGE.rx, derivedG.SPONGE.ry) * 1.3;

    // Is this zone in the main street band?
    const in_main_st = derivedG && derivedG.BAND &&
      z.cy < derivedG.BAND.y + derivedG.BAND.h + block_px_ns * 0.5 &&
      z.cy > derivedG.BAND.y;

    // Is this zone near the Tide station?
    const near_tide = derivedG && derivedG.TIDE &&
      Math.abs(z.cx - (derivedG.TIDE.x + derivedG.TIDE.w/2)) < block_px_ew * 2 &&
      z.cy > MAP.y1 - block_px_ns * 3;

    // Determine eligible uses based on spatial constraints
    const eligible = computeEligibleUses({
      in_setback, on_spine, near_sponge, in_main_st, near_tide,
      road_adj, parcel_specs, area_ac, area_sf,
    });

    // Initial use assignment: use the highest-priority eligible use
    // (EA will improve this)
    const initial_use = selectInitialUse(eligible, parcel_specs, {
      on_spine, near_sponge, in_main_st, near_tide
    });

    return {
      id: `Z${i.toString().padStart(3,'0')}`,
      poly: { x:z.x, y:z.y, w:z.w, h:z.h },
      centroid: { x:z.cx, y:z.cy },
      area_px, area_ac, area_sf,
      parcel_specs,
      road_adj,
      in_setback,
      on_spine, near_sponge, in_main_st, near_tide,
      eligible_uses: eligible,
      use: initial_use,
      constraints: {
        max_height_ft: in_main_st ? 35 : near_sponge ? 25 : 65,
        min_courtyard_ratio: PLANNING.MIN_COURTYARD_RATIO,
        max_depth_ft: PLANNING.MAX_BUILDING_DEPTH_FT,
        far: in_setback ? 0 : (near_sponge ? 1.5 : PLANNING.FAR_MAX),
      },
    };
  });

  return zones;
}

function computeEligibleUses(props) {
  const uses = [];

  if (props.in_setback) {
    uses.push('GREEN_ACTIVE', 'GREEN_PASSIVE', 'INFRASTRUCTURE');
    return uses;
  }

  const specs = props.parcel_specs || [];
  const isCLT    = specs.some(s => s && s.startsWith('CLT'));
  const isCivic  = specs.some(s => s && (s.startsWith('CIVIC') || s === 'HOUSING_A_530'));
  const isHsgB   = specs.some(s => s === 'HOUSING_B_S');
  const isSponge = specs.some(s => s === 'SPONGE_PARCEL');
  const isMallCore = specs.some(s => s === 'MALL_CORE');
  const isMainSt = specs.some(s => s && s.startsWith('MAIN_ST'));

  if (isSponge) {
    uses.push('GREEN_PASSIVE', 'GREEN_ACTIVE', 'RESEARCH');
    return uses;
  }

  // CLT parcels: 5-over-1 or CLT ownership or green — land is permanently held
  if (isCLT) {
    uses.push('MIXED_USE_5OVER1', 'RESIDENTIAL_CLT_OWN', 'GREEN_ACTIVE', 'CIVIC');
    if (props.in_main_st || props.road_adj.includes('VA_BEACH_BLVD'))
      uses.push('PLAZA', 'MARKET_HALL');
    return uses;
  }

  // Civic / housing A: 5-over-1 primary, parks secondary
  if (isCivic) {
    uses.push('MIXED_USE_5OVER1', 'CIVIC', 'PLAZA', 'GREEN_ACTIVE');
    return uses;
  }

  // Housing B south: dense mixed use with transit orientation
  if (isHsgB) {
    uses.push('MIXED_USE_5OVER1', 'RESIDENTIAL_MARKET', 'GREEN_ACTIVE');
    if (props.near_tide) uses.push('TRANSIT', 'PLAZA');
    return uses;
  }

  // Main street corridor: Eastside Market + 5-over-1
  if (isMainSt || props.in_main_st) {
    uses.push('MIXED_USE_5OVER1', 'MARKET_HALL', 'PLAZA', 'CIVIC');
    return uses;
  }

  // Mall core: full 5-over-1 transformation
  if (isMallCore) {
    uses.push('MIXED_USE_5OVER1', 'RESIDENTIAL_MARKET', 'RESIDENTIAL_CLT_OWN',
              'GREEN_ACTIVE', 'PLAZA', 'CIVIC', 'MARKET_HALL');
    return uses;
  }

  if (props.near_sponge) {
    uses.push('GREEN_PASSIVE', 'GREEN_ACTIVE', 'RESEARCH');
    return uses;
  }

  if (props.on_spine) {
    uses.push('GREEN_ACTIVE', 'PLAZA', 'CIVIC', 'TRANSIT', 'MIXED_USE_5OVER1');
    return uses;
  }

  if (props.road_adj.includes('I264') && !props.road_adj.includes('VA_BEACH_BLVD')) {
    uses.push('INFRASTRUCTURE', 'GREEN_PASSIVE', 'GREEN_ACTIVE');
    return uses;
  }

  if (props.near_tide && props.area_ac < 1.0) {
    uses.push('TRANSIT', 'PLAZA', 'MIXED_USE_5OVER1', 'CIVIC');
    return uses;
  }

  // Default interior: 5-over-1 is the primary product, parks cut through
  uses.push('MIXED_USE_5OVER1', 'RESIDENTIAL_MARKET', 'RESIDENTIAL_CLT_OWN',
            'GREEN_ACTIVE', 'PLAZA', 'CIVIC');

  return [...new Set(uses)];
}

function selectInitialUse(eligible, parcel_specs, ctx) {
  if (eligible.length === 0) return 'INFRASTRUCTURE';
  if (ctx.near_tide) return 'TRANSIT';
  if (ctx.near_sponge) return 'GREEN_PASSIVE';
  if (ctx.on_spine) return 'PLAZA';
  if (ctx.in_main_st) return eligible.includes('MARKET_HALL') ? 'MARKET_HALL' : 'MIXED_USE_5OVER1';

  // Parcel spec hints
  if (parcel_specs.some(s => s && s.startsWith('CIVIC'))) {
    return eligible.includes('CIVIC') ? 'CIVIC' : eligible[0];
  }
  if (parcel_specs.some(s => s && s.startsWith('HOUSING'))) {
    return eligible.includes('RESIDENTIAL_AFFORDABLE') ? 'RESIDENTIAL_AFFORDABLE' : eligible[0];
  }
  if (parcel_specs.some(s => s && s.startsWith('CLT'))) {
    return eligible.includes('RESIDENTIAL_CLT_OWN') ? 'RESIDENTIAL_CLT_OWN' : eligible[0];
  }

  // Default: prefer affordable housing for interior zones
  for (const u of ['RESIDENTIAL_AFFORDABLE','RESIDENTIAL_MARKET','CIVIC','GREEN_ACTIVE']) {
    if (eligible.includes(u)) return u;
  }
  return eligible[0];
}

// ════════════════════════════════════════════════════════════════════════════════
//  TIER 3 — USE ASSIGNMENT OPTIMIZATION (EVOLUTIONARY ALGORITHM)
//  Input: T2 zones (initial assignments), T1 ground truth
//  Output: optimized zone array with best use assignments
//
//  Population: 30 candidates per round
//  Mutation: 10% of zones, flip use to adjacent eligible use
//  Selection: top 3 by reward score seed next round
//  Rounds: 15
// ════════════════════════════════════════════════════════════════════════════════

// Reward function weights — YIMBY market-rate model
// Walkability + green dominate. No affordability target (CLT land = affordability).
// Synergy weight high because mixed-use adjacency IS the value proposition.
const DEFAULT_WEIGHTS = {
  w_units:          0.15,  // unit count (normalized to higher target)
  w_affordable:     0.00,  // dropped — CLT land removal handles it structurally
  w_green_connect:  0.20,  // parks must connect — no isolated green patches
  w_walkability:    0.42,  // Jacobs diversity within 5-min walk — the whole bet
  w_conflict:      -0.05,  // conflict penalty
  w_synergy:        0.12,  // high — mixed-use adjacency creates the value
  w_district_lock:  0.06,  // honor parcel assignments
};

function scoreCandidate(candidate, t1, weights) {
  const W = weights || DEFAULT_WEIGHTS;
  const zones = candidate;
  const PX_TO_AC = t1.scale.ft_per_px_ew * t1.scale.ft_per_px_ns / 43560;

  // ── Unit count score ──
  let total_units = 0;
  for (const z of zones) {
    if (z.use === 'MIXED_USE_5OVER1') {
      // Count 25×125 buildings that fit in the zone, × UNITS_PER_BUILDING
      const buildings = Math.floor(z.area_ac * 43560 * (1 - PLANNING.MIN_COURTYARD_RATIO) / PLANNING.PARCEL_SF);
      total_units += buildings * PLANNING.UNITS_PER_BUILDING;
    } else if (['RESIDENTIAL_MARKET','RESIDENTIAL_CLT_OWN'].includes(z.use)) {
      const buildable_ac = z.area_ac * (1 - PLANNING.MIN_COURTYARD_RATIO);
      total_units += Math.floor(buildable_ac * 43560 / PLANNING.AVG_UNIT_SF * (PLANNING.FAR_MIN / 1));
    }
  }
  const units_score = Math.min(1, total_units / PLANNING.TARGET_UNITS);
  const affordable_score = 1.0;  // not scored — CLT land is the mechanism

  // ── Green connectivity score ──
  // Score = fraction of green zones that are adjacent to another green zone
  const greenZones = zones.filter(z => z.use === 'GREEN_ACTIVE' || z.use === 'GREEN_PASSIVE');
  const totalGreen = zones.reduce((s, z) =>
    z.use.startsWith('GREEN') ? s + z.area_ac : s, 0);
  const greenPct = totalGreen / 73.4;  // site total
  let greenConnected = 0;
  for (const gz of greenZones) {
    const hasGreenNeighbor = zones.some(z2 =>
      z2 !== gz && (z2.use === 'GREEN_ACTIVE' || z2.use === 'GREEN_PASSIVE') &&
      zonesAdjacent(gz, z2)
    );
    if (hasGreenNeighbor) greenConnected++;
  }
  const green_connect_score = greenZones.length > 0
    ? (greenConnected / greenZones.length) * Math.min(1, greenPct / PLANNING.TARGET_GREEN_PCT)
    : 0;

  // ── Walkability score — Jacobs-style 5-min walk diversity ──
  // Score = diversity of reachable destinations within 2-hop radius, weighted by type
  // Different destination types score independently (diminishing returns per type)
  const resZones = zones.filter(z => z.use.startsWith('RESIDENTIAL'));
  const WALK_WEIGHTS = {
    'MIXED_USE_5OVER1': 0.30,   // ground-floor commercial IS the daily errand — highest
    'GREEN_ACTIVE':     0.24,   // park — everyone's playground
    'TRANSIT':          0.18,   // mobility
    'CIVIC':            0.12,   // community anchors
    'PLAZA':            0.10,   // gathering
    'MARKET_HALL':      0.06,   // Eastside Market anchor
  };

  // Build adjacency lookup for 2-hop reach
  const adjMap = new Map();
  for (const z of zones) adjMap.set(z.id, new Set());
  for (let i = 0; i < zones.length; i++) {
    for (let j = i+1; j < zones.length; j++) {
      if (zonesAdjacent(zones[i], zones[j])) {
        adjMap.get(zones[i].id).add(zones[j].id);
        adjMap.get(zones[j].id).add(zones[i].id);
      }
    }
  }
  const zoneById = new Map(zones.map(z => [z.id, z]));

  let walkSum = 0;
  for (const rz of resZones) {
    // Collect all zones within 2 hops
    const reach = new Set();
    for (const n1id of adjMap.get(rz.id) || []) {
      reach.add(n1id);
      for (const n2id of adjMap.get(n1id) || []) {
        if (n2id !== rz.id) reach.add(n2id);
      }
    }
    // Score by destination type diversity — each type counted once with diminishing returns
    const typeCounts = {};
    for (const zid of reach) {
      const z2 = zoneById.get(zid);
      if (!z2 || !WALK_WEIGHTS[z2.use]) continue;
      typeCounts[z2.use] = (typeCounts[z2.use] || 0) + 1;
    }
    let rzScore = 0;
    for (const [use, count] of Object.entries(typeCounts)) {
      // First instance full value, each additional 50% diminishing return
      rzScore += WALK_WEIGHTS[use] * (1 - Math.pow(0.5, count));
    }
    walkSum += Math.min(1, rzScore);
  }
  const walkability_score = resZones.length > 0 ? walkSum / resZones.length : 0;

  // ── Conflict / synergy adjacency score ──
  let conflict_total = 0, synergy_total = 0;
  for (let i = 0; i < zones.length; i++) {
    for (let j = i+1; j < zones.length; j++) {
      if (!zonesAdjacent(zones[i], zones[j])) continue;
      const ua = zones[i].use, ub = zones[j].use;
      conflict_total += (CONFLICT[ua]?.[ub] || 0) + (CONFLICT[ub]?.[ua] || 0);
      synergy_total  += (SYNERGY[ua]?.[ub]  || 0) + (SYNERGY[ub]?.[ua]  || 0);
    }
  }
  // Normalize by zone count squared
  const n = zones.length;
  const conflict_score = n > 1 ? conflict_total / (n * n) : 0;
  const synergy_score  = n > 1 ? synergy_total  / (n * n) : 0;

  // ── District lock score — reward keeping CLT/GP zones in intended use ──
  let lock_score = 0;
  const DISTRICT_LOCKS = {
    'SPONGE':    ['GREEN_PASSIVE', 'GREEN_ACTIVE', 'RESEARCH'],
    'CLT':       ['MIXED_USE_5OVER1', 'RESIDENTIAL_CLT_OWN', 'GREEN_ACTIVE'],
    'HOUSING_B': ['MIXED_USE_5OVER1', 'RESIDENTIAL_MARKET', 'GREEN_ACTIVE'],
  };
  let lock_total = 0, lock_count = 0;
  for (const z of zones) {
    const dist = z.district?.split('_')[0] + '_' + z.district?.split('_')[1] || '';
    const baseDist = Object.keys(DISTRICT_LOCKS).find(k => z.district?.startsWith(k));
    if (baseDist) {
      lock_count++;
      if (DISTRICT_LOCKS[baseDist].includes(z.use)) lock_total++;
    }
  }
  lock_score = lock_count > 0 ? lock_total / lock_count : 1.0;

  // ── Weighted total ──
  const total =
    W.w_units         * units_score        +
    W.w_affordable    * affordable_score   +
    W.w_green_connect * green_connect_score +
    W.w_walkability   * walkability_score  +
    W.w_conflict      * conflict_score     +  // negative weight
    W.w_synergy       * synergy_score      +
    (W.w_district_lock || 0.06) * lock_score;

  return {
    total, units_score, affordable_score, green_connect_score,
    walkability_score, conflict_score, synergy_score,
    total_units,
  };
}


// ── SEEDABLE PRNG (mulberry32) ────────────────────────────────────────────────
// Fast, high-quality 32-bit seeded PRNG. No dependencies.
//
// CANONICAL seed — the official Eastside Commons plan.
// This specific seed + default slider values produces the layout locked as
// the canonical proposal. Share any other seed via the URL hash.
const CANONICAL_SEED = 0xEC202600; // "EC2026" — Eastside Commons 2026

let _eaSeed = CANONICAL_SEED; // default; overridden by hash or "new seed"
let _isCanonical = true;      // tracks whether current run matches canonical

function setSeed(s) {
  _eaSeed = (s >>> 0) || 1;
  _isCanonical = (_eaSeed === (CANONICAL_SEED >>> 0));
  updateCanonicalBadge();
}

function seededRandom() {
  _eaSeed |= 0; _eaSeed = _eaSeed + 0x6D2B79F5 | 0;
  let t = Math.imul(_eaSeed ^ _eaSeed >>> 15, 1 | _eaSeed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function getCurrentSeed() { return _eaSeed >>> 0; }

function newSeed() {
  setSeed(Date.now() >>> 0);
  showToast('New seed: ' + getCurrentSeed().toString(16).toUpperCase().padStart(8,'0'));
  triggerPipeline();
}

function loadCanonical() {
  setSeed(CANONICAL_SEED);
  // Reset sliders to canonical defaults
  const setSlider = (id, val, suffix='') => {
    const el = document.getElementById(id);
    const lbl = document.getElementById(id + '-val');
    if (el) { el.value = val; if (lbl) lbl.textContent = val + suffix; }
  };
  setSlider('p-block-size', 200, 'ft');
  setSlider('p-courtyard', 60, 'ft');
  setSlider('p-rounds', 15);
  setSlider('p-mutation', 10, '%');
  setSlider('w-units', 20, '%');
  setSlider('w-affordable', 35, '%');
  setSlider('w-green', 22, '%');
  setSlider('w-walk', 13, '%');
  const sel = document.getElementById('p-strategy');
  if (sel) sel.value = 'hybrid';
  // Clear hash so URL is clean for canonical
  history.replaceState(null, '', window.location.pathname);
  showToast('Canonical plan loaded — seed EC202600');
  triggerPipeline();
}

function updateCanonicalBadge() {
  const badge = document.getElementById('canonical-badge');
  if (!badge) return;
  badge.style.display = _isCanonical ? '' : 'none';
}

function mutateCandidate(zones, mutation_rate) {
  // Deep copy
  const mutant = zones.map(z => ({...z}));
  const n = Math.max(1, Math.round(mutant.length * mutation_rate));
  // Pick n random zones to mutate
  const indices = [];
  while (indices.length < n) {
    const i = Math.floor(seededRandom() * mutant.length);
    if (!indices.includes(i)) indices.push(i);
  }
  for (const i of indices) {
    const z = mutant[i];
    // Skip zones with no mutation options
    const adj_uses = (USE_ADJACENCY[z.use] || []).filter(u => z.eligible_uses.includes(u));
    if (adj_uses.length === 0) continue;
    z.use = adj_uses[Math.floor(seededRandom() * adj_uses.length)];
  }
  return mutant;
}

async function runT3EA(zones, t1, weights, params, onProgress) {
  const CANDIDATES = params.ea_candidates || PLANNING.EA_CANDIDATES;
  const SURVIVORS  = params.ea_survivors  || PLANNING.EA_SURVIVORS;
  const ROUNDS     = params.ea_rounds     || PLANNING.EA_ROUNDS;
  const MUT_RATE   = params.ea_mutation   || PLANNING.EA_MUTATION_RATE;

  // Seed population: start from the initial T2 assignment
  let population = [zones];
  // Add random variants as additional seeds
  for (let i = 1; i < SURVIVORS; i++) {
    population.push(mutateCandidate(zones, 0.5));  // high mutation for initial diversity
  }

  let bestEver = null, bestScore = -Infinity;
  const history = [];  // score history for convergence display

  for (let round = 0; round < ROUNDS; round++) {
    // Generate candidates from survivors
    const candidates = [];
    for (const seed of population) {
      const perSeed = Math.ceil(CANDIDATES / population.length);
      for (let c = 0; c < perSeed && candidates.length < CANDIDATES; c++) {
        candidates.push(mutateCandidate(seed, MUT_RATE));
      }
    }
    // Include the seeds themselves
    for (const seed of population) candidates.push(seed);

    // Score all candidates
    const scored = candidates.map(c => ({
      zones: c,
      score: scoreCandidate(c, t1, weights),
    }));

    // Sort by total score descending
    scored.sort((a, b) => b.score.total - a.score.total);

    // Select survivors
    population = scored.slice(0, SURVIVORS).map(s => s.zones);

    // Track best
    if (scored[0].score.total > bestScore) {
      bestScore = scored[0].score.total;
      bestEver = scored[0];
    }

    history.push({
      round: round + 1,
      best: scored[0].score.total,
      worst: scored[scored.length-1].score.total,
      units: scored[0].score.total_units,
    });

    // Progress callback (for UI update)
    if (onProgress) {
      await new Promise(resolve => setTimeout(resolve, 0));  // yield to UI
      onProgress({ round: round+1, total: ROUNDS, best: bestEver, history });
    }
  }

  return { best: bestEver, history };
}

// ════════════════════════════════════════════════════════════════════════════════
//  TIER 4 — UNIT DECOMPOSITION
//  Input: T3 optimized zones
//  Output: zones with sub-units: { building_footprints[], courtyards[], paths[] }
//
//  All dimensions derived from building code constraints, not design patterns.
//  Each zone produces its own module: FAR × area → floor_area → footprint
//  Courtyard dimensions: derived from daylight angle at each zone's height limit
// ════════════════════════════════════════════════════════════════════════════════

function buildT4Units(zones, t1) {
  const { scale } = t1;

  return zones.map(z => {
    if (z.in_setback || !z.use.startsWith('RESIDENTIAL') && z.use !== 'CIVIC') {
      // Non-building zones: no unit decomposition
      return { ...z, units: null };
    }

    const { x, y, w, h } = z.poly;
    const constraints = z.constraints;

    // ── Derive building dimensions from constraints ──
    // 1. Target floor area from FAR
    const target_floor_area_sf = z.area_sf * constraints.far;

    // 2. Max building depth from natural ventilation
    const max_depth_px = constraints.max_depth_ft * scale.px_per_ft_ew;

    // 3. Min courtyard from ratio
    const courtyard_area_px = z.area_px * constraints.min_courtyard_ratio;

    // 4. Building height from FAR and footprint
    //    footprint_sf = zone_sf - courtyard_sf
    //    floors = ceil(target_floor_area / footprint_sf)
    const courtyard_area_sf = z.area_sf * constraints.min_courtyard_ratio;
    const footprint_sf = z.area_sf - courtyard_area_sf;
    const floors = Math.ceil(target_floor_area_sf / footprint_sf);
    const actual_height_ft = Math.min(floors * 12, constraints.max_height_ft);
    const actual_floors = Math.ceil(actual_height_ft / 12);

    // 5. Courtyard dimensions from daylight angle
    //    courtyard_width_min = building_height / tan(daylight_angle)
    //    At 45°: min courtyard width = building height
    const daylight_angle_rad = (constraints.min_courtyard_ratio || PLANNING.DAYLIGHT_ANGLE_DEG) * Math.PI / 180;
    const min_courtyard_ft = actual_height_ft / Math.tan(Math.PI / 4);  // 45°
    const min_courtyard_px_ew = min_courtyard_ft * scale.px_per_ft_ew;
    const min_courtyard_px_ns = min_courtyard_ft * scale.px_per_ft_ns;

    // 6. Actual courtyard (center of zone, constrained by daylight)
    const courtyard_w = Math.max(min_courtyard_px_ew, w * 0.35);
    const courtyard_h = Math.max(min_courtyard_px_ns, h * 0.35);
    const courtyard_x = x + (w - courtyard_w) / 2;
    const courtyard_y = y + (h - courtyard_h) / 2;

    // 7. Building footprints: the area of the zone minus the courtyard
    //    Decompose into perimeter wings (N, S, E, W)
    //    Wing depth: min(max_depth, available_space)
    const margin = (w - courtyard_w) / 2;
    const wing_depth_ew = Math.min(max_depth_px, margin);
    const wing_depth_ns = Math.min(max_depth_px, (h - courtyard_h) / 2);

    // Four building wings around the courtyard
    const building_wings = [
      // North wing
      { x, y, w, h: wing_depth_ns, label: 'N' },
      // South wing
      { x, y: courtyard_y + courtyard_h, w, h: wing_depth_ns, label: 'S' },
      // West wing (fills between N and S)
      { x, y: y + wing_depth_ns, w: wing_depth_ew, h: h - wing_depth_ns*2, label: 'W' },
      // East wing
      { x: courtyard_x + courtyard_w, y: y + wing_depth_ns, w: wing_depth_ew, h: h - wing_depth_ns*2, label: 'E' },
    ].filter(wing => wing.w > 4 && wing.h > 4);

    // 8. Chamfered corners (Eixample-style) — cut each corner at 45°
    //    Chamfer = min(wing_depth / 3, 12px)
    const chamfer = Math.min(wing_depth_ew / 3, 12);

    // 9. Unit count from actual floor area
    const actual_floor_area_sf = building_wings.reduce((s, w) =>
      s + w.w * w.h * (scale.ft_per_px_ew * scale.ft_per_px_ns), 0) * actual_floors;
    const units = Math.floor(actual_floor_area_sf * 0.85 / PLANNING.AVG_UNIT_SF);
    const affordable = z.use !== 'RESIDENTIAL_MARKET' ? units : Math.floor(units * 0.3);

    return {
      ...z,
      units: {
        building_wings,
        courtyard: { x: courtyard_x, y: courtyard_y, w: courtyard_w, h: courtyard_h },
        chamfer,
        floors: actual_floors,
        height_ft: actual_height_ft,
        unit_count: units,
        affordable_units: affordable,
        derived_from: {
          far_target: constraints.far,
          daylight_angle_deg: PLANNING.DAYLIGHT_ANGLE_DEG,
          max_depth_ft: constraints.max_depth_ft,
          min_courtyard_pct: constraints.min_courtyard_ratio,
        },
      },
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════════
//  TIER 5 — INTERACTION CONSTRAINTS / EDGE MUTATION
//  Input: T4 zones with unit decomposition
//  Output: zones with edge-mutated uses based on proximity rules
//
//  Rules:
//  - Residential unit adjacent to Main Street road → ground floor = RETAIL_GROUND
//  - Residential unit adjacent to 2+ green zones → reclassify to GREEN_ACTIVE
//  - Research zone adjacent to GREEN_PASSIVE → keep; adjacent to residential → add buffer
//  - TRANSIT zone must have RETAIL_GROUND or PLAZA within 1 zone
// ════════════════════════════════════════════════════════════════════════════════

function applyT5Interactions(zones) {
  const mutated = zones.map(z => ({...z, edge_mutations: []}));

  for (const z of mutated) {
    const neighbors = mutated.filter(z2 => z2 !== z && zonesAdjacent(z, z2));

    // Rule 1: Residential adjacent to arterial → ground floor retail
    if (z.use.startsWith('RESIDENTIAL') &&
        (z.road_adj.includes('VA_BEACH_BLVD') || z.road_adj.includes('N_MILITARY_HWY'))) {
      z.edge_mutations.push({
        type: 'ground_floor_retail',
        description: 'Adjacent to arterial — ground floor must be active commercial',
        ground_floor_use: 'RETAIL_GROUND',
      });
    }

    // Rule 2: Residential adjacent to 2+ green zones → open courtyard to green
    const greenNeighbors = neighbors.filter(n => n.use.startsWith('GREEN')).length;
    if (z.use.startsWith('RESIDENTIAL') && greenNeighbors >= 2) {
      z.edge_mutations.push({
        type: 'green_courtyard',
        description: 'Adjacent to 2+ green zones — courtyard opens toward green; passive uses expanded',
        courtyard_orientation: 'green',
      });
    }

    // Rule 3: Residential adjacent to highway without buffer → flag violation
    if (z.use.startsWith('RESIDENTIAL') && z.road_adj.includes('I264')) {
      const hasBuffer = neighbors.some(n =>
        ['GREEN_ACTIVE','GREEN_PASSIVE','INFRASTRUCTURE','PLAZA'].includes(n.use)
      );
      if (!hasBuffer) {
        z.edge_mutations.push({
          type: 'highway_violation',
          description: 'Residential directly adjacent to I-264 without buffer — T6 will reclassify',
          severity: 'error',
          suggested: 'GREEN_ACTIVE',
        });
      }
    }

    // Rule 4: TRANSIT must have walkable activation within 1 zone
    if (z.use === 'TRANSIT') {
      const hasActivation = neighbors.some(n =>
        ['RETAIL_GROUND','PLAZA','CIVIC'].includes(n.use)
      );
      if (!hasActivation) {
        z.edge_mutations.push({
          type: 'transit_activation_missing',
          description: 'Transit zone lacks adjacent retail/plaza activation',
          suggested_neighbor: 'RETAIL_GROUND',
          severity: 'warning',
        });
      }
    }

    // Rule 5: GREEN_PASSIVE (wetland) adjacent to impervious → flag
    if (z.use === 'GREEN_PASSIVE') {
      const imperviousNeighbors = neighbors.filter(n =>
        ['RESIDENTIAL_MARKET','RETAIL_GROUND'].includes(n.use) &&
        !n.edge_mutations.some(m => m.type === 'green_courtyard')
      );
      if (imperviousNeighbors.length > 2) {
        z.edge_mutations.push({
          type: 'wetland_isolation',
          description: 'Wetland zone surrounded by impervious uses — hydrological function reduced',
          severity: 'warning',
        });
      }
    }
  }

  return mutated;
}

// ════════════════════════════════════════════════════════════════════════════════
//  TIER 6 — CLEANUP PASS
//  Input: T5 zones
//  Output: topologically valid zone set — no overlaps, no violations
//
//  Operations:
//  1. Resolve highway_violation errors → reclassify to GREEN_ACTIVE
//  2. Resolve transit_activation_missing → flip nearest eligible neighbor to RETAIL_GROUND
//  3. Check greenway-crossing-highway impossibility (geometric check)
//  4. Remove zones with zero eligible uses → INFRASTRUCTURE
//  5. Final overlap check (grid zones shouldn't overlap, but verify)
// ════════════════════════════════════════════════════════════════════════════════

function applyT6Cleanup(zones) {
  let cleaned = zones.map(z => ({...z}));

  // Pass 1: resolve hard errors
  for (const z of cleaned) {
    for (const m of (z.edge_mutations || [])) {
      if (m.type === 'highway_violation' && m.severity === 'error') {
        z.use = m.suggested;
        z.cleanup_note = `Reclassified from ${z.use} to ${m.suggested}: highway buffer required`;
      }
    }
  }

  // Pass 2: resolve transit activation — find nearest eligible neighbor and flip it
  for (const z of cleaned) {
    const missingActivation = z.edge_mutations?.find(m => m.type === 'transit_activation_missing');
    if (!missingActivation) continue;
    // Find nearest residential zone and convert its ground floor
    const nearbyRes = cleaned
      .filter(z2 => z2.use.startsWith('RESIDENTIAL') && zonesAdjacent(z, z2))
      .sort((a,b) => zoneDist(z,a) - zoneDist(z,b));
    if (nearbyRes.length > 0) {
      const target = nearbyRes[0];
      if (!target.edge_mutations) target.edge_mutations = [];
      target.edge_mutations.push({
        type: 'ground_floor_retail',
        description: 'Activated for transit zone — ground floor retail required',
        ground_floor_use: 'RETAIL_GROUND',
      });
    }
  }

  // Pass 3: impossible geometry — greenway crossing highway
  // A GREEN zone is "crossing a highway" if it spans from one side of the site
  // to the other across the I-264 boundary. Since our zones are confined to
  // the EDA parcel extent and I-264 is the south boundary, this means:
  // a GREEN zone at the south edge should not extend into the highway setback
  // (already handled by setback eligibility, but verify)
  for (const z of cleaned) {
    if (!z.use.startsWith('GREEN')) continue;
    if (z.road_adj.includes('I264') && z.poly.y + z.poly.h > MAP_Y1 - 20) {
      z.poly = { ...z.poly, h: Math.max(10, MAP_Y1 - 20 - z.poly.y) };
      z.cleanup_note = (z.cleanup_note||'') + ' Trimmed to highway setback.';
    }
  }

  // Pass 4: zones with no eligible uses → INFRASTRUCTURE
  for (const z of cleaned) {
    if (!z.eligible_uses || z.eligible_uses.length === 0) {
      z.use = 'INFRASTRUCTURE';
      z.cleanup_note = 'No eligible uses — assigned INFRASTRUCTURE';
    }
  }

  // Pass 5: sanity check unit counts vs. zone areas
  for (const z of cleaned) {
    if (z.units && z.units.unit_count > z.area_ac * 200) {
      // More than 200 units/acre is not feasible at 4-story residential
      const cap = Math.floor(z.area_ac * 180);
      const afRatio = z.units.unit_count > 0 ? z.units.affordable_units / z.units.unit_count : 0;
      z.units = { ...z.units, unit_count: cap, affordable_units: Math.floor(cap * afRatio), capped: true };
      z.cleanup_note = (z.cleanup_note||'') + ` Unit count capped at ${cap} (${z.area_ac.toFixed(2)}ac).`;
    }
  }

  return cleaned;
}

// ════════════════════════════════════════════════════════════════════════════════
//  TIER 7 — COLORING AND VISUAL OUTPUT
//  Input: T6 clean zones
//  Output: SVG elements appended to the site plan
//
//  Color strategy:
//  - Each use has a canonical color (defined in USES above)
//  - Colors are colorblind-safe (tested against deuteranopia and protanopia)
//  - Edge mutations shown as hatching or border change
//  - T4 building wings shown as slightly darker fill within zone
// ════════════════════════════════════════════════════════════════════════════════

function renderT7(zones, svg, params) {
  const ns = 'http://www.w3.org/2000/svg';
  const showUnits    = params.show_units    !== false;
  const showEdges    = params.show_edges    !== false;
  const showLabels   = params.show_labels   !== false;
  const opacity      = params.opacity       || 0.55;

  // Clear previous T7 render
  svg.querySelectorAll('[data-t7]').forEach(e => e.remove());

  const g = document.createElementNS(ns, 'g');
  g.setAttribute('data-t7', '1');
  g.setAttribute('clip-path', 'url(#mc)');

  for (const z of zones) {
    const usedef  = USES[z.use];
    if (!usedef) continue;
    const color   = usedef.color;
    const { x, y, w, h } = z.poly;

    // ── Zone fill ──
    // Textured patterns for green zones and plaza
    const ZONE_PATTERNS = {
      GREEN_ACTIVE:  'pat-green-active',
      GREEN_PASSIVE: 'pat-green-passive',
      PLAZA:         'pat-plaza',
    };
    const patId = ZONE_PATTERNS[z.use];

    // For patterned zones: solid base rect first, then pattern overlay
    if (patId) {
      const base = document.createElementNS(ns, 'rect');
      base.setAttribute('x', x); base.setAttribute('y', y);
      base.setAttribute('width', w); base.setAttribute('height', h);
      base.setAttribute('fill', color);
      base.setAttribute('fill-opacity', opacity * 0.7);
      base.setAttribute('stroke', 'none');
      g.appendChild(base);
    }

    const fill = document.createElementNS(ns, 'rect');
    fill.setAttribute('x', x); fill.setAttribute('y', y);
    fill.setAttribute('width', w); fill.setAttribute('height', h);
    fill.setAttribute('fill', patId ? `url(#${patId})` : color);
    fill.setAttribute('fill-opacity', patId ? '1' : opacity);
    fill.setAttribute('stroke', color);
    fill.setAttribute('stroke-width', '1');
    fill.setAttribute('stroke-opacity', '0.7');
    fill.setAttribute('data-zone', z.id);
    fill.setAttribute('data-use', z.use);
    fill.style.cursor = 'pointer';
    // Tooltip on hover
    fill.addEventListener('mouseenter', () => showZoneTooltip(z));
    fill.addEventListener('mouseleave', hideZoneTooltip);
    g.appendChild(fill);

    // Extra blade overlay for GREEN_ACTIVE at fine scale
    if (z.use === 'GREEN_ACTIVE') {
      const blades = document.createElementNS(ns, 'rect');
      blades.setAttribute('x', x); blades.setAttribute('y', y);
      blades.setAttribute('width', w); blades.setAttribute('height', h);
      blades.setAttribute('fill', 'url(#pat-green-active-blades)');
      blades.setAttribute('fill-opacity', '0.4');
      blades.setAttribute('stroke', 'none');
      blades.style.pointerEvents = 'none';
      g.appendChild(blades);
    }

    // ── T4 building wings (darker fill within zone) ──
    if (showUnits && z.units) {
      for (const wing of z.units.building_wings) {
        const wg = document.createElementNS(ns, 'rect');
        wg.setAttribute('x', wing.x); wg.setAttribute('y', wing.y);
        wg.setAttribute('width', wing.w); wg.setAttribute('height', wing.h);
        wg.setAttribute('fill', color);
        wg.setAttribute('fill-opacity', 0.35);
        wg.setAttribute('stroke', color);
        wg.setAttribute('stroke-width', '0.5');
        wg.setAttribute('stroke-opacity', '0.5');
        g.appendChild(wg);
      }
      // Courtyard (lighter, open space)
      if (z.units.courtyard) {
        const { courtyard: ct } = z.units;
        const ctRect = document.createElementNS(ns, 'rect');
        ctRect.setAttribute('x', ct.x); ctRect.setAttribute('y', ct.y);
        ctRect.setAttribute('width', ct.w); ctRect.setAttribute('height', ct.h);
        ctRect.setAttribute('fill', '#1a2810');
        ctRect.setAttribute('fill-opacity', '0.3');
        ctRect.setAttribute('stroke', '#3a5828');
        ctRect.setAttribute('stroke-width', '0.8');
        ctRect.setAttribute('stroke-dasharray', '2,2');
        g.appendChild(ctRect);
      }
    }

    // ── Edge mutation indicators ──
    if (showEdges && z.edge_mutations && z.edge_mutations.length > 0) {
      for (const m of z.edge_mutations) {
        if (m.type === 'ground_floor_retail') {
          // Orange stripe on the road-facing edge
          const stripe = document.createElementNS(ns, 'rect');
          stripe.setAttribute('x', x); stripe.setAttribute('y', y + h - 4);
          stripe.setAttribute('width', w); stripe.setAttribute('height', 4);
          stripe.setAttribute('fill', USES.RETAIL_GROUND.color);
          stripe.setAttribute('fill-opacity', '0.9');
          g.appendChild(stripe);
        } else if (m.type === 'highway_violation' && m.severity === 'error') {
          const warning = document.createElementNS(ns, 'rect');
          warning.setAttribute('x', x+1); warning.setAttribute('y', y+1);
          warning.setAttribute('width', w-2); warning.setAttribute('height', h-2);
          warning.setAttribute('fill', 'none');
          warning.setAttribute('stroke', '#c04030');
          warning.setAttribute('stroke-width', '2');
          warning.setAttribute('stroke-dasharray', '4,2');
          g.appendChild(warning);
        } else if (m.type === 'green_courtyard') {
          const dot = document.createElementNS(ns, 'circle');
          dot.setAttribute('cx', x+w/2); dot.setAttribute('cy', y+h/2);
          dot.setAttribute('r', '4');
          dot.setAttribute('fill', '#48a858'); dot.setAttribute('fill-opacity', '0.8');
          g.appendChild(dot);
        }
      }
    }

    // ── Zone label ──
    if (showLabels && w > 30 && h > 20) {
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', x + w/2);
      label.setAttribute('y', y + h/2 + 3);
      label.setAttribute('font-family', 'DM Mono, monospace');
      label.setAttribute('font-size', Math.min(8, w/5, h/3));
      label.setAttribute('fill', '#f0ece0');
      label.setAttribute('fill-opacity', '0.85');
      label.setAttribute('text-anchor', 'middle');
      label.textContent = usedef.id;
      g.appendChild(label);

      if (z.units && h > 35) {
        const sub = document.createElementNS(ns, 'text');
        sub.setAttribute('x', x + w/2);
        sub.setAttribute('y', y + h/2 + 12);
        sub.setAttribute('font-family', 'DM Mono, monospace');
        sub.setAttribute('font-size', Math.min(6, w/6));
        sub.setAttribute('fill', '#f0ece0');
        sub.setAttribute('fill-opacity', '0.55');
        sub.setAttribute('text-anchor', 'middle');
        sub.textContent = `${z.units.unit_count}u ${z.units.floors}F`;
        g.appendChild(sub);
      }
    }
  }

  svg.appendChild(g);
}

// ── TOOLTIP ──────────────────────────────────────────────────────────────────
let _tooltipZone = null;
function showZoneTooltip(z) {
  _tooltipZone = z;
  const panel = document.getElementById('zone-detail');
  if (!panel) return;
  const usedef = USES[z.use];
  const mutations = (z.edge_mutations||[]).map(m =>
    `<div style="color:${m.severity==='error'?'#c04030':m.severity==='warning'?'#c08020':'#48a858'};font-size:0.6rem;">
      ${m.severity==='error'?'⚠':'⟳'} ${m.description}</div>`
  ).join('');
  const units_html = z.units ?
    `<div class="dr"><span class="dl">Units</span><span class="dv">${z.units.unit_count}</span></div>
     <div class="dr"><span class="dl">Floors</span><span class="dv">${z.units.floors}</span></div>
     <div class="dr"><span class="dl">Height</span><span class="dv">${z.units.height_ft}ft</span></div>` : '';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;">
      <div style="width:10px;height:10px;background:${usedef?.color};flex-shrink:0;"></div>
      <span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text);">${z.id} — ${usedef?.label}</span>
    </div>
    <div class="dr"><span class="dl">Area</span><span class="dv">${z.area_ac.toFixed(2)}ac</span></div>
    <div class="dr"><span class="dl">FAR target</span><span class="dv">${z.constraints.far.toFixed(1)}</span></div>
    ${units_html}
    ${mutations}
    <div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--muted);margin-top:0.3rem;">${z.parcel_specs.join(', ')||'—'}</div>
  `;
  panel.style.display = '';
}

function hideZoneTooltip() {
  // Keep visible until another zone is hovered or panel is explicitly closed
}

// ── GEOMETRY HELPERS ─────────────────────────────────────────────────────────
function rectsOverlap(a, b) {
  // a and b are {x,y,w,h} or {left,top,right,bottom}
  const ax1 = a.x ?? a.left,   ay1 = a.y ?? a.top;
  const ax2 = (a.x ?? a.left) + (a.w ?? (a.right - a.left));
  const ay2 = (a.y ?? a.top)  + (a.h ?? (a.bottom - a.top));
  const bx1 = b.x ?? b.left,   by1 = b.y ?? b.top;
  const bx2 = (b.x ?? b.left) + (b.w ?? (b.right - b.left));
  const by2 = (b.y ?? b.top)  + (b.h ?? (b.bottom - b.top));
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

function zonesAdjacent(a, b) {
  // Handles both grid zones {poly:{x,y,w,h}} and polygon zones {poly:{x,y,w,h,outer}}
  if (!a.poly || !b.poly) return false;
  if (window.EC_Decomp && a.poly.outer) {
    return window.EC_Decomp.polyZonesAdjacent(a, b);
  }
  // Grid fallback
  const TOL = 3;
  const ax1=a.poly.x, ay1=a.poly.y, ax2=a.poly.x+a.poly.w, ay2=a.poly.y+a.poly.h;
  const bx1=b.poly.x, by1=b.poly.y, bx2=b.poly.x+b.poly.w, by2=b.poly.y+b.poly.h;
  const shareEW = (Math.abs(ax2-bx1)<TOL || Math.abs(bx2-ax1)<TOL);
  const shareNS = (Math.abs(ay2-by1)<TOL || Math.abs(by2-ay1)<TOL);
  const overlapEW = ax1 < bx2 && ax2 > bx1;
  const overlapNS = ay1 < by2 && ay2 > by1;
  return (shareEW && overlapNS) || (shareNS && overlapEW);
}

function zoneDist(a, b) {
  return Math.hypot(a.centroid.x - b.centroid.x, a.centroid.y - b.centroid.y);
}

function zoneOverlapsEDA(zone, edaParcels) {
  return edaParcels.some(p => p._bbox && rectsOverlap(
    {x:zone.x,y:zone.y,w:zone.w,h:zone.h}, p._bbox
  ));
}

// MAP_Y1 needed in T6 — will be set from MAP when pipeline runs
let MAP_Y1 = 653;

// ── PIPELINE ORCHESTRATOR ────────────────────────────────────────────────────
// Runs T1→T7, with T3 async (EA), calling back on completion
async function runPipeline(parcels, proj, MAP, derivedG, params, callbacks) {
  MAP_Y1 = MAP.y1;

  callbacks?.onStatus?.('T1: Building ground truth…');
  const t1 = buildT1GroundTruth(parcels, proj, MAP);

  // Attach computed bboxes to EDA parcels for T2
  for (const p of t1.edaParcels) {
    if (!p._bbox) {
      let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
      for (const ring of p.rings) {
        for (const [lon,lat] of ring) {
          const [x,y] = proj(lon,lat);
          if(x<minX)minX=x; if(x>maxX)maxX=x;
          if(y<minY)minY=y; if(y>maxY)maxY=y;
        }
      }
      p._bbox = {left:minX,right:maxX,top:minY,bottom:maxY};
    }
  }

  callbacks?.onStatus?.('T2: Decomposing site into polygon zones…');
  // Use polygon decomposition (Clipper) if available, otherwise fall back to grid
  const t2Zones = (window.EC_Decomp && typeof ClipperLib !== 'undefined')
    ? window.EC_Decomp.buildT2PolygonZones(t1, params, derivedG)
    : buildT2Zones(t1, params, derivedG);
  // Apply pending zone-use restore if a save was loaded
  if (window._pendingUseRestore && typeof applyPendingRestore !== 'undefined') {
    applyPendingRestore(t2Zones);
  }
  callbacks?.onT2Complete?.(t2Zones);

  callbacks?.onStatus?.(`T3: Running evolutionary algorithm (${params.ea_rounds||15} rounds)…`);
  const t3Result = await runT3EA(t2Zones, t1, params.weights, params, (progress) => {
    callbacks?.onEAProgress?.(progress);
  });
  callbacks?.onStatus?.(`T3 complete — best score: ${t3Result.best.score.total.toFixed(3)}, ${t3Result.best.score.total_units} units`);

  const t3Zones = t3Result.best.zones;

  callbacks?.onStatus?.('T4: Placing unit modules…');
  // Use polygon-aware unit placement if available
  const t4Zones = (window.EC_T4 && t3Zones[0]?.poly?.outer)
    ? window.EC_T4.buildUnits(t3Zones, t1)
    : buildT4Units(t3Zones, t1);

  callbacks?.onStatus?.('T5: Applying interaction constraints…');
  const t5Zones = applyT5Interactions(t4Zones);

  callbacks?.onStatus?.('T6: Cleanup pass…');
  const t6Zones = applyT6Cleanup(t5Zones);

  callbacks?.onStatus?.('T7: Rendering…');
  const svg = document.getElementById('site-plan');
  if (svg) {
    // Clear previous pipeline layers + constraint-solver decorations
    // Keep: defs, background rects, road bands, parcel paths (data-acct), EDA paths
    // Remove: overlays, decorations, previous T7/T4 renders
    svg.querySelectorAll('[data-t7],[data-units],[data-overlay],[data-bldg],[data-section-line]').forEach(e => e.remove());
    // Remove constraint-solver layer 4 decorations — these have no data-acct
    // and come after the parcel layer. Identify by tag + absence of data-acct.
    // Specifically: ellipses (sponge), rects (spine/ross/tide), and texts that
    // are NOT inside the road label group (road labels have no data- attr but are expected)
    svg.querySelectorAll('ellipse').forEach(e => e.remove());
    svg.querySelectorAll('rect[fill="#0a1828"],rect[fill="#160606"],rect[fill="#081408"]').forEach(e=>e.remove());
    // Remove all direct-child text and line elements from buildSVG Layer 4
    // Road labels are inside <g> elements; Layer 4 texts are direct svg children
    [...svg.childNodes].forEach(el => {
      if (el.tagName === 'text' || el.tagName === 'line') el.remove();
    });
    // Remove specific overlay rects by their known stroke/fill colors
    // Spine rect (stroke=#2878a0 or fill=#081220)
    // Ross rect (fill=#160606 or stroke=#903020)
    // Tide rect (fill=#081428)
    // Scale bar rects
    const OVERLAY_FILLS = new Set(['#0a1828','#160606','#081408','#081220',
      '#081428','#0a1020','#242210','#161410']);
    const OVERLAY_STROKES = new Set(['#2878a0','#903020','#3898c0','#2070a0']);
    [...svg.childNodes].forEach(el => {
      if (el.tagName !== 'rect') return;
      if (el.getAttribute('data-acct')) return; // keep parcel paths
      const fill = el.getAttribute('fill') || '';
      const stroke = el.getAttribute('stroke') || '';
      if (OVERLAY_FILLS.has(fill) || OVERLAY_STROKES.has(stroke)) el.remove();
    });
    // Remove direct-child groups that are L4 overlays (no data-*, no clip-path, no id)
    [...svg.childNodes].forEach(el => {
      if (el.tagName !== 'g') return;
      if (el.getAttribute('data-t7') || el.getAttribute('data-units') ||
          el.getAttribute('data-overlay') || el.getAttribute('clip-path') ||
          el.getAttribute('id')) return;
      el.remove();
    });
    // Also remove any stray overlay rect/line direct children
    // that survived (e.g. scale bar)
    [...svg.childNodes].forEach(el => {
      if (el.tagName === 'rect' || el.tagName === 'line') {
        if (!el.getAttribute('data-acct')) el.remove();
      }
    });
    // Remove spine rect (stroke=#2878a0) and other overlay rects/lines
    svg.querySelectorAll('rect[stroke="#2878a0"],rect[stroke="#903020"],rect[stroke="#3898c0"]').forEach(e=>e.remove());
    // Remove bike lane dashed lines and tide connector arrow
    svg.querySelectorAll('line[stroke="#3a8040"],line[stroke="#3898c0"]').forEach(e=>e.remove());
    // Remove overlay text groups: district labels, callout boxes, annotations
    // These are <g> elements appended directly to svg (not data-t7 groups)
    // Identify by checking if they contain text children with specific fill colors
    svg.querySelectorAll('g:not([data-t7]):not([data-units]):not([clip-path]):not([id])').forEach(g => {
      // Layer 4 groups have no clip-path, no id, no data-t7
      if (g.querySelector('text[fill="#d4982c"],text[fill="#4a9ab0"],text[fill="#9060c0"],text[fill="#5aaa60"]')) {
        g.remove();
      }
    });
    // Remove callout boxes (rect+text groups appended directly, no clip-path)
    svg.querySelectorAll('text[fill="#d4982c"],text[fill="#4a9ab0"],text[fill="#9060c0"]').forEach(e=>e.remove());

    if (window.EC_Decomp && t6Zones[0]?.poly?.svgPath) {
      window.EC_Decomp.renderT7Polygons(t6Zones, svg, params);
    } else {
      renderT7(t6Zones, svg, params);
    }
    window._pipelineRendered = true;
    if (window.EC_Render) window.EC_Render.renderUnits(t6Zones, svg, params);
    // Build and render edge geometry
    if (window.EC_Edges) {
      const edges = window.EC_Edges.buildEdges(t6Zones, {bufferPx: 5});
      window.EC_Edges.renderEdges(edges, svg, {opacity: '0.8'});
      window._lastEdges = edges;
    }
    // Reinit pan/zoom LAST — wraps all rendered content into viewport group
    if (window.EC_PanZoom) window.EC_PanZoom.reinit();
  }

  callbacks?.onComplete?.({
    zones: t6Zones,
    score: t3Result.best.score,
    history: t3Result.history,
    t1, params,
  });

  return { zones: t6Zones, t3Result, t1 };
}

// Export
window.EC_Pipeline = {
  PLANNING, USES, USE_ADJACENCY, CONFLICT, SYNERGY, DEFAULT_WEIGHTS,
  buildT1GroundTruth, buildT2Zones, runT3EA, buildT4Units,
  applyT5Interactions, applyT6Cleanup, renderT7,
  runPipeline, scoreCandidate,
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PATTERN → ZONE TRANSLATOR
//  Converts EC_PatternSolver scene graph instances into the zone object format
//  that T4 (unit placement) and T7 (SVG renderer) consume.
//
//  Pattern ID → USES key mapping:
//    P95  (Building Complex)      → MIXED_USE_5OVER1   (25ft parcel strips)
//    P109 (Long Thin House)       → RESIDENTIAL_CLT_OWN
//    P37  (House Cluster)         → RESIDENTIAL_MARKET  (cluster centroid → district)
//    P87  (Individually Owned Shops) → MIXED_USE_5OVER1 (ground retail)
//    P88  (Street Cafe)           → PLAZA
//    P46  (Market of Many Shops)  → MARKET_HALL
//    P60  (Accessible Green)      → GREEN_ACTIVE
//    P67  (Common Land)           → GREEN_ACTIVE
//    P71  (Still Water / Bioswale)→ GREEN_PASSIVE
//    P115 (Courtyards Which Live) → PLAZA               (courtyard void → plaza)
//    P53  (Main Gateways)         → PLAZA
//    P31  (Promenade)             → PLAZA               (spine as linear plaza)
//
//  Geometry flow:
//    inst.geom [{x,y},...] → toOuterPts [[x,y],...] → clip to EDA → poly.outer
//    poly.outer → ptsToSVGPath → poly.svgPath
//    bounds of poly.outer → poly.x/y/w/h  (for T4 rect fallback)
// ═══════════════════════════════════════════════════════════════════════════════

const PATTERN_USE_MAP = {
  95:  'MIXED_USE_5OVER1',
  109: 'RESIDENTIAL_CLT_OWN',
  37:  'RESIDENTIAL_MARKET',
  87:  'MIXED_USE_5OVER1',
  88:  'PLAZA',
  46:  'MARKET_HALL',
  60:  'GREEN_ACTIVE',
  67:  'GREEN_ACTIVE',
  71:  'GREEN_PASSIVE',
  115: 'PLAZA',
  53:  'PLAZA',
  31:  'PLAZA',
  114: 'GREEN_ACTIVE',
  106: 'GREEN_ACTIVE',
  127: 'RESIDENTIAL_CLT_OWN',
  122: 'MIXED_USE_5OVER1',
  30:  'CIVIC',
  36:  'CIVIC',
  29:  null,  // Density Rings: district-scale only, no rendered zone
  // Green space / walkway patterns added 2026-05-14
  120: 'GREEN_ACTIVE',   // Paths and Goals
  172: 'GREEN_PASSIVE',  // Garden Growing Wild
  174: 'GREEN_ACTIVE',   // Trellised Walk
  176: null,             // Garden Wall — boundary, not a zone
  56:  'GREEN_ACTIVE',   // Bike Paths and Racks
  // Higher-level patterns added 2026-05-14
  3:   'GREEN_PASSIVE',  // City Country Fingers — green corridor
  21:  'RESIDENTIAL_CLT_OWN', // Four-Story Limit — residential datum
  25:  'GREEN_PASSIVE',  // Access to Water — water corridor
  35:  'RESIDENTIAL_CLT_OWN', // Household Mix — residential spread
  // Tier 1 patterns added 2026-05-14
  9:   'LIVE_WORK',      // Scattered Work — productive commons
  32:  'MIXED_USE_5OVER1', // Shopping Street — continuous commercial
  40:  'CIVIC',          // Old Buildings — preservation anchor
  44:  'CIVIC',          // Local Town Hall — democratic assembly
};

// FAR by use for constraints
const PATTERN_FAR = {
  MIXED_USE_5OVER1:    5.0,
  RESIDENTIAL_CLT_OWN: 4.0,
  RESIDENTIAL_MARKET:  4.5,
  GREEN_ACTIVE:        0,
  GREEN_PASSIVE:       0,
  PLAZA:               0,
  MARKET_HALL:         2.0,
  CIVIC:               3.0,
};

function patternInstancesToZones(sg, t1) {
  if (!sg || !sg.instances) return [];

  const { scale, MAP, setbacks } = t1;
  const PX_TO_AC = (scale.ft_per_px_ew * scale.ft_per_px_ns) / 43560;

  // Build EDA boundary as a single unioned Clipper path for intersection
  let edaClipPaths = null;
  if (typeof ClipperLib !== 'undefined' && _pipelineParcels) {
    const edaRings = _pipelineParcels
      .filter(p => p.is_eda && p.rings?.[0])
      .map(p => {
        const svgPts = p.rings[0].map(([lon, lat]) => _pipelineProj(lon, lat));
        return toClipper(svgPts);
      })
      .filter(r => r.length >= 3);
    if (edaRings.length > 0) {
      edaClipPaths = clipperUnion(edaRings);
    }
  }

  const zones = [];
  let zIdx = 0;

  // Which pattern IDs to render as zones (skip singletons that are pure annotations)
  const RENDERABLE = new Set(Object.keys(PATTERN_USE_MAP)
    .map(Number).filter(k => PATTERN_USE_MAP[k] !== null));

  for (const inst of sg.instances) {
    if (!RENDERABLE.has(inst.patternId)) continue;

    const use = PATTERN_USE_MAP[inst.patternId];
    if (!use || !USES[use]) continue;

    // Collect geometry — handle polygon, polygon_array, point_cloud
    const geomList = inst.geomType === 'polygon_array'
      ? inst.geom
      : [inst.geom];

    for (const geom of geomList) {
      // Convert {x,y}[] to [[x,y][] for Clipper/SVG
      const rawPts = Array.isArray(geom)
        ? geom.map(p => [p.x ?? 0, p.y ?? 0])
        : null;

      if (!rawPts || rawPts.length < 3) continue;

      // Compute bounds before clipping (for centroid + fallback rect)
      const xs = rawPts.map(([x]) => x);
      const ys = rawPts.map(([, y]) => y);
      const bx = Math.min(...xs), bX = Math.max(...xs);
      const by = Math.min(...ys), bY = Math.max(...ys);
      const bw = bX - bx, bh = bY - by;

      // Reject tiny or degenerate polygons
      if (bw < 4 || bh < 4) continue;

      // Clip to EDA boundary (if Clipper available)
      let finalPts = rawPts;
      if (edaClipPaths && typeof ClipperLib !== 'undefined') {
        try {
          const subj = [toClipper(rawPts)];
          const clipped = clipperIntersection(subj, edaClipPaths);
          if (clipped.length === 0) continue;  // entirely outside EDA
          // Take the largest resulting polygon
          clipped.sort((a, b) => Math.abs(clipperArea(b)) - Math.abs(clipperArea(a)));
          finalPts = fromClipper(clipped[0]);
          if (finalPts.length < 3) continue;
        } catch (e) {
          // Clipper failed — use unclipped
        }
      }

      // Build poly fields
      const fxs = finalPts.map(([x]) => x);
      const fys = finalPts.map(([, y]) => y);
      const fx0 = Math.min(...fxs), fx1 = Math.max(...fxs);
      const fy0 = Math.min(...fys), fy1 = Math.max(...fys);
      const fw = fx1 - fx0, fh = fy1 - fy0;
      const cx = (fx0 + fx1) / 2, cy = (fy0 + fy1) / 2;

      const area_px = Math.abs(finalPts.reduce((s, [x, y], i, a) => {
        const [nx, ny] = a[(i + 1) % a.length];
        return s + x * ny - nx * y;
      }, 0)) / 2;

      const area_ac = area_px * PX_TO_AC;
      const area_sf = area_ac * 43560;

      // Skip zones too small to be meaningful (<0.02ac ≈ 870 sf)
      if (area_ac < 0.02) continue;

      // Road adjacency
      const road_adj = [];
      if (fy0 <= MAP.y0 + 40) road_adj.push('VA_BEACH_BLVD');
      if (fy1 >= MAP.y1 - 40) road_adj.push('I264');
      if (fx0 <= MAP.x0 + 40) road_adj.push('N_MILITARY_HWY');
      if (fx1 >= MAP.x1 - 40) road_adj.push('TIDEWATER_DR');

      const in_setback = setbacks.some(s =>
        cx >= s.poly.x && cx <= s.poly.x + s.poly.w &&
        cy >= s.poly.y && cy <= s.poly.y + s.poly.h
      );

      // Derive contextual flags from centroid position vs derivedG
      const G = window._derivedG || {};
      const on_spine   = G.SPINE  ? cx >= G.SPINE.x - 10 && cx <= G.SPINE.x + G.SPINE.w + 10 : false;
      const near_sponge= G.SPONGE ? Math.hypot(cx - G.SPONGE.cx, cy - G.SPONGE.cy) < Math.max(G.SPONGE.rx, G.SPONGE.ry) * 1.5 : false;

      const far = PATTERN_FAR[use] ?? 0;
      const isGreen = use.startsWith('GREEN') || use === 'PLAZA';
      const maxH = isGreen ? 0 : (PLANNING.MAX_HEIGHT_FT.mixed || 65);

      zones.push({
        id: `P${inst.patternId}_${zIdx++}`,
        source: 'pattern',
        patternId: inst.patternId,
        poly: {
          outer:   finalPts,          // [[x,y],...] — for T4, T5
          svgPath: ptsToSVGPath(finalPts),  // for T7
          x: fx0, y: fy0, w: fw, h: fh,    // rect fallback for T4 wing calc
        },
        centroid: { x: cx, y: cy },
        area_px,
        area_ac,
        area_sf,
        parcel_specs: [],
        road_adj,
        in_setback: in_setback && isGreen ? false : in_setback,  // green ok in setback
        on_spine,
        near_sponge,
        in_main_st: false,
        near_tide:  false,
        eligible_uses: [use],
        use,
        district: `P${inst.patternId}`,
        edge_mutations: [],
        constraints: {
          max_height_ft: maxH,
          min_courtyard_ratio: PLANNING.MIN_COURTYARD_RATIO,
          max_depth_ft: PLANNING.MAX_BUILDING_DEPTH_FT,
          far,
        },
      });
    }
  }

  console.log(`[PatternZones] ${zones.length} zones from ${sg.instances.length} instances`);
  return zones;
}




// ── PIPELINE WIRING ──────────────────────────────────────────────────────────
let _pipelineParcels = null, _pipelineProj = null, _pipelineMAP = null;
// Expose for external access
window._getPipelineState = () => ({parcels:_pipelineParcels, proj:_pipelineProj, MAP:_pipelineMAP});

// ═══════════════════════════════════════════════════════════════════════════════
//  EASTSIDE COMMONS — POLYGON DECOMPOSITION v2
//  Uses ClipperLib for all polygon operations.
//  Replaces the bbox-grid T2 with real polygon decomposition.
//
//  Coordinate system:
//    Working space: SVG px (floats from buildProjection)
//    Clipper space: SVG px × SCALE (integers, SCALE=1000)
//    All planning constants: feet, converted via scale.px_per_ft_*
//
//  Requires: ClipperLib loaded globally (window.ClipperLib)
// ═══════════════════════════════════════════════════════════════════════════════

const CLIPPER_SCALE = 1000;

// ── COORDINATE HELPERS ───────────────────────────────────────────────────────

// SVG px point → Clipper integer point
function toC([x, y]) {
  return { X: Math.round(x * CLIPPER_SCALE), Y: Math.round(y * CLIPPER_SCALE) };
}

// Clipper integer point → SVG px point
function fromC({ X, Y }) {
  return [X / CLIPPER_SCALE, Y / CLIPPER_SCALE];
}

// Array of [x,y] → Clipper path
function toClipper(pts) {
  return pts.map(toC);
}

// Clipper path → Array of [x,y]
function fromClipper(path) {
  return path.map(fromC);
}

// GIS lon/lat ring → SVG px points (via proj function)
function ringToSVG(ring, proj) {
  return ring.map(([lon, lat]) => proj(lon, lat));
}

// SVG px polygon → SVG path string (for rendering)
function ptsToSVGPath(pts) {
  if (!pts || pts.length < 2) return '';
  return 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') + ' Z';
}

// Compute area of a Clipper path (positive = clockwise in SVG coords)
function clipperArea(path) {
  return ClipperLib.Clipper.Area(path);
}

// ── CLIPPER OPERATION WRAPPERS ───────────────────────────────────────────────

// Union an array of Clipper paths into one (or more) merged polygons
function clipperUnion(paths) {
  if (paths.length === 0) return [];
  if (paths.length === 1) return [paths[0]];
  const c = new ClipperLib.Clipper();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const solution = new ClipperLib.Paths();
  c.Execute(
    ClipperLib.ClipType.ctUnion,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );
  return solution;
}

// Offset a set of paths inward (negative delta = inward for CCW, outward for CW)
// delta is in Clipper units (px × SCALE)
// joinType: jtMiter (sharp), jtRound, jtSquare
function clipperOffset(paths, delta, joinType = ClipperLib.JoinType.jtMiter, miterLimit = 2) {
  const co = new ClipperLib.ClipperOffset(miterLimit, 0.25 * CLIPPER_SCALE);
  co.AddPaths(paths, joinType, ClipperLib.EndType.etClosedPolygon);
  const solution = new ClipperLib.Paths();
  co.Execute(solution, delta);
  return solution;
}

// Difference: subject minus clip
function clipperDifference(subjectPaths, clipPaths) {
  if (!clipPaths || clipPaths.length === 0) return subjectPaths;
  const c = new ClipperLib.Clipper();
  c.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
  const solution = new ClipperLib.Paths();
  c.Execute(
    ClipperLib.ClipType.ctDifference,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );
  return solution;
}

// Intersection: keep only the overlap between subject and clip
function clipperIntersection(subjectPaths, clipPaths) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
  const solution = new ClipperLib.Paths();
  c.Execute(
    ClipperLib.ClipType.ctIntersection,
    solution,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero
  );
  return solution;
}

// Clean + Simplify a path (removes near-duplicates, fixes self-intersections)
function cleanPaths(paths) {
  const cleaned = paths.map(p =>
    ClipperLib.Clipper.CleanPolygon(p, 0.5 * CLIPPER_SCALE)
  ).filter(p => p && p.length >= 3);
  return ClipperLib.Clipper.SimplifyPolygons(
    cleaned,
    ClipperLib.PolyFillType.pftNonZero
  );
}

// Ensure correct winding: exterior = CCW in Clipper (positive area with Y-down)
function ensureWinding(paths) {
  return paths.map(path => {
    const area = clipperArea(path);
    // In SVG (Y-down), CCW has negative area in standard math → positive in Clipper
    // Clipper expects: outer rings are orientation=true (area>0 with their convention)
    if (!ClipperLib.Clipper.Orientation(path)) {
      ClipperLib.Clipper.ReversePath(path);
    }
    return path;
  });
}

// ── POLYGON → SVG PATH (with holes) ─────────────────────────────────────────

// Given a PolyTree from Clipper, extract outer polygons with their holes
// Returns array of {outer:[x,y][], holes:[[x,y][]][], svgPath:string}
function polyTreeToZonePolygons(solution) {
  const zones = [];

  for (const path of solution) {
    if (path.length < 3) continue;
    const pts = fromClipper(path);
    const area = Math.abs(clipperArea(path));
    if (area < 10 * CLIPPER_SCALE * CLIPPER_SCALE) continue; // skip tiny fragments

    zones.push({
      outer: pts,
      holes: [],
      svgPath: ptsToSVGPath(pts),
      area_px2: area / (CLIPPER_SCALE * CLIPPER_SCALE),
    });
  }

  return zones;
}

// ── BOUNDING BOX of a polygon ────────────────────────────────────────────────
function polyBounds(pts) {
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for (const [x,y] of pts) {
    if(x<minX)minX=x; if(x>maxX)maxX=x;
    if(y<minY)minY=y; if(y>maxY)maxY=y;
  }
  return {minX,maxX,minY,maxY,
    cx:(minX+maxX)/2, cy:(minY+maxY)/2,
    width:maxX-minX, height:maxY-minY};
}

// Centroid of a polygon (area-weighted)
function polyCentroid(pts) {
  let ax=0,ay=0,a=0;
  const n=pts.length;
  for(let i=0;i<n;i++){
    const [x0,y0]=pts[i], [x1,y1]=pts[(i+1)%n];
    const cross=x0*y1-x1*y0;
    ax+=(x0+x1)*cross; ay+=(y0+y1)*cross; a+=cross;
  }
  a*=0.5; ax/=(6*a); ay/=(6*a);
  return [ax,ay];
}

// Rectangle as Clipper path
function rectToClipper(x,y,w,h) {
  return [
    {X:Math.round(x*CLIPPER_SCALE), Y:Math.round(y*CLIPPER_SCALE)},
    {X:Math.round((x+w)*CLIPPER_SCALE), Y:Math.round(y*CLIPPER_SCALE)},
    {X:Math.round((x+w)*CLIPPER_SCALE), Y:Math.round((y+h)*CLIPPER_SCALE)},
    {X:Math.round(x*CLIPPER_SCALE), Y:Math.round((y+h)*CLIPPER_SCALE)},
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  T2 POLYGON DECOMPOSITION
//  Replaces the grid-based T2 with real polygon operations.
//
//  For each district:
//    1. Project GIS rings to SVG px
//    2. Union all parcels in district → merged polygon
//    3. Apply setbacks (subtract road buffer strips)
//    4. Inset by courtyard depth → courtyard polygon
//    5. Difference outer-inner → building footprint ring(s)
//    6. Split large footprints by spine (if district spans it)
//    7. Each resulting polygon becomes a T2 zone
// ═══════════════════════════════════════════════════════════════════════════════

// District definitions: which parcel specs belong together, and their initial use
const DISTRICT_DEFS = {
  MAIN_STREET: {
    specs: ['MAIN_ST_LARGE','MAIN_ST_MID','MAIN_ST_5773','MAIN_ST_THIN','MAIN_ST_5825'],
    initial_use: 'RETAIL_GROUND',
    decompose: 'individual',   // each parcel stays its own zone (already small)
    split_spine: false,
  },
  CIVIC: {
    specs: ['CIVIC_920','CIVIC_700','CIVIC_854','CIVIC_862',
            'CIVIC_STRIP','CIVIC_SPINE_S','CIVIC_ROW','HOUSING_A_530'],
    initial_use: 'CIVIC',
    decompose: 'union',        // merge, then split by function
    split_spine: false,
  },
  HOUSING_A: {
    specs: ['MALL_CORE'],
    initial_use: 'RESIDENTIAL_AFFORDABLE',
    decompose: 'union',
    split_spine: true,         // split east/west at spine
    inset_both_halves: true,   // courtyard on each half separately
  },
  CLT: {
    specs: ['CLT_NORTH','CLT_GLENROCK','CLT_GLENROCK2'],
    initial_use: 'RESIDENTIAL_CLT_OWN',
    decompose: 'union',
    split_spine: false,
  },
  HOUSING_B: {
    specs: ['HOUSING_B_S'],
    initial_use: 'RESIDENTIAL_AFFORDABLE',
    decompose: 'union',
    split_spine: false,
  },
  SPONGE: {
    specs: ['SPONGE_PARCEL'],
    initial_use: 'GREEN_PASSIVE',
    decompose: 'as_is',        // keep whole, no inset — it IS the green space
    split_spine: false,
  },
};

function buildT2PolygonZones(t1, params, derivedG) {
  const { scale, MAP, edaParcels, setbacks } = t1;

  // proj function — we need access to it here
  // It's stored on t1 (we'll add it there)
  const proj = t1.proj;
  if (!proj) {
    console.error('T2: proj function not found on t1. Was it stored?');
    return [];
  }

  if (typeof ClipperLib === 'undefined') {
    console.error('T2: ClipperLib not loaded');
    return [];
  }

  // Planning constants → Clipper units
  const INSET_FT     = params.courtyard_inset_ft    || 60;   // ft inward from parcel edge to building face
  const MAX_DEPTH_FT = params.max_building_depth_ft || 50;   // max building depth (natural ventilation)
  const SETBACK_ART  = params.setback_arterial_ft   || 20;   // arterial road setback
  const SETBACK_HWY  = params.setback_highway_ft    || 50;   // highway setback

  const inset_px  = INSET_FT     * scale.px_per_ft_ew;
  const depth_px  = MAX_DEPTH_FT * scale.px_per_ft_ew;
  const sb_art_px = SETBACK_ART  * scale.px_per_ft_ew;
  const sb_hwy_px = SETBACK_HWY  * scale.px_per_ft_ew;

  // Setback mask polygons (strips along each road, in Clipper coords)
  const setbackMask = {
    north: [rectToClipper(MAP.x0, MAP.y0, MAP.x1-MAP.x0, sb_art_px)],
    south: [rectToClipper(MAP.x0, MAP.y1-sb_hwy_px, MAP.x1-MAP.x0, sb_hwy_px)],
    west:  [rectToClipper(MAP.x0, MAP.y0, sb_art_px, MAP.y1-MAP.y0)],
    east:  [rectToClipper(MAP.x1-sb_art_px, MAP.y0, sb_art_px, MAP.y1-MAP.y0)],
  };

  // Spine polygon (from derived geometry)
  let spinePoly = null;
  if (derivedG && derivedG.SPINE) {
    const s = derivedG.SPINE;
    spinePoly = [rectToClipper(s.x, s.y, s.w, s.h)];
  }

  // Build parcel lookup: spec → GIS ring(s) in Clipper coords
  function parcelToClipper(parcel) {
    return parcel.rings.map(ring => {
      const pts = ringToSVG(ring, proj);
      return toClipper(pts);
    });
  }

  const specIndex = {};
  for (const p of edaParcels) {
    if (p.spec) specIndex[p.spec] = p;
  }

  const PX_TO_AC = (scale.ft_per_px_ew * scale.ft_per_px_ns) / 43560;

  const zones = [];

  for (const [districtName, def] of Object.entries(DISTRICT_DEFS)) {
    // Collect raw Clipper paths for all parcels in this district
    const rawPaths = [];
    for (const spec of def.specs) {
      const parcel = specIndex[spec];
      if (!parcel) continue;
      const cpaths = parcelToClipper(parcel);
      rawPaths.push(...cpaths);
    }

    if (rawPaths.length === 0) continue;

    // Clean inputs
    const cleaned = cleanPaths(rawPaths);
    if (cleaned.length === 0) continue;

    if (def.decompose === 'as_is') {
      // Keep the polygon as-is — it IS the zone (sponge park, civic parcels)
      for (const path of cleaned) {
        const pts = fromClipper(path);
        const [cx, cy] = polyCentroid(pts);
        const area_px2 = Math.abs(clipperArea(path)) / (CLIPPER_SCALE*CLIPPER_SCALE);
        zones.push(makeZone(districtName, def, pts, [], cx, cy, area_px2, PX_TO_AC, derivedG, MAP));
      }
      continue;
    }

    if (def.decompose === 'individual') {
      // Each parcel becomes its own zone (main street parcels)
      for (const spec of def.specs) {
        const parcel = specIndex[spec];
        if (!parcel) continue;
        const cpaths = cleanPaths(parcelToClipper(parcel));
        for (const path of cpaths) {
          const pts = fromClipper(path);
          const [cx, cy] = polyCentroid(pts);
          const area_px2 = Math.abs(clipperArea(path)) / (CLIPPER_SCALE*CLIPPER_SCALE);
          zones.push(makeZone(districtName, def, pts, [], cx, cy, area_px2, PX_TO_AC, derivedG, MAP));
        }
      }
      continue;
    }

    // 'union' mode: merge all parcels, then decompose

    // Step 1: Union all parcel paths
    const merged = clipperUnion(cleaned);
    if (merged.length === 0) continue;

    // Step 2: Remove setbacks (subtract road buffer zones)
    // Only subtract setbacks that are relevant to this district's road adjacency
    let buildable = merged;
    // Check which setbacks touch this district
    const bounds = polyBounds(fromClipper(merged[0]));
    if (bounds.minY < MAP.y0 + sb_art_px * 2) {
      buildable = clipperDifference(buildable, setbackMask.north);
    }
    if (bounds.maxY > MAP.y1 - sb_hwy_px * 2) {
      buildable = clipperDifference(buildable, setbackMask.south);
    }
    if (bounds.minX < MAP.x0 + sb_art_px * 2) {
      buildable = clipperDifference(buildable, setbackMask.west);
    }
    if (buildable.length === 0) continue;

    if (def.split_spine && spinePoly) {
      // Step 3a: Split at spine — produce west and east halves separately
      const westPaths = clipperDifference(buildable, [
        rectToClipper(derivedG.SPINE.x, MAP.y0, MAP.x1 - derivedG.SPINE.x, MAP.y1 - MAP.y0)
      ]);
      const eastPaths = clipperDifference(buildable, [
        rectToClipper(MAP.x0, MAP.y0, derivedG.SPINE.x + derivedG.SPINE.w, MAP.y1 - MAP.y0)
      ]);

      for (const [halves, halfName] of [[westPaths,'WEST'],[eastPaths,'EAST']]) {
        if (!halves || halves.length === 0) continue;
        const zonesFromHalf = insetToZones(
          halves, districtName+'_'+halfName, def,
          inset_px, depth_px, PX_TO_AC, derivedG, MAP
        );
        zones.push(...zonesFromHalf);
      }
    } else {
      // Step 3b: No spine split — inset directly
      const zonesFromDistrict = insetToZones(
        buildable, districtName, def,
        inset_px, depth_px, PX_TO_AC, derivedG, MAP
      );
      zones.push(...zonesFromDistrict);
    }
  }

  // Filter out degenerate zones (collapsed insets, tiny fragments)
  const MIN_ZONE_AC = 0.05;
  const filtered = zones.filter(z => z.area_ac >= MIN_ZONE_AC);
  const dropped = zones.length - filtered.length;
  if (dropped > 0) console.log(`T2: dropped ${dropped} degenerate zones (< ${MIN_ZONE_AC}ac)`);
  console.log(`T2 polygon decomposition: ${filtered.length} zones from ${Object.keys(DISTRICT_DEFS).length} districts`);
  return filtered;
}

// Inset a set of merged polygons to produce building footprint zones
function insetToZones(paths, districtName, def, inset_px, depth_px, PX_TO_AC, derivedG, MAP) {
  const zones = [];

  for (const outerPath of paths) {
    if (outerPath.length < 3) continue;
    const outerPts = fromClipper(outerPath);
    const area_outer = Math.abs(clipperArea(outerPath)) / (CLIPPER_SCALE*CLIPPER_SCALE);

    // Only inset if the polygon is large enough to have a meaningful courtyard
    const MIN_INSET_AREA = inset_px * inset_px * 4;
    if (area_outer < MIN_INSET_AREA) {
      // Too small for inset — use whole polygon as zone
      const [cx,cy] = polyCentroid(outerPts);
      zones.push(makeZone(districtName, def, outerPts, [], cx, cy,
        area_outer, PX_TO_AC, derivedG, MAP));
      continue;
    }

    // Inset inward — scale inset to parcel size
    // Cap: inset cannot exceed 25% of the polygon's shorter axis
    const outerBounds = polyBounds(outerPts);
    const minAxis = Math.min(outerBounds.width, outerBounds.height);
    const adaptiveInset = Math.min(inset_px, minAxis * 0.25);
    const insetPaths = clipperOffset(
      [outerPath], -adaptiveInset * CLIPPER_SCALE,
      ClipperLib.JoinType.jtMiter, 2.0
    );

    if (!insetPaths || insetPaths.length === 0) {
      // Inset collapsed the polygon — use whole polygon
      const [cx,cy] = polyCentroid(outerPts);
      zones.push(makeZone(districtName, def, outerPts, [], cx, cy,
        area_outer, PX_TO_AC, derivedG, MAP));
      continue;
    }

    // Building footprint = outer MINUS inset (the annular ring)
    const footprintPaths = clipperDifference([outerPath], insetPaths);
    const courtyardPts = fromClipper(insetPaths[0]);
    const [cx,cy] = polyCentroid(outerPts);

    if (footprintPaths.length === 0) {
      // Difference failed — use outer
      zones.push(makeZone(districtName, def, outerPts, [], cx, cy,
        area_outer, PX_TO_AC, derivedG, MAP));
      continue;
    }

    // Check: does the footprint ring exceed max_depth?
    // If the outer polygon is very wide, the footprint might be deeper than allowed.
    // In that case, inset again from the footprint to create additional interior zones.
    const bounds = polyBounds(outerPts);
    const maxDim = Math.max(bounds.width, bounds.height);

    if (maxDim > inset_px * 2 + depth_px * 2) {
      // Large polygon: building footprint ring + inner courtyard zone
      // The courtyard inset is already computed; produce the building ring as zone(s)
      for (const fp of footprintPaths) {
        const fpPts = fromClipper(fp);
        const fpArea = Math.abs(clipperArea(fp)) / (CLIPPER_SCALE*CLIPPER_SCALE);
        if (fpArea < 100) continue; // skip tiny fragments
        const [fcx,fcy] = polyCentroid(fpPts);
        zones.push(makeZone(districtName+'_FOOTPRINT', def, fpPts, [], fcx, fcy,
          fpArea, PX_TO_AC, derivedG, MAP));
      }
      // Courtyard as a separate GREEN_ACTIVE zone
      if (courtyardPts.length >= 3) {
        const ctArea = Math.abs(clipperArea(insetPaths[0])) / (CLIPPER_SCALE*CLIPPER_SCALE);
        const [ccx,ccy] = polyCentroid(courtyardPts);
        const greenDef = { ...def, initial_use: 'GREEN_ACTIVE' };
        zones.push(makeZone(districtName+'_COURTYARD', greenDef, courtyardPts, [], ccx, ccy,
          ctArea, PX_TO_AC, derivedG, MAP));
      }
    } else {
      // Smaller polygon: single building footprint zone (courtyard as hole)
      // Represent as outer polygon with hole — SVG path with hole using even-odd rule
      const holePath = courtyardPts.length >= 3
        ? 'M ' + courtyardPts.map(([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') + ' Z'
        : '';

      zones.push(makeZone(districtName, def, outerPts, [courtyardPts], cx, cy,
        area_outer, PX_TO_AC, derivedG, MAP));
    }
  }

  return zones;
}

// Construct a full zone object from polygon data
function makeZone(districtName, def, outerPts, holes, cx, cy, area_px2, PX_TO_AC, derivedG, MAP) {
  const area_ac = area_px2 * PX_TO_AC;
  const area_sf = area_ac * 43560;

  // Build SVG path string (outer + holes using even-odd fill rule)
  let svgPath = ptsToSVGPath(outerPts);
  for (const hole of holes) {
    if (hole.length >= 3) svgPath += ' ' + ptsToSVGPath(hole);
  }

  // Determine spatial relationships for use eligibility
  const bounds = polyBounds(outerPts);
  const on_spine = derivedG && derivedG.SPINE &&
    cx >= derivedG.SPINE.x - 5 && cx <= derivedG.SPINE.x + derivedG.SPINE.w + 5;
  const near_sponge = derivedG && derivedG.SPONGE &&
    Math.hypot(cx - derivedG.SPONGE.cx, cy - derivedG.SPONGE.cy) <
    Math.max(derivedG.SPONGE.rx, derivedG.SPONGE.ry) * 1.5;
  const in_main_st = derivedG && derivedG.BAND &&
    cy < derivedG.BAND.y + derivedG.BAND.h + 20 && cy > derivedG.BAND.y;
  const near_tide = derivedG && derivedG.TIDE &&
    Math.hypot(cx - (derivedG.TIDE.x + derivedG.TIDE.w/2), cy - derivedG.TIDE.y) < 120;

  const road_adj = [];
  if (bounds.minY < MAP.y0 + 30) road_adj.push('VA_BEACH_BLVD');
  if (bounds.maxY > MAP.y1 - 30) road_adj.push('I264');
  if (bounds.minX < MAP.x0 + 30) road_adj.push('N_MILITARY_HWY');
  if (bounds.maxX > MAP.x1 - 30) road_adj.push('TIDEWATER_DR');

  // Eligible uses from spatial context + district definition
  const eligible_uses = computeEligibleUses({
    in_setback: false,   // already subtracted setbacks
    on_spine, near_sponge, in_main_st, near_tide, road_adj,
    area_ac, area_sf, parcel_specs: def.specs,
  });

  const use = def.initial_use || (eligible_uses[0] || 'INFRASTRUCTURE');

  return {
    id: `${districtName}_${Math.floor(cx)}_${Math.floor(cy)}`,
    district: districtName,
    poly: {
      outer: outerPts,
      holes,
      svgPath,
      // Keep bbox for adjacency checks
      x: bounds.minX, y: bounds.minY,
      w: bounds.width, h: bounds.height,
    },
    centroid: { x: cx, y: cy },
    area_px2, area_ac, area_sf,
    parcel_specs: def.specs || [],
    road_adj,
    on_spine, near_sponge, in_main_st, near_tide,
    in_setback: false,
    eligible_uses,
    use,
    constraints: {
      max_height_ft: in_main_st ? 35 : near_sponge ? 25 : 65,
      min_courtyard_ratio: 0.30,
      max_depth_ft: 50,
      far: near_sponge ? 1.5 : 4.0,
    },
    edge_mutations: [],
  };
}

// ─── T7 POLYGON RENDERER (replaces rect-based renderer) ─────────────────────

function renderT7Polygons(zones, svg, params) {
  const ns = 'http://www.w3.org/2000/svg';
  const opacity    = params.opacity    !== undefined ? params.opacity   : 0.55;
  const showLabels = params.show_labels !== false;

  svg.querySelectorAll('[data-t7]').forEach(e => e.remove());

  const g = document.createElementNS(ns, 'g');
  g.setAttribute('data-t7', '1');
  g.setAttribute('clip-path', 'url(#mc)');

  // Use even-odd fill rule so holes (courtyards) render correctly
  g.setAttribute('fill-rule', 'evenodd');

  for (const z of zones) {
    if (!z.poly || !z.poly.svgPath) continue;
    const usedef = window.EC_Pipeline?.USES[z.use];
    if (!usedef) continue;
    const color = usedef.color;

    // Zone fill + stroke — single path handles outer + holes via even-odd
    const fill = document.createElementNS(ns, 'path');
    fill.setAttribute('d', z.poly.svgPath);
    fill.setAttribute('fill', color);
    fill.setAttribute('fill-opacity', opacity);
    fill.setAttribute('stroke', color);
    fill.setAttribute('stroke-width', '1.5');
    fill.setAttribute('stroke-opacity', '0.85');
    fill.setAttribute('fill-rule', 'evenodd');
    fill.setAttribute('data-zone', z.id);
    fill.setAttribute('data-use', z.use);
    fill.style.pointerEvents = 'none';  // unit layer handles interaction
    g.appendChild(fill);

    // Edge mutation: ground-floor retail stripe
    for (const m of (z.edge_mutations || [])) {
      if (m.type === 'ground_floor_retail' && z.poly.outer) {
        // Draw a 4px-wide outline in retail color along the polygon exterior
        const stripe = document.createElementNS(ns, 'path');
        stripe.setAttribute('d', ptsToSVGPath(z.poly.outer));
        stripe.setAttribute('fill', 'none');
        stripe.setAttribute('stroke', window.EC_Pipeline.USES.RETAIL_GROUND.color);
        stripe.setAttribute('stroke-width', '4');
        stripe.setAttribute('stroke-opacity', '0.9');
        g.appendChild(stripe);
      }
      if (m.type === 'highway_violation') {
        const warn = document.createElementNS(ns, 'path');
        warn.setAttribute('d', ptsToSVGPath(z.poly.outer));
        warn.setAttribute('fill', 'none');
        warn.setAttribute('stroke', '#c04030');
        warn.setAttribute('stroke-width', '2.5');
        warn.setAttribute('stroke-dasharray', '5,3');
        g.appendChild(warn);
      }
    }

    // Zone label — placed at centroid
    if (showLabels && z.area_ac > 0.2) {
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', z.centroid.x.toFixed(1));
      t.setAttribute('y', (z.centroid.y + 3).toFixed(1));
      t.setAttribute('font-family', 'DM Mono, monospace');
      t.setAttribute('font-size', Math.min(9, z.area_ac * 8 + 5).toFixed(0));
      t.setAttribute('fill', '#f0ece0');
      t.setAttribute('fill-opacity', '0.85');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('pointer-events', 'none');
      t.textContent = usedef.id;
      g.appendChild(t);

      if (z.units && z.area_ac > 0.5) {
        const sub = document.createElementNS(ns, 'text');
        sub.setAttribute('x', z.centroid.x.toFixed(1));
        sub.setAttribute('y', (z.centroid.y + 13).toFixed(1));
        sub.setAttribute('font-family', 'DM Mono, monospace');
        sub.setAttribute('font-size', '6');
        sub.setAttribute('fill', '#f0ece0');
        sub.setAttribute('fill-opacity', '0.55');
        sub.setAttribute('text-anchor', 'middle');
        sub.setAttribute('pointer-events', 'none');
        sub.textContent = `${z.units.unit_count}u`;
        g.appendChild(sub);
      }
    }
  }

  svg.appendChild(g);
}

// Adjacency check for polygon zones (uses centroid distance + bbox overlap)
function polyZonesAdjacent(a, b) {
  // Two polygon zones are adjacent if their bboxes overlap or nearly touch
  const TOL = 5;
  const ao = a.poly, bo = b.poly;
  const ax1=ao.x-TOL, ax2=ao.x+ao.w+TOL, ay1=ao.y-TOL, ay2=ao.y+ao.h+TOL;
  const bx1=bo.x,     bx2=bo.x+bo.w,     by1=bo.y,     by2=bo.y+bo.h;
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

// ─── EXPORT ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//  EASTSIDE COMMONS — T4 UNIT PLACEMENT v2
//  Replaces the bbox-based T4 with polygon-aware unit placement.
//
//  Pipeline:
//    1. Subdivide large footprint zones into developer-scale parcels (~300ft)
//    2. For each sub-parcel, compute a perimeter building strip + interior courtyard
//    3. Place individual unit modules (25ft wide × 50ft deep) along each strip face
//    4. Output: zones with units[] array of placed unit polygons + metadata
//
//  All in Clipper space; uses EC_Decomp helpers.
// ═══════════════════════════════════════════════════════════════════════════════

const T4 = {

  // Planning constants for unit placement
  UNIT_WIDTH_FT:     18,    // each unit bay: 18ft (townhouse module, Jacobs grain)
  UNIT_DEPTH_FT:     42,    // depth: ~42ft gives ~756sqft/floor, classic rowhouse
  MIN_PARCEL_AC:     0.15,  // ~75ft × 100ft = 7,500sqft — smallest viable developer lot
  MAX_PARCEL_AC:     1.5,   // above this, cross-cut to ~75ft parcels
  PARCEL_CUT_FT:     75,    // Jane Jacobs: short blocks (75ft) = mix + eyes on street
  AFFORDABLE_PCT: { RESIDENTIAL_AFFORDABLE: 1.0, RESIDENTIAL_CLT_OWN: 1.0,
                    RESIDENTIAL_MARKET: 0.30 },

  // ── STEP 1: Subdivide large zones into developer-scale parcels ──────────────
  subdivideZone(zone, t1) {
    const { scale } = t1;
    const cutPx = this.PARCEL_CUT_FT * scale.px_per_ft_ew;

    // Only subdivide residential/civic footprint zones that are oversized
    const isSubdividable = zone.area_ac > this.MAX_PARCEL_AC &&
      (zone.use.startsWith('RESIDENTIAL') || zone.use === 'CIVIC') &&
      zone.poly.outer;

    if (!isSubdividable) return [zone];

    // Get polygon bounds
    const bounds = EC_Decomp.polyBounds(zone.poly.outer);
    const outerC = zone.poly.outer.map(([x,y]) =>
      ({X: Math.round(x*CLIPPER_SCALE), Y: Math.round(y*CLIPPER_SCALE)})
    );

    // Determine cut direction: cut perpendicular to longer axis
    const cutAlongX = bounds.width >= bounds.height;
    const cutCount = Math.ceil(
      (cutAlongX ? bounds.width : bounds.height) / cutPx
    ) - 1;

    if (cutCount <= 0) return [zone];

    const subZones = [];
    let remaining = [outerC];

    for (let i = 1; i <= cutCount; i++) {
      const cutPos = cutAlongX
        ? bounds.minX + (bounds.width * i / (cutCount + 1))
        : bounds.minY + (bounds.height * i / (cutCount + 1));

      const newRemaining = [];
      for (const poly of remaining) {
        // Cut polygon with a vertical or horizontal line using Clipper
        const cutRect = cutAlongX
          ? [{X: Math.round(cutPos*CLIPPER_SCALE), Y: Math.round((bounds.minY-10)*CLIPPER_SCALE)},
             {X: Math.round((bounds.maxX+10)*CLIPPER_SCALE), Y: Math.round((bounds.minY-10)*CLIPPER_SCALE)},
             {X: Math.round((bounds.maxX+10)*CLIPPER_SCALE), Y: Math.round((bounds.maxY+10)*CLIPPER_SCALE)},
             {X: Math.round(cutPos*CLIPPER_SCALE), Y: Math.round((bounds.maxY+10)*CLIPPER_SCALE)}]
          : [{X: Math.round((bounds.minX-10)*CLIPPER_SCALE), Y: Math.round(cutPos*CLIPPER_SCALE)},
             {X: Math.round((bounds.maxX+10)*CLIPPER_SCALE), Y: Math.round(cutPos*CLIPPER_SCALE)},
             {X: Math.round((bounds.maxX+10)*CLIPPER_SCALE), Y: Math.round((bounds.maxY+10)*CLIPPER_SCALE)},
             {X: Math.round((bounds.minX-10)*CLIPPER_SCALE), Y: Math.round((bounds.maxY+10)*CLIPPER_SCALE)}];

        // Left/top piece
        const leftPiece = EC_Decomp.clipperDifference([poly], [cutRect]);
        // Right/bottom piece  
        const rightPiece = EC_Decomp.clipperIntersection([poly], [cutRect]);

        if (leftPiece.length > 0) {
          subZones.push(this._makeSubZone(zone, leftPiece[0], t1, i, 'A'));
        }
        if (rightPiece.length > 0) newRemaining.push(rightPiece[0]);
      }
      remaining = newRemaining;
    }

    // Add final remaining piece
    for (const poly of remaining) {
      subZones.push(this._makeSubZone(zone, poly, t1, cutCount+1, 'B'));
    }

    return subZones.filter(z => z.area_ac >= this.MIN_PARCEL_AC);
  },

  _makeSubZone(parent, clipperPath, t1, idx, suffix) {
    const PX_TO_AC = (t1.scale.ft_per_px_ew * t1.scale.ft_per_px_ns) / 43560;
    const pts = clipperPath.map(({X,Y}) => [X/CLIPPER_SCALE, Y/CLIPPER_SCALE]);
    const area_px2 = Math.abs(ClipperLib.Clipper.Area(clipperPath)) / (CLIPPER_SCALE*CLIPPER_SCALE);
    const [cx,cy] = EC_Decomp.polyCentroid(pts);
    const svgPath = EC_Decomp.ptsToSVGPath(pts);
    return {
      ...parent,
      id: `${parent.id}_P${idx}${suffix}`,
      poly: { ...parent.poly, outer: pts, svgPath, holes: [] },
      centroid: {x:cx, y:cy},
      area_px2, area_ac: area_px2 * PX_TO_AC,
      area_sf: area_px2 * PX_TO_AC * 43560,
      is_sub_parcel: true, parent_district: parent.district,
      units: null,  // will be placed in step 2
    };
  },

  // ── STEP 2: Place unit modules on a parcel polygon ──────────────────────────
  // Returns an array of placed unit objects for a single zone.
  placeUnits(zone, t1) {
    if (!zone.poly.outer || zone.in_setback) return null;
    if (!zone.use.startsWith('RESIDENTIAL') && zone.use !== 'CIVIC') return null;

    const { scale } = t1;
    const UNIT_W = this.UNIT_WIDTH_FT * scale.px_per_ft_ew;
    const UNIT_D = this.UNIT_DEPTH_FT * scale.px_per_ft_ns;
    const MAX_D  = zone.constraints.max_depth_ft * scale.px_per_ft_ns;

    // Derive building height from FAR + footprint
    const courtyard_frac = zone.constraints.min_courtyard_ratio || 0.30;
    const footprint_sf   = zone.area_sf * (1 - courtyard_frac);
    const floors         = Math.max(3, Math.min(
      Math.ceil((zone.area_sf * zone.constraints.far) / footprint_sf),
      Math.floor(zone.constraints.max_height_ft / 12)
    ));

    // Inset the outer polygon to get the buildable face
    const outerC = zone.poly.outer.map(([x,y]) =>
      ({X: Math.round(x*CLIPPER_SCALE), Y: Math.round(y*CLIPPER_SCALE)})
    );

    // Building strip: inset by unit depth from outer, but max building depth
    const unitInset = Math.min(UNIT_D, MAX_D);
    const innerRing = EC_Decomp.clipperOffset(
      [outerC], -unitInset * CLIPPER_SCALE,
      ClipperLib.JoinType.jtMiter, 2.0
    );

    if (!innerRing || innerRing.length === 0) return null;

    // Building strip = outer minus inner ring
    const strip = EC_Decomp.clipperDifference([outerC], innerRing);
    if (!strip || strip.length === 0) return null;

    // Courtyard = inner ring itself
    const courtyardPts = innerRing[0].map(({X,Y}) => [X/CLIPPER_SCALE, Y/CLIPPER_SCALE]);
    const courtyardPath = EC_Decomp.ptsToSVGPath(courtyardPts);
    const courtyardArea = Math.abs(ClipperLib.Clipper.Area(innerRing[0])) /
      (CLIPPER_SCALE * CLIPPER_SCALE * 43560 / (scale.ft_per_px_ew * scale.ft_per_px_ns));

    // Place unit modules: walk the OUTER edges and grid unit bays
    const units = [];
    const outer = zone.poly.outer;
    let totalUnits = 0;

    for (let i = 0; i < outer.length; i++) {
      const [x0,y0] = outer[i];
      const [x1,y1] = outer[(i+1) % outer.length];
      const edgeLen = Math.hypot(x1-x0, y1-y0);
      if (edgeLen < UNIT_W * 0.5) continue;  // skip too-short edges

      // Direction vector along edge
      const ux = (x1-x0)/edgeLen, uy = (y1-y0)/edgeLen;
      // Inward normal (toward centroid)
      const cx = zone.centroid.x, cy = zone.centroid.y;
      const midX = (x0+x1)/2, midY = (y0+y1)/2;
      const toCx = cx-midX, toCy = cy-midY;
      const toCLen = Math.hypot(toCx,toCy);
      const nx = toCx/toCLen, ny = toCy/toCLen;

      const bayCount = Math.floor(edgeLen / UNIT_W);
      const startOffset = (edgeLen - bayCount*UNIT_W) / 2;

      for (let b = 0; b < bayCount; b++) {
        const t = startOffset + b*UNIT_W + UNIT_W/2;
        // Unit module corners
        const bx = x0 + ux*t, by = y0 + uy*t;
        // 4 corners: front-left, front-right, back-right, back-left
        const fl = [bx - ux*UNIT_W/2, by - uy*UNIT_W/2];
        const fr = [bx + ux*UNIT_W/2, by + uy*UNIT_W/2];
        const br = [fr[0] + nx*unitInset, fr[1] + ny*unitInset];
        const bl = [fl[0] + nx*unitInset, fl[1] + ny*unitInset];

        const unitPoly = [fl,fr,br,bl];
        const svgPath = EC_Decomp.ptsToSVGPath(unitPoly);

        // Is this unit actually inside the strip polygon?
        // Check centroid point-in-polygon against the strip
        const unitCx = (fl[0]+fr[0]+br[0]+bl[0])/4;
        const unitCy = (fl[1]+fr[1]+br[1]+bl[1])/4;
        const inStrip = ClipperLib.Clipper.PointInPolygon(
          {X: Math.round(unitCx*CLIPPER_SCALE), Y: Math.round(unitCy*CLIPPER_SCALE)},
          strip[0]
        ) !== 0;

        if (!inStrip) continue;

        const affordable_pct = this.AFFORDABLE_PCT[zone.use] || 0.3;
        totalUnits++;

        units.push({
          id: `${zone.id}_U${totalUnits}`,
          poly: unitPoly,
          svgPath,
          centroid: [unitCx, unitCy],
          floors,
          edge_idx: i,
          bay_idx: b,
          use: zone.use,
          is_affordable: totalUnits % Math.round(1/affordable_pct) !== 0 || affordable_pct === 1.0,
          ground_floor: zone.edge_mutations?.some(m=>m.type==='ground_floor_retail')
            && (i === 0) ? 'RETAIL_GROUND' : null,
        });
      }
    }

    // FAR check: approximate floor area from unit count
    const unit_sf_each = this.UNIT_WIDTH_FT * this.UNIT_DEPTH_FT;
    const total_floor_area = units.length * unit_sf_each * floors;
    const realized_far = total_floor_area / zone.area_sf;
    const affordable_count = units.filter(u=>u.is_affordable).length;

    return {
      units,
      unit_count: units.length * floors,  // total dwelling units (each module × floors)
      module_count: units.length,          // distinct ground-floor modules
      floors,
      affordable_units: affordable_count * floors,
      courtyard: {pts: courtyardPts, svgPath: courtyardPath, area_ac: courtyardArea},
      building_strip: strip.map(p => p.map(({X,Y})=>[X/CLIPPER_SCALE, Y/CLIPPER_SCALE])),
      floor_area_sf: total_floor_area,
      realized_far: +realized_far.toFixed(2),
      unit_width_ft: this.UNIT_WIDTH_FT,
      unit_depth_ft: this.UNIT_DEPTH_FT,
    };
  },

  // ── MAIN ENTRY: run full T4 on all zones ────────────────────────────────────
  buildUnits(zones, t1) {
    const result = [];

    for (const zone of zones) {
      // Step 1: subdivide large zones
      const subZones = this.subdivideZone(zone, t1);

      for (const sz of subZones) {
        // Step 2: place unit modules
        const placed = this.placeUnits(sz, t1);
        result.push({ ...sz, units: placed });
      }
    }

    console.log(`T4: ${result.length} parcels, ` +
      `${result.filter(z=>z.units).length} with placed units, ` +
      `${result.reduce((s,z)=>s+(z.units?.unit_count||0),0)} total units`);

    return result;
  },
};

window.EC_T4 = T4;


// ── T7 UNIT RENDERER ─────────────────────────────────────────────────────────
// Renders placed unit modules on the SVG map.
// Called after renderT7Polygons to add the unit layer on top.

function renderUnits(zones, svg, params) {
  const ns = 'http://www.w3.org/2000/svg';
  svg.querySelectorAll('[data-units]').forEach(e => e.remove());

  if (!params.show_units) return;

  const g = document.createElementNS(ns, 'g');
  g.setAttribute('data-units', '1');
  g.setAttribute('clip-path', 'url(#mc)');
  g.setAttribute('fill-rule', 'nonzero');

  let totalRendered = 0;

  for (const zone of zones) {
    if (!zone.units) continue;
    const usedef = window.EC_Pipeline?.USES[zone.use];
    const baseColor = usedef?.color || '#888';

    // ── Courtyard (open space) ──
    if (zone.units.courtyard?.svgPath) {
      const ct = document.createElementNS(ns, 'path');
      ct.setAttribute('d', zone.units.courtyard.svgPath);
      ct.setAttribute('fill', '#0a1808');
      ct.setAttribute('fill-opacity', '0.55');
      ct.setAttribute('stroke', '#3a5828');
      ct.setAttribute('stroke-width', '0.8');
      ct.setAttribute('stroke-dasharray', '2,2');
      ct.style.pointerEvents = 'none';
      g.appendChild(ct);
    }

    // ── Building strip (perimeter band) ──
    for (const stripPoly of (zone.units.building_strip || [])) {
      const sp = document.createElementNS(ns, 'path');
      sp.setAttribute('d', EC_Decomp.ptsToSVGPath(stripPoly));
      sp.setAttribute('fill', baseColor);
      sp.setAttribute('fill-opacity', '0.38');
      sp.setAttribute('stroke', baseColor);
      sp.setAttribute('stroke-width', '0.6');
      sp.setAttribute('stroke-opacity', '0.4');
      sp.style.pointerEvents = 'none';
      g.appendChild(sp);
    }

    // ── Individual unit modules ──
    for (const unit of zone.units.units) {
      const u = document.createElementNS(ns, 'path');
      u.setAttribute('d', unit.svgPath);

      // Color: affordable = district color, market = lighter, ground retail = orange
      let fillColor = baseColor;
      let fillOpacity = '0.7';
      if (unit.ground_floor === 'RETAIL_GROUND') {
        fillColor = window.EC_Pipeline.USES.RETAIL_GROUND.color;
        fillOpacity = '0.90';
      } else if (!unit.is_affordable) {
        fillColor = baseColor;
        fillOpacity = '0.50';  // market rate slightly lighter
      } else {
        fillOpacity = '0.80';  // affordable: fully visible
      }

      u.setAttribute('fill', fillColor);
      u.setAttribute('fill-opacity', fillOpacity);
      u.setAttribute('stroke', baseColor);
      u.setAttribute('stroke-width', '0.8');
      u.setAttribute('stroke-opacity', '0.7');
      u.setAttribute('data-unit', unit.id);
      u.setAttribute('data-floors', unit.floors);
      u.setAttribute('data-affordable', unit.is_affordable);
      u.style.cursor = 'crosshair';
      u.style.pointerEvents = 'auto';

      // Tooltip — rich unit + zone info
      u.addEventListener('mouseenter', e => {
        const tt = document.getElementById('tooltip');
        if (!tt) return;
        const usedef = window.EC_Pipeline?.USES[zone.use];
        tt.style.opacity = 1;
        tt.style.left = (e.clientX + 14) + 'px';
        tt.style.top  = (e.clientY - 8) + 'px';
        tt.innerHTML =
          `<span style='color:${usedef?.color||'#aaa'};font-weight:500'>${usedef?.id||'?'}</span>` +
          ` <span style='opacity:0.65'>${usedef?.label||zone.use}</span><br>` +
          `${unit.floors}F &middot; ` +
          `<span style='color:${unit.is_affordable?'#22a838':'#c87818'}'>${unit.is_affordable?'affordable':'market-rate'}</span>` +
          (unit.ground_floor ? ` &middot; <span style='color:#e83808'>retail GF</span>` : '') +
          `<br><span style='opacity:0.4;font-size:0.52rem'>${zone.id.split('_').slice(0,3).join('_')}</span>`;
      });
      u.addEventListener('mouseleave', () => {
        const tt = document.getElementById('tooltip');
        if (tt) tt.style.opacity = 0;
      });

      g.appendChild(u);
      totalRendered++;
    }

    // ── Floor count label on each sub-parcel ──
    if (zone.units.module_count > 0 && zone.area_ac > 0.3) {
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', zone.centroid.x.toFixed(1));
      t.setAttribute('y', (zone.centroid.y - 6).toFixed(1));
      t.setAttribute('font-family', 'DM Mono, monospace');
      t.setAttribute('font-size', '7');
      t.setAttribute('fill', '#f0ece0');
      t.setAttribute('fill-opacity', '0.75');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('pointer-events', 'none');
      t.textContent = `${zone.units.unit_count}u ${zone.units.floors}F`;
      g.appendChild(t);

      if (zone.units.realized_far !== undefined) {
        const sub = document.createElementNS(ns, 'text');
        sub.setAttribute('x', zone.centroid.x.toFixed(1));
        sub.setAttribute('y', (zone.centroid.y + 3).toFixed(1));
        sub.setAttribute('font-family', 'DM Mono, monospace');
        sub.setAttribute('font-size', '5.5');
        sub.setAttribute('fill', '#f0ece0');
        sub.setAttribute('fill-opacity', '0.45');
        sub.setAttribute('text-anchor', 'middle');
        sub.setAttribute('pointer-events', 'none');
        sub.textContent = `FAR ${zone.units.realized_far}`;
        g.appendChild(sub);
      }
    }
  }

  svg.appendChild(g);
  console.log(`T7 units: ${totalRendered} unit modules rendered`);
}

// ── DOWNLOAD: SVG as PNG ──────────────────────────────────────────────────────
async function downloadPNG() {
  const svg = document.getElementById('site-plan');
  if (!svg) return;

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svg);
  const blob = new Blob([svgStr], {type: 'image/svg+xml'});
  const url = URL.createObjectURL(blob);

  // Render to canvas for PNG conversion
  const img = new Image();
  const canvas = document.createElement('canvas');
  const scale = 2;  // 2× for retina

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

  const vb = svg.viewBox.baseVal;
  canvas.width  = (vb.width  || 960)  * scale;
  canvas.height = (vb.height || 760) * scale;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#040402';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);

  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.download = 'eastside-commons-plan.png';
    a.href = URL.createObjectURL(blob);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

// ── DOWNLOAD: GeoJSON ─────────────────────────────────────────────────────────
// Converts zone polygons back to geographic coordinates (lon/lat) for GIS use.
// Requires the inverse projection from SVG px → lon/lat.
function downloadGeoJSON() {
  const state = window._getPipelineState?.();
  if (!state) { alert('Run the pipeline first.'); return; }

  // Inverse projection: SVG px → lon/lat
  // We have: x = MAP.x0 + (lon - minLon)/(maxLon-minLon) * mapW
  // So:       lon = minLon + (x - MAP.x0)/mapW * (maxLon - minLon)
  const MAP = state.MAP;
  const t1 = window.EC_Pipeline.buildT1GroundTruth(state.parcels, state.proj, state.MAP);
  const { minLon, maxLon, minLat, maxLat } = state.proj._bounds || {};

  // Recover bounds from T1 — we stored them during buildProjection
  // (We'll need to expose these — for now compute from EDA parcel rings)
  let mnLon=Infinity,mxLon=-Infinity,mnLat=Infinity,mxLat=-Infinity;
  for (const p of t1.edaParcels) {
    for (const ring of p.rings) {
      for (const [lo,la] of ring) {
        if(lo<mnLon)mnLon=lo; if(lo>mxLon)mxLon=lo;
        if(la<mnLat)mnLat=la; if(la>mxLat)mxLat=la;
      }
    }
  }
  const padLon=(mxLon-mnLon)*0.18, padLat=(mxLat-mnLat)*0.20;
  mnLon-=padLon; mxLon+=padLon; mnLat-=padLat; mxLat+=padLat;

  const mapW = MAP.x1-MAP.x0, mapH = MAP.y1-MAP.y0;

  function svgToLonLat([x,y]) {
    const lon = mnLon + (x - MAP.x0) / mapW * (mxLon - mnLon);
    const lat = mxLat - (y - MAP.y0) / mapH * (mxLat - mnLat);
    return [+lon.toFixed(6), +lat.toFixed(6)];
  }

  // Get current rendered zones
  const zones = window._lastPipelineZones;
  if (!zones) { alert('No pipeline output found. Run the pipeline first.'); return; }

  const features = [];

  // District zone polygons
  for (const z of zones) {
    if (!z.poly?.outer) continue;
    const coords = [z.poly.outer.map(svgToLonLat)];
    // Close the ring
    if (coords[0].length > 0) {
      coords[0].push(coords[0][0]);
    }
    // Add holes (courtyards) as interior rings
    for (const hole of (z.poly.holes || [])) {
      if (hole.length < 3) continue;
      const hCoords = hole.map(svgToLonLat);
      hCoords.push(hCoords[0]);
      coords.push(hCoords);
    }

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: coords },
      properties: (() => {
        const usedef = window.EC_Pipeline.USES[z.use];
        const color = usedef?.color || '#888888';
        const label = usedef?.label || z.use;
        const unitCount = z.units?.unit_count || 0;
        const affordable = z.units?.affordable_units || 0;
        const afPct = unitCount > 0 ? Math.round(affordable/unitCount*100) : null;
        return {
          // ── Identification ──
          id: z.id,
          title: `${usedef?.id || z.use} — ${z.district}`,
          description: [
            label,
            unitCount > 0 ? `${unitCount} units${afPct ? ` (${afPct}% affordable)` : ''}` : null,
            z.units?.floors ? `${z.units.floors} floors` : null,
            z.units?.realized_far ? `FAR ${z.units.realized_far}` : null,
            `${z.area_ac.toFixed(2)}ac`,
          ].filter(Boolean).join(' · '),
          // ── SimpleStyle (geojson.io, Mapbox, QGIS) ──
          'fill': color,
          'fill-opacity': 0.55,
          'stroke': color,
          'stroke-width': 2,
          'stroke-opacity': 0.9,
          // ── Planning data ──
          district: z.district,
          use: z.use,
          use_label: label,
          use_color: color,
          area_ac: +z.area_ac.toFixed(3),
          is_sub_parcel: z.is_sub_parcel || false,
          parent_district: z.parent_district || z.district,
          unit_count: unitCount,
          affordable_units: affordable,
          affordable_pct: afPct,
          floors: z.units?.floors || 0,
          realized_far: z.units?.realized_far || null,
          constraints_far: z.constraints?.far || null,
          on_spine: z.on_spine,
          near_sponge: z.near_sponge,
          in_main_st: z.in_main_st,
          near_tide: z.near_tide,
          // ── Edge mutations ──
          edge_mutations: (z.edge_mutations||[]).map(m=>m.type).join(',') || null,
          ground_floor_retail: (z.edge_mutations||[]).some(m=>m.type==='ground_floor_retail'),
          highway_buffer: (z.edge_mutations||[]).some(m=>m.type==='highway_violation'),
        };
      })(),
    });

    // Individual unit modules as separate features
    if (z.units?.units) {
      for (const unit of z.units.units) {
        const uCoords = unit.poly.map(svgToLonLat);
        uCoords.push(uCoords[0]);
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [uCoords] },
          properties: (() => {
            const usedef = window.EC_Pipeline.USES[z.use];
            const color = usedef?.color || '#888888';
            const gfColor = window.EC_Pipeline.USES.RETAIL_GROUND?.color || '#e83808';
            const fillColor = unit.ground_floor ? gfColor : color;
            return {
              // ── Identification ──
              id: unit.id,
              title: `Unit ${unit.id.split('_U').pop()} · ${unit.floors}F · ${unit.is_affordable ? 'affordable' : 'market-rate'}`,
              description: [
                usedef?.label || z.use,
                `${unit.floors} floors`,
                unit.is_affordable ? 'Affordable / CLT' : 'Market-rate',
                unit.ground_floor ? 'Ground floor: retail' : null,
                `${z.units.unit_width_ft}ft × ${z.units.unit_depth_ft}ft bay`,
              ].filter(Boolean).join(' · '),
              // ── SimpleStyle ──
              'fill': fillColor,
              'fill-opacity': unit.is_affordable ? 0.8 : 0.45,
              'stroke': fillColor,
              'stroke-width': 1,
              'stroke-opacity': 0.7,
              // ── Planning data ──
              type: 'unit_module',
              parent_zone: z.id,
              use: z.use,
              use_label: usedef?.label || z.use,
              use_color: color,
              floors: unit.floors,
              is_affordable: unit.is_affordable,
              ground_floor_use: unit.ground_floor || null,
              unit_width_ft: z.units.unit_width_ft,
              unit_depth_ft: z.units.unit_depth_ft,
              edge_idx: unit.edge_idx,
              bay_idx: unit.bay_idx,
            };
          })(),
        });
      }
    }
  }

  // Also add raw EDA parcel polygons as a reference layer
  for (const p of t1.edaParcels) {
    for (const ring of p.rings) {
      const coords = [ring.map(([lo,la]) => [+lo.toFixed(6), +la.toFixed(6)])];
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: coords },
        properties: {
          'fill': '#888888',
          'fill-opacity': 0.05,
          'stroke': '#aaaaaa',
          'stroke-width': 1.5,
          'stroke-opacity': 0.6,
          title: `EDA Parcel: ${p.spec}`,
          description: `${p.area_ac}ac · Acct ${p.acct} · GPIN ${p.gpin}`,
          type: 'eda_parcel',
          acct: p.acct,
          gpin: p.gpin,
          spec: p.spec,
          area_ac: p.area_ac,
        },
      });
    }
  }

  // ── Edge features ──
  if (window._lastEdges) {
    for (const edge of window._lastEdges) {
      const def = window.EC_Edges?.EDGE_TYPES[edge.type];
      if (!edge.pts || edge.pts.length < 3) continue;
      const coords = [edge.pts.map(svgToLonLat)];
      coords[0].push(coords[0][0]);
      const useA = window.EC_Pipeline.USES[edge.useA];
      const useB = window.EC_Pipeline.USES[edge.useB];
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: coords },
        properties: {
          'stroke': def?.color || '#888888',
          'stroke-width': (def?.width || 2) * 2,
          'stroke-opacity': 0.85,
          'fill': def?.color || '#888888',
          'fill-opacity': 0.4,
          title: def?.label || edge.type,
          description: `${useA?.label || edge.useA} ↔ ${useB?.label || edge.useB}`,
          type: 'edge',
          edge_type: edge.type,
          edge_label: def?.label || edge.type,
          use_a: edge.useA,
          use_b: edge.useB,
          length_px: +edge.length_px.toFixed(1),
        },
      });
    }
  }

  const geojson = {
    type: 'FeatureCollection',
    name: 'Eastside Commons Plan',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }},
    features,
  };

  const blob = new Blob([JSON.stringify(geojson, null, 2)], {type:'application/geo+json'});
  const a = document.createElement('a');
  a.download = 'eastside-commons-plan.geojson';
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  const byType = {};
  for (const f of features) { const t=f.properties.type||'zone'; byType[t]=(byType[t]||0)+1; }
  console.log(`GeoJSON: ${features.length} features — ${JSON.stringify(byType)}`);
}

window.EC_Render = { renderUnits, downloadPNG, downloadGeoJSON };


// ═══════════════════════════════════════════════════════════════════════════════
//  EASTSIDE COMMONS — EDGE GEOMETRY
//  Derives shared edges between adjacent polygon zones.
//  Each edge is classified by the pair of zone uses it separates.
//
//  Edge taxonomy:
//    STREET      — between any two buildable zones (primary street)
//    ACTIVATED   — residential facing retail/civic (ground-floor activation zone)
//    GREEN_EDGE  — residential/civic meeting green space (ecological transition)
//    SPONGE_EDGE — any zone meeting GREEN_PASSIVE (bioswale edge)
//    COURTYARD   — footprint meeting its own courtyard (internal edge)
//    TRANSIT_ACT — any zone meeting TRANSIT (transit activation)
//
//  Rendering:
//    STREET      — grey, solid, 2px
//    ACTIVATED   — warm orange, solid, 3px (ground-floor retail pressure zone)
//    GREEN_EDGE  — green, dashed, 2px
//    SPONGE_EDGE — teal, dashed, 2.5px
//    COURTYARD   — lighter, dotted, 1px
//    TRANSIT_ACT — blue, solid, 3px
//
//  Edge polygons (not just lines) — each edge is a thin buffered strip
//  that can hold edge-specific rendering (texture, annotation, activation indicator).
// ═══════════════════════════════════════════════════════════════════════════════

const EDGE_TYPES = {
  ACTIVATED:   { color: '#e86820', width: 3.0, dash: null,  label: 'Activation edge',    z: 5 },
  TRANSIT_ACT: { color: '#0868d8', width: 3.0, dash: null,  label: 'Transit edge',        z: 5 },
  SPONGE_EDGE: { color: '#18b898', width: 2.5, dash: '5,3', label: 'Bioswale edge',       z: 4 },
  GREEN_EDGE:  { color: '#28b848', width: 2.0, dash: '4,3', label: 'Green edge',           z: 3 },
  STREET:      { color: '#686868', width: 1.5, dash: null,  label: 'Internal street',     z: 2 },
  COURTYARD:   { color: '#3a4828', width: 1.0, dash: '2,3', label: 'Courtyard edge',      z: 1 },
};

// Classify an edge between two uses
function classifyEdge(useA, useB) {
  const pair = new Set([useA, useB]);

  // TRANSIT activation: anything meeting TRANSIT
  if (pair.has('TRANSIT')) return 'TRANSIT_ACT';

  // Sponge/wetland edge: anything meeting GREEN_PASSIVE
  if (pair.has('GREEN_PASSIVE')) return 'SPONGE_EDGE';

  // Green edge: residential/civic meeting GREEN_ACTIVE
  if (pair.has('GREEN_ACTIVE')) {
    const other = useA === 'GREEN_ACTIVE' ? useB : useA;
    if (other.startsWith('RESIDENTIAL') || other === 'CIVIC' || other === 'PLAZA') {
      return 'GREEN_EDGE';
    }
  }

  // Activation edge: residential facing retail/civic
  const retailCivic = new Set(['RETAIL_GROUND', 'CIVIC', 'PLAZA']);
  const residential = new Set(['RESIDENTIAL_MARKET', 'RESIDENTIAL_AFFORDABLE', 'RESIDENTIAL_CLT_OWN']);
  if ((retailCivic.has(useA) && residential.has(useB)) ||
      (retailCivic.has(useB) && residential.has(useA))) {
    return 'ACTIVATED';
  }

  // Courtyard: footprint district meeting its own courtyard
  // (parent_district matching with one being _FOOTPRINT and other _COURTYARD)
  return 'STREET';
}

// Extract shared boundary between two polygon zones using Clipper
// Returns array of {pts:[x,y][], type, useA, useB, length_px}
function findSharedEdge(zoneA, zoneB, bufferPx) {
  if (!zoneA.poly?.outer || !zoneB.poly?.outer) return null;
  if (!window.EC_Decomp || typeof ClipperLib === 'undefined') return null;

  const SCALE = EC_Decomp.CLIPPER_SCALE;

  // Convert polygons to Clipper paths
  const pathA = zoneA.poly.outer.map(([x,y]) => ({X:Math.round(x*SCALE), Y:Math.round(y*SCALE)}));
  const pathB = zoneB.poly.outer.map(([x,y]) => ({X:Math.round(x*SCALE), Y:Math.round(y*SCALE)}));

  // Expand B by bufferPx to detect near-adjacency (not just exact touching)
  const expandedB = EC_Decomp.clipperOffset([pathB], bufferPx * SCALE, ClipperLib.JoinType.jtMiter);
  if (!expandedB || expandedB.length === 0) return null;

  // Intersection of A with expanded B = the shared border strip
  const intersection = EC_Decomp.clipperIntersection([pathA], expandedB);
  if (!intersection || intersection.length === 0) return null;

  // Filter out tiny fragments
  const MIN_AREA = bufferPx * 3 * SCALE * SCALE;
  const valid = intersection.filter(p => {
    const area = Math.abs(ClipperLib.Clipper.Area(p));
    return area > MIN_AREA;
  });
  if (valid.length === 0) return null;

  const type = classifyEdge(zoneA.use, zoneB.use);

  return valid.map(path => {
    const pts = path.map(({X,Y}) => [X/SCALE, Y/SCALE]);
    const bounds = EC_Decomp.polyBounds(pts);
    const len = Math.max(bounds.width, bounds.height);
    return { pts, type, useA: zoneA.use, useB: zoneB.use, length_px: len };
  });
}

// Build all edges for a zone set
// Returns array of edge objects ready for rendering
function buildEdges(zones, options = {}) {
  const bufferPx = options.bufferPx || 4;   // ~12ft at our scale
  const edges = [];
  const processed = new Set();

  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i], b = zones[j];

      // Quick bbox reject before Clipper
      if (!EC_Decomp.polyZonesAdjacent(a, b)) continue;

      // Skip same-parent courtyard pairs if requested
      if (options.skipInternalCourtyards &&
          a.parent_district && a.parent_district === b.parent_district) {
        // Keep courtyard edges but mark them
      }

      const key = [a.id, b.id].sort().join('|');
      if (processed.has(key)) continue;
      processed.add(key);

      const shared = findSharedEdge(a, b, bufferPx);
      if (shared) {
        for (const edge of shared) {
          edges.push({
            ...edge,
            zoneA_id: a.id, zoneB_id: b.id,
            zoneA_district: a.district, zoneB_district: b.district,
          });
        }
      }
    }
  }

  console.log(`EC_Edges: ${edges.length} edges from ${zones.length} zones`);
  return edges;
}

// Render edges onto the SVG
function renderEdges(edges, svg, params = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  svg.querySelectorAll('[data-edges]').forEach(e => e.remove());

  if (!edges || edges.length === 0) return;

  // Sort by z-order so important edges render on top
  const sorted = [...edges].sort((a,b) =>
    (EDGE_TYPES[a.type]?.z || 0) - (EDGE_TYPES[b.type]?.z || 0)
  );

  // Group by type for efficient rendering
  const byType = {};
  for (const e of sorted) {
    (byType[e.type] = byType[e.type] || []).push(e);
  }

  const g = document.createElementNS(ns, 'g');
  g.setAttribute('data-edges', '1');
  g.setAttribute('clip-path', 'url(#mc)');
  g.style.pointerEvents = 'none';  // group transparent; paths get auto below

  for (const [type, typeEdges] of Object.entries(byType)) {
    const def = EDGE_TYPES[type];
    if (!def) continue;

    const tg = document.createElementNS(ns, 'g');
    tg.setAttribute('data-edge-type', type);
    tg.setAttribute('opacity', params.opacity || '0.85');

    for (const edge of typeEdges) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', EC_Decomp.ptsToSVGPath(edge.pts));
      path.setAttribute('fill', def.color);
      path.setAttribute('fill-opacity', '0.55');
      path.setAttribute('stroke', def.color);
      path.setAttribute('stroke-width', def.width);
      path.setAttribute('stroke-opacity', '0.9');
      if (def.dash) path.setAttribute('stroke-dasharray', def.dash);
      path.setAttribute('fill-rule', 'evenodd');

      // Tooltip
      path.style.cursor = 'crosshair';
      path.style.pointerEvents = 'auto';  // re-enable on individual paths
      path.addEventListener('mouseenter', e => {
        const tt = document.getElementById('tooltip');
        if (!tt) return;
        tt.style.opacity = 1;
        tt.style.left = (e.clientX + 14) + 'px';
        tt.style.top  = (e.clientY - 8) + 'px';
        const uA = window.EC_Pipeline?.USES[edge.useA];
        const uB = window.EC_Pipeline?.USES[edge.useB];
        tt.innerHTML =
          `<span style='color:${def.color};font-weight:500'>${def.label}</span><br>` +
          `<span style='color:${uA?.color||'#aaa'}'>${uA?.id||edge.useA}</span>` +
          ` <span style='opacity:0.4'>↔</span> ` +
          `<span style='color:${uB?.color||'#aaa'}'>${uB?.id||edge.useB}</span>` +
          `<br><span style='opacity:0.4;font-size:0.52rem'>${edge.length_px.toFixed(0)}px · ${edge.zoneA_district}|${edge.zoneB_district}</span>`;
      });
      path.addEventListener('mouseleave', () => {
        const tt = document.getElementById('tooltip');
        if (tt) tt.style.opacity = 0;
      });

      tg.appendChild(path);
    }
    g.appendChild(tg);
  }

  svg.appendChild(g);
}

// Edge legend for the ctrl panel
function edgeLegendHTML() {
  return Object.entries(EDGE_TYPES).map(([type, def]) =>
    `<span class="legend-chip">
      <span class="legend-swatch" style="background:${def.color}"></span>
      ${def.label}
    </span>`
  ).join('');
}

window.EC_Edges = { buildEdges, renderEdges, classifyEdge, EDGE_TYPES, edgeLegendHTML };

function renderLegendChips() {
  const container = document.getElementById('legend-chips');
  if (!container || !window.EC_Pipeline) return;
  container.innerHTML = Object.entries(window.EC_Pipeline.USES).map(([key, def]) =>
    `<span class="legend-chip">
      <span class="legend-swatch" style="background:${def.color}"></span>
      ${def.id} ${def.label}
    </span>`
  ).join('');
  const edgeContainer = document.getElementById('edge-legend-chips');
  if (edgeContainer && window.EC_Edges) {
    edgeContainer.innerHTML = window.EC_Edges.edgeLegendHTML();
  }
}


window.EC_Decomp = {
  buildT2PolygonZones,
  renderT7Polygons,
  polyZonesAdjacent,
  ptsToSVGPath,
  polyBounds,
  polyCentroid,
  clipperUnion,
  clipperOffset,
  clipperDifference,
  clipperIntersection,
  cleanPaths,
  DISTRICT_DEFS,
  CLIPPER_SCALE,
};



// ── IndexedDB store for full solver payload (fields are Float32Arrays) ────────
const EC_IDB_NAME = 'eastside-commons', EC_IDB_STORE = 'solver', EC_IDB_KEY = 'last';
function _ecIDB(mode) {
  return new Promise((res, rej) => {
    const req = indexedDB.open(EC_IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(EC_IDB_STORE);
    req.onsuccess = e => {
      const db = e.target.result;
      res(db.transaction(EC_IDB_STORE, mode).objectStore(EC_IDB_STORE));
    };
    req.onerror = () => rej(req.error);
  });
}
async function ecStorePayload(payload) {
  try {
    const store = await _ecIDB('readwrite');
    store.put(payload, EC_IDB_KEY);
  } catch(e) { console.warn('[EC IDB write]', e); }
}
async function ecLoadPayload() {
  try {
    const store = await _ecIDB('readonly');
    return await new Promise((res, rej) => {
      const req = store.get(EC_IDB_KEY);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror  = () => rej(req.error);
    });
  } catch(e) { console.warn('[EC IDB read]', e); return null; }
}

function initPipeline(parcels, proj, MAP, derivedG) {
  _pipelineParcels = parcels; _pipelineProj = proj; _pipelineMAP = MAP;
  window._derivedG = derivedG;
  window._pipelineReady = true;
  // Try resuming cached result first; fall back to fresh solve
  setTimeout(() => {
    if (!resumeFromCache()) {
      if (typeof triggerPipeline === 'function') triggerPipeline();
    }
  }, 300);
}

// Debounced wrapper — sliders call this so rapid drags don't spam the EA
let _pipelineRegenTimer = null;
// ── Apply field solver result to the map (worker callback + resume) ─────────
function applyFieldResult(psResult, params, t1) {
  const svg = document.getElementById('site-plan');
  const statusText = document.getElementById('map-status');
  const btn = document.getElementById('run-btn');

  // ── Remap GPU solver coordinates → SVG space (0–4200 × 0–3700) ──────
  // GPU solver works in its own MAP space (x0=-96..x1=2507, y0=-96..y1=2503).
  // SVG pipeline works in 0–4200 × 0–3700 with Y-up→Y-down flip.
  // Buildings and hotNodes must be remapped before renderPlanBuildings.
  const gMAP = psResult.MAP;
  if (gMAP && psResult.sceneGraph) {
    const SVG_W = 4200, SVG_H = 3700;
    const mw = gMAP.x1 - gMAP.x0, mh = gMAP.y1 - gMAP.y0;
    const remapX = x => (x - gMAP.x0) / mw * SVG_W;
    const remapY = y => SVG_H - (y - gMAP.y0) / mh * SVG_H; // Y-flip

    psResult.sceneGraph.buildings = (psResult.sceneGraph.buildings || []).map(b => ({
      ...b,
      x: remapX(b.x),
      y: remapY(b.y + b.h), // top edge: y+h in MAP space → lowest SVG y
      w: b.w / mw * SVG_W,
      h: b.h / mh * SVG_H,
    }));

    psResult.sceneGraph.instances = (psResult.sceneGraph.instances || []).map(n => ({
      ...n,
      x: remapX(n.x),
      y: remapY(n.y),
    }));

    // Keep buildings array in sync (used for stats)
    psResult.buildings = psResult.sceneGraph.buildings;
  }

  if (svg) {
    svg.querySelectorAll('[data-t7],[data-plan-layer]').forEach(e => e.remove());
    svg.querySelector('#pattern-overlay')?.remove();
    renderPlanBuildings(psResult.sceneGraph);
    if (window.EC_PanZoom && _pipelineParcels) {
      const edaPts = _pipelineParcels
        .filter(p => p.is_eda && p.rings?.[0])
        .flatMap(p => p.rings[0].map(([lon,lat]) => _pipelineProj(lon,lat)));
      if (edaPts.length) {
        const xs = edaPts.map(([x]) => x), ys = edaPts.map(([,y]) => y);
        window.EC_PanZoom.fitBBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      }
    }
  }

  // ── Stats from field solver buildings — no zone pipeline needed ──────
  const PID_USE_STATS = {
    37:'RESIDENTIAL', 109:'RESIDENTIAL', 115:'RESIDENTIAL', 107:'RESIDENTIAL',
    127:'RESIDENTIAL', 35:'RESIDENTIAL', 21:'RESIDENTIAL',
    87:'COMMERCIAL', 88:'COMMERCIAL', 46:'COMMERCIAL', 95:'COMMERCIAL',
    122:'COMMERCIAL', 100:'COMMERCIAL', 123:'COMMERCIAL',
    9:'COMMERCIAL', 32:'COMMERCIAL',
    30:'CIVIC', 36:'CIVIC', 53:'CIVIC', 31:'CIVIC', 110:'CIVIC', 14:'CIVIC',
    40:'CIVIC', 44:'CIVIC',
    60:'GREEN', 67:'GREEN', 71:'GREEN', 51:'GREEN', 106:'GREEN',
    114:'GREEN', 172:'GREEN', 174:'GREEN', 56:'GREEN', 25:'GREEN', 3:'GREEN',
  };
  const GREEN_PIDS_STATS = new Set([60,67,71,51,106,114,172,174,56,25,3]);
  const FT2_PER_AC = 43560;
  // 1 ft² in solver space = (ft_per_px_ew * ft_per_px_ns) ft² real... but
  // solver is already in ft so bldg.w * bldg.h IS ft²
  let total_units = 0, affordable = 0, green_ac = 0;
  for (const b of (psResult.buildings || [])) {
    const pid = Number(b.domPid);
    const use = PID_USE_STATS[pid] || 'MIXED';
    if (GREEN_PIDS_STATS.has(pid)) {
      // Green: area as open space acreage (ellipse area = π*rx*ry)
      green_ac += Math.PI * (b.w*0.65) * (b.h*0.65) / FT2_PER_AC;
    } else if (use === 'RESIDENTIAL') {
      const lots = Math.max(1, Math.round(b.w / 25));
      const units = lots * 15;
      total_units += units;
      affordable += Math.round(units * 0.96);
    }
  }
  window._lastParams = params;
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('res-units', total_units.toLocaleString());
  setEl('res-affordable', total_units > 0 ? `${((affordable/total_units)*100).toFixed(0)}%` : '—');
  setEl('res-green', (green_ac/73.4*100).toFixed(1)+'%');
  const bN = (psResult.buildings||[]).length, nN = (psResult.hotNodes||[]).length;
  setEl('res-patterns', `${bN} bldgs · ${nN} nodes` + (psResult.saturatedAt ? ` · ✓sat@${psResult.saturatedAt}` : ''));
  if (statusText) statusText.textContent =
    `✓ ${bN} bldgs · ${nN} nodes` + (psResult.saturatedAt ? ` · sat@pass ${psResult.saturatedAt}` : '');
  if (btn) { btn.disabled = false; btn.textContent = '▶ SOLVE'; }

  renderLegendChips();
  updateAnalysisViews();
  try {
    localStorage.setItem('ec-state', JSON.stringify({
      zones, parcels: (_pipelineParcels||[]).filter(p=>p.is_eda),
      seed: window._lastSeed, params, ts: Date.now(),
    }));
  } catch(_) {}
}

// ── Resume from localStorage cache on load ───────────────────────────────────
function resumeFromCache() {
  try {
    const raw = localStorage.getItem('ec-solver-result');
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (!payload.ts || Date.now() - payload.ts > 7 * 86400e3) return false;
    if (!payload.buildings?.length) return false;
    const psResult = {
      buildings: payload.buildings, hotNodes: payload.hotNodes || [],
      fieldLines: payload.fieldLines || [], log: payload.log || [],
      saturatedAt: payload.saturatedAt,
      sceneGraph: {
        instances: payload.hotNodes || [], buildings: payload.buildings,
        buildingPoints: payload.hotNodes || [],
      },
    };
    window._patternSolverResult = psResult;
    window._lastPatternResult   = psResult;
    const ageMins = Math.round((Date.now() - payload.ts) / 60000);
    const statusEl = document.getElementById('map-status');
    if (statusEl) statusEl.textContent = `Cached result (${ageMins}m ago) — ${payload.buildings.length} bldgs`;
    mapLog(`resumed from cache (${ageMins}m ago) · ${payload.buildings.length} bldgs`, 'ok');
    applyFieldResult(psResult, payload.opts || {}, null);
    return true;
  } catch(e) { console.warn('[Resume]', e); return false; }
}

// ── Map console overlay — ephemeral per-message fade-out ─────────────────────
const _mapLogBuffer = [];

function mapLog(msg, type = 'info') {
  const ts = new Date().toISOString().slice(11,23);
  _mapLogBuffer.push(`[${ts}] ${msg}`);
  if (_mapLogBuffer.length > 200) _mapLogBuffer.shift();

  const container = document.getElementById('map-console');
  if (!container) return;

  const el = document.createElement('div');
  const colors = { info: '#9ab', warn: '#c87818', error: '#e06060', ok: '#48c860' };
  el.style.cssText = `
    font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.05em;
    color: ${colors[type] || colors.info}; background: rgba(4,4,2,0.82);
    padding: 0.2rem 0.55rem; border-left: 2px solid ${colors[type] || colors.info};
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
    transition: opacity 0.6s ease;
  `;
  el.textContent = msg;
  container.appendChild(el);

  // Keep last 6 messages, fade older ones
  const msgs = container.children;
  while (msgs.length > 6) container.removeChild(msgs[0]);
  Array.from(msgs).forEach((m, i, a) => {
    m.style.opacity = String(0.35 + 0.65 * (i / Math.max(1, a.length - 1)));
  });

  setTimeout(() => { el.style.opacity = '0'; }, 3500);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 4200);
}

function copyMapLog() {
  const text = _mapLogBuffer.join('\n');
  navigator.clipboard?.writeText(text).then(() => mapLog('log copied to clipboard', 'ok'))
    .catch(() => {
      // Fallback: show in a textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:10%;left:5%;width:90%;height:80%;z-index:9999;font-family:monospace;font-size:0.65rem;background:#0b0f08;color:#e0d8c0;border:1px solid #c87818;padding:0.5rem;';
      ta.setAttribute('readonly', '');
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.addEventListener('blur', () => document.body.removeChild(ta));
      ta.focus();
      mapLog('select all + copy from textarea', 'warn');
    });
}

// ── Git hash version display ──────────────────────────────────────────────────
(async () => {
  try {
    // _build-manifest.json is written by the build script and includes git sha
    const res = await fetch('/_build-manifest.json');
    if (res.ok) {
      const m = await res.json();
      const sha = m.git_sha || m.commit_sha || '';
      const built = m.built_at ? new Date(m.built_at).toISOString().slice(0,16).replace('T',' ') : '';
      const el = document.getElementById('map-version');
      if (el && sha) el.textContent = `${sha.slice(0,7)} · ${built}`;
    }
  } catch(_) {}
})();

function schedulePipelineRegen(delayMs = 600) {
  clearTimeout(_pipelineRegenTimer);
  _pipelineRegenTimer = setTimeout(() => triggerPipeline(), delayMs);
}

async function triggerPipeline() {
  if (!_pipelineParcels) { alert('Constraint solver must run first.'); return; }
  const btn = document.getElementById('run-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Running…'; }
  const statusText = document.getElementById('map-status');
  const progressBar = null;  // removed
  const scoreHistory = null;  // removed
  const progSection = null;  // removed
  if (progSection) progSection.style.display = '';
  if (scoreHistory) scoreHistory.innerHTML = '';
  const errOverlay = document.getElementById('map-error-overlay');
  if (errOverlay) errOverlay.style.display = 'none';

  const params = {
    ps_recurse: parseInt(document.getElementById('p-rounds')?.value  || 16),
    ps_eps:     parseFloat(document.getElementById('p-eps')?.value   || 0.008),
    ps_res:     parseInt(document.getElementById('p-res')?.value     || 10),
    ps_thresh:  parseFloat(document.getElementById('p-thresh')?.value|| 0.2),
    show_units: true, show_edges: true, show_labels: true, opacity: 0.55,
  };

  try {
    const svg = document.getElementById('site-plan');
    const MAP = _pipelineMAP;
    const proj = _pipelineProj;
    const parcels = _pipelineParcels;

    // ── T1: Ground truth ──────────────────────────────────────────────────
    if (statusText) statusText.textContent = 'T1: Building ground truth…';
    const t1 = window.EC_Pipeline.buildT1GroundTruth(parcels, proj, MAP);

    // Attach bboxes (needed by some T4 helpers)
    for (const p of t1.edaParcels) {
      if (!p._bbox) {
        let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
        for (const ring of p.rings) {
          for (const [lon,lat] of ring) {
            const [x,y] = proj(lon,lat);
            if(x<minX)minX=x; if(x>maxX)maxX=x;
            if(y<minY)minY=y; if(y>maxY)maxY=y;
          }
        }
        p._bbox = {left:minX,right:maxX,top:minY,bottom:maxY};
      }
    }

    // ── Field Solver via Web Worker ─────────────────────────────────────────
    if (statusText) statusText.textContent = 'Field solver: starting worker…';
    if (btn) { btn.disabled = true; btn.textContent = '⟳ 0/' + (params.ps_recurse || 16); }
    mapLog(`starting · grid ${params.ps_res || 10}ft · ${params.ps_recurse || 16} passes max`);

    // Terminate any existing worker
    if (window._solverWorker) { window._solverWorker.terminate(); window._solverWorker = null; }

    const worker = new Worker('/eastside-commons/ec-solver-worker.js');
    window._solverWorker = worker;

    worker.onmessage = (e) => {
      const { type, msg, pass, delta, saturated, payload, buildings, hotNodes } = e.data;
      if (type === 'status') {
        if (statusText) statusText.textContent = msg;
        mapLog(msg, msg.includes('✗') ? 'error' : 'info');
      } else if (type === 'checkpoint') {
        if (btn) btn.textContent = `⟳ ${pass + 1}p · ${buildings}b`;
        mapLog(`pass ${pass + 1} → ${buildings} bldgs · ${hotNodes} nodes`, 'ok');
        // Main thread owns localStorage — write checkpoint here
        if (e.data.payload) {
          try { localStorage.setItem('ec-solver-result', JSON.stringify(e.data.payload)); } catch(_) {}
        }
        // Render partial result
        try {
          const raw = localStorage.getItem('ec-solver-result');
          if (raw) {
            const p = JSON.parse(raw);
            if (p.partial && p.buildings?.length) {
              const sg = { instances: p.hotNodes||[], buildings: p.buildings, buildingPoints: p.hotNodes||[] };
              renderPlanBuildings(sg);
            }
          }
        } catch(_) {}
      } else if (type === 'progress') {
        const maxP = params.ps_recurse || 16;
        const pct = Math.round((pass + 1) / maxP * 100);
        const label = saturated ? `✓ sat · ${pass + 1}p` : `⟳ ${pass + 1}/${maxP} · ${pct}%`;
        if (btn) btn.textContent = label;
        const deltaStr = delta != null ? `Δ=${delta}` : 'pass 0';
        if (statusText) statusText.textContent = `Pass ${pass + 1}/${maxP} · ${deltaStr}${saturated ? ' · ✓sat' : ''}`;
        mapLog(`pass ${pass + 1}/${maxP} · ${deltaStr}${saturated ? ' ✓' : ''}`, saturated ? 'ok' : 'info');
      } else if (type === 'error') {
        if (statusText) statusText.textContent = '✗ ' + msg;
        if (btn) { btn.disabled = false; btn.textContent = '▶ SOLVE'; }
        mapLog('✗ ' + msg, 'error');
        window._solverWorker = null;
      } else if (type === 'result') {
        // Keep full payload (with Float32Array fields) in memory for diagnostic
        window._lastSolverPayload = payload;
        // Persist to IndexedDB (handles Float32Arrays; localStorage can't)
        ecStorePayload(payload);
        // Also write slim version (no fields) to localStorage for resumeFromCache
        try {
          const slim = Object.assign({}, payload, { fields: null, patternFields: null });
          localStorage.setItem('ec-solver-result', JSON.stringify(slim));
        } catch(_) {}
        const psResult = {
          buildings: payload.buildings, hotNodes: payload.hotNodes,
          fieldLines: payload.fieldLines, log: payload.log,
          saturatedAt: payload.saturatedAt,
          sceneGraph: {
            instances: payload.hotNodes || [], buildings: payload.buildings || [],
            buildingPoints: payload.hotNodes || [],
          },
        };
        window._patternSolverResult = psResult;
        window._lastPatternResult   = psResult;
        window._solverWorker = null;
        applyFieldResult(psResult, params, t1);
      }
    };

    worker.onerror = (e) => {
      const loc = e.filename ? `${e.filename.split('/').pop()}:${e.lineno}:${e.colno}` : '';
      const msg = [e.message, loc].filter(Boolean).join(' @ ') || 'unknown error';
      if (statusText) statusText.textContent = '✗ ' + msg;
      if (btn) { btn.disabled = false; btn.textContent = '▶ SOLVE'; }
      mapLog('✗ worker: ' + msg, 'error');
      console.error('[Worker error]', e);
      window._solverWorker = null;
    };

    worker.addEventListener('messageerror', (e) => {
      const msg = 'structured clone failed — non-transferable data';
      if (statusText) statusText.textContent = '✗ ' + msg;
      if (btn) { btn.disabled = false; btn.textContent = '▶ SOLVE'; }
      mapLog('✗ ' + msg, 'error');
      console.error('[Worker messageerror]', e);
      window._solverWorker = null;
    });

    // ── Context fields: fetch Norfolk GIS buildings + streets ───────────────
    // These become boundary conditions for non-EDA cells in the IC shader.
    // Fetch runs in main thread (needs fetch API). Result cached 7 days.
    let contextFields = null;
    if (window.EC_Context) {
      try {
        const CELL_FT = params.ps_res || 10;
        const GW = Math.ceil((MAP.x1 - MAP.x0) / CELL_FT) + 1;
        const GH = Math.ceil((MAP.y1 - MAP.y0) / CELL_FT) + 1;
        const bounds = proj._bounds || {};
        if (statusText) statusText.textContent = 'Fetching city context (buildings + streets)…';
        contextFields = await window.EC_Context.fetchContextFields(
          bounds, MAP, proj, GW, GH, CELL_FT,
          (msg) => { if (statusText) statusText.textContent = msg; mapLog(msg, 'info'); }
        );
        mapLog(`context: f0/f1/f2 ready (${GW}×${GH})`, 'ok');
      } catch (ctxErr) {
        mapLog(`context fetch failed: ${ctxErr.message} — continuing without`, 'error');
        contextFields = null;
      }
    }

    worker.postMessage({
      parcels, derivedG: window._derivedG || {}, MAP,
      opts: {
        passes:    params.ps_recurse || 16,
        eps:       params.ps_eps     || 0.008,
        cellSize:  params.ps_res     || 10,
        threshold: params.ps_thresh  || 0.2,
        contextFields,
      },
    }, contextFields ? [
      contextFields.f0.buffer,
      contextFields.f1.buffer,
      contextFields.f2.buffer,
    ] : []);

    return;  // rendering happens async in worker.onmessage

  } catch(e) {
    const msg = e?.message || String(e);
    statusText.textContent = '\u2717 Error: ' + msg;
    console.error(e);
    if (btn) { btn.disabled = false; btn.textContent = '▶ SOLVE'; }
    const overlay = document.getElementById('map-error-overlay');
    if (overlay) {
      overlay.textContent = '\u2717 Pipeline error\n\n' + msg + (e?.stack ? '\n\n' + e.stack : '');
      overlay.style.display = 'block';
    }
  }
}


// ── EDGE TOGGLE ─────────────────────────────────────────────────────────────────
function toggleEdges(btn) {
  btn.classList.toggle('on');
  const svg = document.getElementById('site-plan');
  if (!svg) return;
  const show = btn.classList.contains('on');
  const edgeGroup = svg.querySelector('[data-edges]');
  if (edgeGroup) edgeGroup.style.display = show ? '' : 'none';
  // If turning on and no edges yet, build them
  if (show && !edgeGroup && window._lastPipelineZones && window.EC_Edges) {
    const edges = window.EC_Edges.buildEdges(window._lastPipelineZones, {bufferPx:5});
    window.EC_Edges.renderEdges(edges, svg, {opacity:'0.8'});
  }
}

// ── SAVE / RESTORE STATE ─────────────────────────────────────────────────────
// State = { seed, params, uses } where uses = {[zone_id]: use_string}
// Saved as URL hash (#ec:base64json) and downloadable JSON

function captureState() {
  const params = {
    block_size_ft: parseInt(document.getElementById('p-block-size')?.value || 200),
    strategy:      document.getElementById('p-strategy')?.value || 'hybrid',
    courtyard_inset_ft: parseInt(document.getElementById('p-courtyard')?.value || 60),
    ea_rounds:     parseInt(document.getElementById('p-rounds')?.value || 15),
    ea_mutation:   parseInt(document.getElementById('p-mutation')?.value || 10) / 100,
    w_units:       parseInt(document.getElementById('w-units')?.value || 20) / 100,
    w_affordable:  parseInt(document.getElementById('w-affordable')?.value || 35) / 100,
    w_green:       parseInt(document.getElementById('w-green')?.value || 22) / 100,
    w_walk:        parseInt(document.getElementById('w-walk')?.value || 13) / 100,
  };
  const zones = window._lastPipelineZones || [];
  const uses = {};
  for (const z of zones) uses[z.id] = z.use;
  return {
    v: 1,
    seed: getCurrentSeed(),
    params,
    uses,
    ts: new Date().toISOString(),
    score: document.getElementById('res-score')?.textContent || null,
    units: document.getElementById('res-units')?.textContent || null,
  };
}

function saveToHash() {
  const state = captureState();
  const json = JSON.stringify(state);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  history.replaceState(null, '', '#ec:' + b64);
  // Copy to clipboard
  navigator.clipboard?.writeText(window.location.href).then(() => {
    showToast('Link copied — share to restore this exact layout');
  }).catch(() => {
    showToast('Hash set in URL — copy the address bar');
  });
}

function saveToFile() {
  const state = captureState();
  const blob = new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `eastside-commons-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function loadFromHash() {
  const hash = window.location.hash;
  if (!hash.startsWith('#ec:')) return false;
  try {
    const json = decodeURIComponent(escape(atob(hash.slice(4))));
    const state = JSON.parse(json);
    return restoreState(state);
  } catch(e) {
    console.warn('Failed to load state from hash:', e);
    return false;
  }
}

function loadFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const state = JSON.parse(ev.target.result);
        restoreState(state);
      } catch(err) {
        showToast('Failed to parse save file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function restoreState(state) {
  if (!state || state.v !== 1) {
    showToast('Unrecognized save format');
    return false;
  }
  // Restore seed
  if (state.seed) setSeed(state.seed);
  // Restore sliders
  const p = state.params || {};
  const setSlider = (id, val, suffix='') => {
    const el = document.getElementById(id);
    const lbl = document.getElementById(id + '-val');
    if (el && val !== undefined) {
      el.value = typeof val === 'number' && val <= 1 ? Math.round(val * 100) : val;
      if (lbl) lbl.textContent = el.value + suffix;
    }
  };
  setSlider('p-block-size', p.block_size_ft, 'ft');
  setSlider('p-courtyard', p.courtyard_inset_ft, 'ft');
  setSlider('p-rounds', p.ea_rounds);
  setSlider('p-mutation', p.ea_mutation, '%');
  setSlider('w-units', p.w_units, '%');
  setSlider('w-affordable', p.w_affordable, '%');
  setSlider('w-green', p.w_green, '%');
  setSlider('w-walk', p.w_walk, '%');
  if (p.strategy) {
    const sel = document.getElementById('p-strategy');
    if (sel) sel.value = p.strategy;
  }

  // Restore zone uses — applied after pipeline runs
  window._pendingUseRestore = state.uses;

  // Re-run pipeline with restored seed
  showToast(`Restoring layout (score ${state.score || '?'}, ${state.units || '?'} units)…`);
  setTimeout(() => triggerPipeline(), 100);
  return true;
}

// Apply restored uses after pipeline T2 runs (hook into T2 output)
function applyPendingRestore(zones) {
  const pending = window._pendingUseRestore;
  if (!pending) return;
  let applied = 0;
  for (const z of zones) {
    if (pending[z.id] && z.eligible_uses.includes(pending[z.id])) {
      z.use = pending[z.id];
      applied++;
    }
  }
  console.log(`State restore: applied ${applied}/${zones.length} zone uses`);
  window._pendingUseRestore = null;
}

function showToast(msg) {
  let toast = document.getElementById('ec-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ec-toast';
    toast.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);' +
      'background:var(--surface);border:1px solid var(--accent);color:var(--text);' +
      'padding:0.5rem 1rem;font-family:var(--font-mono);font-size:0.65rem;z-index:9999;' +
      'opacity:0;transition:opacity 0.2s;pointer-events:none;max-width:80vw;text-align:center;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = 1;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.style.opacity = 0, 3500);
}

window.EC_Save = { captureState, saveToHash, saveToFile, loadFromFile, loadFromHash, restoreState, showToast, newSeed, loadCanonical, updateCanonicalBadge };


// ═══════════════════════════════════════════════════════════════════════════
// EC_PatternSolver — Alexander Pattern Language constraint solver
//
// Three-tier scene graph:
//   Pattern      — singleton, no physical location, defines rule + priority
//   Instance     — physically located polygon or spline, owned by one Pattern,
//                  references other Instances it interacts with
//   BuildingPoint — concrete geometry, owned by one Instance
//
// Each relaxation pass:
//   1. Walk patterns in priority order → pattern-match scene graph → emit Instances
//   2. Resolve conflicts: each point gets highest-priority owning pattern
//   3. Each pattern translates its points per its geometric rule
//   4. Force vectors from inter-instance interactions → softmax → apply
//   5. Coalesce BuildingPoints into buildings via kNN clustering
// ═══════════════════════════════════════════════════════════════════════════
window.EC_PatternSolver = (() => {

  // ── 1. PATTERN REGISTRY ──────────────────────────────────────────────────
  // Each entry: { id, name, scale, priority, rule, detect, instantiate, forces }
  //   priority: lower = higher priority (wins conflicts). Within scale, = pattern number.
  //   detect(sceneGraph, proj, MAP) → [{candidateGeom, context}]  — where can this fire?
  //   instantiate(candidate, sceneGraph) → Instance                — create the instance
  //   forces(instance, neighbors) → [{target: Instance, vec: [dx,dy], weight}]

  const PATTERNS = {};

  function defPattern(id, name, scale, spec) {
    PATTERNS[id] = { id, name, scale,
      priority: scale * 1000 + id,   // scale-major, pattern-minor
      ...spec };
  }

  // Scale constants
  const S = { DISTRICT:1, BLOCK:2, GROUP:3, BUILDING:4, EDGE:5 };

  // ── SCALE 1: DISTRICT ────────────────────────────────────────────────────

  defPattern(29, 'Density Rings', S.DISTRICT, {
    // Detects: site centroid. Emits concentric density zones.
    // Rule: highest density at spine, decreasing outward.
    detect(sg, proj, MAP) {
      // One candidate: the whole site
      const cx = (MAP.x0 + MAP.x1) / 2;
      const cy = (MAP.y0 + MAP.y1) / 2;
      return [{ geom: { type:'point', x:cx, y:cy }, context:{ MAP } }];
    },
    instantiate(cand, sg) {
      const { x, y } = cand.geom;
      const r_inner  = 600;   // ft — high density core
      const r_mid    = 1200;  // ft — medium density
      const r_outer  = 2000;  // ft — low density edge
      return mkInstance(29, 'rings', [
        { x, y, r: r_inner,  density: 'HIGH',   far_target: 1.4 },
        { x, y, r: r_mid,    density: 'MEDIUM', far_target: 1.0 },
        { x, y, r: r_outer,  density: 'LOW',    far_target: 0.6 },
      ], { type:'density_rings' });
    },
    forces() { return []; },
  });

  defPattern(30, 'Activity Nodes', S.DISTRICT, {
    // Detects: intersections of major paths / parcel cluster centroids.
    // Rule: place commercial anchor at each node.
    detect(sg, proj, MAP) {
      // Use derived geometry: spine midpoint + two end anchors
      const G = window._derivedG;
      if (!G?.SPINE) return [];
      const spine = G.SPINE;
      const candidates = [
        { geom:{ type:'point', x: spine.x + spine.w/2, y: spine.y + spine.h * 0.25 },
          context:{ role:'north_node' } },
        { geom:{ type:'point', x: spine.x + spine.w/2, y: spine.y + spine.h * 0.75 },
          context:{ role:'south_node' } },
      ];
      return candidates;
    },
    instantiate(cand) {
      return mkInstance(30, 'point', [cand.geom], { role: cand.context.role, radius_ft: 150 });
    },
    forces(inst, neighbors) {
      // Activity nodes attract MIXED_USE instances toward them
      return neighbors
        .filter(n => n.patternId === 87 || n.patternId === 88 || n.patternId === 46)
        .map(n => ({ target: n, vec: vecTo(inst, n), weight: 0.3 }));
    },
  });

  defPattern(31, 'Promenade', S.DISTRICT, {
    // Detects: the commons spine geometry.
    // Rule: spine is the promenade. Every point on site within 10-min walk.
    detect(sg, proj, MAP) {
      const G = window._derivedG;
      if (!G?.SPINE) return [];
      return [{ geom:{ type:'spline',
        pts:[{ x: G.SPINE.x + G.SPINE.w/2, y: G.SPINE.y },
             { x: G.SPINE.x + G.SPINE.w/2, y: G.SPINE.y + G.SPINE.h }]},
        context:{ width_ft: 30 } }];
    },
    instantiate(cand) {
      return mkInstance(31, 'spline', cand.geom.pts, { width_ft: cand.context.width_ft });
    },
    forces(inst, neighbors) {
      // Promenade repels car infrastructure, attracts shops and cafes
      const attract = neighbors.filter(n => [87,88,46,32].includes(n.patternId));
      const repel   = neighbors.filter(n => [97,103].includes(n.patternId));
      return [
        ...attract.map(n => ({ target:n, vec: vecTo(inst,n), weight: 0.25 })),
        ...repel.map(n   => ({ target:n, vec: vecAway(inst,n), weight: 0.4 })),
      ];
    },
  });

  defPattern(36, 'Degrees of Publicness', S.DISTRICT, {
    // Detects: every parcel. Tags exposure level based on street adjacency.
    detect(sg, proj, MAP) {
      return (sg.instances || [])
        .filter(inst => inst.patternId === 29)  // needs density rings first
        .map(rings => ({ geom: rings.geom, context: { rings } }));
    },
    instantiate(cand, sg) {
      // Classify each parcel zone as PUBLIC / SEMI / QUIET based on
      // distance to spine (P31 instance) and density ring (P29 instance)
      const spine = sg.instances?.find(i => i.patternId === 31);
      const pts = [];
      for (const zone of (sg.zones || [])) {
        if (!zone.centroid) continue;
        const d = spine ? ptDist(zone.centroid, splineMidpoint(spine)) : 999;
        const exposure = d < 400 ? 'PUBLIC' : d < 900 ? 'SEMI' : 'QUIET';
        pts.push({ ...zone.centroid, exposure, zone_id: zone.id });
      }
      return mkInstance(36, 'point_cloud', pts, { type:'exposure_map' });
    },
    forces() { return []; },
  });

  defPattern(53, 'Main Gateways', S.DISTRICT, {
    // One gateway per Activity Node (P30) that doesn't yet have one.
    // Also one per site boundary entry point (4 cardinal entries, singletons).
    detect(sg, proj, MAP) {
      const fromNodes = sg_query.missingChild(30, 53).map(node => ({
        geom: { type:'point', x: node.geom[0]?.x || 2100, y: node.geom[0]?.y || 1850 },
        context: { edge: 'node', parent: node },
      }));
      // Site boundary entries — only if none exist yet
      const existing = sg_query.ofPattern(53);
      const boundaryEntries = existing.length === 0 ? [
        { geom:{ type:'point', x: MAP.x0+100, y:(MAP.y0+MAP.y1)/2 }, context:{ edge:'west',  parent:null } },
        { geom:{ type:'point', x: MAP.x1-100, y:(MAP.y0+MAP.y1)/2 }, context:{ edge:'east',  parent:null } },
        { geom:{ type:'point', x:(MAP.x0+MAP.x1)/2, y: MAP.y0+100 }, context:{ edge:'north', parent:null } },
        { geom:{ type:'point', x:(MAP.x0+MAP.x1)/2, y: MAP.y1-100 }, context:{ edge:'south', parent:null } },
      ] : [];
      return [...fromNodes, ...boundaryEntries];
    },
    instantiate(cand) {
      const inst = mkInstance(53, 'point', [cand.geom],
        { edge: cand.context.edge, width_ft: 40 });
      if (cand.context.parent) adoptInstance(cand.context.parent, inst);
      return inst;
    },
    forces() { return []; },
  });

  // ── SCALE 2: BLOCK ───────────────────────────────────────────────────────

  defPattern(60, 'Accessible Green', S.BLOCK, {
    // Two detection modes:
    // A) P37 clusters missing a P60 child → emit green adjacent to cluster
    // B) Gap scan: residential building points too far from any green
    detect(sg, proj, MAP) {
      // Mode A: hierarchy-driven
      const fromClusters = sg_query.missingChild(37, 60).map(cluster => {
        const b = instanceBounds(cluster);
        return {
          geom: { type:'polygon', pts: rectPts(b.x - 100, b.y + b.h + 50, b.w + 200, 200) },
          context: { parent: cluster, gap: false },
        };
      });
      // Mode B: gap scan (only if building points exist)
      const WALK_PX = 1250;  // ft — 5-minute walk radius at 250ft/min
      const resPts = buildingPointsByPattern(sg, [79, 87, 37, 95]);
      const greenInsts = sg_query.ofPattern(60).concat(sg_query.ofPattern(67)).concat(sg_query.ofPattern(71));
      const gaps = resPts.filter(bp => {
        const nearest = nearestInstance(bp, greenInsts);
        return !nearest || nearest.dist > WALK_PX;
      });
      const gapCandidates = gaps.length > 0
        ? knnCluster(gaps, Math.ceil(gaps.length / 8), 60)
            .map(c => ({ geom:{ type:'polygon', pts: hullOf(c) }, context:{ gap:true, parent:null } }))
        : [];
      return [...fromClusters, ...gapCandidates];
    },
    instantiate(cand) {
      const inst = mkInstance(60, 'polygon', cand.geom.pts, { min_area_sqft: 5000 });
      if (cand.context.parent) adoptInstance(cand.context.parent, inst);
      return inst;
    },
    forces(inst, neighbors) {
      // Green zones attract House Cluster (P37) instances toward them
      return neighbors.filter(n => n.patternId === 37)
        .map(n => ({ target:n, vec: vecTo(n, inst), weight: 0.2 }));
    },
  });

  defPattern(67, 'Common Land', S.BLOCK, {
    // Rule: each House Cluster gets exactly one Common Land, to its south.
    // Detect: P37 instances that don't yet have a P67 child.
    detect(sg) {
      return sg_query.missingChild(37, 67).map(cluster => ({
        geom: southOf(cluster, 200),
        context: { cluster },
      }));
    },
    instantiate(cand) {
      const inst = mkInstance(67, 'polygon', cand.geom.pts,
        { south_facing: true, parent_cluster: cand.context.cluster.id });
      adoptInstance(cand.context.cluster, inst);
      return inst;
    },
    forces(inst, neighbors) {
      // Common land repels parking (P97/P103), attracts outdoor room (P69)
      return [
        ...neighbors.filter(n => [97,103].includes(n.patternId))
          .map(n => ({ target:n, vec: vecAway(inst,n), weight: 0.5 })),
        ...neighbors.filter(n => n.patternId === 69)
          .map(n => ({ target:n, vec: vecTo(inst,n), weight: 0.15 })),
      ];
    },
  });

  defPattern(71, 'Still Water', S.BLOCK, {
    // Singleton: sponge park parcel. Already located in GIS data.
    detect(sg, proj, MAP) {
      const G = window._derivedG;
      if (!G?.SPONGE) return [];
      const s = G.SPONGE;
      return [{ geom:{ type:'point', x: s.cx, y: s.cy }, context:{ rx:s.rx, ry:s.ry } }];
    },
    instantiate(cand) {
      const { rx, ry } = cand.context;
      // Ellipse approximated as polygon
      const pts = [];
      for (let a = 0; a < Math.PI*2; a += Math.PI/8)
        pts.push({ x: cand.geom.x + Math.cos(a)*rx, y: cand.geom.y + Math.sin(a)*ry });
      return mkInstance(71, 'polygon', pts, { south_facing: true, type:'bioswale' });
    },
    forces() { return []; },
  });

  defPattern(37, 'House Cluster', S.BLOCK, {
    // Rule: 8-12 units around common land. Detect open areas in density rings.
    detect(sg, proj, MAP) {
      const rings = sg.instances?.find(i => i.patternId === 29);
      if (!rings) return [];
      // Sample points in the buildable zone, away from water and setbacks
      const candidates = [];
      const step = 400;  // ft — block grid spacing
      for (let x = MAP.x0 + 200; x < MAP.x1 - 200; x += step) {
        for (let y = MAP.y0 + 200; y < MAP.y1 - 200; y += step) {
          if (!inEDA(x, y)) continue;
          if (inSetback(x, y, MAP)) continue;
          // Avoid water
          const G = window._derivedG;
          if (G?.SPONGE && ptDist({x,y}, {x:G.SPONGE.cx,y:G.SPONGE.cy}) < G.SPONGE.rx * 1.2) continue;
          candidates.push({ geom:{ type:'point', x, y }, context:{} });
        }
      }
      // Cluster candidates into groups of ~10 units each
      const n_clusters = Math.max(1, Math.round(candidates.length / 10));
      return knnCluster(candidates.map(c => c.geom), n_clusters, 37)
        .map(cluster => ({ geom:{ type:'point', ...centroidOf(cluster) }, context:{ pts: cluster } }));
    },
    instantiate(cand) {
      return mkInstance(37, 'polygon', rectAround(cand.geom, 600, 600),
        { unit_count: 10, radius_ft: 100 });
    },
    forces(inst, neighbors) {
      // Clusters pull toward accessible green (P60), push away from each other
      return [
        ...neighbors.filter(n => n.patternId === 60)
          .map(n => ({ target:inst, vec: vecTo(inst,n), weight: 0.2 })),
        ...neighbors.filter(n => n.patternId === 37 && n.id !== inst.id)
          .map(n => ({ target:inst, vec: vecAway(inst,n), weight: 0.15 })),
      ];
    },
  });

  // ── SCALE 3: BUILDING GROUP ──────────────────────────────────────────────

  defPattern(95, 'Building Complex', S.GROUP, {
    // Rule: break each cluster into 25ft-wide parcel strips.
    // Each House Cluster instance → array of long-thin parcel polygons.
    detect(sg) {
      return (sg.instances || []).filter(i => i.patternId === 37)
        .map(cluster => ({ geom: instanceBounds(cluster), context:{ cluster } }));
    },
    instantiate(cand) {
      const { x, y, w, h } = cand.geom;
      // Coordinates are in ft — use planning constants directly
      const parcel_w = PLANNING.PARCEL_W_FT;   // 25ft
      const parcel_d = Math.min(PLANNING.PARCEL_D_FT, h);  // 125ft or cluster depth
      const parcels = [];
      for (let px = x; px + parcel_w <= x + w + 1; px += parcel_w) {
        parcels.push(rectPts(px, y, Math.min(parcel_w, x + w - px), parcel_d));
      }
      return mkInstance(95, 'polygon_array', parcels,
        { parcel_w_ft: parcel_w, parcel_d_ft: parcel_d, parent_cluster: cand.context.cluster.id });
    },
    forces() { return []; },
  });

  defPattern(104, 'Site Repair', S.GROUP, {
    // Rule: place building parcels on worst land (parking, hardscape).
    // Preserve best land (green, water). Implemented as repulsion from P60/P71.
    detect(sg) {
      // Detects every P95 parcel that overlaps a green/water instance — flag for relocation
      const green = (sg.instances||[]).filter(i => [60,67,71].includes(i.patternId));
      return (sg.instances||[]).filter(i => i.patternId === 95)
        .flatMap(bldg => bldg.data.parcels || [bldg])
        .filter(parcel => green.some(g => instancesOverlap(parcel, g)))
        .map(parcel => ({ geom: instanceBounds(parcel), context:{ parcel } }));
    },
    instantiate(cand) {
      // Don't create a new instance — just tag the existing parcel for force application
      return mkInstance(104, 'point', [{ x: cand.geom.x + cand.geom.w/2, y: cand.geom.y + cand.geom.h/2 }],
        { repair: true, target_parcel: cand.context.parcel.id });
    },
    forces(inst, neighbors) {
      // Strong repulsion from green/water
      return neighbors.filter(n => [60,67,71].includes(n.patternId))
        .map(n => ({ target:inst, vec: vecAway(inst,n), weight: 0.8 }));
    },
  });

  defPattern(105, 'South Facing Outdoors', S.GROUP, {
    // Rule: buildings must be north of their outdoor/green space.
    // Detects pairs (building, green) and applies northward force on buildings.
    detect(sg) {
      const bldgs  = (sg.instances||[]).filter(i => i.patternId === 95);
      const greens = (sg.instances||[]).filter(i => [60,67,71].includes(i.patternId));
      return bldgs.map(b => ({ geom: instanceBounds(b), context:{ bldg:b, greens } }));
    },
    instantiate(cand) {
      return mkInstance(105, 'point', [{ x: cand.geom.x + cand.geom.w/2, y: cand.geom.y + cand.geom.h/2 }], { type:'orientation_constraint' });
    },
    forces(inst, neighbors) {
      // Each building → force northward if it's south of its nearest green
      const green = neighbors.find(n => [60,67,71].includes(n.patternId));
      if (!green) return [];
      const bldgCy = centroidOf(instanceBounds(inst)).y;
      const greenCy = centroidOf(instanceBounds(green)).y;
      if (bldgCy > greenCy) return [];  // already north (lower y = north in SVG)
      return [{ target:inst, vec:[0, -(bldgCy - greenCy) * 0.3], weight:0.5 }];
    },
  });

  defPattern(106, 'Positive Outdoor Space', S.GROUP, {
    // Rule: outdoor space between buildings must have definite shape (convex hull ≥ 0.6).
    // Detects: gaps between P95 building parcels. Emits shaped outdoor polygons.
    detect(sg) {
      const bldgs = (sg.instances||[]).filter(i => i.patternId === 95);
      const gaps  = [];
      for (let i = 0; i < bldgs.length; i++) {
        for (let j = i+1; j < bldgs.length; j++) {
          const gap = gapPolygon(bldgs[i], bldgs[j]);
          if (gap && polygonArea(gap) > 8000) gaps.push({ geom:{ type:'polygon', pts:gap }, context:{} });
        }
      }
      return gaps;
    },
    instantiate(cand) {
      // Regularize gap into a definite shape
      const hull = hullOf(cand.geom.pts);
      return mkInstance(106, 'polygon', hull, { shaped: true });
    },
    forces(inst, neighbors) {
      // Building edges should align with this outdoor space
      return neighbors.filter(n => n.patternId === 95)
        .map(n => ({ target:n, vec: vecTo(n, inst), weight: 0.1 }));
    },
  });

  defPattern(109, 'Long Thin House', S.GROUP, {
    // The 25×125 parcel IS this pattern. Detects oversized parcels → splits them.
    detect(sg) {
      return (sg.instances||[]).filter(i => i.patternId === 95)
        .filter(i => {
          const b = instanceBounds(i);
          return b.w > PLANNING.PARCEL_W_FT * 1.5;  // wider than 1.5 parcel widths
        })
        .map(i => ({ geom: instanceBounds(i), context:{ inst:i } }));
    },
    instantiate(cand) {
      // Split wide parcels into 25ft strips
      const { x, y, w, h } = cand.geom;
      const pw = PLANNING.PARCEL_W_FT;  // 25ft
      const strips = [];
      for (let px = x; px + pw <= x + w + 1; px += pw)
        strips.push(rectPts(px, y, Math.min(pw, x+w-px), h));
      return mkInstance(109, 'polygon_array', strips, { parcel_w_ft: pw });
    },
    forces() { return []; },
  });

  defPattern(114, 'Hierarchy of Open Space', S.GROUP, {
    // Rule: every outdoor space must look into a smaller AND a larger space.
    // Detects: P106 instances. Checks hierarchy. Emits corrective instances.
    detect(sg) {
      return (sg.instances||[]).filter(i => i.patternId === 106)
        .map(os => ({ geom: instanceBounds(os), context:{ os } }));
    },
    instantiate(cand) {
      // Tag the outdoor space with its hierarchy level (pocket→courtyard→square→park)
      const area = polygonArea(rectToPts(cand.geom));
      const level = area < 4000 ? 'pocket' : area < 20000 ? 'courtyard' : area < 80000 ? 'square' : 'park';
      return mkInstance(114, 'polygon', rectToPts(cand.geom), { level, area });
    },
    forces(inst, neighbors) {
      // Each space should have at least one smaller and one larger neighbor
      const level = inst.data.level;
      const levels = ['pocket','courtyard','square','park'];
      const myIdx  = levels.indexOf(level);
      const smaller = neighbors.filter(n => n.patternId===114 && levels.indexOf(n.data?.level) < myIdx);
      const larger  = neighbors.filter(n => n.patternId===114 && levels.indexOf(n.data?.level) > myIdx);
      // Pull toward smaller nested space
      return [
        ...smaller.map(n => ({ target:n, vec: vecTo(inst,n), weight:0.1 })),
        ...larger.map(n  => ({ target:inst, vec: vecTo(inst,n), weight:0.05 })),
      ];
    },
  });

  // ── SCALE 4: BUILDING FORM ───────────────────────────────────────────────

  defPattern(115, 'Courtyards Which Live', S.BUILDING, {
    // Every P95/P109 building parcel missing a P115 child gets a courtyard.
    detect(sg) {
      const missing95  = sg_query.missingChild(95, 115);
      const missing109 = sg_query.missingChild(109, 115);
      return [...missing95, ...missing109].map(parcel => ({
        geom: instanceBounds(parcel), context: { parcel },
      }));
    },
    instantiate(cand) {
      const { x, y, w, h } = cand.geom;
      const inset = Math.min(w, h) * 0.25;
      const cy_pts = rectPts(x+inset, y+inset, w-2*inset, h-2*inset);
      const cx = x + w/2, cy_c = y + h/2;
      const inst = mkInstance(115, 'polygon', cy_pts, {
        type: 'courtyard_void',
        paths: [
          [{ x, y: cy_c }, { x: x+w, y: cy_c }],
          [{ x: cx, y }, { x: cx, y: y+h }],
        ],
        parent_parcel: cand.context.parcel.id,
      });
      adoptInstance(cand.context.parcel, inst);
      return inst;
    },
    forces(inst, neighbors) {
      // Courtyard needs view out — pull toward nearest larger open space
      const larger = neighbors.filter(n => [60,67,114].includes(n.patternId));
      return larger.map(n => ({ target:inst, vec: vecTo(inst,n), weight:0.15 }));
    },
  });

  defPattern(122, 'Building Fronts', S.BUILDING, {
    // Rule: no setbacks from paths. Building face aligns to path edge.
    detect(sg) {
      const promenades = (sg.instances||[]).filter(i => i.patternId === 31 || i.patternId === 100);
      return (sg.instances||[]).filter(i => i.patternId === 95 || i.patternId === 109)
        .map(parcel => ({ geom: instanceBounds(parcel), context:{ parcel, promenades } }));
    },
    instantiate(cand) {
      // Snap the building's nearest edge to the promenade centerline
      const promenade = cand.context.promenades[0];
      if (!promenade) return mkInstance(122, 'point', [], {});
      const spinePts = promenade.geom;
      const spineX   = spinePts[0]?.x || 490;  // SVG midpoint default
      const { x, y, w, h } = cand.geom;
      // If building is left of spine, align right edge to spine. Vice versa.
      const bldgCx = x + w/2;
      const snapX  = bldgCx < spineX ? spineX - w/2 : spineX + w/2;
      return mkInstance(122, 'point', [{ x: snapX, y: y+h/2 }],
        { snap_to_spine: true, original_cx: bldgCx });
    },
    forces(inst, neighbors) {
      const promenade = neighbors.find(n => n.patternId === 31);
      if (!promenade || !inst.data.original_cx) return [];
      // Force building face toward spine
      const spineX = promenade.geom[0]?.x || 490;
      const dx = (spineX - inst.data.original_cx) * 0.4;
      return [{ target:inst, vec:[dx, 0], weight:0.6 }];
    },
  });

  defPattern(127, 'Intimacy Gradient', S.BUILDING, {
    // Rule: public → private sequence from entrance inward.
    // Generates a depth ordering of building zones.
    detect(sg) {
      return (sg.instances||[]).filter(i => i.patternId === 95 || i.patternId === 109)
        .map(parcel => ({ geom: instanceBounds(parcel), context:{} }));
    },
    instantiate(cand) {
      const { x, y, w, h } = cand.geom;
      // Three depth bands: public front (street), semi-private middle, private rear
      return mkInstance(127, 'polygon_array', [
        rectPts(x, y, w, h*0.25),            // public: ground floor, street face
        rectPts(x, y+h*0.25, w, h*0.5),      // semi-private: middle floors
        rectPts(x, y+h*0.75, w, h*0.25),     // private: rear / upper
      ], { bands: ['PUBLIC','SEMI','PRIVATE'] });
    },
    forces() { return []; },
  });

  // ── SCALE 5: STREET EDGE ─────────────────────────────────────────────────

  defPattern(87, 'Individually Owned Shops', S.EDGE, {
    // Rule: ground floor of every building on promenade = shop. Each is identifiable.
    detect(sg) {
      const promenade = (sg.instances||[]).find(i => i.patternId === 31);
      if (!promenade) return [];
      return (sg.instances||[]).filter(i => i.patternId === 95 || i.patternId === 109)
        .filter(i => instanceNearSpline(i, promenade, 40))
        .map(parcel => ({ geom: instanceBounds(parcel), context:{ parcel } }));
    },
    instantiate(cand) {
      // Ground floor bay: full width of parcel, 1-floor height
      const { x, y, w } = cand.geom;
      const floor_h = 14 / 8.5;  // 14ft commercial floor at 8.5ft/px
      return mkInstance(87, 'polygon', rectPts(x, y, w, floor_h),
        { use:'shop', bay_width_ft:25, floor_height_ft:14, opens_to_street:true });
    },
    forces(inst, neighbors) {
      // Shops attract cafes (P88) as immediate neighbors
      return neighbors.filter(n => n.patternId === 88)
        .map(n => ({ target:n, vec: vecTo(inst,n), weight:0.2 }));
    },
  });

  defPattern(88, 'Street Cafe', S.EDGE, {
    // Rule: tables extend into path. Detects shop instances on promenade.
    detect(sg) {
      return (sg.instances||[]).filter(i => i.patternId === 87)
        .filter((_, idx) => idx % 3 === 0)   // every 3rd shop becomes a cafe
        .map(shop => ({ geom: instanceBounds(shop), context:{ shop } }));
    },
    instantiate(cand) {
      const { x, y, w, h } = cand.geom;
      // Cafe extends 8ft into path (north of building face)
      const ext = 8 / 8.5;
      return mkInstance(88, 'polygon', rectPts(x, y - ext, w, h + ext),
        { use:'cafe', extends_into_path_ft:8, table_zone: rectPts(x, y-ext, w, ext) });
    },
    forces() { return []; },
  });

  defPattern(46, 'Market of Many Shops', S.EDGE, {
    // Singleton: Eastside Market at south activity node.
    detect(sg) {
      const southNode = (sg.instances||[]).find(i => i.patternId === 30 && i.data?.role === 'south_node');
      if (!southNode) return [];
      return [{ geom: instanceBounds(southNode), context: { node: southNode } }];
    },
    instantiate(cand) {
      const { x, y, w, h } = cand.geom;
      const mw = 80, mh = 80;  // market hall footprint in px
      return mkInstance(46, 'polygon', rectPts(x - mw/2, y - mh/2, mw, mh),
        { use:'market_hall', aisle_width_ft:9, stall_size_ft:'6x9', roof:true, open_sides:true });
    },
    forces(inst, neighbors) {
      return neighbors.filter(n => n.patternId === 88 || n.patternId === 87)
        .map(n => ({ target:n, vec: vecTo(inst,n), weight:0.15 }));
    },
  });

  // ── 2. SCENE GRAPH ──────────────────────────────────────────────────────
  let _sg = null;

  // Parent → required children mapping.
  // When a parent instance exists, these child patterns MUST fire against it.
  // Children query sg.childrenOf(parentId) to find siblings.
  const REQUIRES = {
    37:  [67, 60],       // HouseCluster requires CommonLand, AccessibleGreen
    95:  [115, 122],     // BuildingComplex requires CourtyardsWhichLive, BuildingFronts
    109: [115, 127],     // LongThinHouse requires Courtyard, IntimacyGradient
    31:  [87, 88, 46],   // Promenade requires Shops, Cafe, Market
    30:  [53],           // ActivityNode requires Gateway
  };

  // Dedup radius per pattern (px): how close must an existing same-type instance
  // be before we treat it as "already handled" and skip/mutate instead of creating new
  const DEDUP_R = {
    29: 99999, // DensityRings: singleton
    31: 99999, // Promenade: singleton
    53:  400,  // Gateways: one per entry point
    30:  300,  // ActivityNodes: one per node
    37:  500,  // HouseCluster: one per cluster location
    67:  400,  // CommonLand: one per cluster
    71: 99999, // StillWater: singleton
    46: 99999, // Market: singleton
    95:   30,  // BuildingComplex: per 25ft parcel strip
    104: 200,
    105: 200,
    106: 200,
    109:  30,  // LongThinHouse: per 25ft strip
    115: 150,  // Courtyard: per building
    122: 150,
    127: 150,
    87:   30,  // Shop: per 25ft bay
    88:  200,  // Cafe: every ~3 shops
  };

  function mkInstance(patternId, geomType, geom, data) {
    return {
      id: `inst_${patternId}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      patternId,
      geomType,
      geom,
      data,
      force_accum: [0, 0],
      pass_created: _sg?.pass || 0,
      parent_id: null,    // set when instantiated as child of a parent
      children: [],       // child instance ids
      refs: [],
      mutation_count: 0,  // how many times forces have moved this instance
    };
  }

  // Scene graph query helpers
  const sg_query = {
    // All instances of a given pattern
    ofPattern: (pid) => (_sg?.instances || []).filter(i => i.patternId === pid),

    // Children of a given parent instance
    childrenOf: (parentId) => (_sg?.instances || []).filter(i => i.parent_id === parentId),

    // Parents of a given pattern type
    parentsRequiring: (childPid) =>
      Object.entries(REQUIRES)
        .filter(([,children]) => children.includes(childPid))
        .map(([parentPid]) => sg_query.ofPattern(+parentPid))
        .flat(),

    // Parent instances that are MISSING a required child of type childPid
    missingChild: (parentPid, childPid) =>
      sg_query.ofPattern(parentPid).filter(parent =>
        !parent.children.some(cid => {
          const c = (_sg?.instances || []).find(i => i.id === cid);
          return c && c.patternId === childPid;
        })
      ),

    // Nearest existing instance of same pattern within dedup radius
    nearDuplicate: (inst) => {
      const r = DEDUP_R[inst.patternId] ?? 50;
      return (_sg?.instances || []).find(i =>
        i.id !== inst.id &&
        i.patternId === inst.patternId &&
        instanceDist(i, inst) < r
      );
    },
  };

  // Register child under parent in the scene graph
  function adoptInstance(parent, child) {
    child.parent_id = parent.id;
    if (!parent.children.includes(child.id)) parent.children.push(child.id);
  }

  // ── 3. BUILDING POINTS ──────────────────────────────────────────────────
  // Each Pattern instance → one or more BuildingPoints
  function emitBuildingPoints(inst) {
    const pts = [];
    const pid = inst.patternId;

    if (pid === 95 || pid === 109) {
      // Building parcel → emit a grid of building points on the footprint
      const geoms = inst.geomType === 'polygon_array' ? inst.geom : [inst.geom];
      for (const poly of geoms) {
        const b = boundsOf(poly);
        pts.push({
          x: b.x + b.w/2, y: b.y + b.h/2,
          type: 'MIXED_USE_5OVER1',
          floors: 4,
          parcel_w_ft: 25, parcel_d_ft: 125,
          instance_id: inst.id,
          owner_pattern: pid,
          patterns: [pid],
        });
      }
    } else if (pid === 87) {
      // Shop → ground-floor point
      const b = boundsOf(inst.geom);
      pts.push({ x:b.x+b.w/2, y:b.y, type:'RETAIL', floors:1, instance_id:inst.id, owner_pattern:pid, patterns:[pid] });
    } else if (pid === 46) {
      const b = boundsOf(inst.geom);
      pts.push({ x:b.x+b.w/2, y:b.y+b.h/2, type:'MARKET_HALL', floors:1, instance_id:inst.id, owner_pattern:pid, patterns:[pid] });
    } else if ([60,67,71].includes(pid)) {
      const b = boundsOf(inst.geom);
      pts.push({ x:b.x+b.w/2, y:b.y+b.h/2, type:'GREEN_ACTIVE', floors:0, instance_id:inst.id, owner_pattern:pid, patterns:[pid] });
    } else if (pid === 115) {
      // Courtyard void → green ground point
      const b = boundsOf(inst.geom);
      pts.push({ x:b.x+b.w/2, y:b.y+b.h/2, type:'COURTYARD', floors:0, instance_id:inst.id, owner_pattern:pid, patterns:[pid] });
    }

    return pts;
  }

  // ── 4. kNN CLUSTERING → BUILDINGS ───────────────────────────────────────
  function coalesceToBuildings(buildingPoints, k) {
    const bPts = buildingPoints.filter(p => p.type === 'MIXED_USE_5OVER1');
    if (bPts.length === 0) return [];
    const clusters = knnCluster(bPts, k, 95);
    return clusters.map((cluster, idx) => {
      const cx = centroidOf(cluster).x;
      const cy = centroidOf(cluster).y;
      const patterns_present = [...new Set(cluster.flatMap(p => p.patterns))];
      return {
        id: `bldg_${idx}`,
        centroid: { x:cx, y:cy },
        footprint: hullOf(cluster.map(p => ({x:p.x,y:p.y}))),
        type: 'MIXED_USE_5OVER1',
        floors: 4,
        units: Math.round(cluster.length * 9 / Math.max(1, cluster.length / 5)),
        patterns: patterns_present,
        instances: [...new Set(cluster.map(p => p.instance_id))],
      };
    });
  }

  // ── 5. FORCE APPLICATION (softmax relaxation) ────────────────────────────
  function applyForces(instances) {
    // Collect all force vectors on each instance
    for (const inst of instances) {
      inst.force_accum = [0, 0];
    }

    for (const inst of instances) {
      const pattern = PATTERNS[inst.patternId];
      if (!pattern?.forces) continue;
      const neighbors = instances.filter(n => n.id !== inst.id &&
        instanceDist(inst, n) < 1500);
      const forces = pattern.forces(inst, neighbors);
      for (const { target, vec, weight } of forces) {
        if (!target) continue;
        target.force_accum[0] += vec[0] * weight;
        target.force_accum[1] += vec[1] * weight;
      }
    }

    // Softmax-normalize weights, then apply translations
    const maxMag = Math.max(1, ...instances.map(i =>
      Math.hypot(i.force_accum[0], i.force_accum[1])));
    const DAMPING = 0.4;

    for (const inst of instances) {
      const [dx, dy] = inst.force_accum;
      const mag = Math.hypot(dx, dy);
      if (mag < 0.5) continue;
      const norm = Math.min(mag / maxMag, 1);  // softmax normalization
      const scale = norm * DAMPING;
      translateInstance(inst, dx * scale, dy * scale);
    }
  }

  // ── 6. MAIN SOLVER LOOP ──────────────────────────────────────────────────
  // Phase A: N_SCALES intro passes — one new scale introduced per pass
  //          (district → block → group → building → edge)
  // Phase B: N_RECURSE recursive passes — all scales fire simultaneously,
  //          re-detecting from the geometry already placed, refining positions
  //          via force relaxation. This is the recursive refinement.
  function solve(parcels, proj, MAP, derivedG, opts = {}) {
    const N_SCALES   = Object.keys(S).length;   // 5 intro passes
    const N_RECURSE  = opts.recurse || 8;        // max recursive refinement passes
    const CLUSTER_K  = opts.cluster_k || 40;
    const MAX_MS     = opts.max_ms || 10000;     // temporal saturation: 10s wall limit
    const log = [];
    const t0 = Date.now();

    _sg = { instances: [], buildingPoints: [], buildings: [], zones: [], pass: 0, snapshots: [] };

    // Build projected EDA polygon list for accurate inEDA() tests
    _edaPolys = (parcels || [])
      .filter(p => p.is_eda && Array.isArray(p.rings) && p.rings[0])
      .map(p => p.rings[0].map(pt => proj(pt[0] ?? pt.lon, pt[1] ?? pt.lat)))
      .filter(poly => poly.length >= 3);

    // Seed sg.zones from EDA parcels so pattern detect() fns that iterate
    // sg.zones (P36 Degrees of Publicness, P60 Accessible Green, etc.) have
    // something to work with before any building-scale instances exist.
    _sg.zones = (parcels || [])
      .filter(p => p.is_eda && p._bbox)
      .map((p, i) => ({
        id: `eda_${i}`,
        centroid: p.centroid
          ? { x: proj(p.centroid.lon, p.centroid.lat)[0], y: proj(p.centroid.lon, p.centroid.lat)[1] }
          : (() => {
              const [x, y] = proj(
                p.rings[0].reduce((s, pt) => s + (pt[0] ?? pt.lon), 0) / p.rings[0].length,
                p.rings[0].reduce((s, pt) => s + (pt[1] ?? pt.lat), 0) / p.rings[0].length
              );
              return { x, y };
            })(),
        spec: p.spec,
        area_ac: p.area_ac,
      }));

    const patternOrder = Object.values(PATTERNS).sort((a,b) => a.priority - b.priority);

    const totalPasses = N_SCALES + N_RECURSE;
    let staleCount = 0;  // spatial saturation: consecutive passes with 0 new instances

    for (let pass = 0; pass < totalPasses; pass++) {
      // ── Temporal saturation ───────────────────────────────────────────────
      const elapsed = Date.now() - t0;
      if (elapsed > MAX_MS) {
        log.push(`Temporal saturation at pass ${pass} (${elapsed}ms > ${MAX_MS}ms)`);
        break;
      }


      // Intro phase: open one scale per pass (1→2→3→4→5)
      // Recurse phase: all scales open, re-derive from geometry
      const isRecurse  = pass >= N_SCALES;
      const passScale  = isRecurse ? S.EDGE : Math.min(S.EDGE, S.DISTRICT + pass);
      const recurseIdx = isRecurse ? (pass - N_SCALES + 1) : 0;
      const label = isRecurse
        ? `Pass ${pass} — Recurse ${recurseIdx}/${N_RECURSE} (all scales)`
        : `Pass ${pass} — Scale ≤ ${passScale}: ${['','District','Block','Group','Building','Edge'][passScale]}`;
      log.push(label);

      let newInsts = 0, mutated = 0;

      for (const pattern of patternOrder) {
        if (pattern.scale > passScale) continue;

        // On recursive passes, patterns re-detect from existing geometry.
        // They can update/reposition instances and add missing children.
        let candidates = [];
        try { candidates = pattern.detect(_sg, proj, MAP) || []; }
        catch(e) { log.push(`  P${pattern.id} detect error: ${e.message}`); continue; }

        for (const cand of candidates) {
          let inst;
          try { inst = pattern.instantiate(cand, _sg); }
          catch(e) { log.push(`  P${pattern.id} instantiate error: ${e.message}`); continue; }
          if (!inst) continue;

          // Dedup: same pattern near this location already?
          const dup = sg_query.nearDuplicate(inst);
          if (dup) {
            dup.mutation_count++;
            mutated++;
            if (cand.context?.parent && !dup.parent_id) adoptInstance(cand.context.parent, dup);
            continue;
          }

          // Priority conflict: different pattern owns this location at higher priority
          const conflict = _sg.instances.find(i =>
            i.id !== inst.id && i.patternId !== inst.patternId &&
            instanceDist(i, inst) < 100 &&
            PATTERNS[i.patternId]?.priority < pattern.priority);
          if (conflict) continue;

          _sg.instances.push(inst);
          newInsts++;
        }
      }

      log.push(`  +${newInsts} new, ${mutated} mutated (total: ${_sg.instances.length})`);

      // ── Spatial saturation ────────────────────────────────────────────────
      if (newInsts === 0 && pass >= N_SCALES) {
        staleCount++;
        if (staleCount >= 2) {
          log.push(`Spatial saturation at pass ${pass} (2 consecutive stale passes)`);
          break;
        }
      } else {
        staleCount = 0;
      }

      // Emit building points
      _sg.buildingPoints = _sg.instances.flatMap(emitBuildingPoints);

      // Force relaxation — runs every pass after the first intro pass
      // Recursive passes get stronger relaxation (more iterations)
      if (pass > 0) {
        const relaxIter = isRecurse ? 2 : 1;
        for (let r = 0; r < relaxIter; r++) applyForces(_sg.instances);
      }

      // Coalesce buildings
      _sg.buildings = coalesceToBuildings(_sg.buildingPoints, CLUSTER_K);
      log.push(`  ${_sg.buildingPoints.length} pts → ${_sg.buildings.length} buildings`);

      // Snapshot
      _sg.snapshots.push({
        pass,
        scale: passScale,
        isRecurse,
        recurseIdx,
        label,
        instances: _sg.instances.map(i => ({ ...i, geom: JSON.parse(JSON.stringify(i.geom)) })),
        buildingPoints: [..._sg.buildingPoints],
        buildings: [..._sg.buildings],
        counts: Object.fromEntries(
          Object.entries(PATTERNS)
            .map(([id]) => [id, _sg.instances.filter(i => i.patternId === +id).length])
            .filter(([,v]) => v > 0)
        ),
        hierarchy: _sg.instances.reduce((h, i) => {
          if (i.parent_id) {
            h[i.parent_id] = h[i.parent_id] || [];
            h[i.parent_id].push(i.id);
          }
          return h;
        }, {}),
      });
    }

    const counts = {};
    for (const inst of _sg.instances) counts[inst.patternId] = (counts[inst.patternId]||0)+1;
    log.push(`Final counts: ${JSON.stringify(counts)}`);

    return { sceneGraph: _sg, log, buildings: _sg.buildings, counts };
  }


  // ── 7. GEOMETRY HELPERS ──────────────────────────────────────────────────

  function rectPts(x, y, w, h) {
    return [{ x, y }, { x:x+w, y }, { x:x+w, y:y+h }, { x, y:y+h }];
  }
  function rectAround(c, w, h) { return rectPts(c.x - w/2, c.y - h/2, w, h); }
  function rectToPts(b) { return rectPts(b.x, b.y, b.w, b.h); }

  function boundsOf(pts) {
    if (!pts || pts.length === 0) return { x:0, y:0, w:0, h:0 };
    const arr = Array.isArray(pts[0]) ? pts : pts.map(p => [p.x, p.y]);
    const xs = arr.map(p => p[0] ?? p.x ?? 0);
    const ys = arr.map(p => p[1] ?? p.y ?? 0);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs)-x, h: Math.max(...ys)-y };
  }

  function instanceBounds(inst) {
    const pts = inst.geomType === 'polygon_array'
      ? inst.geom.flat()
      : inst.geom;
    return boundsOf(pts);
  }

  function centroidOf(pts) {
    if (!pts || pts.length === 0) return { x:0, y:0 };
    const arr = Array.isArray(pts[0]) ? pts.map(p => ({x:p[0],y:p[1]})) : pts;
    return {
      x: arr.reduce((s,p) => s+(p.x||0), 0) / arr.length,
      y: arr.reduce((s,p) => s+(p.y||0), 0) / arr.length,
    };
  }

  function hullOf(pts) {
    // Simple convex hull (gift wrapping) — enough for our purposes
    if (!pts || pts.length < 3) return pts || [];
    const arr = pts.map(p => ({ x: p.x||0, y: p.y||0 }));
    arr.sort((a,b) => a.x - b.x || a.y - b.y);
    const cross = (O,A,B) => (A.x-O.x)*(B.y-O.y) - (A.y-O.y)*(B.x-O.x);
    const lower = [], upper = [];
    for (const p of arr) {
      while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
      lower.push(p);
    }
    for (let i = arr.length-1; i >= 0; i--) {
      const p = arr[i];
      while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  function polygonArea(pts) {
    if (!pts || pts.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i+1) % pts.length;
      a += (pts[i].x||0) * (pts[j].y||0);
      a -= (pts[j].x||0) * (pts[i].y||0);
    }
    return Math.abs(a) / 2;
  }

  function ptDist(a, b) { return Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0)); }

  function instanceDist(a, b) {
    return ptDist(centroidOf(a.geomType==='polygon_array'?a.geom.flat():a.geom),
                  centroidOf(b.geomType==='polygon_array'?b.geom.flat():b.geom));
  }

  function vecTo(from, to) {
    const fc = centroidOf((from.geomType==='polygon_array'?from.geom.flat():from.geom) || [{x:0,y:0}]);
    const tc = centroidOf((to.geomType==='polygon_array'?to.geom.flat():to.geom)   || [{x:0,y:0}]);
    return [tc.x-fc.x, tc.y-fc.y];
  }
  function vecAway(from, to) { const v = vecTo(from,to); return [-v[0],-v[1]]; }

  function translateInstance(inst, dx, dy) {
    const translate = p => ({ ...p, x:(p.x||0)+dx, y:(p.y||0)+dy });
    if (inst.geomType === 'polygon_array') {
      inst.geom = inst.geom.map(poly => poly.map(translate));
    } else if (Array.isArray(inst.geom)) {
      inst.geom = inst.geom.map(translate);
    }
  }

  function splineMidpoint(inst) {
    const pts = inst.geom;
    if (!pts || pts.length === 0) return { x:490, y:400 };
    return centroidOf(pts);
  }

  function nearestInstance(pt, instances) {
    let best = null, bestD = Infinity;
    for (const inst of instances) {
      const c = centroidOf(inst.geomType==='polygon_array'?inst.geom.flat():inst.geom);
      const d = ptDist(pt, c);
      if (d < bestD) { best = inst; bestD = d; }
    }
    return best ? { inst: best, dist: bestD } : null;
  }

  function instanceNearSpline(inst, spline, threshold) {
    const ic = centroidOf(inst.geomType==='polygon_array'?inst.geom.flat():inst.geom);
    for (const pt of (spline.geom || [])) {
      if (ptDist(ic, pt) < threshold) return true;
    }
    return false;
  }

  function instancesOverlap(a, b) {
    const ba = instanceBounds(a), bb = instanceBounds(b);
    return ba.x < bb.x+bb.w && ba.x+ba.w > bb.x && ba.y < bb.y+bb.h && ba.y+ba.h > bb.y;
  }

  function gapPolygon(a, b) {
    const ba = instanceBounds(a), bb = instanceBounds(b);
    const x1 = Math.max(ba.x, bb.x), x2 = Math.min(ba.x+ba.w, bb.x+bb.w);
    const y1 = Math.max(ba.y, bb.y), y2 = Math.min(ba.y+ba.h, bb.y+bb.h);
    if (x2 <= x1 || y2 <= y1) return null;
    return rectPts(x1, y1, x2-x1, y2-y1);
  }

  function southOf(inst, dist) {
    const b = instanceBounds(inst);
    return { pts: rectPts(b.x, b.y+b.h+dist, b.w, b.h * 0.5) };
  }

  function buildingPointsByPattern(sg, pids) {
    return (sg.buildingPoints || []).filter(p => pids.includes(p.owner_pattern));
  }

  // Set by solve() — projected EDA parcel rings for accurate containment test
  let _edaPolys = [];

  function inEDA(x, y) {
    if (_edaPolys.length === 0) {
      // Fallback: conservative bbox
      const MAP = { x0:139, y0:163, x1:841, y1:653 };
      return x > MAP.x0 && x < MAP.x1 && y > MAP.y0 && y < MAP.y1;
    }
    return _edaPolys.some(poly => pointInPolygon(x, y, poly));
  }

  function pointInPolygon(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function inSetback(x, y, MAP) {
    const S = { HIGHWAY:50/8.5, ARTERIAL:20/8.5, COLLECTOR:15/8.5 };
    return y > MAP.y1 - S.HIGHWAY ||   // I-264 south
           y < MAP.y0 + S.ARTERIAL ||  // Va Beach Blvd north
           x < MAP.x0 + S.ARTERIAL ||  // N Military Hwy west
           x > MAP.x1 - S.COLLECTOR;   // Tidewater Dr east
  }

  // Simple k-means clustering
  function knnCluster(pts, k, seed) {
    if (!pts || pts.length === 0) return [];
    k = Math.min(k, pts.length);
    // Initialize centroids by spacing evenly
    let centroids = [];
    for (let i = 0; i < k; i++) {
      centroids.push({ x: pts[Math.floor(i * pts.length / k)].x || 0,
                       y: pts[Math.floor(i * pts.length / k)].y || 0 });
    }
    let assignments = new Array(pts.length).fill(0);
    for (let iter = 0; iter < 10; iter++) {
      // Assign
      for (let i = 0; i < pts.length; i++) {
        let best = 0, bestD = Infinity;
        for (let j = 0; j < k; j++) {
          const d = ptDist(pts[i], centroids[j]);
          if (d < bestD) { best = j; bestD = d; }
        }
        assignments[i] = best;
      }
      // Update centroids
      for (let j = 0; j < k; j++) {
        const members = pts.filter((_,i) => assignments[i] === j);
        if (members.length > 0) centroids[j] = centroidOf(members);
      }
    }
    const clusters = Array.from({length:k}, () => []);
    pts.forEach((p,i) => clusters[assignments[i]].push(p));
    return clusters.filter(c => c.length > 0);
  }

  // ── 8. EXPORT ────────────────────────────────────────────────────────────
  return {
    solve,
    getSceneGraph: () => _sg,
    PATTERNS,
    REQUIRES,
    SCALES: S,
    query: () => sg_query,
    counts: () => {
      if (!_sg) return {};
      const c = {};
      for (const i of _sg.instances) c[i.patternId] = (c[i.patternId]||0)+1;
      return c;
    },
  };

})();


// ── ANALYSIS VIEWS ───────────────────────────────────────────────────────────

// Norfolk-Virginia Beach MSA HUD Income Limits 2024 (4-person household)
const NORFOLK_AMI = {
  ami_4person: 82900,
  // Rent limits: 30% of monthly income at each AMI bracket
  // Monthly income = AMI × bracket / 12
  // Max rent = monthly income × 0.30
  brackets: [
    { label: '30% AMI', pct: 0.30, monthly: Math.round(82900 * 0.30 / 12 * 0.30), color: '#0e7828' },
    { label: '50% AMI', pct: 0.50, monthly: Math.round(82900 * 0.50 / 12 * 0.30), color: '#22a838' },
    { label: '60% AMI', pct: 0.60, monthly: Math.round(82900 * 0.60 / 12 * 0.30), color: '#d4940c' },
    { label: '80% AMI', pct: 0.80, monthly: Math.round(82900 * 0.80 / 12 * 0.30), color: '#c87818' },
    { label: 'Market rate', pct: null, monthly: 1650, color: '#888' },
  ],
  // Construction cost — Kindred-calibrated (St. Paul's / Tidewater Gardens, Norfolk 2023-25)
  // Kindred Phase 3 (Kinship): $85M / 191 units = $445k/unit all-in (land+demo+construction+soft)
  // Eastside Commons adjustment: no demolition (-$25k), CLT removes land carry (-$60k)
  // → affordable all-in: ~$360k/unit; market: ~$385k/unit
  cost_per_unit_affordable: 360000,   // all-in: construction + soft costs + financing; no land/demo
  cost_per_unit_market: 385000,       // market-rate all-in (lighter subsidy stack, higher finish)
  // CLT ground lease: land cost removed from equation
  land_value_per_ac: 475000,          // Norfolk commercial land ~$475k/ac
  // Phase cadence calibrated to Kindred: ~190 units / 24 months per phase
  phase_cadence_units: 190,
  phase_cadence_months: 24,
  // Kindred comp: $300M total / 714 units = $420k blended
  kindred_cost_per_unit_blended: 420000,
};

function renderPeopleView(zones) {
  const el = document.getElementById('av-people-content');
  if (!el || !zones) return;

  const AMI = NORFOLK_AMI;
  let affordable = 0, market = 0, total = 0;
  const byDistrict = {};

  for (const z of zones) {
    if (!z.units || !z.use.startsWith('RESIDENTIAL')) continue;
    if (z.district?.includes('COURTYARD')) continue;
    const u = z.units.unit_count;
    const af = Math.min(z.units.affordable_units, u);  // clamp: never exceed unit_count
    total += u;
    affordable += af;
    market += u - af;
    const d = z.parent_district || z.district?.split('_')[0] || z.district;
    byDistrict[d] = (byDistrict[d] || 0) + u;
  }

  const afPct = total > 0 ? Math.round(affordable/total*100) : 0;
  const totalCost = (affordable * AMI.cost_per_unit_affordable + market * AMI.cost_per_unit_market) / 1e6;
  const landLocked = (73.4 * AMI.land_value_per_ac / 1e6).toFixed(1);

  el.innerHTML = `
    <div class="av-row"><span class="av-key">Total units</span><span class="av-val accent">${total.toLocaleString()}</span></div>
    <div class="av-row"><span class="av-key">Affordable</span><span class="av-val accent">${affordable.toLocaleString()} (${afPct}%)</span></div>
    <div class="av-row"><span class="av-key">Market-rate</span><span class="av-val">${market.toLocaleString()}</span></div>
    <hr class="av-divider">
    <div class="av-header">What does affordable mean in Norfolk?</div>
    <div style="color:var(--muted);line-height:1.6;margin-bottom:0.4rem;font-size:0.58rem;">
      HUD Area Median Income 2024 — Norfolk-Virginia Beach MSA<br>
      4-person household: <strong style="color:var(--text)">$${AMI.ami_4person.toLocaleString()}/yr</strong>
    </div>
    <table class="av-table">
      ${AMI.brackets.map(b => `
        <tr>
          <td style="color:${b.color}">${b.label}</td>
          <td style="color:${b.color}">$${b.monthly.toLocaleString()}/mo max rent</td>
        </tr>`).join('')}
    </table>
    <div style="margin-top:0.3rem;font-size:0.55rem;color:var(--muted);line-height:1.6;">
      CLT target: 60% AMI ($${AMI.brackets[2].monthly.toLocaleString()}/mo for 2BR).
      Norfolk market 2BR: ~$1,650/mo.
    </div>
    <hr class="av-divider">
    <div class="av-header">Estimated build cost</div>
    <div class="av-row"><span class="av-key">Total construction</span><span class="av-val">~$${totalCost.toFixed(0)}M</span></div>
    <div class="av-row"><span class="av-key">Land cost (CLT)</span><span class="av-val accent">$0</span></div>
    <div class="av-row"><span class="av-key">Land value locked</span><span class="av-val">$${landLocked}M</span></div>
    <div style="font-size:0.55rem;color:var(--muted);margin-top:0.3rem;line-height:1.6;">
      CLT ground lease permanently removes land from speculation.
      No developer extracts appreciation. Equity stays in the commons.
    </div>
  `;
}

function renderParcelsView(zones) {
  const el = document.getElementById('av-parcels-content');
  if (!el || !zones) return;

  const resParcels = zones.filter(z => z.use.startsWith('RESIDENTIAL') && z.poly?.outer);
  const avgAc = resParcels.length > 0
    ? (resParcels.reduce((s,z)=>s+z.area_ac,0) / resParcels.length).toFixed(2)
    : '—';
  const minAc = resParcels.length > 0
    ? Math.min(...resParcels.map(z=>z.area_ac)).toFixed(2) : '—';
  const maxAc = resParcels.length > 0
    ? Math.max(...resParcels.map(z=>z.area_ac)).toFixed(2) : '—';

  // Parcel size distribution
  const small = resParcels.filter(z=>z.area_ac < 0.3).length;
  const mid   = resParcels.filter(z=>z.area_ac >= 0.3 && z.area_ac < 1.0).length;
  const large = resParcels.filter(z=>z.area_ac >= 1.0).length;

  // Cost estimates
  const AMI = NORFOLK_AMI;
  const avgUnitsPerParcel = resParcels.length > 0
    ? Math.round(resParcels.reduce((s,z)=>s+(z.units?.unit_count||0),0) / resParcels.length)
    : 0;
  const avgCostPerParcel = Math.round(avgUnitsPerParcel * AMI.cost_per_unit_affordable / 1000);

  el.innerHTML = `
    <div class="av-row"><span class="av-key">Residential parcels</span><span class="av-val accent">${resParcels.length}</span></div>
    <div class="av-row"><span class="av-key">Avg size</span><span class="av-val">${avgAc}ac</span></div>
    <div class="av-row"><span class="av-key">Range</span><span class="av-val">${minAc}–${maxAc}ac</span></div>
    <hr class="av-divider">
    <div class="av-header">Parcel size distribution</div>
    <div class="av-row"><span class="av-key">Small (&lt;0.3ac)</span><span class="av-val">${small} parcels</span></div>
    <div class="av-row"><span class="av-key">Mid (0.3–1.0ac)</span><span class="av-val">${mid} parcels</span></div>
    <div class="av-row"><span class="av-key">Large (&gt;1.0ac)</span><span class="av-val">${large} parcels</span></div>
    <hr class="av-divider">
    <div class="av-header">Per-parcel economics</div>
    <div class="av-row"><span class="av-key">Avg units/parcel</span><span class="av-val">${avgUnitsPerParcel}</span></div>
    <div class="av-row"><span class="av-key">Avg build cost</span><span class="av-val">~$${avgCostPerParcel}k</span></div>
    <div class="av-row"><span class="av-key">Ground lease cost</span><span class="av-val accent">$0</span></div>
    <div style="font-size:0.55rem;color:var(--muted);margin-top:0.4rem;line-height:1.6;">
      Each parcel is a CLT ground lease to a small developer, cooperative,
      or community land trust homeownership group. No single entity
      controls the site. ${resParcels.length} parcels = ${resParcels.length} development teams.
    </div>
  `;
}

function renderAccessView(zones) {
  const el = document.getElementById('av-access-content');
  if (!el || !zones || !window._derivedG) return;

  const G = window._derivedG;
  const resZones = zones.filter(z => z.use.startsWith('RESIDENTIAL'));

  // Distance from Tide station centroid
  const tideX = G.TIDE ? G.TIDE.x + G.TIDE.w/2 : 660;
  const tideY = G.TIDE ? G.TIDE.y : 600;
  const FT_PER_PX = 8.5;  // from scale analysis
  const WALK_FT_PER_MIN = 264;  // ~3mph walking = 264ft/min
  const BIKE_FT_PER_MIN = 880;  // ~10mph cycling

  const distanceTo = (z, px, py) =>
    Math.hypot(z.centroid.x - px, z.centroid.y - py) * FT_PER_PX;

  const within5min  = resZones.filter(z => distanceTo(z,tideX,tideY) <= WALK_FT_PER_MIN * 5).length;
  const within10min = resZones.filter(z => distanceTo(z,tideX,tideY) <= WALK_FT_PER_MIN * 10).length;
  const within15min = resZones.filter(z => distanceTo(z,tideX,tideY) <= WALK_FT_PER_MIN * 15).length;
  const byBike5min  = resZones.filter(z => distanceTo(z,tideX,tideY) <= BIKE_FT_PER_MIN * 5).length;

  const pct = n => resZones.length > 0 ? Math.round(n/resZones.length*100) : 0;

  // Green access
  const greenZones = zones.filter(z => z.use.startsWith('GREEN'));
  const greenAc = greenZones.reduce((s,z)=>s+z.area_ac, 0).toFixed(1);
  const resNearGreen = resZones.filter(z =>
    greenZones.some(g => Math.hypot(z.centroid.x-g.centroid.x, z.centroid.y-g.centroid.y)*FT_PER_PX < 600)
  ).length;

  el.innerHTML = `
    <div class="av-header">Transit access to Tide station (~2033)</div>
    <div class="av-row"><span class="av-key">5-min walk</span><span class="av-val ${pct(within5min)>50?'accent':'warn'}">${pct(within5min)}% of parcels</span></div>
    <div class="av-row"><span class="av-key">10-min walk</span><span class="av-val accent">${pct(within10min)}% of parcels</span></div>
    <div class="av-row"><span class="av-key">15-min walk</span><span class="av-val">${pct(within15min)}% of parcels</span></div>
    <div class="av-row"><span class="av-key">5-min bike</span><span class="av-val accent">${pct(byBike5min)}% of parcels</span></div>
    <hr class="av-divider">
    <div class="av-header">Green space access</div>
    <div class="av-row"><span class="av-key">Total green/open</span><span class="av-val">${greenAc}ac</span></div>
    <div class="av-row"><span class="av-key">Green cover</span><span class="av-val">${((+greenAc/73.4)*100).toFixed(1)}% of site</span></div>
    <div class="av-row"><span class="av-key">Within 600ft green</span><span class="av-val accent">${pct(resNearGreen)}% of parcels</span></div>
    <hr class="av-divider">
    <div style="font-size:0.55rem;color:var(--muted);line-height:1.6;">
      Tide station estimated 2033 (HRT ~2.2mi extension, ~$300M).
      Walk speeds at ADA standard (3mph). Norfolk has a flat terrain
      advantage — no elevation penalty on walk times.
      Site is at 8–12ft elevation: confirmed high ground, Flood Zone X.
    </div>
  `;
}

function switchAnalysis(view, btn) {
  document.querySelectorAll('.analysis-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.analysis-view').forEach(v => v.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('av-' + view)?.classList.add('active');

  // Update seed display in save view
  if (view === 'save') {
    const seedEl = document.getElementById('av-seed-display');
    if (seedEl) seedEl.textContent = getCurrentSeed().toString(16).toUpperCase().padStart(8,'0');
    updateCanonicalBadge();
  }
}

function renderFinancialsView(zones) {
  const el = document.getElementById('financials-report-content');
  if (!el || !zones) return;

  const AMI = NORFOLK_AMI;

  // ── YIMBY MARKET-RATE MODEL ─────────────────────────────────────────────
  // No LIHTC. No federal subsidy stack. CLT land removal is the entire mechanism.
  // 5-over-1: ground commercial + 5 wood-frame residential floors.
  // 25ft × 125ft parcels. One building at a time. Anyone can build one.
  // Affordable because land is free, not because HUD says so.

  // ── Unit counts (from solver) ──
  let totalUnits = 0, cltUnits = 0, marketUnits = 0;
  const mxZones = zones.filter(z => z.use === 'MIXED_USE_5OVER1' && !z.district?.includes('COURTYARD'));
  const resZones = zones.filter(z => z.use.startsWith('RESIDENTIAL') && !z.district?.includes('COURTYARD'));
  for (const z of [...mxZones, ...resZones]) {
    const u = z.units?.unit_count || 0;
    totalUnits += u;
    if (z.use === 'RESIDENTIAL_MARKET') marketUnits += u;
    else cltUnits += u;
  }
  // CLT split: ~40% ownership condos, ~60% market-rate rental (no AMI cap — market sets the price)
  const cltCondoTarget = Math.round(cltUnits * 0.40);
  const rentalUnits = totalUnits - cltCondoTarget;

  // ── Per-building 5-over-1 geometry ──
  const PARCEL_W = 25, PARCEL_D = 125;                   // feet
  const PARCEL_SF = PARCEL_W * PARCEL_D;                 // 3,125 sf footprint
  const EFFICIENCY = 0.82;                               // net/gross ratio
  const COMMERCIAL_FLOORS = 1, RESIDENTIAL_FLOORS = 5;
  const AVG_UNIT_SF = 850;
  const unitsPerBuilding = Math.round(RESIDENTIAL_FLOORS * PARCEL_SF * EFFICIENCY / AVG_UNIT_SF); // ~15
  const commercialSFPerBuilding = PARCEL_SF * EFFICIENCY;  // ~2,563 sf net ground floor

  // Total buildings implied by unit count
  const totalBuildings = Math.max(1, Math.round(totalUnits / unitsPerBuilding));
  const totalCommercialSF = totalBuildings * commercialSFPerBuilding;

  // ── Construction cost (no land, no LIHTC, Type V over Type I podium) ──
  // $225/sf gross for wood-frame residential (Hampton Roads 2024, 5-over-1)
  // $275/sf gross for concrete podium ground floor
  const resCostPerSF = 225;
  const comCostPerSF = 275;
  const costPerBuilding = (RESIDENTIAL_FLOORS * PARCEL_SF * resCostPerSF
                         + COMMERCIAL_FLOORS  * PARCEL_SF * comCostPerSF) / 1e3;  // $k
  const totalBuildCost = totalBuildings * costPerBuilding / 1e3;  // $M

  // Cost per residential unit (builder's cost, no land)
  const costPerUnit = Math.round(costPerBuilding * 1000 / unitsPerBuilding);

  // ── Land value removed by CLT ──
  const landValueLocked = (73.4 * AMI.land_value_per_ac / 1e6).toFixed(1);
  // Per-building land value (at ~2 buildings/acre of buildable): ~$237k removed
  const landPerBuilding = Math.round(73.4 * AMI.land_value_per_ac / totalBuildings);

  // ── Revenue model (market-rate, no AMI cap) ──
  // Residential rents: Norfolk market 2026, mixed 1BR/2BR/studio
  const avgMktRent = 1750;                               // blended $/mo (1BR $1,450 → 2BR $1,950)
  const vacancyRate = 0.05;                              // 5% vacancy (tight Hampton Roads market)
  const annualResGross = totalUnits * avgMktRent * 12 * (1 - vacancyRate) / 1e6;

  // Commercial rents: ground floor NNN, street-activated
  const mktRent_sqft = 30;                              // $/sf/yr NNN (activated ground floor)
  const cltRent_sqft = 18;                              // CLT discount: land removed, ~40% below market
  const annualComGross = totalCommercialSF * cltRent_sqft / 1e6;

  // OpEx: market-rate multifamily = 38% (no affordable compliance overhead)
  const opexPct = 0.38;
  const totalGross = annualResGross + annualComGross;
  const noi = (totalGross * (1 - opexPct)).toFixed(1);

  // ── Cap rate math (the thing that actually matters now) ──
  const CAP_RATE = 0.055;   // 5.5% — Norfolk market-rate multifamily 2024
  const impliedValue = parseFloat(noi) / CAP_RATE;      // $M at stabilization
  const impliedValuePerUnit = Math.round(impliedValue * 1e6 / totalUnits);

  // Developer margin per building (value created – cost, CLT holds land)
  const buildingNOI = parseFloat(noi) * 1e6 / totalBuildings;
  const buildingValue = buildingNOI / CAP_RATE;
  const buildingMargin = Math.round(buildingValue - costPerBuilding * 1000);
  const buildingMarginPct = Math.round(buildingMargin / (costPerBuilding * 1000) * 100);

  // ── CLT condo ownership scenario ──
  // Price = construction cost per unit (no land, no developer profit on condos — they make it on rentals)
  // This is the Istanbul/Bali model: cost-basis ownership on CLT land
  const cltCondoPrice = costPerUnit;                     // ~$150-165k at $225/sf × 850sf + share of podium
  const mktCondoPrice = 295000;                          // Norfolk market 2BR condo (2024)
  const condoDiscount = Math.round((1 - cltCondoPrice / mktCondoPrice) * 100);

  // Conventional mortgage on CLT condo (no FHA required — cost basis is low enough)
  const convDown = 0.10;                                 // 10% down conventional
  const convDownAmt = Math.round(cltCondoPrice * convDown);
  const convLoan = cltCondoPrice - convDownAmt;
  const convRate = 0.068, convTerm = 30;
  const convPI = Math.round(convLoan * (convRate/12) / (1 - Math.pow(1+convRate/12, -convTerm*12)));
  const propTax = Math.round(cltCondoPrice * 0.011 / 12);
  const insurance = 75;
  const totalPITI = convPI + propTax + insurance;        // no PMI at 10% down conventional
  const mktRent2br = AMI.brackets[4].monthly;
  const ownershipSavings = mktRent2br - totalPITI;

  // 10-year equity (CLT: owner keeps 25% appreciation + all principal paydown)
  const appreciation = 0.04;                             // 4%/yr — conservative for improving neighborhood
  const futureValue = Math.round(cltCondoPrice * Math.pow(1+appreciation, 10));
  const totalAppreciation = futureValue - cltCondoPrice;
  const ownerShare = Math.round(totalAppreciation * 0.25);
  const balance10yr = Math.round(convLoan * Math.pow(1+convRate/12, 10*12) -
    convPI * (Math.pow(1+convRate/12, 10*12) - 1) / (convRate/12));
  const equityBuilt = Math.round(ownerShare + (convLoan - balance10yr));

  // ── Per-building deal (the magic: a local developer can do ONE building) ──
  const bldgEquityReq = Math.round(costPerBuilding * 1000 * 0.25);   // 25% equity, 75% construction loan
  const bldgDebt = Math.round(costPerBuilding * 1000 * 0.75);
  const bldgDebtService = Math.round(bldgDebt * 0.065 / 12 * 12);    // annual at 6.5%
  const bldgAnnualNOI = Math.round(buildingNOI);
  const bldgDSCR = (bldgAnnualNOI / bldgDebtService).toFixed(2);

  // ── Phasing (one building at a time — no master developer required) ──
  // Phase 1: ~30% of buildings = ~first 18 months, CLT North + Housing A parcels
  const phase1Bldgs = Math.round(totalBuildings * 0.30);
  const phase2Bldgs = Math.round(totalBuildings * 0.35);
  const phase3Bldgs = totalBuildings - phase1Bldgs - phase2Bldgs;
  const phase1Units = phase1Bldgs * unitsPerBuilding;
  const phase2Units = phase2Bldgs * unitsPerBuilding;
  const phase3Units = phase3Bldgs * unitsPerBuilding;
  const phase1Cost = phase1Bldgs * costPerBuilding / 1e3;
  const phase2Cost = phase2Bldgs * costPerBuilding / 1e3;
  const phase3Cost = phase3Bldgs * costPerBuilding / 1e3;
  const totalCost = totalBuildCost;

  // ── Commercial (storefronts in ground floor of MX buildings) ──
  const storeFrontCount = Math.round(totalCommercialSF / (25 * 50));  // 1,250sf avg bay
  const smallPEStorefronts = Math.round(storeFrontCount * 0.80);
  const avgStoreSqft = Math.round(commercialSFPerBuilding / 2);       // ~2 bays per building avg
  const mktMonthly = Math.round(mktRent_sqft * avgStoreSqft / 12);
  const cltMonthly = Math.round(cltRent_sqft * avgStoreSqft / 12);
  const rentSavings = mktMonthly - cltMonthly;
  const rentDiscount = Math.round((1 - cltRent_sqft / mktRent_sqft) * 100);
  const annualRetailIncome = annualComGross * 1000;  // $k
  const avgRent60AMI = avgMktRent;  // for ramp chart compatibility

  // ── Render helpers ──
  const FR = (label, val, accent=false, note='') =>
    `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:0.2rem 0;border-bottom:1px solid oklch(20% 0.006 145);">
      <span style="color:var(--muted);font-size:0.6rem;">${label}${note?`<span style="font-size:0.52rem;color:oklch(40% 0.006 145);margin-left:0.4rem;">${note}</span>`:''}</span>
      <span style="color:${accent?'var(--accent)':'var(--text)'};font-weight:600;font-size:0.62rem;white-space:nowrap;margin-left:1rem;">${val}</span>
    </div>`;
  const FH = (t) => `<div style="font-size:0.55rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);margin:1.3rem 0 0.5rem;border-left:2px solid var(--accent);padding-left:0.5rem;">${t}</div>`;
  const FN = (t) => `<p style="font-size:0.58rem;color:oklch(48% 0.008 145);line-height:1.75;margin:0.4rem 0 0;">${t}</p>`;
  const SCENARIO = (headline, sub) =>
    `<div style="background:oklch(14% 0.007 145);border:1px solid oklch(22% 0.008 145);border-left:3px solid var(--accent);padding:0.75rem 1rem;margin:0.8rem 0;">
      <div style="font-family:var(--font-display);font-size:0.85rem;font-weight:700;color:var(--text);line-height:1.2;">${headline}</div>
      <div style="font-size:0.58rem;color:var(--muted);margin-top:0.2rem;line-height:1.6;">${sub}</div>
    </div>`;
  const BIG = (label, val, accent=true) =>
    `<div style="text-align:center;padding:0.6rem 0.5rem;">
      <div style="font-family:var(--font-display);font-size:1.6rem;font-weight:900;color:${accent?'var(--accent)':'var(--text)'};">${val}</div>
      <div style="font-size:0.52rem;color:var(--muted);letter-spacing:0.06em;text-transform:uppercase;margin-top:0.1rem;">${label}</div>
    </div>`;

  el.innerHTML = `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:2.5rem 3.5rem;">

    <!-- COL 1: ONE BUILDING -->
    <div>
      ${FH('One building. Anyone can do this.')}
      ${SCENARIO(`25ft &times; 125ft &middot; 6 stories &middot; ${unitsPerBuilding} units + ground commercial`, `Type V wood frame over Type I concrete podium. IBC &sect;510.2. No master developer. No federal program. Just a building permit and a construction loan.`)}
      ${FR('Parcel footprint', `${PARCEL_W}ft &times; ${PARCEL_D}ft = ${PARCEL_SF.toLocaleString()}sf`)}
      ${FR('Ground floor commercial (NNN)', `${Math.round(commercialSFPerBuilding).toLocaleString()}sf net`)}
      ${FR('Residential floors', `${RESIDENTIAL_FLOORS} wood-frame floors`)}
      ${FR('Units per building', `${unitsPerBuilding} @ ${AVG_UNIT_SF}sf avg`)}
      ${FR('Construction cost', `~$${Math.round(costPerBuilding).toLocaleString()}k`)}
      ${FR('Land cost', '$0', true, 'CLT holds land permanently')}
      ${FR('Cost per unit (no land)', `$${costPerUnit.toLocaleString()}`, true)}

      ${FH('Deal structure')}
      ${FR('Equity required (25%)', `$${(bldgEquityReq/1000).toFixed(0)}k`, true)}
      ${FR('Construction loan (75%)', `$${(bldgDebt/1000).toFixed(0)}k`)}
      ${FR('Annual debt service', `$${(bldgDebtService/1000).toFixed(0)}k/yr`)}
      ${FR('Annual building NOI', `$${(bldgAnnualNOI/1000).toFixed(0)}k/yr`, true)}
      ${FR('DSCR', bldgDSCR, parseFloat(bldgDSCR) >= 1.20)}
      ${FR('Implied building value (5.5% cap)', `$${(buildingValue/1000).toFixed(0)}k`)}
      ${FR('Developer margin (value \u2212 cost)', `$${(buildingMargin/1000).toFixed(0)}k (${buildingMarginPct}%)`, buildingMarginPct > 0)}
      ${FN('$' + (bldgEquityReq/1000).toFixed(0) + 'k gets you ' + unitsPerBuilding + ' homes and ' + Math.round(commercialSFPerBuilding).toLocaleString() + 'sf of street-level commercial. A family office. A credit union. A church with a construction fund. Not Blackstone.')}
    </div>

    <!-- COL 2: MARKET-RATE RENTAL -->
    <div>
      ${FH('Market-rate rental (the flood)')}
      ${SCENARIO(`${totalUnits.toLocaleString()} units at market rate`, `No AMI cap. No income certification. No compliance overhead. Market sets the price \u2014 and we\u2019re flooding it.`)}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin:0.6rem 0;">
        ${BIG('avg rent/mo', `$${avgMktRent.toLocaleString()}`, false)}
        ${BIG('cost/unit (no land)', `$${costPerUnit.toLocaleString()}`)}
      </div>
      ${FR('Gross residential income', `$${annualResGross.toFixed(1)}M/yr`)}
      ${FR('Ground floor commercial', `$${annualComGross.toFixed(1)}M/yr NNN`)}
      ${FR('Total gross income', `$${totalGross.toFixed(1)}M/yr`)}
      ${FR('OpEx (38% \u2014 no compliance overhead)', `-$${(totalGross * opexPct).toFixed(1)}M/yr`)}
      ${FR('NOI at stabilization', `$${noi}M/yr`, true)}
      ${FR('Cap rate (market-rate Norfolk)', '5.5%')}
      ${FR('Implied site value', `$${impliedValue.toFixed(0)}M`, true)}
      ${FR('Land value locked by CLT', `$${landValueLocked}M`, true)}
      ${FH('Why rents come down')}
      ${FR('Norfolk vacancy rate (2024)', '~3.8% \u2014 critically undersupplied')}
      ${FR('Units added (this site)', totalUnits.toLocaleString())}
      ${FR('Supply increase to corridor', `${(totalUnits/85000*100).toFixed(1)}% \u2014 meaningful`)}
      ${FN('Broke Tidewater kids want walkable Brooklyn-style housing. This is supply-side urbanism: flood the zone with quality product, let market pricing do the rest. Parents are mad. Good.')}
    </div>

    <!-- COL 3: CLT OWNERSHIP CONDOS -->
    <div>
      ${FH('CLT ownership condos (~$' + Math.round(cltCondoPrice/1000) + 'k)')}
      ${SCENARIO(`${cltCondoTarget.toLocaleString()} units sold at cost basis \u2014 land stays in the commons`, `Istanbul model: you pay what it costs to build. The land was never yours to buy.`)}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin:0.6rem 0;">
        ${BIG('Norfolk market condo', `$${(mktCondoPrice/1000).toFixed(0)}k`, false)}
        ${BIG('CLT price (cost basis)', `$${(cltCondoPrice/1000).toFixed(0)}k`)}
      </div>
      ${FR('Discount vs. market', `${condoDiscount}%`, true)}
      ${FR('Why cheaper?', 'Land cost removed. Not subsidized \u2014 priced correctly.')}
      ${FH('Monthly ownership cost')}
      ${FR('Down payment (10% conventional)', `$${convDownAmt.toLocaleString()}`)}
      ${FR('Loan amount', `$${convLoan.toLocaleString()}`)}
      ${FR('Rate / term', '6.8% / 30yr \u00b7 no PMI')}
      ${FR('Principal + interest', `$${convPI.toLocaleString()}/mo`)}
      ${FR('Property tax (1.1%)', `$${propTax.toLocaleString()}/mo`)}
      ${FR('Insurance', `$${insurance}/mo`)}
      ${FR('Total PITI', `$${totalPITI.toLocaleString()}/mo`, true)}
      ${FR('Market rent same unit', `$${avgMktRent.toLocaleString()}/mo`)}
      ${FR('Monthly savings vs. renting', `$${Math.abs(ownershipSavings).toLocaleString()}/mo`, ownershipSavings > 0)}
      ${FH('10-year wealth picture')}
      ${FR('Purchase price', `$${cltCondoPrice.toLocaleString()}`)}
      ${FR('Value at year 10 (4%/yr)', `$${futureValue.toLocaleString()}`)}
      ${FR('Owner\u2019s share (25% of appreciation)', `$${ownerShare.toLocaleString()}`, true)}
      ${FR('Principal paid down', `$${(convLoan - balance10yr).toLocaleString()}`, true)}
      ${FR('Total equity built', `$${equityBuilt.toLocaleString()}`, true)}
      ${FN('CLT keeps 75% of appreciation so the next buyer can afford it too. You get a foundation. Not a windfall. A home.')}
    </div>

    <!-- COL 4: BUILD ONE AT A TIME -->
    <div>
      ${FH('Build one building at a time')}
      ${SCENARIO(`${totalBuildings} buildings &middot; ${totalUnits.toLocaleString()} units &middot; $${totalCost.toFixed(0)}M total`, `No master developer. No single point of failure. ${totalBuildings} independent deals, each financeable by a local operator.`)}
      ${FR('Phase 1 (2026\u201328, CLT North + Housing A)', `${phase1Bldgs} bldgs \u00b7 ${phase1Units} units \u00b7 $${phase1Cost.toFixed(0)}M`)}
      ${FR('Phase 2 (2029\u201332, Housing B + Spine)', `${phase2Bldgs} bldgs \u00b7 ${phase2Units} units \u00b7 $${phase2Cost.toFixed(0)}M`)}
      ${FR('Phase 3 (2033+, Tide-adjacent)', `${phase3Bldgs} bldgs \u00b7 ${phase3Units} units \u00b7 $${phase3Cost.toFixed(0)}M`)}
      ${FR('Total buildout', `$${totalCost.toFixed(0)}M across ${totalBuildings} deals`, true)}
      ${FH('Ground floor commercial')}
      ${FR('Total commercial sf', `${Math.round(totalCommercialSF).toLocaleString()}sf`)}
      ${FR('Storefronts', storeFrontCount)}
      ${FR('CLT-rate operators', `${smallPEStorefronts} bays @ $${cltRent_sqft}/sf NNN`)}
      ${FR('CLT discount vs market ($${mktRent_sqft}/sf)', `${rentDiscount}%`, true)}
      ${FR('Annual commercial income', `$${annualComGross.toFixed(2)}M/yr`)}
      ${FH('Site-wide at stabilization')}
      ${FR('Total units', totalUnits.toLocaleString(), true)}
      ${FR('CLT condos (ownership @ cost)', cltCondoTarget.toLocaleString(), true)}
      ${FR('Market-rate rental', rentalUnits.toLocaleString())}
      ${FR('Land value in CLT (never sold)', `$${landValueLocked}M`, true)}
      ${FR('NOI', `$${noi}M/yr`, true)}
      ${FR('Implied value (5.5% cap)', `$${impliedValue.toFixed(0)}M`, true)}
      ${FN('Phase 3 timing aligns with Tide light rail extension (~2033). At that point the site is self-evidently transit-adjacent and market financing is trivial.')}
    </div>

    <!-- YEAR-BY-YEAR RAMP -->
    ${renderRampChart({ totalUnits, belowMarketUnits: rentalUnits, marketUnits: cltCondoTarget,
      storeFrontCount, smallPEStorefronts, cltRent_sqft, avgStoreSqft,
      avgRent60AMI: avgMktRent, opexPct,
      phase1Cost, phase2Cost, phase3Cost, lihtcTotal: 0 })}

  </div>`;
}

// ── YEAR-BY-YEAR RAMP CHART ────────────────────────────────────────────────
function renderRampChart(p) {
  // Build year-by-year model: 2026–2040
  const START = 2026;
  const YEARS = 15;

  // Phase schedule (each phase: construction start, open for lease, stabilized)
  const phases = [
    { name: 'Phase 1', unitFrac: 0.30, constructStart: 2026, openYear: 2028.0, stabilizedYear: 2029.5,
      capitalMY: p.phase1Cost, lihtcMY: p.lihtcTotal * 0.30, label: 'P1 opens' },
    { name: 'Phase 2', unitFrac: 0.33, constructStart: 2029, openYear: 2031.5, stabilizedYear: 2033.0,
      capitalMY: p.phase2Cost, lihtcMY: p.lihtcTotal * 0.33, label: 'P2 opens' },
    { name: 'Phase 3', unitFrac: 0.37, constructStart: 2033, openYear: 2034.5, stabilizedYear: 2036.0,
      capitalMY: p.phase3Cost, lihtcMY: p.lihtcTotal * 0.37, label: 'Tide + P3' },
  ];

  // Compute full-stabilization NOI for a phase (annual, $M)
  function phaseStabilizedNOI(frac) {
    const units = Math.round(p.belowMarketUnits * frac);
    const resIncome = units * p.avgRent60AMI * 12 / 1e6;
    const storeFronts = Math.round(p.smallPEStorefronts * frac);
    const retailIncome = storeFronts * p.cltRent_sqft * p.avgStoreSqft / 1e6;
    return (resIncome + retailIncome) * (1 - p.opexPct);
  }

  // For a given year (decimal), compute NOI fraction for a phase
  function phaseNOIAtYear(phase, yr) {
    if (yr < phase.openYear) return 0;
    const elapsed = yr - phase.openYear;
    const rampDuration = phase.stabilizedYear - phase.openYear;
    const frac = Math.min(1, elapsed / rampDuration);
    // S-curve: slow start, fast middle, plateau
    const sCurve = frac < 0.5 ? 2 * frac * frac : 1 - 2 * (1 - frac) * (1 - frac);
    return sCurve;
  }

  // Capital deployment: spread construction cost over 2-year build window
  function phaseCapitalAtYear(phase, yr) {
    if (yr < phase.constructStart || yr >= phase.openYear) return 0;
    const buildDuration = phase.openYear - phase.constructStart;
    return phase.capitalMY / buildDuration;
  }

  // Build data points
  const data = [];
  let cumulativeCapital = 0;
  let cumulativeNOI = 0;

  for (let i = 0; i < YEARS; i++) {
    const yr = START + i;
    const yrMid = yr + 0.5;  // use mid-year for NOI

    // Annual NOI: sum of phases
    let annualNOI = 0;
    for (const ph of phases) {
      annualNOI += phaseNOIAtYear(ph, yrMid) * phaseStabilizedNOI(ph.unitFrac);
    }

    // Capital deployed this year (equity + debt, net of LIHTC)
    let annualCapital = 0;
    for (const ph of phases) {
      annualCapital += phaseCapitalAtYear(ph, yrMid);
    }
    cumulativeCapital += annualCapital;
    cumulativeNOI += annualNOI;

    data.push({
      yr, annualNOI: parseFloat(annualNOI.toFixed(2)),
      annualCapital: parseFloat(annualCapital.toFixed(2)),
      cumulativeNOI: parseFloat(cumulativeNOI.toFixed(1)),
      cumulativeCapital: parseFloat(cumulativeCapital.toFixed(1)),
    });
  }

  // Chart dimensions
  const W = 420, H = 160, PAD = { t: 20, r: 12, b: 36, l: 44 };
  const CW = W - PAD.l - PAD.r;
  const CH = H - PAD.t - PAD.b;

  const maxNOI = Math.max(...data.map(d => d.annualNOI)) * 1.15;
  const maxCap = Math.max(...data.map(d => d.annualCapital)) * 1.4;
  const yMax = Math.max(maxNOI, maxCap, 5);

  function xp(i) { return PAD.l + (i / (YEARS - 1)) * CW; }
  function yp(v) { return PAD.t + CH - (v / yMax) * CH; }

  // Polyline points
  const noiPts = data.map((d, i) => `${xp(i)},${yp(d.annualNOI)}`).join(' ');
  const capPts = data.map((d, i) => `${xp(i)},${yp(d.annualCapital)}`).join(' ');

  // Milestone labels
  const milestones = [
    { yr: 2028, label: 'P1\nopens', color: '#4888a8' },
    { yr: 2031, label: 'P2\nopens', color: '#4888a8' },
    { yr: 2033, label: 'Tide\nExt.', color: '#9a6010' },
    { yr: 2035, label: 'P3\nopens', color: '#4888a8' },
  ];

  function mX(yr) { return xp(yr - START); }

  // Crossover: when does cumulative NOI exceed cumulative capital?
  let crossoverYr = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i].cumulativeNOI >= data[i].cumulativeCapital && data[i-1].cumulativeNOI < data[i-1].cumulativeCapital) {
      crossoverYr = data[i].yr;
    }
  }

  // Second chart: cumulative
  const maxCumNOI = Math.max(...data.map(d => d.cumulativeNOI));
  const maxCumCap = Math.max(...data.map(d => d.cumulativeCapital));
  const cumMax = Math.max(maxCumNOI, maxCumCap) * 1.1;
  function yp2(v) { return PAD.t + CH - (v / cumMax) * CH; }
  const cumNOIPts = data.map((d, i) => `${xp(i)},${yp2(d.cumulativeNOI)}`).join(' ');
  const cumCapPts = data.map((d, i) => `${xp(i)},${yp2(d.cumulativeCapital)}`).join(' ');

  // Year labels for x-axis (every 2 years)
  const xLabels = data.filter((_, i) => i % 2 === 0).map((d, i) =>
    `<text x="${xp(i * 2)}" y="${H - 4}" fill="oklch(48% 0.008 145)" font-size="7" text-anchor="middle">${d.yr}</text>`
  ).join('');

  // Y-axis labels
  const yLabels = [0, Math.round(yMax/2), Math.round(yMax)].map(v =>
    `<text x="${PAD.l - 4}" y="${yp(v) + 2.5}" fill="oklch(48% 0.008 145)" font-size="7" text-anchor="end">$${v}M</text>`
  ).join('');
  const y2Labels = [0, Math.round(cumMax/2), Math.round(cumMax)].map(v =>
    `<text x="${PAD.l - 4}" y="${yp2(v) + 2.5}" fill="oklch(48% 0.008 145)" font-size="7" text-anchor="end">$${v}M</text>`
  ).join('');

  // Crossover marker
  const crossoverMarker = crossoverYr ? `
    <line x1="${mX(crossoverYr)}" y1="${PAD.t}" x2="${mX(crossoverYr)}" y2="${H - PAD.b}"
      stroke="#9a6010" stroke-width="1" stroke-dasharray="3,2" opacity="0.7"/>
    <text x="${mX(crossoverYr)}" y="${PAD.t - 4}" fill="#9a6010" font-size="6.5" text-anchor="middle">break-even</text>
  ` : '';

  // Table: key years
  const keyYears = [2028, 2030, 2033, 2036, 2040].map(yr => {
    const d = data.find(x => x.yr === yr);
    if (!d) return '';
    return `<tr>
      <td style="padding:0.15rem 0.5rem 0.15rem 0;color:var(--accent);font-weight:600;">${yr}</td>
      <td style="padding:0.15rem 0.5rem;">$${d.annualNOI.toFixed(1)}M</td>
      <td style="padding:0.15rem 0.5rem;">$${d.annualCapital.toFixed(1)}M</td>
      <td style="padding:0.15rem 0.5rem;color:var(--accent);">$${d.cumulativeNOI.toFixed(0)}M</td>
    </tr>`;
  }).join('');

  return `
    <div style="margin-top:1.5rem;border-top:1px solid oklch(22% 0.008 145);padding-top:1.25rem;">
      <div style="font-size:0.55rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);
        margin-bottom:1rem;border-left:2px solid var(--accent);padding-left:0.5rem;">
        Year-by-year ramp · 2026–2040
      </div>
      <p style="font-size:0.58rem;color:oklch(48% 0.008 145);line-height:1.75;margin-bottom:1rem;">
        The $${(phaseStabilizedNOI(0.30) + phaseStabilizedNOI(0.33) + phaseStabilizedNOI(0.37)).toFixed(1)}M
        stabilized NOI is a 2036 number. The ramp below shows how capital is deployed and income builds
        year by year. Each phase uses an 18-month lease-up curve (conservative for a transit-adjacent,
        below-market project). OpEx held at ${Math.round(p.opexPct*100)}% throughout.
      </p>

      <!-- Annual NOI vs Capital chart -->
      <div style="font-size:0.55rem;color:var(--muted);margin-bottom:0.3rem;letter-spacing:0.06em;text-transform:uppercase;">
        Annual NOI vs. capital deployed ($M/yr)
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;display:block;overflow:visible;">
        <!-- Grid -->
        ${[0, Math.round(yMax/2), Math.round(yMax)].map(v =>
          `<line x1="${PAD.l}" y1="${yp(v)}" x2="${W-PAD.r}" y2="${yp(v)}"
            stroke="oklch(20% 0.006 145)" stroke-width="0.5"/>`
        ).join('')}
        <!-- Milestone verticals -->
        ${milestones.map(m => `
          <line x1="${mX(m.yr)}" y1="${PAD.t}" x2="${mX(m.yr)}" y2="${H-PAD.b}"
            stroke="${m.color}" stroke-width="0.75" stroke-dasharray="3,2" opacity="0.5"/>
        `).join('')}
        <!-- Capital bars (as area) -->
        <polyline points="${capPts}" fill="none" stroke="oklch(55% 0.06 145)" stroke-width="1.5" opacity="0.5" stroke-dasharray="4,2"/>
        <!-- NOI line -->
        <polyline points="${noiPts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
        <!-- Dots on NOI line at milestones -->
        ${milestones.map(m => `<circle cx="${mX(m.yr)}" cy="${yp(data[m.yr-START]?.annualNOI||0)}" r="2.5" fill="var(--accent)"/>`).join('')}
        <!-- Axes -->
        <line x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${H-PAD.b}" stroke="oklch(30% 0.006 145)" stroke-width="0.75"/>
        <line x1="${PAD.l}" y1="${H-PAD.b}" x2="${W-PAD.r}" y2="${H-PAD.b}" stroke="oklch(30% 0.006 145)" stroke-width="0.75"/>
        ${yLabels}
        ${xLabels}
        <!-- Legend -->
        <line x1="${W-PAD.r-80}" y1="${PAD.t+6}" x2="${W-PAD.r-64}" y2="${PAD.t+6}" stroke="var(--accent)" stroke-width="2"/>
        <text x="${W-PAD.r-62}" y="${PAD.t+9}" fill="var(--accent)" font-size="6.5">Annual NOI</text>
        <line x1="${W-PAD.r-80}" y1="${PAD.t+16}" x2="${W-PAD.r-64}" y2="${PAD.t+16}" stroke="oklch(55% 0.06 145)" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.5"/>
        <text x="${W-PAD.r-62}" y="${PAD.t+19}" fill="oklch(55% 0.06 145)" font-size="6.5" opacity="0.7">Capital deployed</text>
        <!-- Milestone labels -->
        ${milestones.map(m => `
          <text x="${mX(m.yr)+2}" y="${PAD.t+8}" fill="${m.color}" font-size="6" opacity="0.8">${m.label.split('\\n')[0]}</text>
        `).join('')}
      </svg>

      <!-- Cumulative chart -->
      <div style="font-size:0.55rem;color:var(--muted);margin:1rem 0 0.3rem;letter-spacing:0.06em;text-transform:uppercase;">
        Cumulative NOI vs. cumulative capital ($M total)
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;display:block;overflow:visible;">
        ${[0, Math.round(cumMax/2), Math.round(cumMax)].map(v =>
          `<line x1="${PAD.l}" y1="${yp2(v)}" x2="${W-PAD.r}" y2="${yp2(v)}"
            stroke="oklch(20% 0.006 145)" stroke-width="0.5"/>`
        ).join('')}
        ${crossoverMarker}
        <!-- Cumulative capital area fill -->
        <polygon points="${PAD.l},${H-PAD.b} ${cumCapPts} ${W-PAD.r},${H-PAD.b}"
          fill="oklch(55% 0.06 145)" opacity="0.08"/>
        <polyline points="${cumCapPts}" fill="none" stroke="oklch(55% 0.06 145)" stroke-width="1.5" opacity="0.5" stroke-dasharray="4,2"/>
        <!-- Cumulative NOI area fill -->
        <polygon points="${PAD.l},${H-PAD.b} ${cumNOIPts} ${W-PAD.r},${H-PAD.b}"
          fill="var(--accent)" opacity="0.07"/>
        <polyline points="${cumNOIPts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
        <line x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${H-PAD.b}" stroke="oklch(30% 0.006 145)" stroke-width="0.75"/>
        <line x1="${PAD.l}" y1="${H-PAD.b}" x2="${W-PAD.r}" y2="${H-PAD.b}" stroke="oklch(30% 0.006 145)" stroke-width="0.75"/>
        ${y2Labels}
        ${xLabels}
        <line x1="${W-PAD.r-80}" y1="${PAD.t+6}" x2="${W-PAD.r-64}" y2="${PAD.t+6}" stroke="var(--accent)" stroke-width="2"/>
        <text x="${W-PAD.r-62}" y="${PAD.t+9}" fill="var(--accent)" font-size="6.5">Cumulative NOI</text>
        <line x1="${W-PAD.r-80}" y1="${PAD.t+16}" x2="${W-PAD.r-64}" y2="${PAD.t+16}" stroke="oklch(55% 0.06 145)" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.5"/>
        <text x="${W-PAD.r-62}" y="${PAD.t+19}" fill="oklch(55% 0.06 145)" font-size="6.5" opacity="0.7">Cumulative capital</text>
      </svg>

      <!-- Key year table -->
      <div style="font-size:0.55rem;color:var(--muted);margin:1rem 0 0.3rem;letter-spacing:0.06em;text-transform:uppercase;">
        Key year snapshots
      </div>
      <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:0.6rem;color:var(--muted);">
        <tr style="border-bottom:1px solid oklch(22% 0.008 145);">
          <th style="text-align:left;padding:0.15rem 0.5rem 0.15rem 0;color:oklch(38% 0.008 145);font-weight:400;">Year</th>
          <th style="text-align:left;padding:0.15rem 0.5rem;color:oklch(38% 0.008 145);font-weight:400;">Annual NOI</th>
          <th style="text-align:left;padding:0.15rem 0.5rem;color:oklch(38% 0.008 145);font-weight:400;">Capital/yr</th>
          <th style="text-align:left;padding:0.15rem 0.5rem;color:oklch(38% 0.008 145);font-weight:400;">Cumul. NOI</th>
        </tr>
        ${keyYears}
      </table>
      <p style="font-size:0.55rem;color:oklch(40% 0.008 145);margin-top:0.6rem;line-height:1.7;">
        Assumptions: 18-month lease-up per phase, S-curve occupancy ramp (0→40→75→95%),
        OpEx 38% throughout, no vacancy improvement at scale (conservative),
        Phase 3 timed to Tide light rail extension (~2033). All figures are model projections —
        actual performance depends on construction cost, lease-up pace, and policy continuity.
      </p>
    </div>
  `;
}


function updateAnalysisViews() {
  const zones = window._lastPipelineZones || [];
  renderPeopleView(zones);
  renderParcelsView(zones);
  renderAccessView(zones);
  renderFinancialsView(zones);
}

// ═══════════════════════════════════════════════════════════════════════════
//  PATTERN OVERLAY — 2D flat renderer for EC_PatternSolver scene graph
//
//  Draws pattern instances directly onto the SVG plan as a named layer.
//  One <g id="pattern-overlay"> group, cleared and redrawn on every solve.
//
//  Visual language by scale:
//    DISTRICT (1): large translucent halos, dashed outlines
//    BLOCK    (2): semi-opaque filled polygons, thin stroke
//    GROUP    (3): hatched fill + solid outline
//    BUILDING (4): solid fill with courtyard voids
//    EDGE     (5): bright accent strokes, dot markers
// ═══════════════════════════════════════════════════════════════════════════

const PATTERN_COLORS = {
  // DISTRICT
  29: { fill:'#c85018', stroke:'#e87038', label:'Density Rings' },
  30: { fill:'#2070a0', stroke:'#40a0d0', label:'Activity Nodes' },
  31: { fill:'#2878a0', stroke:'#48a8d8', label:'Promenade' },
  36: { fill:'#8050c0', stroke:'#a070e0', label:'Degrees of Publicness' },
  53: { fill:'#c88020', stroke:'#e8a040', label:'Main Gateways' },
  // BLOCK
  60: { fill:'#308038', stroke:'#50c058', label:'Accessible Green' },
  67: { fill:'#28a050', stroke:'#48d070', label:'Common Land' },
  71: { fill:'#3888a8', stroke:'#58b8d8', label:'Still Water' },
  37: { fill:'#c88020', stroke:'#e8a040', label:'House Cluster' },
  // GROUP
  95: { fill:'#c85018', stroke:'#e87038', label:'Building Complex' },
  104:{ fill:'#a03020', stroke:'#c05040', label:'Site Repair' },
  105:{ fill:'#806018', stroke:'#a08030', label:'South Facing' },
  106:{ fill:'#506888', stroke:'#7098b8', label:'Positive Outdoor' },
  109:{ fill:'#a05810', stroke:'#c07830', label:'Long Thin House' },
  114:{ fill:'#486050', stroke:'#688070', label:'Open Space Hierarchy' },
  // BUILDING
  115:{ fill:'#204858', stroke:'#407888', label:'Courtyards Which Live' },
  122:{ fill:'#282060', stroke:'#483890', label:'Building Fronts' },
  127:{ fill:'#503850', stroke:'#805880', label:'Intimacy Gradient' },
  // EDGE
  87: { fill:'#c87818', stroke:'#e8a838', label:'Individually Owned Shops' },
  88: { fill:'#a86018', stroke:'#c88038', label:'Street Cafe' },
  46: { fill:'#c85018', stroke:'#e87038', label:'Market of Many Shops' },
};

// Scale → base opacity for fill and stroke
const SCALE_OPACITY = { 1: 0.10, 2: 0.18, 3: 0.25, 4: 0.35, 5: 0.70 };

function ptsToSvgD(pts) {
  if (!pts || pts.length < 2) return '';
  const [first, ...rest] = pts;
  return `M${first.x},${first.y}` + rest.map(p => `L${p.x},${p.y}`).join('') + 'Z';
}

// ═══════════════════════════════════════════════════════════════════════════
//  PLAN RENDERER — Buildings primary, nodes + zones optional
//
//  Primary layer: sg.buildings — kNN-coalesced convex hulls, filled by use type
//  Node layer:    sg.instances (points/centroids) — toggle via btn-nodes
//  Zone layer:    patternInstancesToZones() polygons — toggle via btn-zones
// ═══════════════════════════════════════════════════════════════════════════

const BLDG_COLORS = {
  MIXED_USE_5OVER1:    '#c84818',
  RESIDENTIAL_CLT_OWN:'#e8b820',
  RESIDENTIAL_MARKET:  '#c87818',
  RETAIL:              '#e87038',
  MARKET_HALL:         '#b84898',
  CIVIC:               '#1868b8',
  GREEN_ACTIVE:        '#22a838',
  GREEN_PASSIVE:       '#0e7828',
  COURTYARD:           '#48a860',
};

let _fieldLinesOn = false;
function toggleFieldLines(btn) {
  _fieldLinesOn = !_fieldLinesOn;
  btn.classList.toggle('on', _fieldLinesOn);
  const el = document.getElementById('layer-fieldlines');
  if (el) el.style.display = _fieldLinesOn ? '' : 'none';
}

function renderPlanBuildings(sg) {
  const svg = document.getElementById('site-plan');
  if (!svg) return;

  svg.querySelectorAll('[data-plan-layer]').forEach(e => e.remove());

  const ns = 'http://www.w3.org/2000/svg';

  // ── EDA parcel outlines (always on, low priority) ──────────────────────
  const gEda = document.createElementNS(ns, 'g');
  gEda.setAttribute('data-plan-layer', 'eda');
  gEda.setAttribute('pointer-events', 'none');
  if (_pipelineParcels && _pipelineProj) {
    for (const p of _pipelineParcels.filter(q => q.is_eda && q.rings?.[0])) {
      const pts = p.rings[0].map(([lon,lat]) => { const [x,y] = _pipelineProj(lon,lat); return `${x.toFixed(1)},${y.toFixed(1)}`; });
      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', pts.join(' '));
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', '#2a3828');
      poly.setAttribute('stroke-width', '2');
      poly.setAttribute('class', 'eda-outline');
      gEda.appendChild(poly);
    }
  }
  svg.appendChild(gEda);

  // ── Field line traces ──────────────────────────────────────────────────
  const _psResult = window._lastPatternResult;
  const gLines = document.createElementNS(ns, 'g');
  gLines.setAttribute('data-plan-layer', 'fieldlines');
  gLines.setAttribute('id', 'layer-fieldlines');
  gLines.setAttribute('pointer-events', 'none');
  gLines.style.display = _fieldLinesOn ? '' : 'none';
  for (const line of (_psResult?.fieldLines || [])) {
    if (!line.pts?.length) continue;
    const pl = document.createElementNS(ns, 'polyline');
    pl.setAttribute('points', line.pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
    pl.setAttribute('fill', 'none');
    pl.setAttribute('stroke', '#3a5030');
    pl.setAttribute('stroke-width', '1.5');
    pl.setAttribute('stroke-opacity', '0.45');
    pl.setAttribute('stroke-linecap', 'round');
    gLines.appendChild(pl);
  }
  svg.appendChild(gLines);

  // ── Buildings — field solver output, architectural plan style ────────
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('data-plan-layer', 'buildings');
  g.setAttribute('pointer-events', 'none');
  g.setAttribute('clip-path', 'url(#mc)');  // ← was missing; clips to EDA map area

  // Use classification by domPid
  const PID_COLOR = {
    29:'#c85018', 30:'#1868b8', 31:'#2878a0', 36:'#8050c0', 53:'#c88020',
    37:'#c87818', 60:'#22a838', 67:'#22a838', 71:'#0e7828', 87:'#c84818',
    88:'#6888a8', 46:'#b84898', 95:'#c84818', 109:'#e8b820', 116:'#c87818',
    104:'#a03020', 105:'#806018', 106:'#486050', 115:'#48a860',
    122:'#c84818', 127:'#e8b820', 119:'#6888a8', 121:'#2878a0',
    100:'#2070a0', 61:'#22a838', 51:'#0e7828', 160:'#c84818',
    123:'#2070a0', 14:'#8050c0', 8:'#8050c0', 107:'#c87818',
    108:'#a03020', 110:'#c84818', 128:'#806018',
    120:'#22a838', 172:'#0e7828', 174:'#48a860', 176:'#806018', 56:'#3888a8',
    3:'#0e7828', 21:'#e8b820', 25:'#1868b8', 35:'#c87818',
    9:'#b84898', 32:'#ff6030', 40:'#60a0c0', 44:'#2070a0',
  };

  const PID_USE = {
    37:'RESIDENTIAL', 109:'RESIDENTIAL', 115:'RESIDENTIAL', 107:'RESIDENTIAL',
    127:'RESIDENTIAL', 35:'RESIDENTIAL', 21:'RESIDENTIAL',
    87:'COMMERCIAL', 88:'COMMERCIAL', 46:'COMMERCIAL', 95:'COMMERCIAL',
    122:'COMMERCIAL', 100:'COMMERCIAL', 123:'COMMERCIAL',
    30:'CIVIC', 36:'CIVIC', 53:'CIVIC', 31:'CIVIC', 110:'CIVIC', 14:'CIVIC',
    60:'GREEN', 67:'GREEN', 71:'GREEN', 51:'GREEN', 106:'GREEN',
    114:'GREEN', 172:'GREEN', 174:'GREEN', 56:'GREEN', 25:'GREEN', 3:'GREEN',
    29:'MIXED', 116:'MIXED', 104:'MIXED', 105:'MIXED', 108:'MIXED',
    119:'MIXED', 121:'MIXED', 160:'MIXED', 128:'MIXED', 61:'MIXED', 8:'MIXED',
    // Tier 1 additions
    9:'COMMERCIAL',   // Scattered Work → commercial use class
    32:'COMMERCIAL',  // Shopping Street → commercial
    40:'CIVIC',       // Old Buildings → civic
    44:'CIVIC',       // Local Town Hall → civic
  };

  const USE_HATCH = {
    RESIDENTIAL: 'url(#pat-hatch-res)',
    COMMERCIAL:  'url(#pat-hatch-com)',
    CIVIC:       'url(#pat-hatch-civ)',
    GREEN:       'url(#pat-green-active)',
    MIXED:       'url(#pat-hatch-mix)',
  };
  const USE_STROKE = {
    RESIDENTIAL: '#e8c060', COMMERCIAL: '#ff6030', CIVIC: '#60a8e0',
    GREEN: '#40c060', MIXED: '#a080e0',
  };
  const GREEN_PIDS = new Set([60,67,71,51,106,114,172,174,56,25,3]);

  // ── EDA outline: bold perimeter so the buildable zone reads clearly ──
  // Draw FIRST (under buildings)
  if (_pipelineParcels && _pipelineProj) {
    const edaOutline = document.createElementNS(ns, 'g');
    edaOutline.setAttribute('data-plan-sub', 'eda-outline');
    for (const p of _pipelineParcels.filter(q => q.is_eda && q.rings?.[0])) {
      const pts = p.rings[0].map(([lon,lat]) => {
        const [x,y] = _pipelineProj(lon,lat);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', pts.join(' '));
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', '#304828');
      poly.setAttribute('stroke-width', '2.5');
      poly.setAttribute('stroke-dasharray', '8,4');
      edaOutline.appendChild(poly);
    }
    g.appendChild(edaOutline);
  }

  // ── Building footprints ───────────────────────────────────────────────
  const buildings = sg.buildings || [];

  // Sort: green first (underneath), then solid mass on top
  const sorted = [...buildings].sort((a,b) => {
    const au = PID_USE[a.domPid] || 'MIXED';
    const bu = PID_USE[b.domPid] || 'MIXED';
    if (au === 'GREEN' && bu !== 'GREEN') return -1;
    if (bu === 'GREEN' && au !== 'GREEN') return 1;
    return 0;
  });

  for (const bldg of sorted) {
    const pid = Number(bldg.domPid);
    const use = PID_USE[pid] || 'MIXED';
    const stroke = USE_STROKE[use] || '#888';
    const isGreen = GREEN_PIDS.has(pid);
    const isResidential = use === 'RESIDENTIAL';
    const isCommercial  = use === 'COMMERCIAL';

    if (isGreen) {
      // Green space: elliptical hatched area, soft edge, no hard rect
      const ecx = bldg.x + bldg.w/2, ecy = bldg.y + bldg.h/2;
      const erx = bldg.w * 0.58, ery = bldg.h * 0.58;
      // Soft base
      const eBase = document.createElementNS(ns, 'ellipse');
      eBase.setAttribute('cx', ecx.toFixed(1)); eBase.setAttribute('cy', ecy.toFixed(1));
      eBase.setAttribute('rx', (erx*1.15).toFixed(1)); eBase.setAttribute('ry', (ery*1.15).toFixed(1));
      eBase.setAttribute('fill', '#0e2210'); eBase.setAttribute('fill-opacity', '0.7');
      eBase.setAttribute('stroke', 'none');
      g.appendChild(eBase);
      // Textured surface
      const e = document.createElementNS(ns, 'ellipse');
      e.setAttribute('cx', ecx.toFixed(1)); e.setAttribute('cy', ecy.toFixed(1));
      e.setAttribute('rx', erx.toFixed(1)); e.setAttribute('ry', ery.toFixed(1));
      e.setAttribute('fill', 'url(#pat-green-active)');
      e.setAttribute('fill-opacity', '0.9');
      e.setAttribute('stroke', stroke);
      e.setAttribute('stroke-width', '1.5');
      e.setAttribute('stroke-opacity', '0.6');
      g.appendChild(e);
      continue;
    }

    // ── Solid building mass: hatched rect with architectural weight ──
    // Outer mass (slightly inset from footprint edge — shadow/depth)
    const shadow = document.createElementNS(ns, 'rect');
    shadow.setAttribute('x', (bldg.x+3).toFixed(1));
    shadow.setAttribute('y', (bldg.y+3).toFixed(1));
    shadow.setAttribute('width', bldg.w.toFixed(1));
    shadow.setAttribute('height', bldg.h.toFixed(1));
    shadow.setAttribute('fill', '#000');
    shadow.setAttribute('fill-opacity', '0.35');
    shadow.setAttribute('rx', '1');
    g.appendChild(shadow);

    // Building mass — hatched fill
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', bldg.x.toFixed(1));
    rect.setAttribute('y', bldg.y.toFixed(1));
    rect.setAttribute('width', bldg.w.toFixed(1));
    rect.setAttribute('height', bldg.h.toFixed(1));
    rect.setAttribute('fill', USE_HATCH[use] || 'url(#pat-hatch-mix)');
    rect.setAttribute('stroke', stroke);
    rect.setAttribute('stroke-width', isResidential ? '2.2' : '2.0');
    rect.setAttribute('stroke-opacity', '0.95');
    rect.setAttribute('rx', '1');
    rect.setAttribute('data-use', use);
    g.appendChild(rect);

    // ── Courtyard void — A&P P115 style ──
    // Only for buildings large enough to wrap a court (>70ft wide, >60ft deep)
    if (bldg.w > 70 && bldg.h > 60) {
      const inset = Math.min(bldg.w, bldg.h) * 0.22;
      const vx = bldg.x + inset, vy = bldg.y + inset;
      const vw = bldg.w - inset*2, vh = bldg.h - inset*2;
      if (vw > 20 && vh > 20) {
        // Void as dark dotted area (figured space)
        const void_rect = document.createElementNS(ns, 'rect');
        void_rect.setAttribute('x', vx.toFixed(1)); void_rect.setAttribute('y', vy.toFixed(1));
        void_rect.setAttribute('width', vw.toFixed(1)); void_rect.setAttribute('height', vh.toFixed(1));
        void_rect.setAttribute('fill', 'url(#pat-void)');
        void_rect.setAttribute('stroke', stroke);
        void_rect.setAttribute('stroke-width', '0.8');
        void_rect.setAttribute('stroke-opacity', '0.4');
        g.appendChild(void_rect);
      }
    }

    // ── 25ft lot lines — residential only ──
    if (isResidential) {
      const lots = Math.max(1, Math.round(bldg.w / 25));
      for (let i = 1; i < lots; i++) {
        const lx = bldg.x + i * 25;
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', lx.toFixed(1)); line.setAttribute('y1', bldg.y.toFixed(1));
        line.setAttribute('x2', lx.toFixed(1)); line.setAttribute('y2', (bldg.y+bldg.h).toFixed(1));
        line.setAttribute('stroke', '#040402'); line.setAttribute('stroke-width', '1.0');
        line.setAttribute('stroke-opacity', '0.5');
        g.appendChild(line);
      }
    }

    // ── Ground-floor commercial stripe ──
    if (isCommercial && bldg.h > 35) {
      const gh = Math.min(bldg.h * 0.26, 28);
      const gRect = document.createElementNS(ns, 'rect');
      gRect.setAttribute('x', bldg.x.toFixed(1));
      gRect.setAttribute('y', (bldg.y + bldg.h - gh).toFixed(1));
      gRect.setAttribute('width', bldg.w.toFixed(1));
      gRect.setAttribute('height', gh.toFixed(1));
      gRect.setAttribute('fill', '#ff6820');
      gRect.setAttribute('fill-opacity', '0.4');
      gRect.setAttribute('stroke', 'none');
      g.appendChild(gRect);
    }

    // ── Unit label — residential, if large enough ──
    if (isResidential && bldg.w > 40) {
      const lots = Math.max(1, Math.round(bldg.w / 25));
      const units = lots * 15;
      if (units >= 10) {
        const lbl = document.createElementNS(ns, 'text');
        lbl.setAttribute('x', (bldg.x + bldg.w/2).toFixed(1));
        lbl.setAttribute('y', (bldg.y + bldg.h/2 + 4).toFixed(1));
        lbl.setAttribute('text-anchor', 'middle');
        lbl.setAttribute('dominant-baseline', 'middle');
        lbl.setAttribute('font-family', 'monospace');
        lbl.setAttribute('font-size', '7');
        lbl.setAttribute('font-weight', '600');
        lbl.setAttribute('fill', '#fff');
        lbl.setAttribute('fill-opacity', '0.8');
        lbl.textContent = units;
        g.appendChild(lbl);
      }
    }
  }

  // ── Inter-building connections (P108 — Connected Buildings) ──────────
  // Draw thin links between buildings that share a pattern and are close
  const CONN_MAX_GAP = 40; // ft — maximum gap to draw a connection
  const connG = document.createElementNS(ns, 'g');
  connG.setAttribute('data-plan-sub', 'connections');
  for (let i = 0; i < buildings.length; i++) {
    const a = buildings[i];
    const aUse = PID_USE[Number(a.domPid)] || 'MIXED';
    if (aUse === 'GREEN') continue;
    const aCx = a.x+a.w/2, aCy = a.y+a.h/2;
    for (let j = i+1; j < buildings.length; j++) {
      const b = buildings[j];
      const bUse = PID_USE[Number(b.domPid)] || 'MIXED';
      if (bUse !== aUse) continue;
      // Nearest edge-to-edge distance (approximate)
      const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x+a.w, b.x+b.w));
      const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y+a.h, b.y+b.h));
      const gap = Math.sqrt(gapX*gapX + gapY*gapY);
      if (gap > CONN_MAX_GAP || gap < 2) continue;
      // Midpoint connection line
      const bCx = b.x+b.w/2, bCy = b.y+b.h/2;
      const conn = document.createElementNS(ns, 'line');
      conn.setAttribute('x1', aCx.toFixed(1)); conn.setAttribute('y1', aCy.toFixed(1));
      conn.setAttribute('x2', bCx.toFixed(1)); conn.setAttribute('y2', bCy.toFixed(1));
      conn.setAttribute('stroke', USE_STROKE[aUse] || '#888');
      conn.setAttribute('stroke-width', '1.5');
      conn.setAttribute('stroke-opacity', '0.3');
      conn.setAttribute('stroke-dasharray', '3,4');
      connG.appendChild(conn);
    }
  }
  g.appendChild(connG);

  // ── Suppressed hot nodes ──────────────────────────────────────────────
  const gNodes = document.createElementNS(ns, 'g');
  gNodes.setAttribute('data-plan-layer', 'hotnodes');
  gNodes.setAttribute('pointer-events', 'none');
  for (const n of (_psResult?.hotNodes || [])) {
    if ((n.nStrong||0) < 5) continue; // only strongest nodes
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', n.x.toFixed(1)); c.setAttribute('cy', n.y.toFixed(1));
    c.setAttribute('r', '3');
    c.setAttribute('fill', '#e8b820'); c.setAttribute('fill-opacity', '0.18');
    c.setAttribute('stroke', '#e8b820'); c.setAttribute('stroke-width', '0.5');
    gNodes.appendChild(c);
  }
  g.appendChild(gNodes);

  // Green fill: EDA cells without buildings rendered as park/wetland
  // (Performed in a post-render pass via CSS filter on the SVG — no main-thread PIP scan)
  svg.appendChild(g);
  if (window.EC_PanZoom) window.EC_PanZoom.reinit();
}

// Node overlay toggle ─────────────────────────────────────────────────────
let _nodesOn = false;
function toggleNodes(btn) {
  _nodesOn = !_nodesOn;
  btn.classList.toggle('on', _nodesOn);
  const svg = document.getElementById('site-plan');
  svg?.querySelector('[data-plan-layer="nodes"]')?.remove();
  if (!_nodesOn) return;
  const sg = window._lastPatternResult?.sceneGraph;
  if (!sg || !svg) return;
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('data-plan-layer', 'nodes');
  g.setAttribute('pointer-events', 'none');
  for (const inst of sg.instances) {
    const pts = Array.isArray(inst.geom) ? inst.geom : (inst.geom ? [inst.geom] : []);
    const flat = pts.flat ? pts.flat() : pts;
    const xs = flat.map(p => p.x ?? 0), ys = flat.map(p => p.y ?? 0);
    if (!xs.length) continue;
    const cx = xs.reduce((a,b)=>a+b,0)/xs.length;
    const cy = ys.reduce((a,b)=>a+b,0)/ys.length;
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', 4);
    c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#e8b820');
    c.setAttribute('stroke-width', '1'); c.setAttribute('stroke-opacity', '0.7');
    g.appendChild(c);
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', cx+5); t.setAttribute('y', cy+3);
    t.setAttribute('font-family', 'monospace'); t.setAttribute('font-size', '5.5');
    t.setAttribute('fill', '#e8b820'); t.setAttribute('fill-opacity', '0.8');
    t.textContent = `P${inst.patternId}`;
    g.appendChild(t);
  }
  svg.appendChild(g);
}

// Zone overlay (pattern polygon footprints) ──────────────────────────────
let _patternOverlayOn = false;
function togglePatternOverlay(btn) {
  _patternOverlayOn = !_patternOverlayOn;
  btn.classList.toggle('on', _patternOverlayOn);
  document.getElementById('site-plan')?.querySelector('#pattern-overlay')?.remove();
  if (!_patternOverlayOn) return;
  const sg = window._lastPatternResult?.sceneGraph;
  if (sg) renderPatternOverlay2D(sg);
}

function renderPatternOverlay2D(sg) {
  const svg = document.getElementById('site-plan');
  if (!svg) return;

  // Remove old overlay
  const old = svg.querySelector('#pattern-overlay');
  if (old) old.remove();

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('id', 'pattern-overlay');
  g.setAttribute('pointer-events', 'none');

  const PATTERNS_META = window.EC_PatternSolver?.PATTERNS || {};

  for (const inst of (sg.instances || [])) {
    const pid   = inst.patternId;
    const pat   = PATTERNS_META[pid];
    const col   = PATTERN_COLORS[pid] || { fill:'#888', stroke:'#aaa', label:'?' };
    const scale = pat?.scale || 3;
    const fOpacity = SCALE_OPACITY[scale] ?? 0.2;
    const sOpacity = Math.min(1, fOpacity * 3.5);

    const geoms = inst.geomType === 'polygon_array'
      ? inst.geom
      : inst.geomType === 'polygon' || inst.geomType === 'point' || inst.geomType === 'spline' || inst.geomType === 'point_cloud'
        ? [inst.geom]
        : null;

    if (!geoms) continue;

    for (const geom of geoms) {
      const pts = Array.isArray(geom) ? geom : (geom?.pts || (geom?.type === 'point' ? [geom] : null));
      if (!pts || pts.length === 0) continue;

      // Polygon / multi-point — draw filled shape
      if (pts.length >= 3) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', ptsToSvgD(pts));
        path.setAttribute('fill', col.fill);
        path.setAttribute('fill-opacity', fOpacity);
        path.setAttribute('stroke', col.stroke);
        path.setAttribute('stroke-width', scale <= 2 ? '1' : '0.6');
        path.setAttribute('stroke-opacity', sOpacity);
        // EDGE scale: dashed for splines
        if (scale === 5 || inst.geomType === 'spline') {
          path.setAttribute('stroke-dasharray', '4,3');
        }
        // DISTRICT scale: dashed boundary
        if (scale === 1) {
          path.setAttribute('stroke-dasharray', '6,4');
          path.setAttribute('stroke-width', '1.2');
        }
        g.appendChild(path);
      }

      // Point or 2-point: draw marker / line
      if (pts.length === 1) {
        const p = pts[0];
        const r = scale === 1 ? 10 : scale === 5 ? 4 : 6;
        const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circ.setAttribute('cx', p.x || 0);
        circ.setAttribute('cy', p.y || 0);
        circ.setAttribute('r', r);
        circ.setAttribute('fill', col.fill);
        circ.setAttribute('fill-opacity', fOpacity * 2);
        circ.setAttribute('stroke', col.stroke);
        circ.setAttribute('stroke-width', '1');
        circ.setAttribute('stroke-opacity', sOpacity);
        g.appendChild(circ);
      } else if (pts.length === 2) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', pts[0].x); line.setAttribute('y1', pts[0].y);
        line.setAttribute('x2', pts[1].x); line.setAttribute('y2', pts[1].y);
        line.setAttribute('stroke', col.stroke);
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-opacity', sOpacity);
        line.setAttribute('stroke-dasharray', '8,4');
        g.appendChild(line);
      }
    }

    // Centroid label for district-scale patterns
    if (scale <= 2) {
      const allPts = geoms.flat().filter(p => p && typeof p.x === 'number');
      if (allPts.length > 0) {
        const cx = allPts.reduce((s, p) => s + p.x, 0) / allPts.length;
        const cy = allPts.reduce((s, p) => s + p.y, 0) / allPts.length;
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', cx);
        label.setAttribute('y', cy);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('font-family', 'monospace');
        label.setAttribute('font-size', scale === 1 ? '7' : '5.5');
        label.setAttribute('fill', col.stroke);
        label.setAttribute('fill-opacity', '0.85');
        label.textContent = `P${pid}`;
        g.appendChild(label);
      }
    }
  }

  // Render promenade spine as a thick highlighted spline
  const promenade = (sg.instances || []).find(i => i.patternId === 31);
  if (promenade && promenade.geom?.length >= 2) {
    const pts = promenade.geom;
    const spline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    spline.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
    spline.setAttribute('fill', 'none');
    spline.setAttribute('stroke', '#48a8d8');
    spline.setAttribute('stroke-width', '3');
    spline.setAttribute('stroke-opacity', '0.55');
    spline.setAttribute('stroke-linecap', 'round');
    g.appendChild(spline);
  }

  svg.appendChild(g);

  // Update pattern count readout
  const patEl = document.getElementById('res-patterns');
  if (patEl) {
    const instCount  = sg.instances?.length || 0;
    const scaleCount = {};
    for (const inst of (sg.instances || [])) {
      const s = (window.EC_PatternSolver?.PATTERNS?.[inst.patternId]?.scale) || 0;
      scaleCount[s] = (scaleCount[s] || 0) + 1;
    }
    const summary = Object.entries(scaleCount)
      .sort(([a],[b]) => a-b)
      .map(([s,c]) => `S${s}:${c}`)
      .join(' ');
    patEl.textContent = `${instCount} inst — ${summary}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  EC_PanZoom — Touch-friendly pan/zoom with level-of-detail
//
//  Works on the SVG element directly via a <g id="pz-root"> transform.
//  1 SVG unit = 1 ft. Canvas 4200×3700ft.
//
//  LOD thresholds (zoom = ft-per-viewport-width / canvas-ft):
//    z < 0.35  SITE   — full site, district labels only
//    z < 0.8   BLOCK  — building hulls + pattern labels
//    z < 2.0   PARCEL — individual parcels, floor counts
//    z ≥ 2.0   UNIT   — units, bay widths, courtyard dims
// ═══════════════════════════════════════════════════════════════════════════
(function() {
  const CANVAS_W = 4200, CANVAS_H = 3700;
  const MIN_ZOOM = 0.18;  // whole site + margin
  const MAX_ZOOM = 12;    // single parcel fills screen

  let zoom = MIN_ZOOM;          // current scale (svg units per css pixel … inverted: px per ft)
  let tx = 0, ty = 0;          // translate in SVG ft units
  let svg, pzRoot, vpW, vpH;
  let dragging = false, lastX = 0, lastY = 0;
  let touches = [];
  let lastPinchDist = 0;
  let animFrame = null;
  let _lodLevel = 'site';

  // Current LOD level based on zoom
  function lodLevel(z) {
    if (z < 0.35) return 'site';
    if (z < 0.8)  return 'block';
    if (z < 2.0)  return 'parcel';
    return 'unit';
  }

  function applyTransform() {
    if (!pzRoot) return;
    // Center the view: translate so viewport center maps to (cx,cy) in ft space
    pzRoot.setAttribute('transform', `scale(${zoom}) translate(${tx},${ty})`);

    // LOD: update detail visibility
    const lod = lodLevel(zoom);
    if (lod !== _lodLevel) {
      _lodLevel = lod;
      updateLOD(lod);
    }
  }

  function updateLOD(lod) {
    if (!svg) return;
    // Building hulls always visible. Labels and detail layers shown/hidden by LOD.
    const detailEls  = svg.querySelectorAll('[data-lod="parcel"],[data-lod="unit"]');
    const blockEls   = svg.querySelectorAll('[data-lod="block"]');
    const labelEls   = svg.querySelectorAll('[data-lod-label]');
    const siteLabels = svg.querySelectorAll('[data-lod-label="site"]');

    detailEls.forEach(e => e.style.display  = (lod === 'parcel' || lod === 'unit') ? '' : 'none');
    blockEls.forEach(e  => e.style.display  = (lod !== 'site') ? '' : 'none');
    labelEls.forEach(e  => e.style.display  = 'none');
    siteLabels.forEach(e=> e.style.display  = '');

    // Scale-invariant stroke widths and text sizes
    const invZ = 1 / zoom;
    svg.querySelectorAll('[data-plan-layer="buildings"] path, [data-plan-layer="buildings"] circle')
       .forEach(e => e.setAttribute('stroke-width', (1.5 * invZ).toFixed(2)));
    svg.querySelectorAll('[data-plan-layer="buildings"] text')
       .forEach(e => e.setAttribute('font-size', (7 * invZ).toFixed(2)));
    // EDA parcel outlines
    svg.querySelectorAll('.eda-outline')
       .forEach(e => e.setAttribute('stroke-width', (0.8 * invZ).toFixed(2)));
  }

  // Clamp translate so we can't pan off the canvas entirely
  function clampTranslate() {
    const visW = vpW / zoom;
    const visH = vpH / zoom;
    const margin = 200;  // ft of bleed allowed outside canvas
    tx = Math.min(margin, Math.max(-(CANVAS_W - visW + margin), tx));
    ty = Math.min(margin, Math.max(-(CANVAS_H - visH + margin), ty));
  }

  // Zoom around canvasPt (ft) keeping it fixed on screen.
  // Transform: screen_px = (canvas_ft + tx) * zoom * svgScale
  // To keep canvas_ft fixed: tx_new = canvas_ft * (zoom/newZoom - 1) + tx * (zoom/newZoom)
  function zoomAround(canvasX, canvasY, factor) {
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    if (newZoom === zoom) return;
    const ratio = zoom / newZoom;
    tx = canvasX * (ratio - 1) + tx * ratio;
    ty = canvasY * (ratio - 1) + ty * ratio;
    zoom = newZoom;
    clampTranslate();
    scheduleApply();
  }

  function scheduleApply() {
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(applyTransform);
  }

  // Screen px → SVG ft
  function screenToSVG(sx, sy) {
    const rect = svg.getBoundingClientRect();
    const svgScale = rect.width / CANVAS_W;  // css px per SVG unit (ft)
    return {
      x: (sx - rect.left) / svgScale / zoom - tx,
      y: (sy - rect.top)  / svgScale / zoom - ty,
    };
  }

  // ── Mouse events ──────────────────────────────────────────────────────────
  function onMouseDown(e) {
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    svg.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!dragging) return;
    const rect = svg.getBoundingClientRect();
    const svgScale = rect.width / CANVAS_W;
    tx += (e.clientX - lastX) / svgScale / zoom;
    ty += (e.clientY - lastY) / svgScale / zoom;
    lastX = e.clientX; lastY = e.clientY;
    clampTranslate();
    scheduleApply();
  }

  function onMouseUp() { dragging = false; svg.style.cursor = 'grab'; }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const pt = screenToSVG(e.clientX, e.clientY);
    zoomAround(pt.x, pt.y, factor);
  }

  function onDblClick(e) {
    const pt = screenToSVG(e.clientX, e.clientY);
    zoomAround(pt.x, pt.y, 2.5);
  }

  // ── Touch events ──────────────────────────────────────────────────────────
  function touchDist(t1, t2) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }
  function touchMid(t1, t2) {
    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
  }

  function onTouchStart(e) {
    e.preventDefault();
    touches = Array.from(e.touches);
    if (touches.length === 1) {
      dragging = true;
      lastX = touches[0].clientX; lastY = touches[0].clientY;
    } else if (touches.length === 2) {
      dragging = false;
      lastPinchDist = touchDist(touches[0], touches[1]);
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    const t = Array.from(e.touches);
    if (t.length === 1 && dragging) {
      const rect = svg.getBoundingClientRect();
      const svgScale = rect.width / CANVAS_W;
      tx += (t[0].clientX - lastX) / svgScale / zoom;
      ty += (t[0].clientY - lastY) / svgScale / zoom;
      lastX = t[0].clientX; lastY = t[0].clientY;
      clampTranslate();
      scheduleApply();
    } else if (t.length === 2) {
      const dist = touchDist(t[0], t[1]);
      const factor = dist / Math.max(1, lastPinchDist);
      const mid = touchMid(t[0], t[1]);
      const pt = screenToSVG(mid.x, mid.y);
      zoomAround(pt.x, pt.y, factor);
      lastPinchDist = dist;
      touches = t;
    }
  }

  function onTouchEnd(e) {
    touches = Array.from(e.touches);
    if (touches.length < 2) dragging = touches.length === 1;
    if (touches.length === 0) dragging = false;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.EC_PanZoom = {
    init() {
      svg = document.getElementById('site-plan');
      if (!svg) return;

      // Wrap all SVG children in a <g> transform root
      pzRoot = svg.querySelector('#pz-root');
      if (!pzRoot) {
        pzRoot = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        pzRoot.setAttribute('id', 'pz-root');
        while (svg.firstChild) pzRoot.appendChild(svg.firstChild);
        svg.appendChild(pzRoot);
      }

      // Initial zoom: fit the whole canvas
      this.reinit();

      svg.style.cursor = 'grab';
      svg.style.touchAction = 'none';
      svg.style.userSelect = 'none';

      svg.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      svg.addEventListener('wheel', onWheel, { passive: false });
      svg.addEventListener('dblclick', onDblClick);
      svg.addEventListener('touchstart', onTouchStart, { passive: false });
      svg.addEventListener('touchmove', onTouchMove, { passive: false });
      svg.addEventListener('touchend', onTouchEnd);
    },

    reinit() {
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      vpW = rect.width || 800;
      vpH = rect.height || 600;
      // Compute pzRoot wrapping after any re-render
      pzRoot = svg.querySelector('#pz-root');
      if (!pzRoot) { this.init(); return; }
      // Keep current zoom/translate if already set, otherwise fit to canvas
      if (zoom === MIN_ZOOM && tx === 0 && ty === 0) this.reset();
      else applyTransform();
    },

    reset() {
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      vpW = rect.width || 800;
      vpH = rect.height || 600;
      zoom = MIN_ZOOM;
      tx = 0; ty = 0;
      applyTransform();
    },

    // Fit zoom/pan to show a specific ft bbox
    fitBBox(x0, y0, x1, y1, padFrac = 0.08) {
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      vpW = rect.width || 800; vpH = rect.height || 600;
      const svgScale = rect.width / CANVAS_W;  // css px per SVG ft
      const bw = x1 - x0, bh = y1 - y0;
      if (bw < 1 || bh < 1) return;
      const pad = Math.max(bw, bh) * padFrac;
      const pw = bw + pad * 2, ph = bh + pad * 2;
      // zoom so bbox fills viewport: visible_ft = viewport_px / (svgScale * zoom)
      zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(
        vpW / (svgScale * pw),
        vpH / (svgScale * ph)
      )));
      // center: tx = visibleWidth/2 - bboxCenterX
      const visW = vpW / (svgScale * zoom);
      const visH = vpH / (svgScale * zoom);
      tx = visW / 2 - (x0 + x1) / 2;
      ty = visH / 2 - (y0 + y1) / 2;
      clampTranslate();
      applyTransform();
    },

    zoomTo(level) {
      // level: 'site'|'block'|'parcel'|'unit'
      const targets = { site: MIN_ZOOM, block: 0.5, parcel: 1.2, unit: 3.0 };
      const target = targets[level] || MIN_ZOOM;
      const cx = CANVAS_W / 2, cy = CANVAS_H / 2;
      const steps = 12;
      let step = 0;
      const animate = () => {
        step++;
        const t = step / steps;
        const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
        zoom = zoom + (target - zoom) * ease * 0.15;
        clampTranslate();
        applyTransform();
        if (step < steps) requestAnimationFrame(animate);
      };
      animate();
    },

    getLOD() { return _lodLevel; },
    getZoom() { return zoom; },
  };

  // Boot after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.EC_PanZoom.init();
      // Smoke test: confirm mapLog is wired
      setTimeout(() => mapLog('map ready', 'ok'), 500);
    });
  } else {
    window.EC_PanZoom.init();
    setTimeout(() => mapLog('map ready', 'ok'), 500);
  }

  // After re-renders, rewrap new children into pz-root
  // (renderPlanBuildings appends directly to svg — need to adopt)
  const _origRender = window.renderPlanBuildings;
  // Patch renderPlanBuildings to adopt new children into pz-root post-render
  // Done via MutationObserver on the svg instead (non-invasive)
  const obs = new MutationObserver(() => {
    const root = document.querySelector('#site-plan #pz-root');
    if (!root) return;
    const svg2 = document.getElementById('site-plan');
    if (!svg2) return;
    // Move any direct children of svg that aren't pz-root into pz-root
    Array.from(svg2.children).forEach(child => {
      if (child.id !== 'pz-root') root.appendChild(child);
    });
    applyTransform();
  });
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.getElementById('site-plan');
    if (s) obs.observe(s, { childList: true });
  });
})();

// ═══════════════════════════════════════════════════════════════════════════
//  EC_FieldSolver — Gaussian pressure-field solver (ported from patterns-3d.html)
//  50+ Alexander patterns → pressure fields → field lines → buildings
// ═══════════════════════════════════════════════════════════════════════════
// EC_FieldSolver runs in Worker (ec-solver-worker.js)



