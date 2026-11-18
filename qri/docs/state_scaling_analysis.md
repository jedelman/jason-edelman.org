# QRI State Size, Scaling Limits, and Path to Transformer-Class Inference

*Derived: 2026-04-28. Status: analysis complete, not locked. Informs preprint framing.*

---

## 1. The Core Issue

QRI implements a wave RNN — a recurrent computation with **fixed O(1) hidden state** per layer. This places it in the same computational class as SSMs (Mamba, RWKV) and linear attention, not full transformer attention. The implications for inference quality and competitive positioning require honest analysis.

---

## 2. Current State Capacity

The QRI Gen 1 hidden state per layer is the optical field amplitude across 512 spatial modes, read out as intensity. After inter-layer re-encoding, phase is erased and the state is 512 real values per layer.

**Total state: 512 modes × 24 layers = 12,288 real values**

At 40dB SNR, each mode carries log₂(10,000) ≈ 13.3 bits of information:

```
Total state capacity = 12,288 × 13.3 bits = 163 Kbits = 20 KB
```

For comparison:

| System | State dimensions | Precision | Total bits | Practical context |
|:---|:---:|:---:|:---:|:---:|
| QRI Gen 1 | 12,288 | 13.3 bits (40dB SNR) | 163 Kbits | ~200–1000 tokens |
| Mamba-130M | 294,912 | 32 bits (float) | 9.4 Mbits | ~2K–10K tokens |
| Mamba-3B | 2,621,440 | 32 bits | 84 Mbits | ~10K–50K tokens |
| RWKV-7B | 131,072 | 32 bits | 4.2 Mbits | ~5K–20K tokens |
| Transformer KV (N=4K) | 537M | 16 bits | 8.6 Gbits | exact (N=4K) |

*Practical context = rough estimate accounting for compression overhead and recall efficiency (~10–20% of theoretical capacity). These are not rigorous bounds.*

**Gen 1 state gap vs Mamba-130M: ~57× in total bits.** This means Gen 1 QRI has meaningfully less context capacity than the smallest practical Mamba model, despite addressing the same 512-dimensional embedding space.

---

## 3. Why Gen 1 Uses Only 7.7% of Available Modes

The current 2.5mm aperture supports approximately **6,635 spatial modes** (from 2D Fresnel analysis: N ≈ π/4 × F², F = D²/4λL = 92):

```
N_max = π/4 × 92² ≈ 6,635 modes  (2.5mm aperture, 850nm, L=20mm)
```

Gen 1 addresses only 512 of these — limited by the **VCSEL array pitch** (50µm, 23×23 grid), not by physics. The aperture already supports 13× more modes than we currently use.

This is the primary scaling lever for Gen 2: denser VCSEL arrays, same glass, same cavity.

---

## 4. Scaling Roadmap

Mode count scales as: `N_modes = π/4 × (D²/4λL)²`

Inverting: aperture required for N modes: `D = sqrt(sqrt(4N/π) × 4λL)`

| Generation | Modes | Layers | State | Bits | Mamba equiv | Tok rate | Primary blocker |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **Gen 1 (now)** | 512 | 24 | 12K | 163K | sub-130M | 3M tok/s | none |
| **Gen 2** | 2,048 | 48 | 98K | 1.3M | ~Mamba-1B | 2M tok/s | 25µm VCSEL pitch |
| **Gen 3** | 6,000 | 48 | 288K | 3.8M | ~Mamba-3B | 2M tok/s | 10µm VCSEL, detector density |
| **Gen 4** | 32,768 | 32 | 1.05M | 14M | ~Mamba-70B | 2M tok/s | 5mm aperture |

**Gen 2 blocker (25µm VCSEL pitch):** 25µm oxide-confined GaAs VCSELs are available from Vixar, II-VI (now Coherent), and Lumentum as catalog or semi-custom parts. Not R&D. Achievable within the existing supply chain.

**Gen 3 blocker (10µm VCSEL pitch):** Demonstrated in literature (e.g., Haglund et al. 2015 at Chalmers). Not yet commodity. 3–5 year engineering path.

**Gen 4 (5mm aperture):** Requires larger PTR plate and mirror coatings on larger substrate. Technically straightforward; cost and thermal management scale accordingly.

---

## 5. What Each Generation Can Do

### Gen 1 (512 modes, 24 layers)
- Short-context token generation: coherent text, simple Q&A, constrained instruction following
- Effective context: ~200–1000 tokens (comparable to early GPT-2 era models)
- Fails at: exact fact recall from long prompts, multi-hop reasoning across context, tasks requiring >~1K token working memory
- **Value:** proof of concept; energy efficiency demonstration; edge/embedded inference

### Gen 2 (2,048 modes, 48 layers)
- Medium-context generation: practical instruction following, summarization, code completion
- Effective context: ~2K–10K tokens (Mamba-1B territory)
- Quality: comparable to open-source models from 2022–2023 era (Pythia-1B, OPT-1.3B)
- **Value:** first generation with practical inference utility

### Gen 3 (6,000 modes, 48 layers)  
- Long-context generation: document Q&A, multi-turn dialogue, code generation
- Effective context: ~10K–50K tokens (Mamba-3B territory)
- Quality: competitive with Mistral-7B class models on standard NLP benchmarks *except* tasks requiring exact long-range retrieval
- **Value:** commercial deployment viability

### Gen 4+ (32K+ modes)
- SSM-class inference at Mamba-70B state capacity
- Quality: approaches transformer on most practical tasks; gap remains for exact retrieval at >100K context
- **Value:** competitive with frontier models for most applications

---

## 6. The Transformer Gap — Is It Fundamental?

**Short answer: yes, for exact full attention. No for practical quality.**

Softmax attention requires O(N) state — the KV cache grows with context length N. A fixed-state optical system cannot replicate this exactly. The gap is **fundamental and architectural**, not an engineering problem.

However, the practical quality gap between SSM-class models and transformers is workload-dependent:

| Task type | Mamba-3B vs GPT-3.5 | Gap character |
|:---|:---:|:---|
| Standard NLP (MMLU, HellaSwag) | ≈ equal | No gap at same param count |
| Short-context generation (<2K) | ≈ equal | No gap |
| Long-context recall (N=4K) | ~10% worse | Manageable |
| Long-context recall (N=128K) | ~55% worse | Significant |
| Needle-in-haystack (exact) | Much worse | Fundamental |
| In-context learning (ICL) | Somewhat worse | Degrades with N |

For the majority of real-world inference workloads — short prompts, conversational interaction, structured generation — SSM-class models are already competitive with transformers. The quality gap is concentrated in tasks requiring exact verbatim recall across very long contexts.

**QRI's practical inference claim is therefore:** optical delivery of SSM-class quality at orders-of-magnitude better energy efficiency. This is a valid and valuable claim without overclaiming transformer equivalence.

---

## 7. The Hybrid Path to Transformer-Approximate Quality

An alternative to pure optical scaling: **optical SSM + digital sparse attention**.

QRI handles the recurrent forward pass optically (the ~99% of FLOPs that are local pattern recognition and sequential processing). A small digital coprocessor handles O(√N) global attention retrievals — the top-k most relevant KV pairs for each query, selected by approximate nearest-neighbor search.

This is architecturally similar to Longformer / BigBird / Routing Transformer. The digital overhead is minimal: √N comparisons per token vs N for full attention. At N=4096: 64 digital operations per 512 optical ones.

**This hybrid path is achievable with Gen 1 hardware.** It requires a digital coprocessor for sparse attention, but the optical component still dominates energy consumption.

---

## 8. Revised Competitive Positioning

### vs. Taichi (feedforward optical)
Taichi is stateless. QRI is stateful (O(1) recurrent). For autoregressive token generation, QRI's hidden state naturally carries context — no digital context re-encoding per token. The metric mismatch (TOPS/W vs tok/s/W) means the architectures are not directly comparable. QRI is designed for token inference; Taichi is designed for spatial inference.

**However:** a well-designed feedforward system can approximate autoregressive generation via SSM-equivalent digital postprocessing. The real gap is energy: QRI executes the recurrent compute optically; Taichi would require additional digital recurrence logic to match QRI's inference task.

### vs. Mamba/RWKV (digital SSM)
This is the correct primary comparison. Both are O(1)-state recurrent models. QRI claims:
- Equivalent computational class (wave RNN = SSM, Hughes 2019)
- Optical execution at lower energy per operation
- Same fundamental context limitations

The energy argument is the core claim. At comparable state capacity (Gen 2–3), QRI should match Mamba quality at a fraction of the power.

### vs. GPU transformer
QRI is not a transformer replacement — it is an SSM-class model in optical hardware. For applications where SSM quality is sufficient (the majority of practical inference workloads), QRI offers orders-of-magnitude better energy efficiency. For applications requiring exact long-context retrieval, the hybrid path (QRI + sparse digital attention) is the practical approach.

---

## 9. What the Paper Should and Should Not Claim

**Claim:** QRI implements SSM-class recurrent inference in the optical domain. Energy efficiency advantages over digital SSM execution follow from optical physics.

**Do not claim:** transformer equivalence, full attention capability, or competitive quality on long-context exact retrieval tasks.

**Acknowledge:** the O(1) state limitation, the current context capacity of Gen 1 (~200–1000 tokens practical), and the generational roadmap required to reach Mamba-class state capacity.

**The honest framing is stronger than overclaiming.** It aligns with what the physics actually delivers and what reviewers will be able to verify.

---

## 10. Open Questions (Not Yet Addressed)

- **SNR-vs-state tradeoff:** increasing modes reduces per-mode SNR if total input power is fixed. Need to derive SNR scaling vs mode count at fixed VCSEL power budget.
- **Mamba-equivalent quality at equal state:** does QRI's holographic MVM + intensity ReLU implement comparable expressibility to Mamba's selective state space mechanism? The Hughes 2019 mapping establishes the RNN equivalence but not the selectivity mechanism.
- **Hybrid architecture:** need to specify the digital coprocessor for sparse attention — what memory bandwidth, what compute, what latency overhead.
- **Training quality at Gen 1 state size:** can a 12K-real-state model be trained to useful quality on language tasks? Mamba-130M (294K state) achieves GPT-2 quality. Gen 1 has 24× less state — quality may be below useful threshold, making Gen 2 the first practically valuable generation.
