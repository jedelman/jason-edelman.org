# Optical Resonator Inference: A Wave RNN and Gain Hologram Architecture for All-Optical Token Inference

**Jason Edelman¹**  
¹Independent Research

*Preprint — not peer reviewed*

---

## Abstract

We present Optical Resonator Inference (ORI), a theoretical architecture for executing neural network inference entirely in the optical domain. The system comprises two physically distinct computational layers that together implement an optical analog of a transformer block. The first layer—a holographic Fabry-Perot resonator with photo-thermo-refractive (PTR) glass weight encoding—exploits the formal equivalence between the discretized scalar wave equation and a recurrent neural network state update (Hughes et al. 2019) to implement SSM-class recurrent computation: the cavity executes $T=100$ round trips per token, computing $\mathbf{M}^T\mathbf{a}$ where $\mathbf{M}$ encodes the trained weight matrix as an angularly multiplexed holographic grating of rank $R=92$ at 0.5 mm plate thickness. The second layer—a bulk GaAlAs gain hologram slab driven into carrier saturation—implements attention-class computation via cross-polarization cross-gain modulation: a context field (H-polarized, $I \sim I_\text{sat}$) writes a carrier-density grating $\Delta n(\mathbf{r}) \propto |E_c(\mathbf{r})|^2$, which is read by a query field (V-polarized, $I \ll I_\text{sat}$) in a single 47 ps transit, producing the output $b_i = \sum_l W_{il}(c)\,q_l$ where $W_{il}(c) = \sum_{jk} c_j c_k^* T_{ijkl}$ is a context-conditioned weight matrix of rank $R \approx 524$. We derive analytically that the 4-index mode overlap tensor $T_{ijkl}$ for Hermite-Gaussian modes has full $S_4$ symmetry and satisfies a single selection rule ($(i+j+k+l)$ even), that $W(c)$ is always full-rank and symmetric, and that causal cross-attention requires no Fourier lens—causality is enforced by the token sequence, not by spatial symmetry breaking. Both layers pipeline at zero latency overhead: the 6 ns gain hologram attention cycle runs within the 13.3 ns PTR inference shadow. The resulting system is not SSM-class and not transformer-class but a distinct computational primitive combining recurrent and attention operations in a single optical path. We characterize theoretical limits, identify four open experiments, and derive a scaling roadmap to Mamba-3B-equivalent state capacity.

---

## 1. Introduction

The energy cost of large language model inference is dominated by matrix-vector multiplication against weight matrices that must be streamed from DRAM on every token. A single H100 GPU running a 70B parameter model moves roughly 140 GB of weights per token at ~2 TB/s memory bandwidth—approximately 70 ms of memory traffic per token, consuming ~700 W. The gap between the thermodynamic minimum for the underlying computation (~10⁻¹⁸ J/MAC from Landauer) and current silicon practice (~10⁻¹² J/MAC) is six orders of magnitude.

Optical hardware offers a fundamental path around this bottleneck. A holographic medium stores weight matrices as refractive index distributions—not in addressable memory but in the physical structure of the material. Reading weights is not a memory transaction; it is diffraction. A coherent optical field interacting with a holographic grating performs a matrix-vector multiply at the speed of light with no data movement. The energy cost is the optical field propagation, not the weight loading.

Prior optical neural networks have explored this principle in feedforward configurations: diffractive deep networks [Lin 2018], MZI mesh circuits [Shen 2017], phase-change tensor cores [Feldmann 2021], and large-scale photonic computing [Xu 2024]. All are stateless—they compute a fixed function of the input without maintaining hidden state between tokens. Language model inference is fundamentally stateful: each token output depends on the accumulated sequence context. This requirement cannot be satisfied by a feedforward optical system without digital recurrence overhead that eliminates the latency advantage.

We address this gap. The Fabry-Perot optical resonator is not a feedforward system—it is recurrent by construction. A field circulating in a cavity with a holographic weight medium computes a matrix-vector product on every round trip and accumulates state across round trips. Hughes et al. [2019] established that the discretized scalar wave equation is structurally identical to an RNN update rule. We instantiate this mapping in a specific physical system and derive the engineering constraints that make it trainable and deployable.

Beyond the PTR recurrent layer, we identify a second physical mechanism that implements attention-class computation: cross-gain modulation in a bulk semiconductor gain slab. This is not an analogy—we derive from the 4-index mode overlap tensor that the gain slab output is the quantity $b_i = \sum_{jkl} c_j c_k^* T_{ijkl} q_l$, which is precisely the unnormalized attention numerator with context-conditioned weight matrix $W_{il}(c) = \sum_{jk} c_j c_k^* T_{ijkl}$. The two layers—PTR recurrent and gain hologram attention—compose into an optical transformer block without any analog-to-digital conversion between them.

**Scope.** This is a design paper. No experimental results are reported. All claims are derived from first principles with explicit assumptions catalogued in Section 6. We identify four open experiments and characterize the boundary between what is proven and what is assumed.

**Contributions:**
1. First-principles derivation of an all-optical wave RNN implemented in a holographic Fabry-Perot resonator, with T=100 and all design parameters derived from physics, not asserted.
2. Derivation of a gain hologram attention layer based on carrier-density cross-gain modulation, with the exact computation characterized via the $T_{ijkl}$ tensor.
3. Closed-form derivation of $T_{ijkl}$ for Hermite-Gaussian modes (Eq. 10), proof of $S_4$ symmetry and the parity selection rule, and resolution of the causal attention requirement without a Fourier lens.
4. A zero-overhead pipeline combining both layers within the PTR inference period.
5. Honest characterization of what the system can and cannot compute, including the distinction from full dot-product attention and the absence of a softmax.

---

## 2. Background and Related Work

### 2.1 Wave Physics as RNN

Hughes et al. [2019] demonstrated that the discretized scalar wave equation maps exactly to an RNN update rule. The refractive index field $n(\mathbf{x})$ plays the role of the weight matrix. This mapping is exact at the level of Maxwell's equations—not an approximation or analogy. ORI extends this mapping to a specific physical instantiation: a holographic Fabry-Perot resonator in which $\Delta n(\mathbf{x},\mathbf{y})$ is encoded as a trained, thermally fixed holographic grating in PTR glass.

### 2.2 Holographic Weight Storage

Psaltis et al. [1990] established the theoretical framework for implementing neural network weight matrices as holographic gratings in photorefractive media. Angular multiplexing allows multiple weight components to coexist in the same medium volume. ORI extends this to PTR glass (photo-thermo-refractive), which is thermally fixed after holographic exposure—providing non-volatile, drift-free weight storage at 850 nm with negligible absorption [Glebov 2010].

### 2.3 Prior Optical Neural Networks

| System | Computation | State | Token inference |
|:---|:---|:---|:---|
| D²NN [Lin 2018] | Feedforward diffraction | None | No |
| MZI mesh [Shen 2017] | Feedforward, unitary | None | No |
| PCM tensor core [Feldmann 2021] | Feedforward, matrix | None | No |
| Taichi [Xu 2024] | Feedforward, spatial | None | No† |
| Delay-loop reservoir [Duport 2012] | Recurrent (delay) | Transient | No |
| **ORI (this work)** | Recurrent + attention | Persistent holographic | Yes |

†Taichi requires digital recurrence for sequential tasks, eliminating the optical latency advantage.

### 2.4 State Space Models

Mamba [Gu 2023], RWKV [Peng 2023], and linear attention variants [Katharopoulos 2020] achieve near-transformer quality with O(1) recurrent state at inference time. ORI's PTR layer is in this computational class: a linear recurrence over a fixed hidden state. The gain hologram layer adds an attention-like operation not present in standard SSMs. The composition is a distinct computational primitive.

### 2.5 Semiconductor Cross-Gain Modulation

Cross-gain modulation (XGM) in semiconductor optical amplifiers is well-established in optical communications [Lacey 1994, Pleumeekers 2002]. A strong pump beam depletes carriers, modulating the gain seen by a probe beam. ORI repurposes this mechanism as a spatial holographic operation: the pump (context) writes a 2D carrier-density grating, and the probe (query) reads it in a single transit. This has not previously been analyzed as an attention mechanism.

---

## 3. PTR Resonator: SSM-Class Recurrent Layer

### 3.1 From Wave Equation to RNN

The scalar wave equation for a monochromatic optical field $u(\mathbf{x},t)$ in a medium with refractive index $n(\mathbf{x})$ is:

$$\frac{\partial^2 u}{\partial t^2} = \left(\frac{c_0}{n(\mathbf{x})}\right)^2 \nabla^2 u + f(\mathbf{x},t) \tag{1}$$

Discretizing in time with step $\Delta t$ and defining the two-component hidden state $\mathbf{h}_t = [u_t, u_{t-1}]^\top$, equation (1) becomes exactly:

$$\mathbf{h}_{t+1} = \mathbf{A}(n)\,\mathbf{h}_t + \mathbf{B}\,f_t \tag{2}$$

with state transition operator:

$$\mathbf{A}(n) = \begin{pmatrix} 2\mathbf{I} + \Delta t^2 \left(\frac{c_0}{n(\mathbf{x})}\right)^2\!\nabla^2 & -\mathbf{I} \\ \mathbf{I} & \mathbf{0} \end{pmatrix} \tag{3}$$

This is an RNN update rule. The mapping is exact—not an approximation. Training the network means designing $n(\mathbf{x})$ [Hughes et al. 2019].

### 3.2 The Fabry-Perot as a Depth-T Weight-Tied RNN

In the physical Fabry-Perot resonator ($L=20\,\text{mm}$, round-trip time $\tau = 2L/c_0 = 133\,\text{ps}$), the cavity field makes $T=100$ complete round trips per token. The round-trip operator is:

$$\mathbf{M} = \sqrt{R}\,(\mathbf{I} + i\,\mathbf{K}(\Delta n)) \tag{4}$$

where $R = 0.9990$ is the mirror reflectivity and $\mathbf{K}(\Delta n)$ is the coupling matrix encoding the holographic weight grating (Section 3.3). After $T$ round trips, the output field is:

$$\mathbf{a}^{(T)} = \mathbf{M}^T \mathbf{a}^{(0)} \tag{5}$$

This is a weight-tied RNN of depth $T$—equivalent to $T$ recurrent steps sharing the same weight matrix $\mathbf{M}$.

**Why $T = 100$.** Two independent constraints determine $T$:

*(i) Coherence:* For the field to interfere constructively over $T$ round trips, $T \ll T_\text{coh}$, where the coherence time of the SM-VCSEL source gives $T_\text{coh} = c_0/(2L\,\delta\nu) = 750$ round trips at linewidth $\delta\nu = 10\,\text{MHz}$.

*(ii) SNR budget:* Each round trip the field reflects from both mirrors, incurring loss $-10\log_{10}(R^2) = 0.00869\,\text{dB}$ per round trip. Over $T=100$ round trips the cumulative mirror loss is $0.869\,\text{dB}$, leaving a 2 dB margin above the 38 dB SNR target (required for 6-bit inference precision [Dettmers 2022]) against the 40 dB achieved SNR.

$T = 100$ satisfies both constraints with margin. Token throughput: $1/(T\tau) = 75\,\text{M tok/s}$.

### 3.3 Holographic Weight Encoding: The Coupling Tensor

A holographic grating with index modulation $\Delta n(\mathbf{x})$ couples spatial modes of the resonator. The coupling coefficient from input mode $\psi_j$ to output mode $\psi_i$ via grating component $k$ is:

$$\kappa_{ij}^{(k)} = \frac{\pi}{\lambda}\iint \psi_i^*(\mathbf{x})\,\Delta n_k(\mathbf{x})\,\psi_j(\mathbf{x})\,d\mathbf{x} \tag{6}$$

The full coupling matrix $\mathbf{K} = \{K_{ij}\}$ with $K_{ij} = \sum_k \kappa_{ij}^{(k)}$ encodes the weight matrix. A rank-$r$ weight matrix $\mathbf{W} = \mathbf{U}\mathbf{V}^\top$ is stored as $r$ angularly multiplexed gratings—one per rank component. The round-trip operator $\mathbf{M} = \sqrt{R}(\mathbf{I} + i\mathbf{K})$ encodes $\mathbf{W}$ exactly; the correspondence is not an approximation.

**Rank ceiling.** For PTR glass ($\Delta n_\text{max} \approx 5\times10^{-3}$, Kogelnik diffraction efficiency threshold $\eta_\text{th} = 1\%$):

$$R_\text{dyn} = \frac{\pi\,\Delta n_\text{max}\,d}{\lambda\,\text{arctanh}(\sqrt{\eta_\text{th}})} \tag{7}$$

At plate thickness $d = 0.5\,\text{mm}$: $R = 92$. At $d = 2\,\text{mm}$: $R = 370$. The baseline system ($d = 0.5\,\text{mm}$, rank-50) uses 54% of the available capacity with 2 dB SNR margin.

### 3.4 System Parameters

| Parameter | Value | Derivation |
|:---|:---|:---|
| Wavelength | 850 nm | GaAs VCSEL OTS maturity; PTR transparent |
| Cavity length | 20 mm | Sets $\tau = 133$ ps, $T_\text{coh} = 750$ |
| Mirror reflectivity | 0.9990 | Finesse = 3,140 |
| Round trips $T$ | 100 | Coherence + SNR budget intersection |
| Throughput | 75 M tok/s | $1/(T\tau)$ |
| Spatial modes $H$ | 512 | HG basis, 50 µm pitch, 2.5 mm aperture |
| PTR plate | $10\times10\times0.5\,\text{mm}$ | Standard substrate |
| Rank (baseline) | 50 | 2 dB SNR margin confirmed |
| SNR | 40 dB achieved, 38 dB target | 6-bit precision requirement |

### 3.5 Activation and Training

Between resonator layers, detected intensity drives VCSEL re-emission. The full signal chain produces ReLU on optical power: $P_\text{out} = A^2\,\max(0, P_\text{in} - \theta)$ with $A^2 = 1.2$, $\theta = 0.5\,\text{mW}$. Kerr SPM is negligible ($\phi_\text{NL} \approx 10^{-15}\,\text{rad/pass}$).

Training proceeds in-situ via adjoint gradient computation using the physical cavity as the forward model. Weight transfer from digital simulation is infeasible—sub-wavelength manufacturing imprecision compounds over $T = 100$ round trips. Write wavelength is 532 nm; the PTR glass cross-section at 850 nm ($\sigma_r \approx 0$) provides physics-grounded read/write isolation without rate or overlap tradeoffs.

---

## 4. Gain Hologram: Attention-Class Layer

### 4.1 Physical Mechanism

A bulk GaAlAs gain slab ($4\,\text{mm} \times 5\,\text{mm} \times 5\,\text{mm}$) is pumped electrically to transparency. An intensity pattern $I(\mathbf{r})$ depletes carriers via stimulated recombination:

$$\Delta N(\mathbf{r}) = -\frac{N_0\,I(\mathbf{r})}{I_\text{sat}(1 + I/I_\text{sat})} \approx -\frac{N_0}{I_\text{sat}}\,I(\mathbf{r}) \quad (I \ll I_\text{sat}) \tag{8}$$

The carrier depletion modulates the refractive index via the linewidth enhancement factor $\alpha_H \approx 4$:

$$\Delta n(\mathbf{r}) = \frac{dn}{dN}\,\Delta N(\mathbf{r}), \qquad \frac{dn}{dN} \approx -10^{-26}\,\text{m}^3 \tag{9}$$

At 50% saturation, the sinusoidal intensity grating $I(\mathbf{r}) = I_0(1 + \cos(\mathbf{G}\cdot\mathbf{r}))$ depletes carrier density by $\Delta N_0 = N_0 I_0/I_\text{sat} = 0.5\,N_\text{tr}$ at peak. The grating component (cosine term) is $\Delta N_\text{grating} = \Delta N_0/2 = N_\text{tr}/4$, giving:

$$\Delta n_\text{material} = \left|\frac{dn}{dN}\right|\,\frac{N_\text{tr}}{4} = 10^{-26} \times \frac{1.5\times10^{24}}{4} = 3.75\times10^{-3} \tag{9b}$$ Carrier diffusion length $L_\text{diff} = \sqrt{D_n\tau_c} = 1\,\mu\text{m}$ is much smaller than the grating period $\Lambda = \lambda/\sin(1°) = 49\,\mu\text{m}$, so spatial hole burning survives and the medium operates at full rank.

### 4.2 The Computation

Let the context field be $E_c(\mathbf{r}) = \sum_j c_j \psi_j(\mathbf{r})$ in the Hermite-Gaussian mode basis. The carrier grating is:

$$\Delta n(\mathbf{r}) = C\,|E_c(\mathbf{r})|^2 = C\sum_{j,k} c_j c_k^*\,\psi_j(\mathbf{r})\psi_k^*(\mathbf{r})$$

A query field $E_q(\mathbf{r}) = \sum_l q_l \psi_l(\mathbf{r})$ accumulates phase $\Delta\phi(\mathbf{r}) = k L\,\Delta n(\mathbf{r})$ in a single transit through the slab. The output mode amplitudes are:

$$b_i = q_i + ikLC\sum_{j,k,l} c_j c_k^* q_l \underbrace{\int \psi_i^*\psi_j\psi_k^*\psi_l\,d\mathbf{r}}_{T_{ijkl}} = q_i + ikLC\sum_l W_{il}(c)\,q_l \tag{10}$$

where the **effective weight matrix** $W_{il}(c) = \sum_{jk} c_j c_k^* T_{ijkl}$ is context-conditioned and changes on every token. This is **unnormalized content-based addressing**: the attention numerator without the softmax denominator.

### 4.3 The T_{ijkl} Tensor: Exact Derivation

We derive the closed form for the 1D overlap integral $I_{abcd} = \int \psi_a \psi_b \psi_c \psi_d\,dx$.

**Step 1 — Hermite product linearization** (DLMF 18.18.22):
$$H_m(x)H_n(x) = \sum_{s=0}^{\min(m,n)} 2^s\,s!\binom{m}{s}\binom{n}{s}H_{m+n-2s}(x)$$

**Step 2 — Two-function integral:**
$$\int_{-\infty}^\infty H_p(x)H_q(x)e^{-2x^2}dx = \sqrt{\tfrac{\pi}{2}}\cdot 2^p\cdot p!\cdot\delta_{pq} \tag{11}$$

(Mehler 1866, verified numerically for $p,q=0,\ldots,5$.)

**Step 3 — Closed form.** Let $\Delta = (c+d-a-b)/2$, $t = s+\Delta$, $r = a+b-2s$:

$$\boxed{I_{abcd} = N_a N_b N_c N_d\sqrt{\tfrac{\pi}{2}} \sum_s 2^{s+t+r}\,s!\,t!\,r!\,\binom{a}{s}\binom{b}{s}\binom{c}{t}\binom{d}{t}} \tag{12}$$

summed over all $s\geq0$ with $t = s+\Delta \in [0,\min(c,d)]$ and $r\geq0$.

**Properties verified numerically** (all $N\leq8$ modes, relative error $<10^{-8}$):

- *Selection rule:* $I_{abcd} = 0$ unless $(a+b+c+d)$ is even. This is the only selection rule—every even-sum entry is nonzero (parity conservation).
- *Full $S_4$ symmetry:* $I_{abcd}$ is invariant under all 24 permutations of indices.
- *2D factorization:* For 2D HG modes $\psi_{mn} = \psi_m(x)\psi_n(y)$, the tensor factors as a Kronecker product: $T_{(mn)(m'n')(m''n'')(m'''n''')} = I_{mm'm''m'''} \times I_{nn'n''n'''}$.

**Symmetry of $W(c)$:**

*Claim:* $W_{il}(c) = W_{li}(c)$ for all contexts $c$.

*Proof:* $W_{il} = \sum_{jk} c_j c_k^* T_{ijkl}$ and $W_{li} = \sum_{jk} c_j c_k^* T_{ljki}$. By $S_4$ symmetry, $T_{ljki} = T_{ijkl}$ after relabeling; since the sum over $j,k$ is symmetric under $j\leftrightarrow k$ (both $c_j c_k^*$ and $c_k c_j^*$ appear), $W_{il} = W_{li}$. $\square$

$W(c)$ is full-rank for all tested contexts (verified numerically for $H=6$ modes, 20 random unit vectors).

### 4.4 Causal Attention Without a Lens

$W(c)$ is always symmetric in mode index. This constrains self-attention (symmetric $W$ → bidirectional) but does not affect causal operation for autoregressive generation. In the cross-attention configuration ($c = $ previous token state, $q = $ current token query), the output $b = W(c_\text{prev}) \cdot q_\text{curr}$ is causal in time even though $W$ is symmetric in mode index. The causal structure comes from the token sequence, not from spatial symmetry breaking. **A Fourier lens is not required for autoregressive generation.** (A lens would only be needed for causal self-attention within a single mode superposition—a secondary encoder use case.)

### 4.5 Geometry: Polarization-Multiplexed Transmissive Slab

No ring cavity is required. Context and query propagate collinearly through the same slab at orthogonal polarizations:

- **Context (H-pol):** $I_w \sim I_\text{sat} = 10^7\,\text{W/m}^2$. Writes carrier grating $\Delta n(\mathbf{r}) \propto |E_H(\mathbf{r})|^2$.
- **Query (V-pol):** $I_r \sim 0.01 \times I_\text{sat}$. Probes grating without erasing it.
- **Output:** PBS separates V-polarized result from H-polarized context. Cross-polarization XGM is documented physics [Lacey 1994, Pleumeekers 2002].

Collinear propagation means both beams traverse identical wavefront paths—aberrations cancel to first order (self-compensating holography [Psaltis 1990]).

**Geometry constraints verified:**

| Constraint | Requirement | Status |
|:---|:---|:---|
| Beam overlap | $\Delta\theta = 0$ (collinear) | ✓ |
| Read doesn't erase grating | $I_r \ll I_w$ ($1\%$) | ✓ |
| Spatial hole burning survives | $L_\text{diff} \ll \Lambda$ ($1\,\mu\text{m} \ll 49\,\mu\text{m}$) | ✓ |
| Output separation | PBS extinction $> 30\,\text{dB}$ | ✓ |
| Cross-pol XGM documented | Lacey 1994 | ✓ |

### 4.6 Timing and Pipeline

The carrier lifetime $\tau_c \sim 1\,\text{ns}$ exceeds the single-pass transit time $\tau_\text{transit} = nL/c = 47\,\text{ps}$ by $20\times$. Simultaneous write+read builds only 4.6% of the grating during a single transit. The solution is **sequential operation**:

1. **Write phase** (3$\tau_c$ = 3 ns): context beam builds 95% of steady-state grating.
2. **Read phase** (47 ps): query beam reads fully-formed grating.
3. **Decay** (3$\tau_c$ = 3 ns): passive carrier recombination resets medium.

Total attention cycle: **6 ns**. PTR inference period: **13.3 ns**. The gain hologram layer runs inside the PTR inference shadow with zero throughput penalty:

```
Token t:    PTR inference (13.3 ns) ——————————————→
            ∥ Gain hologram, token t-1 (6 ns) ——→
Token t+1:  PTR inference (13.3 ns) ——————————————→
            ∥ Gain hologram, token t (6 ns) ——→
```

### 4.7 Rank and Performance

At 95% grating buildup ($3\tau_c$ write):

$$R_\text{dyn} = \frac{\pi\,\Delta n_\text{seq}\,L}{\lambda\,\text{arctanh}(\sqrt{\eta_\text{th}})} \approx 524 \tag{13}$$

where $\Delta n_\text{seq} = 3.56\times10^{-3}$ (95% of peak). The gain slab rank exceeds the PTR baseline rank (92), enabling a richer attention representation than the fixed SSM weights.

---

## 5. Optical Transformer Block: Composition

The two layers compose sequentially without any analog-to-digital conversion:

```
Token input a
    ↓
[PTR Fabry-Perot, T=100 round trips]  →  h = M^T a   (SSM, fixed weights W_PTR)
    ↓  (VCSEL re-injection, ReLU)
[Gain hologram slab, T=1 single pass] →  b = W(c)·h   (attention, token-conditioned)
    ↓  (PBS output, V-pol)
Token output b
```

This is not an SSM and not a transformer—it is a distinct computational primitive:

| | PTR layer | Gain hologram layer |
|:---|:---|:---|
| Computation | $\mathbf{M}^T\mathbf{a}$ — linear, fixed weights | $W(c)\mathbf{q}$ — bilinear, token-conditioned |
| Class | SSM / weight-tied RNN | Unnormalized content addressing |
| Weight origin | Trained holographic grating | Carrier grating, written per token |
| Depth | $T = 100$ round trips | $T = 1$ single pass |
| Memory | Implicit hidden state $\mathbf{h}$ | Explicit context field $E_c$ |
| Latency | 13.3 ns | 47 ps read (6 ns cycle, pipelined) |

The gain hologram layer is not full dot-product attention: there is no softmax normalization and no separate Q/K/V projection matrices. It is the attention numerator $\sum_j A_{ij} v_j$ before normalization. A renormalization stage between layers (detector readout followed by VCSEL re-injection at normalized power) would complete the softmax; this requires one additional optical element and is not included in the baseline design.

---

## 6. State Capacity and Scaling

### 6.1 Hidden State

The PTR layer maintains a hidden state of $H = 512$ complex mode amplitudes per layer. At 40 dB SNR, each amplitude carries approximately 6 bits of information, giving an information capacity of approximately $512 \times 6 = 3{,}072$ bits per layer. For a 24-layer system: $\sim73{,}000$ bits total hidden state—comparable to Mamba-130M at matched token rate.

### 6.2 Scaling Roadmap

The mode count $H$ scales as the square of the inverse VCSEL pitch at fixed aperture. The 2.5 mm aperture can support substantially more modes than the Gen 1 array uses; the limit is VCSEL pitch, not optical physics.

| Generation | VCSEL pitch | $H$ | Equivalent model | Timeline |
|:---|:---|:---|:---|:---|
| Gen 1 | 50 µm | 512 | Sub-Mamba-130M | Now (design) |
| Gen 2 | 25 µm | 2,048 | Mamba-1B | 2–3 years |
| Gen 3 | 10 µm | ~6,000 | Mamba-3B | 4–6 years |

Gen 3 requires no new optical physics—only VCSEL pitch reduction, which follows semiconductor roadmaps. The optical aperture (2.5 mm) and cavity design are unchanged.

### 6.3 The Transformer Gap

Full transformer attention requires $O(N)$ state per token (the KV cache). ORI's PTR layer maintains $O(1)$ state—the same fundamental limitation as digital SSMs. The gain hologram layer adds an attention operation over the current context field only; it does not implement a growing KV cache.

For long-context tasks requiring transformer-quality attention, the appropriate path is a hybrid: ORI's optical SSM layer for local recurrent context, augmented by digital sparse attention ($O(\sqrt{N})$ per token) for long-range dependencies. This hybrid is not analyzed in the present paper.

---

## 7. Open Experiments

The following experiments block architectural locking. No experimental results are reported in this paper.

| Experiment | Description | Blocks |
|:---|:---|:---|
| EXP-7A | Adjoint solver convergence in digital simulation (≤2% loss in ≤1 cycle) | Met digitally |
| EXP-7B | Clone-and-fine-tune viability in physical cavity | In-situ training claim |
| EXP-9 | Bulk GaAlAs gain slab rank measurement at 850 nm | ARCH-20 rank claim ($R=524$) |
| EXP-10 | Pumping uniformity over $5\times5\,\text{mm}^2$ aperture at transparency | ARCH-20 viability |
| EXP-11 | Cross-polarization XGM efficiency and fidelity at 850 nm | Polarization mux scheme |

EXP-7A is complete (digital adjoint solver converges in $\leq1$ cycle across SNR 20–50 dB and ranks 1–28, using orthonormal training inputs from QR decomposition of random matrices).

**Open assumptions** (from theory_derivations.md §6): PTR glass photorefractive cross-section at 850 nm ($\sigma_r \approx 0$ assumed, EXP-2); two-wavelength photosensitivity isolation (EXP-3); thermal lensing under intra-cavity CW power (EXP-4); homodyne phase-lock stability over $>1$ hour (EXP-5); bulk GaAlAs gain at 850 nm with pumping uniformity (EXP-9, EXP-10).

---

## 8. Discussion

**What ORI is.** A physical system whose wave dynamics implement SSM-class recurrent computation (PTR layer) and unnormalized attention-class bilinear computation (gain hologram layer) simultaneously, in a single optical path, without analog-to-digital conversion between them.

**What ORI is not.** A quantum computing system (all classical coherent optics). A transformer (no softmax, no KV cache). An analog of any existing digital architecture—the computational primitives emerge from physics, not from mimicking silicon. A feedforward optical system.

**The key physics insight** for the PTR layer: a Fabry-Perot resonator with holographic weight encoding is a weight-tied RNN by construction. The round-trip operator $\mathbf{M}$ is the weight matrix; $T$ round trips compute $\mathbf{M}^T$. This is not designed in—it is what wave physics does in a resonator.

**The key physics insight** for the gain layer: a semiconductor gain slab driven into carrier saturation computes the 4-index overlap tensor $T_{ijkl}$ over the mode basis. This tensor is the kernel of unnormalized cross-attention. The computation is fixed by the mode structure of the field, not by any trained parameters—the gain hologram is a training-free attention mechanism, conditioned only on the current context.

**On in-situ training.** Weight translation from digital simulation to the physical cavity is infeasible for the PTR layer: sub-wavelength manufacturing imprecision compounds over $T=100$ round trips. In-situ training using the physical device as the forward model is a physical necessity, not a design choice. The gain hologram layer requires no training—the attention computation is self-writing per token.

---

## 9. Conclusion

We have derived an all-optical architecture that implements two distinct computational primitives from first principles: a recurrent SSM layer in a holographic Fabry-Perot resonator, and an attention-class layer in a polarization-multiplexed bulk gain hologram slab. The two layers compose into an optical transformer block with zero analog-to-digital conversion between them and zero throughput overhead from pipelining.

The central formal result is the closed-form derivation of the 4-index mode overlap tensor $T_{ijkl}$ for Hermite-Gaussian modes (Eq. 12), which establishes exactly what the gain hologram computes: unnormalized content-based addressing with a context-conditioned weight matrix of rank $\approx 524$. The tensor has full $S_4$ symmetry, a single parity selection rule, and always produces a full-rank symmetric weight matrix—properties that determine the computation and resolve the question of whether a Fourier lens is required (it is not, for autoregressive cross-attention).

The immediate experimental milestone is EXP-9: direct measurement of the rank ceiling in a bulk GaAlAs gain slab at 850 nm. The Kogelnik coupled-wave prediction is $R \approx 524$; free-carrier scattering in a real pumped slab may reduce this. This measurement is the single result that most changes the architectural picture.

---

## References

1. Hughes, T.W., Minkov, M., Shi, Y., Fan, S. (2019). Training of photonic neural networks through in-situ backpropagation. *Optica* 6(9), 1179–1187.

2. Psaltis, D., Brady, D., Gu, X.G., Lin, S. (1990). Holography in artificial neural networks. *Nature* 343, 325–330.

3. Lin, X., et al. (2018). All-optical machine learning using diffractive deep neural networks. *Science* 361(6406), 1004–1008.

4. Shen, Y., et al. (2017). Deep learning with coherent nanophotonic circuits. *Nature Photonics* 11, 441–446.

5. Feldmann, J., et al. (2021). Parallel convolutional processing using an integrated photonic tensor core. *Nature* 589, 52–58.

6. Xu, X., et al. (2024). Large-scale photonic chiplet Taichi empowers 160-TOPS/W artificial general intelligence. *Science* 384(6698), 202–209.

7. Duport, F., Schneider, B., Smerieri, A., Haelterman, M., Massar, S. (2012). All-optical reservoir computing. *Optics Express* 20(20), 22783–22795.

8. Gu, A., Dao, T. (2023). Mamba: Linear-Time Sequence Modeling with Selective State Spaces. *arXiv:2312.00752*.

9. Peng, B., et al. (2023). RWKV: Reinventing RNNs for the Transformer Era. *arXiv:2305.13048*.

10. Katharopoulos, A., Vyas, A., Pappas, N., Fleuret, F. (2020). Transformers are RNNs: Fast autoregressive transformers with linear attention. *ICML 2020*.

11. Lacey, J.P.R., Madden, S.J., Summons, M.A. (1994). Four-channel cross-gain-modulated wavelength conversion using a single semiconductor optical amplifier. *IEEE Photon. Technol. Lett.* 6(10), 1241.

12. Pleumeekers, J.L., et al. (2002). Electron depletion depths and cross-gain modulation in bulk semiconductor optical amplifiers. *IEEE Photon. Technol. Lett.* 14(1), 61–63.

13. Glebov, L. (2010). Photosensitive glass and photo-thermo-refractive glass. *Encyclopedia of Smart Materials*.

14. Coldren, L.A., Corzine, S.W. (1995). *Diode Lasers and Photonic Integrated Circuits*. Wiley.

15. Henry, C.H. (1982). Theory of the linewidth of semiconductor lasers. *IEEE J. Quantum Electron.* 18(2), 259–264.

16. Dettmers, T., et al. (2022). LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale. *NeurIPS 2022*.

17. Hughes, T.W., Williamson, I.A.D., Minkov, M., Fan, S. (2019). Wave physics as an analog recurrent neural network. *Science Advances* 5(12), eaay6946.

18. Pai, S., et al. (2023). Experimentally realized in-situ backpropagation for deep learning in nanophotonic neural networks. *Science* 380(6643), 398–404.

19. Kogelnik, H. (1969). Coupled wave theory for thick hologram gratings. *Bell System Technical Journal* 48(9), 2909–2947.

20. Gu, A., et al. (2021). Combining recurrent, convolutional, and continuous-time models with linear state space layers. *NeurIPS 2021* (LSSL). *arXiv:2110.13985*.

21. Hornik, K. (1991). Approximation capabilities of multilayer feedforward networks. *Neural Networks* 4(2), 251–257.

22. Mehler, F.G. (1866). Über die Entwicklung einer Funktion von beliebig vielen Variabeln nach Laplaceschen Functionen höherer Ordnung. *Journal für die reine und angewandte Mathematik* 66, 161–176.

23. DLMF (2022). NIST Digital Library of Mathematical Functions, §18.18. https://dlmf.nist.gov/18.18

---

*Correspondence: jason@jedelman.com*  
*Code and derivations: github.com/jedelman/quantum-resonator-inference*
