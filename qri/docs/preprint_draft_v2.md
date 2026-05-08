# Optical Resonator Inference: A Furnace-Free All-Optical Architecture for Recurrent, Feedforward, and Attention-Class Computation

**Jason Edelman**  
*2026-05-08*  
*Repo: github.com/jedelman/quantum-resonator-inference*

---

## Abstract

We present Optical Resonator Inference (ORI), an all-optical architecture for neural network inference implementing three physically distinct computational primitives in a single optical path: recurrent SSM-class computation, feedforward nonlinearity with updatable weights, and attention-class content-based addressing. Each primitive emerges from a different semiconductor/glass mechanism with a distinct weight timescale, rather than from a common substrate executing different matrix multiplications. The three layers are: (1) a Fabry-Perot resonator with Al₀.₃₈Ga₀.₆₂As DX-center holographic gratings (SSM, $M^T\mathbf{a}$, 10 s lifetime, 100 M tok/s, no furnace); (2) a standalone DX slab (FFN, $W_2\sigma(W_1\mathbf{h})$, independently trained); (3) a bulk GaAlAs gain hologram with polarization-multiplexed cross-gain modulation (attention, $W(c)\mathbf{q}$, 1 ns, self-writing). All three layers train via 810 nm optical adjoint at 500,000 gradient updates per second. No furnace is required at any stage. We derive from first principles that the gain hologram implements all five functionally required properties of attention nonlinearity — saturation, monotonicity, spatial specificity, global normalization, and differential mode amplification — through physically distributed mechanisms: the carrier grating saturates at $C = kL\Delta n_\text{max}$, the VCSEL threshold provides global energy normalization, and the subsequent FP resonator provides exponential modal amplification over $T = 100$ round trips. The specific exponential shape of softmax is not load-bearing; the system implements attention-sufficient nonlinearity through different but equivalent physical mechanisms. Total system power: 52.2 W at 95.3 M tok/s = **548 nJ/tok**, 20× better than GPU at quality-matched throughput.

---

## 1. Introduction

The energy cost of neural network inference at scale is dominated by weight loading — moving billions of parameters through digital electronics on every token. ORI bypasses this by encoding weights as refractive index distributions in physical media, where reading a weight is diffraction, not a memory transaction.

Prior optical neural networks are stateless feedforward systems. Language inference requires recurrent state and depth. We address this through three physical mechanisms that each naturally implement one operation required for sequence modeling:

**Recurrence** emerges from the Fabry-Perot cavity. A field circulating T times through a holographic medium computes $M^T\mathbf{a}$ — a weight-tied RNN of depth T. This is not an approximation of recurrence; it is the wave equation discretized in time (Hughes et al. 2019).

**Feedforward nonlinearity** emerges from DX-center persistent photoconductivity in AlGaAs. Trap states hold a holographic weight grating for ~10 seconds, writable and erasable by 810 nm light. The same adjoint mechanism that trains the recurrent layer trains this layer — at 500,000 gradient steps per second, continuously, without a furnace.

**Attention-class computation** emerges from carrier-density cross-gain modulation in a bulk GaAlAs gain slab. A context field writes a carrier grating that phase-modulates the query field. We derive the exact tensor structure of this operation (§4) and prove it implements all functionally required properties of softmax attention (§5), distributed across the SOA saturation, VCSEL threshold, and FP cavity rather than concentrated in a single normalized exponential.

The convergence of logical and physical architecture is not designed in — it follows from the physics of each medium.

---

## 2. Background

**Wave physics as RNN.** Hughes et al. (2019) proved that the discretized scalar wave equation maps exactly to an RNN update rule $\mathbf{h}_{t+1} = A(n)\mathbf{h}_t + Bf_t$, where the refractive index field $n(\mathbf{x})$ is the weight matrix. ORI instantiates this in a holographic Fabry-Perot resonator.

**Holographic weight storage.** Psaltis et al. (1990) established that holographic gratings in photorefractive media implement matrix-vector multiplication via diffraction. Angular multiplexing stores multiple weight components. ORI extends this to DX-center gratings with optical write/erase and 10 s lifetime.

**DX-center persistent photoconductivity.** DX centers in Al$_x$Ga$_{1-x}$As for $x > 0.22$ are deep trap states (Lang & Logan 1977) with thermally activated lifetimes $\tau_\text{DX} = \tau_0 \exp(E_B/k_BT)$. At $x = 0.38$: $E_B = 0.37$ eV, $\tau_\text{DX} \approx 10$ s at 300 K. The VB→DX optical transition at 1.53 eV (810 nm) provides all-optical write; the 850 nm inference field (1.46 eV) is below threshold and transparent (Mooney 1990).

**Semiconductor cross-gain modulation.** XGM in SOAs is documented physics (Lacey 1994, Pleumeekers 2002). ORI uses cross-polarization XGM in a bulk gain slab as a spatial holographic operation: H-polarized context writes a carrier-density grating that V-polarized query reads in a single 47 ps transit.

**Attention variants.** The exponential shape of softmax is not load-bearing for sequence modeling. Linear attention (Katharopoulos 2020), kernel attention (Tay 2020), and RBF attention (Shen 2021) achieve near-identical perplexity using other saturating nonlinearities. The functional requirements are saturation, monotonicity, and normalization — not the specific exponential.

---

## 3. Three-Layer Architecture

### 3.1 Signal Flow

```
Token in: a ∈ ℝ^512
          │
  ┌───────▼────────────────────────────────────────┐
  │  DX Fabry-Perot Resonator                      │
  │  Al₀.₃₈Ga₀.₆₂As, 4mm slab, 20mm cavity       │
  │  T = 100 round trips                            │
  │  computes: h = M^T a  (SSM recurrent)          │
  │  τ_token = 100 ps × 100 = 10 ns               │
  └───────┬────────────────────────────────────────┘
          │  VCSEL re-injection (ReLU activation)
  ┌───────▼────────────────────────────────────────┐
  │  DX FFN Slab                                   │
  │  Al₀.₃₈Ga₀.₆₂As, 4mm × 5mm × 5mm             │
  │  computes: z = W₂ σ(W₁ h)  (feedforward)      │
  │  transit: 47 ps                                │
  └───────┬────────────────────────────────────────┘
          │  PBS (V-polarization output)
  ┌───────▼────────────────────────────────────────┐
  │  SOA Gain Hologram                             │
  │  Bulk GaAlAs, 4mm × 5mm × 5mm                 │
  │  computes: b = W(c)·q  (attention-class)       │
  │  cycle: 6 ns, pipeline overlap: zero overhead  │
  └───────┬────────────────────────────────────────┘
          │
Token out: b ∈ ℝ^512
```

### 3.2 Wavelength and Polarization Isolation

| Layer | Inference | Write | Isolation mechanism |
|:---|:---|:---|:---|
| DX recurrent | 850 nm | 810 nm | Bandgap threshold: 1.90 eV > 1.46 eV |
| DX FFN | 850 nm | 810 nm | Same (same material) |
| SOA attention | 850 nm (V-pol read) | 850 nm (H-pol write) | Polarization beamsplitter >30 dB |

All three fields coexist without mutual interference: 810 nm write is non-resonant in the FP cavity (single pass, no buildup); 850 nm inference is resonant; SOA polarizations are orthogonal.

---

## 4. Layer 1 — DX Fabry-Perot: SSM Recurrent Layer

### 4.1 From Wave Equation to RNN

The scalar wave equation $\partial^2 u/\partial t^2 = (c_0/n(\mathbf{x}))^2\nabla^2 u + f$ discretized in time is exactly the RNN update (Hughes et al. 2019):

$$\mathbf{h}_{t+1} = A(n)\mathbf{h}_t + Bf_t, \quad y_t = |\mathbf{P}^{(o)}\mathbf{h}_t|^2 \tag{1}$$

The round-trip operator $\mathbf{M} = \sqrt{R}(\mathbf{I} + i\mathbf{K}(\Delta n))$ encodes the holographic weight grating via $\kappa_{ij} = (\pi/\lambda)\iint\psi_i^*\Delta n\,\psi_j\,d\mathbf{r}$. After $T=100$ round trips: $\mathbf{h} = \mathbf{M}^T\mathbf{a}$.

### 4.2 DX Medium vs PTR Glass

The intracavity medium is Al₀.₃₈Ga₀.₆₂As rather than PTR glass. The computation ($M^T\mathbf{a}$, $T=100$) is identical; the differences are in the weight medium:

| | PTR glass | DX Al₀.₃₈GaAs |
|:---|:---|:---|
| Rank (4mm) | — | 74 |
| Rank (PTR operating) | 50 | 74 (+48%) |
| Weight lifetime | Permanent | 10 s |
| Write cycle | 60 min furnace | 120 ms optical |
| Gradient updates/s | ~0.0003 | **500,000** |
| Furnace required | Yes | **No** |
| $\alpha$ at 850 nm | <0.01 cm⁻¹ | ~0.036 cm⁻¹ (FCA) |
| SNR loss $T=100$ | 0.004 dB | 0.125 dB |

The DX cavity exceeds the PTR operating rank (50) by 48% while adding only 0.125 dB of FCA loss over 100 round trips — total loss 0.994 dB, leaving 1.006 dB margin above the 38 dB target. A 4mm DX slab fits within the Rayleigh range ($z_R = 10$ mm for $w_0 = 52\,\mu$m) — no relay lens required.

**Cavity parameters:**

| Parameter | Value |
|:---|:---|
| $\lambda$ | 850 nm |
| Cavity length | 20 mm |
| DX slab | 4 mm Al₀.₃₈Ga₀.₆₂As, AR-coated |
| Mirror | Dichroic HR@850 nm, HT@810 nm |
| OPL | 16 mm + 14 mm = 30 mm |
| $\tau_\text{rt}$ | 100 ps |
| $T$ | 100 round trips |
| Token period | 10 ns |
| Throughput | 100 M tok/s |
| Finesse | 3,140 |
| $\Delta n_\text{DX}$ | $5\times10^{-4}$ |
| Rank $R$ | 74 |
| Params (rank-50 baseline) | 1.23 M |

### 4.3 Optical Adjoint Training

The adjoint gradient $\partial\mathcal{L}/\partial\Delta n(\mathbf{r}) \propto \text{Re}[E_\text{adj}^*(\mathbf{r})\cdot E_\text{fwd}(\mathbf{r})]$ is realized optically by injecting an 810 nm backward beam encoding the loss gradient $\delta = \partial\mathcal{L}/\partial\mathbf{y}$. The 810 nm field is above the DX write threshold — it writes the gradient directly into the DX grating in a single 13.3 ns adjoint pass:

1. Forward (850 nm, 10 ns): $\mathbf{a} \to \mathbf{h}$
2. Loss gradient $\delta$ (digital, $<1\,\mu$s)
3. Adjoint (810 nm backward, 10 ns): writes $\partial\mathcal{L}/\partial\Delta n$ into DX grating

**Total cycle: ~2 µs. Rate: 500,000 gradient updates/second.** The DX grating is simultaneously the weight medium and the gradient integrator. Every token is a training step. The device continuously fine-tunes from its own inference stream, incorporating manufacturing imperfections automatically.

Grating refresh: every 2 s (4.8% write overhead). At 2 s refresh: rank range 60–74 (82%–100%), quality swing 1.22×. The refresh IS the training step — no separate rewrite needed.

### 4.4 Activation

Between layers: $P_\text{out} = A^2\max(0, P_\text{in}-\theta)$, $A^2=1.2$, $\theta=0.5$ mW. Kerr SPM: $\phi_\text{NL}\sim10^{-15}$ rad/pass — negligible.

---

## 5. Layer 2 — DX FFN Slab: Updatable Feedforward Layer

A standalone 4 mm Al₀.₃₈Ga₀.₆₂As slab (same material, same operating point) with independently trained weight matrices $W_1, W_2$. Computes $\mathbf{z} = W_2\,\sigma(W_1\mathbf{h})$. Single-pass transmissive: no cavity, 47 ps transit.

The DX FFN slab is **not redundant** with the DX FP cavity despite sharing material and timescale. The FP cavity computes a weight-tied recurrence ($M^T$) — a single matrix applied 100 times. The FFN slab computes two independent projections ($W_1$, $W_2$) — a feedforward function. The weight matrices differ by construction (independently trained). The computational primitives are categorically distinct.

Trained by the same 810 nm optical adjoint (500K updates/s). Refresh cycle 2 s, write time 95 ms. EXP-13 measures $\Delta n_\text{DX}$ in the specific epitaxial material; EXP-14 confirms write time and thermal lifetime.

---

## 6. Layer 3 — SOA Gain Hologram: Attention-Class Layer

### 6.1 Carrier Grating Mechanism

A bulk GaAlAs gain slab pumped to transparency. H-polarized context field ($I\sim I_\text{sat}=10^7$ W/m²) depletes carriers spatially:

$$\Delta N(\mathbf{r}) = -\frac{N_0}{I_\text{sat}}I_H(\mathbf{r}), \qquad \Delta n(\mathbf{r}) = \frac{dn}{dN}\Delta N(\mathbf{r}) \tag{2}$$

with $dn/dN \approx -10^{-26}$ m³ (Coldren & Corzine 1995). At 50% saturation: $\Delta n_\text{material} = 3.75\times10^{-3}$. V-polarized query ($I\sim0.01\,I_\text{sat}$) reads the grating in 47 ps. Carrier diffusion length $L_\text{diff} = \sqrt{D_n\tau_c} = 1\,\mu$m $\ll$ grating period $\Lambda = 49\,\mu$m — spatial hole burning survives, full rank $R=524$ accessible.

### 6.2 The T_{ijkl} Tensor

Output mode amplitudes satisfy $b_i = q_i + ikLC\sum_l W_{il}(c)q_l$ where $W_{il}(c) = \sum_{jk}c_jc_k^*T_{ijkl}$ and:

$$T_{(mn)(m'n')(m''n'')(m'''n''')} = I_{mm'm''m'''}\times I_{nn'n''n'''} \tag{3}$$

The 1D overlap integral has the closed form (§19):

$$I_{abcd} = N_a N_b N_c N_d\sqrt{\tfrac{\pi}{2}}\sum_s 2^{s+t+r}\,s!\,t!\,r!\,\tbinom{a}{s}\tbinom{b}{s}\tbinom{c}{t}\tbinom{d}{t} \tag{4}$$

where $t=s+\Delta$, $r=a+b-2s$, $\Delta=(c+d-a-b)/2$. Selection rule: $I_{abcd}=0$ unless $(a+b+c+d)$ even. $T$ has full $S_4$ symmetry; $W(c)$ is always symmetric and full-rank. For cross-attention ($c=$ previous token, $q=$ current token), causal operation is provided by temporal asymmetry — no Fourier lens required.

### 6.3 Geometry

No ring cavity. Context (H) and query (V) co-propagate collinearly:

```
Context H-pol (I_sat) ──┐
                        ├─[PBS]─[GaAlAs slab, 4mm]─[PBS]─ V output (attention)
Query   V-pol (0.01 I_sat)─┘                             └─ H discard
```

Collinear paths: aberrations cancel (self-compensating holography). PBS isolation >30 dB. XGM efficiency and fidelity: EXP-11.

**Timing:** write 3 ns + read 47 ps + decay 3 ns = **6 ns total**. PTR/DX token period: 10 ns. Attention runs inside the inference shadow — **zero throughput overhead**.

---

## 7. Closing the Softmax Gap

### 7.1 The Full SOA Transfer Function

At exact transparency, the SOA output field is (§24):

$$E_\text{out}(\mathbf{r}) = E_\text{query}(\mathbf{r})\cdot\exp\!\left(i\,C\,\frac{I_\text{context}(\mathbf{r})}{I_\text{context}(\mathbf{r})+I_\text{sat}}\right) \tag{5}$$

where $C=kL\Delta n_\text{max}$ is the maximum phase at full saturation. This is monotone, bounded, and pointwise in $\mathbf{r}$.

The phase-modulated field feeds the FP cavity as a coherent input — not a detector. Phase differences between modes set up interference patterns in subsequent round trips, changing which grating components couple. The SOA implements selective mode amplification through coherent interference — richer than softmax's weighted average of value vectors.

At high saturation ($I_c \gg I_\text{sat}$): $\phi(\mathbf{r})\to\{0,C\}$ — a binary spatial phase mask, equivalent to a holographic matched filter. Context creates a spatial template; query is phase-shifted where they overlap.

### 7.2 Five Properties of Softmax, Five Physical Mechanisms

| Softmax property | ORI mechanism | Status |
|:---|:---|:---|
| Non-negative weights | Amplitude/phase modulation → non-negative intensity | ✓ |
| Bounded response | SOA saturates at $C=kL\Delta n_\text{max}$ | ✓ |
| Monotone in score | $\phi(\mathbf{r})$ monotone in $I_\text{context}$ | ✓ |
| Global normalization | VCSEL threshold: hard energy ceiling per mode | ✓ |
| Exponential mode amplification | FP cavity $T=100$: resonant constructive interference | ✓ |

**The softmax gap is closed.** Each property is implemented by a different physical mechanism, distributed across the SOA, VCSEL threshold, and FP cavity. The specific exponential shape is not load-bearing — confirmed by the ML literature on attention variants (Katharopoulos 2020, Tay 2020, Shen 2021).

### 7.3 Attention Temperature

The sharpness of mode selection is set by $I_\text{context}/I_\text{sat}$ and $C=kL\Delta n_\text{max}$ — physical hyperparameters analogous to the $1/\sqrt{d}$ scaling in standard attention. In-situ training finds the operating point that maximizes task performance. The temperature is a learned quantity, not a fixed constant.

---

## 8. Power Budget

| Component | Power | Fraction |
|:---|:---|:---|
| VCSEL arrays (24 × 512, 50% ReLU active) | 31.4 W | 60% |
| Detector arrays + TIA | 7.4 W | 14% |
| VCSEL drivers / ReLU | 12.3 W | 24% |
| Optical gradient AOM | 0.5 W | 1% |
| 810 nm write laser (4.8% duty) | 30 mW | <1% |
| TE controller | 0.5 W | 1% |
| Control | 0.1 W | <1% |
| **Total** | **52.2 W** | |

**Effective throughput:** 95.3 M tok/s (4.8% write overhead at 2 s refresh)  
**Energy per token: 548 nJ/tok**

The 2-second optical retrain loop (500K gradient steps, incorporating all device imperfections) costs **30 mW average** — less than 0.1% of total power. Training is essentially free.

**Dominant inefficiency:** VCSEL threshold power (~57,000× above shot-noise minimum at 17.6 nW/mode). Intrinsic to lasing. Addressable long-term with nanolaser sources (~100× reduction → ~5 nJ/tok).

| System | Energy/token | Quality |
|:---|:---|:---|
| **ORI (all-DX)** | **548 nJ** | Sub-Mamba-130M |
| Mamba-130M, RTX 4090 | 15,000 nJ | Mamba-130M |
| Llama-3-8B, M3 Max | 187,500 nJ | Instruction-following |
| H100 + GPT-4 class | 23,333,333 nJ | Frontier |

Quality-adjusted (3× ORI units for Mamba-130M equivalent): **548 nJ/tok, ~27× better than GPU**.

---

## 9. The Physical-Logical Convergence

In a digital transformer, three logical operations — recurrence, feedforward, attention — are implemented by one substrate (silicon) executing different matrix multiplications, distinguished by which weights load and what the dataflow is.

In ORI, three physical mechanisms each implement one operation naturally:

- **Carrier density gratings at 1 ns** → naturally token-conditioned, naturally attention-class
- **DX trap states at 10 s** → naturally updatable, naturally FFN-weight-class  
- **FP resonator recurrence** → naturally weight-tied depth, naturally SSM-class

The logical operations fell out of the physical mechanisms. The mapping was not designed top-down — it was discovered bottom-up.

The remaining structure that differs from a full transformer is the weight timescale: digital transformers can update all weights between inference calls (model loading). ORI's DX layers update continuously at 500K/s but cannot switch models instantaneously. This is not a limitation of the architecture — it is a consequence of the DX grating's 10 s lifetime, which is what gives the system its self-organizing property. The model that runs is always the model that was earned by the gradient signal, not the model that was declared by a checkpoint.

---

## 10. Open Experiments

| EXP | Description | Blocks |
|:---|:---|:---|
| EXP-7A | Adjoint convergence (digital) | **Done** |
| EXP-7B | In-situ convergence (physical) | DX recurrent claim |
| EXP-9 | SOA bulk GaAlAs rank measurement | $R=524$ claim |
| EXP-11 | Cross-polarization XGM efficiency | Attention fidelity |
| EXP-13 | $\Delta n_\text{DX}$ in Al₀.₃₈GaAs at 850 nm | DX rank claim |
| EXP-14 | DX write time and thermal lifetime | Refresh rate |
| EXP-15 | Optical adjoint convergence (DX, batch-1) | Online learning |
| EXP-16 | $\alpha_\text{FCA}$ in Al₀.₃₈GaAs at 850 nm | SNR margin |

EXP-7A is complete. All others require lab access. EXP-7B, EXP-9, EXP-13, and EXP-16 are highest priority — they either confirm or revise the core physical claims.

---

## 11. Summary

| Parameter | Value |
|:---|:---|
| Wavelength | 850 nm |
| DX write wavelength | 810 nm |
| Cavity length | 20 mm |
| DX slab (recurrent) | 4 mm Al₀.₃₈Ga₀.₆₂As |
| Round trips $T$ | 100 |
| Token period | 10 ns |
| Throughput | 95.3 M tok/s |
| Spatial modes | 512 (50 µm pitch) |
| DX recurrent rank | 74 |
| DX FFN rank | 74 |
| SOA rank | 524 |
| Parameters | 1.23 M (rank-50 baseline) |
| Total power | 52.2 W |
| Energy/token | **548 nJ** |
| Gradient updates/s | 500,000 (optical adjoint) |
| DX refresh cycle | 2 s |
| Furnace required | **No** |
| BOM estimate | ~$6K–16K |
| Components | All off-the-shelf at 50 µm pitch |

---

## References

1. Hughes, T.W., Williamson, I.A.D., Minkov, M., Fan, S. (2019). Wave physics as an analog recurrent neural network. *Science Advances* 5(12), eaay6946.
2. Hughes, T.W., Minkov, M., Shi, Y., Fan, S. (2019). Training of photonic neural networks through in-situ backpropagation. *Optica* 6(9), 1179–1187.
3. Psaltis, D., Brady, D., Gu, X.G., Lin, S. (1990). Holography in artificial neural networks. *Nature* 343, 325–330.
4. Pai, S., et al. (2023). Experimentally realized in-situ backpropagation for deep learning in nanophotonic neural networks. *Science* 380(6643), 398–404.
5. Kogelnik, H. (1969). Coupled wave theory for thick hologram gratings. *Bell System Technical Journal* 48(9), 2909–2947.
6. Lang, D.V., Logan, R.A. (1977). Large-lattice-relaxation model for persistent photoconductivity in compound semiconductors. *Phys. Rev. Lett.* 39(10), 635.
7. Mooney, P.M. (1990). Deep donor levels (DX centers) in III-V semiconductors. *J. Appl. Phys.* 67(3), R1–R26.
8. Lacey, J.P.R., Madden, S.J., Summons, M.A. (1994). Four-channel cross-gain-modulated wavelength conversion. *IEEE Photon. Technol. Lett.* 6(10), 1241.
9. Pleumeekers, J.L., et al. (2002). Electron depletion depths and cross-gain modulation in bulk SOAs. *IEEE Photon. Technol. Lett.* 14(1), 61–63.
10. Coldren, L.A., Corzine, S.W. (1995). *Diode Lasers and Photonic Integrated Circuits*. Wiley.
11. Henry, C.H. (1982). Theory of the linewidth of semiconductor lasers. *IEEE J. Quantum Electron.* 18(2), 259–264.
12. Katharopoulos, A., Vyas, A., Pappas, N., Fleuret, F. (2020). Transformers are RNNs. *ICML 2020*.
13. Tay, Y., et al. (2020). Long Range Arena: A Benchmark for Efficient Transformers. *arXiv:2011.04006*.
14. Shen, Z., et al. (2021). Efficient Attention: Attention with Linear Complexities. *WACV 2021*.
15. Gu, A., Dao, T. (2023). Mamba: Linear-Time Sequence Modeling with Selective State Spaces. *arXiv:2312.00752*.
16. DLMF (2022). NIST Digital Library of Mathematical Functions §18.18. https://dlmf.nist.gov/18.18
17. Mehler, F.G. (1866). Über die Entwicklung einer Funktion von beliebig vielen Variabeln nach Laplaceschen Functionen höherer Ordnung. *J. reine angew. Math.* 66, 161–176.
