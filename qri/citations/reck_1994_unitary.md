# Experimental Realization of Any Discrete Unitary Operator
**Source:** Physical Review Letters (1994)
**DOI:** 10.1103/PhysRevLett.73.58
**Authors:** Michael Reck, Anton Zeilinger, Herbert J. Bernstein, Philip Bertani
**Institution:** University of Vienna / Hampshire College

## Core Claim
Any N×N unitary matrix can be decomposed into a product of O(N²) beam splitter + phase shifter operations arranged in a triangular mesh. This is the mathematical foundation for MZI mesh ONNs.

## Key Result
Reck decomposition: U = ∏ T_{mn}(θ,φ) — product of N(N-1)/2 two-mode transformations. Each T is a beam splitter with phase. The decomposition is universal (any unitary) and constructive (given U, compute the T's).

## Connection to QRI
QRI explicitly does NOT use the Reck/Clements decomposition. QRI's holographic weight matrix W = UΣV† is not constrained to be unitary. This is architecturally important: unitary weight matrices have eigenvalues on the unit circle, preventing gradient vanishing/explosion, but also preventing the system from implementing arbitrary linear maps. QRI's rank-50 holographic factorization W = U·Vᵀ allows non-unitary, non-square linear transformations.

## Citation Role
Establishes unitary constraint of MZI meshes as a fundamental architectural limitation. QRI's holographic approach avoids this constraint.
