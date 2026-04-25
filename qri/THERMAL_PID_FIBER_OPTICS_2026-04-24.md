# PID Control & Fiber Coupling Optics for Hybrid PTR+LiNbO3 System

---

## 1. Thermal PID Loop Design

### 1.1 Block Diagram

```
Optical phase (cavity output) 
                ↓
         [Heterodyne detector]
         (against reference cavity)
                ↓
        [Phase comparator] → Error signal e(t)
                ↓
        [PID controller] → Control voltage V_tune
                ↓
    [LiNbO3 tuning electrode] → Δn(t) compensation
```

### 1.2 Error Signal

Phase error (in radians):
```
e(t) = φ_main(t) - φ_ref(t)
```

Where:
- φ_main = phase of trained cavity output
- φ_ref = phase of reference cavity (stable, unmodulated)

**Detector:** Heterodyne with reference beam at 850 nm ± 100 kHz offset
- Beat frequency detects phase difference (phase/frequency lock)
- Bandwidth: ~10 kHz (sufficient for thermal timescale)

### 1.3 PID Gains

**Equation:**
```
V_tune(t) = K_p · e(t) + K_i ∫ e(τ) dτ + K_d · ė(t)
```

**Tuned values (empirical; adjust per system):**
```
K_p = 0.1 V/rad         [proportional gain; 0.1V per radian phase error]
K_i = 0.005 V/(rad·s)   [integral; slow correction]
K_d = 0.0001 V·s/rad    [derivative; damping]
```

**Rationale:**
- K_p dominant (fast response to phase drift)
- K_i small (integral of long-term offset)
- K_d small (avoid overshoot)

### 1.4 Range & Saturation

LiNbO3 tuning:
- V_tune range: 0 to +5V (full π phase swing at 3.5V)
- If e(t) > 5 rad, error is large; alarm triggered
- Hysteresis: Re-lock if |e(t)| > 2 rad for >10 ms

### 1.5 Implementation

**Software (embedded controller):**
```python
class PIDController:
    def __init__(self, Kp=0.1, Ki=0.005, Kd=0.0001, dt=1e-4):
        self.Kp, self.Ki, self.Kd = Kp, Ki, Kd
        self.dt = dt  # 1 kHz update rate
        self.integral = 0.0
        self.prev_error = 0.0
    
    def update(self, error):
        self.integral += error * self.dt
        derivative = (error - self.prev_error) / self.dt
        output = self.Kp * error + self.Ki * self.integral + self.Kd * derivative
        output = np.clip(output, 0, 5.0)  # Saturate to 0–5V
        self.prev_error = error
        return output
```

**Hardware (if implementing with analog circuit):**
- Op-amp integrator (R_i = 1 MΩ, C_i = 1 µF → τ = 1 s time constant)
- Summing amplifier (R_p, R_i, R_d resistors for gains)
- Output amplifier (×10 if phase error in mV units)

---

## 2. Fiber Coupling Optics

### 2.1 PTR Cavity → Single-Mode Fiber

**Coupler configuration:**

```
[PTR cavity output] → [Collimating lens] → [SMF-850 fiber pigtail]
     (4mm thick)        f = 11 mm              (NA = 0.13)
```

**Specs:**
- Collimating lens: f = 11 mm, AR-coated @ 850 nm
- Fiber: Single-mode @ 850 nm (SMF-850, Corning SMF-28 or equivalent)
- Coupling loss budget: 0.3 dB (achievable with ±1 mm alignment tolerance)

**Procedure (lab setup):**
1. Mount PTR cavity on XYZ kinematic stage
2. Mount collimating lens on separate XYZ stage
3. Mount SMF pigtail on xyz piezo stage (fine adjust)
4. Align laser through cavity in reverse; view fiber output on IR viewer
5. Optimize for maximum power (typically 90%+ of direct cavity output)

### 2.2 SMF-850 → LiNbO3 MZM

**Interface:**

```
[SMF-850 (pigtail)] → [LiNbO3 fiber coupler/connector] → [MZM waveguide]
   (mode field         (integrated on chip or
    diameter ~4 µm)    external coupling optics)
```

**Options:**

| Option | Loss | Complexity | Notes |
|:---|:---|:---|:---|
| **FC/APC connector** | 0.3–0.5 dB | Low | Standard telecom; direct fiber-to-chip coupler |
| **Butt couple + lens** | 0.5–1 dB | Medium | Requires precise fiber holder; adjustable |
| **Directional coupler** | 0.1–0.3 dB | High | Monolithic on same substrate; ideal but rare |

**Recommendation:** FC/APC connector with integrated chip coupler (standard for commercial MZM modules, e.g., Photonics Hyperion, Modwave). Loss typically 0.3 dB.

### 2.3 Total Insertion Loss Budget

| Stage | Loss | Component |
|:---|:---|:---|
| PTR cavity (intrinsic) | 0.5 dB | Material + geometry |
| Collimation (cavity→fiber) | 0.3 dB | Lens coupling efficiency |
| SMF propagation (1 m) | 0.1 dB | Fiber attenuation ~0.1 dB/km |
| Fiber→LiNbO3 (FC/APC) | 0.3 dB | Connector + mode match |
| LiNbO3 MZM (intrinsic) | 1.0 dB | Waveguide + coupler arms |
| **Total** | **2.2 dB** | |

**SNR impact:**
```
P_out = P_in · 10^(-2.2/10) ≈ 0.60 · P_in
SNR_loaded = SNR_cavity - 2.2 dB = 40 dB - 2.2 dB = 37.8 dB
```

**Recovery:** VCSEL 10 mW (+3 dB) → 40.8 dB > 37.8 dB target. ✓

### 2.4 Polarization Management

LiNbO3 MZM is polarization-sensitive (TE or TM; typically TE).

**Ensure:**
- SMF-850 output is TE polarized (match chip design)
- Fiber pigtail oriented at chip connector (angular alignment ~±5°)
- If PMF required: Use Panda or bow-tie SMF variant (adds ~$100)

**Check:** View MZM output with polarizer. Should be >90% extinction ratio in TE.

---

## 3. Reference Cavity (Thermal Lock)

### 3.1 Design

Identical PTR cavity to main, but **unmodulated**:
- Same 24-layer stack
- No LiNbO3 modulator inline
- Fixed 850 nm laser input (stable, temperature-controlled laser)
- Photodiode readout locked to transmission peak

### 3.2 Locking Circuitry

**Pound lock (frequency-locking via feedback):**

```
[850 nm laser] → [Frequency shifter ±100 kHz] → [Ref. cavity]
                                                       ↓
                                            [Photodiode + amplifier]
                                                       ↓
                                            [Lock-in amp @ 100 kHz]
                                                       ↓
                                            [Error signal] → [Laser tuning PID]
```

- **Lock-in:** Recovers phase/amplitude at modulation frequency
- **Tuning:** Laser current or Peltier modulation (1 kHz bandwidth sufficient)

**Result:** Reference cavity phase stable to ±2 mrad over 1 hour.

### 3.3 Heterodyne Detection

**Beat signal:** Main cavity output mixed with reference on same detector:

```
I_beat = |E_main(t) · exp(iφ_main) + E_ref(t) · exp(iφ_ref)|²
```

Expands to:
```
I_beat = I_main + I_ref + 2√(I_main·I_ref) cos(φ_main - φ_ref + ωΔt)
```

The beat frequency (ωΔ ≈ 2π × 100 kHz) carries the phase difference.

**Demod:** Lock-in amplifier at 100 kHz extracts sin(φ_main - φ_ref) → phase error signal.

---

## 4. Optical Components (BOM)

| Item | Part # | Supplier | Cost | Qty |
|:---|:---|:---|:---|:---|
| SMF-850 fiber pigtail (1 m, FC/APC) | F-SMF-850-1M | Thorlabs | $50 | 2 |
| Collimating lens (11 mm, AR 850 nm) | AC254-011-A | Thorlabs | $80 | 1 |
| Kinematic fiber holder | FH-SM | Thorlabs | $150 | 1 |
| Piezo fiber stage (xyz) | MZF601/M | Thorlabs | $400 | 1 |
| 50/50 beam splitter (850 nm) | BS014 | Thorlabs | $100 | 1 |
| Reference PTR cavity (24 layer) | — | Custom | $300 | 1 |
| Photodiode (850 nm, 1 GHz) | PDA10CS | Thorlabs | $150 | 2 |
| Lock-in amplifier (100 kHz) | SR844 | SRS | $2500 | 1 |
| Laser 850 nm (fiber pigtail, 5 mW) | L850P005 | Thorlabs | $200 | 1 |
| **Total optics + detection** | | | **$3930** | |

---

## 5. Electronic Controllers (PID Implementation)

### 5.1 Embedded PID (Recommended)

**Platform:** Raspberry Pi 4 or STM32 microcontroller
- ADC: 12-bit @ 1 MSPS (digitize phase error)
- DAC: 12-bit @ 1 MSPS (output tuning voltage)
- GPIO: Control laser current modulation
- USB: Logging & parameter tuning

**Code skeleton (Python):**
```python
import numpy as np
from datetime import datetime

class CavityPIDController:
    def __init__(self):
        self.Kp, self.Ki, self.Kd = 0.1, 0.005, 0.0001
        self.integral_error = 0
        self.prev_error = 0
        self.dt = 1e-3  # 1 kHz update
        self.saturation_limit = 5.0
        
    def compute_control(self, phase_error_rad):
        # Proportional + Integral + Derivative
        self.integral_error += phase_error_rad * self.dt
        deriv = (phase_error_rad - self.prev_error) / self.dt
        
        u = (self.Kp * phase_error_rad + 
             self.Ki * self.integral_error + 
             self.Kd * deriv)
        
        # Anti-windup: clamp integral if saturating
        if u > self.saturation_limit or u < 0:
            self.integral_error -= phase_error_rad * self.dt
        
        u = np.clip(u, 0, self.saturation_limit)
        self.prev_error = phase_error_rad
        
        return u
    
    def log(self, phase_error, control_voltage):
        print(f"{datetime.now()}: e={phase_error:.3f} rad, u={control_voltage:.2f} V")
```

**Cost:** ~$50 (Raspberry Pi) + $30 (DAC/ADC breakout) = $80

### 5.2 Analog PID (Alternative)

If embedded control unavailable:
- Op-amp summing integrator (gains set by resistors/capacitors)
- Output ±5V or 0–5V adjustable
- No tuning capability; set once and forget

**Cost:** ~$20 (op-amps + passives)
**Downside:** Inflexible; can't adapt gains in real-time

---

## 6. Alignment Procedure (Phase 1 Setup)

1. **Cavity alignment:**
   - Mount PTR cavity on kinematic stage
   - Inject 850 nm from rear, observe forward output on power meter
   - Optimize for >80% transmission (Fabry-Perot resonance)

2. **Fiber coupling:**
   - Place collimating lens at cavity output
   - Mount SMF pigtail on xyz piezo stage
   - Align for >85% fiber coupling (check with IR viewer)
   - Lock alignment with set screws

3. **Reference cavity:**
   - Mount identical PTR cavity on second optical rail
   - Couple same laser (with 100 kHz modulation) into reference
   - Lock to transmission peak using Pound loop

4. **Heterodyne mixing:**
   - Combine main + reference beams on 50/50 splitter
   - Direct both onto photodiode
   - Observe beat signal at 100 kHz on oscilloscope
   - Optimize beam overlap for maximum fringe visibility

5. **PID tuning:**
   - Start with K_p = 0.05, K_i = 0, K_d = 0
   - Introduce small phase perturbation (modulate laser freq. by ±1 kHz)
   - Observe PID response; increase K_p until critically damped (~0.5 s settling time)
   - Add K_i to eliminate steady-state error
   - Fine-tune K_d to reduce overshoot

---

## 7. Validation Metrics (Phase 1)

- [ ] **Cavity finesse:** F = 50–100 (measure via transmission scan)
- [ ] **Fiber coupling:** >85% power transmission
- [ ] **Heterodyne visibility:** Fringe contrast >0.9
- [ ] **Phase stability (w/o PID):** Drift rate >1 mrad/min (confirms problem exists)
- [ ] **Phase stability (w/ PID):** <5 mrad/hour (validates lock)
- [ ] **Token budget:** Run 1000 inference passes; measure phase accumulation (expect <50 mrad by step 1000)

---

## 8. Timeline & Next Actions

| Week | Task | Owner | Deliverable |
|:---|:---|:---|:---|
| 1 | Source components (fiber, lens, cavity) | You | BOM ordered |
| 2 | Assemble optics bench + PID electronics | You | Physical setup |
| 3 | Align cavity & lock reference | You | Phase stability plot |
| 4 | Integrate LiNbO3 MZM; train 100-param RNN | You + Me | Convergence data |

