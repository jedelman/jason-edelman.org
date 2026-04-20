# 2026-04-20 — ARCH-3: Transverse Mode Structure

## Problem
How many orthogonal spatial modes fit in the PTR aperture? Can we address d=512 token embedding dimensions via spatial modes?

## Key Finding: Confocal Cavity Supports ~7400 Modes

**Cavity geometry (from ARCH-2 locked):**
- L = 20 mm
- λ = 850 nm
- Confocal: R_c = L → z_R = L/2 = 10 mm
- Fundamental TEM_00 waist: w₀ = √(λ z_R / π) = 5.2 µm

**Higher-order modes fit within aperture D = 2.5 mm:**
```
Spatial extent of TEM_mn ≈ (2m+2n+1) · w₀
For TEM_mn to fit: (2m+2n+1) · 5.2µm ≤ 1.25 mm (half aperture)
⇒ m_max + n_max ≈ 60
⇒ N ≈ 2(m_max+1)(n_max+1) ≈ 7400 modes
```

Fresnel number confirms: F = D²/(4λL) = 78 >> 1 → multimode regime.

**Conclusion:** Aperture can support far more than 512 modes. Breathing room = good.

## Input Coupling: VCSEL Fiber Array

Token x ∈ ℝ^512 encoded as spatial field via VCSEL array:
- Grid: √512 ≈ 23×23 elements
- Pitch: 50 µm (Glass Brain validated spec)
- Array footprint: 1.15 mm
- Magnified to cavity: 2.5 mm (2.2× lens pair)
- Coupling efficiency: η ≥ 80% (typical confocal cavity)

Each VCSEL i launches ~50µm beam → couples to TEM_mn modes with overlap weighted by beam profile. Orthogonality guaranteed by eigenmode structure.

## Polarization Decision: Single Vertical

**Considered:** Use both H and V polarizations → 1024 modes from same aperture.

**Rejected, reasons:**
1. **Dichroism:** HR mirrors @ 850nm have R_p ≠ R_s. Two polarizations see different finesse, complicates loss budget (ARCH-2 derivation).
2. **Interposer power:** 2× detectors/amplifiers → 2.6 kW total power for 1024 nodes. Embedded constraint violation.
3. **Complexity:** Polarization-maintaining fiber, SOP control, retarders. Glass Brain doesn't do this; adds alignment sensitivity.
4. **Unnecessary:** 512 modes fit with 2× margin. Second polarization = featurecreep.

**Locked:** Vertical polarization only (VCSEL native). Upgrade path deferred.

## Sub-Question: Why Not Both?

Initial pushback (correct): "Why throw away capacity?"

**Answer:** Embedded device constraint + no gain per added complexity. We have aperture margin (7400 >> 512). The bottleneck is hologram capacity (ARCH-7), not mode count. If ARCH-7 shows we need 1024 weight dimensions, revisit polarization. For now, single-pol keeps interposer/Glass Brain compatibility and power budget realistic.

## ARCH-3 LOCKED

| Parameter | Value |
|---|---|
| Cavity shape | Confocal (R_c=L=20mm, one flat mirror) |
| Transverse modes | >7000 supported |
| Modes addressed | 512 via VCSEL array |
| Polarization | Vertical linear |
| VCSEL pitch | 50 µm |
| Cavity aperture | 2.5 mm |
| Fundamental waist | 5.2 µm |
| PTR insert size | 5×5×2 mm |

## Next Steps

- **ARCH-4:** Token throughput. At T=100, τ=133ps → 75M tok/s. Is this embedded target rate?
- **ARCH-5:** SNR over T round trips. Finesse buildup mitigates loss; expect SNR >> 6 bits at T_op=100.
- **ARCH-7:** Hologram capacity. How many weight entries in Δn(x,y)? This may be the true bottleneck.
