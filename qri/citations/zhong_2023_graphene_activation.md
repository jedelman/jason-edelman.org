# Graphene/Silicon Heterojunction for Reconfigurable Phase-Relevant Activation Function in Coherent ONNs
**Source:** Nature Communications (2023)
**DOI:** 10.1038/s41467-023-36877-9
**Authors:** Zhong et al.
**Institution:** (Chinese institutions, exact affiliation TBD)

## Core Claim
Graphene integrated on a silicon waveguide implements an electro-absorptive nonlinearity that can serve as a reconfigurable activation function in coherent optical neural networks. The graphene Fermi level is tunable via gate voltage, enabling programmable saturation behavior.

## Key Physics
- Graphene absorption: tunable 0–2.3% per pass via gate voltage (Fermi level shift)
- Nonlinearity: saturable absorption (intensity-dependent loss)
- Phase activation: absorbed field creates carrier plasma → refractive index shift → phase modulation
- Reconfigurability: gate voltage set in ns timescale

## Relevance to QRI
This is the most recent all-optical activation function approach. Directly relevant because:
1. It's an amplitude nonlinearity (not just phase) — what we originally wanted
2. Demonstrated in coherent ONN context (not spiking)
3. Reconfigurable threshold via external control

## Why QRI Does Not Adopt This
- Requires intra-cavity element: graphene-on-waveguide requires insertion into optical path
- Insertion loss per pass: even 0.1 dB/pass × 100 round trips = 10 dB loss — kills SNR budget (ARCH-2/3 constraint)
- Fabrication complexity: graphene integration on PTR glass not established
- QRI's VCSEL threshold achieves same functional result with zero intra-cavity loss

## Citation in QRI Architecture
Most recent all-optical activation function. Explicitly considered and rejected: insertion loss incompatible with high-finesse cavity operation. VCSEL threshold ReLU achieves equivalent expressiveness without intra-cavity elements.
