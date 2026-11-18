# NARG & Ptychography Impact Analysis — 2026-04-24

## Task 1: Non-Autoregressive Generation (NARG) on Throughput

**Current baseline:** 75 M tok/s, 13.3 ns/token, T=100 round trips

### NARG Operating Principle
Emit all N output positions in parallel via independent spatial channels (not sequentially). Each position decoded in one resonator R/T.

### Throughput Impact

| Metric | Change | Gain |
|:---|:---|:---|
| **Per-sequence latency** | T×τ (unchanged) | Latency → T×τ / seq_len |
| **Output parallelism** | 512 spatial modes simultaneously | Up to 512× latency reduction per position |
| **Fertility prediction overhead** | +1 pre-pass | ~5-10% overhead |
| **System throughput** | Bounded by mode capacity | Effective: 2-3 orders for seq_len < 512 |
| **SNR during parallel decode** | √512 × 23 noisier | Current 40dB margin absorbs |

### Key Compatibility Notes
- Ephemeral weight scheme naturally supports multi-target Hebbian updates
- No retraining required; add fertility + consistency loss
- Implementation: 1-2 parameter overhead, ~15% net latency speedup in practice

### Recommendation
**Architecture-compatible. Implement & validate on rank-50 model.**

---

## Task 2: Fresnel Ptychography on Dimensions & Scale Factors

**Current:** 10×10×0.5mm PTR plates, ~1000 angular-multiplexed patterns, 1.23M param model

### Ptychography Capability
Subwavelength phase reconstruction (no reference arm needed). Enables 2-4× denser holographic gratings.

### Scale Impact

| Property | Baseline | With Ptychography | ΔEffect |
|:---|:---|:---|:---|
| **Grating resolution** | f_max = 0.85 mm⁻¹ | f_max = 1.7-2.0 mm⁻¹ | **2× finer** |
| **Feature size** | ~1.2 μm | ~0.6 μm (subwavelength) | **2× density** |
| **Capacity per plate** | 1000 patterns | 2000-4000 patterns | **2-4× more** |
| **Plate size for same capacity** | 10×10mm | **5×5mm** | **4× volume** |
| **Model params/layer** | 51.2k | 102-204k | **2-4M total** |
| **Physical footprint** | 24 stacks @ 10×10mm | **24 stacks @ 5×5mm** | **Proportional saving** |

### Trade-offs (Critical)

**Ptychographic write cost:**
- 20-50 phase-shifting exposures per hologram → 20-50× slower learning
- Requires 10-20dB SNR headroom on 532nm write path
- Iterative reconstruction → weight artifacts if noise high

**Not free:** Exchanging write speed for read density.

### Scale Factor Changes
- **Model capacity:** 1.23M → 4-5M params (rank-100 or full-rank viable)
- **Latency:** T=100 → possibly T=150 (heavier weights need longer equilibration)
- **SNR budget:** +10-20dB write, +3-5dB read required
- **Thermal:** Smaller plate → **better passive cooling** (4× better A/V ratio)

### Implementation Paths

1. **Full ptychography:** Commit to slow write, gain 4× space + 3-4M params
2. **Standard holography:** Keep current speed, stick with 1.23M model (already efficient)
3. **Hybrid (recommended):** Learn online with standard holography, compress to ptychographic write at epoch end. 1-2 month payback for 4× space.

### Recommendation
**Ptychography is size/capacity trade, not free energy.** Evaluate based on form-factor constraints vs. real-time learning rate priorities.

---

## Cross-Validation

Run `analyze/arch_crosscheck.py` with:
```
NARG_fertility_dim = 512
ptych_capacity_multiplier = 2.5
narg_write_overhead = 0.15
ptych_write_slowdown = 30  # midpoint of 20-50
```

Expected: NARG latency gain absorbed by fertility pre-pass. Ptychography trades write speed for capacity & form factor.

---

## Action Items

1. **NARG validation:** Add fertility head to rank-50 model. Train + benchmark perplexity vs. baseline.
2. **Ptychography proof-of-concept:** Build 5×5mm PTR test plate. Measure:
   - Reconstruction phase error vs. exposure count
   - Saturation point (when artifacts dominate)
   - SNR requirement for 532nm stability
3. **System trade-off decision:** Based on (1) and (2), commit to one path or hybrid.

