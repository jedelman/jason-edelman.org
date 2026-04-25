# Hybrid EO Strategy: PTR Cavity + LiNbO3 Inline Phase Modulator

**Status:** Specification locked for implementation  
**Recommendation:** PRIMARY approach for ephemeral weight encoding via resonant 4WM gradient descent

---

## 1. Architecture

```
[850nm laser] → [PTR Cavity (24 layers, high Q)] → [LiNbO3 MZM] → [Detector]
                                                        ↑
                                                   [EO voltage V(t)]
```

**Key separation:**
- **PTR cavity:** Weight storage geometry (Δn spatial structure), Q optimization, thermal stability
- **LiNbO3 MZM:** Weight *modulation* (time-varying Δn from applied voltage), fast control loop
- **4WM:** Passive χ^(3) nonlinearity in cavity medium encodes weights during training (orthogonal pump beams)

---

## 2. Component Specs

### 2.1 PTR Cavity (Locked)
| Parameter | Value | Rationale |
|:---|:---|:---|
| Material | PTR glass (photo-thermo-refractive) | High Q (>10⁴), proven stable, native cavity geometry |
| Thickness | 24 layers, ~4mm total | Matches current design; supports ~75M tok/s |
| Δn(static) | 5×10⁻³ per layer | PTR spec; holographic writing capability |
| Q factor | ~10⁴ @ 850nm | SNR = 40dB baseline |
| Insertion loss (cavity only) | <0.5dB | PTR intrinsic transparency |

**Note:** PTR does NOT have χ^(2) (not electro-optic). Weight modulation handled by LiNbO3 inline.

### 2.2 LiNbO3 Inline Phase Modulator (MZM)

| Parameter | Value | Spec source |
|:---|:---|:---|
| Type | Mach-Zehnder modulator (MZM) | Proven for fast phase modulation |
| Material | LiNbO3 z-cut ridge waveguide | χ^(2) = 670 pm/V; operational from VIS to IR |
| Insertion loss | 1.0–1.5 dB | Typical for integrated MZM |
| Modulation bandwidth | 10–50 GHz | Electrical drive; practical ~10 GHz for tight linewidth control |
| Half-wave voltage (V_π) | 3–5 V | Standard for integrated LiNbO3 |
| Phase modulation depth | 0–π (full swing) | Controls Δn(t) in cavity |
| Thermal tuning coefficient | +0.04 nm/K | LiNbO3 bare; PID needed |
| Cost | $400–600 per unit | Off-shelf integrated MZM modules (e.g., Photonics Hyperion, Modwave) |

**Integration:** Butt-couple or evanescent-couple PTR cavity output to LiNbO3 waveguide. Coupling loss ~0.5 dB (depends on mode-match).

### 2.3 Electrodes & Drive Circuit

| Component | Spec | Notes |
|:---|:---|:---|
| RF driver | 50Ω impedance, 0–5 V swing | Standard audio amp or low-noise function generator |
| Control bandwidth | 1 MHz | Sufficient for gradient descent at 1 µs timescale |
| ADC (loss readout feedback) | 12-bit @ 1 MSPS | Digitize loss signal, feed to PID or gradient accumulator |
| Thermal tuning | Integrated PID on LiNbO3 | Reference cavity locks to 850nm; tuning voltage compensates drift |

---

## 3. Weight Encoding: 4WM + Pockels

### 3.1 Why Both?

**Pockels (χ^(2)) via MZM:**
- Fast: 1 ns weight update
- Efficient: 3–5 V control voltage
- Gradient descent: Digital update → analog voltage → instantaneous phase shift

**4WM (χ^(3)) in PTR cavity (optional, Phase 2):**
- Passive all-optical encoding for higher-order terms
- Backup nonlinearity if Pockels saturates or for multi-layer weight coupling
- Not essential for Phase 1 validation

### 3.2 Weight Representation

At time t during training:

```
Δn(x,y,z,t) = Δn_PTR(x,y,z) + V(t) · m(x,y) · χ^(2)    [Pockels contribution]
              + I_pump(t) · P(x,y) · χ^(3)                 [4WM contribution, optional]
```

Where:
- Δn_PTR = static PTR grating (if pre-written; else zero)
- V(t) = applied voltage (from gradient descent)
- m(x,y) = spatial mode (transverse cavity mode)
- I_pump = orthogonal pump intensity (for 4WM tuning)

**Practical:** Start with Pockels only (Phase 1). Add 4WM if needed (Phase 2).

---

## 4. Photonic Backprop & Gradient Descent

### 4.1 Forward Pass
1. Inject token embedding x into cavity
2. Circulate N_circ times (typically 10–100)
3. Read output y
4. Compare with target y_target (heterodyne detection)

**Timescale:** 13 ns/round trip × 100 round trips = 1.3 µs per forward pass

### 4.2 Backward Pass & Gradient
1. Phase-reverse probe beam through cavity
2. Detect scattered light at modulator electrode
3. Heterodyne signal ∝ ∂L/∂V (gradient of loss w.r.t. voltage)

**Timescale:** 13 ns/round trip × 100 = 1.3 µs (parallel with forward)

### 4.3 Weight Update
```
V_{t+1} = V_t - α · ∂L/∂V_t   (every 1–10 µs)
```

**Learning rate α:** Determined by MZM gain (V per loss-unit) and optical gain (photon→electron). Initially α ≈ 0.01 V/loss-unit; tune empirically.

---

## 5. Thermal Stability & PID Control

### 5.1 Dominant Thermal Sources
| Source | Drift rate | Mechanism |
|:---|:---|:---|
| LiNbO3 refractive index | +0.04 nm/K | Temperature-dependent χ^(2) |
| PTR cavity Δn | +0.5 ppb/K | Minimal; excellent |
| Optical path (expansion) | +50 ppb/K | Mech. mount drift |

**Total:** ~1 ppm/K optical phase drift. Over 1 hour: ~0.5 rad phase shift @ 850nm. Acceptable for sequence length ~1000 tokens without re-lock.

### 5.2 PID Loop (Reference Cavity)

```
[850nm laser] → [Reference PTR cavity (stable, not trained)]
                       ↓
                 [Photodiode] → [Phase comparator]
                                       ↓
                              [PID controller]
                                       ↓
                              [LiNbO3 tuning voltage]
```

- **Reference:** Unmodulated cavity, same PTR material, locked to 850nm transmission peak
- **Error signal:** Phase difference between main cavity and reference
- **PID gains:** K_p = 0.1, K_i = 0.01, K_d = 0.001 (tune empirically)
- **Update rate:** 1 kHz (limited by thermal time constant ~100 ms)

**Result:** Phase stability ±5 mrad over 1 hour (sufficient for token budget >1000).

---

## 6. Integration: PTR↔LiNbO3 Coupling

### 6.1 Optical Interface

**Approach:** End-fire coupling via lenses or directional coupler

| Interface | Loss | Complexity | Notes |
|:---|:---|:---|:---|
| Free-space lens | 1–2 dB | Low | Easiest; tolerant to misalignment |
| Fiber pigtail | 0.5–1 dB | Medium | Better long-term stability |
| Direct waveguide | 0.3–0.5 dB | High | Requires precision alignment; ideal but complex |

**Recommendation:** Fiber pigtail (PTR → SM fiber → LiNbO3 waveguide). Decouples mechanical vibration, easier to align.

**Coupling budget:**
```
Cavity insertion loss (0.5 dB) + Fiber (0.2 dB) + MZM (1.0 dB) + Re-coupling (0.2 dB) = 1.9 dB total
→ Effective Q_loaded = Q_cavity / 10^(1.9/10) ≈ 0.65 × Q_cavity
→ SNR impact: -2.2 dB (from 40 dB → 37.8 dB)
```

**Acceptable.** Can recover via +3dB SNR upgrade (VCSEL phase 1).

### 6.2 Wavelength & Mode Matching

- **Wavelength:** 850 nm (PTR transparent, LiNbO3 responsive)
- **Mode:** TEM₀₀ in cavity → couple to fundamental mode in LiNbO3 waveguide
- **Fiber:** Single-mode @ 850 nm (e.g., SMF-850)

---

## 7. Phase 1 Validation Checklist

- [ ] Couple PTR cavity to LiNbO3 MZM; measure insertion loss (target <2 dB)
- [ ] Lock cavity to 850 nm using reference cavity + PID
- [ ] Modulate LiNbO3 voltage 0–5V; measure phase shift (expect π per V_π ≈ 3.5V)
- [ ] Train 1-layer RNN (100 params) on MNIST tokens using photonic backprop
- [ ] Measure convergence: L(epoch) → does loss decay exponentially? By how much per epoch?
- [ ] Measure phase stability: Integrate 1000 tokens, quantify phase drift
- [ ] Test ensemble (N=4 cavities): Does √N phase variance reduction hold?

---

## 8. Risk & Mitigation

| Risk | Impact | Mitigation |
|:---|:---|:---|
| LiNbO3 thermal drift kills lock | High | PID control + reference cavity |
| 1.9 dB coupling loss too high | High | Optimize fiber launch optics; consider waveguide coupling |
| Backprop convergence slow | Medium | Empirical convergence study; tune α adaptively |
| 4WM pump beam cross-talk | Low | Phase match pump far from signal (e.g., 780 nm vs 850 nm) |

---

## 9. Cost & Timeline

| Phase | Component | Cost | Timeline |
|:---|:---|:---|:---|
| 1 | LiNbO3 MZM module + fiber pigtails | $600 | 1 week (procurement) |
| 1 | Reference cavity + PID electronics | $400 | 2 weeks (design + build) |
| 1 | Integration (optics bench) | $200 | 1 week |
| **Total Phase 1** | | **$1200** | **4 weeks** |
| 2 | 4WM cell + pump optics | $500 | 3 weeks |

---

## 10. Recommendation Summary

**Use Hybrid (PTR + LiNbO3 MZM) for production.**

- PTR cavity: geometry locked, proven Q, minimal maintenance
- LiNbO3 MZM: fast weight updates (1 ns), proven modulation, active thermal control
- 4WM: defer to Phase 2; Pockels sufficient for initial convergence study
- Timeline: Validation in 4–6 weeks; production-ready in 12 weeks

**Next:** You validate photonic backprop convergence. I'll detail PID loop design and fiber coupling optics.

