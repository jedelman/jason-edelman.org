# Photonic Exponential Approximation via Cascaded TFLN Microring Resonators toward Softmax
**Source:** arXiv:2603.12934 (under review)
**Authors:** Hyoseok Park, Yeonsang Park (Chungnam National University, Korea)
**Submitted:** March 2026

## Relevance to Project
MEDIUM-HIGH. Directly contrasts with ORI's Layer 3 softmax equivalence proof (§4.5). Validates that photonic softmax is an active open problem; ORI's physical solution (carrier saturation → softmax-equivalent attention) is architecturally superior to approximation-based approaches.

## Key Claims
- Existing photonic transformer accelerators require electronic post-processing for softmax, creating O/E bottleneck
- Prior work (SOFTONIC) claims MRRs cannot handle softmax's exponential and division functions
- MRR-AEF: a passive Lorentzian cascade of N MRRs approximates e^{x_n - max(x)} with sub-2% worst-case error
- Validated with 3D FDTD simulations on X-cut TFLN MRRs up to 5-ring cascade

## Architecture
- Control signal detunes each ring; probe at fixed frequency sees Lorentzian transmission
- Cascading N stages → multiplicative transfer function whose log is approximately linear
- Enables exponential-function synthesis without dedicated nonlinear hardware

## Implications for ORI
1. **Contrast in §4.5:** MRR-AEF synthesizes an approximation of e^x. ORI proves that the SOA carrier saturation curve, VCSEL threshold, and FP resonant amplification *together* deliver the five structural properties of softmax without any approximation hardware — the physical softmax equivalence is exact (at the level of the five properties), not approximated.
2. Cite as: "Unlike explicit photonic softmax approximations [Park & Park 2026b], the ORI attention layer derives softmax-equivalent behavior from carrier saturation physics, requiring no dedicated approximation circuitry."
3. From the same group as PRISM (arXiv:2603.21576) — cite both together when discussing the photonic transformer accelerator landscape.

## Citation Format
Park, H., Park, Y. (2026). Photonic exponential approximation via cascaded TFLN microring resonators toward softmax. arXiv:2603.12934.
