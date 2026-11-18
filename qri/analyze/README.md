# QRI Analysis Suite

Reproducible computational tools derived from conversations and design documents. All scripts calculate first-principles physics and validate architecture decisions from ARCH-1 through ARCH-10.

## Quick Start

```bash
# Economic comparison: QRI vs. hyperscale
python analyze/economic_analysis.py

# Dimensional consistency verification
python analyze/dimensions.py

# Architecture cross-check (ARCH-1 through ARCH-10)
python analyze/arch_crosscheck.py

# Physics derivations (ARCH-1, ARCH-2, ARCH-5, ARCH-9)
python analyze/derivations.py

# Model architecture and parameter accounting
python analyze/model_architecture.py

# JSON output
python analyze/economic_analysis.py --output json
python analyze/dimensions.py --output json
python analyze/arch_crosscheck.py --output json
```

## Modules

### `economic_analysis.py`

**Purpose:** Cost comparison between QRI refrigerator-scale 5T and hyperscale 5T datacenter.

**Key findings:**
- Capital: 130-186× cheaper (QRI $1.0B vs. hyperscale $143B)
- OpEx: 185-422× cheaper ($73M vs. $31B annually)
- TCO (5-year): 139× cheaper
- **Payback: 1.7 months**
- Environmental: 148,000× lower CO₂

**Source:** `ECONOMIC_ANALYSIS_2026-04-20.md`

**Outputs:**
- Table format (default): human-readable cost breakdown
- JSON format: machine-parseable results for downstream analysis

**Configurable:**
- `--years N`: Project cost over N years (default: 5)
- `--output [json|table]`: Output format

### `dimensions.py`

**Purpose:** Verify dimensional consistency across all optical, spatial, temporal, thermal parameters.

**Validates:**
- Wavelength consistency: 850 nm (inference), 532 nm (training)
- Cavity length: 20 mm → τ = 133.3 ps round-trip
- Spatial modes: 7400 available, 512 addressed (14.5× margin)
- Mode waist: 5.2 µm fundamental (ARCH-3 locked)
- Temporal scales: 75M tokens/sec, 13.3 ns/token
- Coherence: 7.5× margin (T_op=100 << T_coh=750)
- Thermal: 15K passive rise, 260 mm² surface
- All scales 10⁻⁷ to 10⁶ meters physically consistent

**Source:** `DIMENSIONS_AND_SCALEFACTORS_2026-04-20.md`

**Consistency checks:**
- Wavelength across optical, spatial, thermal subsystems
- Cavity length across optical, spatial, temporal
- Roundtrip time: specified vs. calculated from geometry
- Mode capacity: 7400 available ≥ 512 addressed
- Coherence margin: T_coh >> T_op (7.5×)
- Thermal stability: passive rise acceptable

### `arch_crosscheck.py`

**Purpose:** Validate all 10 locked architecture decisions are mutually consistent.

**Cross-checks:**
- **ARCH-1 ↔ ARCH-2:** Wave RNN primitive compatible with Fabry-Perot geometry
- **ARCH-2 ↔ ARCH-3:** Geometry supports 512 modes with margin
- **ARCH-3 ↔ ARCH-4:** Mode structure supports 75M tok/s throughput
- **ARCH-4 ↔ ARCH-5:** Throughput maintains SNR ≥ 38 dB
- **ARCH-5 ↔ ARCH-6:** SNR sufficient for coherent Hebbian training
- **ARCH-6 ↔ ARCH-7:** Rank-50 weights fit in multiplexed gratings
- **ARCH-7 ↔ ARCH-8:** Holographic weights readable via homodyne
- **ARCH-8 ↔ ARCH-9:** All-optical coupling achieves Kerr nonlinearity
- **ARCH-9 ↔ ARCH-10:** Kerr nonlinearity thermally stable
- **Full integration:** All 10 architectures locked and consistent

**Source:** `ARCH_CROSSCHECK_2026-04-20.md`

**Result:** ✓ All architectures LOCKED, ready for experimental validation (EXP-1 through EXP-5)

### `derivations.py`

**Purpose:** First-principles calculations for key architecture decisions.

**Derivations:**
- **ARCH-1:** Wave RNN mapping (Hughes 2019), holographic weight storage (Psaltis 1990)
- **ARCH-2 Coherence:** Regime validation (coherent vs. incoherent), T_coh = 750 >> T_op = 100 ✓
- **ARCH-2 Finesse:** Power enhancement F=3140 → 1000× amplitude, 10⁶× power gain
- **ARCH-5 SNR:** Shot noise calculation, photocurrent 0.4A, σ=10µA, SNR=40dB (target 38dB, +2dB margin)
- **ARCH-9 Nonlinearity:** Kerr SPM φ_NL = 0.2 rad/pass, total 20 rad over T=100

**Sources:**
- `conversations/2026-04-19-arch1-derivation.md` — ARCH-1 synthesis
- `conversations/2026-04-19-arch2-geometry.md` — Coherence regime, finesse
- `conversations/2026-04-20-arch4-arch5-throughput-snr.md` — Throughput, SNR budget
- `conversations/2026-04-20-arch6-training.md` — Training via adjoint method

### `model_architecture.py`

**Purpose:** Parameter accounting, rank factorization, hologram storage capacity.

**Key calculations:**
- **Model size:** 24 layers × 512-dim × rank-50 = 1.23M parameters
- **Compression:** Rank-50 reduces full rank (6.3M) by 5.1×
- **Weight quantization:** 4-bit encoding, 1.23M × 4 bits = 0.61 MB
- **Hologram capacity:** 2500 spatial pixels × 4 bits × 1000 gratings = 1.25 MB
- **Utilization:** Model 49.2% of hologram capacity (comfortable margin)
- **Quantization impact:** 4-bit → ~2.5% perplexity increase (from literature)

**Storage compatibility:**
- Model size after 4-bit quantization: 0.61 MB
- Available hologram capacity: 1.25 MB
- ✓ Model fits with 49% utilization

**References:**
- `ARCHITECTURE_COMPLETE_2026-04-20.md` — Architecture summary
- Rank-50 factorization from ARCH-6/ARCH-7 design

## Data Flow

```
Conversations (design documents)
    ↓
Knowledge extraction (physics, constraints, decisions)
    ↓
Parametric scripts (configurable, reproducible)
    ↓
Table/JSON output (verification, downstream use)
    ↓
CI/documentation integration
```

## Design Principles

1. **Reproducible:** No external APIs, pure calculation from first principles
2. **Parametric:** Configurable scenarios for sensitivity analysis
3. **Verifiable:** JSON output for parsing and validation
4. **Documented:** Each derivation cites source equations and papers
5. **Integrated:** Cross-script consistency checks (e.g., dimensions validate arch_crosscheck)

## Running Tests

```bash
# Quick smoke test
cd /home/claude/qri
python analyze/economic_analysis.py > /tmp/test_econ.txt
python analyze/dimensions.py > /tmp/test_dims.txt
python analyze/arch_crosscheck.py > /tmp/test_arch.txt
python analyze/derivations.py > /tmp/test_deriv.txt
python analyze/model_architecture.py > /tmp/test_model.txt

# Verify all pass
grep -c "LOCKED" /tmp/test_arch.txt  # Should be 10+
grep -c "✓" /tmp/test_arch.txt        # Should be 10+
```

## Integration with CI/CD

Scripts can be called from Makefile or GitHub Actions:

```makefile
analyze:
	python analyze/economic_analysis.py --output json > renders/economic.json
	python analyze/dimensions.py --output json > renders/dimensions.json
	python analyze/arch_crosscheck.py --output json > renders/arch_check.json
	python analyze/derivations.py --output json > renders/derivations.json
	python analyze/model_architecture.py --output json > renders/model.json
```

## Adding New Scripts

1. Create new file in `analyze/` with class-based structure (dataclasses preferred)
2. Implement `to_dict()` method for JSON output
3. Include print function for human-readable table output
4. Add argparse for `--output [json|table]`
5. Document sources (conversations, papers, equations)
6. Add to this README

## Sources

### Conversations
- `2026-04-19-arch1-derivation.md` — Wave RNN synthesis
- `2026-04-19-arch2-geometry.md` — Coherence, finesse, geometry
- `2026-04-20-arch3-mode-structure.md` — Spatial modes, VCSEL array
- `2026-04-20-arch4-arch5-throughput-snr.md` — Throughput, SNR, shot noise
- `2026-04-20-arch6-training.md` — Training via adjoint method
- `2026-04-20-arch7-hologram-capacity.md` — Holographic storage

### Design Documents
- `architecture.md` — Full ARCH-1 through ARCH-10 specifications
- `ARCHITECTURE_COMPLETE_2026-04-20.md` — Summary and risk matrix
- `ARCH_CROSSCHECK_2026-04-20.md` — Cross-component consistency
- `DIMENSIONS_AND_SCALEFACTORS_2026-04-20.md` — Dimensional analysis
- `ECONOMIC_ANALYSIS_2026-04-20.md` — Cost breakdown and market impact

### Papers
- Hughes et al. 2019 (Science Advances) — Wave physics as RNN
- Psaltis et al. 1990 (Nature) — Holography in neural networks
- Dettmers & Lewis 2022, Frantar et al. 2022 — Quantization impact on LLMs
- Glebov et al. 2010 — PTR glass photosensitivity and properties

## Future Enhancements

- [ ] Algorithmic model (JAX-based wave equation solver)
- [ ] Sensitivity analysis (sweeping parameters, Monte Carlo)
- [ ] Manufacturing cost curves (yield, scaling with volume)
- [ ] Experimental validation tracker (EXP-1 through EXP-5)
- [ ] Multi-device scaling (10×, 100× resonator stacks)
- [ ] Thermal management simulation (FEA integration)
- [ ] Training convergence curves (rank vs. accuracy trade-off)

---

**Last updated:** 2026-04-24  
**Status:** All scripts tested, ready for integration
