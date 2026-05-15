// ec-pattern-defs.js — Eastside Commons pattern registry
// Pure data. No functions. Interpreted by ec-solver-worker.js.
//
// ── Op types ──────────────────────────────────────────────────────────────
//  gaussian  {anchor, r, a}                 Gaussian blob at point
//  segment   {from, to, w, a}               Pressure strip along line
//  ellipse   {anchor, rx, ry, a}            Elliptical fill (rx/ry in ft, or scale strings)
//  zone_fill {zone, a}                      Uniform fill across named zone
//  grid      {zone, cols, rows, r, a, jitter?}  Distributed gaussian grid
//  perimeter {zone, w, a}                   Pressure along zone boundary ring
//  ring      {anchor, r0, r1, a}            Annular pressure (r0=inner, r1=outer)
//  repel     {anchor, r, a}                 Negative Gaussian (subtract)
//  connect   {from, to, w, a}               Alias for segment
//
// ── Anchor strings ────────────────────────────────────────────────────────
//  SPINE.cx, SPINE.cy          Centre point
//  SPINE.north                 Top centre
//  SPINE.south                 Bottom centre
//  SPINE.nw / ne / sw / se     Corners
//  SPINE.n{pct}                Point at pct% down from top  (e.g. SPINE.n25)
//  SPINE.w{ft}                 ft west of west edge          (e.g. SPINE.w35)
//  SPINE.e{ft}                 ft east of east edge
//  SPONGE.cx, SPONGE.cy        Sponge ellipse centre
//  SPONGE.rx, SPONGE.ry        Sponge ellipse radii (used in ring r0/r1)
//  BASIN.cx, BASIN.cy
//  TIDE.cx, TIDE.cy
//  TIDE.north
//  BAND.cx, BAND.cy
//  BAND.south
//  MAP.cx, MAP.cy              Map centre
//  MAP.west, MAP.east          Mid-height west/east edges
//  MAP.y{pct}                  Point at pct% down from top  (e.g. MAP.y40)
//  WEST.cx, WEST.cy            West zone centre
//  WEST.north                  West zone top centre
//  WEST.south                  West zone bottom centre
//  PARCEL:{spec}               Centroid of named parcel (proj'd)
//
// ── Zone strings ──────────────────────────────────────────────────────────
//  west    MAP.x0..SPINE.x, topY..MAP.y1    CLT housing zone
//  east    SPINE.x+SPINE.w..MAP.x1           Research/mixed zone
//  spine   SPINE.x..SPINE.x+SPINE.w          Promenade spine
//  band    Full width, MAP.y0..BAND.y+BAND.h  Commercial band
//  eda     Full EDA mask (all buildable area)
//
// ── Numeric expressions ───────────────────────────────────────────────────
//  r, a, rx, ry, w can be numbers or strings like 'SPONGE.rx*1.3'
//  Evaluated by the interpreter against live geometry values.

'use strict';

const EC_PATTERN_DEFS = [

  // ── DISTRICT STRUCTURE ─────────────────────────────────────────────────

  { id:29, name:'Density Rings',       weight:1.0, use:'MIXED', ops:[
    { type:'segment',  from:'SPINE.north', to:'SPINE.south', w:'SPINE.w*2', a:1.2 },
    { type:'gaussian', anchor:'SPINE.cx', r:180, a:0.7 },
  ]},

  { id:30, name:'Activity Nodes',      weight:1.2, use:'COMMERCIAL', ops:[
    { type:'gaussian', anchor:'SPINE.n25', r:230, a:1.5 },
    { type:'gaussian', anchor:'SPINE.n75', r:230, a:1.5 },
    { type:'gaussian', anchor:'MAP.west',  r:150, a:0.8 },
    { type:'gaussian', anchor:'MAP.east',  r:150, a:0.8 },
  ]},

  { id:31, name:'Promenade',           weight:1.1, use:'COMMERCIAL', ops:[
    { type:'segment', from:'SPINE.north', to:'SPINE.south', w:90, a:1.4 },
  ]},

  { id:36, name:'Degrees of Publicness', weight:0.7, use:'MIXED', ops:[
    { type:'segment', from:'SPINE.w100_north', to:'SPINE.w100_south', w:40, a:0.7 },
    { type:'segment', from:'SPINE.e100_north', to:'SPINE.e100_south', w:40, a:0.7 },
    { type:'segment', from:'SPINE.w200_north', to:'SPINE.w200_south', w:40, a:0.5 },
    { type:'segment', from:'SPINE.e200_north', to:'SPINE.e200_south', w:40, a:0.5 },
  ]},

  { id:53, name:'Main Gateways',       weight:1.0, use:'CIVIC', ops:[
    { type:'gaussian', anchor:'SPINE.south',   r:220, a:1.4 },
    { type:'gaussian', anchor:'BAND.south',    r:210, a:1.2 },
    { type:'gaussian', anchor:'MAP.west',      r:180, a:0.95 },
    { type:'gaussian', anchor:'MAP.east',      r:180, a:0.95 },
    { type:'connect',  from:'MAP.west', to:'SPINE.cx', w:65, a:0.55 },
  ]},

  { id:3,  name:'City Country Fingers', weight:1.0, use:'GREEN', ops:[
    { type:'ellipse', anchor:'SPONGE.cx', rx:'SPONGE.rx*1.6', ry:'SPONGE.ry*1.8', a:-0.4 },
    { type:'segment', from:'SPINE.north', to:'SPINE.south', w:180, a:1.1 },
    { type:'zone_fill', zone:'west', a:0.4 },
  ]},

  { id:14, name:'Identifiable Neighborhood', weight:0.7, use:'MIXED', ops:[
    { type:'ring', anchor:'SPINE.cx',    r0:200, r1:350, a:0.65 },
    { type:'ring', anchor:'SPONGE.cx',   r0:150, r1:280, a:0.55 },
  ]},

  { id:8,  name:'Mosaic of Subcultures', weight:0.65, use:'MIXED', ops:[
    { type:'grid', zone:'eda', cols:4, rows:3, r:120, a:0.5, jitter:80 },
  ]},

  // ── HOUSING ────────────────────────────────────────────────────────────

  { id:37, name:'House Cluster',       weight:1.1, use:'RESIDENTIAL', ops:[
    { type:'grid',      zone:'west', cols:2, rows:3, r:'WEST_W*0.28', a:1.0 },
    { type:'zone_fill', zone:'west', a:0.62 },
  ]},

  { id:109,name:'Long Thin House',     weight:0.75, use:'RESIDENTIAL', ops:[
    { type:'grid', zone:'west', cols:1, rows:5, r:60, a:0.6 },
  ]},

  { id:107,name:'Wings of Light',      weight:0.85, use:'RESIDENTIAL', ops:[
    { type:'perimeter', zone:'west', w:55, a:0.65 },
  ]},

  { id:127,name:'Intimacy Gradient',   weight:0.65, use:'RESIDENTIAL', ops:[
    { type:'zone_fill', zone:'west', a:0.3 },
  ]},

  { id:35, name:'Household Mix',       weight:0.8, use:'RESIDENTIAL', ops:[
    { type:'grid',      zone:'west', cols:5, rows:1, r:'WEST_W*0.12', a:0.7 },
    { type:'gaussian',  anchor:'TIDE.cx',         r:200, a:0.6 },
    { type:'gaussian',  anchor:'WEST.north_shift', r:150, a:0.55 },
    { type:'gaussian',  anchor:'WEST.sponge_y',    r:180, a:0.6 },
  ]},

  { id:21, name:'Four-Story Limit',    weight:0.85, use:'RESIDENTIAL', ops:[
    { type:'zone_fill', zone:'west', a:0.55 },
    { type:'gaussian',  anchor:'SPINE.n25', r:160, a:0.5 },
    { type:'gaussian',  anchor:'SPINE.n75', r:160, a:0.5 },
  ]},

  { id:115,name:'Courtyards Which Live', weight:0.7, use:'RESIDENTIAL', ops:[
    { type:'grid', zone:'west', cols:2, rows:3, r:50, a:0.55 },
  ]},

  { id:116,name:'Cascade of Roofs',   weight:0.6, use:'RESIDENTIAL', ops:[
    { type:'perimeter', zone:'west', w:40, a:0.45 },
  ]},

  { id:105,name:'South Facing Outdoors', weight:0.75, use:'RESIDENTIAL', ops:[
    { type:'zone_fill', zone:'west', a:0.4 },
  ]},

  { id:128,name:'Indoor Sunlight',    weight:0.7, use:'RESIDENTIAL', ops:[
    { type:'zone_fill', zone:'west', a:0.35 },
  ]},

  // ── COMMERCIAL / MARKET ────────────────────────────────────────────────

  { id:87, name:'Shops',              weight:1.0, use:'COMMERCIAL', ops:[
    { type:'segment', from:'BAND.west_30', to:'BAND.east_30', w:'BAND_H*0.5', a:1.1 },
    { type:'segment', from:'BAND.west_75', to:'BAND.east_75', w:'BAND_H*0.4', a:0.9 },
    { type:'segment', from:'SPINE.nw',     to:'SPINE.sw',     w:60, a:0.95 },
    { type:'segment', from:'SPINE.ne',     to:'SPINE.se',     w:60, a:0.95 },
  ]},

  { id:88, name:'Street Cafe',        weight:0.85, use:'COMMERCIAL', ops:[
    { type:'gaussian', anchor:'SPINE.n25',  r:130, a:0.9 },
    { type:'gaussian', anchor:'TIDE.north', r:110, a:0.8 },
  ]},

  { id:46, name:'Market of Many Shops', weight:0.9, use:'COMMERCIAL', ops:[
    { type:'gaussian', anchor:'TIDE.cx',    r:200, a:1.1 },
    { type:'gaussian', anchor:'TIDE.north', r:140, a:0.8 },
  ]},

  { id:32, name:'Shopping Street',    weight:1.0, use:'COMMERCIAL', ops:[
    { type:'segment', from:'SPINE.north', to:'BAND.south', w:70, a:1.2 },
    { type:'gaussian', anchor:'TIDE.north', r:160, a:0.85 },
    { type:'segment', from:'MAP.west', to:'MAP.east', w:55, a:0.75, at_y:'BAND_CY' },
  ]},

  { id:9,  name:'Scattered Work',     weight:0.85, use:'COMMERCIAL', ops:[
    { type:'grid',    zone:'west', cols:3, rows:4, r:80, a:0.65, jitter:60 },
    { type:'segment', from:'SPINE.w10_north', to:'SPINE.w10_south', w:55, a:0.6 },
  ]},

  { id:100,name:'Pedestrian Street',  weight:1.1, use:'COMMERCIAL', ops:[
    { type:'segment', from:'BAND.west_60', to:'BAND.east_60', w:'BAND_H*0.6', a:1.0 },
  ]},

  { id:119,name:'Arcades',            weight:0.8, use:'COMMERCIAL', ops:[
    { type:'segment', from:'SPINE.nw', to:'SPINE.sw', w:35, a:0.7 },
    { type:'segment', from:'SPINE.ne', to:'SPINE.se', w:35, a:0.7 },
  ]},

  { id:123,name:'Pedestrian Density', weight:0.85, use:'COMMERCIAL', ops:[
    { type:'zone_fill', zone:'spine', a:0.85 },
    { type:'gaussian',  anchor:'WEST.cx', r:120, a:0.8 },
  ]},

  { id:122,name:'Building Fronts',    weight:0.8, use:'COMMERCIAL', ops:[
    { type:'segment', from:'SPINE.nw', to:'SPINE.sw', w:30, a:0.7 },
    { type:'segment', from:'SPINE.ne', to:'SPINE.se', w:30, a:0.7 },
  ]},

  // ── CIVIC ──────────────────────────────────────────────────────────────

  { id:44, name:'Local Town Hall',    weight:1.1, use:'CIVIC', ops:[
    { type:'gaussian', anchor:'PARCEL:CIVIC_700', r:250, a:1.3 },
    { type:'gaussian', anchor:'PARCEL:CIVIC_700', r:500, a:0.65 },
    { type:'gaussian', anchor:'WEST.north',       r:145, a:0.85 },
    { type:'grid',     zone:'west', cols:2, rows:2, r:100, a:0.55 },
  ]},

  { id:110,name:'Main Building',      weight:0.8, use:'CIVIC', ops:[
    { type:'gaussian', anchor:'TIDE.cx',          r:170, a:0.85 },
    { type:'gaussian', anchor:'PARCEL:CIVIC_700', r:150, a:0.75 },
  ]},

  // ── GREEN / ECOLOGY ────────────────────────────────────────────────────

  { id:60, name:'Accessible Green',   weight:0.9, use:'GREEN', ops:[
    { type:'ellipse', anchor:'SPONGE.cx', rx:'SPONGE.rx*1.3', ry:'SPONGE.ry*1.3', a:1.0 },
    { type:'gaussian', anchor:'WEST.n35', r:230, a:0.65 },
    { type:'gaussian', anchor:'WEST.n65', r:230, a:0.65 },
    { type:'segment', from:'MAP.east_165_north', to:'MAP.east_165_south', w:115, a:0.55 },
  ]},

  { id:67, name:'Common Land',        weight:0.8, use:'GREEN', ops:[
    { type:'ring', anchor:'SPONGE.cx', r0:'SPONGE.rx*0.8', r1:'SPONGE.rx*1.8', a:0.9, n_blobs:8 },
  ]},

  { id:71, name:'Still Water',        weight:0.8, use:'GREEN', ops:[
    { type:'ellipse', anchor:'BASIN.cx', rx:'BASIN.rx*1.5', ry:'BASIN.ry*1.5', a:1.2 },
  ]},

  { id:51, name:'Green Streets',      weight:0.85, use:'GREEN', ops:[
    { type:'connect', from:'SPINE.n30',  to:'SPONGE.cx', w:72, a:1.0 },
    { type:'connect', from:'MAP.west',   to:'SPINE.cx',  w:60, a:0.7, at_y:'MAP.y40' },
    { type:'connect', from:'SPINE.cx',   to:'MAP.east',  w:60, a:0.7, at_y:'MAP.y60' },
  ]},

  { id:61, name:'Small Public Squares', weight:0.75, use:'GREEN', ops:[
    { type:'gaussian', anchor:'SPINE.n25', r:90, a:0.7 },
    { type:'gaussian', anchor:'SPINE.n75', r:90, a:0.7 },
    { type:'gaussian', anchor:'WEST.cy',   r:80, a:0.6 },
  ]},

  { id:106,name:'Positive Outdoor Space', weight:0.7, use:'GREEN', ops:[
    { type:'zone_fill', zone:'west', a:0.25 },
  ]},

  { id:114,name:'Hierarchy of Open Space', weight:0.65, use:'GREEN', ops:[
    { type:'ellipse', anchor:'SPONGE.cx', rx:'SPONGE.rx*2.0', ry:'SPONGE.ry*2.0', a:0.4 },
    { type:'ellipse', anchor:'SPONGE.cx', rx:'SPONGE.rx*0.8', ry:'SPONGE.ry*0.8', a:0.6 },
  ]},

  { id:25, name:'Access to Water',    weight:0.9, use:'GREEN', ops:[
    { type:'ring',    anchor:'SPONGE.cx', r0:0, r1:900, a:1.0, decay:'sponge_rim' },
    { type:'ellipse', anchor:'BASIN.cx', rx:'BASIN.rx', ry:'BASIN.ry', a:0.7 },
    { type:'connect', from:'SPONGE.cx', to:'TIDE.north', w:55, a:0.65 },
  ]},

  { id:172,name:'Garden Growing Wild', weight:0.75, use:'GREEN', ops:[
    { type:'ring', anchor:'SPONGE.cx', r0:'SPONGE.rx', r1:'SPONGE.rx*1.4', a:0.8 },
    { type:'zone_fill', zone:'west', a:0.3 },
  ]},

  { id:174,name:'Trellised Walk',     weight:0.8, use:'GREEN', ops:[
    { type:'segment', from:'SPINE.w20_north', to:'SPINE.w20_south', w:35, a:0.75 },
    { type:'segment', from:'SPINE.e20_north', to:'SPINE.e20_south', w:35, a:0.75 },
  ]},

  { id:176,name:'Garden Wall',        weight:0.7, use:'GREEN', ops:[
    { type:'perimeter', zone:'west', w:25, a:0.55 },
  ]},

  { id:56, name:'Bike Paths and Racks', weight:0.8, use:'GREEN', ops:[
    { type:'segment', from:'SPINE.w35_north', to:'SPINE.w35_south', w:40, a:0.8 },
    { type:'connect', from:'MAP.west', to:'MAP.east', w:35, a:0.55, at_y:'MAP.y33' },
    { type:'connect', from:'MAP.west', to:'MAP.east', w:35, a:0.55, at_y:'MAP.y66' },
    { type:'ring',    anchor:'SPONGE.cx', r0:'SPONGE.rx*1.1', r1:'SPONGE.rx*1.4', a:0.7 },
    { type:'gaussian', anchor:'TIDE.cx', r:90, a:0.65 },
  ]},

  { id:120,name:'Paths and Goals',    weight:0.9, use:'GREEN', ops:[
    { type:'connect', from:'SPINE.south',  to:'SPONGE.cx',  w:50, a:0.8 },
    { type:'connect', from:'SPINE.north',  to:'TIDE.cx',    w:50, a:0.75 },
    { type:'connect', from:'SPINE.cx',     to:'MAP.west',   w:45, a:0.6 },
  ]},

  // ── BUILDING FORM ──────────────────────────────────────────────────────

  { id:95, name:'Building Complex',   weight:0.7, use:'MIXED', ops:[
    { type:'gaussian', anchor:'SPINE.cx', r:160, a:0.55 },
  ]},

  { id:104,name:'Site Repair',        weight:0.7, use:'MIXED', ops:[
    { type:'perimeter', zone:'eda', w:60, a:0.6 },
  ]},

  { id:108,name:'Connected Buildings', weight:0.75, use:'MIXED', ops:[
    { type:'connect', from:'SPINE.cx', to:'WEST.cx', w:40, a:0.55 },
  ]},

  { id:160,name:'Building Edge',      weight:0.75, use:'MIXED', ops:[
    { type:'perimeter', zone:'eda', w:45, a:0.55 },
  ]},

  // ── PRESERVATION ──────────────────────────────────────────────────────

  { id:40, name:'Old Buildings',      weight:0.9, use:'RESIDENTIAL', ops:[
    { type:'ring', anchor:'PARCEL:HOUSING_A_530', r0:0,  r1:60,  a:-1.2 },
    { type:'ring', anchor:'PARCEL:HOUSING_A_530', r0:60, r1:200, a:0.55 },
    { type:'ring', anchor:'PARCEL:CIVIC_700',     r0:0,  r1:60,  a:-1.2 },
    { type:'ring', anchor:'PARCEL:CIVIC_700',     r0:60, r1:200, a:0.55 },
  ]},

  // ── HIGHER-LEVEL ──────────────────────────────────────────────────────

  { id:29, name:'Density Rings [dup]', weight:0, enabled:false, use:'MIXED', ops:[] }, // sentinel

];

// ── Use-class color map ───────────────────────────────────────────────────
const EC_USE_COLORS = {
  RESIDENTIAL: '#6a9fd8',   // blue
  COMMERCIAL:  '#c87818',   // amber
  CIVIC:       '#b05090',   // plum
  GREEN:       '#3aab60',   // green
  MIXED:       '#d0c060',   // gold
};

if (typeof self    !== 'undefined') {
  self.EC_PATTERN_DEFS = EC_PATTERN_DEFS;
  self.EC_USE_COLORS   = EC_USE_COLORS;
}
if (typeof window  !== 'undefined') {
  window.EC_PATTERN_DEFS = EC_PATTERN_DEFS;
  window.EC_USE_COLORS   = EC_USE_COLORS;
}
if (typeof module  !== 'undefined') module.exports = { EC_PATTERN_DEFS, EC_USE_COLORS };
