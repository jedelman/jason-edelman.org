# All-Optical Machine Learning Using Diffractive Deep Neural Networks (D²NN)
**Source:** Science (2018)
**DOI:** 10.1126/science.aat8084
**Authors:** Xing Lin, Yair Rivenson, Nezih T. Yardimci, Muhammed Veli, Yi Luo, Mona Jarrahi, Aydogan Ozcan
**Institution:** UCLA

## Core Claim
Multiple passive diffractive layers, each a phase/amplitude mask, implement a deep neural network entirely in the optical domain. Computation occurs at the speed of light with no electronic processing between layers.

## Architecture
- Each layer: a physical mask with trainable phase/amplitude at each pixel (neuron)
- Propagation between layers: free-space Rayleigh-Sommerfeld diffraction
- Training: backpropagation through the diffraction simulation (offline, GPU)
- Weights fixed at fabrication (3D printed or lithographic)
- Nonlinearity: none explicit — relies on diffraction interference patterns
- Demonstrated at THz frequencies (0.4 THz); optical implementations followed

## Key Results
- MNIST digit classification: 91.75% accuracy (5 layers, 0.8M neurons)
- Fashion-MNIST: 86.60% accuracy
- Speed: operates at speed of light, power = input beam power only
- Latency: essentially propagation time (~cm/c ~ 30ps per layer)

## Differentiation from QRI
| Aspect | D²NN | QRI |
|:---|:---|:---|
| Weights | Fixed at fab, static | In-situ Hebbian, updatable |
| Computation | Feedforward only | Recurrent (resonator round trips) |
| Nonlinearity | None (linear diffraction) | ReLU via VCSEL threshold |
| Weight storage | Physical mask geometry | Holographic Δn(x,y) in PTR glass |
| Retraining | Requires new physical mask | Write new hologram, same device |
| Embedding dimension | Limited by mask pixel count | 512 modes, confocal cavity |
| Token rate | Not applicable (image/frame-based) | 75M tok/s |

## Key Limitation for LLM Inference
Feedforward, static weights, frame-based input. Not designed for autoregressive token generation. Cannot update weights without fabricating a new device.

## Citation in QRI Architecture
Establishes diffractive ONN as prior art. QRI differs by: (1) resonator recurrence vs. feedforward, (2) holographic vs. fixed-mask weights, (3) in-situ training vs. fab-time only.
