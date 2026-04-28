# Large-Scale Photonic Chiplet Taichi Empowers 160-TOPS/W AI Computing
**Source:** Science 384(6692), 202-209 (2024)
**DOI:** 10.1126/science.adl1203
**Authors:** Zhihao Xu, Tiankuang Zhou, Muzhou Ma, ChenChen Deng, Qionghai Dai, Lu Fang
**Institution:** Tsinghua University / BNRist

## Core Claim
Taichi: a distributed diffractive-interference hybrid photonic chiplet achieving 160 TOPS/W energy efficiency with millions-of-neurons scale. Demonstrated 1623-category classification (91.89% accuracy on Omniglot) and AI-generated content.

## Architecture
- Hybrid diffractive + MZI interference per execution unit (TEU)
- Input: fixed-size image patches (32×32 pixels per TEU)
- Output: compressed patch (16×16) — spatial pooling behavior
- Scale: distributed across multiple TEUs for large inputs
- Weights: fixed at load time (pre-trained offline, digitally)
- Training: entirely offline and digital — Taichi is inference-only

## Efficiency Accounting (from supplementary)
```
FLOPs per TEU: 25.19M
Data rate: 2.0 GHz
Total system power: 313.27W (16 VOAs + laser + drivers)
TOPS/W = 25.19M × 2.0GHz / 313.27W = 160.8 TOPS/W
```

Note: the 313W figure covers total system power for one configuration.
The FLOPs count (25.19M per TEU) is the compute in one execution unit.
For a 256×256 image requiring 64 TEUs, the total compute scales but
the power accounting details are ambiguous in the supplementary.

## What Taichi Demonstrated
- Omniglot 1623-category classification: 91.89% accuracy
- 2D image generation (spatial pattern synthesis)
- Bach chorale generation — but: "training and generating were independently processed"
  → Training is digital, offline. Generation is a forward pass through fixed weights.
  → This is NOT autoregressive sequence generation.

## What Taichi Cannot Do: The Sequence Modeling Gap

Taichi's architecture is fundamentally feedforward and stateless:

1. **No recurrent hidden state.** Each forward pass is independent. There is no mechanism to carry computational state from input t to input t+1.

2. **Fixed input dimensionality.** Patches are 32×32. Variable-length sequences (e.g., tokens of length 1 to N) cannot be handled without digital preprocessing that reassembles the context window — this digital step dominates latency.

3. **No in-situ weight update.** Weights are loaded once from digital memory. Online learning or adaptation requires full digital retraining and reload.

4. **KV cache problem.** LLM autoregressive inference requires a key-value cache that grows with context length. Taichi has no optical analog of this. Every new token requires the full context to be digitally re-encoded and fed through the chiplet from scratch, or the KV cache must be stored and managed entirely in digital DRAM — at which point the optical compute is a small fraction of total inference cost.

Formally: autoregressive LLM inference computes:
```
p(token_t | token_{t-1}, ..., token_1)
```
This requires the model to have access to all previous tokens at each step. In a feedforward architecture with no persistent state, this means the input to the forward pass at step t must include all t-1 previous tokens. For a context of N=4096 tokens, step N requires processing 4095 tokens digitally before the optical forward pass even begins.

## The Metric Mismatch

**Taichi reports: TOPS/W** — operations per second per watt on fixed spatial inference tasks.

**The correct metric for LLM token inference is: tok/s/W** — completed token generation events per watt, including all overhead.

These metrics are not comparable for LLM workloads. A system that is 160 TOPS/W on image patches but requires O(N) digital preprocessing per token is not 160 TOPS/W on token inference — the overhead dominates at any practical context length.

## QRI's Response: Metrics and Architecture

QRI does not claim to beat Taichi on TOPS/W for spatial inference. That is not QRI's application.

QRI claims: **the optical resonator is the natural physical implementation of an RNN hidden state**, and therefore the correct substrate for autoregressive token inference. The resonator field after T round trips IS the hidden state h_t. The next token's computation IS the next round-trip sequence. No digital re-encoding of context. No KV cache. No per-token overhead growing with sequence length.

**The comparison QRI must make is tok/s/W at LLM-relevant context lengths, not TOPS/W on image patches.**

Preliminary estimate (rough, pending EXP validation):
- QRI operating power: ~30-50W (VCSELs + detectors + drivers; thermal management TBD)
- QRI token rate: 75M tok/s
- QRI efficiency: ~1.5-2.5M tok/s/W
- H100 GPU: ~1000 tok/s at ~700W = ~1.4 tok/s/W
- QRI vs H100: ~10⁶× in tok/s/W (rough; validated economic analysis gives ~44× carbon)

Note: the economic analysis (44× carbon) is the more credible figure — it accounts for full system power, data center overhead, and amortized embodied carbon. The tok/s/W estimate above is optical-component-only and understates total system power.

**The honest claim:** QRI enables LLM token inference at orders-of-magnitude better energy efficiency than GPU infrastructure, for the specific workload of autoregressive generation. Taichi enables spatial inference at 160 TOPS/W, which is a different workload that Taichi is well-suited for and QRI is not designed for.

## Citation Role in Paper
Address in related work: acknowledge Taichi as the state-of-art efficiency benchmark, explain metric mismatch (TOPS/W vs tok/s/W), explain architectural gap (feedforward+stateless vs recurrent+stateful), and position QRI as the first optical architecture designed specifically for autoregressive token inference.
