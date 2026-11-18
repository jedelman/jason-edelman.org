# Deep Learning with Coherent Nanophotonic Circuits
**Source:** Nature Photonics (2017)
**DOI:** 10.1038/nphoton.2017.93
**Authors:** Yichen Shen, Nicholas C. Harris, Scott Skirlo, Mihail Popescu, et al.
**Institution:** MIT

## Core Claim
An MZI (Mach-Zehnder interferometer) mesh on a silicon photonic chip implements any unitary matrix via the Reck decomposition. Demonstrated vowel classification at 97% accuracy with a 4×4 unitary network.

## Architecture
- MZI mesh: cascaded beam splitters + phase shifters implementing SVD decomposition W = UΣV†
- Weight representation: continuous phase shifts (thermo-optic or electro-optic)
- Nonlinearity: electronic between layers (detect → threshold → re-modulate)
- In-situ programming: phase shifters tunable, weights reprogrammable
- Platform: silicon photonics, telecom wavelengths

## Key Results
- 4×4 optical neural network demonstrated
- Vowel classification: 96.7% (2 neurons) to 97.6% (56 neurons)
- Energy: sub-pJ per multiply-accumulate (estimated)

## Differentiation from QRI
| Aspect | MZI Mesh | QRI |
|:---|:---|:---|
| Weight matrix type | Unitary only (lossless) | General (rank-50 holographic) |
| Weight storage | Volatile (phase shifter state) | Non-volatile (PTR hologram) |
| Scale | ~100 modes practical limit | 512 modes |
| Reconfiguration | Fast (µs thermo-optic) | Slow (write-develop cycle, ~days) |
| Recurrence | None (feedforward) | Resonator round trips |
| Training | Offline gradient descent | In-situ Hebbian (2-wavelength) |
| Power per weight | ~10mW per phase shifter | Zero (passive hologram) |

## Key Limitation for LLM Inference
Unitary constraint limits expressibility. Power consumption scales with number of phase shifters (10mW each × N² for N-mode unitary = impractical at 512 modes = 26MW). Not recurrent.

## Citation in QRI Architecture
Establishes MZI mesh as the dominant integrated ONN approach and its fundamental unitary constraint. QRI avoids this by using holographic gratings (non-unitary, rank-factored) and resonator recurrence rather than feedforward depth.
