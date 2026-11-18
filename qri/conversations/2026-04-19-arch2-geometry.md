# 2026-04-19 — ARCH-2: Resonator Geometry Derivation

## Architecture constraint
850nm confirmed, locked. Embedded device, single-tenant.

## Key finding: Two coherence regimes

The derivation exposed a critical architectural choice that wasn't visible before:

**Regime A (coherent, T << T_coh):** Field accumulates coherently over T round trips. This is the true resonator regime — finesse-enhanced, field builds up like a Fabry-Perot. Hughes 2019 RNN mapping is VALID here. Requires T << T_coh, i.e., source linewidth << c/(2LT).

**Regime B (incoherent, T >> T_coh):** Coherence lost between round trips. Each pass through hologram is independent. SNR ∝ sqrt(T). This is a T-layer feedforward system using the same plate, NOT an RNN. Hughes 2019 does not apply. This is essentially Glass Brain with a folded path.

**Decision: Target Regime A.** The resonator is only genuinely novel vs Glass Brain if it operates coherently. Regime B just gives us a more compact feedforward device — useful, but not what this project is about.

## Coherence constraint drives design

For T_op = 100 round trips to remain coherent:
  Required: linewidth << c0 / (2 * L * T_op)
  At L=20mm: linewidth << 75 MHz

Single-mode VCSEL at 850nm has linewidth ~10 MHz.
T_coh at L=20mm, lw=10MHz: T_coh = l_c / (2L) = 30m / 40mm = 750 round trips.
T_op = 100 << T_coh = 750. ✓ Coherent regime comfortably achieved.

## Finesse enhancement

At R = 0.9990:
  Finesse F = π√R / (1-R) = 3140
  Enhancement factor = F/π ≈ 999× signal amplitude relative to single pass
  Power enhancement ≈ 10⁶× (!) at resonance

This is the key advantage of operating in Regime A. SNR is NOT limited by per-pass attenuation — the cavity resonance concentrates field energy into the medium. This is why Fabry-Perot was the right geometry choice.

## ARCH-2 Locked Parameters

| Parameter | Value | Rationale |
|---|---|---|
| Wavelength | 850nm | LOCKED ARCH-1 |
| Cavity geometry | Linear Fabry-Perot | LOCKED ARCH-1 |
| Cavity length L | 20mm | T_coh = 750 >> T_op = 100 at SM-VCSEL linewidth |
| Round-trip time τ | 133 ps | τ = 2L/c₀ |
| Mirror reflectivity R | 0.9990 | Practical dielectric HR @ 850nm, Finesse=3140 |
| Round-trip loss | 0.023 dB | 2× mirror + 2× PTR plate (0.014 dB/pass) |
| Operating round trips T_op | 100 | Well within T_coh, sufficient computational depth |
| Time per token | 13.3 ns | T_op × τ = 100 × 133ps |
| Token rate | 75M tok/s | 1 / (100 × 133ps) |
| Coherence margin | 7.5× | T_coh / T_op = 750 / 100 |
| Source linewidth | ≤10 MHz | Single-mode VCSEL, required for coherent regime |
| Aperture | ≥2.3mm | 23×23 = 529 modes ≥ 512 embedding dims |

## SNR in coherent regime

With finesse F=3140, field enhancement ≈ 1000×, power ≈ 10⁶× at resonance.
Even with modest input power, the intra-cavity power far exceeds the noise floor.
Detailed SNR: to be computed in ARCH-5 with cavity buildup model.
Expected: SNR >> 6 bits at T_op=100, easily achievable.

## Open questions raised

1. **PTR grating under finesse buildup:** Intra-cavity power at resonance is ~10⁶× input. At 1mW input → 1kW intra-cavity. PTR damage threshold: unknown at 850nm under CW or quasi-CW illumination. This may set a hard upper limit on input power and therefore finesse. RISK FLAG.

2. **Mode stability:** Flat-flat cavity is marginally stable. Need at least one curved mirror (or intracavity lens) for TEM_mn mode confinement. Does not change the fundamental derivation but affects implementation.

3. **Holographic grating at high intra-cavity power:** PTR glass written at UV, read at 850nm. But if intra-cavity power is high, is there any two-photon absorption or photo-darkening at 850nm? Literature check needed.

## What T_op=100 means computationally

100 round trips = 100 RNN steps = 100 layers of effective computation from ONE physical plate.
At d=512 modes: each layer computes a 512×512 effective weight update (constrained by Laplacian locality in Hughes 2019 model).
Total parameter equivalent: ~512² × 100 = 26M effective parameters per resonator.
For a multilayer stack of N_r resonators: N_r × 26M params.
10 resonators → ~260M parameters. Reasonable for a compact embedded model.
