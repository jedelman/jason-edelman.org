# arXiv Preprint: Structure and Draft Outline

**Target:** arXiv cs.ET / physics.optics cross-post  
**Framing:** Theoretical architecture paper. Establishes design, derives limits, identifies validation path.  
**Honest scope:** No experimental results. Priority claim + invitation to collaborate.  
**Length target:** 10-12 pages + references (NeurIPS-style double column, or single-column preprint)

---

## Title (options, ranked)

1. **Optical Resonator Inference: An All-Optical Wave RNN for Token-Level Language Model Inference**
2. **Optical Recurrent Inference via Holographic Fabry-Perot Resonators**
3. **Wave RNN in Glass: A Coherent Optical Architecture for SSM-Class Token Inference**

Recommendation: Option 2. Descriptive, avoids "quantum" (which implies quantum mechanics to most readers — we're not doing that), avoids overclaiming.

---

## Abstract (draft)

We present Optical Resonator Inference (ORI), a theoretical architecture for executing recurrent neural network inference entirely in the optical domain using coherent Fabry-Perot resonators. Drawing on the formal equivalence between the discretized scalar wave equation and an RNN hidden state update (Hughes et al. 2019), and the established capacity of holographic gratings to implement matrix-vector multiplication (Psaltis et al. 1990), we derive a system in which: (1) token embeddings are encoded as spatial mode amplitudes at 850nm; (2) holographic gratings in photo-thermo-refractive (PTR) glass implement learned weight matrices; (3) activation is provided by VCSEL threshold nonlinearity (ReLU on intensity) at inter-layer boundaries; and (4) in-situ training proceeds via two-wavelength holographic exposure at 532nm without disrupting the 850nm inference path. We derive the system's hidden state capacity (12,288 real values at 40dB SNR for 512 modes, 24 layers), characterize it as sub-Mamba-130M class, and identify a clear scaling roadmap to Mamba-3B-equivalent state via VCSEL array densification within the same optical aperture. Full transformer-class inference (O(N) attention state) is identified as a fundamental barrier not addressable by O(1) optical state. We propose a hybrid architecture combining QRI's optical recurrence with digital sparse attention as a near-term path to transformer-approximate quality. Experimental validation (EXP-7: in-situ training convergence) is identified as the next milestone.

---

## Section Structure

### 1. Introduction (1 page)

**Opening problem:** LLM inference at scale is an energy crisis. H100 cluster inference for frontier models: ~700W per GPU, ~$1/hour, ~0.5 kg CO2/hour. The energy cost of inference is growing faster than efficiency gains from digital scaling.

**Proposed approach:** Optical hardware offers orders-of-magnitude energy advantages for matrix-vector multiply — the dominant operation in transformer inference. Prior optical neural networks (D²NN, MZI mesh, PCM tensor core) are feedforward and stateless. Language model inference is inherently sequential and stateful. This gap has not been addressed.

**This paper:** We derive a theoretical architecture for a coherent optical resonator that natively implements recurrent sequence modeling — the same computational class as SSMs (Mamba, RWKV) — from first principles of wave physics.

**Scope statement (explicit):** This is a design paper. No experimental results are reported. We derive the architecture, characterize its theoretical limits, and identify the experimental validation path.

**Contributions:**
- First-principles derivation of an all-optical wave RNN from the Fabry-Perot resonator physics
- Identification and correction of the activation function: ReLU on intensity via VCSEL threshold (not Kerr SPM, which does not close at operating power)  
- Characterization of state capacity and scaling limits
- Honest comparison to SSM-class digital models and feedforward optical systems
- Experimental validation roadmap

---

### 2. Background and Related Work (1.5 pages)

**2.1 Wave physics as RNN (Hughes et al. 2019)**
The discretized scalar wave equation is structurally identical to an RNN update rule. Trainable parameter: the wave speed distribution c(x,y) — equivalent to the refractive index field Δn(x,y) in a holographic medium. This is the theoretical foundation for QRI.

**2.2 Holographic weight storage (Psaltis et al. 1990)**
Holographic gratings in photorefractive media implement matrix-vector multiplication via diffraction. Weight matrix = grating pattern. Multiple weights = angular multiplexing. QRI extends this to PTR glass (thermally fixed, non-volatile) for stable inference.

**2.3 Prior optical neural networks**

| System | Weights | Architecture | Nonlinearity | Token inference |
|:---|:---|:---|:---|:---|
| D²NN (Lin 2018) | Fixed (fab) | Feedforward | None | No |
| MZI mesh (Shen 2017) | Volatile (phase shifters) | Feedforward, unitary | Electronic | No |
| PCM tensor core (Feldmann 2021) | PCM (limited endurance) | Feedforward | Electronic | No |
| Taichi (Xu 2024) | Fixed (load-time) | Feedforward, stateless | Electronic | No* |
| Reservoir (Duport 2012) | Fixed reservoir | Recurrent (delay loop) | SOA saturation | No |
| **QRI (this work)** | Holographic (updatable) | Recurrent (resonator) | VCSEL threshold | Yes |

*Taichi can approximate via digital recurrence, but the optical component is stateless.

**2.4 SSM-class digital models**
Mamba (Gu 2023), RWKV (Peng 2023), and linear attention (Katharopoulos 2020) achieve near-transformer quality with O(1) recurrent state. QRI is in this computational class. The energy advantage of optical execution over digital SSM implementation is the primary claim.

---

### 3. Theoretical Foundation (1.5 pages)

**3.1 Wave equation → RNN**
Reproduce Hughes 2019 derivation in 10 lines. Identify: hidden state h_t = [u_t, u_{t-1}], weight matrix A from Laplacian on c(x,y), input injection P^(i), output readout P^(o). Nonlinearity = intensity detection y_t = |h_t|².

**3.2 From scalar wave to multimode resonator**
Extend Hughes 2019 (scalar, 1D) to: multimode Fabry-Perot, vector hidden state (512 Hermite-Gaussian modes), holographic MVM via Δn(x,y) grating. Key extension: mode structure maps token embedding dimensions to spatial eigenmodes.

**3.3 Holographic MVM**
Psaltis 1990 synthesis: Δn(x,y) = Σ_k a_k cos(K_k · r) (superposition of gratings at different angles). Each grating implements one outer product row. Rank-50 factorization W = U·Vᵀ stored as 50 angular-multiplexed gratings.

---

### 4. System Architecture (3 pages)

**4.1 Overview**
Block diagram. Signal flow: VCSEL array → PTR glass resonator (T=100 round trips) → Si PIN detector → VCSEL driver (ReLU activation) → next layer. 24 layers.

**4.2 Resonator design**
Confocal Fabry-Perot, L=20mm, R=0.9990, Finesse=3140, T_op=100. Key derivations: coherence requirement (T_op << T_coh = 750), mode capacity (N_max = π/4 × F² ≈ 6,635 at 2.5mm aperture), SNR budget (40dB shot-noise limited, 2dB margin over 6-bit requirement).

**4.3 Activation function**
Full signal chain derivation: I_photo = R·P_k, V_TIA = R_f·I_photo (R_f = 667Ω), I_drive = g·V_TIA, P_out = η_s·max(0, I_drive − I_th). Result: ReLU on intensity P_out = A²·max(0, P_in − θ). A²=1.2, θ=0.5mW. Prove nonlinearity. Prove universal approximation. Note: Kerr SPM evaluated and rejected (φ_NL ~ 10⁻¹⁵ rad/pass at operating intensity — negligible).

**4.4 Training protocol**
Two-wavelength separation (850nm inference, 532nm write). Hebbian grating exposure. Adjoint gradient computation. Batch accumulation (eliminates holographic crosstalk). Clone-and-fine-tune scaling.

**4.5 Throughput and latency**
τ = 133ps round-trip, T_op = 100 → 13.3ns per layer. 24 layers → 320ns per token. Token rate = 75M tok/s. Bandwidth comparison to GPU.

---

### 5. State Capacity and Scaling (2 pages)

**5.1 Hidden state characterization**
State = 512 modes × 24 layers = 12,288 real values. At 40dB SNR: 20KB information capacity. Comparison table to Mamba-130M, Mamba-3B, RWKV-7B, Transformer KV cache.

**5.2 Gen 1 quality estimate**
Practical context ~200–1000 tokens. Sub-Mamba-130M class. Suitable for: proof of concept, edge inference, constrained devices. Not suitable for: long-context tasks, complex multi-hop reasoning.

**5.3 Scaling roadmap**
Mode count N_modes = π/4 × F², F = D²/4λL. Current aperture (2.5mm) supports 6,635 modes; Gen 1 uses 7.7% (limited by VCSEL pitch, not physics). Roadmap table: Gen 2 (2,048 modes, 25µm VCSEL, Mamba-1B equiv), Gen 3 (6,000 modes, 10µm VCSEL, Mamba-3B equiv), Gen 4 (32,768 modes, 5mm aperture, Mamba-70B equiv).

**5.4 Transformer gap**
Full transformer attention requires O(N) state. Fundamental barrier for O(1) optical systems. No known optical mechanism for content-addressable dynamic memory. Hybrid path: QRI optical SSM + digital sparse attention (O(√N) per token) approximates transformer quality for most practical workloads.

---

### 6. Competitive Analysis (0.5 pages)

**vs. Taichi:** Metric mismatch (TOPS/W on spatial patches vs tok/s/W on token sequences). Taichi is stateless; QRI is recurrent. For autoregressive generation, QRI natively carries hidden state; Taichi requires digital recurrence overhead that dominates latency at context length.

**vs. Mamba/RWKV:** Same computational class (O(1) state RNN). QRI claims optical execution at lower energy. This is the primary comparison and must be validated experimentally.

**vs. GPU transformer:** QRI is SSM-class, not transformer-class. Energy advantage for workloads where SSM quality is sufficient (majority of practical inference). Hybrid path for demanding workloads.

---

### 7. Experimental Validation Path (0.5 pages)

State open experiments clearly. Do not hide them.

**EXP-7 (blocking):** In-situ training convergence. Rank-10, single layer, simple task. Target: ≤5 write-develop cycles to 2% of digital baseline. This is the core claim validation.

**EXP-2, 3, 4 (supporting):** Material characterization. Two-wavelength isolation, grating growth rate, thermal lensing. These validate the operating point assumptions.

**EXP-5 (secondary):** Phase lock stability over 1-hour run.

Honest statement: *"Experimental validation is in progress. This paper establishes the theoretical architecture and identifies the validation milestones."*

---

### 8. Conclusion (0.5 pages)

QRI is the first optical architecture derived from first principles for recurrent token inference. It is SSM-class, not transformer-class — a distinction we make explicit. The primary claim is energy efficiency of optical SSM execution. The scaling path to Mamba-3B-equivalent state is identified as a 3–5 year engineering effort within the existing supply chain. Experimental validation (EXP-7) is the immediate next milestone.

---

### References (target: 25-35)

Core: Hughes 2019, Psaltis 1990, Lin 2018, Shen 2017, Feldmann 2019/2021, Xu 2024 (Taichi), Duport 2012, Gu 2023 (Mamba), Peng 2023 (RWKV), Katharopoulos 2020 (linear attn), Hornik 1991, Leshno 1993, Glebov 2010 (PTR glass), Larsson 2011 (VCSEL), Pai 2023 (in-situ photonic backprop), Kaplan 2020 (scaling laws).

---

## What's Ready to Write Now

| Section | Status | Effort |
|:---|:---|:---|
| Abstract | Draft above | 30 min polish |
| Introduction | Outline ready | 2 hours |
| Background / Related Work | All citations reviewed | 2 hours |
| Theoretical Foundation | In architecture.md | 1 hour extraction |
| System Architecture | In architecture.md | 2 hours condensation |
| State Capacity / Scaling | In docs/state_scaling_analysis.md | 1 hour extraction |
| Competitive Analysis | In citations/ + this doc | 1 hour |
| Experimental Path | In TASKS.md | 30 min |
| Conclusion | Follows from above | 30 min |
| **Total** | | **~10 hours writing** |

No new research required. All source material is in the repo.

---

## What to Do With the Title

"Optical Resonator Inference" is a good project name but a risky paper title. "Quantum" in a photonics paper implies quantum mechanics (entanglement, superposition). We're doing classical coherent optics. A reviewer seeing "quantum" will look for qubits and find none — this is a distraction.

Recommendation: use "QRI" as an acronym in the paper, explain it stands for the project name, but lead the title with a descriptive phrase. Option 2 above ("Optical Recurrent Inference via Holographic Fabry-Perot Resonators") is clean, accurate, and searchable.
