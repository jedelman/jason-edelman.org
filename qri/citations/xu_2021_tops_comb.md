# 11 TOPS Photonic Convolutional Accelerator for Optical Neural Networks
**Source:** Nature (2021)
**DOI:** 10.1038/s41586-020-03063-0
**Authors:** Xingyuan Xu, Mengxi Tan, Bill Corcoran, Jiayang Wu, et al.
**Institution:** Monash University / RMIT

## Core Claim
Optical frequency comb + time-wavelength interleaving achieves 11 TOPS (tera-operations per second) convolutional processing for image recognition. Demonstrated on chip using integrated micro-comb source.

## Key Architecture
- Input: time-interleaved on 49 WDM channels from micro-comb
- Weights: passive splitter + delay line (fixed at fabrication)
- MVM: each wavelength carries weighted replica; photodetection sums
- Throughput: 11 TOPS from 49 comb lines × optical bandwidth
- Demonstrated: MNIST 88%, CIFAR-10 image recognition

## Differentiation from QRI
| Aspect | 11 TOPS Comb | QRI |
|:---|:---|:---|
| Weights | Fixed splitter ratios | Holographic Δn(x,y), updatable |
| Parallelism | WDM (49 wavelengths) | Spatial (512 modes) |
| Architecture | Feedforward CNN | Recurrent wave RNN |
| Reconfigurability | None (fixed) | Write-develop cycle |
| Application | Image classification | Token inference (sequence model) |
| Throughput metric | TOPS (operations/sec) | tok/s (tokens/sec) — different unit |

## Key Performance Comparison
11 TOPS at 49 comb lines. QRI: 512 modes × 75M tok/s × ~512 MACs/token ≈ 20 TOPS equivalent, with recurrence enabling sequence modeling that feedforward cannot do.

## Citation in QRI Architecture
State-of-art throughput benchmark for photonic accelerators. QRI achieves comparable throughput with recurrent capability and updateable weights.
