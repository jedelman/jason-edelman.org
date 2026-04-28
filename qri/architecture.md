# Optical Resonator Inference — Architecture Specification

**Status:** ARCH-1 through ARCH-17 LOCKED
**Last revised:** 2026-04-26
**Project:** All-optical resonator for embedded LLM token inference
**Constraint:** Single-tenant embedded device. No context switching. No multi-tenancy. Offline training, static weights during inference.

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
5. **Embedded, single-tenant.** One model loaded once. No scheduling, no reloading, no context switching.
6. **No undocumented parameters.** All values in parameters.toml require rationale.
7. **In-situ training mandatory.** Weights cannot be transferred from simulation to physical cavity. Training must use the physical device as the forward model.

---

## 3. Theoretical Foundation (ARCH-1)

### 3.1 Wave Equation as RNN (Hughes et al. 2019)

The scalar wave equation for an optical field u(x,y,t) in a medium with refractive index distribution n(x,y):

```
∂²u/∂t² = (c₀/n(x,y))² · ∇²u + f(x,y,t)
```

Finite-difference discretization with time step Δt yields:

```
u_{t+1} = 2u_t - u_{t-1} + Δt²(c₀/n)²∇²u_t + Δt²f_t       (eq. 1)
```

Define hidden state h_t = [u_t, u_{t-1}]^T. Then eq. 1 is structurally identical to an RNN update (Hughes et al. 2019, eq. 5):

```
h_t = A(n) · h_{t-1} + P^(i) · x_t                            (eq. 2)
y_t = |P^(o) · h_t|²                                          (eq. 3)
```

where A(n) is determined by the refractive index distribution, P^(i) is the input coupling matrix, P^(o) is the readout matrix, and y_t is detected intensity. The trainable parameter is n(x,y). Training = designing the refractive index distribution.

**ARCH-1 conclusion:** Any optical cavity with a spatially structured medium IS an RNN. The refractive index distribution is the weight matrix. Round-trip time = one RNN time step. This is an exact mapping at the level of Maxwell's equations discretized in time, not an approximation.

### 3.2 Holographic Weight Storage (Psaltis et al. 1990)

A holographic grating in a photosensitive medium stores a weight matrix as a spatial modulation of the refractive index:

```
Δn(x,y) = Δn_max · Σ_k A_k · cos(k_k · r + φ_k)              (eq. 4)
```

Each term encodes one outer product pattern. Angular multiplexing stores multiple patterns. For PTR glass: Δn_max = 5×10⁻³ (Glebov 2010), thermally fixed after development, transparent at 850nm.

### 3.3 From Scalar Wave to Token Embedding

Token inference requires input x ∈ ℝ^d and output y ∈ ℝ^d. Extension: excite the resonator with d simultaneous spatial modes, each amplitude-modulated by one component of the input token vector:

```
f(x,y,t) = Σ_{i=1}^{d} x_i · ψ_i(x,y) · δ(t)               (eq. 5)
```

After T round trips, the output field is read by d output detectors:

```
y_j = |∫ ψ_j*(x,y) · u_T(x,y) dx dy|²                       (eq. 6)
```

The map x → y is a learned nonlinear transformation, optimized by training Δn(x,y) via the adjoint method. Stacking multiple resonators (each with its own Δn) = stacking transformer layers.

---

## 4. System Architecture

### 4.1 System Overview

```
Token embedding x ∈ ℝ^512
        ↓
   [VCSEL array, 850nm, 512 modes]
   x_i → amplitude of mode ψ_i
        ↓
   [PTR glass resonator]
   Δn(x,y) = trained holographic weight grating
   T=100 round trips per token
        ↓
   [Si PIN detector array + TIA]
   Intensity readout → 512-dim output vector
        ↓
   [Inter-layer coupling: relay lens pair, free-space]
   Passive mode-matching, no electronics
        ↓
   Next resonator (next layer)
        ↓   × 24 layers
   [Final output readout]
   512-dim intensity vector → logits
```

### 4.2 Resonator Geometry (ARCH-2, ARCH-3)

**Geometry:** Confocal Fabry-Perot, one flat mirror and one concave mirror (R_c = L = 20mm). PTR glass fills the cavity. HR mirror coatings deposited directly on PTR glass faces after holographic development — no separate optics inside the cavity.

The confocal condition (R_c = L) produces Hermite-Gaussian TEM_mn eigenmodes with fundamental waist w₀ = √(λL/2π) = 5.2 µm at 850nm. Fresnel number F = D²/(4λL) = 78 confirms >7000 modes fit within the 2.5mm aperture, of which 512 are addressed.

**Why Fabry-Perot over ring:** Ring resonators support traveling-wave modes, not standing-wave. The standing-wave mode structure of the Fabry-Perot naturally implements the u_{t-1} term in eq. 1 via retroreflection. Ring geometry rejected.

**Why PTR glass fills the cavity:** The weight grating is a property of the glass bulk. Filling the cavity with glass rather than using a thin insert maximizes MVM interaction length (more Δn accumulated per pass). No air gaps inside the resonator.

**ARCH-2/3 locked parameters:**

| Parameter | Value | Rationale |
|:---|:---|:---|
| Cavity length L | 20mm | Sets τ=133ps, T_coh=750 >> T_op=100. Coherent regime. |
| Mirror reflectivity R | 0.9990 | Finesse=3140, intra-cavity gain ~1000×, practical dielectric HR |
| Round-trip time τ | 133.3 ps | τ = 2L/c₀ |
| Operating round trips T_op | 100 | T_op << T_coh. SNR ≥ 38dB at this depth. |
| Cavity aperture | 2.5mm | Supports 512 modes at 50µm VCSEL pitch with 2× margin |
| Modes addressed | 512 | Embedding dimension d=512 |
| Polarization | Vertical linear only | VCSEL native, avoids mirror dichroism |
| VCSEL pitch | 50µm | Glass Brain validated; 117× safety vs λ/2 |
| PTR glass geometry | 10×10×0.5mm | Thermal management (ARCH-10); post-carve coating |

### 4.3 The Pure-Glass Resonator

The inference resonator contains no active intra-cavity elements. The optical path during inference is:

```
VCSEL array (850nm, 512 modes)
  → input face (HR coating R=0.9990, ~0.1% input coupling)
  → PTR glass bulk (Δn(x,y) weight grating)
  → output face (HR coating, ~10% output coupling)
  → Si PIN detector array
```

Nothing inside the resonator except glass. This is not a simplification for convenience — it is a physical requirement. Any active element (modulator, phase shifter, electrode) inside a Finesse-3140 cavity contributes insertion loss on every round trip. Even 0.1 dB/pass accumulates to 10 dB over T=100 round trips, consuming the entire SNR budget. There is no margin for intra-cavity active elements at this finesse and round-trip count.

### 4.4 Input Encoding (ARCH-3)

Each token x ∈ ℝ^512 is encoded as a spatial amplitude distribution at the input mirror:

```
E_in(x,y) = Σ_{i=1}^{512} x_i · ψ_i(x,y)
```

Implementation: 512 GaAs VCSELs at 850nm, arranged in a 23×23 grid at 50µm pitch (1.15mm footprint), collimated and magnified 2.2× to fill the 2.5mm cavity aperture. Each VCSEL is amplitude-modulated at the token rate (75M tok/s = 13.3ns/token, requiring ~75MHz modulation — well within VCSEL bandwidth of 5-10GHz).

Note: current encoding uses amplitude only (x_i real-valued → amplitude of mode ψ_i). Phase of each mode is unused at input. This is an unexploited degree of freedom. Phase encoding could double the effective input capacity. Deferred to future work; not required for initial validation.

### 4.5 Inter-Layer Coupling (ARCH-8)

Between successive resonator layers, coupling is entirely passive and free-space. No electronics, no active modulation, no homodyne reference in the inter-layer path.

```
Output face of layer k (partial transmission ~10%)
  ↓ collimating lens
  ↓ relay lens pair (mode-match aperture k → aperture k+1)
  ↓ input face of layer k+1
```

The relay lens pair performs geometric mode-matching only — it maps the output field of cavity k onto the input aperture of cavity k+1 with correct magnification. It applies no computation. Inter-layer latency is ~0.2ns for 50mm free-space propagation, negligible relative to the 13.3ns per-layer compute time.

Phase coherence is not required to be maintained across layers. The token embedding at each layer input is a real-valued intensity vector (the output of the Si PIN detector array), re-encoded as VCSEL amplitudes. Incoherent coupling between layers eliminates the need for a global phase reference, dramatically simplifying the multi-layer stack and enabling independent per-layer thermal management.

**Inter-layer signal chain and activation function:** The detector–driver–VCSEL chain implements the system's activation function. The signal path per mode is:

```
P_k = |E_k|²                           (layer k output intensity, per mode)
I_photo = R · P_k                       R = 0.6 A/W  → I_photo ≈ 1.5 mA at P=2.5mW
V_TIA   = R_f · I_photo                 R_f = 667 Ω  → V_TIA ≤ 1V  (within 3.3V rail)
I_drive = g · V_TIA                     g = 5 mA/V   → I_drive ≈ 5 mA at nominal
P_VCSEL = η_s · max(0, I_drive - I_th)  η_s=0.6 W/A, I_th=1 mA
```

Combining: `P_out = η_s · K · max(0, P_k − θ)` where:
- `K = g · R_f · R = 2.0` (dimensionless gain)
- `θ = I_th / K = 0.5 mW` (power threshold, tunable via VCSEL bias current)
- `A² = η_s · K = 1.2` (net intensity gain > 1, compensates coupling loss)

**In the intensity (power) computational basis, this is exactly ReLU:**

```
P_out = A² · max(0, P_in − θ)
```

Linear MVMs operate on intensity vectors; ReLU on intensity is interleaved between every layer. This satisfies universal approximation (Leshno et al. 1993: any non-polynomial bounded activation suffices; ReLU is the degenerate limit θ→0).

**Key TIA design constraint:** R_f = 667 Ω, not 100 kΩ. At I_photo = 1.5 mA, R_f = 100 kΩ gives V_TIA = 150 V — a rail violation. The correct transimpedance for ≤1V output at this photocurrent is 667 Ω. This also corrects the SNR section which previously cited 100 kΩ (that figure was from a low-light single-photon context, not applicable here).

**Threshold tunability:** VCSEL bias current sets the effective threshold:
- Bias = 0: θ_eff = 0.5 mW (20% of P_op) — moderate nonlinearity
- Bias = 95% · I_th: θ_eff = 0.025 mW (1% of P_op) — near-linear (soft activation)
- Bias < I_th always: VCSEL off when no signal — hard sparsity below threshold

The threshold is a single per-layer scalar set by bias DAC — trainable hyperparameter.

**On the question of MZIs in the coupling path:** MZI meshes are not present and are not needed. MZIs in photonic neural networks implement programmable weight matrices. In QRI, the weight matrix is implemented by the holographic grating inside the resonator. The coupling path has no computational role — it is purely geometric transport. Passive relay optics suffice.

### 4.6 Activation Function (ARCH-9, locked 2026-04-27)

The activation function is **ReLU on intensity**, implemented by the VCSEL threshold nonlinearity at each inter-layer boundary. No intra-cavity nonlinear optical element is required.

**Derivation:** See ARCH-8 signal chain. The complete transfer function from layer k intensity to layer k+1 intensity is:

```
P_out = A² · max(0, P_in − θ)

where:
  A²  = η_s · K = η_s · g · R_f · R  = 1.2   (net gain)
  θ   = I_th / K                      = 0.5 mW (power threshold)
  K   = g · R_f · R                   = 2.0
```

This is ReLU with gain A² = 1.2 and threshold θ = 0.5 mW. The gain > 1 is intentional: it compensates the ~10% inter-layer coupling loss so that signal level is maintained across 24 layers without electronic amplification stages.

**Proof of nonlinearity:** f(a·P) = A²·max(0,a·P−θ) ≠ a·f(P) for θ≠0. Fails homogeneity → nonlinear. ✓

**Proof of expressiveness:** ReLU networks with sufficient width are universal approximators (Hornik 1991). The intensity-domain computation (holographic MVM interleaved with intensity ReLU) is precisely this architecture. ✓

**Why not Kerr SPM:** φ_NL ~ 10⁻¹⁵ rad/pass at operating intensity — negligible. SPM is a phase effect; it produces no amplitude nonlinearity at these power levels. Retired.

**Computational basis note:** The correct basis for QRI computation is **intensity** (power), not field amplitude. The holographic MVM mixes intensity modes; the VCSEL threshold applies ReLU to each intensity component; the next layer sees an intensity input. Phase is erased at each inter-layer boundary — this is intentional and required for thermal independence between layers (ARCH-8).

**ARCH-9 locked parameters:**

| Parameter | Value | Derivation |
|:---|:---|:---|
| Activation function | ReLU on intensity: P_out = A²·max(0, P_in−θ) | VCSEL threshold |
| Net gain A² | 1.2 | η_s · g · R_f · R = 0.6 × 5e-3 × 667 × 0.6 |
| Power threshold θ | 0.5 mW (zero bias) | I_th / K = 1mA / 2.0 |
| θ tunability | 0–0.5 mW via VCSEL bias DAC | Bias sets effective I_th |
| TIA transimpedance R_f | 667 Ω | V_max=1V at I_photo=1.5mA |
| Driver transconductance g | 5 mA/V | I_drive,max=5mA at V=1V |
| Intra-cavity nonlinear element | None | — |
| Cavity detuning | On-resonance (δ = 0) | Maximize finesse buildup |
| Computational basis | Intensity (power) | Phase erased at each boundary |
| VCSEL bias stabilization | APC loop (automatic power control) | Standard driver IC feature; compensates I_th thermal drift (~3.8mA at 7.6K self-heating) |
| VCSEL PID lock bandwidth | ~1 kHz | Thermal drift correction only |

### 4.7 SNR and Noise Budget (ARCH-5)

Signal path:

```
Input: 2-3 mW per VCSEL mode
  → finesse buildup (~1000×) → 2-3W intra-cavity
  → T=100 round-trip loss: 0.995^100 ≈ 0.606 (2.4 dB)
  → output power ~1.2-1.8W aggregate
  → Si PIN (0.6 A/W) → 0.36-0.54 A photocurrent
  → TIA (R_f=667Ω) → 6-bit quantizer
```

Dominant noise: shot noise. At I ≈ 0.4A, readout bandwidth 1GHz:

```
σ_shot = √(2eIΔf) ≈ 10µA
SNR = I/σ_shot ≈ 40dB
```

Target for 6-bit precision: 38dB (6.02×6 + 1.76 = 37.9dB). Margin: 2dB.

**ARCH-5 locked parameters:**

| Parameter | Value |
|:---|:---|
| Input power per VCSEL | 2-3mW |
| Intra-cavity power | 2-3W |
| Output SNR | 40dB (target ≥38dB) |
| SNR margin | 2dB |
| Noise floor | Shot-noise-limited |

Risk: 2dB margin is tight. EXP-4 (thermal lensing) could erode it. Phase 1 VCSEL upgrade (+3dB, 2.5mW → 10mW) is available if margin is insufficient.

### 4.8 Token Throughput (ARCH-4)

```
τ = 2L/c₀ = 133.3 ps (round-trip time)
t_token = T_op × τ = 100 × 133.3 ps = 13.3 ns
throughput = 1/t_token = 75M tokens/sec
```

24-layer stack latency: 24 × 13.3ns = 320ns optical + inter-layer propagation ≈ 330ns total. No electronic interposer latency in the inference path.

### 4.9 Holographic Weight Capacity (ARCH-7)

Weight matrix stored via low-rank factorization W = U·V^T:

```
U ∈ ℝ^(N_out × r),  V ∈ ℝ^(N_in × r)
Total weights per layer: (N_out + N_in) × r
```

At rank r=50 and internal layers (N_in = N_out = 512): 51.2k weights per layer.

**Input layer (layer 1):** Differential encoding (§4.4 and docs/theory_derivations.md §4)
requires 2×512 = 1024 input modes to represent signed embeddings. Layer 1 factorization:
U^(1) ∈ ℝ^(512 × 50), V^(1) ∈ ℝ^(1024 × 50) → 76,800 weights.

For a 24-layer stack with differential input:

```
N_params = 76,800 + 23 × 51,200 = 1,254,400 ≈ 1.254M
```

Each outer product u_i ⊗ v_i^T → one holographic grating component, written via angular
multiplexing. PTR glass supports ~1000 independent grating components (Glebov 2010, λ/D angular
selectivity criterion) — ample headroom at rank-50. Rank can be increased to 100-200 with mode
basis expansion (ARCH-16).

### 4.10 Thermal Management (ARCH-10)

PTR plate geometry: 10×10×0.5mm. Surface area 260mm² provides passive thermal dissipation with ΔT ≈ 15K above ambient at 1W absorbed. Active Peltier cooling holds plate at 20-25°C even at 10W intra-cavity (COP~2, ~5W electrical overhead). Peltier is optional for the baseline design; included for margin.

---

## 5. Training Architecture

### 5.1 The Weight Translation Problem (ARCH-11)

Digital training — running the adjoint wave equation simulation on a GPU — computes an optimal Δn(x,y) for a mathematical cavity. The physical cavity deviates from that model at scales that matter:

- A length error of 1µm = 1.2 wavelengths at 850nm
- Mirror flatness errors of λ/10 introduce 85nm wavefront error per pass
- Internal stress gradients in the PTR blank produce spatially varying Δn not present in simulation

These deviations compound multiplicatively over T=100 round trips. The correspondence between simulated weights and physical weights is completely destroyed. **Weight translation from simulation to physical cavity is not feasible.** Every physical cavity is unique at the scale that determines the computation.

Training must therefore be performed in-situ, using the actual physical cavity as the forward model. The physical imperfections are automatically incorporated because gradients are computed from measurements made through the real glass.

### 5.2 Wavelength Separation: Write at 532nm, Infer at 850nm (ARCH-11)

Three isolation schemes for separating weight-writing from inference were analyzed.

**Temporal separation** (exploit slow grating decay between write and read phases) fails because any 850nm read beam has nonzero photorefractive cross-section σ_r in any optically responsive material. Over millions of inference tokens, the grating degrades via optical fixing fatigue. The erasure cannot be eliminated, only slowed. This provides no benefit over static PTR holography.

**Spatial mode separation** (write with TEM₀₁, read with TEM₀₀, exploit amplitude orthogonality) fails because amplitude orthogonality does not imply intensity orthogonality. The grating coupling coefficient involves an intensity overlap integral:

```
κ_{00,01} = (k/2n) · ∫∫ ψ*₀₀(x,y) · Δn₀₁(x,y) · ψ₀₀(x,y) dx dy
```

Since Δn₀₁(x,y) follows the TEM₀₁ intensity profile (even function, nonzero overlap with Gaussian TEM₀₀), this integral is nonzero. The read beam both uses and partially erases the written grating. The computation mechanism and the erasure mechanism are identical and cannot be separated by spatial mode choice.

**Wavelength separation** (write at 532nm, read at 850nm) is categorically different. PTR glass photosensitivity is determined by the silver-cerium complex absorption spectrum, which peaks in the UV and falls to effectively zero at 850nm. The grating integrity condition is:

```
σ_r · I_r << σ_w · I_w
σ_r(850nm) ≈ 0  →  satisfied for any I_r, unconditionally
```

This is a physics argument — photons at 850nm lack the energy to drive the photochemical reaction that creates or destroys the grating — not a rate argument or an overlap argument. The inference beam cannot erase the weights. This property does not degrade with operating time, temperature, or intensity within the PTR stability envelope.

**Wavelength separation is locked as the isolation mechanism.**

### 5.3 In-Situ Training Protocol (ARCH-11)

Training uses the physical inference cavity as the forward model. The mechanical housing includes a 532nm write port (capped during inference) in addition to the 850nm input port.

**Forward pass (850nm):** Inject training input x via the VCSEL array. Circulate T=100 round trips. Measure output y via the Si PIN detector array. Compute loss L = ‖y − y_target‖².

**Gradient computation (digital):** The adjoint method computes ∂L/∂Δn(x,y) on a GPU using the measured output as the boundary condition. The physical cavity's imperfections are implicitly absorbed because the forward pass is measured, not simulated.

**Weight update (532nm):** The gradient ∂L/∂Δn(x,y) is encoded as a spatial amplitude and phase pattern on the 532nm write beam, which is injected via the write port in single-pass configuration. The 532nm beam's intensity pattern drives a photorefractive index increment matching the gradient step:

```
Δn(x,y) ← Δn(x,y) + η · ∂L/∂Δn(x,y)
```

where η is set by the 532nm exposure dose. The 850nm beam is off during writing.

**Batch gradient accumulation:** Individual training samples should not trigger individual 532nm write pulses. Consecutive write exposures create overlapping latent images that partially erase each other (holographic crosstalk), degrading the weight trajectory. Instead, gradients are accumulated digitally over a batch of training tokens and a single summed gradient is written per batch. This maps onto standard batch gradient descent and eliminates intra-batch crosstalk. Batch size is a free parameter; larger batches reduce crosstalk and improve gradient quality at the cost of slower feedback. Optimal batch size is determined by the ratio of individual gradient magnitude to accumulated grating strength, which EXP-7 will characterize.

**Thermal development:** After one full training epoch (all batches processed), the PTR glass is removed from the cavity and thermally developed (500°C, ~30 minutes). Development converts the latent photorefractive exposure (silver nanoparticle seeds, ~10-20% of final Δn) into permanent crystallographic index modulation (NaF nanoparticle growth, full Δn). The crystallographic grating is immune to subsequent 532nm exposures — it cannot be overwritten or erased. Subsequent write cycles add corrections on top of the fixed structure.

**Iteration:** Reinstall the developed glass, remeasure the forward pass, evaluate residual loss. If loss is above target, run another write-develop cycle. Convergence expected in 3-5 cycles. The system identification loop (see ARCH-13) progressively refines the adjoint simulation to match the physical cavity, reducing residual error each cycle.

**Training timeline (per layer):**

| Step | Duration | Notes |
|:---|:---|:---|
| One write epoch | ~1 hour | 532nm power and target Δn magnitude; EXP-3 |
| Thermal development | 30 min | Batch all 24 layers simultaneously |
| Reinstall + evaluate | 15 min | Kinematic mount; no realignment |
| Cycles to convergence | 3-5 | EXP-7 validates |
| **Total, 24 layers parallel** | **~1 day** | One furnace batch, 24 write stations |

### 5.4 Grating Stability During Inference (ARCH-11)

After thermal development, the crystallographic grating is permanent. The silver-cerium photosensitive complex has been consumed; subsequent 850nm photons find no reactive species. Glebov et al. demonstrated PTR grating stability over decade-plus timescales with no measurable diffraction efficiency change. The inference beam at 2-3W intra-cavity poses no grating integrity risk.

The only inference-phase stability concern is thermal drift of the effective optical path length, which shifts the cavity resonance frequency (not the grating). This is addressed by the VCSEL PID frequency lock (ARCH-9) and flagged for validation as EXP-4.

### 5.5 Batch Size and Epoch Scale (ARCH-11)

Because batch gradients are accumulated digitally before each 532nm write, the effective batch size can be arbitrarily large — limited only by GPU memory for gradient accumulation, not by any optical constraint. At 75M tok/s, running a batch of 1 billion training tokens takes ~13 seconds of optical forward-pass time. This enables training on massive corpora per write-develop cycle, which is a significant advantage over any digital training setup: the optical forward pass is essentially free relative to the gradient computation. Training epochs can be made as large as desired; the per-epoch cost is dominated by the 30-minute furnace cycle, not by the optical exposure time.

---

## 6. Scaling Architecture

### 6.1 Block Duplication (ARCH-17)

A single QRI block (one PTR glass resonator + relay optics) implements one transformer layer. Blocks can be duplicated in two configurations.

**Series (depth):** Stack N blocks, each with its own holographic weight plate. The output of block k feeds the input of block k+1 via passive relay optics. Computation depth scales with N. This is the 24-layer baseline.

**Parallel (width and expertise):** Route the same input to M independent blocks simultaneously. Each block computes a different linear transformation (different holographic weight plate) over a different subspace of the embedding. Outputs are concatenated or combined. This is the mixture-of-experts (MoE) architecture, implemented physically as an array of independent glass resonators with passive optical splitters and combiners. M can be large because each block is independent — no shared optical resource creates a bottleneck.

Incoherent coupling between layers and between parallel blocks is required for scalability. If phase coherence were maintained across blocks, a global phase reference would be needed for every block, and thermal drift in any one block would corrupt all others. Incoherent coupling (intensity readout at each block output, re-encoding at each block input) makes each block thermally and mechanically independent. This is the correct design for any system with more than a few blocks.

### 6.2 Clone-and-Fine-Tune for Scale Training (ARCH-17)

The weight translation problem (§5.1) establishes that weights cannot be transferred between a simulation and a physical cavity. The question for scaling is whether weights can be transferred between two physical cavities — i.e., whether unit 02 can be initialized from unit 01's trained grating and then fine-tuned, rather than trained from scratch.

**Why naive cloning fails in general.** The trained grating of unit 01 encodes two superimposed components that cannot be separated by inspection of the physical glass: the intended computation (the weight matrix W that the training procedure converged to) and the cavity-specific correction (the Δn pattern that compensates for unit 01's specific mirror figure errors, glass inhomogeneities, and length deviations). When this grating is copied to unit 02, the cavity-specific correction terms — which were tuned to unit 01's imperfections — are wrong for unit 02's different imperfections. They introduce errors rather than correcting them.

**Why cloning still works as an initialization.** Despite this, the cloned grating is not useless for unit 02. The intended computation W is present, even if distorted. Unit 02 is computing an imperfect version of the right computation, not a random one. This is precisely the situation where fine-tuning is effective: the loss landscape has already been explored and a good region found; fine-tuning is a local search to correct for the cavity mismatch, not a global search from scratch.

**The tolerance condition.** For clone-and-fine-tune to be cheaper than full training, the following must hold: the cavity-specific correction |Δn_comp2 - Δn_comp1| (the difference between unit 02's required correction and unit 01's baked-in correction) must be small relative to the total grating magnitude |Δn_total|. This difference is bounded by the inter-unit manufacturing variation — how consistently the two cavities are built. Manufacturing consistency is therefore a direct determinant of the clone-and-fine-tune efficiency.

**The two-stage training economy.** If manufacturing consistency is sufficient that fine-tuning converges in 1-2 write-develop cycles rather than the 3-5 needed for full training, the scaling economics change dramatically. A factory of N inference units requires: one fully-trained master unit (full training, ~1 day), an optical grating copying apparatus (contact printing or holographic duplication), and per-unit fine-tuning (1-2 write-develop cycles, ~4-8 hours each). The fine-tuning cost is sublinear in total training cost per unit. This maps exactly onto the digital ML paradigm of foundation model pretraining followed by deployment-specific fine-tuning — implemented in glass.

**What must be validated.** The clone-and-fine-tune strategy requires experimental validation before being relied upon for scale deployment. EXP-7 (see §7) is extended to include this validation.

### 6.3 Deployment Model (ARCH-12, ARCH-13)

During inference, the device operates as a pure 850nm system. The 532nm write port is physically capped. No training, gradient computation, or weight updates occur during inference.

The single-cavity phase stability budget is approximately:

```
σ_per_token ~ 1-5 mrad/token (estimated, EXP-5 validates)
B = (π/4)² / σ²_per_token ≈ 24,600 tokens at σ=5 mrad/token
```

This is adequate for LLM inference context lengths of 2K-128K tokens without ensemble averaging. Multi-cavity ensemble arrays are a scaling option if longer context or higher phase precision is required, but are not part of the baseline design.

**Model update = glass swap.** The device chassis is permanent hardware. PTR glass plates (10×10×0.5mm, ~$10-50 per blank) are swappable via kinematic mounts in minutes. No power cycling, no software update, no re-initialization. The device serves tokens immediately when the 850nm laser is on and the cavity is locked.

**Write station.** Training is performed at a dedicated write facility, not on the deployed device. The write station consists of a 532nm CW laser (Nd:YAG SHG, ~100mW), an SLM or holographic beam shaper for gradient encoding, a kinematic stage, and a reference beam path. The write station couples to the inference cavity via the write port, or the glass plate can be written on a standalone holographic bench. Finished plates are shipped to the deployed device. A model update is operationally equivalent to receiving a small package of glass cards.

**Adjoint simulation infrastructure.** Gradient computation (∂L/∂Δn(x,y) for each layer) runs on a GPU cluster using the differentiable wave equation model. The simulation is coupled to physical measurement in a closed loop: simulate → write → measure → compare → update simulation parameters → repeat. Over multiple cycles, the simulation converges to an accurate surrogate for the physical cavity (system identification). By the final write cycle, the surrogate may be good enough to compute updates without further in-situ measurement.

---

## 7. Rank Scaling (ARCH-16)

### 7.1 Rank and Mode Basis

RNN state dimensionality d = rank of the learned weight tensor. Each spatial mode carries one state dimension. The holographic grating encodes the weight matrix as a sum of rank-1 outer products, one per grating component. The mode basis determines how many independent grating components can be supported before the cavity Q degrades.

**Hermite-Gauss (default, rank <100):** Orthogonal in 2D rectangular geometry. 10×10 grid = 100 modes at rank-50; 20×20 grid = 400 modes at rank-100 (limited by diffraction loss above ~rank-100).

**Laguerre-Gauss (rank >100):** Cylindrical symmetry basis. Radial index p + azimuthal index ℓ. Scales more efficiently to high rank; mode overlap loss lower above rank-100.

**Hybrid basis (recommendation for rank >100):**
```
Φ_hybrid = {HG_{m,n} : m+n < 10} ∪ {LG_{p,ℓ} : p ≤ 15, ℓ ≤ 3}
         ≈ 100 HG + 100 LG = rank-200 native capacity
```

### 7.2 Rank Scaling Regimes

**Regime 1: Rank 50-100 (safe, current design)**
Insertion loss ~2.2-3.0dB, SNR 38-40dB, thermal PID at 1kHz sufficient. Accuracy within 1-2% of digital baseline.

**Regime 2: Rank 100-200 (pushing limits)**
Insertion loss ~3.5-4.5dB, SNR 36-37dB, mode coupling introduces spurious terms. Requires mode orthonormalization regularization (λ₃ penalty on ⟨φᵢ|φⱼ⟩²). Expected 2-4% accuracy loss vs. digital baseline.

**Regime 3: Rank >200 (failure)**
Cavity Q degrades below critical threshold. SNR drops to ~30dB. Thermal coupling between adjacent cavity regions exceeds PID tracking bandwidth. Not recommended.

### 7.3 Rank-Loss Tradeoff

```
Test accuracy = Digital_baseline - ε_rank - ε_SNR

ε_rank ≈ 1% · log₂(rank) / log₂(256)
ε_SNR  ≈ 0.5% · (40dB - SNR_actual) / 10dB
```

| Rank | SNR (dB) | ε_rank (%) | ε_SNR (%) | Total loss (%) |
|:---|:---|:---|:---|:---|
| 50 | 37.8 | 0.8 | 0.1 | **0.9** |
| 100 | 37.0 | 1.5 | 0.5 | **2.0** |
| 150 | 36.2 | 2.1 | 0.9 | **3.0** |
| 200 | 35.5 | 2.8 | 1.3 | **4.1** |

**Production target:** Rank-100 (200 basis modes, ~2% total accuracy loss, within acceptable range).
**Stretch goal:** Rank-150 (requires +3dB VCSEL upgrade for margin).
**Ceiling:** Rank-200 (all margins exhausted; not recommended for production).

Note: the ε_rank and ε_SNR model accounts for MVM fidelity and SNR. The activation function (ReLU on intensity, VCSEL threshold) is guaranteed by electronics and does not contribute accuracy loss.

---

## 8. Convergence Theory (ARCH-14, ARCH-15)

### 8.1 Photonic Backpropagation (ARCH-14)

Hughes et al. (2018) proved photonic backpropagation exactness via adjoint variable methods. For a photonic linear transformation y = M·x, gradients with respect to structural parameters are:

```
∂L/∂φ = Re( ⟨∂L/∂y | ∂y/∂φ⟩ )
```

computed by time-reversing the optical field and interfering with the loss gradient signal. This is exact — not an approximation — for any linear photonic system.

In QRI's in-situ training protocol, the adjoint computation runs digitally using the measured forward pass output as the boundary condition. The physical cavity's imperfections are automatically captured. Pai et al. (2023) demonstrated this experimentally, achieving ~94% MNIST accuracy (matching digital training) using in-situ photonic backpropagation.

Convergence rate bound (Hughes 2018, implied):
```
E[||∇L||²] ≤ O(1/√N_circ)    where N_circ = round trips per forward pass
```

At N_circ = 100: gradient noise ~1% of loss signal. Learning rate 0.01-0.1 per epoch. Expected convergence: 10-100 epochs (hours of optical forward-pass time).

### 8.2 Loss Landscape (ARCH-15)

The photonic loss (intensity measurement) and the digital loss (cross-entropy or MSE) are related but not identical:

```
L_optical = ∫ |E_out(t) - E_target(t)|² dt
L_digital = Σ_i ||y_pred_i - y_target_i||²
```

L_optical ≈ L_digital when amplitude matches normalized prediction and target phase encoding tracks cavity mode phase. Phase mismatch can create spurious minima in L_optical not present in L_digital. Mitigation: pre-calibrate target phase encoding to track cavity resonance condition throughout training.

Training stability requires signal-to-gradient ratio >10:1 (satisfied at 40dB SNR: gradient noise ~1%), learning rate <0.1 per epoch, and batch size >>1 (batch accumulation before each write, as specified in §5.3).

---

## 9. Decision Log

| Date | Decision | Rationale |
|:---|:---|:---|
| 2026-04-19 | ARCH-1 LOCKED: Fabry-Perot cavity as RNN | Hughes 2019 exact mapping: wave eq = RNN update |
| 2026-04-19 | ARCH-1 LOCKED: PTR glass as weight medium | Psaltis 1990 + Glass Brain validation. Non-volatile. |
| 2026-04-19 | ARCH-1 LOCKED: 850nm wavelength | GaAs VCSEL OTS maturity, Si PD response, PTR transparency. Glass Brain continuity. |
| 2026-04-19 | Embedded/single-tenant constraint | No HBM3, no scheduling. One model, static weights. |
| 2026-04-20 | ARCH-2 LOCKED | L=20mm, R=0.9990, τ=133.3ps, T_op=100. Coherent regime. |
| 2026-04-20 | ARCH-3 LOCKED | 512 spatial modes, 2.5mm aperture, single vertical polarization. |
| 2026-04-20 | ARCH-4 LOCKED | 75M tok/s (13.3ns/token). |
| 2026-04-20 | ARCH-5 LOCKED | SNR 40dB ≥ 38dB target. Shot-noise-limited. |
| 2026-04-20 | ARCH-7 LOCKED | Rank-50 U·V^T, 51.2k weights/layer, 1.23M total. |
| 2026-04-20 | ARCH-8 LOCKED | All-optical layer coupling, passive relay optics only. No MZIs in coupling path. |
| 2026-04-20 | ARCH-9 LOCKED | Kerr SPM (χ³ in PTR glass), φ_NL=0.2-1 rad/pass. |
| 2026-04-27 | ARCH-9 REVISED | Kerr SPM retired. |
| 2026-04-27 | ARCH-9 LOCKED | Activation: ReLU on intensity P_out=A²·max(0,P_in−θ). A²=1.2, θ=0.5mW. TIA R_f=667Ω (corrected from 100kΩ). Computational basis: intensity. |
| 2026-04-20 | ARCH-10 LOCKED | 10×10×0.5mm plate, passive+active thermal management. |
| 2026-04-24 | ARCH-14 LOCKED | Photonic backprop exactness via adjoint (Hughes 2018, Pai 2023). |
| 2026-04-24 | ARCH-15 LOCKED | Loss landscape: L_optical ≈ L_digital with phase calibration. |
| 2026-04-26 | ARCH-16 LOCKED | Rank ceiling 200, production target rank-100. Hybrid HG/LG basis above rank-100. |
| 2026-04-26 | ARCH-11 RETRACTED | Ephemeral weights via intra-cavity LiNbO3 MZM: disqualifying. 0.1 dB/pass × T=100 = 10 dB cumulative insertion loss per token. Wipes SNR budget. |
| 2026-04-26 | ARCH-11 (new) LOCKED | Weight translation infeasible (sub-λ manufacturing error × T=100). In-situ training mandatory. Wavelength separation (532nm write, 850nm infer) is the only clean isolation mechanism — σ_r(850nm)≈0 is a physics argument, not a rate tradeoff. Pure-glass resonator. Batch gradient accumulation before each write. Thermal cure between epochs. |
| 2026-04-26 | ARCH-12 REVISED | Ensemble cavity arrays demoted to scaling option. Single-cavity phase budget (~24K tokens) adequate for LLM inference. |
| 2026-04-26 | ARCH-13 REVISED | Model update = glass swap. Write station at dedicated facility. Adjoint simulation + system identification loop. |
| 2026-04-26 | ARCH-17 LOCKED | Clone-and-fine-tune scaling strategy. Grating encodes W + cavity-specific correction (inseparable). Cloning transfers W approximately; fine-tuning corrects cavity mismatch. Efficiency conditional on manufacturing consistency. EXP-7 extended to validate. |
| 2026-04-26 | EXP-6 CLOSED | LiNbO3 MZM removed from design. Single-pass insertion loss measurement no longer relevant. |

---

## 10. Open Experiments

| ID | Priority | Description | Blocks |
|:---|:---|:---|:---|
| EXP-1 | CLOSED 2026-04-27 | PTR χ³ (n₂) at 850nm — no longer required. Kerr SPM retired. Activation function is detector-squaring via VCSEL driver. | — |
| EXP-2 | HIGH | Two-wavelength photosensitivity: PTR under 532nm write + 850nm read simultaneously. Confirm σ_r(850nm)≈0 empirically. | ARCH-11 isolation claim |
| EXP-3 | HIGH | Grating growth rate: Δn vs. 532nm exposure time at accessible intensities. Sets write epoch duration. | ARCH-11 timeline |
| EXP-4 | HIGH | Thermal lensing: cavity stability under 2-3W CW 850nm intra-cavity. Acceptable drift <5 mrad/hour. | ARCH-5 SNR margin |
| EXP-5 | MED | Homodyne phase-lock stability: VCSEL PID lock over 1-hour inference run. | ARCH-12 phase budget |
| EXP-6 | CLOSED | LiNbO3 MZM insertion loss at 850nm. Closed 2026-04-26: MZM removed from design. | — |
| EXP-7 | HIGH | In-situ training convergence + clone-and-fine-tune validation. See §10.1 below. | ARCH-11, ARCH-17 |

### 10.1 EXP-7: In-Situ Training Convergence and Clone Validation (Expanded)

**Objective:** Validate the two core claims of the training architecture — that in-situ iterative write-develop training converges in a tractable number of cycles, and that clone-and-fine-tune is viable as a scaling strategy.

**Phase A — Convergence rate.** Build a minimal single-layer holographic RNN at rank-10. Train from a blank PTR glass plate using the in-situ two-wavelength protocol with batch gradient accumulation and iterative thermal development. Measure loss vs. write-develop cycle number. Target: convergence to within 2% of the digital baseline (simulated rank-10 RNN on the same task) in ≤5 cycles. If convergence is slower, identify the dominant error source from the following candidates: (a) gradient encoding fidelity — does the 532nm write pattern accurately reproduce the computed ∂L/∂Δn? (b) thermal development precision — does the furnace cycle faithfully convert latent image to crystallographic grating without distortion? (c) cavity reinstallation error — does the kinematic mount reproduce the cavity mode structure to sufficient precision?

**Phase B — Clone-and-fine-tune.** After Phase A produces a converged unit 01, optically copy the trained grating to a fresh PTR blank using contact holographic printing (or equivalent duplication method). Install the clone in a second, independently-built cavity (unit 02) with nominally identical but physically distinct specifications. Measure the initial loss of unit 02 with the cloned grating (no fine-tuning). Then run the fine-tuning protocol (iterative write-develop cycles starting from the cloned grating) and measure loss vs. cycle number. Compare the number of fine-tuning cycles required for unit 02 to the number of full training cycles required for unit 01.

**Success criteria:**
- Phase A: ≤5 write-develop cycles to within 2% of digital baseline.
- Phase B: Clone initializes unit 02 at lower loss than blank glass. Fine-tuning converges in ≤2 cycles (vs. ≤5 for full training). Confirms that clone-and-fine-tune is meaningfully cheaper than full training.

**Secondary measurements:**
- Batch size sensitivity: run Phase A at batch sizes of 100, 1000, 10000 tokens per write. Characterize crosstalk degradation vs. batch size. Identify the minimum batch size at which training is stable.
- Manufacturing consistency: measure cavity length, mirror figure, and glass homogeneity of unit 01 and unit 02. Correlate inter-unit physical differences with the initial loss of the cloned unit 02 and the number of fine-tuning cycles required. This establishes the manufacturing tolerance requirement for clone-and-fine-tune to be efficient.

---

## 11. Architecture Summary

| ARCH | Component | Status | Key Result |
|:---|:---|:---|:---|
| 1 | Wave eq → RNN | ✓ LOCKED | Hughes 2019 exact mapping. Resonator IS an RNN. |
| 2 | Cavity geometry | ✓ LOCKED | L=20mm, R=0.9990, Finesse=3140, τ=133ps, T_op=100 |
| 3 | Mode structure | ✓ LOCKED | 512 HG modes, 2.5mm aperture, 50µm VCSEL pitch |
| 4 | Throughput | ✓ LOCKED | 75M tok/s, 13.3ns/token |
| 5 | SNR budget | ✓ LOCKED | 40dB achieved, 38dB required, 2dB margin |
| 6 | Training (old) | ✗ SUPERSEDED | Replaced by ARCH-11 |
| 7 | Weight capacity | ✓ LOCKED | Rank-50, 51.2k weights/layer, 1.23M total |
| 8 | Layer coupling | ✓ LOCKED | Passive relay optics. No MZIs. Incoherent between layers. |
| 9 | Activation function | ✓ LOCKED 2026-04-27 | ReLU on intensity: P_out=A²·max(0,P_in−θ). A²=1.2, θ=0.5mW. VCSEL threshold. Intensity computational basis. |
| 10 | Thermal management | ✓ LOCKED | 10×10×0.5mm plate, Peltier optional |
| 11 | In-situ training | ✓ LOCKED (2026-04-26) | Pure-glass resonator. 532nm write / 850nm infer. Batch accumulation + thermal cure per epoch. Weight translation infeasible; training must be in-situ. |
| 12 | Deployment | ✓ LOCKED (2026-04-26) | Single cavity. Glass swap = model update. ~24K token phase budget. |
| 13 | Training infra | ✓ LOCKED (2026-04-26) | Write station + adjoint simulation. System identification loop. ~1 day/update. |
| 14 | Convergence proof | ✓ LOCKED | Adjoint backprop exact (Hughes 2018). Empirical: 94% MNIST (Pai 2023). |
| 15 | Loss landscape | ✓ LOCKED | L_optical ≈ L_digital with phase calibration. Batch size >1 required. |
| 16 | Rank scaling | ✓ LOCKED | Production rank-100, ceiling rank-200. Hybrid HG/LG basis. |
| 17 | Clone scaling | ✓ LOCKED (2026-04-26) | Clone-and-fine-tune viable conditional on manufacturing consistency. EXP-7B validates. |
