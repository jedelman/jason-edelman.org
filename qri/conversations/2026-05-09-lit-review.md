# Session: Literature Review — May 9, 2026

## Summary
Systematic web search for post-training-cutoff literature relevant to ORI. Searched across all key physics domains: DX holography, optical backpropagation, photonic recurrence, SOA gain holography, photonic attention/softmax, SSM hardware.

## Key Findings

### 1. Ashtiani et al. *Nature* 2026 — On-chip backpropagation confirmed
- DOI: 10.1038/s41586-026-10262-8
- Our preprint cite upgraded to published Nature paper
- Validates: in-situ training more robust than digital weight loading for photonic devices
- Architecture differs (Si MZI chip vs. holographic DX FP), principle shared

### 2. Park & Park, PRISM arXiv:2603.21576 — Validates our O(n) attention framing
- March 2026, under review
- Independently establishes that full photonic attention inherits O(n) memory scaling
- PRISM offloads KV cache block selection to photonics (O(1)), not attention compute
- Directly supports our §1 SSM-class positioning argument
- Added to §5 limitations/scope paragraph in final_paper.md

### 3. Park & Park, MRR-AEF arXiv:2603.12934 — Contrast for our softmax proof
- March 2026, same group as PRISM
- Photonic softmax via cascaded TFLN MRR Lorentzian approximation, sub-2% error
- ORI contrast: SOA carrier saturation delivers softmax-equivalent properties physically, no approximation hardware needed
- Added as contrast citation context

### 4. Eşlik et al. arXiv:2602.19246 — Passive optical recurrence experimental precedent
- February 2026
- Multimode fiber loop implements reservoir-class RNN via passive spatiotemporal dynamics
- No trainable weights — explicitly weaker than ORI (reservoir vs. trained SSM)
- Cite in §2.1 as experimental evidence that optical wave dynamics naturally implement recurrence

### 5. Mamba-3, ICLR 2026 (arXiv:2603.15569)
- Complex-valued A matrix (real + imaginary via RoPE)
- ORI's round-trip operator M is already complex — naturally maps to Mamba-3 expressivity
- SSM arithmetic intensity ≈ 2.5 ops/byte on GPU — memory-bandwidth-bottlenecked; ORI eliminates DRAM
- Updated §5 competitive framing reference

## Files Changed
- docs/final_paper.md: updated §2.3 (Ashtiani 2026 inline), §5 (PRISM + Mamba-3 in scope paragraph), §1 intro (Eşlik recurrence), references 23-27 added
- citations/ashtiani_2026_onchip_backprop.md: new
- citations/park_2026_prism_kvcache.md: new
- citations/park_2026_mrr_aef_softmax.md: new
- citations/eslik_2026_optical_fiber_rnn.md: new
- citations/gu_dao_2026_mamba3.md: new

## Strategic Conclusion
No competing all-optical recurrent LLM inference architectures found. All photonic accelerator work is feedforward (MZI/MRR chips) or hybrid transformer (requires electronic softmax). ORI's holographic SSM positioning is unchallenged in current literature. The 2026 papers uniformly validate our architectural framing rather than threaten it.

## Open Items (Unchanged)
EXP-16 (α_FCA in Al₀.₃₈GaAs at 850nm) remains the highest-priority blocker for SNR margin confirmation. No new experimental data found on DX-center holography or free-carrier absorption in our material/wavelength regime.
