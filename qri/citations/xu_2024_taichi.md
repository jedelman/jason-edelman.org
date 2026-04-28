# Large-Scale Photonic Chiplet Taichi Empowers 160-TOPS/W AI Computing
**Source:** Science (2024)
**DOI:** 10.1126/science.adl1203
**Authors:** Guangwei Xu et al.
**Institution:** Tsinghua University

## Core Claim
Taichi: a photonic chiplet integrating 4M+ optical neurons achieving 160 TOPS/W energy efficiency — ~1000× better than GPU baseline. Demonstrated large-scale AI inference tasks.

## Architecture
- Photonic chiplet: diffractive + MZI hybrid on silicon photonics
- Scale: 4M optical neurons (claimed)
- Energy: 160 TOPS/W (operations per Watt)
- Task: demonstrated ImageNet classification, other vision tasks
- Training: offline (digital), inference on chip

## Key Differentiation from QRI
| Aspect | Taichi | QRI |
|:---|:---|:---|
| Architecture | Feedforward diffractive/MZI | Recurrent holographic resonator |
| Weights | Fixed (fab-time) | Updatable (in-situ Hebbian) |
| Application | Vision inference | LLM token inference |
| Energy efficiency | 160 TOPS/W | ~TBD (not yet derived) |
| Reconfigurability | None | Write-develop cycle |
| Sequence modeling | Not demonstrated | Native (wave RNN) |

## Significance
This is the most competitive energy efficiency benchmark in optical neural networks as of 2024. It validates the energy advantage of optical over digital (160 TOPS/W vs ~1 TOPS/W GPU). QRI must eventually compare against this.

## Open Question for QRI
Our economic analysis cites ~44× carbon advantage vs GPU. Taichi claims ~1000× energy efficiency. If Taichi is valid, QRI needs to justify why recurrent holographic approach is preferable to chiplet approach for LLM token inference specifically. Answer: feedforward chiplets cannot do autoregressive generation; they require N passes for N-token context, each pass digitally managed. QRI's resonator naturally implements the hidden state update.

## Citation Priority
HIGH — this is the most recent and most impressive competing benchmark. Must address in related work.
