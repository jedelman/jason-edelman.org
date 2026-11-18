# All-Optical Spiking Neurosynaptic Networks with Self-Learning Capabilities
**Source:** Nature (2019)
**DOI:** 10.1038/s41586-019-1157-8
**Authors:** Johannes Feldmann, Nathan Youngblood, C. David Wright, Harish Bhaskaran, Wolfram H.P. Pernice
**Institution:** University of Münster / Oxford

## Core Claim
Phase-change material (GST — Ge₂Sb₂Te₅) integrated with microring resonators implements nonvolatile synaptic weights with spike-timing-dependent plasticity (STDP). Demonstrated on-chip all-optical spiking neural network.

## Architecture
- Synapses: GST cells on waveguide, switched between amorphous (low loss) and crystalline (high loss) states
- Neurons: microring resonators with saturable absorber nonlinearity (excitable)
- Learning: STDP via optical pulse timing (Hebbian-compatible)
- Demonstrated: pattern recognition, XOR logic

## Differentiation from QRI
| Aspect | PCM-SNN | QRI |
|:---|:---|:---|
| Weight storage | GST phase state (nonvolatile) | PTR holographic Δn (nonvolatile) |
| Nonlinearity | Saturable absorber (MRR) | VCSEL threshold (ReLU) |
| Learning | STDP (local, unsupervised) | Adjoint backprop (gradient-based) |
| Endurance | ~10⁶ write cycles (PCM limit) | ~10³ grating write cycles (PTR limit — EXP-3) |
| Precision | ~4-bit (PCM states) | ~6-bit (SNR-limited) |
| Bandwidth | GHz (spiking) | 75M tok/s continuous |
| Application | Pattern recognition, logic | LLM token inference |

## Critical Limitation
PCM endurance: GST degrades after ~10⁶ crystallization cycles. For continuous online learning at inference speeds, this fails in hours. QRI avoids this — PTR gratings are written once per training epoch (not per token).

## Citation in QRI Architecture
Establishes PCM as prior nonlinearity approach. QRI explicitly rejects PCM: endurance failure, 4-bit precision insufficient for LLM, crystallization latency incompatible with 75M tok/s.
