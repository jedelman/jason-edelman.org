# Wave Physics as an Analog Recurrent Neural Network
**Source:** Science Advances (2019)
**DOI:** 10.1126/sciadv.aay6946
**Authors:** Tyler W. Hughes, Ian A.D. Williamson, Momchil Minkov, Shanhui Fan
**Institution:** Stanford University (Applied Physics + Electrical Engineering)
**arXiv:** 1904.12831

## Core Claim
The discretized scalar wave equation is structurally identical to an RNN update rule. The wave speed distribution c(x,y,z) is the trainable parameter — equivalent to the weight matrices W^(h), W^(x), W^(y) in a conventional RNN.

## Key Derivation (verbatim equations)

Wave equation:
  ∂²u/∂t² = c²∇²u + f

Finite-difference discretization → recurrence:
  u_{t+1} = 2u_t - u_{t-1} + Δt²c²∇²u_t + Δt²f_t

Define hidden state: h_t = [u_t, u_{t-1}]^T

Then wave update = RNN update:
  h_t = A(h_{t-1}) · h_{t-1} + P^(i) · x_t   (eq. 5)
  y_t = (P^(o) · h_t)²                          (eq. 6)

Where:
- A = sparse update matrix from Laplacian (nearest-neighbor coupling)
- P^(i) = injection matrix (sparse, locates source)
- P^(o) = readout matrix (sparse, locates probe)
- Nonlinearity: intensity measurement y_t = (field)² — quadratic, like photodetection

## Key Structural Differences from Conventional RNN
1. A is SPARSE (Laplacian = nearest-neighbor). Not dense. Information propagates at finite velocity.
2. A depends on c(x,y,z) which is a CONTINUOUS field, not a matrix of discrete weights.
3. Energy conservation is built in (wave energy propagates, doesn't grow unbounded). No vanishing/exploding gradients.
4. Nonlinearity = intensity detection — physically natural, not artificially inserted.
5. Input/output matrices P^(i), P^(o) are FIXED (location of sources/detectors) — only c(x,y,z) is trained.

## Nonlinearity Details
Optical Kerr effect provides c = c_lin + u²·c_nl (intensity-dependent speed).
Saturable absorber: validated in supplementary (Fig. S1, S2). 92.6% accuracy vowel classification.
Key: linear wave equation ALSO works comparably (section S4) — suggests linear optical system may suffice.

## Critical Insight for Resonator Design
A resonator IS a wave system. The resonator geometry defines the topology of A.
- Fabry-Perot: A = 1D Laplacian with reflective boundary conditions
- Ring resonator: A = 1D Laplacian with periodic boundary conditions
- 2D free-space cavity: A = 2D Laplacian with arbitrary boundaries
Training = setting c(x,y,z), i.e., the refractive index distribution of the medium filling the resonator.
This is EXACTLY what PTR glass holographic plates do — they set Δn(x,y) = phase mask = c(x,y) proxy.

## Why This Is Load-Bearing for Our Architecture
Hughes 2019 proves: ANY wave medium with a source and detector IS an RNN.
Therefore: a coherent optical resonator with:
  - Input coupling (injection matrix P^(i))
  - Holographic phase mask inside (trained c(x,y))
  - Output detection (readout matrix P^(o))
is a physical RNN. The resonator's round-trip dynamics = RNN hidden state update.
Each round trip = one RNN time step.

## Limitation for Token Inference
Hughes 2019 demonstrated on AUDIO (temporal sequences). Token inference requires:
- Parallel processing of an embedding VECTOR at each step (not a scalar signal)
- Matrix-vector multiply, not scalar wave scattering
Need to extend: multi-mode excitation of a resonator maps a vector to a wave field.
This is ARCH-1 derivation task.
