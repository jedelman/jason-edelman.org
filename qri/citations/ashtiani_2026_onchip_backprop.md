# Integrated Photonic Neural Network with On-Chip Backpropagation Training
**Source:** Nature 651, 927–932 (2026)
**DOI:** https://doi.org/10.1038/s41586-026-10262-8
**Authors:** Farshid Ashtiani, Mohamad Hossein Idjadi, Kwangwoong Kim (Nokia Bell Labs)
**Published:** March 18, 2026
**arXiv preprint:** arXiv:2506.14575 (June 2025)

## Relevance to Project
HIGH. Directly validates ORI's in-situ optical training architecture. Prior art for the general principle that on-chip optical gradient computation can achieve reliable training despite fabrication variations — the same argument ORI makes for DX holographic in-situ training (§3.4).

## Key Result
End-to-end on-chip gradient-descent backpropagation, all linear and nonlinear computations on a single silicon photonic chip. Demonstrated XOR and 2D classification tasks at accuracies on par with digital models. Key finding: in-situ training is *more robust* to device variation than digital training + weight loading, because the gradient is computed on the physical device itself.

## Architecture vs ORI
- **Their platform:** Silicon MZI mesh (feedforward, reconfigurable phase shifters, OEO nonlinearity)
- **ORI platform:** Holographic DX gratings in bulk semiconductor FP cavity (recurrent, holographic weight encoding, all-optical nonlinearity)
- **Their training:** Phase-shifter voltage updates via intensity monitors
- **ORI training:** 810 nm adjoint beam writes DX grating in situ (§3.4)

The training *principle* is shared (adjoint / in-situ gradient). The physical substrate and computation class are different (feedforward chip vs. holographic SSM).

## Implications for ORI
1. The fabrication variation argument is now experimentally confirmed: weight translation from digital fails; in-situ training is mandatory. This directly supports our ARCH-locked position that weight translation from digital is infeasible (§3.4, §5).
2. Cite as validation of in-situ backpropagation principle alongside Pai et al. 2023.
3. **Update citation in final_paper.md from arXiv preprint to published DOI.**

## Citation Format
Ashtiani, F., Idjadi, M.H., Kim, K. (2026). Integrated photonic neural network with on-chip backpropagation training. *Nature* 651, 927–932. https://doi.org/10.1038/s41586-026-10262-8
