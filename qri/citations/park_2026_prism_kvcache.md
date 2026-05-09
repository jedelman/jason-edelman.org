# PRISM: Breaking the O(n) Memory Wall in Long-Context LLM Inference via O(1) Photonic Block Selection
**Source:** arXiv:2603.21576 (under review)
**Authors:** Hyoseok Park, Yeonsang Park (Chungnam National University, Korea)
**Submitted:** March 23, 2026
**GitHub:** https://github.com/hyoseokp/PRISM

## Relevance to Project
HIGH. Independently validates ORI's core architectural framing: full O(n) transformer attention is a fundamental barrier for photonic systems, not just an ORI limitation. Confirms the SSM-class positioning of §1 and §4.5.

## Key Claims
- LLM inference is bottlenecked by memory bandwidth for KV cache scanning (O(n) per decode step), not arithmetic
- Photonic accelerators that implement full attention inherit the same O(n) memory scaling
- The real photonic leverage point is coarse KV cache block selection (a similarity search), not dense attention
- PRISM encodes query onto WDM channels, broadcasts to N parallel MRR weight banks, achieves O(1) evaluation
- 16× memory traffic reduction at 64K tokens; 10,000× energy advantage over GPU for block selection

## Architecture
PRISM (Photonic Ranking via Inner-product Similarity with Microring weights) on TFLN (thin-film lithium niobate):
- Query sketch → d WDM channels → 1×N passive split → N MRR weight banks → parallel photodetectors → top-k comparator
- 13 ns per user per head (4 ns EO reprogramming + 9 ns evaluation)
- Crossover: PRISM energy-favorable above ~4K tokens vs GPU full scan

## Implications for ORI
1. **Validates §1 framing:** "Full transformer attention is a fundamental architectural barrier since O(1) optical state cannot implement O(n) attention." PRISM makes this same argument from the photonic accelerator side.
2. **Complementary, not competitive:** PRISM helps existing transformer hardware with KV retrieval. ORI eliminates the KV cache problem entirely by using SSM recurrence (O(1) state). These are different solutions to different parts of the same problem.
3. **Add to §1 and/or §4.5:** "Park & Park [2026] independently establish that full-attention photonic computation inherits O(n) memory scaling, confirming the architectural motivation for SSM-class computation in ORI."
4. Also cites MRR-AEF (Park & Park 2026, arXiv:2603.12934) for photonic softmax — see that citation file.

## Citation Format
Park, H., Park, Y. (2026). PRISM: Breaking the O(n) memory wall in long-context LLM inference via O(1) photonic block selection. arXiv:2603.21576.
