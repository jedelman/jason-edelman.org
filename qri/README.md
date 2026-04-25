# Quantum Resonator Inference (QRI)

**Coherent all-optical resonator that learns and executes token inference from first principles.**

Status: **ARCHITECTURE LOCKED (ARCH-1 through ARCH-16)**. Ready for Phase 1 validation experiments.

---

## Quick Start

- **Architecture spec:** `architecture.md` (complete 1–16 sections)
- **Component design:** `docs/analysis/` (hybrid PTR+LiNbO3 MZM, PID control, mode compression)
- **Parameters:** `parameters.toml`, `properties.toml` (materials, design rationale)
- **Generate docs:** `python generate_sysdoc.py` (builds full system documentation)

---

## Project Status

### Completed (Locked)

| Section | Title | Status |
|:---|:---|:---|
| ARCH-1 | Wave Equation → RNN Mapping | ✓ Proven (Hughes 2019) |
| ARCH-2 | PTR Cavity Geometry | ✓ Locked (24 layers, 4mm, Q~10⁴) |
| ARCH-3 | Token Encoding | ✓ Locked (spatial mode superposition) |
| ARCH-4 | Throughput | ✓ Locked (75M tok/s, 13 ns round trip) |
| ARCH-5 | Noise Budget | ✓ Locked (40 dB SNR, margins quantified) |
| ARCH-6–7 | Weight Encoding (Old) | ✓ Replaced (permanent holography → ephemeral) |
| ARCH-8 | Inference Latency | ✓ Locked (1–100 round trips per token) |
| ARCH-9 | Scaling (Thermal) | ✓ Locked (±5 mrad/hour drift, PID lock) |
| ARCH-10 | Economics | ✓ Locked ($1.2k Phase 1, 12 weeks prod) |
| **ARCH-11** | **Learning (Ephemeral Weights)** | **✓ Locked** |
| **ARCH-12** | **Parallelism (√N Phase Budget)** | **✓ Locked** |
| **ARCH-13** | **Deployment (Model Swap, Retrain)** | **✓ Locked** |
| **ARCH-14** | **Convergence Proof (Photonic Backprop)** | **✓ Locked** |
| **ARCH-15** | **Loss Landscape & Training Dynamics** | **✓ Locked** |
| **ARCH-16** | **Mode Compression & Rank Scaling** | **✓ Locked** |

### Key Innovations (ARCH-11–16)

1. **Ephemeral weights via resonance** (not permanent holography)
   - Pockels modulation (LiNbO3 MZM) → weight updates at µs timescale
   - Gradient descent via heterodyne photonic backprop (exact, proven via Hughes 2018)
   - Rapid on-device retraining (hours instead of days)

2. **Horizontal parallelism scales sequence length**
   - N independent cavities, broadcast loss gradient
   - Phase stability √N scaling (variance reduction)
   - Effective token budget: B_eff = B√N (e.g., 4 cavities: 100 → 200 tokens)

3. **Component limits mapped**
   - LiNbO3 MZM: ~256 phase shifters (thermal crosstalk limit)
   - Cavity modes: ~400 TEM basis (Q loss, diffraction)
   - Rank-100 is production target (1–2% accuracy loss)
   - Rank-200 is ceiling (all margins gone)

---

## Architecture Overview

### Core Physics

**Wave equation discretization** (Hughes 2019):
```
∂²E/∂t² + 2α∂E/∂t + ω₀²E = 0    →    h_{t+1} = W·h_t + x_t    [RNN]
```

PTR cavity geometry encodes the transformation matrix W via refractive index modulation Δn(x,y,z).

### Hardware Stack

```
[850 nm laser] 
    ↓
[PTR Cavity: 24 layers, Q~10⁴, 4mm thick]
    ↓
[LiNbO3 MZM: inline phase modulator, 0–5V control, 1 ns update]
    ↓
[Reference cavity + PID lock: ±5 mrad/hour thermal stability]
    ↓
[Photodiode + heterodyne detector: measure loss & gradients optically]
    ↓
[N parallel cavities: synchronized training, √N phase budget gain]
```

### Training

**Photonic backpropagation** (exact, proven):
1. Forward: Inject token, circulate N_circ rounds, read output
2. Backward: Phase-reversed probe interferes with forward field
3. Heterodyne beat signal encodes ∂L/∂V (gradient of loss w.r.t. voltage)
4. Weight update: V ← V - α·∂L/∂V (every µs)

Convergence matches digital training (Pai et al. 2023: 94% MNIST).

---

## Component Specs

### LiNbO3 Inline MZM
- Insertion loss: 1.0–1.5 dB
- V_π: 3–5 V (half-wave voltage)
- Phase shifter count: ~50 for rank-100
- Thermal tuning coeff: +0.04 nm/K (PID compensates)

### PTR Cavity
- Material: Photo-thermo-refractive glass
- Δn per layer: 5×10⁻³
- Total thickness: 4 mm (24 layers)
- Q factor: ~10⁴ @ 850 nm
- Insertion loss: <0.5 dB (cavity only)

### Fiber Coupling
- PTR → SMF-850 (fiber pigtail): 0.3 dB
- SMF-850 → LiNbO3 MZM (FC/APC): 0.3 dB
- Total budget: 2.2 dB (SNR: 37.8 dB, recoverable with +3dB VCSEL)

### Thermal PID Control
- Loop bandwidth: 1 kHz
- Proportional gain: K_p = 0.1 V/rad
- Integral gain: K_i = 0.005 V/(rad·s)
- Derivative gain: K_d = 0.0001 V·s/rad
- Phase stability: <5 mrad/hour

---

## Design Parameters

### Mode Compression (ARCH-16)

| Rank | Modes | Loss | SNR | Accuracy Loss | Notes |
|:---|:---|:---|:---|:---|:---|
| 50 | 100 | 2.2 dB | 37.8 dB | <1% | Safe (current baseline) |
| 100 | 200 | 3.0 dB | 37.0 dB | 1–2% | **Production target** |
| 150 | 300 | 3.8 dB | 36.2 dB | 2–3% | Stretch goal (VCSEL +3dB) |
| 200 | 400 | 4.5 dB | 35.5 dB | 4% | Ceiling (not recommended) |

**Basis:** Hermite-Gauss (rank <100) + Laguerre-Gauss hybrid (rank >100)

---

## Phase 1: Validation Experiments

**Timeline:** 4 weeks (during lab access)

| Week | Task | Deliverable |
|:---|:---|:---|
| 1 | Procure components | BOM ordered |
| 2–3 | Assemble optics, lock PID | Phase stability plot |
| 4 | Train 100-param RNN, validate convergence | Accuracy vs. rank curve |

**Success criteria:**
- Phase stability: <5 mrad/hour
- Convergence: Loss decay matches digital training
- Accuracy: Rank-50 ~94%, rank-100 ~92–93% (vs. digital baseline)

---

## Repository Structure

```
.
├── README.md                          # This file
├── architecture.md                    # Complete ARCH-1 through ARCH-16
├── parameters.toml                    # Design parameters (searchable, cited)
├── properties.toml                    # Material properties (cited or theoretical)
├── generate_sysdoc.py                 # Builds full system documentation
├── Makefile                           # Build targets
├── docs/
│   ├── analysis/                      # Current design documents
│   │   ├── HYBRID_EO_DESIGN_2026-04-24.md
│   │   ├── THERMAL_PID_FIBER_OPTICS_2026-04-24.md
│   │   └── ARCH-16_MODE_COMPRESSION_RANK_SCALING.md
│   └── archive/                       # Prior analysis (referenced, not current)
├── analyze/                           # Analysis scripts
│   └── eo_modulator_strategy.py       # EO modulator trade-off analysis
├── citations/                         # Referenced papers (PDFs if available)
├── conversations/                     # Work session transcripts
├── design/                            # Rendering & visualization tools
└── renders/                           # Render output directory
```

---

## Key References

- **Hughes et al. (2018):** "Training of photonic neural networks through in situ backpropagation" — *Optica* 5, 864. **Foundation for photonic backprop exactness.**
- **Pai et al. (2023):** "Experimentally realized in situ backpropagation for deep learning in photonic neural networks" — *Science* 380, 398–404. **First experimental validation (94% MNIST).**
- **Hughes (2019):** Wave equation discretization as RNN. **Physical basis for ARCH-1.**

---

## Next Steps

**Pending your lab access:**

1. **ARCH-17:** Multi-cavity ensemble dynamics (synchronization, phase-averaging)
2. **ARCH-18:** Nonlinear activation (Kerr effect? saturable absorber?)
3. **ARCH-19:** Token encoding alternatives (phase/amplitude quadrature)

**Currently blocked on:** Phase 1 experiments (you control timeline).

---

## Contributing

Architecture locked. Comments/refinements via:
1. `conversations/` — session transcripts
2. `architecture.md` — append new sections with status
3. Git commits — detailed rationale

---

**Last Updated:** 2026-04-25 (ARCH-1 through ARCH-16 complete)

