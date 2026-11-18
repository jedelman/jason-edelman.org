# Linear State-Space Layers (LSSL)

**Authors:** Albert Gu, Isys Johnson, Karan Goel, Khaled Saab, Tri Dao, Atri Rudra, Christopher Ré  
**Venue:** NeurIPS 2021  
**arXiv:** 2110.13985v1  
**Date:** October 26, 2021

## Relevance to ORI

This paper is the direct theoretical predecessor of S4, Mamba, and RWKV. It proves that RNNs, CNNs, and neural differential equations are all special cases of linear state-space models (LSSLs) of the form:

    ẋ(t) = Ax(t) + Bu(t)
    y(t) = Cx(t) + Du(t)

ORI's wave equation RNN (ARCH-1, Hughes et al. 2019) is an exact physical implementation of this system, where:
- A = round-trip operator (determined by Δn(x,y))
- B = input coupling matrix
- Δt = τ_rt = 133ps (fixed by cavity length)
- The squaring nonlinearity is applied at readout

## Key Results Used in ORI

**Theorem 1:** The optimal continuous-time memorization operator (HiPPO) for any measure produces a low-recurrence-width structured state matrix A. ORI's rank-50/100 weight matrices are within this structured class.

**Corollary 4.1:** HiPPO matrices for classical orthogonal polynomials are 3-quasiseparable. Low-rank matrices (rank-50, rank-100) are quasiseparable — ORI's physically constrained A matrices provably capture long-range memory.

**Lemma 3.1:** Gating mechanisms (LSTM, GRU) are equivalent to learning the discretization timescale Δt. ORI's fixed τ_rt = 133ps is equivalent to LSSL-fixed (non-trainable Δt). Variable-T inference (ARCH-18) is the optical analogue of learned Δt / gating.

**Dual view (Fig. 1):** The same LSSL can be computed as a recurrence (O(1) per token, stateful inference) or as a convolution (parallelizable training). ORI uses exactly this duality: recurrent inference at 75M tok/s, adjoint-based convolutional training.

**LSSL-fixed vs LSSL:** Fixed Δt (= fixed T in ORI) causes ~2% accuracy loss on sCIFAR vs learned Δt. Motivates ARCH-18 variable-T inference.

## Key Equations

State-space recurrence (discrete):
    x_t = Ā·x_{t-1} + B̄·u_t
    y_t = C·x_t + D·u_t

Krylov convolutional view:
    K_L(A,B,C) = (CB, CAB, ..., CA^{L-1}B)
    y = K_L * u + Du

Bilinear discretization (α=1/2):
    Ā = (I - Δt/2·A)^{-1}(I + Δt/2·A)
    B̄ = Δt·(I - Δt/2·A)^{-1}·B

HiPPO-LegS matrix (used in ORI initialization):
    A[n,k] = -(2n+1)^{1/2}(2k+1)^{1/2}  if n > k
            = -(n+1)                       if n = k
            = 0                            if n < k

## Citation

Gu, A., Johnson, I., Goel, K., Saab, K., Dao, T., Rudra, A., & Ré, C. (2021).
Combining Recurrent, Convolutional, and Continuous-time Models with Linear State-Space Layers.
arXiv:2110.13985. NeurIPS 2021.
