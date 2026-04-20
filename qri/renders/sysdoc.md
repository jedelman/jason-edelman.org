# Quantum Resonator Inference — System Documentation

*Generated: 2026-04-20*

---

## Architecture

# Quantum Resonator Inference — Architecture Specification

**Status:** ARCH-1 DERIVED — 2026-04-19
**Project:** All-optical resonator for embedded token inference
**Constraint:** Single-tenant embedded device. No context switching. No multi-tenancy. One model, static weights.

---

## 1. Problem Statement

Standard LLM inference is memory-bandwidth-bound and thermodynamically inefficient. Every token requires moving billions of weight parameters through digital electronics at ~pJ/MAC. We are deriving an alternative: a coherent all-optical resonator that encodes model weights in the refractive index distribution of a physical medium and executes inference via photon-weight interactions at the speed of light.

The key question is not "how do we map a digital architecture to optics?" but "what computation does physics perform naturally, and can that computation be trained to implement token inference?"

The answer, derived below, is: **yes, and the natural primitive is a holographic resonator.**

---

## 2. Design Principles

1. **First-principles only.** Every architectural decision must be justified by physics, not by analogy to digital systems.
2. **Coherence as a resource.** The design exploits optical coherence (phase, amplitude, spatial mode structure) as a computational degree of freedom.
3. **Learning is structural.** Model weights are encoded in the refractive index distribution Δn(x,y,z) of the resonator medium. Writing weights = writing holograms.
4. **Token inference is wave dynamics.** Each forward pass is the time evolution of a wave field through a trained inhomogeneous medium. No digital approximation.
5. **Embedded, single-tenant.** One model loaded once. No scheduling, no reloading, no context switching. Simplifies drastically vs. Glass Brain vault architecture.
6. **No undocumented parameters.** All values in parameters.toml require rationale.

---

## 3. Theoretical Foundation (ARCH-1: Optical Primitive Derivation)

### 3.1 Wave Equation as RNN (Hughes et al. 2019)

The scalar wave equation for an optical field u(x,y,t) in a medium with refractive index distribution n(x,y):

```
∂²u/∂t² = (c₀/n(x,y))² · ∇²u + f(x,y,t)
```

where c₀ is the vacuum speed of light, n(x,y) is the trained refractive index, and f is the input source term.

Finite-difference discretization with time step Δt yields:

```
u_{t+1} = 2u_t - u_{t-1} + Δt²(c₀/n)²∇²u_t + Δt²f_t       (eq. 1)
```

Define the hidden state as the concatenation of field states at consecutive time steps:

```
h_t = [u_t, u_{t-1}]^T
```

Then eq. 1 is structurally identical to an RNN update (Hughes et al. 2019, eq. 5):

```
h_t = A(n) · h_{t-1} + P^(i) · x_t                            (eq. 2)
y_t = |P^(o) · h_t|²                                          (eq. 3)
```

where:
- A(n) is a sparse matrix determined by the refractive index distribution n(x,y) — the Laplacian with spatially varying wave speed
- P^(i) is the input coupling matrix (location and mode of injection)
- P^(o) is the readout matrix (detector location)
- y_t is the detected intensity (quadratic nonlinearity — physically natural)
- **The trainable parameter is n(x,y), not A directly.** Training = designing the refractive index distribution.

**Conclusion (ARCH-1):** Any optical cavity with a spatially structured medium IS an RNN. The refractive index distribution is the weight matrix. Round-trip time = one RNN time step. This is not an approximation — it is an exact mapping at the level of Maxwell's equations discretized in time.

### 3.2 Holographic Weight Storage (Psaltis et al. 1990)

A holographic grating in a photosensitive medium stores a weight matrix as a spatial modulation of the refractive index:

```
Δn(x,y) = Δn_max · Σ_k A_k · cos(k_k · r + φ_k)              (eq. 4)
```

where each term (amplitude A_k, grating vector k_k, phase φ_k) encodes one outer product pattern. Angular multiplexing stores multiple patterns.

For PTR glass (our chosen material):
- Δn_max = 5×10⁻³ (measured, cite: Glebov 2010)
- Thermally fixed — non-volatile after development
- Write with 325/355nm UV, read with 850nm (transparent throughout)

**Conclusion:** n(x,y) for our resonator = PTR glass Δn(x,y). Writing the hologram = training the RNN weights. The trained weight matrix is encoded in the glass permanently.

### 3.3 From Scalar Wave to Token Embedding (Extension of Hughes 2019)

Hughes 2019 treats a scalar input (one audio waveform = one channel). Token inference requires:
- Input: a vector x ∈ ℝ^d (the token embedding, d = embedding dimension)
- Output: a vector y ∈ ℝ^d (the next hidden state or logit vector)

Extension: excite the resonator with d simultaneous spatial modes, each amplitude-modulated by one component of the input token vector x_i.

Let the resonator support N transverse modes {ψ_1, ψ_2, ..., ψ_N} where N ≥ d. The input coupling is:

```
f(x,y,t) = Σ_{i=1}^{d} x_i · ψ_i(x,y) · δ(t)               (eq. 5)
```

where x_i is the i-th token embedding component and ψ_i is the i-th spatial mode of the input coupler.

The resonator evolves this multi-mode excitation through its trained Δn(x,y). After T round trips, the output field is read by d output detectors:

```
y_j = |∫ ψ_j*(x,y) · u_T(x,y) dx dy|²                       (eq. 6)
```

The map x → y is a learned nonlinear transformation, trainable by optimizing Δn(x,y) via the adjoint method / backpropagation through the wave dynamics.

**This is a single-layer resonator inference step.** Stacking multiple resonators (each with its own Δn) = stacking transformer layers.

---

## 4. Architecture

### 4.1 System Overview

```
Token embedding x ∈ ℝ^d
        ↓
   [Input coupler]
   Spatial light modulator or
   fiber array encoding x_i → mode ψ_i
        ↓
   [Resonator cavity]
   PTR glass holographic medium
   Δn(x,y) = trained weight distribution
   Round-trip length L, FSR = c/2L
        ↓
   [Optoelectronic interposer]
   Detection: y_j = |∫ ψ_j* u_T dx dy|²  (intensity readout)
   Nonlinearity: GeLU or ReLU via threshold circuit
   Re-injection: VCSEL array re-emits activated values
        ↓
   Next resonator (next layer)
        ↓
   ...
        ↓
   [Output readout]
   d-dimensional intensity vector → logits
```

### 4.2 Resonator Geometry

**Geometry: Linear Fabry-Perot cavity with PTR glass insert**

Rationale:
- Fabry-Perot: simplest geometry, well-characterized modes (Hermite-Gaussian TEM_mn), alignment straightforward
- Linear (not ring): folds path optically, reduces footprint; retroreflection naturally implements the t → t-1 term in eq. 1
- PTR glass insert: fills the flat-flat cavity region, Δn(x,y) sets A(n) in eq. 2
- Alternative (ring): rejected — ring resonators have traveling-wave modes, not standing-wave; the hidden state update structure of eq. 2 is cleaner for Fabry-Perot
- Alternative (bowtie): rejected — adds complexity without clear benefit at this stage

**Round-trip count T:** The number of round trips before readout = depth of the effective RNN. More round trips = more computation, but also more round-trip loss. T is a design parameter to be derived from loss budget vs. computational depth needed.

**Cavity design parameters (TBD, pending ARCH-2):**
- Length L: TBD — sets FSR and mode spacing
- Mirror reflectivity R: TBD — sets round-trip loss budget
- Mode count N: must satisfy N ≥ d (embedding dimension)
- Round trips T: TBD — sets effective RNN depth per layer

### 4.3 Input Encoding

**Token embedding → optical field**

Each token x ∈ ℝ^d is encoded as a spatial amplitude distribution at the input mirror:

```
E_in(x,y) = Σ_{i=1}^d x_i · ψ_i(x,y)
```

Implementation options (ranked by maturity):
1. **Spatial light modulator (SLM)** — most flexible, but slow (~kHz). Acceptable for embedded inference at moderate token rates.
2. **Fiber array + VCSEL array** — same architecture as Glass Brain interposer. 850nm VCSELs, each amplitude-modulated. Suitable for d ≤ 1024 at 10+ GHz per channel.
3. **Photonic lantern array** — mode conversion from fiber to free-space. Used in Glass Brain for LAM.

**Preferred for embedded device:** VCSEL fiber array (option 2). Leverages Glass Brain validated design. d = 512 embedding dimension, 512 VCSELs, 850nm, direct-modulated at token rate.

### 4.4 Holographic Weight Medium

**Material: PTR glass**

Properties from properties.toml (all cited):
- η_max = 99% diffraction efficiency (Glebov 2010)
- Δn_max = 5×10⁻³
- Thermally fixed: stable to 400°C, non-volatile
- Write: 325nm or 355nm UV, develop by thermal anneal
- Read: 850nm (fully transparent, no UV sensitivity at this wavelength)

The trained weight distribution Δn(x,y) is written into the PTR glass by exposing it to a UV interference pattern computed offline by backpropagation through the wave equation model (adjoint method, Hughes 2019 Section S1).

**Weight update:** offline, requires replacement of PTR plate or thermal erasure + re-write. Acceptable for embedded device — weights are fixed post-training.

### 4.5 Optoelectronic Interposer (Between Layers)

Between successive resonator layers, an optoelectronic interposer:
1. Detects the output field: Si PIN PD array (0.6 A/W @ 850nm)
2. Amplifies (TIA, 100kΩ feedback)
3. Applies nonlinearity: analog comparator tree → GeLU approximation
4. Re-emits: VCSEL array at 850nm → input of next resonator

This is structurally identical to the Glass Brain interposer (validated architecture, 2026-04-17 session). Reuse directly.

Interposer adds: ~67ns latency, ~1.32W/head power (from Glass Brain derivation).

**Why interposer and not all-optical nonlinearity?**
- All-optical Kerr effect: too weak in PTR glass at reasonable power levels. Intensity required for significant Kerr shift >> cavity damage threshold.
- Saturable absorber: viable but bandwidth-limited. Hughes 2019 used this in simulation; experimental demonstration limited.
- Optoelectronic: well-characterized, validated, controllable nonlinearity shape. Chosen.

This is an acknowledged architectural compromise: the system is optoelectronic, not all-optical. The computation (MVM) is optical; the nonlinearity is electronic. This matches every experimentally demonstrated ONN system to date (Fu et al. 2024, ONN review).

### 4.6 Stack Depth

One resonator + interposer = one transformer layer analog.

For a target model (e.g., a compact ~1B param transformer with 24 layers):
- 24 resonators stacked
- Each resonator: Fabry-Perot cavity with PTR glass
- Each interposer: VCSEL/PD array
- Embedding dimension: d = 512 or 1024

---

## 5. What "Learning" Means in This System

**Training is offline and structural.**

1. Define the model architecture: number of resonators (layers), embedding dimension d, round-trip count T per layer.
2. Initialize Δn_k(x,y) for each layer k randomly.
3. Run forward pass through wave dynamics model (differentiable wave equation simulation).
4. Compute loss (cross-entropy or causal LM loss on token prediction).
5. Backpropagate through wave dynamics (adjoint method = physically consistent gradient).
6. Update Δn_k via gradient descent.
7. Repeat until convergence.
8. Compute UV hologram pattern from final Δn_k(x,y) for each layer.
9. Write holograms into PTR glass plates (one plate per layer).
10. Assemble plates into Fabry-Perot cavities.

**The physical device implements the trained model with no further modification.** This is consistent with the embedded constraint: weights are written once, fixed forever (or until re-trained and new plates written).

---

## 6. Comparison: This Architecture vs. Glass Brain

| Property | Glass Brain | Quantum Resonator |
|---|---|---|
| Optical primitive | 4f phase mask (single-pass) | Fabry-Perot cavity (multi-pass) |
| Weight storage | PTR plate (spatial MVM) | PTR plate (holographic grating) |
| Computation model | Feedforward (layer per pass) | Recurrent (round trips = RNN steps) |
| Nonlinearity | Optoelectronic interposer | Optoelectronic interposer |
| Multi-tenancy | Yes (Glass Brain v0.5) | No — embedded device |
| Context cache | HBM3, electronic | None required (recurrent state in field) |
| Wavelength | 850nm | 850nm (same, validated) |
| Scale target | 40B params (Glass Brain v0.5) | 1B params (embedded) |
| Training | Offline backprop | Offline adjoint/backprop (same) |

**Key architectural difference:** Glass Brain = feedforward (one pass through static hologram). Quantum Resonator = recurrent (multiple round trips through same hologram). The resonator's depth is determined by number of round trips T, not number of separate physical layers.

**Advantage of resonator:** Depth "for free" — same hologram plate used T times per token. Fewer physical components for equivalent computational depth.

**Disadvantage:** Round-trip loss accumulates over T passes. T is limited by loss budget. Need to derive T_max from mirror reflectivity and PTR glass transmission.

---

## 7. Open Questions and Architecture Tasks

| Task | Description | Priority |
|---|---|---|
| ARCH-2 | Resonator geometry: derive L, R, T_max from loss budget | HIGH |
| ARCH-3 | Mode structure: how many transverse modes N fit in PTR aperture? | HIGH |
| ARCH-4 | Token throughput: derive token rate from round-trip time | HIGH |
| ARCH-5 | SNR: derive noise accumulation over T round trips | HIGH |
| ARCH-6 | Training: adjoint method implementation for wave dynamics | MED |
| ARCH-7 | Hologram capacity: how many weight matrix entries fit in Δn(x,y)? | MED |
| ARCH-8 | Interposer: reuse Glass Brain design or derive new? | LOW |

---

## 8. Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-19 | Project scaffolded | Initial setup |
| 2026-04-19 | ARCH-1 LOCKED: Fabry-Perot cavity as RNN | Hughes 2019 exact mapping: wave eq = RNN update. Resonator = physical weight matrix. |
| 2026-04-19 | ARCH-1 LOCKED: PTR glass as weight medium | Psaltis 1990 + Glass Brain validation. Δn(x,y) = holographic weight storage. Non-volatile. |
| 2026-04-19 | ARCH-1 LOCKED: optoelectronic nonlinearity | All-optical Kerr too weak for realistic powers. Saturable absorber bandwidth-limited. Optoelectronic: validated, controllable. |
| 2026-04-19 | ARCH-1 LOCKED: 850nm wavelength | Same reasoning as Glass Brain — GaAs VCSEL OTS maturity, Si PD response, PTR glass transparency. Continuity of supply chain. |
| 2026-04-19 | Embedded / single-tenant constraint noted | No HBM3, no context cache, no scheduling. One model, static weights. Simplifies interposer and eliminates S_n reload complexity. |



---

## Material Properties

### `ptr_glass`
*Photo-thermo-refractive glass for holographic recording*

- **wavelength_range_nm**: [300, 3000]
- **max_refractive_index_change**: 0.005
- **absorption_coefficient_per_cm**: 0.01
- **diffraction_efficiency_max**: 0.99
- **write_wavelength_nm**: 325
- **erase_wavelength_nm**: 0
- **thermal_stability_C**: 400

> Cite: Glebov 2010, Proc. SPIE 7504, doi:10.1117/12.838767

### `linbo3_tfln`
*Thin-film lithium niobate electro-optic modulator platform*

- **half_wave_voltage_V**: 1.5
- **bandwidth_GHz**: 100
- **propagation_loss_dB_per_cm**: 0.27
- **coupling_loss_dB**: 0.5
- **pockels_coefficient_r33_pm_per_V**: 30.9

> Cite: Wang et al. 2018, Nature, doi:10.1038/s41586-018-0551-y

### `sin_pic_a150`
*Ligentec A150 silicon nitride PIC platform, NIR optimized*

- **wavelength_range_nm**: [700, 1060]
- **propagation_loss_dB_per_m**: 3.0
- **minimum_bend_radius_um**: 10
- **coupling_loss_fiber_to_chip_dB**: 1.5
- **platform**: Ligentec A150

> Cite: Ligentec A150 PDK documentation, https://www.ligentec.com/products/a150/

### `gaas_vcsel_850nm`
*GaAs vertical-cavity surface-emitting laser at 850nm*

- **threshold_current_mA**: 0.5
- **slope_efficiency_W_per_A**: 0.6
- **wall_plug_efficiency**: 0.35
- **linewidth_MHz**: 50
- **coherence_length_m**: 3.0
- **modulation_bandwidth_GHz**: 10

> Cite: Iga 2000, IEEE J. Sel. Top. Quantum Electron., doi:10.1109/2944.902166

### `ingaas_pin_detector`
*InGaAs PIN photodetector, telecom/NIR*

- **responsivity_A_per_W**: 0.85
- **bandwidth_GHz**: 50
- **dark_current_nA**: 1.0
- **noise_equivalent_power_W_per_rtHz**: 1e-14

> Cite: Bowers & Burrus 1987, J. Lightwave Technol., doi:10.1109/JLT.1987.1075507

### `si_pin_detector_850nm`
*Silicon PIN photodetector at 850nm*

- **responsivity_A_per_W**: 0.6
- **bandwidth_GHz**: 10
- **dark_current_nA**: 0.1

> Cite: Saleh & Teich, Fundamentals of Photonics, 3rd Ed., Ch. 18

### `silica_fiber_smf28`
*Corning SMF-28 single-mode fiber*

- **attenuation_dB_per_km_1550nm**: 0.18
- **attenuation_dB_per_km_1310nm**: 0.35
- **attenuation_dB_per_km_850nm**: 2.5
- **core_diameter_um**: 8.2
- **numerical_aperture**: 0.14

> Cite: Corning SMF-28 Ultra datasheet, 2023, https://www.corning.com/media/worldwide/coc/documents/Fiber/SMF-28%20Ultra.pdf

### `gaas_vcsel_850nm_single_mode`
*Single-mode GaAs VCSEL at 850nm with narrow linewidth for coherent resonator operation*

- **linewidth_MHz**: 10
- **coherence_length_m**: 30.0
- **threshold_current_mA**: 1.0
- **modulation_bandwidth_GHz**: 5
- **note**: Oxide-confined single-mode VCSEL. Broader multimode VCSEL (50MHz, 6m l_c) insufficient for T>60 at L=20mm.

> Cite: Larsson 2011, IEEE J. Sel. Top. Quantum Electron. 17(6):1551, doi:10.1109/JSTQE.2011.2114837

---

## Design Parameters

### `optical`
- **wavelength_nm**: `850`

### `token_embedding`
- **dimension**: `512`

### `resonator`
- **geometry**: `Fabry-Perot`
- **medium**: `PTR_glass`
- **round_trips_T**: `100`
- **cavity_length_L_mm**: `20`
- **mirror_reflectivity_R**: `0.999`

### `spatial`
- **pixel_pitch_um**: `50`
- **aperture_mm**: `2.5`

### `snr`
- **target_bits**: `6`
- **target_snr_dB**: `38.0`

### `interposer`
- **detector**: `Si_PIN_850nm`
- **amplifier**: `TIA_180nm_CMOS`
- **nonlinearity**: `analog_comparator_GeLU`
- **emitter**: `GaAs_VCSEL_850nm`
- **latency_ns_per_layer**: `67`
- **power_W_per_head**: `1.32`

### `model`
- **target_params**: `TBD`
- **layers**: `TBD`
- **embedding_dim**: `512`

### `power`
- **facility_W**: `TBD`
- **target_per_token_mJ**: `TBD`

