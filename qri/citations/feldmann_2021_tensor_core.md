# Parallel Convolutional Processing Using an Integrated Photonic Tensor Core
**Source:** Nature (2021)
**DOI:** 10.1038/s41586-021-03257-y
**Authors:** Johannes Feldmann, Nathan Youngblood, Maxim Karpov, et al.
**Institution:** University of Münster / EPFL

## Core Claim
Optical frequency comb + PCM weight bank + photodetection implements parallel convolutional neural network inference. Claimed TOPS-scale throughput via wavelength-division multiplexing.

## Architecture
- Weights: PCM cells on microring resonators, one per wavelength×weight
- Input: modulated onto optical frequency comb (WDM parallelism)
- Computation: each ring weights one wavelength component; all-optical MVM
- Throughput: demonstrated image recognition (MNIST, CIFAR-10)

## Key Results
- Demonstrated vowel recognition, image classification
- Parallelism via 49-line frequency comb
- Energy efficiency advantage claimed over digital CMOS

## Differentiation from QRI
| Aspect | Photonic Tensor Core | QRI |
|:---|:---|:---|
| Architecture | Feedforward CNN | Recurrent wave RNN |
| Weight medium | PCM on waveguide | PTR holographic grating |
| Parallelism | WDM (wavelength) | Spatial mode (512 modes) |
| Nonlinearity | Electronic (inter-layer) | VCSEL threshold ReLU |
| Reconfigurability | PCM (limited endurance) | Holographic (write-develop) |
| Token inference | Not demonstrated | Native (wave RNN = sequence model) |
| Scale | ~50 wavelengths practical | 512 spatial modes |

## Key Limitation
PCM endurance and inter-layer electronics. Feedforward architecture not naturally suited to autoregressive token generation. WDM parallelism limited by comb line count and EDFA bandwidth.

## Citation in QRI Architecture
State-of-art photonic tensor accelerator at time of writing. QRI differentiates by: recurrent (not feedforward), spatial mode (not WDM), holographic weights (not PCM), and native sequence modeling.
