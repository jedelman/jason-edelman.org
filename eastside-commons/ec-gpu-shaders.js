// ec-gpu-shaders.js
// All GLSL source for the Eastside Commons GPU field pipeline.
//
// Field layout (RGBA32F textures):
//   uF0: SOCIAL(r), COMFORT(g), WILD(b), BUILT_HEIGHT(a)
//   uF1: MOVEMENT.x(r), MOVEMENT.y(g), WALL(b), spare(a)
//   uF2: INTEREST.x(r), INTEREST.y(g), INTEREST.z(b), spare(a)
//
// Each pattern shader outputs to layout(location=0/1/2) for MRT.
// Detector shaders output single float to pattern buffer (no MRT).

'use strict';

// ── Shared vertex shader ───────────────────────────────────────────────────
const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// ── Shared stdlib (prepended to every fragment shader) ─────────────────────
const STDLIB = `#version 300 es
precision highp float;

in vec2 vUV;
uniform vec2 uResolution;         // cells
uniform sampler2D uF0;            // SOCIAL, COMFORT, WILD, BUILT_HEIGHT
uniform sampler2D uF1;            // MOVEMENT.xy, WALL, spare
uniform sampler2D uF2;            // INTEREST.xyz, spare
uniform sampler2D uEdaMask;       // R8: 1=inside EDA
uniform sampler2D uSpongeMask;    // R8: 1=inside sponge parcel
uniform sampler2D uWallDist;      // R32F: distance to nearest wall (cells)
uniform sampler2D uNodeProx;      // R32F: proximity to activity nodes [0,1]

// ── Field accessors ───────────────────────────────────────────────────────
#define SOCIAL(uv)       texture(uF0,(uv)).r
#define COMFORT(uv)      texture(uF0,(uv)).g
#define WILD(uv)         texture(uF0,(uv)).b
#define BUILT(uv)        texture(uF0,(uv)).a
#define MVMT(uv)         texture(uF1,(uv)).rg
#define WALL(uv)         texture(uF1,(uv)).b
#define INTEREST_XY(uv)  texture(uF2,(uv)).rg
#define INTEREST_Z(uv)   texture(uF2,(uv)).b
#define IN_EDA(uv)       (texture(uEdaMask,(uv)).r > 0.5)
#define IN_SPONGE(uv)    (texture(uSpongeMask,(uv)).r > 0.5)
#define WALL_DIST(uv)    texture(uWallDist,(uv)).r

// ── Primitives ────────────────────────────────────────────────────────────

// Gaussian contribution: how much influence does a source at 'src' have on 'uv'?
// r in cells, amplitude a
float gauss(vec2 uv, vec2 src, float r, float a) {
  vec2 d = (uv - src) * uResolution;
  float d2 = dot(d, d);
  return a * exp(-3.0 * d2 / (r * r));
}

// Neighbourhood sample: Gaussian kernel read of a scalar field at uv
// 'tex' must be a sampler2D, 'ch' selects channel via swizzle in caller
// Implementation: 5-tap approximation (centre + 4 neighbours at r_cells)
float nbhd(sampler2D tex, int ch, vec2 uv, float r_cells) {
  vec2 d = r_cells / uResolution;
  vec4 c  = texture(tex, uv);
  vec4 e  = texture(tex, uv + vec2(d.x, 0.0));
  vec4 w  = texture(tex, uv - vec2(d.x, 0.0));
  vec4 n  = texture(tex, uv + vec2(0.0, d.y));
  vec4 s  = texture(tex, uv - vec2(0.0, d.y));
  // Select channel
  float vc, ve, vw, vn, vs;
  if (ch==0) { vc=c.r; ve=e.r; vw=w.r; vn=n.r; vs=s.r; }
  else if (ch==1) { vc=c.g; ve=e.g; vw=w.g; vn=n.g; vs=s.g; }
  else if (ch==2) { vc=c.b; ve=e.b; vw=w.b; vn=n.b; vs=s.b; }
  else { vc=c.a; ve=e.a; vw=w.a; vn=n.a; vs=s.a; }
  return (vc * 0.4 + ve * 0.15 + vw * 0.15 + vn * 0.15 + vs * 0.15);
}

// Gradient of a scalar field channel (central differences, in UV space)
vec2 grad_f(sampler2D tex, int ch, vec2 uv) {
  vec2 d = 1.0 / uResolution;
  float right = (ch==0)?texture(tex,uv+vec2(d.x,0)).r:
                (ch==1)?texture(tex,uv+vec2(d.x,0)).g:
                (ch==2)?texture(tex,uv+vec2(d.x,0)).b:
                        texture(tex,uv+vec2(d.x,0)).a;
  float left  = (ch==0)?texture(tex,uv-vec2(d.x,0)).r:
                (ch==1)?texture(tex,uv-vec2(d.x,0)).g:
                (ch==2)?texture(tex,uv-vec2(d.x,0)).b:
                        texture(tex,uv-vec2(d.x,0)).a;
  float up    = (ch==0)?texture(tex,uv+vec2(0,d.y)).r:
                (ch==1)?texture(tex,uv+vec2(0,d.y)).g:
                (ch==2)?texture(tex,uv+vec2(0,d.y)).b:
                        texture(tex,uv+vec2(0,d.y)).a;
  float down  = (ch==0)?texture(tex,uv-vec2(0,d.y)).r:
                (ch==1)?texture(tex,uv-vec2(0,d.y)).g:
                (ch==2)?texture(tex,uv-vec2(0,d.y)).b:
                        texture(tex,uv-vec2(0,d.y)).a;
  return vec2(right-left, up-down) * 0.5 * uResolution;
}

// Divergence of MOVEMENT field
float div_movement(vec2 uv) {
  vec2 d = 1.0 / uResolution;
  float dvx = texture(uF1,uv+vec2(d.x,0)).r - texture(uF1,uv-vec2(d.x,0)).r;
  float dvy = texture(uF1,uv+vec2(0,d.y)).g - texture(uF1,uv-vec2(0,d.y)).g;
  return (dvx + dvy) * 0.5 * uResolution.x;
}

// Clamp to non-negative
float nn(float v) { return max(0.0, v); }
vec2  nn2(vec2 v) { return max(v, vec2(0.0)); }
`;

// ── Initial conditions shader ──────────────────────────────────────────────
// Writes F0/F1/F2 from site geometry uniforms.
// All geometry encoded as gaussian seeds — no named constants needed at runtime.
// uSeeds_F0: array of (ux, uy, r_cells, social, comfort, wild, built_height)
// We encode as parallel uniform arrays for simplicity.

const IC_FRAG = STDLIB + `
// Gaussian seed arrays (up to 16 seeds per field)
// Each seed: (cx, cy) in UV, r in cells, amplitude
uniform int   uNumSeeds;
uniform vec2  uSeedPos[16];
uniform float uSeedR[16];
uniform float uSeedSocial[16];
uniform float uSeedWild[16];
uniform float uSeedBuilt[16];
uniform float uSeedMvX[16];
uniform float uSeedMvY[16];
uniform float uSeedIntZ[16];
uniform float uNoiseSeed;   // randomized each run, controls spatial noise pattern

layout(location=0) out vec4 outF0;
layout(location=1) out vec4 outF1;
layout(location=2) out vec4 outF2;
layout(location=3) out float outPID;

// ── Smooth value noise helpers ─────────────────────────────────────────────
// Three independent 2D hash streams → [0,1]
float ic_hashA(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float ic_hashB(vec2 p){return fract(sin(dot(p,vec2(269.5,183.3)))*17391.3527);}
float ic_hashC(vec2 p){return fract(sin(dot(p,vec2(419.2, 93.7)))*28547.8831);}
// Smooth (smoothstep-interpolated) value noise at scale s (cells per period)
float ic_vnoiseA(vec2 uv_c,float s,float off){
  vec2 p=(uv_c+off)/s;vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(ic_hashA(i),ic_hashA(i+vec2(1,0)),u.x),mix(ic_hashA(i+vec2(0,1)),ic_hashA(i+vec2(1,1)),u.x),u.y);}
float ic_vnoiseB(vec2 uv_c,float s,float off){
  vec2 p=(uv_c+off)/s;vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(ic_hashB(i),ic_hashB(i+vec2(1,0)),u.x),mix(ic_hashB(i+vec2(0,1)),ic_hashB(i+vec2(1,1)),u.x),u.y);}
float ic_vnoiseC(vec2 uv_c,float s,float off){
  vec2 p=(uv_c+off)/s;vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(ic_hashC(i),ic_hashC(i+vec2(1,0)),u.x),mix(ic_hashC(i+vec2(0,1)),ic_hashC(i+vec2(1,1)),u.x),u.y);}

void main() {
  if (!IN_EDA(vUV)) {
    outF0 = vec4(0.0); outF1 = vec4(0.0); outF2 = vec4(0.0); outPID = 0.0;
    return;
  }

  float social=0.0, comfort=0.0, wild=0.0, built=0.0;
  float mvx=0.0, mvy=0.0;
  float ix=0.0, iy=0.0, iz=0.0;

  for (int i=0; i<uNumSeeds; i++) {
    float g = gauss(vUV, uSeedPos[i], uSeedR[i], 1.0);
    social += g * uSeedSocial[i];
    wild   += g * uSeedWild[i];
    built  += g * uSeedBuilt[i];
    mvx    += g * uSeedMvX[i];
    mvy    += g * uSeedMvY[i];
    iz     += g * uSeedIntZ[i];
  }

  // Sponge parcel always starts wild
  if (IN_SPONGE(vUV)) wild = max(wild, 0.9);

  // EDA boundary: wild pressure decays inward
  vec2 d = 1.0 / uResolution;
  float edge = 0.0;
  if (IN_EDA(vUV)) {
    float n = texture(uEdaMask, vUV+vec2(d.x,0)).r
            + texture(uEdaMask, vUV-vec2(d.x,0)).r
            + texture(uEdaMask, vUV+vec2(0,d.y)).r
            + texture(uEdaMask, vUV-vec2(0,d.y)).r;
    edge = 1.0 - n/4.0;
  }
  wild = max(wild, edge * 0.5);

  // ── Smooth fBm ICs for choice fields ──────────────────────────────────
  // Social, movement, interest_z represent affordances people would choose:
  // paths to walk, places to gather, goals to seek. They start with spatially
  // varied latent potential clamped to [0.25, 0.75] — every cell is a plausible
  // candidate; seeds and patterns differentiate from there.
  // 2-octave fBm: large blob (60 cells) + medium texture (25 cells).
  vec2 uv_cells = vUV * uResolution + uNoiseSeed;

  float fbm_social = ic_vnoiseA(uv_cells, 60.0,  0.0)*0.6 + ic_vnoiseA(uv_cells, 25.0, 137.0)*0.4;
  float fbm_mvx    = ic_vnoiseB(uv_cells, 55.0,  0.0)*0.6 + ic_vnoiseB(uv_cells, 22.0, 211.0)*0.4;
  float fbm_mvy    = ic_vnoiseC(uv_cells, 50.0,  0.0)*0.6 + ic_vnoiseC(uv_cells, 20.0, 319.0)*0.4;
  float fbm_iz     = ic_vnoiseB(uv_cells, 70.0, 500.0)*0.6 + ic_vnoiseA(uv_cells, 28.0, 430.0)*0.4;

  // Clamp to [0.25, 0.75]: latent potential, not dead zero or pre-saturated
  fbm_social = clamp(fbm_social, 0.25, 0.75);
  fbm_iz     = clamp(fbm_iz,     0.25, 0.75);

  // Movement: center at 0 for directionality (±0.2 range from noise)
  fbm_mvx = (clamp(fbm_mvx, 0.25, 0.75) - 0.5) * 0.4;
  fbm_mvy = (clamp(fbm_mvy, 0.25, 0.75) - 0.5) * 0.4;

  // Seeds ride on top: max for scalar fields, add for directional movement
  social = max(social, fbm_social);
  mvx   += fbm_mvx;
  mvy   += fbm_mvy;
  iz     = max(iz, fbm_iz);

  // Ecotone noise for wild (structural, not choice — coarser, single octave)
  float fbm_wild = ic_vnoiseA(uv_cells, 40.0, 999.0) * 0.28 * (1.0 - wild);
  wild = clamp(wild + fbm_wild, 0.0, 1.0);

  outF0 = vec4(social, comfort, clamp(wild,0.,1.), built);
  outF1 = vec4(mvx, mvy, 0.0, 0.0);
  outF2 = vec4(ix, iy, iz, 0.0);
  outPID = 0.0;
}`;

// ── Invariant constraints shader ───────────────────────────────────────────
const INVARIANT_FRAG = STDLIB + `
uniform sampler2D uPID;
uniform float uFourStoryFt;
uniform float uNodeHeightFt;

layout(location=0) out vec4 outF0;
layout(location=1) out vec4 outF1;
layout(location=2) out vec4 outF2;
layout(location=3) out float outPID;

void main() {
  vec4 f0 = texture(uF0, vUV);
  vec4 f1 = texture(uF1, vUV);
  vec4 f2 = texture(uF2, vUV);

  float in_eda    = IN_EDA(vUV)    ? 1.0 : 0.0;
  float in_sponge = IN_SPONGE(vUV) ? 1.0 : 0.0;
  float at_node   = texture(uNodeProx, vUV).r;

  // No building outside EDA, no building in sponge
  float built = f0.a * in_eda * (1.0 - in_sponge);

  // Height cap: four stories outside nodes, taller at nodes
  float max_h = mix(uFourStoryFt, uNodeHeightFt, at_node);
  built = min(built, max_h);

  // Wild suppresses social (wilderness ≠ gathering)
  float social = f0.r * (1.0 - f0.b * 0.7);

  // Comfort floor: zero everywhere (never negative)
  float comfort = max(0.0, f0.g);

  // Wild floor: non-negative
  float wild = max(0.0, f0.b);

  // Wall non-negative
  float wall = max(0.0, f1.b);

  // Interest z non-negative (height can't pull downward)
  float iz = max(0.0, f2.b);

  outF0 = vec4(social, comfort, wild, built);
  outF1 = vec4(f1.rg, wall, f1.a);
  outF2 = vec4(f2.rg, iz, f2.a);
  outPID = texture(uPID, vUV).r; // PID passthrough — invariant doesn't change it
}`;

// ── Wall-distance shader (single-pass approximation) ───────────────────────
// Computes approximate distance to nearest WALL > threshold.
// Uses a 7×7 kernel scan — exact for distances < 3.5 cells, approximate beyond.
// For larger distances, run multiple passes (caller can invoke twice).
const WALL_DIST_FRAG = STDLIB + `
uniform float uWallThreshold; // e.g. 0.2

layout(location=0) out float outDist;

void main() {
  float wall_here = WALL(vUV);
  if (wall_here >= uWallThreshold) { outDist = 0.0; return; }

  float min_dist = 999.0;
  vec2 d = 1.0 / uResolution;

  for (int dy=-3; dy<=3; dy++) {
    for (int dx=-3; dx<=3; dx++) {
      vec2 nb = vUV + vec2(float(dx)*d.x, float(dy)*d.y);
      if (WALL(nb) >= uWallThreshold) {
        float dist = length(vec2(float(dx), float(dy)));
        min_dist = min(min_dist, dist);
      }
    }
  }
  outDist = min_dist;
}`;

// ── Copy shader (copy _A → _B, used before additive modulator) ────────────
const COPY_FRAG = STDLIB + `
uniform sampler2D uPID;
layout(location=0) out vec4 outF0;
layout(location=1) out vec4 outF1;
layout(location=2) out vec4 outF2;
layout(location=3) out float outPID;
void main() {
  outF0 = texture(uF0, vUV);
  outF1 = texture(uF1, vUV);
  outF2 = texture(uF2, vUV);
  outPID = texture(uPID, vUV).r;
}`;

// ── Diffusion shader ───────────────────────────────────────────────────────
// Gaussian neighbourhood average per field channel.
// Per-channel diffusion rates:
//   social (F0.r)      : 0.35  — spreads far, creates gradient from nodes
//   comfort (F0.g)     : 0.25  — moderate
//   wild (F0.b)        : 0.30  — spreads from sponge/edge
//   built_height (F0.a): 0.05  — almost no diffusion, buildings stay local
//   movement (F1.rg)   : 0.40  — flows freely
//   wall (F1.b)        : 0.08  — stays at edges
//   interest_z (F2.b)  : 0.20  — moderate landmark spread
// Runs after invariant each pass. EDA mask enforced — no bleed outside site.
const DIFFUSE_FRAG = STDLIB + `
uniform sampler2D uPID;
uniform float uDiffSocial;   // 0–0.6, default 0.35
uniform float uDiffWild;     // 0–0.6, default 0.30
uniform float uDiffBuilt;    // 0–0.3, default 0.05
layout(location=0) out vec4 outF0;
layout(location=1) out vec4 outF1;
layout(location=2) out vec4 outF2;
layout(location=3) out float outPID;

vec4 gaussBlur4(sampler2D tex, vec2 uv, float r) {
  vec2 d = r / uResolution;
  // 5-tap cross kernel
  vec4 c = texture(tex, uv)           * 0.40;
  c += texture(tex, uv+vec2( d.x, 0)) * 0.15;
  c += texture(tex, uv-vec2( d.x, 0)) * 0.15;
  c += texture(tex, uv+vec2(0,  d.y)) * 0.15;
  c += texture(tex, uv-vec2(0,  d.y)) * 0.15;
  return c;
}

void main() {
  // Outside EDA: passthrough without diffusion
  // Using passthrough not zero-out so IC seed values survive even if
  // EDA mask binding fails (diagnostic: if fields appear outside EDA, mask is unbound)
  if (!IN_EDA(vUV)) {
    outF0 = clamp(texture(uF0, vUV), vec4(0.0), vec4(1.0));
    outF1 = texture(uF1, vUV);
    outF2 = clamp(texture(uF2, vUV), vec4(0.0), vec4(1.0));
    outPID = texture(uPID, vUV).r;
    return;
  }

  vec4 f0 = texture(uF0, vUV);
  vec4 f1 = texture(uF1, vUV);
  vec4 f2 = texture(uF2, vUV);

  vec4 b0 = gaussBlur4(uF0, vUV, 2.5);
  vec4 b1 = gaussBlur4(uF1, vUV, 2.5);
  vec4 b2 = gaussBlur4(uF2, vUV, 2.5);

  // Movement convergence (positive divergence) amplifies social
  // Where flows meet, activity concentrates
  vec2 dv = 1.0 / uResolution;
  float dvx = texture(uF1, vUV+vec2(dv.x,0)).r - texture(uF1, vUV-vec2(dv.x,0)).r;
  float dvy = texture(uF1, vUV+vec2(0,dv.y)).g - texture(uF1, vUV-vec2(0,dv.y)).g;
  float convergence = clamp(-(dvx + dvy) * 0.5, 0.0, 1.0); // inflow = negative div
  float social_boost = convergence * 0.3;

  // Blend: mix(original, blurred, rate) — keeps peaks while spreading tails
  outF0 = vec4(
    clamp(mix(f0.r, b0.r, uDiffSocial) + social_boost, 0.0, 1.0),  // social
    mix(f0.g, b0.g, 0.25),       // comfort (fixed)
    mix(f0.b, b0.b, uDiffWild),  // wild
    mix(f0.a, b0.a, uDiffBuilt)  // built_height
  );
  outF1 = vec4(
    mix(f1.r, b1.r, 0.40),  // movement x
    mix(f1.g, b1.g, 0.40),  // movement y
    mix(f1.b, b1.b, 0.08),  // wall
    f1.a
  );

  // interest_z: diffuse existing + generate from social × |movement|
  // High social and movement co-presence = emerging place of significance.
  // Capped at 1.0; decays slightly each pass so it tracks current conditions.
  float mv_mag   = length(f1.rg);
  float iz_gen   = f0.r * mv_mag * 0.6;          // social × movement → interest
  float iz_social= f0.r * f0.r   * 0.15;          // high social alone → mild interest
  float iz_new   = min(1.0, mix(f2.b, b2.b, 0.20) * 0.92 + iz_gen + iz_social);

  // interest_xy: pull toward social gradient (people orient toward activity)
  vec2 d = 1.0 / uResolution;
  float sx = texture(uF0, vUV+vec2(d.x,0)).r - texture(uF0, vUV-vec2(d.x,0)).r;
  float sy = texture(uF0, vUV+vec2(0,d.y)).r - texture(uF0, vUV-vec2(0,d.y)).r;
  vec2 social_grad = vec2(sx, sy) * 0.5 * uResolution.x;
  float grad_mag = length(social_grad);
  vec2 ixy_attract = (grad_mag > 0.001) ? normalize(social_grad) * f0.r * 0.25 : vec2(0.0);

  outF2 = vec4(
    mix(f2.r, b2.r, 0.20) + ixy_attract.x,  // interest x
    mix(f2.g, b2.g, 0.20) + ixy_attract.y,  // interest y
    iz_new,                                   // interest z — generated + diffused
    f2.a
  );
  outPID = texture(uPID, vUV).r;
}`;


// ── Gain / compression shader ──────────────────────────────────────────────
// Normalizes each field channel by a JS-computed p95 gain value, then applies
// a soft knee compressor so high outliers don't swamp the field.
// Runs after diffuse each pass. Gain uniforms are computed CPU-side from
// the prior readback — first pass uses gain=1 (no-op).
//
// Transfer function per channel:
//   normalized = raw * uGain{Ch}          (scale so p95 → 1.0)
//   compressed = atan(normalized * k) / atan(k)   (soft limiter, k=2.5)
// Result is always [0,1] with gentle rolloff above 1.0 natural.
const GAIN_FRAG = STDLIB + `
uniform sampler2D uPID;
uniform float uGainSocial;    // 1/p95_social
uniform float uGainWild;
uniform float uGainComfort;
uniform float uGainBuilt;     // 1/p95_built (or 1/96 for ft units)
uniform float uGainWall;
uniform float uGainInterestZ;
uniform float uGainMvX;
uniform float uGainMvY;

layout(location=0) out vec4 outF0;
layout(location=1) out vec4 outF1;
layout(location=2) out vec4 outF2;
layout(location=3) out float outPID;

// Soft knee: atan compressor, k controls knee tightness
// k=0 → linear clamp, k=3 → aggressive
float compress(float v, float gain, float k) {
  float n = v * gain;
  return atan(n * k) / atan(k);
}

void main() {
  vec4 f0 = texture(uF0, vUV);
  vec4 f1 = texture(uF1, vUV);
  vec4 f2 = texture(uF2, vUV);

  outF0 = vec4(
    compress(f0.r, uGainSocial,   2.5),  // social
    compress(f0.g, uGainComfort,  2.5),  // comfort
    compress(f0.b, uGainWild,     2.5),  // wild
    compress(f0.a, uGainBuilt,    1.5)   // built_height — softer knee
  );
  outF1 = vec4(
    compress(abs(f1.r), uGainMvX, 2.0) * sign(f1.r),  // movement x (preserve sign)
    compress(abs(f1.g), uGainMvY, 2.0) * sign(f1.g),  // movement y
    compress(f1.b, uGainWall,     2.5),  // wall
    f1.a
  );
  outF2 = vec4(
    f2.r,  // interest xy — small values, leave raw
    f2.g,
    compress(f2.b, uGainInterestZ, 2.5),  // interest z
    f2.a
  );
  outPID = texture(uPID, vUV).r;
}`;

// Each pattern has:
//   DETECT_P{id}: reads fields → writes float to pattern buffer
//   MODULATE_P{id}: reads fields + pattern buffer → writes delta to F0/F1/F2
//
// Modulate shaders are run with additive blending against the copied _B.
// Pattern shaders are sorted by id DESCENDING per Alexander's ordering.

// Shared pattern stdlib header (weight uniforms etc.)
const PAT_STDLIB = STDLIB + `
uniform sampler2D uPattern; // per-pattern detector buffer (R32F)
uniform sampler2D uPID;     // pattern-id tracking texture
uniform float uWeight;
uniform float uNbhdR;
uniform float uPatternId;   // id of this pattern (for PID write)

float P() { return texture(uPattern, vUV).r; }
// Sample pattern buffer with spatial kernel (inverted Gaussian accumulation)
float Pnbhd(float r) { return nbhd(uPattern, 0, vUV, r); }
`;

// ─────────────────────────────────────────────────────────────────
// P176 — Garden Wall
// Detect: wild boundary near built area → mark wall candidate
// Modulate: write WALL at ecological boundary
// ─────────────────────────────────────────────────────────────────
const DETECT_P176 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  vec2 wild_grad = grad_f(uF0, 2, vUV);
  float wild = WILD(vUV);
  float built = BUILT(vUV);
  // Edge between wild and built: high gradient, moderate wild
  float boundary = length(wild_grad) * wild * (1.0 - wild);
  float near_built = clamp(built * 0.5, 0.0, 1.0);
  outP = boundary * (0.3 + near_built * 0.7) * uWeight;
}`;

const MODULATE_P176 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  // Garden wall: low wall, some comfort (enclosure), wild holds
  dF0 = vec4(0.0, p*0.2, 0.0, 0.0);         // slight comfort
  dF1 = vec4(0.0, 0.0,   p*0.8, 0.0);       // WALL
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P174 — Trellised Walk
// Detect: movement corridor near wild edge
// Modulate: WALL (trellis posts), low BUILT_HEIGHT (trellis roof), WILD suppression along path
// ─────────────────────────────────────────────────────────────────
const DETECT_P174 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float mv = length(MVMT(vUV));
  float wild = WILD(vUV);
  float built = BUILT(vUV);
  // Trellised walk: moderate movement, near wild edge, not already built-up
  float near_edge = wild * (1.0 - wild) * 4.0; // peaks at wild=0.5
  outP = mv * near_edge * (1.0 - clamp(built * 0.3, 0.0, 1.0)) * uWeight;
}`;

const MODULATE_P174 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(0.0, p*0.5, -p*0.4, p*4.0);   // comfort, wild suppression, low built height
  dF1 = vec4(0.0, 0.0,   p*0.6,  0.0);      // WALL (posts)
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P172 — Garden Growing Wild
// Detect: wild gradient boundary (where wild encroaches on built)
// Modulate: WILD expansion, INTEREST.xy toward wild edge
// ─────────────────────────────────────────────────────────────────
const DETECT_P172 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  vec2 wg = grad_f(uF0, 2, vUV);
  float wild = WILD(vUV);
  float edge = length(wg) * wild * (1.0 - wild) * 4.0;
  outP = edge * uWeight;
}`;

const MODULATE_P172 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  float built = BUILT(vUV);
  float expansion = p * (1.0 - clamp(built*0.5, 0.0, 1.0));
  // INTEREST.xy toward wild edge direction
  vec2 wg = grad_f(uF0, 2, vUV);
  vec2 ixy = (length(wg) > 0.01) ? normalize(wg) * p * 0.4 : vec2(0.0);
  dF0 = vec4(0.0, p*0.3, expansion*0.6, 0.0);  // comfort, wild growth
  dF1 = vec4(0.0);
  dF2 = vec4(ixy, 0.0, 0.0);                    // INTEREST.xy toward wild edge
}`;

// ─────────────────────────────────────────────────────────────────
// P160 — Building Edge
// Detect: gradient of BUILT_HEIGHT (where mass meets non-mass)
// Modulate: WALL reinforcement, INTEREST.xy perpendicular to edge (people walk edges)
// ─────────────────────────────────────────────────────────────────
const DETECT_P160 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  vec2 bg = grad_f(uF0, 3, vUV); // gradient of BUILT_HEIGHT
  outP = length(bg) * uWeight;
}`;

const MODULATE_P160 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 bg = grad_f(uF0, 3, vUV);
  // Perpendicular to edge = rotated 90° = movement direction along wall
  vec2 edge_perp = (length(bg)>0.01) ? normalize(vec2(-bg.y, bg.x)) : vec2(0.0);
  dF0 = vec4(p*0.2, p*0.3, 0.0, 0.0);        // social + comfort at edges
  dF1 = vec4(edge_perp * p * 0.6, p*1.2, 0.0); // movement along edge + WALL
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P128 — Indoor Sunlight
// Detect: BUILT_HEIGHT present, INTEREST.z moderate (vertical light interest)
// Modulate: COMFORT boost inside built mass (daylit interior)
// ─────────────────────────────────────────────────────────────────
const DETECT_P128 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float built = BUILT(vUV);
  float iz = INTEREST_Z(vUV);
  outP = clamp(built/60.0, 0.0, 1.0) * (0.3 + iz * 0.7) * uWeight;
}`;

const MODULATE_P128 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(0.0, p*0.8, 0.0, 0.0); // COMFORT (indoor daylight)
  dF1 = vec4(0.0);
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P127 — Intimacy Gradient
// Detect: transition from high to low social (the threshold between public and private)
// Modulate: WALL (the threshold element — gate, hedge, setback)
//           MOVEMENT slowdown (people pause at transitions)
// ─────────────────────────────────────────────────────────────────
const DETECT_P127 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  vec2 sg = grad_f(uF0, 0, vUV); // social gradient
  float social = SOCIAL(vUV);
  // High social gradient = threshold zone
  outP = length(sg) * (0.2 + social * 0.8) * uWeight;
}`;

const MODULATE_P127 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 mv = MVMT(vUV);
  dF0 = vec4(0.0, p*0.3, 0.0, 0.0);           // comfort at threshold
  dF1 = vec4(mv*(-p*0.2), p*0.7, 0.0);         // slow movement + WALL
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P123 — Pedestrian Density
// Detect: high SOCIAL + high |MOVEMENT| = pedestrian concentration
// Modulate: amplify SOCIAL, amplify MOVEMENT magnitude, INTEREST.xy radiates outward
// ─────────────────────────────────────────────────────────────────
const DETECT_P123 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float social = SOCIAL(vUV);
  float mv = length(MVMT(vUV));
  outP = social * mv * uWeight;
}`;

const MODULATE_P123 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 mv = MVMT(vUV);
  vec2 mv_amplified = mv * (1.0 + p * 0.8);
  vec2 ixy = (length(mv)>0.01) ? normalize(mv) * p * 0.6 : vec2(0.0);
  dF0 = vec4(p*0.9, 0.0, -p*0.3, 0.0);         // SOCIAL up, WILD down
  dF1 = vec4(mv_amplified - mv, 0.0, 0.0);       // MOVEMENT delta
  dF2 = vec4(ixy, 0.0, 0.0);                     // INTEREST.xy outward
}`;

// ─────────────────────────────────────────────────────────────────
// P122 — Building Fronts
// Detect: WALL present + MOVEMENT parallel to wall = active frontage
// Modulate: SOCIAL boost (active frontage raises sociability)
//           INTEREST.xy toward the front (entrances pull people)
// ─────────────────────────────────────────────────────────────────
const DETECT_P122 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float wall = WALL(vUV);
  vec2 mv = MVMT(vUV);
  vec2 wg = grad_f(uF1, 2, vUV); // wall gradient = wall normal
  // Parallel movement: movement perpendicular to wall normal = parallel to wall
  float parallel = (length(wg)>0.01 && length(mv)>0.01)
    ? 1.0 - abs(dot(normalize(mv), normalize(wg)))
    : 0.0;
  outP = wall * parallel * uWeight;
}`;

const MODULATE_P122 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 wg = grad_f(uF1, 2, vUV);
  // INTEREST points toward the wall (pulls people to look at the front)
  vec2 ixy = (length(wg)>0.01) ? normalize(wg) * p * 0.5 : vec2(0.0);
  dF0 = vec4(p*0.7, 0.0, 0.0, 0.0);   // SOCIAL
  dF1 = vec4(0.0);
  dF2 = vec4(ixy, 0.0, 0.0);          // INTEREST toward front
}`;

// ─────────────────────────────────────────────────────────────────
// P121 — Path Shape
// Detect: MOVEMENT corridor with INTEREST.xy aligned along it (paths go somewhere)
// Modulate: reinforce MOVEMENT direction, WILD suppression along path
// ─────────────────────────────────────────────────────────────────
const DETECT_P121 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  vec2 mv = MVMT(vUV);
  vec2 ixy = INTEREST_XY(vUV);
  float alignment = (length(mv)>0.01 && length(ixy)>0.01)
    ? max(0.0, dot(normalize(mv), normalize(ixy)))
    : 0.0;
  outP = length(mv) * alignment * uWeight;
}`;

const MODULATE_P121 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 mv = MVMT(vUV);
  dF0 = vec4(0.0, 0.0, -p*0.5, 0.0);   // WILD suppression
  dF1 = vec4(mv * p * 0.5, 0.0, 0.0);  // MOVEMENT reinforcement
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P120 — Paths and Goals
// Detect: INTEREST.xy peaks (goals) + MOVEMENT toward them
// Modulate: MOVEMENT bent toward INTEREST peaks; SOCIAL at goal arrival
// ─────────────────────────────────────────────────────────────────
const DETECT_P120 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float iz = INTEREST_Z(vUV);
  vec2 ixy = INTEREST_XY(vUV);
  // Goals: high INTEREST magnitude
  outP = (length(ixy) * 0.6 + iz * 0.4) * uWeight;
}`;

const MODULATE_P120 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR * 2.0); // wide neighbourhood — paths influence large areas
  vec2 ixy = INTEREST_XY(vUV);
  // Bend MOVEMENT toward INTEREST direction
  vec2 pull = (length(ixy)>0.01) ? normalize(ixy) * p * 0.7 : vec2(0.0);
  dF0 = vec4(p*0.4, 0.0, -p*0.3, 0.0);  // SOCIAL at goals, WILD suppression
  dF1 = vec4(pull, 0.0, 0.0);            // MOVEMENT bend
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P119 — Arcades
// Detect: WALL flanking movement corridor (covered walkway condition)
// Modulate: COMFORT boost (shelter), BUILT_HEIGHT (arcade roof), SOCIAL
// ─────────────────────────────────────────────────────────────────
const DETECT_P119 = PAT_STDLIB + `
uniform float uMaxSpanCells; // max arcade width in cells
layout(location=0) out float outP;
void main() {
  vec2 mv = MVMT(vUV);
  float mv_len = length(mv);
  if (mv_len < 0.05) { outP = 0.0; return; }
  // Check for flanking walls perpendicular to movement
  vec2 perp = normalize(vec2(-mv.y, mv.x)) / uResolution;
  float wall_l = WALL(vUV + perp * uMaxSpanCells * 0.5);
  float wall_r = WALL(vUV - perp * uMaxSpanCells * 0.5);
  outP = mv_len * wall_l * wall_r * uWeight;
}`;

const MODULATE_P119 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(p*0.5, p*1.0, -p*0.3, p*8.0);  // SOCIAL, COMFORT, -WILD, arcade roof height
  dF1 = vec4(0.0);
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P116 — Cascade of Roofs
// Detect: two WALL signals within span distance (spanning condition)
// Modulate: BUILT_HEIGHT between walls, COMFORT under roof
// ─────────────────────────────────────────────────────────────────
const DETECT_P116 = PAT_STDLIB + `
uniform float uMaxSpanCells;
layout(location=0) out float outP;
void main() {
  float wild = WILD(vUV);
  float social = SOCIAL(vUV);
  float wd = WALL_DIST(vUV); // precomputed wall distance in cells
  // Good span candidate: wall distance moderate (not too close, not too far)
  // If two walls bracket this cell, wd represents distance to nearest wall
  // A span condition: wd < half_span AND there's a wall on the other side
  float half_span = uMaxSpanCells * 0.5;
  float span_quality = (wd < half_span && wd > 0.5)
    ? (1.0 - wd/half_span) * (1.0 - wild * 0.5)
    : 0.0;
  outP = span_quality * social * uWeight;
}`;

const MODULATE_P116 = PAT_STDLIB + `
uniform float uRoofHeightFt;
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  float existing_wall = WALL(vUV);
  dF0 = vec4(0.0, p*1.4, 0.0, p*uRoofHeightFt);  // COMFORT + BUILT_HEIGHT
  dF1 = vec4(0.0, 0.0, p*existing_wall*0.8, 0.0); // WALL at eave
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P115 — Courtyards Which Live
// Detect: low BUILT_HEIGHT enclosed by high BUILT_HEIGHT neighbours
//         (the figured void)
// Modulate: SOCIAL (the courtyard is gathering space), COMFORT
// ─────────────────────────────────────────────────────────────────
const DETECT_P115 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float built_here = BUILT(vUV);
  // Neighbours: average built
  float built_nb = nbhd(uF0, 3, vUV, 3.0);
  // Courtyard: low here, high around
  float convex_void = (1.0 - clamp(built_here/20.0,0.0,1.0)) * clamp(built_nb/30.0,0.0,1.0);
  float in_eda = IN_EDA(vUV) ? 1.0 : 0.0;
  outP = convex_void * in_eda * uWeight;
}`;

const MODULATE_P115 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(p*0.8, p*0.6, -p*0.4, 0.0);  // SOCIAL, COMFORT, -WILD
  dF1 = vec4(0.0);
  dF2 = vec4(0.0, 0.0, p*0.3, 0.0);       // slight INTEREST.z (courtyard as place)
}`;

// ─────────────────────────────────────────────────────────────────
// P114 — Hierarchy of Open Space
// Detect: nested open spaces — low BUILT, varying WILD levels
// Modulate: INTEREST.z at space hierarchy transitions, SOCIAL gradient
// ─────────────────────────────────────────────────────────────────
const DETECT_P114 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float wild = WILD(vUV);
  float built = BUILT(vUV);
  float wild_nb_far  = nbhd(uF0, 2, vUV, 8.0);  // far neighbourhood
  float wild_nb_near = nbhd(uF0, 2, vUV, 2.0);  // near neighbourhood
  // Hierarchy: this cell wilder than near, less wild than far
  float hierarchy = max(0.0, wild_nb_near - wild) * max(0.0, wild - wild_nb_far * 0.5);
  outP = hierarchy * (1.0 - clamp(built*0.1,0.0,1.0)) * uWeight;
}`;

const MODULATE_P114 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(p*0.3, 0.0, p*0.2, 0.0);    // SOCIAL, WILD reinforcement
  dF1 = vec4(0.0);
  dF2 = vec4(0.0, 0.0, p*0.4, 0.0);     // INTEREST.z at transitions
}`;

// ─────────────────────────────────────────────────────────────────
// P110 — Main Building
// Detect: highest SOCIAL + INTEREST.z convergence = civic anchor location
// Modulate: strong BUILT_HEIGHT, WALL, INTEREST.z amplification
// ─────────────────────────────────────────────────────────────────
const DETECT_P110 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float social = SOCIAL(vUV);
  float iz = INTEREST_Z(vUV);
  float wild = WILD(vUV);
  // Main building: where social and vertical interest peak together
  outP = social * iz * (1.0 - wild * 0.5) * uWeight;
}`;

const MODULATE_P110 = PAT_STDLIB + `
uniform float uMainBuildingHt;
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(p*1.0, p*0.5, -p*0.8, p*uMainBuildingHt);  // SOCIAL, COMFORT, -WILD, BUILT
  dF1 = vec4(0.0, 0.0, p*1.5, 0.0);                       // strong WALL
  dF2 = vec4(0.0, 0.0, p*1.2, 0.0);                       // amplify INTEREST.z
}`;

// ─────────────────────────────────────────────────────────────────
// P109 — Long Thin House
// Detect: residential zone, low MOVEMENT, elongated BUILT_HEIGHT gradient
// Modulate: WALL along long axis, BUILT_HEIGHT, COMFORT
// ─────────────────────────────────────────────────────────────────
const DETECT_P109 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float social = SOCIAL(vUV);
  float mv = length(MVMT(vUV));
  float wild = WILD(vUV);
  float built = BUILT(vUV);
  // Long thin house: moderate social (residential), calm, not yet built
  float residential = social * (1.0 - social*0.6); // peaks at ~0.4 social
  float calm = 1.0 - clamp(mv*2.0, 0.0, 1.0);
  outP = residential * calm * (1.0-wild*0.7) * (1.0-clamp(built*0.05,0.0,1.0)) * uWeight;
}`;

const MODULATE_P109 = PAT_STDLIB + `
uniform float uResidentialHt;
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 bg = grad_f(uF0, 3, vUV);
  float wall_edge = length(bg);
  dF0 = vec4(p*0.3, p*0.4, -p*0.7, p*uResidentialHt);  // SOCIAL, COMFORT, -WILD, HEIGHT
  dF1 = vec4(0.0, 0.0, wall_edge*p*1.5, 0.0);           // WALL at building edge
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P108 — Connected Buildings
// Detect: two BUILT_HEIGHT clusters within connection distance
// Modulate: WALL (connector), BUILT_HEIGHT (bridge), MOVEMENT (through-path)
// ─────────────────────────────────────────────────────────────────
const DETECT_P108 = PAT_STDLIB + `
uniform float uConnectMaxCells;
layout(location=0) out float outP;
void main() {
  float built_here = BUILT(vUV);
  if (built_here < 10.0) { outP = 0.0; return; }
  // Look for another BUILT cluster within connection distance
  float wd = WALL_DIST(vUV);
  // Connection condition: this cell is built, nearby wall, but gap exists
  float built_nb = nbhd(uF0, 3, vUV, uConnectMaxCells);
  outP = clamp(built_here/40.0,0.,1.) * clamp(built_nb/40.0,0.,1.) * uWeight;
}`;

const MODULATE_P108 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR * 0.5); // tight neighbourhood
  vec2 mv = MVMT(vUV);
  dF0 = vec4(p*0.3, p*0.4, 0.0, p*12.0);    // connector height
  dF1 = vec4(mv*p*0.4, p*0.9, 0.0);          // MOVEMENT through + WALL
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P107 — Wings of Light
// Detect: BUILT_HEIGHT with low BUILT on adjacent sides (wing tip)
// Modulate: INTEREST.z (wing tips are interesting), COMFORT (light enters)
// ─────────────────────────────────────────────────────────────────
const DETECT_P107 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float built = BUILT(vUV);
  if (built < 10.0) { outP = 0.0; return; }
  // Wing tip: built here, open on at least one side
  vec2 d = 1.0/uResolution;
  float ne = BUILT(vUV+vec2(d.x,d.y));
  float nw = BUILT(vUV+vec2(-d.x,d.y));
  float openness = 1.0 - min(ne,nw)/max(built,1.0);
  outP = clamp(built/40.0,0.,1.) * openness * uWeight;
}`;

const MODULATE_P107 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(0.0, p*0.7, 0.0, 0.0);    // COMFORT (light enters)
  dF1 = vec4(0.0);
  dF2 = vec4(0.0, 0.0, p*0.5, 0.0);   // INTEREST.z (wings are landmarks)
}`;

// ─────────────────────────────────────────────────────────────────
// P106 — Positive Outdoor Space
// Detect: low BUILT_HEIGHT enclosed by BUILT neighbours (convex void)
// Modulate: SOCIAL (the space is used), INTEREST.xy radiates inward
// ─────────────────────────────────────────────────────────────────
const DETECT_P106 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float built = BUILT(vUV);
  float built_nb = nbhd(uF0, 3, vUV, 4.0);
  // Convex outdoor: empty here, surrounded by mass
  float convex = (1.0-clamp(built/15.0,0.,1.)) * clamp(built_nb/25.0,0.,1.);
  float wild_ok = 1.0 - WILD(vUV) * 0.5; // some wild OK in positive space
  outP = convex * wild_ok * (IN_EDA(vUV) ? uWeight : 0.0);
}`;

const MODULATE_P106 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  // INTEREST.xy: inward pull (the space pulls people into it)
  vec2 bg = grad_f(uF0, 3, vUV); // toward mass
  vec2 inward = (length(bg)>0.01) ? normalize(bg) * p * 0.6 : vec2(0.0);
  dF0 = vec4(p*0.9, 0.0, 0.0, 0.0);   // SOCIAL
  dF1 = vec4(0.0);
  dF2 = vec4(inward, 0.0, 0.0);       // INTEREST.xy inward
}`;

// ─────────────────────────────────────────────────────────────────
// P105 — South Facing Outdoors
// Detect: open space on south face of BUILT_HEIGHT mass
// Modulate: COMFORT (solar gain), SOCIAL, WILD moderate
// NOTE: COMFORT is marked v2, so we write it anyway for future use.
// ─────────────────────────────────────────────────────────────────
const DETECT_P105 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float built = BUILT(vUV);
  // South face: low built here, high built to NORTH (positive y = north in our coords)
  vec2 d = 1.0/uResolution;
  float built_n = BUILT(vUV + vec2(0.0, d.y*2.0));
  float south_face = (1.0-clamp(built/10.0,0.,1.)) * clamp(built_n/20.0,0.,1.);
  outP = south_face * (IN_EDA(vUV) ? uWeight : 0.0);
}`;

const MODULATE_P105 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(p*0.5, p*0.8, p*0.2, 0.0);  // SOCIAL, COMFORT (solar), slight WILD
  dF1 = vec4(0.0);
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P104 — Site Repair
// Detect: EDA boundary cells (edge of site)
// Modulate: WALL along edge, WILD reinforcement, BUILT suppression at boundary
// ─────────────────────────────────────────────────────────────────
const DETECT_P104 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  if (!IN_EDA(vUV)) { outP = 0.0; return; }
  vec2 d = 1.0/uResolution;
  float n  = texture(uEdaMask, vUV+vec2(0,d.y)).r;
  float s  = texture(uEdaMask, vUV-vec2(0,d.y)).r;
  float e_ = texture(uEdaMask, vUV+vec2(d.x,0)).r;
  float w  = texture(uEdaMask, vUV-vec2(d.x,0)).r;
  float edge = 1.0 - (n+s+e_+w)/4.0; // 1 at boundary
  outP = edge * uWeight;
}`;

const MODULATE_P104 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR * 0.5);
  dF0 = vec4(0.0, 0.0, p*0.5, -p*10.0);  // WILD reinforcement, built suppression
  dF1 = vec4(0.0, 0.0, p*0.7, 0.0);      // WALL at edge
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P100 — Pedestrian Street
// Detect: high MOVEMENT, no vehicles (no BUILT_HEIGHT suggesting road), SOCIAL
// Modulate: amplify MOVEMENT, SOCIAL, WILD suppression, INTEREST.xy along path
// ─────────────────────────────────────────────────────────────────
const DETECT_P100 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float mv = length(MVMT(vUV));
  float social = SOCIAL(vUV);
  float built = BUILT(vUV);
  // Pedestrian: high movement, some social, low built (not inside a building)
  outP = mv * social * (1.0-clamp(built/20.0,0.,1.)) * uWeight;
}`;

const MODULATE_P100 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 mv = MVMT(vUV);
  vec2 ixy = (length(mv)>0.01) ? normalize(mv)*p*0.7 : vec2(0.0);
  dF0 = vec4(p*0.8, 0.0, -p*0.6, 0.0);   // SOCIAL, -WILD
  dF1 = vec4(mv*p*0.5, 0.0, 0.0);         // MOVEMENT amplification
  dF2 = vec4(ixy, 0.0, 0.0);             // INTEREST along path
}`;

// ─────────────────────────────────────────────────────────────────
// P95 — Building Complex
// Detect: cluster of BUILT_HEIGHT with SOCIAL centre
// Modulate: reinforce BUILT, WALL between buildings, INTEREST.z
// ─────────────────────────────────────────────────────────────────
const DETECT_P95 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float built = BUILT(vUV);
  float social = SOCIAL(vUV);
  float built_nb = nbhd(uF0, 3, vUV, 5.0);
  outP = clamp(built/30.0,0.,1.) * social * clamp(built_nb/25.0,0.,1.) * uWeight;
}`;

const MODULATE_P95 = PAT_STDLIB + `
uniform float uComplexHt;
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(p*0.4, p*0.3, -p*0.5, p*uComplexHt);
  dF1 = vec4(0.0, 0.0, p*0.8, 0.0);   // WALL between buildings
  dF2 = vec4(0.0, 0.0, p*0.6, 0.0);   // INTEREST.z
}`;

// ─────────────────────────────────────────────────────────────────
// P88 — Street Cafe
// Detect: SOCIAL peak + MOVEMENT passing by + WALL behind
// Modulate: SOCIAL amplification, COMFORT (tables, shelter), INTEREST.xy
// ─────────────────────────────────────────────────────────────────
const DETECT_P88 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float social = SOCIAL(vUV);
  float mv = length(MVMT(vUV));
  float wall = WALL(vUV);
  float built = BUILT(vUV);
  // Cafe: social, movement passing by, wall behind, not inside a building
  outP = social * mv * wall * (1.0-clamp(built/15.0,0.,1.)) * uWeight;
}`;

const MODULATE_P88 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(p*1.2, p*0.6, -p*0.3, 0.0);   // strong SOCIAL, COMFORT, -WILD
  dF1 = vec4(0.0);
  dF2 = vec4(0.0, 0.0, p*0.4, 0.0);         // INTEREST.z (cafe as landmark)
}`;

// ─────────────────────────────────────────────────────────────────
// P87 — Shops
// Detect: MOVEMENT corridor + WALL (shopfront) + SOCIAL
// Modulate: BUILT_HEIGHT (ground floor commercial), WALL, SOCIAL, INTEREST.xy
// ─────────────────────────────────────────────────────────────────
const DETECT_P87 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float mv = length(MVMT(vUV));
  float wall = WALL(vUV);
  float social = SOCIAL(vUV);
  outP = mv * (0.3 + wall*0.7) * social * uWeight;
}`;

const MODULATE_P87 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(p*0.8, 0.0, -p*0.6, p*14.0);  // SOCIAL, -WILD, ground floor BUILT
  dF1 = vec4(0.0, 0.0, p*1.0, 0.0);          // WALL (shopfront)
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P67 — Common Land
// Detect: WILD ring around sponge (accessible commons edge)
// Modulate: WILD reinforcement, SOCIAL at commons boundary, MOVEMENT toward commons
// ─────────────────────────────────────────────────────────────────
const DETECT_P67 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float wild = WILD(vUV);
  float wild_nb = nbhd(uF0, 2, vUV, 6.0);
  // Ring: moderate wild here, high wild nearby (the sponge edge)
  float ring = wild * (1.0 - wild * 0.5) * clamp(wild_nb * 1.5, 0.0, 1.0);
  outP = ring * (IN_EDA(vUV) ? uWeight : 0.0);
}`;

const MODULATE_P67 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 wg = grad_f(uF0, 2, vUV);
  // MOVEMENT: bend toward commons edge
  vec2 mv_pull = (length(wg)>0.01) ? normalize(wg) * p * 0.5 : vec2(0.0);
  dF0 = vec4(p*0.6, 0.0, p*0.5, 0.0);   // SOCIAL at commons, WILD reinforce
  dF1 = vec4(mv_pull, 0.0, 0.0);         // MOVEMENT toward commons
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P61 — Small Public Squares
// Detect: low BUILT, high SOCIAL, enclosed by WALL (small square condition)
// Modulate: SOCIAL amplification, INTEREST.z (vertical definition of the square)
// ─────────────────────────────────────────────────────────────────
const DETECT_P61 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float social = SOCIAL(vUV);
  float built = BUILT(vUV);
  float wall_nb = nbhd(uF1, 2, vUV, 3.0); // nearby wall
  outP = social * (1.0-clamp(built/10.0,0.,1.)) * clamp(wall_nb*2.0,0.,1.) * uWeight;
}`;

const MODULATE_P61 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(p*1.0, p*0.4, -p*0.3, 0.0);  // SOCIAL, COMFORT, -WILD
  dF1 = vec4(0.0);
  dF2 = vec4(0.0, 0.0, p*0.6, 0.0);        // INTEREST.z (square as place)
}`;

// ─────────────────────────────────────────────────────────────────
// P60 — Accessible Green
// Detect: moderate WILD + MOVEMENT proximity (reachable green)
// Modulate: WILD sustain, SOCIAL (parks are social), COMFORT, INTEREST.z (canopy)
// ─────────────────────────────────────────────────────────────────
const DETECT_P60 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float wild = WILD(vUV);
  float mv = length(MVMT(vUV));
  float built = BUILT(vUV);
  float accessible = mv * (1.0-clamp(mv-0.5,0.,1.)*2.0); // peaks mid-movement
  float sweet = wild * (1.0-wild*0.5);                     // peaks at wild~0.5
  outP = sweet * (0.3+accessible*0.7) * (1.0-clamp(built*0.1,0.,1.)) * uWeight;
}`;

const MODULATE_P60 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(p*0.5, p*0.4, p*0.8, 0.0);   // SOCIAL, COMFORT, WILD sustain
  dF1 = vec4(0.0);
  dF2 = vec4(0.0, 0.0, p*0.3, 0.0);        // INTEREST.z (canopy)
}`;

// ─────────────────────────────────────────────────────────────────
// P56 — Bike Paths and Racks
// Detect: MOVEMENT corridor, low BUILT, no heavy WALL (open path)
// Modulate: directional MOVEMENT, WILD suppression, INTEREST.xy along path
// ─────────────────────────────────────────────────────────────────
const DETECT_P56 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float mv = length(MVMT(vUV));
  float built = BUILT(vUV);
  float wall = WALL(vUV);
  // Bike path: movement present, minimal building/wall obstruction
  outP = mv * (1.0-clamp(built*0.1,0.,1.)) * (1.0-wall*0.5) * uWeight;
}`;

const MODULATE_P56 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 mv = MVMT(vUV);
  vec2 ixy = (length(mv)>0.01) ? normalize(mv)*p*0.5 : vec2(0.0);
  dF0 = vec4(0.0, 0.0, -p*0.4, 0.0);   // WILD suppression
  dF1 = vec4(mv*p*0.6, 0.0, 0.0);       // MOVEMENT amplification
  dF2 = vec4(ixy, 0.0, 0.0);            // INTEREST along path
}`;

// ─────────────────────────────────────────────────────────────────
// P53 — Main Gateways
// Detect: high MOVEMENT convergence + EDA edge (entry points)
// Modulate: INTEREST.z (gateway as landmark), SOCIAL boost, MOVEMENT focused inward
// ─────────────────────────────────────────────────────────────────
const DETECT_P53 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float mv = length(MVMT(vUV));
  float convergence = clamp(-div_movement(vUV), 0.0, 1.0);
  // Edge condition (boundary cells have high edge proximity)
  vec2 d = 1.0/uResolution;
  float edge = IN_EDA(vUV) ? (1.0-(
    texture(uEdaMask,vUV+vec2(d.x,0)).r+
    texture(uEdaMask,vUV-vec2(d.x,0)).r+
    texture(uEdaMask,vUV+vec2(0,d.y)).r+
    texture(uEdaMask,vUV-vec2(0,d.y)).r)/4.0) : 0.0;
  outP = mv * convergence * (0.3+edge*0.7) * uWeight;
}`;

const MODULATE_P53 = PAT_STDLIB + `
uniform float uGatewayHt;
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(p*0.8, 0.0, 0.0, 0.0);         // SOCIAL
  dF1 = vec4(0.0, 0.0, p*1.0, 0.0);          // WALL (gateway structure)
  dF2 = vec4(0.0, 0.0, p*uGatewayHt, 0.0);  // INTEREST.z (gateway as landmark)
}`;

// ─────────────────────────────────────────────────────────────────
// P51 — Green Streets
// Detect: MOVEMENT corridor with adjacent WILD (green street condition)
// Modulate: WILD along corridor, SOCIAL, MOVEMENT reinforcement
// ─────────────────────────────────────────────────────────────────
const DETECT_P51 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float mv = length(MVMT(vUV));
  float wild_nb = nbhd(uF0, 2, vUV, 2.0); // adjacent wild
  float built = BUILT(vUV);
  outP = mv * clamp(wild_nb*1.5,0.,1.) * (1.0-clamp(built*0.1,0.,1.)) * uWeight;
}`;

const MODULATE_P51 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 mv = MVMT(vUV);
  dF0 = vec4(p*0.4, 0.0, p*0.3, 0.0);  // SOCIAL, WILD sustain along street
  dF1 = vec4(mv*p*0.3, 0.0, 0.0);       // MOVEMENT
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P46 — Market of Many Shops
// Detect: dense SOCIAL + MOVEMENT convergence (market condition)
// Modulate: strong SOCIAL, BUILT_HEIGHT, WALL, INTEREST.z (market hall as landmark)
// ─────────────────────────────────────────────────────────────────
const DETECT_P46 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float social = SOCIAL(vUV);
  float social_nb = nbhd(uF0, 0, vUV, 5.0);
  float mv = length(MVMT(vUV));
  float convergence = clamp(-div_movement(vUV)*0.5, 0.0, 1.0);
  outP = social * social_nb * (mv * 0.5 + convergence * 0.5) * uWeight;
}`;

const MODULATE_P46 = PAT_STDLIB + `
uniform float uMarketHt;
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  dF0 = vec4(p*1.5, 0.0, -p*0.8, p*uMarketHt);  // strong SOCIAL, -WILD, BUILT
  dF1 = vec4(0.0, 0.0, p*1.2, 0.0);               // WALL (market structure)
  dF2 = vec4(0.0, 0.0, p*1.0, 0.0);               // INTEREST.z (market hall)
}`;

// ─────────────────────────────────────────────────────────────────
// P44 — Local Town Hall
// Detect: SOCIAL peak + MOVEMENT convergence + low WILD = civic anchor
// Modulate: INTEREST.z spike, SOCIAL amplification, WALL, BUILT_HEIGHT
// ─────────────────────────────────────────────────────────────────
const DETECT_P44 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float social = SOCIAL(vUV);
  float wild = WILD(vUV);
  float convergence = clamp(-div_movement(vUV), 0.0, 1.0);
  outP = social * convergence * (1.0-wild) * uWeight;
}`;

const MODULATE_P44 = PAT_STDLIB + `
uniform float uTownHallHt;
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR * 1.5); // wide influence
  dF0 = vec4(p*1.8, 0.0, -p*0.8, p*uTownHallHt);  // SOCIAL, -WILD, BUILT
  dF1 = vec4(0.0, 0.0, p*1.4, 0.0);                 // WALL
  dF2 = vec4(0.0, 0.0, p*2.5, 0.0);                 // strong INTEREST.z
}`;

// ─────────────────────────────────────────────────────────────────
// P40 — Old Buildings
// Detect: existing BUILT_HEIGHT seeds (from IC — HOUSING_A_530, CIVIC_700)
// Modulate: REPEL (negative BUILT) near existing structures to preserve them,
//           ATTRACT ring around them (new construction clusters adjacently)
// ─────────────────────────────────────────────────────────────────
const DETECT_P40 = PAT_STDLIB + `
uniform float uPreserveHtMarker;
layout(location=0) out float outP;
void main() {
  float built = BUILT(vUV);
  outP = clamp(built/uPreserveHtMarker - 0.8, 0.0, 0.2) * uWeight;
}`;
// Note: uPreserveHtMarker is a uniform marking IC-seeded existing buildings

const MODULATE_P40 = PAT_STDLIB + `
uniform float uPreserveHtMarker;
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR * 0.5); // tight core — repel
  float p_ring = Pnbhd(uNbhdR * 2.0) - p; // attract ring outside core
  // Repel: suppress new building at existing structure
  dF0 = vec4(0.0, 0.0, 0.0, -p*30.0 + p_ring*5.0);  // -BUILT at core, +BUILT at ring
  dF1 = vec4(0.0);
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P37 — House Cluster
// Detect: residential condition (moderate social, calm, available, not wild)
// Modulate: BUILT_HEIGHT (4-story mass), WALL at cluster edge, SOCIAL, -WILD
// ─────────────────────────────────────────────────────────────────
const DETECT_P37 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float social = SOCIAL(vUV);
  float mv = length(MVMT(vUV));
  float wild = WILD(vUV);
  float built = BUILT(vUV);
  float calm = 1.0 - clamp(mv*2.0, 0.0, 1.0);
  float residential = social * (1.0-social*0.6); // peaks ~0.4 social
  float available = (1.0-wild*0.8) * (1.0-clamp(built*0.05,0.,1.));
  outP = residential * calm * available * uWeight;
}`;

const MODULATE_P37 = PAT_STDLIB + `
uniform float uResidentialHt;
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 bg = grad_f(uF0, 3, vUV);
  float wall_edge = length(bg);
  dF0 = vec4(p*0.3, p*0.4, -p*0.7, p*uResidentialHt);
  dF1 = vec4(0.0, 0.0, wall_edge*p*2.0, 0.0);  // WALL at mass boundary
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P36 — Degrees of Publicness
// Detect: social gradient (transition from public to private)
// Modulate: WALL (threshold elements), MOVEMENT slowdown, INTEREST.xy inward
// ─────────────────────────────────────────────────────────────────
const DETECT_P36 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  vec2 sg = grad_f(uF0, 0, vUV);
  outP = length(sg) * uWeight;
}`;

const MODULATE_P36 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 sg = grad_f(uF0, 0, vUV);
  vec2 inward = (length(sg)>0.01) ? normalize(sg)*p*0.4 : vec2(0.0);
  vec2 mv = MVMT(vUV);
  dF0 = vec4(0.0, p*0.2, 0.0, 0.0);        // slight COMFORT at thresholds
  dF1 = vec4(mv*(-p*0.15), p*0.5, 0.0);    // MOVEMENT slow, WALL
  dF2 = vec4(inward, 0.0, 0.0);             // INTEREST.xy inward
}`;

// ─────────────────────────────────────────────────────────────────
// P32 — Shopping Street
// Detect: linear MOVEMENT with WALL on one side (shopfront condition)
// Modulate: BUILT_HEIGHT (above shops), WALL, SOCIAL, MOVEMENT reinforcement
// ─────────────────────────────────────────────────────────────────
const DETECT_P32 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float mv = length(MVMT(vUV));
  float wall = WALL(vUV);
  // Wall to one side: check for asymmetric wall (wall on E or W)
  vec2 d = 1.0/uResolution;
  float wall_e = WALL(vUV+vec2(d.x*2.0,0));
  float wall_w = WALL(vUV-vec2(d.x*2.0,0));
  float one_sided = max(wall_e,wall_w) * (1.0-min(wall_e,wall_w)*0.5);
  outP = mv * one_sided * uWeight;
}`;

const MODULATE_P32 = PAT_STDLIB + `
uniform float uShopHt;
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 mv = MVMT(vUV);
  dF0 = vec4(p*0.9, 0.0, -p*0.5, p*uShopHt);   // SOCIAL, -WILD, BUILT
  dF1 = vec4(mv*p*0.3, p*0.9, 0.0);              // MOVEMENT, WALL
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// P31 — Promenade
// Detect: high SOCIAL, aligned N-S movement, flanking WALL
// Modulate: MOVEMENT aligned N-S, SOCIAL, -WILD, INTEREST.xy lateral
// ─────────────────────────────────────────────────────────────────
const DETECT_P31 = PAT_STDLIB + `
uniform float uSpineHalfWidthUV;  // spine width / 2 in UV units
layout(location=0) out float outP;
void main() {
  float social = SOCIAL(vUV);
  vec2 mv = MVMT(vUV);
  float ns_align = (length(mv)>0.01) ? abs(mv.y)/length(mv) : 0.0;
  // Flanking walls
  float wall_e = WALL(vUV+vec2(uSpineHalfWidthUV,0));
  float wall_w = WALL(vUV-vec2(uSpineHalfWidthUV,0));
  float flanked = wall_e * wall_w;
  outP = social * ns_align * (0.4+flanked*0.6) * uWeight;
}`;

const MODULATE_P31 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR);
  vec2 mv = MVMT(vUV);
  vec2 new_mv = mix(mv, vec2(mv.x*0.3, length(mv)), p*0.7);
  dF0 = vec4(p*1.2, 0.0, -p*1.5, 0.0);           // SOCIAL, strong -WILD
  dF1 = vec4(new_mv-mv, 0.0, 0.0);                 // MOVEMENT aligned N-S
  dF2 = vec4(1.0,0.0,0.0,0.0) * p * 0.8;          // INTEREST.xy east pull (toward promenade)
}`;

// ─────────────────────────────────────────────────────────────────
// P30 — Activity Nodes
// Detect: SOCIAL peak + MOVEMENT convergence (the peak pedestrian spots)
// Modulate: radiate INTEREST.xy outward, amplify SOCIAL, INTEREST.z spike
// ─────────────────────────────────────────────────────────────────
const DETECT_P30 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float social = SOCIAL(vUV);
  float convergence = clamp(-div_movement(vUV)*0.3, 0.0, 1.0);
  outP = social * convergence * uWeight;
}`;

const MODULATE_P30 = PAT_STDLIB + `
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR * 2.0); // wide influence
  // INTEREST.xy: this node pulls people — radiates interest outward
  // Each node cell writes to its own INTEREST.xy
  // (neighbours accumulate this over multiple cells = radial field)
  vec2 ixy = INTEREST_XY(vUV);
  dF0 = vec4(p*1.5, 0.0, -p*0.4, 0.0);     // strong SOCIAL, -WILD
  dF1 = vec4(0.0);
  dF2 = vec4(p*0.8, p*0.8, p*0.8, 0.0);    // INTEREST in all directions (node radiates)
}`;

// ─────────────────────────────────────────────────────────────────
// P29 — Density Rings
// Detect: distance from SOCIAL centre — establishes density gradient
// Modulate: BUILT_HEIGHT gradient (taller at centre, shorter at edge),
//           MOVEMENT radial
// ─────────────────────────────────────────────────────────────────
const DETECT_P29 = PAT_STDLIB + `
layout(location=0) out float outP;
void main() {
  float social = SOCIAL(vUV);
  float social_nb = nbhd(uF0, 0, vUV, 10.0); // wide social density
  outP = social * social_nb * uWeight;
}`;

const MODULATE_P29 = PAT_STDLIB + `
uniform float uDensityHtScale; // ft per unit of combined social pressure
layout(location=0) out vec4 dF0;
layout(location=1) out vec4 dF1;
layout(location=2) out vec4 dF2;
layout(location=3) out float dPID;
void main() {
  float p = Pnbhd(uNbhdR * 3.0); // very wide
  vec2 sg = grad_f(uF0, 0, vUV);
  vec2 radial = (length(sg)>0.01) ? normalize(sg)*p*0.4 : vec2(0.0);
  dF0 = vec4(0.0, 0.0, 0.0, p*uDensityHtScale);  // BUILT_HEIGHT from density
  dF1 = vec4(radial, 0.0, 0.0);                    // radial MOVEMENT
  dF2 = vec4(0.0);
}`;

// ─────────────────────────────────────────────────────────────────
// ── Per-pass decay shader ──────────────────────────────────────────────────
// Applies exponential decay to "choice" fields before patterns fire each pass.
// Social, movement, and interest_z are affordance votes — they should reflect
// what patterns are currently saying, not an unbounded sum of history.
// Built_height, wild, comfort, wall stay untouched (absolute / structural).
//
// uDecaySocial   ~0.55 — each pass: field = prior * decay + new pattern votes
// uDecayMovement ~0.50 — movement is most reactive, short memory
// uDecayInterest ~0.60 — interest_z has slightly longer memory (place identity)
//
// Lower = more reactive to current pass (forgets history faster)
// Higher = more stable / path-dependent (0.9 = mostly prior history)
const DECAY_FRAG = STDLIB + `
uniform float uDecaySocial;    // [0,1] decay factor for social field
uniform float uDecayMovement;  // [0,1] decay factor for movement x/y
uniform float uDecayInterest;  // [0,1] decay factor for interest_z

layout(location=0) out vec4 outF0;
layout(location=1) out vec4 outF1;
layout(location=2) out vec4 outF2;
layout(location=3) out float outPID;

void main() {
  vec4 f0 = texture(uF0, vUV);
  vec4 f1 = texture(uF1, vUV);
  vec4 f2 = texture(uF2, vUV);

  // Decay choice layers; preserve structural layers (built_height, wild, comfort, wall)
  outF0 = vec4(
    f0.r * uDecaySocial,   // social — decays, patterns re-vote each pass
    f0.g,                  // comfort — structural, no decay
    f0.b,                  // wild — structural, no decay
    f0.a                   // built_height — absolute, never decays
  );
  outF1 = vec4(
    f1.r * uDecayMovement, // movement x — decays
    f1.g * uDecayMovement, // movement y — decays
    f1.b,                  // wall — structural, no decay
    f1.a
  );
  outF2 = vec4(
    f2.r,                  // interest x — leave as-is (pulled by social grad)
    f2.g,                  // interest y — leave as-is
    f2.b * uDecayInterest, // interest_z — decays, tracks current activity
    f2.a
  );
  outPID = texture(uPID, vUV).r;
}`;

// Export all shaders
// ─────────────────────────────────────────────────────────────────
const EC_GPU_SHADERS = {
  VERT, STDLIB, PAT_STDLIB,
  IC_FRAG, INVARIANT_FRAG, WALL_DIST_FRAG, COPY_FRAG, DIFFUSE_FRAG, GAIN_FRAG, DECAY_FRAG,
  // Pattern shaders keyed by id, descending order
  patterns: {
    176: { detect: DETECT_P176, modulate: MODULATE_P176, nbhdR: 3.0, uniforms: {} },
    174: { detect: DETECT_P174, modulate: MODULATE_P174, nbhdR: 4.0, uniforms: {} },
    172: { detect: DETECT_P172, modulate: MODULATE_P172, nbhdR: 5.0, uniforms: {} },
    160: { detect: DETECT_P160, modulate: MODULATE_P160, nbhdR: 4.0, uniforms: {} },
    128: { detect: DETECT_P128, modulate: MODULATE_P128, nbhdR: 3.0, uniforms: {} },
    127: { detect: DETECT_P127, modulate: MODULATE_P127, nbhdR: 4.0, uniforms: {} },
    123: { detect: DETECT_P123, modulate: MODULATE_P123, nbhdR: 5.0, uniforms: {} },
    122: { detect: DETECT_P122, modulate: MODULATE_P122, nbhdR: 4.0, uniforms: {} },
    121: { detect: DETECT_P121, modulate: MODULATE_P121, nbhdR: 4.0, uniforms: {} },
    120: { detect: DETECT_P120, modulate: MODULATE_P120, nbhdR: 8.0, uniforms: {} },
    119: { detect: DETECT_P119, modulate: MODULATE_P119, nbhdR: 4.0, uniforms: { uMaxSpanCells: 6.0 } },
    116: { detect: DETECT_P116, modulate: MODULATE_P116, nbhdR: 4.0, uniforms: { uMaxSpanCells: 6.0, uRoofHeightFt: 14.0 } },
    115: { detect: DETECT_P115, modulate: MODULATE_P115, nbhdR: 3.0, uniforms: {} },
    114: { detect: DETECT_P114, modulate: MODULATE_P114, nbhdR: 6.0, uniforms: {} },
    110: { detect: DETECT_P110, modulate: MODULATE_P110, nbhdR: 5.0, uniforms: { uMainBuildingHt: 80.0 } },
    109: { detect: DETECT_P109, modulate: MODULATE_P109, nbhdR: 4.0, uniforms: { uResidentialHt: 48.0 } },
    108: { detect: DETECT_P108, modulate: MODULATE_P108, nbhdR: 3.0, uniforms: { uConnectMaxCells: 5.0 } },
    107: { detect: DETECT_P107, modulate: MODULATE_P107, nbhdR: 3.0, uniforms: {} },
    106: { detect: DETECT_P106, modulate: MODULATE_P106, nbhdR: 4.0, uniforms: {} },
    105: { detect: DETECT_P105, modulate: MODULATE_P105, nbhdR: 4.0, uniforms: {} },
    104: { detect: DETECT_P104, modulate: MODULATE_P104, nbhdR: 2.0, uniforms: {} },
    100: { detect: DETECT_P100, modulate: MODULATE_P100, nbhdR: 5.0, uniforms: {} },
     95: { detect: DETECT_P95,  modulate: MODULATE_P95,  nbhdR: 4.0, uniforms: { uComplexHt: 60.0 } },
     88: { detect: DETECT_P88,  modulate: MODULATE_P88,  nbhdR: 3.0, uniforms: {} },
     87: { detect: DETECT_P87,  modulate: MODULATE_P87,  nbhdR: 4.0, uniforms: {} },
     67: { detect: DETECT_P67,  modulate: MODULATE_P67,  nbhdR: 5.0, uniforms: {} },
     61: { detect: DETECT_P61,  modulate: MODULATE_P61,  nbhdR: 3.0, uniforms: {} },
     60: { detect: DETECT_P60,  modulate: MODULATE_P60,  nbhdR: 5.0, uniforms: {} },
     56: { detect: DETECT_P56,  modulate: MODULATE_P56,  nbhdR: 5.0, uniforms: {} },
     53: { detect: DETECT_P53,  modulate: MODULATE_P53,  nbhdR: 4.0, uniforms: { uGatewayHt: 1.5 } },
     51: { detect: DETECT_P51,  modulate: MODULATE_P51,  nbhdR: 4.0, uniforms: {} },
     46: { detect: DETECT_P46,  modulate: MODULATE_P46,  nbhdR: 5.0, uniforms: { uMarketHt: 40.0 } },
     44: { detect: DETECT_P44,  modulate: MODULATE_P44,  nbhdR: 6.0, uniforms: { uTownHallHt: 60.0 } },
     40: { detect: DETECT_P40,  modulate: MODULATE_P40,  nbhdR: 4.0, uniforms: { uPreserveHtMarker: 100.0 } },
     37: { detect: DETECT_P37,  modulate: MODULATE_P37,  nbhdR: 5.0, uniforms: { uResidentialHt: 48.0 } },
     36: { detect: DETECT_P36,  modulate: MODULATE_P36,  nbhdR: 4.0, uniforms: {} },
     32: { detect: DETECT_P32,  modulate: MODULATE_P32,  nbhdR: 4.0, uniforms: { uShopHt: 20.0 } },
     31: { detect: DETECT_P31,  modulate: MODULATE_P31,  nbhdR: 5.0, uniforms: { uSpineHalfWidthUV: 0.025 } },
     30: { detect: DETECT_P30,  modulate: MODULATE_P30,  nbhdR: 8.0, uniforms: {} },
     29: { detect: DETECT_P29,  modulate: MODULATE_P29,  nbhdR:10.0, uniforms: { uDensityHtScale: 30.0 } },
  },
  // Canonical pattern order: descending by id (Alexander's ordering)
  PATTERN_ORDER: [
    176,174,172,160,128,127,123,122,121,120,
    119,116,115,114,110,109,108,107,106,105,
    104,100,95,88,87,67,61,60,56,53,
    51,46,44,40,37,36,32,31,30,29
  ],
};

if (typeof self   !== 'undefined') self.EC_GPU_SHADERS   = EC_GPU_SHADERS;
if (typeof module !== 'undefined') module.exports         = EC_GPU_SHADERS;
