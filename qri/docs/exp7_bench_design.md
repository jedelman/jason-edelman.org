# EXP-7 Bench Design: In-Situ Training Convergence

*Status: design complete. Execution requires lab. No external dependencies on EXP-2/3/4/5.*

---

## Objective

Demonstrate that a single holographic resonator layer can be trained in-situ using the two-wavelength write-develop protocol, converging to within 2% of a digital baseline in ≤5 write-develop cycles.

This is the minimum viable experimental result for the paper. It proves: holographic learning in a coherent resonator works. Everything else is extrapolation.

---

## Why This Experiment, Not Others

EXP-2, 3, 4, 5 characterize materials and stability — important but they don't prove the core claim. EXP-7 proves the core claim directly: *optical in-situ training converges*. If EXP-7 fails, the architecture needs revision regardless of what EXP-2–5 show. If EXP-7 passes, the paper has its result.

---

## Minimum Viable Setup (Phase A)

### Task
**Rank-10 matrix approximation of a random target matrix.**

Why this task:
- Fully characterizable digitally (compute ground truth exactly)
- Rank-10 requires only 10 angular-multiplexed gratings (well within PTR capacity)
- Does not require 512 VCSELs or full mode addressing
- Loss function is simple: L = ||W_optical · x − W_target · x||²
- Convergence is measurable cycle-by-cycle

Avoid: language modeling tasks, image classification, anything requiring trained embeddings. Those confound holographic convergence with model quality. Keep it pure.

### Input/Output Dimensionality
- d_in = d_out = 32 (not 512 — this is a proof of principle)
- 32 spatial modes: a 6×6 grid of VCSELs at 50µm pitch (standard VCSEL array, Glass Brain validated)
- 32 Si PIN detectors at the output face
- Target matrix W_target: random Gaussian, rank-10, normalized

### Optical Configuration
```
[532nm write laser]  ←  gradient encoding (single-pass write beam)
        ↓
[PTR glass slab, 10×10×0.5mm]
        ↑
[850nm probe laser] → [6×6 VCSEL array] → [PTR glass] → [6×6 detector array]
                                                ↓
                                        [ADC → laptop → loss computation → 
                                         gradient → 532nm pattern generation]
```

**Note:** This is a single-layer, single-pass experiment. No resonator cavity in Phase A. The cavity (finesse 3140, T=100 round trips) adds complexity and is not required to demonstrate holographic learning convergence. Test the learning mechanism first, cavity second.

This is an important scope decision: **Phase A validates holographic gradient learning. Phase B (cavity) validates the wave RNN dynamics.** Don't try to prove both at once.

### Write-Develop Cycle

**One cycle:**
1. **Forward pass (850nm, ~1 second):** Illuminate PTR slab with 32 input patterns x_i. Measure output y_i = W_optical · x_i. Compute loss L = Σ ||y_i − W_target · x_i||².
2. **Gradient computation (digital, ~1 minute):** Use measured y_i as boundary condition. Compute ∂L/∂Δn(x,y) via adjoint simulation of the measured forward pass.
3. **Gradient encoding (532nm, ~5 minutes):** Generate spatial pattern of 532nm exposure proportional to gradient. Single-pass exposure through the PTR slab.
4. **Thermal development (furnace, ~30 minutes):** 500°C anneal to fix the holographic grating.
5. **Reinstall and measure (kinematic mount, ~10 minutes):** Reinstall developed PTR plate. Measure W_optical on test set.

**Total per cycle: ~45 minutes.** 5 cycles = ~4 hours.

### Target Metrics
- **Primary:** Loss L after each cycle. Target: L(cycle 5) / L(cycle 0) ≤ 0.02 (98% reduction).
- **Secondary:** Convergence rate — how many cycles to reach 10% of target loss?
- **Failure modes to characterize:** 
  - Loss plateau (indicates gradient encoding fidelity problem)
  - Loss increase (indicates reinstallation error exceeding gradient step)
  - Slow convergence >5 cycles (indicates thermal development imprecision)

### Baseline
Run the same 5-cycle procedure on a digital simulation of the PTR slab (using the same adjoint solver). This gives the "digital baseline" — what perfect gradient execution would achieve. EXP-7 target: optical result within 2% of digital baseline at cycle 5.

---

## Equipment List

| Item | Specification | Source | Status |
|:---|:---|:---|:---|
| PTR glass slab | 10×10×0.5mm, pre-sensitized | Optigrate or RPMC | Order needed |
| 850nm probe laser | Single-mode, <10MHz linewidth | Thorlabs or Eagleyard | Check Glass Brain inventory |
| 532nm write laser | CW, 10-100mW, collimated | Coherent Verdi or DPSS | Check Glass Brain inventory |
| VCSEL array 6×6 | 50µm pitch, 850nm | Vixar or II-VI | Check Glass Brain inventory |
| Si PIN detector array 6×6 | 50µm pitch, 850nm | Hamamatsu S8551 or similar | Check Glass Brain inventory |
| Spatial light modulator (532nm) | For gradient pattern encoding | Meadowlark or Holoeye | May need to procure |
| Kinematic mount (PTR) | Sub-µm repeatability | Thorlabs or Newport | Standard optics |
| Tube furnace | 500°C, programmable | Thermolyne or Carbolite | Lab inventory likely |
| TIA electronics (×36) | 667Ω transimpedance | PCB design or off-shelf | Build/procure |
| ADC | 8-bit min, 36 channels, ~1MHz | NI DAQ or similar | Lab inventory likely |
| Laptop + adjoint solver | Python, GPU optional | Available | Software ready |

**Budget estimate:** $5K–15K assuming Glass Brain laser/VCSEL inventory is usable. $20K–40K if starting from scratch.

**Timeline estimate:** 6–8 weeks from equipment assembly to first result.

---

## Phase B: Cavity Validation (post Phase A)

Once Phase A demonstrates holographic learning convergence, add the Fabry-Perot cavity:

**Changes from Phase A:**
- PTR slab replaced with PTR glass inside confocal F-P cavity (L=20mm, R=0.9990 mirrors)
- 850nm probe circulates for T=100 round trips before readout (not single-pass)
- Mode structure: Hermite-Gaussian TEM_mn (verify 32 modes are correctly addressed)
- VCSEL PID frequency lock enabled

**New things to validate in Phase B:**
- Does the holographic MVM work correctly inside a high-finesse cavity?
- Does the finesse buildup (×1000) produce the expected SNR gain?
- Does reinstallation maintain phase coherence within the cavity (kinematic mount + PID)?
- Does the ReLU activation (VCSEL threshold) work correctly in the full signal chain?

**Phase B is the full EXP-7 as defined in TASKS.md.** Phase A is the prerequisite.

---

## Phase C: Clone-and-Fine-Tune (ARCH-17 validation)

After Phase B, demonstrate ARCH-17: train one PTR slab (unit 01), replicate physically (unit 02 = copy of unit 01), measure loss degradation on unit 02, fine-tune unit 02 in ≤2 cycles to recover unit 01 performance.

This validates the scaling hypothesis: that optical manufacturing consistency is sufficient for clone-and-fine-tune to work. If unit 02's initial loss is already close to unit 01 (within a few %), ARCH-17 is validated. If it's far off, ARCH-17 needs revision.

---

## Adjoint Solver (Software — Ready Now)

The gradient computation (step 2 of each cycle) requires:
1. Forward simulation of the PTR slab given current Δn(x,y) and measured inputs x_i
2. Backward pass via adjoint to compute ∂L/∂Δn(x,y)
3. Output: spatial intensity pattern for 532nm exposure

This software needs to be written and tested on simulated data before touching the bench. It should:
- Accept measured y_i (from ADC) as input boundary condition
- Use the measured forward pass, not a simulated one (captures physical imperfections)
- Output a 2D gradient map at PTR glass spatial resolution
- Be tested on digital simulation: confirm gradient descent converges in ≤5 cycles for rank-10 target

**Estimated software effort: 2–3 days.** Python, scipy, numpy. No GPU required for 32-mode experiment.

**This software can be written now, today, before any hardware is ordered.**

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|:---|:---|:---|:---|
| Kinematic mount repeatability insufficient | MED | HIGH | Characterize mount error before writing first grating; add PID correction |
| PTR development temperature precision | MED | MED | Calibrate furnace profile; use thermocouple at glass |
| 532nm SLM pattern fidelity | MED | MED | Characterize SLM nonlinearity; precorrect |
| Phase drift during 850nm measurement | LOW | MED | Short measurement window (<1s per pattern); PID lock |
| PTR glass photosensitivity at 850nm (EXP-2) | LOW | HIGH | Test cross-sensitization on sacrificial sample first |
| Convergence failure (>5 cycles) | LOW | HIGH | Immediately characterize which error dominates (gradient encoding vs development vs reinstallation) |

**Blocking risk:** EXP-2 (two-wavelength photosensitivity). If 850nm probe light causes unwanted grating exposure, Phase A is compromised. Test this on a blank PTR sample before running EXP-7. This takes 1 day and costs one PTR sample.

---

## Decision: Phase A First, Then Paper Submission

1. **Now (1-2 weeks):** Write adjoint solver. Test on digital simulation. Confirm convergence in ≤5 simulated cycles for rank-10 target.
2. **Weeks 2-6:** Assemble Phase A bench. Order PTR glass. Verify Glass Brain equipment inventory.
3. **Week 6-8:** Run EXP-7 Phase A. Measure convergence.
4. **Week 8-10:** If converged: submit arXiv preprint with EXP-7 Phase A result included.
5. **Week 10+:** Phase B (cavity). Phase C (clone).

**The arXiv preprint should include Phase A results if timeline permits.** Even one experimental data point — "rank-10 holographic learning converges in 3 cycles" — transforms the paper from a design proposal to an experimental result.

If Phase A is delayed, submit the design preprint first (no results), then update with a v2 when Phase A is done. arXiv supports versioning.
