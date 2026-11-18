# Optical Neural Networks: Progress and Challenges
**Source:** Light: Science & Applications (2024)
**DOI:** https://doi.org/10.1038/s41377-024-01590-3
**Authors:** Fu T.Z., Chen H.W., et al.
**Saved in Notion:** Science database

## Relevance to Project
HIGH. Comprehensive survey of the optical neural network field. Covers all major optical MVM approaches. Essential field map before deriving resonator architecture.

## Key Architectural Approaches Covered
1. **4f systems** — Fourier-plane phase mask implements convolution. Weight matrix = mask at Fourier plane. Reconfigurable via SLM/DMD. Nonlinearity: electronic or EIT-based.
2. **D2NN (Diffractive Deep Neural Networks)** — Multiple diffractive layers, each neuron = phase/amplitude cell. Weights trained offline, fixed at fab. Lin et al. 2018 is the landmark.
3. **MZI mesh** — Singular value decomposition → cascade of MZIs implements any unitary matrix. Shen et al. 2017 demonstrated 4×4. Integrated on-chip.
4. **MRR weight banks** — Wavelength-division multiplexing, ring resonators set weights. Tait et al. 2016 foundational.
5. **PCM-MRR hybrid** — Phase-change material gives nonlinearity AND nonvolatile weight storage. Feldmann et al. 2019, 2021.
6. **Reservoir computing** — Delay-loop + nonlinearity (SOA). Duport et al. 2012.
7. **VCSEL-based SNN** — Spiking neural networks via VCSEL saturable absorber.

## Critical Observations for Resonator Design
- All current ONNs decouple linear (optical) and nonlinear (usually electronic) operations
- Scalability bottleneck: optoelectronic conversion at layer boundaries
- PCM nonlinearity promising but endurance-limited (confirmed our prior finding)
- Resonator-based ONNs mentioned only briefly (Fabry-Perot, saturable absorber neurons)
- No paper addresses coherent resonator as a computational primitive for token inference

## Key Citations to Investigate
See TASKS.md for full list.
