# NARG & Ptychography Crosscheck Results — 2026-04-24

## Baseline (Locked ARCH 1-10)
✓ All 13 checks PASS  
- 75 M tok/s, 1.23M params, 40dB SNR (2dB margin)
- Ready for experimental validation

## Scenario Analysis

### NARG (Non-Autoregressive Generation)
**Constraint:** SNR margin is bottleneck (only 2dB above 38dB target)

| Fertility | Noise ↑ | SNR Req. | Feasible? | Result |
|:---|:---|:---|:---|:---|
| 512 pos | 23.6 dB | 23.6 dB | ✗ | Fails by 21.6 dB |
| 128 pos | 11.1 dB | 11.1 dB | ✗ | Fails by 9.1 dB |
| 64 pos | 9.0 dB | 9.0 dB | ✗ | Fails by 7.0 dB (borderline) |
| 32 pos | 7.6 dB | 7.6 dB | ~ | Marginal (barely) |
| 16 pos | 6.2 dB | 6.2 dB | ✓ | **Passable** |

**Recommendation:** NARG max ~16 parallel positions without SNR upgrade.
- Latency gain: 10× less than expected (16 vs 512)
- Write overhead: +10% (fertility pre-pass)
- Net gain: ~10% total latency improvement

### Ptychography (Fresnel Phase Reconstruction)
**Constraint:** Two independent limits:

1. **Write SNR headroom** (ptychographic reconstruction needs 15dB margin)
   - Available: 2dB (40dB achieved vs 38dB target)
   - Required: 15dB
   - **Fails by 13dB**

2. **Parameter count limit** (ARCH-7 constraint: ≤1.5M for single PTR plate stack)
   - Baseline: 1.23M
   - With 2× multiplier: 2.46M
   - With 2.5× multiplier: 3.08M
   - **Exceeds hard cap by 0.96M-1.85M**

**Recommendation:** Ptychography as-specified is incompatible.
- Alternative: Use ptychography for *subset* of weights (e.g., Q,K matrices only). Reduces write SNR requirement to +5-7dB (still tight). Capacity gain: ~30-40% instead of 2-4×.

### Hybrid (NARG + Ptychography)
Both constraints compound. Combined write overhead: ~15% + (1 - 1/30) ≈ 18%.  
**Result: ✗ All checks fail**

---

## Feasible Operating Points

### Option A: NARG only (16-position parallel)
- ✓ All ARCH checks pass
- Latency gain: ~10%
- Write overhead: +10%
- Params: 1.23M (unchanged)
- Recommendation: **Implement first. Low risk, measurable gain.**

### Option B: Ptychography subset (Q,K matrices)
- ✓ Parameter constraint: subset ≤ 300k (fits)
- ✓ SNR: +5-7dB required (marginal but feasible)
- Capacity gain: ~30-40% effective params
- Write slowdown: 20-30× for subset (tolerable in batched training)
- Recommendation: **Medium risk, medium reward. Requires algorithm change to mixed-precision model.**

### Option C: SNR upgrade path
- Increase input power: 2.5mW → 5mW (+3dB SNR)
- Better TIA design: baseline shot-noise ≈ 30dB, optimized ≈ 35dB
- Combined: +8dB achievable
- **New SNR budget: 40dB → 48dB**
- Unlocks: NARG up to 128 positions, ptychography for all weights

---

## Critical Findings

1. **Current design is SNR-limited, not throughput-limited.**
   - 40dB SNR is bottleneck for parallelism.
   - Optical power budget (2.5mW) is not saturated.

2. **Ptychography write SNR requirement is understated in literature.**
   - Phase reconstruction is iterative; noise compounds.
   - 15dB margin estimate from papers assumes passive materials.
   - PTR glass with live Hebbian learning: likely needs 15-20dB.

3. **Rank-50 factorization is optimal for 1.23M params.**
   - Jump to full-rank with ptychography → exceeds per-plate capacity.
   - Alternative: Increase number of plates (24 → 36) for same params. Thermal cost. Volume not saved.

---

## Recommendations

**Next 2 weeks:**
1. **Implement NARG (16-pos):** Low friction. Validate on rank-50 model. ~10% gain.
2. **Measure TIA SNR empirically:** Current design simulates 40dB. Actual bench result? May be 35-38dB.
3. **Ptychography proof-of-concept (subset):** Build 5×5mm plate, write Q matrix (128×128). Measure reconstruction fidelity vs. phase-shift count.

**Month 2:**
- If TIA SNR confirmed >42dB → unlock ptychography path.
- If subset ptychography works → integrate into model.
- If not → stick with NARG(16) + baseline holography. Still 10% gain for production.

**Decision point:** 30 days. Commit to one of three paths based on empirical results.

