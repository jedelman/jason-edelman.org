# Tasks
## Convention
- `[ ]` open
- `[x]` done
- Priority: HIGH / MED / LOW

---

## Literature Reviews

### Foundational (done)
- [x] Hughes et al. 2019, Sci. Adv. — Wave physics as analog RNN. Core mapping: wave eq = RNN update. Load-bearing for ARCH-1. See `citations/hughes_2019_wave_rnn.md`.
- [x] Psaltis et al. 1990, Nature — Holography in artificial neural networks. Hologram = weight matrix. Load-bearing for ARCH-6/7. See `citations/psaltis_1990_holography_nns.md`.
- [x] Fu et al. 2024, Light: Sci. Appl. — ONN review. Field map. See `citations/onn_review_2024.md`.
- [x] Vicentini et al. 2021, Nat. Photonics — Dual-comb holography. See `citations/dual_comb_holography_2021.md`.

### Competing architectures (done — needed for related work section)
- [x] Lin et al. 2018, Science — D²NN. Feedforward diffractive ONN, fixed weights. See `citations/lin_2018_d2nn.md`.
- [x] Shen et al. 2017, Nat. Photonics — MZI mesh ONN, unitary constraint. See `citations/shen_2017_mzi_mesh.md`.
- [x] Feldmann et al. 2019, Nature — PCM spiking ONN. Endurance-limited. See `citations/feldmann_2019_pcm_snn.md`.
- [x] Feldmann et al. 2021, Nature — Photonic tensor core (WDM + PCM). See `citations/feldmann_2021_tensor_core.md`.
- [x] Zhong et al. 2023, Nat. Commun. — Graphene/Si activation function. Considered and rejected (intra-cavity loss). See `citations/zhong_2023_graphene_activation.md`.
- [x] Duport et al. 2012, Opt. Express — All-optical reservoir computing. SOA delay loop. See `citations/duport_2012_reservoir.md`.
- [x] Xu et al. 2021, Nature — 11 TOPS photonic convolutional accelerator. See `citations/xu_2021_tops_comb.md`.
- [x] Xu et al. 2024, Science — Taichi 160 TOPS/W photonic chiplet. Benchmark to address. See `citations/xu_2024_taichi.md`.
- [x] Farhat et al. 1985, Appl. Opt. — First optical neural network (Hopfield). Historical anchor. See `citations/farhat_1985_hopfield.md`.
- [x] Reck et al. 1994, Phys. Rev. Lett. — Unitary decomposition via MZI mesh. QRI explicitly avoids unitary constraint. See `citations/reck_1994_unitary.md`.

### Unread — lower priority, skip for preprint
- [ ] Bogaerts et al. 2020, Nature — Programmable photonic circuits. (MED — general PIC state of art, not directly competing)
- [ ] Picqué & Hänsch 2019, Nat. Photonics — Frequency comb spectroscopy review. (LOW — dual-comb encoding deferred)
- [ ] Shams-Ansari et al. 2020 — TFLN dual-comb. (LOW — dual-comb encoding deferred)
- [ ] Coddington et al. 2009, Nat. Photonics — Dual-comb ranging. (LOW)
- [ ] Ideguchi et al. 2013, Nature — Coherent Raman dual-comb. (LOW)

---

## Architecture Derivation Writeups
These decisions are LOCKED in architecture.md. These tasks are formal derivation documents for the paper's methods section.

- [ ] ARCH-2 derivation: Resonator geometry (Fabry-Perot). Formally derive L=20mm, R=0.9990, T_op=100 from wave RNN coherence requirement and SNR budget. Currently locked but derivation is inline in architecture.md — needs standalone derivation doc.
- [ ] ARCH-3 derivation: Mode structure. Formally derive 512 modes fit in 2.5mm aperture at 50µm pitch; Fresnel number; Hermite-Gaussian mode orthogonality.
- [ ] ARCH-4 derivation: Token throughput. Formal derivation of 75M tok/s from τ=133ps and T_op=100.
- [ ] ARCH-5 derivation: SNR budget. Formal shot-noise derivation to 40dB; 6-bit precision requirement.
- [ ] ARCH-6 derivation: Training pipeline. Adjoint method for wave dynamics; Δn(x,y) update rule; 532nm write protocol.
- [ ] ARCH-7 derivation: Hologram capacity. Angular multiplexing; rank-50 fits in PTR plate at 50µm grating pitch; parameter count.
- [ ] ARCH-8 derivation: Inter-layer coupling. Relay lens pair geometry; incoherent coupling justification; VCSEL driver signal chain.

---

## Experimental Validation Tasks
**All require lab. Do not block preprint on these.**

- [x] EXP-1 (CLOSED 2026-04-27): PTR χ³ @ 850nm — CLOSED. Kerr SPM retired. Activation is VCSEL threshold ReLU.
- [ ] EXP-2 (HIGH): Two-wavelength photosensitivity — PTR @ 532nm write + 850nm read simultaneously. Confirm σ_r(850nm)≈0 (no cross-sensitization). Blocks ARCH-11 isolation claim.
- [ ] EXP-3 (HIGH): Hebbian grating growth rate — Δn vs. 532nm exposure time. Target: Δn=5×10⁻³ in <1000 inference passes. Sets write epoch duration.
- [ ] EXP-4 (HIGH): Thermal lensing dn/dT — cavity stability under 2-3W CW intra-cavity load. Acceptable drift: <5 mrad/hour. Blocks SNR margin confidence.
- [ ] EXP-5 (MED): Homodyne phase-lock stability — VCSEL PID lock over 1-hour inference run. Blocks ARCH-12 phase budget.
- [x] EXP-6 (CLOSED 2026-04-26): LiNbO₃ MZM insertion loss — CLOSED. MZM removed from design.
- [ ] EXP-7 (HIGH): In-situ training convergence. Phase A: rank-10, single layer, ≤5 write-develop cycles to 2% of digital baseline. Phase B: clone-and-fine-tune (unit 01 → unit 02, ≤2 cycles). Blocks ARCH-17 validation.
- [ ] EXP-8 (HIGH): Kinematic mount reinstallation precision. Requirement: repeatability << λ/4 = 212nm. Standard kinematic mounts achieve ~1µm — 5× worse than needed. Must characterize actual positional error and determine whether (a) training protocol can absorb this error by treating reinstalled cavity as new forward model, or (b) active cavity locking is required to recover phase reference between write-develop cycles. Blocks ARCH-11 iterative training protocol. Flagged in docs/theory_derivations.md §6 as open assumption A5.

---

## Infrastructure

- [ ] INFRA-1: PDF fetching in generate_sysdoc.py — download PDFs where DOI available, store in citations/
- [ ] INFRA-2: design/render_resonator.py — resonator geometry diagram (confocal Fabry-Perot, mode structure, PTR plate, VCSEL array)
- [ ] INFRA-3: Conversations/ log rotation — one file per session (currently done manually)

---

## Preprint Readiness Checklist

### Ready now (no lab required)
- [x] Architecture: ARCH-1 through ARCH-17 locked
- [x] Crosscheck: all 13 checks PASS
- [x] Literature: all major competing works reviewed, differentiation documented
- [x] Signal chain: fully derived (TIA, driver, VCSEL, activation)
- [x] Activation function: ReLU on intensity, proven nonlinear, universal approximation
- [x] Economic analysis: 5-year TCO vs. GPU
- [x] System doc: auto-generated PDF from current sources
- [x] Theory derivations: all four critical gaps resolved — round-trip operator, coupling tensor κ_{ij}, field/intensity basis, differential encoding (docs/theory_derivations.md)

### Needs work before preprint (no lab)
- [ ] ARCH-2 through ARCH-8 formal derivation docs (methods section material) — partially covered by theory_derivations.md, needs integration
- [ ] Related work section: differentiation table vs. D²NN, MZI, PCM, reservoir, Taichi
- [ ] Abstract + introduction draft
- [ ] Address Taichi (160 TOPS/W): argue why recurrent holographic beats feedforward chiplet for LLM token inference specifically
- [ ] Update parameters.toml: fix stale Glass Brain entries in [interposer], populate [model] and [power] blocks

### Requires lab (post-preprint)
- [ ] EXP-2, 3, 4, 5, 7, 8 — experimental validation
