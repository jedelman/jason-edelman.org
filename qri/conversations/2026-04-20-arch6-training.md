# 2026-04-20 — ARCH-6: Training via Adjoint Method

## Problem
How do we compute gradients ∂L/∂Δn(x,y) to optimize the refractive index distribution?

## Solution: Adjoint Backprop Through Wave Equation (Hughes 2019)

Forward pass: solve wave eq with fixed Δn, store intermediate states u_t.
Loss: L = ||y_T - y_target||² where y_T = |∫ ψ* u_T dA|².
Backward: integrate Lagrange multiplier λ_t backward, compute ∂L/∂Δn.
Update: Δn ← Δn - α ∂L/∂Δn via SGD/Adam.

## Implementation: JAX + Differentiable PDE Solver

```
JAX framework → automatic differentiation
Time-stepping: Implicit (Crank-Nicolson) for stability
Spatial: 512×512 grid, FFT-based Laplacian
Batch: 16-64 tokens
Optimizer: Adam, lr=1e-3
Loss: Causal LM (next-token prediction)
```

## Training Pipeline

1. Initialize Δn_k ~ N(0, 10⁻³) for each layer k
2. Forward: simulate wave eq over T=100 round trips
3. Loss: compute ||y_T - y_target||²
4. Backward: adjoint method → ∂L/∂Δn
5. Update: Δn ← Δn - α·∂L/∂Δn (Adam)
6. Validate: causal LM perplexity on held-out tokens
7. Convergence: ~100 epochs
8. Export: Δn → UV hologram pattern → write PTR glass

## Hyperparameters

| Param | Value |
|---|---|
| Learning rate | 1e-3 |
| Batch size | 32 tokens |
| Epochs | 100 |
| L2 regularization | 1e-5 |
| Validation interval | Every 5 epochs |

## Quantization

Apply 4-5 bit quantization post-training OR via quantization-aware training (QAT).
QAT preferred: train with quantized Δn to match hardware fidelity.

## ARCH-6 LOCKED

JAX-based differentiation through wave eq. Validation on causal LM. Output: Δn patterns for each of 24 PTR plates.
