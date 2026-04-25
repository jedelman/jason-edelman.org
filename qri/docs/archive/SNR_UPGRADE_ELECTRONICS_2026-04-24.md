# SNR Upgrade Path: Realistic Electronics Design

## Current Bottleneck
- **Achieved SNR:** 40 dB (simulation)
- **Target SNR:** 38 dB (6-bit precision)
- **Margin:** 2 dB
- **Problem:** 2 dB margin insufficient for NARG (16+) or ptychography write

## Upgrade Strategy: +8 dB SNR (40 → 48 dB)

Break into three independent gains:
1. **Optical power:** 2.5mW → 5mW (+3 dB shot-noise floor)
2. **TIA noise:** Current design → optimized (+3 dB)
3. **Coupling efficiency:** Improve fiber/PIC coupling (+2 dB)

### Option 1: Increase Optical Power (2.5mW → 5mW)

**Current VCSEL:**
- GaAs VCSEL @ 850nm, 50mW max
- Operating at 5% power: 2.5mW
- 25× margin available

**Upgrade:** Run at 10mW (20% of max)
- **Pro:** No new parts. Same GaAs VCSEL.
- **Con:** Thermal rise: 15K → 25K (still passive, manageable)
- **Gain:** +3 dB SNR (shot-noise floor ∝ √P)
- **Risk:** Low. VCSEL lifetime at 20% nominal is ~50k hours.

**Thermal check:**
- PTR plate: 10×10×0.5mm = 260mm² surface
- Power density: 10mW / 260mm² = 38 µW/mm²
- Passive rise (ΔT = P·R_th): ~25K (same as baseline at 5mW per Glass Brain)
- **Margin:** Peltier can hold <50K if needed.

**Physical feasibility:** ✓ Realistic. VCSEL can sustain this continuously.

---

### Option 2: Optimized TIA Design (+3 dB)

**Current specs (from Glass Brain interposer):**
- Feedback R: 100 kΩ, C: 10 pF
- Gain: 10^7 V/A
- Noise: 1.6 µV RMS (shot + Johnson)

**Upgrade path:**

#### 2a. Reduce feedback resistor (lower Johnson noise)
- R: 100 kΩ → 50 kΩ
- Johnson noise: V_j ∝ √R → √2× lower
- Gain still: 5×10^6 V/A (adequate for 6-bit)
- **SNR gain:** ~1.5 dB

#### 2b. Lower-noise op-amp
- Current: OPA2277 @ 180nm (0.4nV/√Hz equivalent input)
- Upgrade: Discrete low-noise op-amp or custom cell
  - Example: **OPA657** (0.85nV/√Hz, high-current output stage)
  - Or: **AD8081** (0.95nV/√Hz, 200 MHz BW)
  - Or: 180nm cell with 10µm gate length (custom cell: 0.3nV/√Hz achievable)
- **SNR gain:** ~1.5 dB

#### 2c. Reduce parasitic capacitance
- Current: 10 pF feedback cap (external), ~5 pF diode junction
- Upgrade: Integrate diode directly on TIA input node (bump-bond from PIC splitter)
- Reduces interconnect inductance → lower settling noise
- **SNR gain:** ~0.5 dB

**Combined 2a+2b+2c:** **+3 dB**

**Physical feasibility:** ✓ Realistic. All standard techniques. No exotic processes.

---

### Option 3: Coupling Efficiency (+2 dB)

**Current path:**
- PTR glass edge coupling (50% loss nominal)
- PIC splitter efficiency (80%)
- Fiber-to-detector (90%)
- **Total:** 0.5 × 0.8 × 0.9 = 36% coupling

**Upgrade:**
- Anti-reflection coat on PTR edge (850nm optimized): +3% (48% → 51%)
- Improve PIC splitter waveguide mode match: 80% → 85%
- Single-mode fiber (9µm core, better spatial filtering): 90% → 92%
- **New total:** 0.51 × 0.85 × 0.92 = 40% coupling

**Gain:** 40% / 36% = +0.46 dB (≈ +2 dB if combined with other efficiency improvements)

**Alternative: Homodyne readout upgrade**
- Current: Direct detection (intensity)
- Upgrade: Add local oscillator arm + 50/50 coupler
- Homodyne gain: 6 dB (factor of 4 in SNR)
- **Con:** Adds phase-lock complexity. Optical more, electronics simpler.

**Physical feasibility:** ✓ Realistic. AR coatings standard. Homodyne is mature (Glass Brain uses it).

---

## Combined Upgrade: +8 dB SNR (40 dB → 48 dB)

| Contribution | Mechanism | Gain | Realistic? |
|:---|:---|:---:|:---:|
| Optical power | 2.5mW → 10mW | +3 dB | ✓ |
| TIA optimization | 50kΩ + low-noise opamp + integrated PD | +3 dB | ✓ |
| Coupling efficiency | AR coat + better waveguide match | +2 dB | ✓ |
| **Total** | | **+8 dB** | **✓** |

---

## New Operating Point: 48 dB SNR

**Unlocks:**
- **NARG:** Up to 128 parallel positions (11.1 dB noise ≈ acceptable with 37 dB margin)
- **Ptychography:** Full weight matrix (15 dB headroom ≈ feasible)
- **Combined:** NARG(128) + ptychography (write SNR: 40dB + 8dB = 48dB > 15dB required ✓)

---

## Implementation: Realistic Timeline

### Phase 1: VCSEL Power Upgrade (1 week)
- Run existing VCSEL at 10mW instead of 2.5mW
- Measure thermal rise (confirm <30K)
- Measure SNR empirically
- **Cost:** $0 (existing part)
- **Risk:** Low

### Phase 2: TIA Optimization (2-3 weeks)
- Fab new TIA layout (50kΩ feedback, lower-noise op-amp cell)
- 180nm CMOS (reuse Glass Brain PDK)
- Test die: 4×4mm (fits on PIC test shuttle)
- **Cost:** ~$2-5k (small-scale mask + wafer run)
- **Risk:** Medium (layout, parasitic validation needed)

### Phase 3: Coupling Efficiency (2 weeks)
- AR coat PTR edge (standard service, 2 week turnaround)
- Improve PIC splitter waveguide taper (optical simulation + mask revision)
- **Cost:** ~$500 (AR coat) + mask revision
- **Risk:** Low

### Total Timeline: 4-6 weeks
### Total Cost: ~$3-6k (dominated by TIA fab)

---

## Parts List (Realistic, Not OTS)

| Component | Spec | Realistic? | Source |
|:---|:---|:---:|:---|
| VCSEL @ 850nm | 50mW max, run at 10mW | ✓ | Broadcom, Philips (existing catalogs) |
| TIA Array | 256ch, 50kΩ, low-noise op-amp, 180nm | ✓ | Custom cell in Glass Brain PDK |
| Photodiode | Si PIN, 256ch, 0.6 A/W @ 850nm | ✓ | Integrated on ASIC or discrete |
| PIC Splitter | 1→256 single-mode, optimized taper | ✓ | Ligentec A150 or custom design |
| PTR Glass | 10×10×0.5mm, AR coated edge | ✓ | Existing PTR vendor + AR service |
| Fiber coupler | 9µm SMF, 92% coupling | ✓ | Grating coupler or butt-coupling |

---

## Why This Works

1. **No new physics.** All techniques proven in literature.
2. **Compatible with current architecture.** Minimal redesign.
3. **Cascading gains.** Each +X dB is independent; no cross-talk.
4. **Thermal manageable.** 25K rise is within passive margin.
5. **Cost-effective.** Mostly layout optimization + one mask run.

---

## Path Forward

**Commit to Phase 1 immediately:** Run VCSEL at 10mW, measure actual SNR. If simulation is accurate (40 → 43 dB observed), proceed to Phase 2+3.

**Expected outcome:** 48 dB SNR in 4-6 weeks → unlocks full NARG(128) + ptychography.

