# 2026-04-20 — ARCH-4 & ARCH-5: Throughput and SNR

## ARCH-4: Token Throughput

From ARCH-2 locked:
- L = 20 mm → τ = 2L/c = 133.3 ps
- T_op = 100 round trips
- Time per token: t_token = 100 × 133.3 ps = 13.3 ns
- Throughput: 75 M tokens/sec

**Validation:**
- Embedded target: 10-100 M tok/s typical; 75 M tok/s high-end but reasonable
- Real-time constraint (100 ms/token): 13.3 ns << OK ✓
- 24-layer stack: ~320 ns optically + 1.6 µs interposer = ~2 µs total latency ✓
- VCSEL modulation BW (5-10 GHz) >> required 75 MHz ✓

**ARCH-4 LOCKED:** Throughput is 75 M tok/s, non-negotiable (set by L and T_op from ARCH-2).

## ARCH-5: SNR Analysis

**Signal flow:**
```
Input: 2-3 mW per VCSEL (512 modes)
  ↓ Cavity finesse F=3140 → ~1000× field amplitude
  ↓ Intra-cavity power: 2-3 W
  ↓ Round-trip loss over T=100: L_total = 0.995^100 = 0.606 (-2.4 dB)
  ↓ Output power: ~1.2-1.8 W
  ↓ Si PIN detector (0.6 A/W) → 0.36-0.54 A photocurrent
  ↓ TIA + comparator → 6-bit quantized output
```

**Noise:**
- Shot noise (dominant): σ ≈ √(2eIΔf) ≈ 10 µA at I=0.4A, Δf=1 GHz
- Thermal noise: ~10 µV (negligible)
- RIN: -120 dB/Hz (negligible)

**SNR calculation:**
```
SNR = 0.4 A / 10 µA ≈ 40 dB
Target: 38 dB (6-bit quantization per Dettmers 2022, Frantar 2022)
Margin: +2 dB ✓
```

**ARCH-5 LOCKED:** Input 2-3 mW per VCSEL delivers SNR ≥ 38 dB at T=100.

**Risk flags:**
1. PTR glass thermal stability @ 850 nm CW unknown. Glebov et al. (2010) tested UV write/read; no CW heating data at 850 nm.
2. Thermal lensing: 1-3 W intra-cavity → dn/dT drift → cavity destabilization. Needs active thermal control or cavity design for dn/dT ≈ 0.
3. If R_eff drops (absorption at 850 nm), finesse falls, SNR margin erodes. Conservative: target R > 0.9995.

## Design Space Implications

- Throughput + SNR are decoupled in this architecture (unlike digital GPUs where both scale with power).
- Throughput set by cavity geometry (ARCH-2).
- SNR set by input power and noise floor (shot noise dominated).
- Trade-off: higher input power → better SNR but → more thermal load on PTR glass.
- Optimal: 2-3 mW input balances SNR (38 dB) with thermal management (<1 W average per 512 channels).

## Next: ARCH-6 (Training), ARCH-7 (Hologram Capacity)

ARCH-6 (training) requires differentiable wave equation solver.
ARCH-7 (capacity) critical for determining model size (1B params?).
