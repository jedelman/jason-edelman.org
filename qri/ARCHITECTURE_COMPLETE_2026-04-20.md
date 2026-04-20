# QRI Architecture Complete: ARCH-1 through ARCH-10 LOCKED

**Date:** 2026-04-20  
**Status:** All core architectures defined and cross-checked  
**Next Phase:** Experimental validation (EXP-1 through EXP-5)

---

## One-Page Architecture Summary

**Device:** All-optical Fabry-Perot resonator stack for embedded token inference  
**Wavelengths:** 850nm (inference), 532nm (learning)  
**Model:** 24 layers × 512-dim embedding = 1.23M params (rank-50 factorized)  
**Throughput:** 75 M tokens/sec (13.3 ns/token)  
**Latency:** ~320 ns/inference (24 layers, optical only)  

### Core Architecture

| Component | Specification | Status |
|---|---|---|
| **Cavity** | Linear Fabry-Perot, L=20mm, R=0.9990, confocal | ARCH-2 LOCKED |
| **Medium** | PTR glass, 10×10×0.5mm, Δn ∈ [0, 5e-3] | ARCH-1 LOCKED |
| **Round trips** | T=100 (coherent regime, T << T_coh=750) | ARCH-2 LOCKED |
| **Spatial modes** | 512 TEM_mn (w₀=5.2µm, 2.5mm aperture) | ARCH-3 LOCKED |
| **Input** | VCSEL array, 512×850nm, 50µm pitch, vertical pol | ARCH-3 LOCKED |
| **Weights** | Ephemeral Δn(x,y), rank-50 U·V^T per layer | ARCH-6,7 LOCKED |
| **Training** | Coherent Hebbian (online, 532nm trigger) | ARCH-6 LOCKED |
| **Learning rate** | Δn ∝ input_field × error_field | ARCH-6 LOCKED |
| **Nonlinearity** | Kerr SPM, φ_NL=0.2rad/pass, cavity detuned δ≈π | ARCH-9 LOCKED |
| **Coupling** | All-optical (no interposer), homodyne readout | ARCH-8 LOCKED |
| **Cooling** | 10×10×0.5mm aperture, passive (260mm² surface), Peltier optional | ARCH-10 LOCKED |

### Performance Numbers

| Metric | Value | Margin |
|---|---|---|
| **SNR (target)** | 38 dB (6-bit) | Achieved: 40 dB (+2 dB) |
| **Phase SNR** | 66 dB per round trip | φ_NL=0.2rad >> σ_φ=0.0001rad |
| **Intra-cavity power** | 2-3 W (scalable to 10W) | Finesse 1000× from 2-3mW input |
| **Thermal rise** | 15K passive / <5K Peltier | Safe (<100K below 400°C stability) |
| **Coherence margin** | 7.5× (T=100 << T_coh=750) | Abundant phase stability |
| **Token rate** | 75 M/sec | 10× typical embedded inference |

---

## Physics Primitives (ARCH-1)

**Wave equation as RNN (Hughes 2019):**
```
∂²u/∂t² = (c₀/n)² ∇²u  →  u_{t+1} = 2u_t - u_{t-1} + Δt²(c₀/n)² ∇²u_t
```
Cavity round trip time = RNN time step. Refractive index Δn(x,y) = weight matrix.

**Holographic weight encoding (Psaltis 1990):**
```
Δn(x,y) = Σ_k A_k cos(k_k · r + φ_k)
```
Gratings store outer products. Angular multiplexing capacity ~1000 patterns.

**Coherent optical Hebbian (Psaltis 1990 + real-time feedback):**
```
Δn ← Δn + η · input_field × error_field  (532nm write trigger synchronized with 850nm inference)
```

---

## Risk & Validation Matrix

| Risk | Severity | Mitigation | EXP |
|---|---|---|---|
| **PTR χ³ @ 850nm unknown** | HIGH | Measure nonlinear coefficient empirically | EXP-1 |
| **Two-wavelength photosensitivity** | HIGH | Confirm PTR responds to 532nm during 850nm read | EXP-2 |
| **Hebbian convergence rate** | HIGH | Measure Δn growth vs. 532nm exposure time | EXP-3 |
| **Thermal lensing (dn/dT)** | MED | Characterize dn/dT; may require active stabilization | EXP-4 |
| **Homodyne phase lock stability** | MED | Test VCSEL frequency lock under thermal drift | EXP-5 |
| **Rank-50 model accuracy** | MED | Benchmark vs. full-rank transformer on token prediction | Algo |

---

## Key Decisions

1. **No offline training:** Weights evolve during inference. No UV exposure post-learning. Learning is real-time and continuous.
2. **All-optical inference:** No electronics between layers. Coherent field directly couples layer-to-layer.
3. **Kerr nonlinearity:** Scalable with power, less sensitive to fabrication error than bistable resonance.
4. **Single-wavelength polarization:** Vertical only, avoids mirror dichroism, keeps interposer simple. Capacity margin sufficient.
5. **Thin PTR plate (0.5mm):** Passive thermal dissipation via 260mm² surface. Peltier optional for margin.

---

## Next Steps

### Experimental (EXP-1 through EXP-5)
1. **PTR χ³ @ 850nm:** Measure SPM coefficient via nonlinear interferometry or Z-scan
2. **Two-wavelength response:** Expose PTR to 532nm while reading @ 850nm; confirm Δn change
3. **Grating growth dynamics:** Plot Δn vs. 532nm exposure time; extract learning time constant
4. **Thermal stability:** Measure dn/dT; design thermal control (active or passive)
5. **Homodyne phase lock:** Build VCSEL frequency servo; test lock-in range, drift response

### Algorithm
- Train 1.23M-param rank-50 transformer on causal LM task
- Validate 6-bit quantization + rank-50 joint impact on perplexity
- Benchmark vs. full-rank model (expect 95-98% performance)

### System Integration
- Optical bench: 24 cavities, mode-matching optics, homodyne detectors
- Control electronics: VCSEL frequency lock (PID), Peltier temperature servo, 532nm trigger timing
- Testing: End-to-end token prediction on held-out stream

---

## Locked Architectures Summary

| ARCH | Component | Status | Key Specification |
|---|---|---|---|
| 1 | Physics primitives | ✓ LOCKED | Wave eq=RNN, holographic weights, coherent Hebbian |
| 2 | Resonator geometry | ✓ LOCKED | L=20mm, R=0.9990, τ=133.3ps, T=100 |
| 3 | Mode structure | ✓ LOCKED | 512 modes @ 2.5mm, single pol, VCSEL 50µm |
| 4 | Throughput | ✓ LOCKED | 75 M tok/s (13.3 ns/token) |
| 5 | SNR budget | ✓ LOCKED | 40 dB @ 2-3mW, shot-noise-limited |
| 6 | Training | ✓ LOCKED | Coherent Hebbian, 532nm write, ephemeral weights |
| 7 | Weight capacity | ✓ LOCKED | 51.2k/layer, rank-50, 1.23M total |
| 8 | Coupling | ✓ LOCKED | All-optical, homodyne readout, no interposer |
| 9 | Nonlinearity | ✓ LOCKED | Kerr SPM, φ_NL=0.2rad/pass, δ≈π detuning |
| 10 | Thermal | ✓ LOCKED | 10×10×0.5mm, passive+Peltier, 15K rise |

---

**Ready for experimental validation phase.**
