# Recurrent Neural Networks Implemented Through Spatiotemporal Light Propagation in Optical Fibers
**Source:** arXiv:2602.19246
**Authors:** Dilem Eşlik et al. (incl. Uğur Teğin)
**Submitted:** February 22, 2026

## Relevance to Project
MEDIUM. Experimental precedent for optical recurrence emerging from wave physics — the same class of claim ORI makes in §2.1. Key distinction: their system is reservoir computing (fixed, untrained weights); ORI implements trained holographic SSM.

## Key Claims
- Multimode optical fibers naturally implement spatiotemporal recurrent computation through passive light propagation
- Video frames encoded onto separate beams with controlled time delays; beams combine and recirculate through fiber loop
- Interference and nonlinear propagation generate high-dimensional states encoding current inputs + fading memory
- Entire system: no trainable parameters, no electronic feedback
- Demonstrated on: chaotic time-series forecasting, action recognition, autonomous driving, surgical skill assessment
- All tasks competitive with trained digital RNNs

## Architecture vs ORI
- **Their recurrence:** Passive modal mixing + nonlinear propagation in multimode fiber loop (reservoir)
- **ORI recurrence:** Holographic DX grating encodes trained W; M^T round-trip operator is the RNN update; T=100 is learned depth
- **Their weights:** None (emergent from geometry)
- **ORI weights:** Trained holographic gratings, continuously updated at 500K grad/s
- **Their expressivity:** Reservoir class (echo-state networks; universal approximation with sufficient reservoir size but limited trainable capacity)
- **ORI expressivity:** Full SSM-class (trained A matrix, trained B/C projections)

## Implications for ORI
1. **Cite in §2.1** as additional experimental evidence that optical wave dynamics naturally implement recurrence, alongside Hughes et al. 2019.
2. **Explicitly note the distinction:** Eşlik et al. demonstrate that passive optical dynamics can implement reservoir-class recurrence without training. ORI implements trained recurrence — a strictly stronger capability requiring holographic weight encoding and optical adjoint gradient computation.
3. Strengthens the framing that photonic recurrence is physics, not engineering approximation.

## Citation Format
E�lik, D., et al. (2026). Recurrent neural networks implemented through spatiotemporal light propagation in optical fibers. arXiv:2602.19246.
