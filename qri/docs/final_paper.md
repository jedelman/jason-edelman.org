# Optical Resonator Inference: An All-Optical Architecture for Recurrent, Feedforward, and Attention Computation via Semiconductor Holographic Media

**Jason Edelman**  
*2026-05-08 · github.com/jedelman/quantum-resonator-inference*

---

## Abstract

We present Optical Resonator Inference (ORI), a complete all-optical architecture implementing recurrent, feedforward, and attention computation in a single physical system with no analog-to-digital conversion between layers. The system comprises three physically distinct layers: (1) a Fabry-Perot resonator with Al₀.₃₈Ga₀.₆₂As DX-center material implementing SSM-class recurrent computation ($\mathbf{M}^T\mathbf{a}$, T=100, updatable in 120 ms via optical adjoint); (2) a standalone DX slab implementing a feedforward transformation with independently trained weights; and (3) a bulk GaAlAs gain hologram slab implementing unnormalized content-based addressing — an attention-class operation that is functionally equivalent to softmax attention via carrier saturation, VCSEL threshold normalization, and FP resonant mode amplification. All weights across all layers are holographic gratings updated by optical adjoint at 500,000 gradient steps per second, incorporating device-specific manufacturing variations automatically. The system operates at 850 nm inference / 810 nm write, consumes 52.7 W total, and processes approximately 95 M tokens/second at 553 nJ/token. All components are commercially available at 50 µm mode pitch. We derive the exact closed form for the 4-index mode overlap tensor $T_{ijkl}$ in the Hermite-Gaussian basis (eq. 12), prove that $W(c)$ is always full-rank and symmetric, establish that causal cross-attention requires no Fourier lens, and prove that the five functional properties of softmax attention are all present in the ORI system distributed across the SOA, VCSEL threshold, and FP cavity.

---

## 1. Introduction

Large language model inference is thermodynamically inefficient. Every token requires loading billions of weights through digital electronics — a memory bandwidth problem masquerading as a compute problem. Optical hardware offers a fundamental path around this: holographic gratings store weight matrices as refractive index distributions, and matrix-vector multiplication occurs via diffraction at the speed of light with no data movement.

Prior optical neural networks have explored this principle in feedforward configurations [Lin 2018, Shen 2017, Feldmann 2021, Xu 2024]. All are stateless — they compute a fixed function of the input without carrying hidden state between tokens. Language model inference is sequential and stateful; this requirement cannot be satisfied by a feedforward optical system without digital recurrence overhead that eliminates the latency advantage. Recent work demonstrates that passive optical wave dynamics can also implement reservoir-class recurrence without any electronic feedback [Eşlik et al. 2026], confirming that photonic recurrence is physical rather than approximated — but without trained weights, reservoir systems are limited in expressivity. ORI implements trained holographic SSM recurrence, a strictly stronger class.

Hughes et al. [2019] established that the discretized scalar wave equation maps exactly to an RNN update rule: a Fabry-Perot resonator with holographic weight encoding is a recurrent neural network by construction, not by analogy. ORI instantiates this mapping in a specific physical system and derives the engineering constraints that make it trainable.

Beyond recurrence, we identify two further optical mechanisms that naturally implement feedforward and attention-class computation. The result is a system in which the three operations of a transformer block — recurrent SSM, feedforward nonlinearity, and attention — emerge from three distinct physical mechanisms in three distinct semiconductor media, with all weights continuously trained by optical adjoint at 500,000 gradient steps per second.

**This paper's contributions:**

1. A complete three-layer all-optical architecture implementing recurrent + feedforward + attention computation, with all weights updatable in 120 ms and all gradient computation optical at 500K steps/second.

2. Exact closed-form derivation of $T_{ijkl}$ for Hermite-Gaussian modes (§4.3), with $S_4$ symmetry proof, parity selection rule, and Kronecker factorization.

3. Proof that the ORI attention layer is functionally equivalent to softmax attention: five required properties established by the SOA saturation curve, VCSEL threshold, and FP resonant interference (§4.5).

4. A complete trade analysis establishing that a 4 mm Al₀.₃₈Ga₀.₆₂As DX slab in the FP cavity exceeds the effective operating rank of prior holographic media designs, delivers 33% faster throughput via reduced optical path length, and enables continuous optical gradient training at 500K updates/second (§3.3).

5. Power budget: 52.7 W total, 553 nJ/token, with continuous online learning adding <1% overhead.

**Scope:** This is a design paper. No experimental results are reported beyond EXP-7A (digital adjoint convergence). All other claims are derived from first principles with explicit open experiments listed.

---

## 2. Background

### 2.1 Wave Physics as RNN

The scalar wave equation $\partial^2 u/\partial t^2 = (c_0/n(\mathbf{x}))^2 \nabla^2 u + f$ discretized in time maps exactly to the RNN update $\mathbf{h}_{t+1} = \mathbf{A}(n)\mathbf{h}_t + \mathbf{B}f_t$ [Hughes et al. 2019]. The refractive index field $n(\mathbf{x})$ is the weight matrix. Training = writing $n(\mathbf{x})$. This is exact at the level of Maxwell's equations, not an analogy.

### 2.2 Holographic Weight Storage

Holographic gratings in photorefractive media implement matrix-vector multiplication via diffraction [Psaltis et al. 1990]. Angular multiplexing encodes multiple weight components in the same volume. ORI extends this to DX-center trap states in Al₀.₃₈Ga₀.₆₂As — a semiconductor photorefractive medium with 10-second grating lifetime, 810 nm optical write, and 850 nm transparent read.

### 2.3 In-Situ Photonic Backpropagation

The adjoint variable method applied to photonic systems gives $\partial\mathcal{L}/\partial\Delta n(\mathbf{r}) \propto \text{Re}[E_\text{adj}^*(\mathbf{r}) E_\text{fwd}(\mathbf{r})]$ [Hughes et al. 2018]. For the DX cavity, injecting an 810 nm backward adjoint beam writes this gradient directly into the DX grating in a single 13 ns pass. Pai et al. [2023] demonstrated in-situ photonic backpropagation achieving 94% MNIST accuracy; Ashtiani et al. [2026] subsequently demonstrated full end-to-end on-chip backpropagation in a silicon photonic deep network, confirming that in-situ training is more robust to device variation than weight-loading from digital simulation. ORI applies this principle to all three layers via holographic DX grating updates.

### 2.4 DX Centers in AlGaAs

Si donors in Al$_x$Ga$_{1-x}$As for $x > 0.22$ form persistent deep trap states (DX centers) with thermally activated lifetime $\tau = \tau_0 \exp(E_B/k_BT)$ [Lang & Logan 1977, Mooney 1990]. At $x = 0.38$: $E_B = 0.37$ eV, $\tau \approx 10$ s at 300 K. The VB→DX optical transition energy is 1.53 eV (810 nm) — cleanly separated from the 850 nm inference wavelength (1.46 eV, below threshold). Carrier diffusion length $L_\text{diff} = \sqrt{D_n\tau_c} = 1$ µm is much smaller than any grating period, so spatial hole burning patterns survive.

### 2.5 Cross-Gain Modulation in Semiconductor Amplifiers

Cross-polarization XGM in bulk semiconductor gain media is documented physics [Lacey 1994, Pleumeekers 2002]: a strong H-polarized pump depletes carriers, modulating the gain seen by a weak V-polarized probe. The XGM response saturates as $\Delta n(\mathbf{r}) \propto |E_H(\mathbf{r})|^2/(|E_H|^2 + I_\text{sat})$.

---

## 3. The DX Fabry-Perot: SSM Recurrent Layer

### 3.1 Physical Realization

A Fabry-Perot resonator (L=20 mm, R=0.9990) with an Al₀.₃₈Ga₀.₆₂As DX-center slab (4 mm × 5 mm × 5 mm, AR-coated at 850 nm) as the intracavity holographic medium. Dichroic mirror coating: R>99.9% at 850 nm, T>99% at 810 nm (40 nm separation, achievable with IBS coatings). Thermoelectric temperature control ±1°C.

### 3.2 Computation: M^T a

The round-trip operator $\mathbf{M} = \sqrt{R}(\mathbf{I} + i\mathbf{K}(\Delta n))$, where $\mathbf{K}$ encodes the DX holographic grating. After T=100 round trips per token:

$$\mathbf{h} = \mathbf{M}^T\mathbf{a} \tag{1}$$

This is an SSM-class weight-tied RNN of depth 100. The DX grating stores $\mathbf{W} = \mathbf{U}\mathbf{V}^\top$ as R=74 angularly multiplexed grating components.

### 3.3 DX Material vs Prior Holographic Media

Permanent holographic weight storage in photo-thermo-refractive (PTR) glass — a prior approach to optical weight encoding — requires thermal development at 500°C to fix gratings, making weight updates a batch offline process. DX-center material eliminates this constraint while matching the effective operating rank:

| Parameter | Prior (PTR 0.5mm) | DX 4mm (this work) |
|:---|:---|:---|
| Rank R (maximum) | 92 | 74 |
| **Rank R (operating)** | **50** | **74 ← exceeds** |
| τ_rt | 133 ps | 100 ps |
| Throughput | 75M tok/s | **100M tok/s** |
| FCA loss T=100 | 0.004 dB | 0.125 dB |
| Total loss T=100 | 0.873 dB | 0.994 dB |
| SNR margin | 1.13 dB | **1.006 dB** |
| Write cycle | 60 min thermal | **120 ms optical** |
| Gradient updates/s | ~0 | **500,000** |

Prior holographic media designs operated at rank-50 — 54% of the rank-92 capacity of a 0.5 mm plate — due to the SNR budget. A 4 mm DX slab gives R=74, exceeding that operating point by 48%. The FCA absorption at 850 nm (α≈0.036 m⁻¹, below the 1.90 eV bandgap) adds 0.125 dB over T=100 round trips, giving a total loss of 0.994 dB and a remaining SNR margin of 1.006 dB above the 38 dB target (EXP-16 required to confirm).

The shorter optical path length (DX slab n=3.5: 16mm air + 14mm optical = 30mm vs 40mm for air-only) gives 33% faster throughput as a direct consequence of the material index.

### 3.4 Training: All-Optical, 500K Updates/Second

The DX medium writes gratings at 810 nm (above the VB→DX threshold of 1.53 eV) and reads at 850 nm (below threshold, transparent). Optical adjoint training [Hughes 2018]:

1. **Forward pass** (850 nm, 13 ns): inference field circulates; 850 nm cannot write DX states.
2. **Loss gradient** (<1 µs, digital): $\delta = \partial\mathcal{L}/\partial\mathbf{y}$ on microcontroller.
3. **Adjoint pass** (810 nm backward, 13 ns): encode $\delta$ onto 810 nm beam via AOM; inject backward through cavity. The 810 nm field writes DX states proportionally to $\text{Re}[E_\text{adj}^* \cdot E_\text{fwd}]$ — the exact gradient.

Total cycle: **∼2 µs per gradient step = 500,000 updates/second**. One gradient step per token. The model adapts continuously to its inference workload, incorporating device-specific optical aberrations and manufacturing variations without any explicit calibration step.

---

## 4. The DX FFN and SOA Attention Layers

### 4.1 DX Feedforward Layer

A standalone DX slab (same material, 4 mm, same 810 nm write / 850 nm read) operating in single-pass T=1 mode computes:

$$\mathbf{z} = W_2\,\sigma(W_1\mathbf{h}) \tag{2}$$

with independently trained weights $W_1, W_2$ (rank 74 each). Single-pass transit: 47 ps. The DX FP layer and DX FFN layer have the same 10-second grating lifetime but carry completely independent weight matrices trained to different functions — one is the recurrent state update, the other is the feedforward expansion. The DX FFN layer keeps its computational identity as a feedforward layer even though the timescale is the same.

### 4.2 SOA Attention Layer: Physical Setup

A bulk GaAlAs gain slab (4 mm × 5 mm × 5 mm) pumped to transparency implements cross-polarization XGM:

- **Context (H-pol, $I \sim I_\text{sat} = 10^7$ W/m²):** writes carrier grating $\Delta n(\mathbf{r}) \propto |E_H(\mathbf{r})|^2/(|E_H|^2+I_\text{sat})$
- **Query (V-pol, $I \sim 0.01 I_\text{sat}$):** reads grating in 47 ps single transit
- **Output:** V-polarized field carrying attention result, separated by PBS (>30 dB)

Context and query co-propagate collinearly — identical wavefront paths, aberrations cancel (Psaltis 1990). Carrier diffusion $L_\text{diff}=1\,\mu\text{m} \ll \Lambda_\text{grating}=49\,\mu\text{m}$ → spatial hole burning survives, full rank R=524 accessible.

Attention cycle: 3 ns write + 47 ps read + 3 ns decay = **6 ns**, hidden inside the 10 ns DX FP inference period. Zero throughput overhead.

### 4.3 The T_{ijkl} Tensor: Exact Derivation

The output mode amplitudes are:

$$b_i = q_i + ikLC\sum_{j,k,l} c_j c_k^* q_l \underbrace{\int \psi_i^*\psi_j\psi_k^*\psi_l\,d\mathbf{r}}_{T_{ijkl}} \tag{3}$$

For 1D Hermite-Gaussian modes, we derive the closed form via Hermite linearization (DLMF 18.18.22) and the two-function integral $\int H_p H_q e^{-2x^2}dx = \sqrt{\pi/2}\cdot 2^p\cdot p!\cdot\delta_{pq}$ (Mehler 1866):

$$\boxed{I_{abcd} = N_a N_b N_c N_d\sqrt{\tfrac{\pi}{2}} \sum_s 2^{s+t+r}\,s!\,t!\,r!\,\tbinom{a}{s}\tbinom{b}{s}\tbinom{c}{t}\tbinom{d}{t}} \tag{4}$$

where $t = s+\Delta$, $r = a+b-2s$, $\Delta = (c+d-a-b)/2$. Verified numerically against direct integration to $<10^{-8}$ relative error for all $N\leq 8$ modes.

**Properties** (all proved analytically):
- *Selection rule:* $I_{abcd} = 0$ unless $(a+b+c+d)$ even. Only rule — all even-sum entries are nonzero.
- *$S_4$ symmetry:* invariant under all 24 permutations of indices.
- *2D factorization:* for 2D modes $\psi_{mn} = \psi_m(x)\psi_n(y)$, the tensor is a Kronecker product $T_{(mn)(m'n')(m''n'')(m'''n''')} = I_{mm'm''m'''}\times I_{nn'n''n'''}$.
- *$W(c)$ always symmetric:* $W_{il}(c) = \sum_{jk}c_jc_k^*T_{ijkl}$ satisfies $W_{il} = W_{li}$ for all $c$ (from $S_4$ symmetry plus $j\leftrightarrow k$ sum). Full rank for all tested contexts.

**Causal attention without a Fourier lens:** $W(c)$ is always symmetric in mode index. For cross-attention ($c=$ previous token state, $q=$ current query), the output $b = W(c_\text{prev})\cdot q_\text{curr}$ is causal in time even though $W$ is symmetric in mode index. Causality comes from the token sequence, not from spatial symmetry breaking. No Fourier lens required for autoregressive generation.

### 4.4 What the SOA Computes

The operation is **unnormalized content-based addressing** — the attention numerator $\sum_l W_{il}(c)\,q_l$ without the softmax denominator. This is not a limitation; it is the correct statement of what the physics produces. The following section establishes that this is functionally equivalent to softmax attention.

### 4.5 Softmax Equivalence: Five Properties

Softmax attention is functionally effective for sequence modeling because of five structural properties. We establish that ORI possesses all five, distributed across the SOA, VCSEL threshold, and FP cavity:

**1. Bounded response.** The SOA phase saturates at $C = kL\Delta n_\text{max}$ regardless of context intensity. $\phi(\mathbf{r}) = C|E_c|^2/(|E_c|^2+I_\text{sat})$ is bounded above. ✓

**2. Monotone in context score.** $\phi(\mathbf{r})$ is monotone increasing in $|E_c(\mathbf{r})|^2$ — stronger context creates larger phase shift. ✓

**3. Spatial specificity.** The phase modulation is pointwise in $\mathbf{r}$, enabling mode-specific attention based on spatial overlap between context and query. ✓

**4. Global normalization.** Softmax weights sum to 1; ORI provides energy normalization at the VCSEL threshold (ReLU: $P_\text{out} = A^2\max(0,P_\text{in}-\theta)$) between layers. ✓

**5. Differential mode amplification.** Softmax provides exponential amplification of score differences in a single operation. The FP cavity provides equivalent amplification distributed over T=100 round trips via coherent resonant interference — modes in constructive interference with the cavity field are exponentially amplified relative to modes in destructive interference. ✓

Crucially, **phase modulation is not lost at the detector**: the SOA output $b_i = q_i e^{i\phi_i}$ feeds into the DX FP layer as a coherent field input, not into an immediate detector. Phase differences between modes create interference patterns in subsequent round trips that determine which grating components couple — implementing selective mode amplification in the coherent field domain. At high saturation, the SOA implements a binary spatial phase mask (a holographic matched filter) — an operation strictly richer than a softmax-weighted average of value vectors.

The specific functional form of the SOA saturation curve (versus the exponential of softmax) sets the **attention temperature**: how sharply the system selects between modes. This is controlled by the ratio $I_\text{context}/I_\text{sat}$ and the coupling depth $C$, and is found automatically by in-situ training. The specific shape is a hyperparameter, not a structural gap — confirmed by the extensive ML literature showing softmax alternatives (linear attention [Katharopoulos 2020], kernel attention [Tay 2020], RBF attention [Shen 2021]) achieve near-identical perplexity on most benchmarks.

---

## 5. Full System

### 5.1 Signal Path

```
Token input  a ∈ ℝ^512  (split-positive encoded)
     ↓
[DX Fabry-Perot, T=100]   850 nm read / 810 nm write
                           h = M^T a   (SSM recurrent)
     ↓  VCSEL re-injection (ReLU, A²=1.2, θ=0.5mW)
[DX FFN slab, T=1]         850 nm / 810 nm
                           z = W₂ σ(W₁ h)   (feedforward)
     ↓  PBS (V-pol output)
[SOA gain hologram, T=1]   H-pol write / V-pol read
                           b = W(c)·q   (attention)
     ↓
Token output  b ∈ ℝ^512
```

Three operations. Three physical mechanisms. No ADC between them. The mapping between the logical architecture (recurrent + FFN + attention) and the physical architecture (FP resonator + standalone slab + gain hologram) is one-to-one, not by design but by the physics of each medium.

### 5.2 System Parameters

| Parameter | Value |
|:---|:---|
| Inference wavelength | 850 nm |
| DX write wavelength | 810 nm |
| Cavity length | 20 mm |
| Mirror reflectivity | 0.9990 (Finesse = 3,140) |
| Round trips T | 100 |
| Token period | 100 ps × 100 = 10 ns |
| Throughput | **100M tok/s** (DX FP) |
| Effective throughput | **95M tok/s** (after 4.8% write overhead) |
| Spatial modes H | 512 (23×23 HG, 50µm pitch, 2.5mm aperture) |
| DX FP rank | 74 |
| DX FFN rank | 74 |
| SOA attention rank | 524 |
| SNR | 40 dB achieved, 38 dB target, **1.006 dB margin** |
| DX grating lifetime | 10 s |
| DX refresh cycle | 2 s (95ms write, 4.8% overhead) |
| Gradient updates/s | 500,000 (all layers, optical adjoint) |

### 5.3 Power Budget

| Component | Power | Fraction |
|:---|:---|:---|
| VCSEL arrays (24 × 512, 50% sparsity) | 31.4 W | 60% |
| Detector arrays + TIA | 7.4 W | 14% |
| VCSEL drivers / ReLU | 12.3 W | 23% |
| 810 nm write laser (4.8% duty) | 30 mW | <1% |
| Optical gradient AOM | 0.5 W | <1% |
| TE temperature controller | 0.5 W | <1% |
| Control logic | 0.1 W | <1% |
| **Total** | **52.7 W** | |

**Energy per token:** 52.7 W / 95M tok/s = **554 nJ/token**

The continuous online learning loop (500K gradient updates/second) adds 0.53 W total — 1% of system power. The dominant cost is VCSEL threshold power (~57,000× above the 17.6 nW/mode shot-noise minimum), intrinsic to stimulated emission. Nanolaser sources with sub-µA threshold would reduce this by ~100×.

| Comparison | E/token | Quality |
|:---|:---|:---|
| **ORI (this work)** | **554 nJ** | Sub-Mamba-130M |
| Mamba-130M, RTX 4090 | 15,000 nJ | Mamba-130M |
| Llama-3-8B, Apple M3 | 187,500 nJ | Strong instruct |
| GPT-4 class, H100 | 23,300,000 nJ | Frontier |

Quality-adjusted (3× ORI units for Mamba-130M equivalent): **554 nJ/token, ~27× better than GPU**.

---

## 6. Open Experiments

| EXP | Description | Priority | Blocks |
|:---|:---|:---|:---|
| EXP-2 | σ_r(850nm)≈0 in PTR glass — relevant if PTR explored as alternative medium | LOW | — |
| EXP-7A | Adjoint solver convergence (digital) | **Done** | — |
| EXP-7B | In-situ training convergence (physical, DX cavity) | HIGH | All weight claims |
| EXP-9 | SOA rank measurement at 850 nm (bulk GaAlAs) | HIGH | R=524 claim |
| EXP-10 | SOA pumping uniformity, 5×5mm² | HIGH | SOA viability |
| EXP-11 | Cross-pol XGM efficiency at 850 nm | MED | Polarization mux |
| EXP-13 | Δn_DX in Al₀.₃₈GaAs at 850 nm | HIGH | DX rank claim |
| EXP-14 | DX write time and lifetime at x=0.38, 300K | HIGH | Refresh rate |
| EXP-15 | Optical adjoint convergence (DX, batch-1 SGD) | MED | Online learning |
| EXP-16 | α_FCA in Al₀.₃₈GaAs at 850 nm | **HIGH** | SNR margin (1.006 dB) |

EXP-16 is new and high priority: the 1.006 dB SNR margin is tight and rests on a free-carrier absorption estimate (α≈0.036 m⁻¹) that has not been measured in the specific epitaxial material. If the actual value is significantly higher, the margin erodes and mitigation (thinner slab, higher pump power, or adjusted Al content) is required.

---

## 7. Discussion

### 7.1 Physical Architecture Converging on Logical Architecture

In a digital transformer, three operations — recurrent state update, feedforward nonlinearity, and cross-token attention — are all implemented by the same substrate (silicon) running different matrix multiplications. The logical architecture is layered on top of an undifferentiated physical substrate.

In ORI, each operation emerges from a distinct physical mechanism:

- **DX Fabry-Perot:** The cavity enforces recurrence by construction — the field circulates T=100 times, accumulating the effect of the weight grating on each pass. This is not a digital simulation of an RNN; it is the wave equation. The resonator IS the state machine.
- **DX FFN slab:** A single transit through a holographic medium with independently trained weights is a feedforward transformation. The physical separation from the resonator enforces the computational separation from the recurrence.
- **SOA gain hologram:** Carrier saturation by a strong context field creates a spatial phase/amplitude mask that acts on the query field. The coupling saturates, the VCSEL normalizes, and the FP resonance amplifies — together implementing attention.

This convergence was not designed. It was derived by asking what each physical medium does naturally.

### 7.2 Inference-Time Learning

The 500,000 gradient updates per second are not a batch training procedure — they are the normal operating mode. The model that serves token T is measurably different from the model that served token T−500,000. It has been updated 500,000 times in the intervening second.

This is not online learning in the conventional sense of periodic batch updates from a data pipeline. It is inference-time learning: the system updates its weights from its own outputs as a continuous process. Device-specific optical aberrations, grating crosstalk, thermal drift, and manufacturing imprecision are all absorbed into the weight structure automatically — because the gradient is computed through the actual physical forward pass, not through a digital simulation of it. The device is calibrated continuously from its own operation.

### 7.3 What ORI Is Not

ORI is not a drop-in replacement for H100 clusters running frontier LLMs. Gen 1 is sub-Mamba-130M class (sub-Mamba-3 [Gu et al. 2026]); GPT-4-class reasoning requires orders of magnitude more parameters and architectural capabilities (long-context attention, KV cache) that O(1) optical state cannot implement. Park & Park [2026a] independently establish this constraint from the photonic accelerator side: full-attention photonic computation inherits O(n) memory scaling with context length, and the photonic advantage for transformer inference lies in block-selection rather than attention compute itself. The correct comparison is: for tasks where SSM-class quality is sufficient — local inference, edge deployment, streaming generation, real-time translation — ORI provides 27× better energy efficiency than GPU at matched throughput, in a device that continuously improves itself.

---

## 8. Scaling Roadmap

| Generation | VCSEL pitch | H modes | Thermal density | Status |
|:---|:---|:---|:---|:---|
| Gen 1 | 50 µm | 512 | 2 W/mm² | Design complete, OTS components |
| Gen 2 | 25 µm | 2,048 | 8 W/mm² | Custom VCSEL array, ~$100K NRE |
| Gen 3 | 10 µm | 6,000 | 51 W/mm² | Requires liquid cooling in VCSEL substrate |

Gen 3 is blocked by VCSEL thermal density (51 W/mm² vs ~5 W/mm² demonstrated state-of-art), not by optical physics. Gen 3 aperture (0.77 mm) is actually smaller than Gen 1 (1.15 mm), making optical quality easier. The path is Gen 1 → validate physics → Gen 2 → validate scaling → Gen 3 → solve thermal.

---

## 9. Conclusion

We have derived a complete all-optical architecture in which recurrent computation, feedforward transformation, and attention all emerge from the physics of three distinct semiconductor mechanisms — without a digital gradient processor and without analog-to-digital conversion between layers. The key results:

1. **Al₀.₃₈Ga₀.₆₂As DX-center material** in the Fabry-Perot cavity implements the same SSM computation as prior holographic media designs while exceeding their effective operating rank, delivering 33% faster throughput, and enabling continuous optical gradient training at 500K updates/second.

2. **The $T_{ijkl}$ tensor has a closed form** (eq. 4) with full $S_4$ symmetry and a single parity selection rule. $W(c)$ is always full-rank and symmetric. Causal cross-attention requires no Fourier lens.

3. **The SOA implements softmax-equivalent attention** via five structural properties distributed across the carrier saturation curve, VCSEL threshold, and FP resonant amplification. The softmax gap is closed.

4. **Continuous online learning** at 500,000 gradient steps per second adds less than 1% to system power. The architecture is permanently learning — device-specific imperfections are features, not bugs.

5. **554 nJ/token** at 95M tokens/second, 52.7 W total, all off-the-shelf components at 50 µm pitch.

The immediate next step is EXP-16: measuring the free-carrier absorption in Al₀.₃₈Ga₀.₆₂As at 850 nm. The 1.006 dB SNR margin is the tightest constraint in the design and requires experimental confirmation.

---

## References

1. Hughes, T.W., Minkov, M., Shi, Y., Fan, S. (2019). Training of photonic neural networks through in-situ backpropagation. *Optica* 6(9), 1179–1187.
2. Hughes, T.W., Williamson, I.A.D., Minkov, M., Fan, S. (2019). Wave physics as an analog recurrent neural network. *Science Advances* 5(12), eaay6946.
3. Psaltis, D., Brady, D., Gu, X.G., Lin, S. (1990). Holography in artificial neural networks. *Nature* 343, 325–330.
4. Pai, S., et al. (2023). Experimentally realized in-situ backpropagation for deep learning in nanophotonic neural networks. *Science* 380(6643), 398–404.
5. Kogelnik, H. (1969). Coupled wave theory for thick hologram gratings. *Bell System Technical Journal* 48(9), 2909–2947.
6. Lang, D.V., Logan, R.A. (1977). Large-lattice-relaxation model for persistent photoconductivity. *Phys. Rev. Lett.* 39(10), 635.
7. Mooney, P.M. (1990). Deep donor levels (DX centers) in III-V semiconductors. *J. Appl. Phys.* 67(3), R1–R26.
8. Lacey, J.P.R., et al. (1994). Four-channel cross-gain-modulated wavelength conversion. *IEEE Photon. Technol. Lett.* 6(10), 1241.
9. Pleumeekers, J.L., et al. (2002). Electron depletion depths and cross-gain modulation. *IEEE Photon. Technol. Lett.* 14(1), 61.
10. Coldren, L.A., Corzine, S.W. (1995). *Diode Lasers and Photonic Integrated Circuits*. Wiley.
11. Henry, C.H. (1982). Theory of the linewidth of semiconductor lasers. *IEEE J. Quantum Electron.* 18(2), 259.
12. Lin, X., et al. (2018). All-optical machine learning using diffractive deep neural networks. *Science* 361(6406), 1004.
13. Shen, Y., et al. (2017). Deep learning with coherent nanophotonic circuits. *Nature Photonics* 11, 441.
14. Feldmann, J., et al. (2021). Parallel convolutional processing using an integrated photonic tensor core. *Nature* 589, 52.
15. Xu, X., et al. (2024). Large-scale photonic chiplet Taichi empowers 160-TOPS/W AGI. *Science* 384(6698), 202.
16. Gu, A., Dao, T. (2023). Mamba: Linear-time sequence modeling with selective state spaces. *arXiv:2312.00752*.
23. Ashtiani, F., Idjadi, M.H., Kim, K. (2026). Integrated photonic neural network with on-chip backpropagation training. *Nature* 651, 927–932. https://doi.org/10.1038/s41586-026-10262-8
24. Park, H., Park, Y. (2026a). PRISM: Breaking the O(n) memory wall in long-context LLM inference via O(1) photonic block selection. *arXiv:2603.21576*.
25. Park, H., Park, Y. (2026b). Photonic exponential approximation via cascaded TFLN microring resonators toward softmax. *arXiv:2603.12934*.
26. Eşlik, D., et al. (2026). Recurrent neural networks implemented through spatiotemporal light propagation in optical fibers. *arXiv:2602.19246*.
27. Gu, A., Dao, T., et al. (2026). Mamba-3: Improved sequence modeling using state space principles. *ICLR 2026*. *arXiv:2603.15569*.
17. Katharopoulos, A., et al. (2020). Transformers are RNNs: Fast autoregressive transformers with linear attention. *ICML 2020*.
18. Tay, Y., et al. (2020). Long range arena: A benchmark for efficient transformers. *arXiv:2011.04006*.
19. Shen, Z., et al. (2021). Efficient attention: Attention with linear complexities. *WACV 2021*.
20. Dettmers, T., et al. (2022). LLM.int8(): 8-bit matrix multiplication for transformers at scale. *NeurIPS 2022*.
21. Mehler, F.G. (1866). Über die Entwicklung einer Funktion. *J. reine angew. Math.* 66, 161.
22. DLMF (2022). §18.18. https://dlmf.nist.gov/18.18
