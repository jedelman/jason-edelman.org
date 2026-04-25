# 16. Mode Compression & Rank Scaling (ARCH-16)

**Status:** DRAFT 2026-04-24  
**Question:** How high can rank go before optics fail?

---

## 16.1 Rank → Component Stress Mapping

RNN state dimensionality d = rank of learned weight tensor. Each spatial mode carries one state dimension.

```
rank r → r independent cavity modes → r independent phase shifters (LiNbO3 MZM arms)
```

**Current baseline:** rank-50 (100 basis functions via tensor-train decomposition)

**Component limits:**

| Component | Metric | Baseline | Max | Failure Mode |
|:---|:---|:---|:---|:---|
| **LiNbO3 MZM** | Phase shifter count | 50 | ~256 | Thermal crosstalk (adjacent shifters heat-couple); power dissipation |
| **Cavity modes** | TEM basis size | 100 (Hermite-Gauss) | ~400 | Mode overlap loss; diffraction; cavity Q drops |
| **Insertion loss** | Total loss budget | 2.2 dB | 5 dB | SNR drops below 37 dB (unrecoverable) |
| **Thermal tuning** | PID loop latency | 1 kHz | 100 Hz | Slow drift during training; convergence stalls |
| **Weight expressivity** | Effective params/mode | 5–20 | <2 | Under-parameterized; accuracy ceiling |

---

## 16.2 Rank Scaling Regimes

### Regime 1: Rank 50–100 (Safe, current design)
- 50–100 cavity modes
- ~25 LiNbO3 phase shifters (pairs for MZM arms)
- Insertion loss: 2.2 dB (headroom to 5 dB limit)
- Thermal: PID bandwidth sufficient (1 kHz)
- **Accuracy:** Digital baseline ±1% (Hughes 2018 empirical)

### Regime 2: Rank 100–200 (Pushing limits)
- 100–200 modes (Hermite-Gauss + Laguerre-Gauss hybrid basis)
- ~50–100 phase shifters
- Insertion loss: ~3.5 dB (cavity Q drops ~30% due to mode coupling)
- Thermal: PID bandwidth margin shrinks; drift rate increases 2–3×
- **Risk:** Mode overlap introduces spurious coupling; learned weights fight against it
- **Accuracy:** Expected 2–5% loss vs. digital baseline

**Feasibility:** Yes, with careful mode orthonormalization regularization:
```
L_total = L_task + λ₁ · TV(Δn) + λ₂ · ||V||₂ + λ₃ · (1 - |⟨φᵢ|φⱼ⟩|²)   [mode coupling penalty]
```
where λ₃ ~ 0.1–1 penalizes mode anti-orthogonality.

### Regime 3: Rank >200 (Failure regime)
- Cavity Q degrades below critical threshold (~1000)
- SNR drops to 30 dB (unrecoverable; >10% token error rate)
- Thermal coupling between phase shifters causes runaway oscillation
- Mode basis becomes incomplete; expressivity ceiling drops sharply

**Not recommended** for production inference.

---

## 16.3 Mode Basis Selection

### Hermite-Gauss (Current default)
- Orthogonal in 2D rectangular cavity
- Rank-50: 100 basis functions (10×10 grid)
- Rank-100: 400 basis functions (20×20 grid, cavity dimensions limit ~20 modes per axis max)
- **Limit:** ~rank-100 before diffraction loss > 1 dB

### Laguerre-Gauss (cylindrical symmetry)
- For cylindrical PTR cavity (possible with lens anamorphism)
- Radial index p + azimuthal index ℓ (ℓ ≤ 10 practical)
- Rank-50: (p=0..10, ℓ=0..4) = 55 modes
- Rank-200: (p=0..20, ℓ=0..9) = 210 modes
- **Advantage:** Better scaling for high rank; mode overlap loss lower at rank >100

### Hybrid basis (Recommendation)
```
Φ_hybrid = {HG_{m,n} : m+n < 10} ∪ {LG_{p,ℓ} : p ≤ 15, ℓ ≤ 3}
        ≈ 100 HG modes + 100 LG modes = rank-200 native capacity
```

**Why:** HG modes efficient for low-rank (<100); LG modes fill high-rank space with lower overlap loss.

---

## 16.4 Rank-Loss Tradeoff (Predicted)

Based on Hughes 2018 (mode basis for RNNs) and tensor-train theory:

```
Test accuracy = Digital_baseline - ε_rank - ε_SNR
```

where:
```
ε_rank ≈ 1% · log₂(rank) / log₂(D_max)    [D_max ~ 256 modes max]
ε_SNR ≈ 0.5% · (40 dB - SNR_actual) / 10 dB
```

**Curves (estimated):**

| Rank | Modes | Insertion loss (dB) | SNR (dB) | ε_rank (%) | ε_SNR (%) | Total loss (%) |
|:---|:---|:---|:---|:---|:---|:---|
| 25 | 50 | 2.0 | 38.0 | 0.4 | 0.1 | **0.5** |
| 50 | 100 | 2.2 | 37.8 | 0.8 | 0.1 | **0.9** |
| 100 | 200 | 3.0 | 37.0 | 1.5 | 0.5 | **2.0** |
| 150 | 300 | 3.8 | 36.2 | 2.1 | 0.9 | **3.0** |
| 200 | 400 | 4.5 | 35.5 | 2.8 | 1.3 | **4.1** |
| 250 | 500 | 5.0+ | 35.0 | 3.4 | 1.5 | **4.9+** (unrecoverable) |

**Interpretation:**
- Rank 50–100: <1% accuracy loss (acceptable)
- Rank 100–200: 1–3% loss (tolerable if task allows)
- Rank >200: >4% loss + SNR margin exhausted (not recommended)

---

## 16.5 Thermal & Control Limits

Phase shifter cross-talk (TiN heaters in LiNbO3):

```
ΔT(i,j) = (P_dissipated / κ) · exp(-d_ij / thermal_diffusion_length)
```

where:
- P_dissipated per shifter ~ 1 mW @ 5V (typical LiNbO3)
- κ ~ 1 W/(m·K) (LiNbO3 thermal conductivity)
- d_ij ~ 10 μm (shifter spacing on chip)
- thermal_diffusion_length ~ 50 μm

**Crosstalk magnitude:**
- 50 shifters, 10 μm spacing: ΔT_crosstalk ~ 0.1 K (negligible)
- 100 shifters, 5 μm spacing: ΔT_crosstalk ~ 0.5 K (manageable with PID)
- 200+ shifters, <5 μm spacing: ΔT_crosstalk > 1 K (PID can't track fast enough)

**PID bandwidth requirement:**
```
BW_required = thermal_time_constant⁻¹ · safety_factor
           ≈ (κ · cavity_thickness² / ρ·c)⁻¹ · 2
           ≈ 100 Hz (for 1 K crosstalk tolerance)
```

Current design: 1 kHz PID → supports rank-150 safely. Above that, active cooling or multi-zone thermal control needed.

---

## 16.6 Practical Recommendation

**Production target:** Rank-100 (200 basis modes)
- 1–2% accuracy loss from digital baseline (acceptable)
- SNR margin: 37.8 dB (recoverable via +3 dB VCSEL)
- Thermal control: 1 kHz PID sufficient
- Phase shifter count: ~50 (manageable, low crosstalk)
- Convergence time: ~hours (100 epochs, 1M params)

**Stretch goal (if VCSEL upgraded):** Rank-150
- 2–3% loss, tolerable for 5T inference
- Requires enhanced thermal PID (consider Peltier on reference cavity)
- Mode orthonormalization regularization critical (λ₃ ~ 0.5)

**Ceiling:** Rank-200
- Theoretically feasible, but all margins gone
- Requires hybrid HG/LG basis + active thermal stabilization
- Not recommended for production (too fragile)

---

## 16.7 ARCH-16 Design Parameters

Add to `parameters.toml`:

```toml
[mode_compression]
rank_baseline = 50
rank_production_target = 100
rank_stretch_goal = 150
rank_ceiling = 200

basis_function_scheme = "hermite-gauss (rank <100) + laguerre-gauss hybrid (rank >100)"
mode_orthonormalization_penalty_lambda3 = 0.5  # Tune in Phase 1
insertion_loss_per_rank_increment_db = 0.01  # ~1 dB per 100 rank increase

[thermal_control]
pidi_bandwidth_hz = 1000
max_crosstalk_temperature_k = 0.5  # Limit for rank-100
thermal_diffusion_length_um = 50
phase_shifter_spacing_um = 10  # Current; reduce for rank >100

[accuracy_loss_model]
epsilon_rank_formula = "1% * log2(rank) / log2(256)"
epsilon_snr_formula = "0.5% * (40 dB - SNR) / 10 dB"
max_tolerable_total_loss_pct = 2.0  # For 5T production
```

---

## 16.8 Phase 1 Validation

**Experiment:** Train same 100-param RNN at rank-25, 50, 100 on MNIST tokens. Plot accuracy vs. rank.

**Expected outcome:**
- Rank-50: ~94% accuracy (matches digital)
- Rank-100: ~92–93% (1–2% loss)
- Rank-200 (if attempted): ~90–91% (>3% loss, with higher convergence stalls due to thermal drift)

**If curve matches theory:** Scale to rank-100 production.
**If accuracy drops faster:** Reduce to rank-50, add +3dB VCSEL, test mode orthonormalization penalty strength.

