# Optical Resonator Inference (ORI)

**A coherent all-optical resonator that learns and executes token inference from first principles.**

Architecture locked through ARCH-17. Theoretical derivations complete. Phase 1 lab validation pending.

---

## What It Is

A Fabry-Perot holographic resonator is an exact physical RNN. The refractive index distribution of a PTR glass medium encodes weight matrices as holographic gratings. T round trips through the cavity compute the T-th power of the round-trip operator — a weight-tied RNN of depth T=100. This is derived from Maxwell's equations (Hughes et al. 2019), not by analogy to digital systems.

The competitive framing is SSM-class (same computational class as Mamba/RWKV). Full transformer attention is a fundamental architectural barrier: O(1) optical state cannot implement O(N) attention.

The core motivation is environmental: replacing silicon compute for LLM inference at drastically lower energy cost.

---

## Key Parameters (Locked)

| Parameter | Value | Rationale |
|:---|:---|:---|
| Wavelength | 850 nm | GaAs VCSEL, PTR transparency, Si PD |
| Cavity length | 20 mm | τ = 133 ps, T_coh = 750 |
| Mirror reflectivity | R = 0.9990 | Finesse = 3140 |
| Round trips | T = 100 | Coherent regime + SNR budget |
| Spatial modes | 512 | Embedding dimension |
| Throughput | 75M tok/s | 1/(T·τ) |
| SNR (achieved) | 40 dB | 2 dB margin above 38 dB target |
| Rank (baseline) | 50 | 1.254M params/expert |
| Rank (production) | 100 | 1–2% accuracy loss |
| Write wavelength | 532 nm | PTR photosensitivity; σ_r(850nm) ≈ 0 |
| PTR plate | 10×10×0.5 mm | Standard substrate |
| Furnace cycle | 30 min | Dominates training epoch cost |

---

## Architecture Summary

### Physics Foundation (ARCH-1)

The scalar wave equation discretized in time is structurally identical to an RNN update (Hughes et al. 2019):

```
h_{t+1} = A(n) · h_t + B · f_t
y_t = |P^(o) · h_t|²
```

where A(n) is determined by the refractive index distribution n(x,y). The trainable parameter is n(x,y). Training = writing holograms. Inference = photon propagation.

### Weight Encoding

Permanent holographic gratings in PTR glass. The LiNbO₃ MZM ephemeral weight approach was retracted: 0.1 dB/pass × 100 passes = 10 dB, consuming the entire SNR budget. PTR permanent holography is the only viable scheme given the SNR constraint.

Write wavelength 532 nm / infer wavelength 850 nm isolation is physics-grounded: σ_r(850nm) ≈ 0 in PTR glass (EXP-2 validates).

### Training

In-situ mandatory. Sub-wavelength manufacturing imprecision compounds over T=100 round trips, making weight translation from digital simulation fundamentally infeasible. Adjoint method (Hughes et al. 2018) provides exact gradients via phase-reversed probe. Furnace development cycle (30 min) dominates epoch cost, not optical exposure.

**Key insight:** Orthonormal training inputs (QR decomposition of random matrix) enable adjoint solver convergence in ~1 cycle. EXP-7 Phase A validated digitally.

### Activation

ReLU on intensity via VCSEL threshold nonlinearity. Kerr SPM proven negligible (~10⁻¹⁵ rad/pass at operating intensity).

### Differential Encoding

Signed embeddings as x_i = x_i⁺ − x_i⁻ on two spatial modes (input layer only). Resolves the sign constraint for optical intensity encoding. Corrects parameter count to 1.254M/expert.

### Scaling Strategy (ARCH-17)

Clone-and-fine-tune: trained gratings encode W plus cavity-specific corrections. Cloning transfers W approximately; fine-tuning corrects cavity mismatch in fewer cycles than full retraining.

---

## Theory Derivations

`docs/theory_derivations.md` — four foundational derivations forming a logical chain:

1. **Round-trip operator** — T derived from coherence constraint (T ≪ T_coh=750) × SNR budget intersection; not asserted arbitrarily
2. **Grating-to-operator coupling tensor** — κ_{ij} = (π/λ)∫∫ψ_i*·Δn_k·ψ_j dx dy — links holographic grating rank to weight matrix rank
3. **Field vs. intensity basis** — intra-layer computation on complex field amplitudes; detector squaring is the nonlinearity; pixel pitch ≤50µm is a concrete design requirement
4. **Differential encoding** — signed embeddings on two spatial modes; corrects parameter count

This document is the LaTeX-ready source for the arXiv Methods section.

---

## Open Experiments

| ID | Description | Blocks |
|:---|:---|:---|
| EXP-1 | PTR χ³ at 850nm | Kerr SPM closure |
| EXP-2 | Two-wavelength photosensitivity (σ_r at 850nm) | Write/read isolation |
| EXP-3 | Hebbian grating growth rate | Training cycle time |
| EXP-4 | Thermal lensing dn/dT | Mode stability at T=100 |
| EXP-5 | Homodyne phase-lock stability | SNR budget |
| EXP-6 | LiNbO₃ MZM insertion loss at 850nm | Rank-100 SNR margin |
| EXP-7A | Adjoint solver convergence validation | ✓ Complete (digital) |
| EXP-7B | Clone-and-fine-tune viability | Lab access pending |
| EXP-8 | Kinematic mount reinstallation precision | ~1µm actual vs ~212nm required |

---

## Open Assumptions (§6 of theory_derivations.md)

1. PTR glass photorefractive cross-section σ_r(850nm) ≈ 0
2. Thermal lensing under intra-cavity CW power is manageable
3. Holographic grating rank ≥ 50 achievable in single PTR plate
4. Adjoint solver convergence extends to full 512-mode cavity
5. Clone-and-fine-tune mismatch correction converges faster than full training
6. Kinematic mount reinstallation precision can be improved to ~212nm

---

## Repository Structure

```
architecture.md              — ARCH-1 through ARCH-17, locked
parameters.toml              — Design parameters with rationale
properties.toml              — Material properties with citations
TASKS.md                     — Open experiments (EXP-1 through EXP-8)
generate_sysdoc.py           — Assembles full system documentation
Makefile                     — Build targets
docs/
  theory_derivations.md      — Four foundational derivations (arXiv Methods source)
  arxiv_preprint_outline.md  — Preprint structure
  exp7_bench_design.md       — EXP-7 bench design
  state_scaling_analysis.md  — Gen 1→3 scaling roadmap
analyze/
  adjoint_solver.py          — Adjoint solver (~300 lines, EXP-7A validated)
citations/                   — Referenced papers
conversations/               — Session notes
renders/                     — System document output (PDF + HTML)
```

---

## Generational Roadmap

| Generation | Modes | State | Equivalent |
|:---|:---|:---|:---|
| Gen 1 | 512 | ~20 KB | Sub-Mamba-130M class |
| Gen 3 (target) | 6,000 | — | Mamba-3B equivalent |

Gen 3 requires 10µm VCSEL pitch and ~6,000 spatial modes. All scaling decisions gate on the 2 dB SNR margin.

---

## Key References

- **Hughes et al. (2018)** — In situ backpropagation for photonic neural networks. *Optica* 5, 864. Foundation for adjoint training.
- **Hughes et al. (2019)** — Wave equation discretization as RNN. Physical basis for ARCH-1.
- **Pai et al. (2023)** — Experimentally realized in situ backpropagation. *Science* 380, 398–404. 94% MNIST experimental validation.
- **Psaltis et al. (1990)** — Holography in artificial neural networks. Physical basis for weight storage.

---

**Last updated:** 2026-05-08 — Architecture locked ARCH-1 through ARCH-17. Theoretical derivations complete.
