# Mamba-3: Improved Sequence Modeling using State Space Principles
**Source:** ICLR 2026
**Authors:** Gu, Dao et al.
**arXiv:** arXiv:2603.15569

## Relevance to Project
MEDIUM. Extends ORI's competitive framing. Mamba-3 is now the SSM state-of-the-art; relevant to §1 and the Gen-roadmap competitive benchmarking.

## Key Changes from Mamba-1/2
1. **Exponential-trapezoidal discretization** (replaces first-order Euler in Mamba-1/2): second-order accurate approximation of the continuous-time SSM integral
2. **Complex-valued state updates:** A matrix is complex with both real (data-dependent decay) and imaginary (rotational, via RoPE) components
3. **MIMO formulation:** Multi-Input Multi-Output structured state space, enabling wider state with the same training cost
4. BC Normalization (RMSNorm on B, C projections) stabilizes large-scale runs
5. Widely adopted in hybrid models (NVIDIA Minitron, Kimi, Tencent Hunyuan) that match pure transformer performance

## Mamba SSM Arithmetic Intensity Note
In standard SSM decoding, arithmetic intensity ≈ 2.5 ops/byte — far below the compute-bound regime of modern GPUs (H100 roofline). SSMs are memory-bandwidth-bottlenecked on current hardware, not compute-bottlenecked. ORI eliminates this entirely: weight access is optical (no DRAM reads).

## Implications for ORI
1. **Complex-valued A alignment (important):** ORI's round-trip operator M is already complex-valued (field amplitudes → complex phasor). The imaginary component of M implements phase rotation — structurally equivalent to Mamba-3's imaginary A. ORI naturally maps to Mamba-3 expressivity, not just Mamba-1/2. Update §1 competitive framing accordingly.
2. **Benchmarking update:** Gen 1 ORI is sub-Mamba-130M class. The relevant comparison should now reference Mamba-3 (not just Mamba-1 or Mamba-2) as the SSM SOTA.
3. **Arithmetic intensity argument:** Cite the 2.5 ops/byte figure to sharpen the energy efficiency case — ORI eliminates the DRAM memory wall that makes even SSMs expensive on GPUs.

## Citation Format
Gu, A., Dao, T., et al. (2026). Mamba-3: Improved sequence modeling using state space principles. ICLR 2026. arXiv:2603.15569.
