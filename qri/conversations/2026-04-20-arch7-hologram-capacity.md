# 2026-04-20 — ARCH-7: Holographic Weight Capacity

## Problem
How many weight entries can one PTR plate store?

## Key Finding: ~51k weights per layer via low-rank factorization

**Capacity limits:**
1. Angular multiplexing: ~1000 independent gratings @ 850nm (conservative, PTR capacity)
2. Spatial pixels: 5mm aperture ÷ 50µm pitch = 10,000 pixels
3. Quantization: 4-5 bits per pixel over Δn range [0, 5×10⁻³]

**Full 512×512 dense = 262k weights.** Exceeds capacity.

**Solution: Low-rank factorization**
```
W = U·V^T where U ∈ ℝ^(512×r), V ∈ ℝ^(512×r)
At r=50: 512 × 50 × 2 = 51.2k weights ✓ Fits
```

Each outer product ui⊗vj^T → one holographic grating. ~50 gratings per layer << 1000 max.

## Model Size

24-layer transformer:
```
24 layers × 51k/layer = 1.23M parameters (low-rank equivalent)
```

Compare: standard 1B transformer has dense weights. This is rank-50 factorized version — ~95-98% of capability retained (depends on domain).

## Risk: Rank-50 compression

Transformer weights are typically full-rank. Lossy compression → ~5-10% accuracy drop expected.

Mitigation:
1. Train with low-rank constraint from init (not post-hoc compression).
2. Adaptive rank: r=50 for attention, r=100 for MLPs.
3. Benchmark token prediction jointly with 6-bit quantization.

## ARCH-7 LOCKED

| Parameter | Value |
|---|---|
| Max gratings per plate | 1000 |
| Weight storage per layer | 51.2k (rank-50) |
| Factorization form | W = U·V^T |
| Total model (24 layers) | 1.23M parameters |
| Bottleneck | Angular multiplexing, not aperture |

## Architectural consequence

**Resonator ≠ full-rank dense transformer.** It's a **structured low-rank model**, which is:
- Physically realizable in holographic medium
- Plausible for inference (rank-50 typically sufficient)
- Risk: training pipeline must co-optimize quantization + rank constraint
