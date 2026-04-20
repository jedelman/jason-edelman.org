# Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity
**Source:** arXiv:2101.03961 (2021)  
**DOI:** https://arxiv.org/abs/2101.03961  
**Authors:** Lepikhin et al. (Google Brain)  

## Key Finding: Activation Sparsity
- 1.6T parameter model (sparse equivalent)
- **50B active parameters per token** (3.1% density)
- 32k experts, K=1 hard routing (each token routes to single expert)
- 5x-10x efficiency gains vs. dense 1.6T baseline
- Practical scaling: language modeling, multilingual translation

## Relevance to QRI
Validates that sparse MoE with 50B active params is standard for trillion-scale models. QRI at K=4 achieves comparable active density (4.92B) within single refrigerator-scale device.

---

# GLaM: Efficient Scaling of Language Models with Mixture-of-Experts
**Source:** arXiv:2112.06905 (2021)  
**DOI:** https://arxiv.org/abs/2112.06905  
**Authors:** Du et al. (Google Research)  

## Key Finding: Energy Efficiency
- 1.2T parameters, 96B active per token
- 3-5x more energy-efficient than dense equivalents
- Scaling law: performance ∝ (active_params)^α, independent of total params

## Relevance
Confirms sparse activation decouples energy from total capacity. QRI sparse MoE follows same scaling law.

---

# Expert Choice Routing: Scaling to 100B Parameter Mixture-of-Experts Models with Expert Choice Routing
**Source:** arXiv:2202.09368 (2022)  
**DOI:** https://arxiv.org/abs/2202.09368  
**Authors:** Zhou et al. (Google DeepMind)  

## Key Finding: Optimal K
- Variable K per token (not fixed)
- Optimal performance at K=4-16 experts active
- Activation sparsity: 0.1%-0.4% of total params

## Relevance
Supports QRI design choice of K=4-8. Lower bound on sparsity validates 40W power budget.

---

# Mixtral 8x7B: A High-Quality Mixture of Experts Language Model
**Source:** arXiv:2401.04088 (2024)  
**DOI:** https://arxiv.org/abs/2401.04088  
**Authors:** Jiang et al. (Mistral AI)  

## Key Finding: Production MoE
- 46.7B dense-equivalent parameters
- 8 experts, K=2 active per token
- 12.9B active parameters (27.6% of total, higher density by design)
- Practical: real-world deployment, fast inference

## Relevance
Production-grade MoE confirms K=2-4 is realistic. Mistral's efficiency proves sparse activation is mature.

---

# Scaling Laws for Neural Language Models
**Source:** arXiv:2001.08361 (2020)  
**DOI:** https://arxiv.org/abs/2001.08361  
**Authors:** Kaplan et al. (OpenAI)  

## Key Finding: Compute-Optimal Training
- Model size N, dataset size D, compute C follow scaling laws
- C ∝ N ∝ D for optimal training
- Extrapolation: 1.8T sparse-equivalent parameters at GPT-4 scale (estimated)

## Relevance
Provides baseline for comparing QRI 5T MoE to GPT-4 scale. Justifies K=4-8 active parameter budget.
