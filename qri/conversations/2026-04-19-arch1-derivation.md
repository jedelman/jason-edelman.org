# 2026-04-19 — ARCH-1 Derivation: Resonator as Wave RNN

## Architecture constraint update
Jason clarified: embedded device, single-tenant, no context switching, no multi-tenancy.
Eliminates from scope: HBM3, CMOS MVM co-processor, S_n reload logic, scheduling.
One model, weights written once into PTR glass, device runs that model forever.

## ARCH-1: What is the optical primitive?

**LOCKED.** Derived from first principles.

### Foundation 1: Wave equation is an RNN (Hughes et al. 2019, Science Advances)
The scalar wave equation discretized in finite differences:
  h_t = A(n) · h_{t-1} + P^(i) · x_t

is structurally identical to an RNN update rule, where:
- A(n) = sparse matrix from Laplacian with spatially varying n(x,y)
- P^(i) = input injection matrix (fixed, not trained)
- h_t = [u_t, u_{t-1}]^T = hidden state (wave field at two consecutive times)
- x_t = input token at time t
- Nonlinearity = intensity detection: y_t = |P^(o) · h_t|²

**ANY optical cavity with a structured medium IS an RNN.** Trainable parameter = n(x,y).

### Foundation 2: Holography stores weight matrices (Psaltis et al. 1990, Nature)
Holographic grating in photosensitive medium stores outer-product weight patterns.
PTR glass (our material): Δn(x,y) = trained weight distribution. Non-volatile, thermally fixed.
Writing the hologram = writing the weights.

### Synthesis: Holographic Fabry-Perot resonator = optical RNN
- Geometry: linear Fabry-Perot cavity with PTR glass insert
- Weights: Δn(x,y) in PTR glass = wave speed distribution = A(n)
- Input: d-mode excitation of cavity (one mode per embedding dimension)
- Output: d-detector readout after T round trips
- Nonlinearity: optoelectronic interposer (detect → GeLU approx → re-emit via VCSEL)
- Training: offline adjoint method (backprop through wave dynamics simulation)

Key benefit vs. Glass Brain: depth is "free" — T round trips through same hologram = T RNN steps from one physical plate. No need for N separate physical layers.

Key cost vs. Glass Brain: round-trip loss limits T. Loss budget → T_max is ARCH-2.

## Decisions locked
- Geometry: Fabry-Perot (not ring, not bowtie)
- Medium: PTR glass (Δn(x,y) = trained weights)
- Wavelength: 850nm (Glass Brain validated, continued)
- Nonlinearity: optoelectronic interposer (same as Glass Brain, reused)
- Embedding: 512 dimensions (placeholder, ARCH-3 to validate)
- Interposer: Glass Brain design reused (67ns/layer, 1.32W/head)

## Open tasks generated
ARCH-2: cavity geometry (L, R, T_max from loss budget)
ARCH-3: mode structure (aperture for N ≥ 512 modes)
ARCH-4: token throughput derivation
ARCH-5: SNR budget over T round trips
ARCH-6: training pipeline (adjoint method)
ARCH-7: hologram capacity (weight matrix entries per PTR plate)
ARCH-8: interposer adaptation from feedforward to resonator

## Citations added to repo
- citations/hughes_2019_wave_rnn.md — full derivation, key equations, resonator connection
- citations/psaltis_1990_holography_nns.md — holographic weight storage, Psaltis 1990

## Next session recommendation
ARCH-2: Derive resonator geometry from loss budget.
Inputs needed: PTR glass absorption at 850nm, mirror R options, target T (RNN depth), SNR_required = 38 dB.
Use: T_max = -log(threshold) / round_trip_loss, tau = 2L/c, token_rate = 1/(T·tau).
