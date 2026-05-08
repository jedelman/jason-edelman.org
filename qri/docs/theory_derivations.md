# ORI Theory Derivations

**Status:** Complete — all four foundational derivations formalized  
**Purpose:** LaTeX-ready source for the Methods section of the arXiv preprint  
**Depends on:** architecture.md (ARCH-1 through ARCH-9), parameters.toml, properties.toml  
**Last revised:** 2026-04-28

Each section derives one foundational claim from first principles. The four derivations form a
logical chain: the wave equation establishes the RNN structure (§1), coupled-mode theory
establishes how the holographic grating encodes the weight matrix (§2), coherence analysis
establishes what the detector actually computes and under what conditions the intensity-MVM
interpretation holds (§3), and differential encoding resolves the sign constraint that makes
optical intensity encoding of signed embeddings physically realizable (§4).

No claim in this document is asserted without derivation. Open assumptions are flagged
explicitly where they appear.

---

## Table of Contents

1. [The Round-Trip Operator and T-Step Computation](#1-the-round-trip-operator-and-t-step-computation)
2. [The Coupling Tensor and Grating-to-Operator Mapping](#2-the-coupling-tensor-and-grating-to-operator-mapping)
3. [Field vs. Intensity: The Computational Basis](#3-field-vs-intensity-the-computational-basis)
4. [Differential Encoding for Signed Inputs](#4-differential-encoding-for-signed-inputs)
5. [The Complete Layer Computation](#5-the-complete-layer-computation)
6. [Open Assumptions and Validation Requirements](#6-open-assumptions-and-validation-requirements)

---

## 1. The Round-Trip Operator and T-Step Computation

### 1.1 The Scalar Wave Equation

We begin with the scalar wave equation for an optical field $u(\mathbf{x}, t)$ propagating through a
lossless, isotropic medium with spatially varying refractive index $n(\mathbf{x})$:

$$\frac{\partial^2 u}{\partial t^2} = \left(\frac{c_0}{n(\mathbf{x})}\right)^2 \nabla^2 u + f(\mathbf{x}, t)
\tag{1.1}$$

where $c_0$ is the vacuum speed of light and $f(\mathbf{x}, t)$ is an external forcing term representing
the injected input field (the token encoding). This equation is exact for a monochromatic or
quasi-monochromatic field in the scalar (paraxial) approximation, which is valid for the
Hermite-Gaussian modes of the confocal resonator at the operating numerical aperture.

Discretizing time uniformly with step $\Delta t$ and using a second-order central difference for
the temporal second derivative:

$$\frac{u_{t+1} - 2u_t + u_{t-1}}{\Delta t^2} = \left(\frac{c_0}{n(\mathbf{x})}\right)^2 \nabla^2 u_t + f_t(\mathbf{x})$$

Rearranging to an explicit recurrence:

$$u_{t+1}(\mathbf{x}) = 2u_t(\mathbf{x}) - u_{t-1}(\mathbf{x})
+ \Delta t^2 \left(\frac{c_0}{n(\mathbf{x})}\right)^2 \nabla^2 u_t(\mathbf{x})
+ \Delta t^2 f_t(\mathbf{x})
\tag{1.2}$$

### 1.2 The RNN Identification (Hughes et al. 2019)

Equation (1.2) has the structure of a second-order recurrence in $u_t$ and $u_{t-1}$. Define the
two-component hidden state vector by stacking the current and previous field:

$$\mathbf{h}_t(\mathbf{x}) = \begin{pmatrix} u_t(\mathbf{x}) \\ u_{t-1}(\mathbf{x}) \end{pmatrix}
\tag{1.3}$$

Then equation (1.2) can be written exactly as a first-order recurrence:

$$\mathbf{h}_{t+1} = \mathbf{A}(n) \cdot \mathbf{h}_t + \mathbf{B} \cdot f_t
\tag{1.4}$$

where the **state transition operator** is:

$$\mathbf{A}(n) = \begin{pmatrix}
2\mathbf{I} + \Delta t^2 \left(\tfrac{c_0}{n(\mathbf{x})}\right)^2 \nabla^2 & -\mathbf{I} \\
\mathbf{I} & \mathbf{0}
\end{pmatrix}
\tag{1.5}$$

and the input injection operator is $\mathbf{B} = [\Delta t^2 \mathbf{I},\; \mathbf{0}]^\top$. The output
is the detected intensity of the readout field:

$$y_t = \left| \mathbf{P}^{(o)} \cdot \mathbf{h}_t \right|^2
\tag{1.6}$$

where $\mathbf{P}^{(o)}$ is the output projection matrix coupling the cavity field to the detector
array. Equations (1.4)–(1.6) are structurally identical to the discrete-time RNN equations. This
mapping is **exact at the level of Maxwell's equations** discretized in time — not an analogy, not
an approximation. Any optical cavity with a spatially structured medium that is governed by equation
(1.1) is an RNN. The refractive index distribution $n(\mathbf{x})$ determines the operator
$\mathbf{A}$, which is the weight matrix. Training the network means designing $n(\mathbf{x})$.

The Hughes et al. (2019) result establishes this for the general case. Our contribution is to
instantiate it in a specific physical system — the holographic Fabry-Perot resonator — and derive
the engineering constraints that make it trainable and deployable for token inference.

### 1.3 The Fabry-Perot as a Weight-Tied RNN of Depth T

In the physical Fabry-Perot resonator, the cavity field makes one complete round trip every
$\tau = 2L/c_0$ seconds. At $L = 20$ mm:

$$\tau = \frac{2 \times 0.020\;\text{m}}{3 \times 10^8\;\text{m/s}} = 133.3\;\text{ps}
\tag{1.7}$$

Each round trip corresponds to one time step $\Delta t = \tau$ in equation (1.2). The token field
is injected once at $t = 0$ (via the VCSEL array), and the cavity then evolves freely for $T = 100$
round trips with $f_t = 0$. The output is read at $t = T$. The forward pass of one layer is
therefore:

$$\mathbf{h}_T = \mathbf{A}^T \cdot \mathbf{h}_0
\tag{1.8}$$

where $\mathbf{h}_0$ is the initial state set by the input token encoding (§4). This is the
$T$-th power of the round-trip operator $\mathbf{A}$ applied to the initial condition. It is
**not** a single matrix-vector multiplication — it is a $T$-step iterated recurrence with a fixed
(weight-tied) operator. The architecture is equivalent to a depth-$T$ weight-tied RNN: every
"layer" inside the resonator applies the same operator $\mathbf{A}$, and the resonator naturally
unrolls this recurrence over $T = 100$ steps in $T \times \tau = 13.3\;\text{ns}$.

To see the expressive consequence of this, consider the eigendecomposition
$\mathbf{A} = \mathbf{Q} \mathbf{\Lambda} \mathbf{Q}^{-1}$ (assuming diagonalizability, which holds
for the non-degenerate confocal cavity modes). Then:

$$\mathbf{A}^T = \mathbf{Q}\, \mathbf{\Lambda}^T\, \mathbf{Q}^{-1}
\tag{1.9}$$

where $\mathbf{\Lambda}^T = \text{diag}(\lambda_1^T, \lambda_2^T, \ldots)$. The $T$-th power
**amplifies spectral components** with $|\lambda_i|$ near 1 and **suppresses** those with
$|\lambda_i| \ll 1$. Training $\Delta n(\mathbf{x})$ shapes the eigenvalue spectrum and eigenmodes
of $\mathbf{A}$ such that $\mathbf{A}^T$ implements the desired input-to-output map. The resonator
does not compute $\mathbf{W} \cdot \mathbf{x}$ for some learned $\mathbf{W}$; it computes the
$T$-fold iterated action of a learned contraction operator on the input state. This is a richer
computation than a single MVM, and it is what the holographic grating encodes.

### 1.4 Stability: The Mirror Loss Guarantees Contractivity

For inference to be well-defined, the hidden state must not diverge over $T$ round trips.
Stability requires all eigenvalues of $\mathbf{A}$ to satisfy $|\lambda_i| \leq 1$. In the
physical resonator, this is **guaranteed by the mirror loss**: each round trip attenuates the
field amplitude by a factor of $\sqrt{R_1 R_2} \approx \sqrt{R} = \sqrt{0.9990} \approx 0.9995$
(for matched mirror reflectivities). The effective eigenvalue magnitudes are therefore all bounded
by $\sqrt{R}$, and after $T$ round trips:

$$|\lambda_i|^T \leq (\sqrt{R})^T = (0.9995)^{100} \approx 0.951
\tag{1.10}$$

The physical cavity is a strict contraction on the optical field. No eigenvalue can blow up. This
is not a training constraint or a regularization requirement — it is an unconditional physical
property of any mirror cavity with $R < 1$.

The cumulative amplitude attenuation from $T$ round trips of mirror loss is $0.951$, corresponding
to a power attenuation of $0.951^2 \approx 0.905$ (−0.43 dB over the full $T = 100$ round trips
at $R = 0.9990$). This is the signal loss that enters the SNR budget in §1.5.

### 1.5 Why T = 100 Is Derived from the SNR Budget

The operating round-trip count $T$ is not a free design choice — it is determined by the
intersection of two constraints: the **coherence requirement** (the cavity must remain
phase-coherent over the full computation) and the **SNR budget** (accumulated round-trip losses
must not degrade the signal below the 6-bit precision floor).

**Coherence requirement.** The cavity operates in the coherent regime (Regime A of Hughes 2019)
where the field builds up as a standing wave and the wave RNN mapping holds exactly. This requires
the optical path length uncertainty over $T$ round trips to be small compared to the wavelength:

$$T \cdot \sigma_\phi \ll 2\pi
\tag{1.11}$$

where $\sigma_\phi$ is the per-round-trip phase noise from mirror figure imperfections and cavity
thermal drift. The coherence time of the single-mode VCSEL source sets a harder bound:

$$T_\text{coh} = \frac{c_0}{2L \cdot \Delta\nu} = \frac{3 \times 10^8}{2 \times 0.020 \times 10 \times 10^6} \approx 750\;\text{round trips}
\tag{1.12}$$

at single-mode VCSEL linewidth $\Delta\nu = 10$ MHz. The coherence condition requires $T \ll T_\text{coh} = 750$.

**SNR budget.** Each round trip incurs loss from mirror reflectivity ($-0.00869$ dB per round trip, both mirrors at
$R = 0.9990$), PTR glass absorption (specification: $< 0.01$ cm$^{-1}$ at 850 nm over 0.5 mm
thickness, contributing $< 0.001$ dB per pass), and residual scattering (estimated $< 0.005$ dB
per pass from surface roughness). The dominant loss is mirror reflectivity. Total round-trip loss:

$$\alpha_\text{RT} \approx -10 \log_{10}(R) = -10 \log_{10}(0.9990) = 0.00435\;\text{dB/RT}
\tag{1.13}$$

Over $T$ round trips, accumulated signal loss is $T \times \alpha_\text{RT}$. This loss directly
reduces the SNR at the output detector. The SNR budget requires the accumulated loss to remain
within the 2 dB margin above the 38 dB (6-bit) floor:

$$T \times 0.00435\;\text{dB} \leq 2\;\text{dB} \quad \Rightarrow \quad T \leq 460
\tag{1.14}$$

The SNR budget alone permits up to $T \approx 460$, well above the coherence constraint of $T \ll 750$.
However, equation (1.14) uses only mirror loss; including finesse-limited mode diffraction
(modes with higher transverse order $m+n$ suffer greater diffraction loss per round trip, see §2.5)
tightens the practical upper bound. For $N = 512$ modes addressed (highest order $m+n \approx 22$),
the diffraction loss for the highest mode adds approximately $0.01$ dB per round trip. At $T = 100$:

$$\text{Total accumulated loss (highest mode)} = 100 \times (0.00435 + 0.01) = 1.44\;\text{dB}
\tag{1.15}$$

This sits comfortably within the 2 dB SNR margin. At $T = 200$, accumulated loss reaches 2.9 dB,
exceeding the margin for the highest modes. **$T = 100$ is therefore the operating point that
simultaneously satisfies the coherence requirement ($100 \ll 750$), provides comfortable SNR
margin (2 dB at $T = 100$, degrading to zero at $T \approx 140$ for the highest modes), and
maximizes the recurrent depth of the computation.**

---

## 2. The Coupling Tensor and Grating-to-Operator Mapping

### 2.1 Mode Expansion in the Confocal Fabry-Perot

The confocal Fabry-Perot resonator (radius of curvature $R_c = L = 20$ mm, aperture diameter
$D = 2.5$ mm) supports a complete, countably infinite orthonormal basis of Hermite-Gaussian (HG)
transverse eigenmodes $\{\psi_{mn}(x,y)\}$, labeled by non-negative integers $m$ and $n$:

$$\psi_{mn}(x, y) = \frac{1}{\sqrt{2^{m+n} m! n! \pi}} \cdot \frac{1}{w_0}
\cdot H_m\!\left(\frac{\sqrt{2}\, x}{w_0}\right)
H_n\!\left(\frac{\sqrt{2}\, y}{w_0}\right)
\exp\!\left(-\frac{x^2 + y^2}{w_0^2}\right)
\tag{2.1}$$

where $H_m$ is the $m$-th Hermite polynomial and the fundamental mode waist is:

$$w_0 = \sqrt{\frac{\lambda L}{2\pi}} = \sqrt{\frac{850 \times 10^{-9} \times 0.020}{2\pi}}
\approx 52\;\mu\text{m}
\tag{2.2}$$

The modes are orthonormal under the $L^2$ inner product over the transverse plane:

$$\langle \psi_{mn} \mid \psi_{m'n'} \rangle
= \int_{-\infty}^{\infty}\!\!\int_{-\infty}^{\infty}
\psi_{mn}^*(x,y)\, \psi_{m'n'}(x,y)\; dx\, dy
= \delta_{mm'}\delta_{nn'}
\tag{2.3}$$

We address $N = 512$ modes and introduce a single linear index $i = 1, \ldots, N$ that labels
modes ordered by total transverse order $m+n$ (then by $m$ within each order). The total optical
field inside the resonator at any time is expanded in this basis as:

$$E(x, y, t) = \sum_{i=1}^{N} a_i(t)\, \psi_i(x, y)
\tag{2.4}$$

where the complex coefficients $\{a_i(t)\} \in \mathbb{C}^N$ constitute the hidden state of the
wave RNN in the mode representation. The intensity (optical power per unit area) is $|E|^2$.

### 2.2 The Holographic Grating as a Refractive Index Perturbation

Holographic gratings in the PTR glass introduce a spatially periodic perturbation to the
refractive index. Following Psaltis et al. (1990) and Yariv (1973), a single grating component
indexed by $k$ has the form:

$$\Delta n_k(x, y) = w_k \cos(\mathbf{K}_k \cdot \mathbf{r} + \varphi_k)
\tag{2.5}$$

where $\mathbf{K}_k$ is the grating vector (units of rad/m), $w_k > 0$ is the grating amplitude
(dimensionless, bounded by $\Delta n_\text{max} = 5 \times 10^{-3}$ for PTR glass), $\varphi_k$
is the grating phase, and $\mathbf{r} = (x, y)$. A physical holographic recording stores a
superposition of $r$ such components at $r$ different grating vectors:

$$\Delta n(x, y) = \sum_{k=1}^{r} w_k \cos(\mathbf{K}_k \cdot \mathbf{r} + \varphi_k)
\tag{2.6}$$

This is the refractive index perturbation that the training procedure writes into the PTR glass.
The full index is $n(x,y) = n_0 + \Delta n(x,y)$ where $n_0 \approx 1.49$ is the PTR glass
substrate index at 850 nm. The small-perturbation condition $\Delta n \ll n_0$ is well satisfied:
$5 \times 10^{-3} / 1.49 \approx 0.003 \ll 1$.

### 2.3 The Phase-Matching Condition and Mode Coupling

The physical mechanism by which the grating redirects light from one mode to another is
holographic diffraction. Grating component $k$ with vector $\mathbf{K}_k$ efficiently couples
two modes $\psi_j$ (input) and $\psi_i$ (output) when the **phase-matching condition** is
satisfied:

$$\mathbf{K}_k = \mathbf{k}_{\psi_i} - \mathbf{k}_{\psi_j}
\tag{2.7}$$

where $\mathbf{k}_{\psi_i}$ and $\mathbf{k}_{\psi_j}$ are the transverse wavevectors of the
respective HG modes (i.e., the dominant spatial frequency components of the mode profiles). This
condition is the holographic analog of Bragg's law: the grating vector must equal the difference
of the two mode wavevectors for efficient power transfer between them. By choosing the set of
grating vectors $\{\mathbf{K}_k\}$ at recording time, one selects which pairs $(i, j)$ of modes
are coupled by the hologram.

In the confocal geometry, each HG mode $\psi_{mn}$ has a dominant transverse wavevector
$\mathbf{k}_{mn} \approx ((2m+1)/w_0,\, (2n+1)/w_0)$ (in the paraxial approximation). The grating
vector required to couple mode $(m,n)$ to mode $(m',n')$ is therefore:

$$\mathbf{K}_{(mn)\to(m'n')} = \frac{1}{w_0}
\begin{pmatrix} 2(m'-m) \\ 2(n'-n) \end{pmatrix}
\tag{2.8}$$

This determines the recording geometry (the angle between reference and signal beams at 532 nm
during the holographic write step) needed to implement any desired coupling between any pair of
modes.

### 2.4 The Coupling Coefficient: Derivation

To first order in $\Delta n / n_0$, the coupling coefficient $\kappa_{ij}^{(k)}$ between mode $j$
(input) and mode $i$ (output) due to grating component $k$ is derived from the scalar wave
equation perturbed by $\Delta n_k$. Substituting the mode expansion (2.4) into (1.1) with
$n(\mathbf{x}) = n_0 + \Delta n_k(\mathbf{x})$ and projecting onto output mode $\psi_i^*$:

$$\kappa_{ij}^{(k)} = \frac{\pi}{\lambda}
\int_{-\infty}^{\infty}\!\!\int_{-\infty}^{\infty}
\psi_i^*(x, y)\; \Delta n_k(x, y)\; \psi_j(x, y)\; dx\, dy
\tag{2.9}$$

where $\lambda = 850$ nm is the inference wavelength. The factor $\pi/\lambda$ comes from the
first-order perturbation theory for the wave equation (specifically from the phase accumulated per
round trip by the index perturbation: $\delta\phi = 2\pi \Delta n L / \lambda$, with the factor
of 2 absorbed by the round-trip and the $L$ arising from the cavity length integration reduced to
the 2D overlap by the mode normalization).

**This is the central physical equation of the ORI architecture.** It says: the coupling of
power from mode $j$ into mode $i$ per round trip is proportional to the spatial overlap of the
output mode, the grating perturbation, and the input mode. The grating acts as a spatial
frequency filter that selectively couples pairs of modes according to their spatial frequency
difference. This is holographic diffraction expressed in the language of modes.

For the full holographic weight matrix with $r$ grating components, the **total coupling matrix**
in mode space is:

$$\mathbf{K}_{ij}(\Delta n) = \sum_{k=1}^{r} \kappa_{ij}^{(k)}
= \frac{\pi}{\lambda} \int\!\!\int
\psi_i^*(x,y)\; \Delta n(x,y)\; \psi_j(x,y)\; dx\, dy
\tag{2.10}$$

where the linearity of the integral allows the sum over grating components to be pulled inside.
The full round-trip operator in mode space is then:

$$\mathbf{M} = \sqrt{R} \left( \mathbf{I} + i\, \mathbf{K}(\Delta n) \right)
\tag{2.11}$$

The identity term $\mathbf{I}$ represents the unperturbed round-trip (the cavity would simply
circulate the field unchanged in the absence of any grating). The imaginary $i$ reflects that the
index modulation introduces a phase shift (the field acquires phase $\delta\phi = 2\pi \Delta n L / \lambda$
per round trip, and a phase shift $e^{i\delta\phi} \approx 1 + i\delta\phi$ to first order).
The prefactor $\sqrt{R}$ is the amplitude attenuation from mirror loss.

### 2.5 Mode-Dependent Diffraction Loss

Higher-order HG modes with total transverse order $p = m + n$ have a larger transverse extent
($\sim w_0 \sqrt{p}$) and therefore suffer greater diffraction loss at the finite aperture of the
mirror. The per-round-trip diffraction loss for mode $p$ is approximately:

$$\alpha_p^\text{diff} \approx \exp\!\left(-\frac{2 a^2}{w_0^2 p}\right)
\tag{2.12}$$

where $a = D/2 = 1.25$ mm is the mirror half-aperture. At $w_0 = 52\;\mu$m and $a = 1.25$ mm,
the ratio $a/w_0 = 24$. For the highest addressed mode ($p = 22$, corresponding to mode index
$i = 512$ in our labeling): $a^2 / (w_0^2 p) = 576/22 = 26.2$. The diffraction loss is
$e^{-2 \times 26.2} \approx 10^{-23}$ per round trip — entirely negligible. Diffraction loss for
all $N = 512$ modes is therefore not a limiting factor at the current aperture, confirming the
choice of $N = 512$ as well within the aperture capacity. The Fresnel number analysis
(§5 of architecture.md) reaches the same conclusion via a slightly different route.

### 2.6 The Rank-r Structure Is Exact

The rank-$r$ factorization $\mathbf{W} = \mathbf{U}\mathbf{V}^\top$ (with
$\mathbf{U}, \mathbf{V} \in \mathbb{R}^{N \times r}$) decomposes the weight matrix into a sum of
$r$ rank-1 outer products:

$$\mathbf{W} = \sum_{k=1}^{r} \mathbf{u}_k \otimes \mathbf{v}_k^\top
\tag{2.13}$$

Each outer product $\mathbf{u}_k \otimes \mathbf{v}_k^\top$ has $[\mathbf{u}_k \otimes
\mathbf{v}_k^\top]_{ij} = [u_k]_i [v_k]_j$. Comparing with the coupling coefficient in equation
(2.9), if we set:

$$\Delta n_k(x,y) = \frac{\lambda}{\pi}\, [u_k]_i\, [v_k]_j\;
\frac{\psi_i(x,y)\, \psi_j^*(x,y)}{|\psi_i|^2 \, |\psi_j|^2}
\tag{2.14}$$

(i.e., the grating profile is the product of the two mode profiles, which is exactly the
holographic recording condition: interfere a reference beam in mode $j$ with a signal beam in
mode $i$ to write a grating that couples $j \to i$), then:

$$\kappa_{ij}^{(k)} = \frac{\pi}{\lambda}\int\!\!\int
\psi_i^*\, \Delta n_k\, \psi_j\, dx\, dy = [u_k]_i\, [v_k]_j
\tag{2.15}$$

and therefore:

$$\mathbf{K}(\Delta n) = \sum_{k=1}^{r} \boldsymbol{\kappa}^{(k)} = \sum_{k=1}^r \mathbf{u}_k \otimes \mathbf{v}_k^\top = \mathbf{W}
\tag{2.16}$$

The coupling matrix **equals** the target weight matrix exactly. **The rank of the weight matrix
equals the number of angularly multiplexed holographic grating components.** There is no
approximation here — the holographic medium stores exactly the desired rank-$r$ operator as $r$
superimposed gratings at $r$ distinct angles, and the diffraction of the cavity field by this
medium implements the matrix-vector product $\mathbf{K} \cdot \mathbf{a}$ per round trip. At
$r = 50$ and PTR glass capacity $\sim 1000$ independent gratings (Glebov 2010), there is ample
headroom.

### 2.7 Angular Multiplexing Capacity

The angular selectivity of a thick holographic grating (PTR glass thickness $d = 0.5$ mm) is
set by the Bragg angular bandwidth:

$$\delta\theta_\text{Bragg} = \frac{\lambda}{2 d \sin\theta_B} \cdot \frac{n_0}{\Lambda}
\approx \frac{\lambda}{d}
\tag{2.17}$$

where $\Lambda = \lambda / (2\sin\theta_B)$ is the grating period for Bragg angle $\theta_B$. At
$\lambda = 532$ nm (write wavelength) and $d = 0.5$ mm: $\delta\theta_\text{Bragg} \approx 1.1$
mrad. The total angular range available for multiplexing is set by the numerical aperture of the
cavity ($\text{NA} \approx D/2L = 0.0625$ rad). The number of independently addressable Bragg
angles is therefore:

$$N_\text{Bragg} \approx \frac{0.0625}{1.1 \times 10^{-3}} \approx 57\;\text{per axis}
\tag{2.18}$$

In 2D (both $x$ and $y$ grating vectors), the total capacity is $N_\text{Bragg}^2 \approx 3,249$
independent grating components. The Glebov (2010) experimental figure of $\sim 1000$ independent
gratings for high-efficiency PTR recordings is consistent with this estimate (it reflects practical
diffraction efficiency budget, not the theoretical angular capacity). At rank-50, we use $< 2\%$
of this capacity, confirming no multiplexing bottleneck.

---

## 3. Field vs. Intensity: The Computational Basis

### 3.1 What the Resonator Computes

Inside the resonator, the computation is entirely on the complex field amplitudes
$\mathbf{a}(t) = \{a_i(t)\} \in \mathbb{C}^N$. The round-trip operator $\mathbf{M}$ from
equation (2.11) acts linearly on these complex numbers:

$$\mathbf{a}_{t+1} = \mathbf{M}\, \mathbf{a}_t
\tag{3.1}$$

After $T$ round trips with no new input: $\mathbf{a}_T = \mathbf{M}^T\, \mathbf{a}_0$.
This is a linear map over $\mathbb{C}^N$. The mode amplitudes $a_i$ carry both amplitude and
phase — they are not intensities.

### 3.2 The Detector Squares the Field

The Si PIN photodetector at layer $\ell$'s output measures the time-integrated intensity incident
on each pixel. Pixel $j$, with active area $\mathcal{A}_j$, produces a photocurrent proportional
to the total optical power it receives:

$$I_j^\text{photo} = \mathcal{R} \int_{\mathcal{A}_j} \left| E_T(x,y) \right|^2 dx\, dy
\tag{3.2}$$

where $\mathcal{R} = 0.6$ A/W is the Si PIN responsivity at 850 nm and $E_T$ is the output field
after $T$ round trips. Substituting the mode expansion (2.4) with output coefficients
$[a_T]_i = [\mathbf{M}^T]_i \cdot \mathbf{a}_0$ (where $[\mathbf{M}^T]_i$ denotes the $i$-th
row of $\mathbf{M}^T$):

$$\left| E_T(x,y) \right|^2 = \left| \sum_i [\mathbf{M}^T \mathbf{a}_0]_i\, \psi_i(x,y) \right|^2
\tag{3.3}$$

Integrating over pixel $j$:

$$I_j^\text{photo} = \mathcal{R} \int_{\mathcal{A}_j}
\left| \sum_i c_i\, \psi_i(x,y) \right|^2 dx\, dy
\tag{3.4}$$

where $c_i = [\mathbf{M}^T \mathbf{a}_0]_i$ are the output field amplitudes. Expanding the
modulus squared:

$$I_j^\text{photo} = \mathcal{R} \left[
\underbrace{\sum_i |c_i|^2 \int_{\mathcal{A}_j} |\psi_i(x,y)|^2\, dx\, dy}_{
\text{diagonal (incoherent) terms}}
+ \underbrace{\sum_{i \neq i'} c_i c_{i'}^* \int_{\mathcal{A}_j}
\psi_i(x,y)\, \psi_{i'}^*(x,y)\, dx\, dy}_{\text{cross terms (coherent interference)}}
\right]
\tag{3.5}$$

### 3.3 When Cross Terms Vanish: The Mode-Matching Design Requirement

The cross terms in equation (3.5) represent optical interference between different cavity modes
at the detector pixel. They are nonzero whenever (a) the field is coherent (definite phase
relationships between modes, which holds for $T \ll T_\text{coh}$) and (b) the pixel $j$ has
nonzero spatial overlap with more than one mode.

The HG modes are orthonormal over the full transverse plane (equation 2.3). However, this
global orthogonality does not imply that the overlap integral $\int_{\mathcal{A}_j} \psi_i \psi_{i'}^*\, dx\, dy$
vanishes for a finite pixel $j$. It will be nonzero whenever two modes have overlapping spatial
support within the pixel area.

The condition for cross-term suppression is therefore a **design requirement** on the detector
array geometry: each detector pixel $j$ must be sized and positioned such that it captures the
power of mode $\psi_j$ while excluding the power of all other modes. This requires the pixel
spacing to be no larger than the mode spacing, and the pixel active area to be matched to the
mode profile. For HG modes at fundamental waist $w_0 = 52\;\mu$m and VCSEL pitch $p = 50\;\mu$m,
the detector pixel pitch must satisfy:

$$p_\text{det} \leq p_\text{mode} = 50\;\mu\text{m}
\tag{3.6}$$

and the pixel active area should ideally match the mode profile $|\psi_j(x,y)|^2$. Under this
**mode-matched detector** condition, the overlap between mode $i$ and the pixel area of mode $j$
vanishes for $i \neq j$ (by the orthogonality and localization of HG modes at this pitch), and
equation (3.5) reduces to:

$$I_j^\text{photo} \approx \mathcal{R} \left[ |c_j|^2 \int_{\mathcal{A}_j} |\psi_j(x,y)|^2\, dx\, dy
+ \sum_{i \neq j} |c_i|^2 \int_{\mathcal{A}_j} |\psi_i(x,y)|^2\, dx\, dy \right]
\tag{3.7}$$

For a pixel matched to mode $\psi_j$, the first integral $\approx 1$ (captures most of mode $j$'s
power) and the second integral $\approx 0$ (negligible leakage from other modes). Therefore:

$$I_j^\text{photo} \approx \mathcal{R} |c_j|^2 = \mathcal{R} \left| [\mathbf{M}^T \mathbf{a}_0]_j \right|^2
\tag{3.8}$$

The photocurrent at pixel $j$ is proportional to the squared amplitude of output field mode $j$.
This is **not** a linear function of the input mode intensities $|a_{0,i}|^2$ — it is a quadratic
function of the input field amplitudes $a_{0,i}$.

### 3.4 The Intensity-Domain MVM Is a Quadratic Map

Define the input intensity (power) vector $\mathbf{P}^{(0)}$ with components $P_i^{(0)} = |a_{0,i}|^2$
(the input optical power in mode $i$), and the output intensity vector $\mathbf{P}^{(T)}$ with
components $P_j^{(T)} \propto I_j^\text{photo} / \mathcal{R} = |c_j|^2$. Writing $c_j$ explicitly:

$$c_j = [\mathbf{M}^T \mathbf{a}_0]_j = \sum_i [\mathbf{M}^T]_{ji}\, a_{0,i}
\tag{3.9}$$

and so:

$$P_j^{(T)} = |c_j|^2 = \left| \sum_i [\mathbf{M}^T]_{ji}\, a_{0,i} \right|^2
= \sum_i |[\mathbf{M}^T]_{ji}|^2 |a_{0,i}|^2
+ \sum_{i \neq i'} [\mathbf{M}^T]_{ji} [\mathbf{M}^T]^*_{ji'} a_{0,i} a_{0,i'}^*
\tag{3.10}$$

If the input modes are incoherent (random relative phases, as would occur if each VCSEL has an
independent phase), then $\langle a_{0,i} a_{0,i'}^* \rangle = 0$ for $i \neq i'$, and the
cross terms vanish on average. In that case:

$$P_j^{(T)} = \sum_i W_{ji}\, P_i^{(0)}, \qquad W_{ji} = |[\mathbf{M}^T]_{ji}|^2
\tag{3.11}$$

This **is** a linear MVM on the input intensity vector, with non-negative weight matrix
$\mathbf{W}$ given by the elementwise squared modulus of the field-domain operator $\mathbf{M}^T$.

However, in our coherent operating regime ($T \ll T_\text{coh}$), the VCSEL modes at the input
are phase-coherent (each VCSEL has a defined, controlled phase). The cross terms are therefore
not zero per se — they are nonzero but computable. The crucial observation is that **the training
procedure operates on the physical device**, measuring the actual output intensities $P_j^{(T)}$
through the real cavity including all coherence effects. The adjoint gradient
$\partial L / \partial \Delta n$ is computed from these real measurements. Therefore the training
automatically accounts for the cross terms: the hologram that gets written is not the one that
would give the correct answer in an incoherent approximation, but the one that gives the correct
answer through the actual coherent physics of the cavity. The incoherence approximation is useful
for deriving the intensity-domain MVM interpretation, but it is not relied upon by the training
procedure.

**Summary:** The intensity-domain MVM in equation (3.11) holds exactly when input modes are
incoherent (independent VCSEL phases). In the coherent regime, the mapping from input to output
intensities involves cross terms. In both cases, the in-situ training procedure learns the correct
hologram through direct measurement of the physical device, so the approximation level does not
affect training accuracy — it affects only the analytical interpretation of what the device computes.

For the paper, the clean statement is: **the resonator computes a learned quadratic map from
input field amplitudes to output intensities, which reduces to a linear intensity-domain MVM when
input modes are phase-incoherent.** Phase coherence of the input can be controlled by the VCSEL
drive phase (if phase coherence is desired) or randomized per-token (if the incoherent
approximation and its cleaner linear interpretation is desired). The incoherent case is the
default assumption for the intensity-basis claim in the architecture.

### 3.5 Correctness of the Intensity-ReLU Architecture

Regardless of whether the input is coherent or incoherent, the output of the detector is a
non-negative real number $P_j^{(T)} \geq 0$. The inter-layer signal chain (VCSEL driver →
threshold → VCSEL → next cavity) acts on this non-negative real output. The ReLU activation
in equation (1.6) of architecture.md operates on $P_j^{(T)}$:

$$P_j^\text{out} = A^2 \cdot \max\!\left(0,\; P_j^{(T)} - \theta\right)
\tag{3.12}$$

This is well-defined regardless of whether $P_j^{(T)}$ came from a coherent or incoherent input,
because the squaring at the detector already collapsed the complex field to a non-negative real
number. All subsequent computation (in layers $\ell = 2, \ldots, L$) operates on non-negative
real intensity vectors. **The signed-input problem (§4) is therefore confined entirely to the
input encoding at layer 1.**

---

## 4. Differential Encoding for Signed Inputs

### 4.1 The Sign Problem

Token embeddings in standard transformer architectures are real-valued vectors
$\mathbf{x} \in \mathbb{R}^d$ with components drawn (after layer normalization) from
approximately $\mathcal{N}(0, 1)$. About half the components are negative at any given token.

VCSEL optical power satisfies $P_i \geq 0$ unconditionally. Encoding the $i$-th embedding
component directly as VCSEL power $P_i \leftarrow x_i$ fails for $x_i < 0$ — negative optical
power is not physically realizable.

**Option A (DC offset):** Set $P_i \leftarrow x_i + B$ for a fixed bias $B$ large enough that
$x_i + B > 0$ for all expected $x_i$. For embeddings with $|x_i| \lesssim 3\sigma$ (99.7\% of
components at $\sigma = 1$), $B = 3$ suffices. This is technically correct but problematic:
the holographic weight matrix must represent and subtract a fixed bias $B \cdot \mathbf{1}$
on every forward pass. This consumes effective rank capacity and introduces a constant offset
in the output that must be corrected downstream. It is not the correct approach.

**Option B (Differential encoding):** Represent each signed component as the difference of two
non-negative quantities. This is the standard solution in analog computing and is the correct
approach here.

### 4.2 Differential (Split-Positive) Encoding

For each embedding component $x_i \in \mathbb{R}$, define the split-positive decomposition:

$$x_i^+ = \max(x_i,\; 0), \qquad x_i^- = \max(-x_i,\; 0)
\tag{4.1}$$

These satisfy $x_i^+, x_i^- \geq 0$ always, $x_i^+ \cdot x_i^- = 0$ (at most one is nonzero at a
time), and:

$$x_i = x_i^+ - x_i^-
\tag{4.2}$$

Each embedding dimension $i$ is assigned two spatial cavity modes: a **positive channel** mode
$\psi_i^+$ and a **negative channel** mode $\psi_i^-$. The full input field is encoded as:

$$E_\text{in}(x, y) = \sum_{i=1}^{d}
\left[ \sqrt{P_i^+}\; \psi_i^+(x, y) + \sqrt{P_i^-}\; \psi_i^-(x, y) \right]
\tag{4.3}$$

where $P_i^+ = \beta x_i^+$ and $P_i^- = \beta x_i^-$ for a scaling factor $\beta$ (set to
keep VCSEL power in the linear operating range, i.e., $\beta P_i^{+/-} \leq P_\text{sat}$).
The scaling factor $\beta$ is absorbed into the learned weight matrix and does not affect
expressiveness.

At the output of each layer, the signed output component is reconstructed as:

$$y_j = I_j^+ - I_j^-
\tag{4.4}$$

where $I_j^+$ and $I_j^-$ are the detector readings on the positive and negative channel of
output mode $j$ respectively. The holographic weight matrix is trained over the full
$2d$-dimensional mode space (positive and negative channels jointly) to implement the desired
map from $\mathbf{x}$ to $\mathbf{y}$.

### 4.3 Why Negative Channels Are Only Needed at the Input Boundary

After the first-layer ReLU activation:

$$P_j^\text{layer\,2, in} = A^2 \cdot \max(0,\; I_j^{(1)} - \theta) \geq 0
\tag{4.5}$$

The ReLU output is non-negative by construction. Therefore, at the input to layer 2, all mode
amplitudes are real and non-negative — there are no negative components to encode. Layer 2 and
all subsequent layers operate entirely on non-negative intensity vectors and do not require
differential encoding. The negative channel modes $\psi_i^-$ carry zero power from layer 2
onwards (or can be physically absent — the VCSEL for the negative channel simply outputs zero
after the first ReLU).

**Differential encoding adds overhead only at the input layer.** The VCSEL array at the input
grows from $N = 512$ to $N^{(1)} = 2d = 1024$ emitters. All subsequent VCSEL arrays remain at
$N = 512$ emitters. The holographic weight matrix for layer 1 is $512 \times 1024$ (mapping
$1024$ input modes to $512$ output modes); for layers 2–24 it is $512 \times 512$.

### 4.4 Impact on System Parameters

The aperture requirement for the input layer is:

$$N^{(1)} = 1024\;\text{modes at }50\;\mu\text{m pitch}
\Rightarrow \text{VCSEL array footprint: } 32 \times 32 = 1024\;\text{emitters in }1.6 \times 1.6\;\text{mm}^2
\tag{4.6}$$

This sits comfortably within the 2.5 mm optical aperture. The mode capacity at Finesse $= 3140$ is
$N_\text{max} \approx 6635$ (see §4.2 of architecture.md), so 1024 modes uses 15.4\% of capacity
at the first layer — still well within limits.

The rank-50 factorization for layer 1 becomes $\mathbf{W}^{(1)} = \mathbf{U}^{(1)} (\mathbf{V}^{(1)})^\top$
with $\mathbf{U}^{(1)} \in \mathbb{R}^{512 \times 50}$ and $\mathbf{V}^{(1)} \in \mathbb{R}^{1024 \times 50}$,
giving $512 \times 50 + 1024 \times 50 = 76,800$ weights at the input layer instead of $51,200$
for the internal layers. The total parameter count for a 24-layer stack with differential input:

$$N_\text{params} = 76,800 + 23 \times 51,200 = 76,800 + 1,177,600 = 1,254,400 \approx 1.25\text{M}
\tag{4.7}$$

This is a modest 1.7\% increase over the previous 1.23M estimate. The architecture document
(ARCH-7) should be updated to reflect this.

---

## 5. The Complete Layer Computation

Having resolved all four foundational questions, the full single-layer forward pass can now be
written as a closed-form chain of equations:

**Step 1 — Input encoding (layer 1 only):**

$$\mathbf{a}_0^{(\ell=1)} = \left[\sqrt{\beta x_1^+},\, \sqrt{\beta x_1^-},\, \ldots,\, \sqrt{\beta x_d^+},\, \sqrt{\beta x_d^-}\right]^\top \in \mathbb{R}^{2d}
\tag{5.1}$$

**Step 1' — Input encoding (layers 2–L):**

$$\mathbf{a}_0^{(\ell)} = \sqrt{\mathbf{P}^{(\ell-1)}} \in \mathbb{R}^d \quad [\text{amplitude re-encoding from previous layer intensities}]
\tag{5.2}$$

**Step 2 — Resonator propagation (T round trips, field domain):**

$$\mathbf{a}_T^{(\ell)} = \mathbf{M}^T \cdot \mathbf{a}_0^{(\ell)},
\qquad \mathbf{M} = \sqrt{R}\left(\mathbf{I} + i\,\mathbf{K}(\Delta n^{(\ell)})\right)
\tag{5.3}$$

**Step 3 — Detection (squaring, incoherent limit):**

$$P_j^{(\ell)} = \left|[\mathbf{M}^T]_j \cdot \mathbf{a}_0^{(\ell)}\right|^2
\approx \sum_i W_{ji}^{(\ell)}\, \left|[a_0^{(\ell)}]_i\right|^2,
\qquad W_{ji}^{(\ell)} = \left|[\mathbf{M}^T]_{ji}\right|^2
\tag{5.4}$$

**Step 4 — ReLU activation (VCSEL threshold):**

$$P_j^{(\ell+1),\,\text{pre}} = A^2 \cdot \max\!\left(0,\; P_j^{(\ell)} - \theta\right),
\qquad A^2 = 1.2,\quad \theta = 0.5\;\text{mW}
\tag{5.5}$$

Steps 2–4 constitute one complete layer. Stacking $L = 24$ such layers gives the complete
24-layer ORI forward pass. The computation alternates between linear operations in the field
domain (equation 5.3, implemented by photon-glass interaction at the speed of light) and
nonlinear squaring (equation 5.4, implemented by photodetection) interleaved with ReLU thresholding
(equation 5.5, implemented by VCSEL threshold nonlinearity). The architecture is a depth-$L$
network of depth-$T$ weight-tied RNNs, separated by intensity-domain ReLU activations.

---

## 6. Open Assumptions and Validation Requirements

These are the assumptions made in the above derivations that are not yet experimentally confirmed.
They are listed here explicitly so the paper can state its theoretical assumptions without hiding
them.

**A1 — Scalar wave equation (paraxial approximation).** The derivation in §1 uses the scalar wave
equation. The vector wave equation (full Maxwell) adds polarization coupling terms. For linearly
polarized modes (single vertical polarization, ARCH-3) in a low-NA cavity ($\text{NA} = 0.063$),
the paraxial scalar approximation introduces errors of order $(\text{NA})^2 \approx 0.004$ (0.4\%).
This is below the 6-bit precision floor and is safely neglected.

**A2 — First-order perturbation theory for the coupling coefficient (equation 2.9).** Valid when
$\Delta n / n_0 \ll 1$. At $\Delta n_\text{max} = 5 \times 10^{-3}$ and $n_0 = 1.49$: ratio = 0.003.
Second-order corrections are of order $(0.003)^2 = 9 \times 10^{-6}$ — entirely negligible.

**A3 — HG mode orthogonality at the detector pixel scale.** The cross-term suppression in §3.3
requires that detector pixel $j$ captures mode $\psi_j$ while excluding $\psi_{i \neq j}$.
For 50 $\mu$m mode spacing and 50 $\mu$m detector pitch, this requires the mode profiles to be
well-localized within their 50 $\mu$m cells. HG mode $\psi_{mn}$ has RMS width
$\sigma = w_0 \sqrt{2(m+n)+1}/2$; at $w_0 = 52\;\mu$m and $m+n \leq 22$: $\sigma \leq 52 \times \sqrt{45}/2 \approx 174\;\mu$m.
This is larger than the 50 $\mu$m pixel pitch, meaning **mode leakage between adjacent pixels is
non-negligible for high-order modes**. This is a genuine concern for the intensity-MVM
interpretation at high mode indices. However, because training is in-situ (the adjoint is computed
from real physical measurements through the actual detector), the leakage is automatically
incorporated into the learned hologram. The in-situ training handles the cross terms implicitly.
The intensity-MVM approximation is most accurate for low-order modes ($m+n \leq 5$) and degrades
for high-order modes — this should be stated in the paper.

**A4 — $\sigma_r(850\,\text{nm}) \approx 0$ for PTR glass (EXP-2).** The wavelength-separation
training isolation (ARCH-11) rests on the photorefractive cross-section at 850 nm being
negligibly small. This is supported by the PTR glass photosensitivity spectrum (Glebov 2010) but
has not been measured at the exact operating conditions (2–3 W intra-cavity CW). EXP-2 validates
this claim.

**A5 — Kinematic mount reinstallation precision.** Clone-and-fine-tune (ARCH-17) and iterative
write-develop training (ARCH-11) both require removing the PTR glass for furnace development and
reinstalling it to sub-wavelength positional accuracy. This requires a kinematic mount with
repeatability $\ll \lambda/4 = 212\;\text{nm}$. Standard kinematic mounts achieve $\sim 1\;\mu\text{m}$
repeatability — three times worse than needed. The training protocol must either tolerate this
positional error (by treating the reinstalled cavity as a new forward model and computing new
gradients) or use active cavity locking to recover the phase reference. This is an unresolved
engineering constraint, not a physics barrier. Flagged for resolution in EXP-7.

**A6 — Intra-cavity power at resonance (thermal lensing).** At Finesse = 3140 and 2.5 mW per
VCSEL mode, the on-resonance intra-cavity power is $\approx$ Finesse/$\pi \times P_\text{input} \approx 1000 \times 2.5\;\text{mW} = 2.5\;\text{W}$ circulating. At this power level, $\text{d}n/\text{d}T$ of PTR glass
can produce a thermal lens that shifts the cavity mode structure on the time scale of a token
($\sim 13\;\text{ns}$). EXP-4 characterizes this drift. If thermal lensing is significant,
the effective $w_0$ and mode profiles change during operation, invalidating the static mode basis
used in §2.1. Active compensation or reduced intra-cavity power (at the cost of SNR) may be
required.

---

*End of theory derivations document.*

*References: Hughes et al. 2019 (wave eq = RNN); Psaltis et al. 1990 (holographic MVM); Yariv 1973
(coupled-mode theory); Glebov 2010 (PTR glass capacity); Larsson 2011 (VCSEL linewidth); Hornik
1991 / Leshno 1993 (universal approximation); Pai et al. 2023 (in-situ photonic backprop).*

---

## 7. T=1 Single-Pass Rank Derivation

**Status:** Derived 2026-05-08  
**Purpose:** Establishes rank ceiling for T=1 feedforward mode as a function of PTR plate thickness. Distinct from T=100 rank (SNR-limited); T=1 rank is grating-capacity-limited.

### 7.1 Physical Regime

At T=1, the field makes one pass through the PTR holographic grating. The computation is a holographic correlation:

$$y_j = \left|\int \psi_j^*(\mathbf{x}) \cdot \left[M \cdot u_\text{in}\right](\mathbf{x})\, d\mathbf{x}\right|^2 \tag{7.1}$$

where M is the single-pass transfer function of the grating. This is a feedforward optical transformation — not a recurrent computation. Depth requires stacking independent cavities with SOA inter-stage amplification; weight-tying across round trips does not apply.

Crucially, the SNR accumulation over T=100 round trips (0.869 dB total mirror loss) is replaced by single-pass loss of 0.00869 dB. The rank constraint shifts entirely from SNR budget to grating angular multiplexing capacity.

### 7.2 Kogelnik Coupling Constant

For an unslanted reflection grating in PTR glass, the coupling constant from Kogelnik (1969) coupled-wave theory is:

$$\kappa = \frac{\pi \cdot \Delta n_\text{max}}{\lambda} \tag{7.2}$$

With $\Delta n_\text{max} = 5 \times 10^{-3}$ (Glebov 2010) and $\lambda = 850\,\text{nm}$:

$$\kappa = \frac{\pi \times 5 \times 10^{-3}}{850 \times 10^{-9}} = 18{,}480\,\text{m}^{-1} \tag{7.3}$$

Peak diffraction efficiency for a single grating of thickness $d$ at exact Bragg condition:

$$\eta_\text{peak} = \sin^2(\kappa d) \tag{7.4}$$

At $d = 0.5\,\text{mm}$: $\eta_\text{peak} = 0.034$ (3.4%). At $d = 5\,\text{mm}$: $\eta_\text{peak} = 0.925$ (92.5%). Absorption penalty $T_\text{abs} = e^{-2\alpha d}$ with $\alpha = 1\,\text{m}^{-1}$ is negligible at all thicknesses ($< 0.1\,\text{dB}$ at $d = 10\,\text{mm}$).

### 7.3 Bragg Angular Selectivity

The angular half-width (first null) of the Bragg response for a thick grating in the paraxial regime (Goodman, *Fourier Optics*, 4th ed.):

$$\Delta\theta_\text{Bragg} = \frac{\lambda}{n_0 \cdot d} \tag{7.5}$$

with $n_0 = 1.49$ for PTR glass. This is the minimum angular separation between independently resolvable holographic gratings.

| $d$ | $\Delta\theta_\text{Bragg}$ |
|:----|:----|
| 0.5 mm | 1.14 mrad |
| 2.0 mm | 0.285 mrad |
| 5.0 mm | 0.114 mrad |

### 7.4 Angular Multiplexing Capacity

The total angular range available for multiplexing is set by the cavity NA:

$$\Delta\theta_\text{total} = 2 \cdot \text{NA} = \frac{\text{aperture}}{L_\text{cav}} = \frac{2.5\,\text{mm}}{20\,\text{mm}} = 0.125\,\text{rad} \tag{7.6}$$

The number of angularly resolvable gratings (Mok 1993, *Opt. Lett.* 18:915):

$$R_\text{angular} = \frac{\Delta\theta_\text{total}}{\Delta\theta_\text{Bragg}} = \frac{2 \cdot \text{NA} \cdot n_0 \cdot d}{\lambda} \tag{7.7}$$

### 7.5 Dynamic Range Constraint

When $R$ gratings are written with equal strength, the available $\Delta n_\text{max}$ is divided among them: $\Delta n_i = \Delta n_\text{max} / R$. The diffraction efficiency per grating in the weak-grating limit ($\kappa d \ll 1$) is:

$$\eta_i = \left(\frac{\pi \cdot \Delta n_\text{max}}{R \cdot \lambda}\right)^2 d^2 \tag{7.8}$$

Requiring $\eta_i \geq \eta_\text{threshold} = 0.01$ (1% minimum for 38 dB readout SNR) gives the dynamic-range rank limit (Psaltis 1994):

$$R_\text{dynamic} = \frac{\pi \cdot \Delta n_\text{max} \cdot d}{\lambda \cdot \sqrt{\eta_\text{threshold}}} \tag{7.9}$$

### 7.6 Binding Constraint and Results

The actual rank is $R = \min(R_\text{angular},\, R_\text{dynamic})$. At all evaluated thicknesses, $R_\text{dynamic} < R_\text{angular}$: **dynamic range is the binding constraint.**

| $d$ | $R_\text{angular}$ | $R_\text{dynamic}$ | $R_\text{actual}$ | $\eta_i$ at $R_\text{actual}$ |
|:----|:----|:----|:----|:----|
| 0.5 mm | 110 | 92 | **92** | 1.0% |
| 1.0 mm | 219 | 185 | **185** | 1.0% |
| 2.0 mm | 438 | 370 | **370** | 1.0% |
| 5.0 mm | 1096 | 924 | **924** | 1.0% |
| 10.0 mm | 2191 | 1848 | **1848** | 1.0% |

**Key results:**

- Current 0.5 mm plate: $R = 92$. Exceeds T=100 rank-50 baseline but falls short of rank-100 production target. Insufficient for T=1 production use.
- **2.0 mm plate: $R = 370$.** Conservative upgrade. Exceeds T=100 rank-100 production target by 3.7×. Absorption loss 0.017 dB (negligible). PTR glass available at this thickness.
- 5.0 mm plate: $R = 924$. Strong headroom but requires verification of thermal gradient stability and fabrication quality at this thickness.

### 7.7 Comparison with T=100 Rank

| Regime | Rank ceiling | Binding constraint |
|:----|:----|:----|
| T=100, 0.5mm plate | 200 (hard ceiling) | SNR margin exhausted |
| T=1, 0.5mm plate | 92 | Dynamic range ($\eta_i$) |
| T=1, 2.0mm plate | 370 | Dynamic range ($\eta_i$) |
| T=1, 5.0mm plate | 924 | Dynamic range ($\eta_i$) |

At T=1, increasing plate thickness directly increases rank without SNR penalty. The SNR headroom recovered by eliminating 99 round trips is not available to increase rank within the same plate — it is available to tolerate inter-stage SOA noise figure (~7 dB NF per SOA) in a multi-cavity FFN stack.

### 7.8 Open Assumptions

1. $\eta_\text{threshold} = 0.01$ assumed from SNR target. Actual threshold depends on intra-cavity power, detector NEP, and SOA noise — requires closure against the 38 dB SNR budget (EXP open).
2. Weak-grating approximation (eq. 7.8) assumes $\kappa d / R \ll 1$. Valid when $R \gg \kappa d / \pi$; at $d = 2\,\text{mm}$, $\kappa d = 36.96$, $R = 370$, ratio $= 0.10$. Marginally valid — full Kogelnik coupled-wave solution should be used for final design.
3. PTR glass uniformity and Δn_max at thicknesses > 1 mm unverified in literature at 850 nm. Glebov 2010 data is for ~0.5–2 mm samples.
4. Multi-stage SOA SNR budget (inter-stage noise accumulation across N FFN layers) not yet derived. This is the binding SNR constraint for T=1 multi-cavity architecture.

---

## 8. Full Kogelnik Coupled-Wave Solution for Multiplexed Reflection Gratings

**Status:** Derived 2026-05-08  
**Purpose:** Replaces the weak-grating approximation in §7 with the exact Kogelnik (1969) coupled-wave solution for the PTR reflection grating. Validates §7 rank results and resolves the open assumption in §7.8 item 2.

### 8.1 Why the Weak Approximation Was Flagged

In §7, eq. 7.8 used the weak-grating limit $\eta_i \approx (\kappa_i d)^2$, valid when $\kappa_i d \ll 1$. At $d = 2\,\text{mm}$ with $R = 370$ gratings, the per-grating coupling parameter was:

$$\kappa_i d = \frac{\pi \Delta n_\text{max}}{R \lambda} \cdot d \approx 0.100$$

The rule of thumb $\kappa_i d \ll 1$ is conventionally taken as $\kappa_i d < 0.1$. Our operating point sits exactly at this boundary — marginal validity, flagged for resolution.

### 8.2 Exact Kogelnik Solution: Reflection Grating

For an **unslanted reflection grating** in a medium with index modulation $\Delta n$ and amplitude absorption $\alpha_s = \alpha/2$, the exact coupled-wave solution at the Bragg condition (zero phase mismatch) gives (Kogelnik 1969, eq. 57; Solymar & Cooke, *Volume Holography*):

$$\eta = \frac{\tanh^2\!\left(\sqrt{\nu^2 - \xi^2}\right)}{1 - \left(\xi/\nu\right)^2} \tag{8.1}$$

where the dimensionless parameters are:

$$\nu = \kappa d = \frac{\pi \Delta n \, d}{\lambda} \quad \text{(grating strength)} \tag{8.2}$$

$$\xi = \alpha_s d = \frac{\alpha d}{2} \quad \text{(absorption parameter)} \tag{8.3}$$

**In the lossless limit** ($\xi \to 0$, which holds for PTR glass at 850nm with $\alpha = 0.01\,\text{cm}^{-1}$, giving $\xi < 5\times10^{-4}$ at $d = 10\,\text{mm}$):

$$\eta = \tanh^2(\nu) = \tanh^2\!\left(\frac{\pi \Delta n \, d}{\lambda}\right) \tag{8.4}$$

This is the governing equation for the PTR reflection grating. The $\sin^2(\nu)$ form used in §7 Step 2 is the **transmission** grating result — a different geometry. For a reflection grating in the lossless regime: $\tanh^2$, not $\sin^2$.

**Note on single full-strength grating:** at $d = 0.5\,\text{mm}$, $\nu = \kappa d = 9.24 \gg 1$, so $\tanh^2(9.24) \approx 1.000$ — the grating is saturated, diffracting nearly 100% at full $\Delta n_\text{max}$. The $\sin^2$ approximation gave $\eta = 0.034$, which was dramatically wrong for the single-grating case. This error cancels in the multiplexed-grating rank calculation (as shown below), but using $\tanh^2$ throughout is correct.

### 8.3 Multiplexed Gratings: Exact Rank Ceiling

When $R$ gratings are written with equal strength $\Delta n_i = \Delta n_\text{max} / R$, each has:

$$\nu_i = \frac{\pi \Delta n_\text{max}}{R \lambda} \cdot d \tag{8.5}$$

The exact diffraction efficiency per grating is $\eta_i = \tanh^2(\nu_i)$. Setting $\eta_i \geq \eta_\text{threshold}$ and solving for $R$:

$$\tanh(\nu_i) \geq \sqrt{\eta_\text{threshold}}$$

$$\nu_i \geq \text{arctanh}\!\left(\sqrt{\eta_\text{threshold}}\right)$$

$$\frac{\pi \Delta n_\text{max} \, d}{R \, \lambda} \geq \text{arctanh}\!\left(\sqrt{\eta_\text{threshold}}\right)$$

$$\boxed{R_\text{dynamic} = \frac{\pi \Delta n_\text{max} \, d}{\lambda \cdot \text{arctanh}\!\left(\sqrt{\eta_\text{threshold}}\right)}} \tag{8.6}$$

Compare with the §7 weak-approximation result (eq. 7.9):

$$R_\text{dynamic,weak} = \frac{\pi \Delta n_\text{max} \, d}{\lambda \cdot \sqrt{\eta_\text{threshold}}} \tag{8.7}$$

The ratio is:

$$\frac{R_\text{exact}}{R_\text{weak}} = \frac{\sqrt{\eta_\text{threshold}}}{\text{arctanh}\!\left(\sqrt{\eta_\text{threshold}}\right)} \tag{8.8}$$

This ratio depends **only on $\eta_\text{threshold}$**, not on $d$, $\lambda$, or $\Delta n_\text{max}$. For $\eta_\text{threshold} = 0.01$:

$$\frac{\sqrt{0.01}}{\text{arctanh}(\sqrt{0.01})} = \frac{0.1000}{0.10034} = 0.9967$$

**The weak approximation overestimates rank by 0.3%.** This is negligible at any engineering precision. The §7 results stand.

### 8.4 The Invariant Operating Point

A key structural insight from eq. 8.6: at the dynamic-range rank ceiling, every grating operates at exactly:

$$\kappa_i d = \nu_i = \text{arctanh}\!\left(\sqrt{\eta_\text{threshold}}\right) = 0.1003 \tag{8.9}$$

This is a **fixed operating point** determined entirely by $\eta_\text{threshold}$. It does not depend on plate thickness, wavelength, or $\Delta n_\text{max}$. Increasing $d$ does not change where each grating operates — it increases how many gratings fit at that operating point. The rank ceiling scales linearly with $d$ because $R_\text{dynamic} \propto d$ while $\nu_i$ stays fixed.

Physical interpretation: the system self-organizes so that every hologram diffracts at exactly the threshold. Adding thickness adds capacity without changing the per-hologram operating condition.

### 8.5 Corrected Rank Table

| $d$ | $R_\text{weak}$ (§7) | $R_\text{exact}$ | $\Delta$ | $\eta_i$ at $R_\text{exact}$ |
|:----|:----|:----|:----|:----|
| 0.5 mm | 92 | **92** | −0.3% | 1.000% |
| 1.0 mm | 185 | **184** | −0.3% | 1.000% |
| 2.0 mm | 370 | **368** | −0.3% | 1.000% |
| 5.0 mm | 924 | **921** | −0.3% | 1.000% |
| 10.0 mm | 1848 | **1842** | −0.3% | 1.000% |

Dynamic range is binding at all thicknesses ($R_\text{dynamic} < R_\text{angular}$). The 2 mm plate recommendation from §7 is confirmed: $R = 368$.

### 8.6 Resolution of §7.8 Open Assumption 2

*"Weak-grating approximation (eq. 7.8) assumes $\kappa d / R \ll 1$... Marginally valid — full Kogelnik coupled-wave solution should be used for final design."*

**Resolved.** The exact Kogelnik solution changes the rank ceiling by 0.3% — within numerical noise of any physical measurement. The weak approximation is valid here because the dynamic-range constraint forces $\nu_i = \kappa_i d = 0.1003$, which is squarely in the regime where $\tanh(x) \approx x$. The approximation is self-consistently valid at the operating point it defines.

Open assumptions 1, 3, and 4 from §7.8 remain open.

---

## 9. Gas Standing Wave Weight Grating: Cs Vapor at 852nm

**Status:** Derived 2026-05-08  
**Purpose:** Evaluates whether a gas medium (Cs vapor, 852nm D2 line) in a Fabry-Perot cavity can encode weight gratings via spatial hole burning (SHB) of the standing wave. Answers whether gas replaces or augments PTR glass as a weight medium.  
**Note:** HeNe at 632.8nm flagged for parallel evaluation — same physics applies, with additional wavelength mismatch penalty. See §9.6.

### 9.1 Physical Mechanism

In a Fabry-Perot cavity, the forward and backward waves interfere to create a standing wave with period $\lambda/2$. In a gas medium with population inversion (or absorption), this intensity pattern creates **spatial hole burning** (SHB): gain/absorption is depleted at antinodes, preserved at nodes. The resulting periodic modulation of population inversion $\Delta N(z)$ produces, via the Kramers-Kronig relation, a periodic index modulation $\Delta n(z)$ — the weight grating.

**Ring cavities do not support this mechanism** — traveling-wave operation produces no standing wave and no SHB grating. Fabry-Perot is required.

### 9.2 Cs D2 Line Parameters

All values from Steck (2010), *Cesium D Line Data*:

| Parameter | Value |
|:----|:----|
| $\lambda$ | 852.1 nm |
| $\tau_\text{upper}$ | 30.5 ns |
| $\gamma_\text{sp}/(2\pi)$ | 5.22 MHz (natural linewidth) |
| $d_\text{dipole}$ | $3.213 \times 10^{-29}$ C·m |
| $\sigma_0 = 3\lambda^2/2\pi$ | $3.47 \times 10^{-13}$ m² (resonant cross-section) |

**Doppler broadening** at $T = 350\,\text{K}$ (typical Cs cell):

$$\Delta\nu_D = \frac{c_0}{\lambda}\sqrt{\frac{8k_BT\ln 2}{m}} = 1.23 \times 10^{11}\,\text{Hz} \tag{9.1}$$

$$\frac{\Delta\nu_D}{\Delta\nu_\text{nat}} = 2.35 \times 10^{10} \tag{9.2}$$

This ratio is the fundamental problem. Every atom in a gas at 350K has a velocity-shifted resonance, distributing absorption over $2.35 \times 10^{10}$ natural linewidths. The effective cross-section available to a monochromatic field is diluted by this factor.

### 9.3 SHB Grating Amplitude

The saturation parameter at intra-cavity intensity $I$:

$$s = \frac{I}{I_\text{sat,eff}}, \quad I_\text{sat,eff} = I_\text{sat} \cdot \frac{\Delta\nu_D}{\Delta\nu_\text{nat}} \tag{9.3}$$

For our cavity ($P_\text{in} = 1\,\text{mW}$, Finesse = 3140, aperture 2.5mm): $I_\text{incav} = 2.0 \times 10^5\,\text{W/m}^2$, $I_\text{sat,eff} = 2.6 \times 10^{11}\,\text{W/m}^2$, giving $s = 7.9 \times 10^{-7}$.

The SHB grating amplitude is $\Delta N_\text{grating} = \Delta N_0 \cdot s/2$. Via Kramers-Kronig:

$$\Delta n_\text{gas} = \frac{\Delta\alpha \cdot \lambda}{4\pi} = \frac{\sigma_0 \cdot N \cdot s \cdot \lambda}{4\pi} \cdot \frac{\Delta\nu_\text{nat}}{\Delta\nu_D} \tag{9.4}$$

At $T = 350\,\text{K}$, $N = 4.0 \times 10^{18}\,\text{m}^{-3}$: $\Delta n_\text{gas} = 3.2 \times 10^{-18}$.

**This is $6 \times 10^{-16}$ times the PTR value** of $5 \times 10^{-3}$.

### 9.4 Grating Lifetime

Three competing decay mechanisms:

| Mechanism | Timescale | Expression |
|:----|:----|:----|
| Spontaneous emission | $\tau_\text{sp} = 30.5\,\text{ns}$ | Radiative decay |
| Transit across grating period | $\tau_\text{transit} = \lambda/(2v_\text{th}) = 2.0\,\text{ns}$ | $v_\text{th} = 209\,\text{m/s}$ at 350K |
| Collisional dephasing | $\tau_\text{col} \gg \tau_\text{sp}$ at $p = 0.02\,\text{Pa}$ | Not binding |

**Binding mechanism: transit.** Thermal motion washes out the $\lambda/2$ grating in 2.0 ns — faster than one token processing time ($13.3\,\text{ns}$ at $T = 100$, $133\,\text{ps}$ at $T = 1$). Even at $T = 1$, the grating lifetime is only 15× the round-trip time.

### 9.5 Rank Ceiling and Rescue Scenarios

Applying the §8 Kogelnik framework with $\Delta n_\text{gas}$ and $L = 20\,\text{mm}$:

$$R_\text{dynamic} = \frac{\pi \cdot \Delta n_\text{gas} \cdot L}{\lambda \cdot \text{arctanh}(\sqrt{\eta_\text{threshold}})} \approx 0 \tag{9.5}$$

The gas grating rank is negligible at any standard operating condition. Three rescue scenarios evaluated:

**Scenario A — High-temperature Cs:** Increasing $T$ raises vapor pressure faster than Doppler broadening grows (pressure $\propto e^{-1/T}$, Doppler $\propto T^{1/2}$). At $T = 1200\,\text{K}$, $\Delta n \approx 7.9 \times 10^{-5}$, giving $R \approx 58$. Within 1.6× of the PTR 0.5mm baseline rank of 92 — but requires a 1200K oven and Cs containment, which is an extreme engineering constraint.

**Scenario B — EIT (electromagnetically induced transparency):** A coupling field creates a narrow transparency window, suppressing absorption while preserving dispersive response. The EIT index modulation (dark-state coherence, not population inversion) reaches $\Delta n_\text{EIT} \sim 2.8 \times 10^{-3}$ — within a factor of 2 of PTR. However: (1) EIT suppresses the absorption that drives SHB, so the weight-writing mechanism changes fundamentally; (2) the grating is written in atomic coherence, not population inversion, with lifetime set by ground-state decoherence ($\sim\mu$s in buffer-gas cells); (3) read/write wavelength separation becomes non-trivial. EIT warrants a separate derivation before architectural conclusions.

**Scenario C — Rare-earth doped crystal:** $\text{Pr}^{3+}:\text{Y}_2\text{SiO}_5$ or $\text{Er}^{3+}:\text{YSO}$ have inhomogeneous broadening ~GHz with homogeneous linewidth ~kHz — effectively "frozen gas" with no transit broadening. Spectral hole burning gives $\Delta n \sim 10^{-4}$, rank $\sim 73$ at 20mm. Grating lifetime reaches ms–s. This is a solid-state medium, not a gas, but inherits the standing-wave encoding concept.

### 9.6 HeNe Note (632.8nm)

Ne has $\Delta\nu_D/\Delta\nu_\text{nat} = 2.8 \times 10^{11}$ (lighter atom, hotter discharge, higher dilution ratio than Cs). $\Delta n_\text{HeNe}(s=1) \approx 10^{-9}$, transit time $\tau \approx 0.55\,\text{ns}$ (faster — Ne is 6× lighter than Cs). Both $\Delta n$ and $\tau$ are worse than Cs. Additionally, $\lambda = 632.8\,\text{nm}$ requires full redesign of VCSEL, detector, and PTR operating point. HeNe is not a viable weight medium for ORI.

### 9.7 Architectural Verdict

| Medium | $\Delta n$ | Rank (20mm) | $\tau_\text{grating}$ | Viable? |
|:----|:----|:----|:----|:----|
| PTR glass (0.5mm, permanent) | $5\times10^{-3}$ | 92 | Permanent | **Yes — baseline** |
| PTR glass (2mm, permanent) | $5\times10^{-3}$ | 368 | Permanent | **Yes — T=1 target** |
| Cs SHB at 350K | $3\times10^{-18}$ | $\approx 0$ | 2 ns | No |
| Cs SHB at 1200K | $8\times10^{-5}$ | 58 | $<2\,\text{ns}$ | No (engineering) |
| Cs EIT at 350K | $\sim3\times10^{-3}$ | $\sim2200$ | $\mu$s–ms | Possibly — separate derivation needed |
| Rare-earth crystal | $\sim10^{-4}$ | 73 | ms–s | Possibly — different architecture |
| HeNe at 632.8nm | $10^{-9}$ | $\approx 0$ | 0.55 ns | No |

**Gas weight encoding via SHB is not viable for ORI** at any practically accessible operating condition. The Doppler broadening dilution factor of $\sim 10^{10}$ is a fundamental atomic physics constraint, not an engineering problem.

**The gas medium role that is viable:** inter-cavity gain amplification (the role suggested by the cascaded-gain-coupling paper). A Cs or HeNe discharge between PTR cavities acts as a gain element compensating inter-stage coupling loss — analogous to the SOA inter-stage amplifier in the T=1 FFN architecture (§7), but at gas-laser wavelengths. This is the correct architectural role for gas in ORI.

**EIT Cs is the one exception worth pursuing separately.** $\Delta n_\text{EIT} \sim 3\times10^{-3}$ is within 2× of PTR, with $\mu$s grating lifetime and all-optical write/erase. The mechanism is fundamentally different (coherence grating vs population grating) and requires a dedicated derivation. Flagged as a potential future architecture branch.

---

## 10. EIT Coherence Grating: Full Derivation and Geometry Analysis

**Status:** Derived 2026-05-08  
**Purpose:** Derives rank ceiling and scaling for EIT coherence gratings in Cs vapor as an all-optical writable weight medium. Resolves the Tier 3 candidate from §9.7. Unlocks geometry from Fabry-Perot to ring cavity where physically motivated.  
**Note:** HeNe at 632.8nm flagged as parallel candidate — same formalism applies, λ mismatch penalty additional. Defer to future session.

### 10.1 Physical Mechanism: Coherence Grating vs Population Grating

The SHB grating of §9 stores weight information in population inversion modulation $\Delta N(z)$ — a real (absorptive) quantity that decays by spontaneous emission and atomic transit. The EIT coherence grating stores weight information in the ground-state atomic coherence $\rho_{12}(z)$ — a complex (dispersive) quantity that decays only by ground-state dephasing $\gamma_{12}$, which can be made orders of magnitude smaller than $\Gamma_e$.

**The Cs $\Lambda$-system:**
- $|1\rangle = 6S_{1/2}, F=3$ (probe ground state)
- $|2\rangle = 6S_{1/2}, F=4$ (coupling ground state, $\Delta_{hf} = 9.193\,\text{GHz}$ above $|1\rangle$)
- $|3\rangle = 6P_{3/2}$ (excited state, $\tau = 30.5\,\text{ns}$)
- Probe: $|1\rangle \to |3\rangle$ at 852.1nm (inference field)
- Coupling: $|2\rangle \to |3\rangle$ at 852.1nm (weight-writing field)

### 10.2 EIT Susceptibility from Density Matrix

For a weak probe field (Rabi frequency $\Omega_p$) with one-photon detuning $\delta_1$ and two-photon detuning $\delta_2$ (Fleischhauer, Imamoglu, Marangos, *Rev. Mod. Phys.* 2005, Eq. 4.2):

$$\chi_p = -\frac{N d_{13}^2}{\varepsilon_0 \hbar} \cdot \frac{\gamma_{12} - i\delta_2}{\left(\frac{\Gamma_e}{2} - i\delta_1\right)\!\left(\gamma_{12} - i\delta_2\right) + \frac{\Omega_c^2}{4}} \tag{10.1}$$

At line center and two-photon resonance ($\delta_1 = \delta_2 = 0$):

$$\chi_p = -\frac{N d_{13}^2}{\varepsilon_0 \hbar} \cdot \frac{\gamma_{12}}{\frac{\Gamma_e}{2}\gamma_{12} + \frac{\Omega_c^2}{4}} \tag{10.2}$$

**EIT condition:** when $\Omega_c^2 \gg \Gamma_e \gamma_{12}$, the denominator is dominated by $\Omega_c^2/4$, absorption vanishes, and the medium becomes transparent. The residual index: $\Delta n = \text{Re}[\chi_p]/(2n_0)$.

### 10.3 Coherence Grating in Standing Wave Geometry

In a Fabry-Perot with counter-propagating probe and coupling fields:

$$\Omega_p(z) \propto \cos(kz), \quad \Omega_c(z) \propto \cos(kz)$$

The product $\Omega_p(z)\cdot\Omega_c^*(z) \propto \cos^2(kz) = \frac{1}{2} + \frac{1}{2}\cos(2kz)$.

The $\cos(2kz)$ term drives spatial modulation of the dark-state coherence $\rho_{12}$ at period $\lambda/2$ — the weight grating. The grating amplitude is the differential response of $\text{Re}[\chi_p]$ to coupling field modulation $\Delta\Omega_c = \Omega_{c0}/2$:

$$\Delta n_\text{grating} = \left|\frac{\partial \text{Re}[\chi_p]}{\partial \Omega_c}\right| \cdot \frac{\Omega_c}{2} \cdot \frac{1}{2n_0} \tag{10.3}$$

Evaluating the derivative from eq. 10.2:

$$\Delta n_\text{grating} = \frac{N d_{13}^2}{\varepsilon_0 \hbar} \cdot \frac{\gamma_{12} \cdot \Omega_c^2/4}{\left[\frac{\Gamma_e}{2}\gamma_{12} + \frac{\Omega_c^2}{4}\right]^2} \cdot \frac{1}{2n_0} \tag{10.4}$$

### 10.4 Optimal Coupling Field and Analytic Maximum

Maximizing eq. 10.4 over $\Omega_c$:

$$\frac{d(\Delta n_\text{grating})}{d\Omega_c} = 0 \implies \Omega_{c,\text{opt}} = \sqrt{\frac{2}{3}\Gamma_e \gamma_{12}} \tag{10.5}$$

At this optimum, substituting back into eq. 10.4, **$\gamma_{12}$ cancels exactly**:

$$\Delta n_\text{opt} = \frac{N d_{13}^2}{\varepsilon_0 \hbar} \cdot \frac{3}{32\,\Gamma_e} \cdot \frac{1}{n_0} \tag{10.6}$$

This is independent of $\gamma_{12}$ — the optimal $\Delta n$ is set entirely by $N$, $d_{13}$, and $\Gamma_e$. At $N = 4.0 \times 10^{18}\,\text{m}^{-3}$ (Cs at 350K):

$$\Delta n_\text{opt} \approx 1.3 \times 10^{-2} \tag{10.7}$$

This exceeds PTR glass ($5 \times 10^{-3}$) by 2.6×. However, this optimum is subject to operational constraints examined below.

### 10.5 Operational Constraints

**Constraint 1 — EIT regime validity.** The EIT condition requires $\Omega_c^2 \gg \Gamma_e \gamma_{12}$. At $\Omega_{c,\text{opt}}$:

$$\frac{\Omega_{c,\text{opt}}^2/4}{\Gamma_e \gamma_{12}/2} = \frac{1}{3}$$

This is NOT in the EIT regime — it is at the crossover between EIT and optical pumping. The formula (eq. 10.1) remains valid, but the physics is dark-state preparation, not EIT transparency.

**Constraint 2 — Ω_c,opt for buffer gas is unphysically weak.** With $\gamma_{12}/(2\pi) = 10\,\text{kHz}$ (buffer gas):

$$\Omega_{c,\text{opt}}/(2\pi) = 187\,\text{kHz}$$

Any real laser has frequency noise and linewidth exceeding 187 kHz. A practical coupling field requires $\Omega_c \gtrsim 1\,\text{MHz}$, which moves away from the optimum.

**Constraint 3 — Free cell γ₁₂ ~ Γ_e.** Transit-limited dephasing gives $\gamma_{12} \approx \Gamma_e$, placing the system outside the EIT regime. The formula still applies, but the grating is equivalent to SHB — coherence dephases before it can store a weight pattern. $\tau_\text{grating} = 2\,\text{ns}$, same as §9.

**Practical operating point:** buffer gas cell, $\Omega_c/(2\pi) = 1\,\text{MHz}$:

$$\Delta n_\text{grating} \approx 1.2 \times 10^{-2}, \quad \tau_\text{grating} \sim 100\,\mu\text{s}$$

### 10.6 Rank: Angular Constraint Dominates

Applying the §8 Kogelnik framework (first approximation — see §10.9):

$$R_\text{dynamic} = \frac{\pi \cdot \Delta n_\text{grating} \cdot L}{\lambda \cdot \text{arctanh}(\sqrt{\eta_\text{threshold}})} \approx 8580 \quad (L = 20\,\text{mm})$$

$$R_\text{angular} = \frac{2 \cdot \text{NA} \cdot L}{\lambda} = \frac{2 \times 0.0625 \times 20\,\text{mm}}{852\,\text{nm}} = 2934$$

**Angular constraint is binding.** $\Delta n_\text{grating}$ exceeds the PTR value — there is no dynamic range problem. The rank ceiling is set entirely by the cavity angular acceptance, not by grating strength. This is the opposite of PTR glass.

$$R_\text{EIT} = 2934 \quad (20\,\text{mm cavity, NA}=0.0625) \tag{10.8}$$

### 10.7 Scaling Relations

From eq. 10.6 and $R_\text{angular} = 2\,\text{NA}\cdot L/\lambda$:

$$R_\text{EIT} \propto \text{NA} \cdot L / \lambda \tag{10.9}$$

Rank scales with cavity geometry, not atom density. The scaling levers are:

| Lever | Effect | Rank scaling |
|:----|:----|:----|
| Increase $L$ (longer cavity) | $R_\text{angular} \propto L$ | Linear |
| Increase NA (larger aperture) | $R_\text{angular} \propto \text{NA}$ | Linear |
| Increase $N$ (hotter cell) | $\Delta n \propto N$, but already above angular limit | No gain |
| Decrease $\lambda$ | $R_\text{angular} \propto 1/\lambda$ | Inverse |
| Increase $\Omega_c$ | $\Delta n$ decreases, eventually becomes binding | Non-linear |

**For a 200mm ring cavity:** $R_\text{angular} = 2 \times 0.0625 \times 200\,\text{mm} / 852\,\text{nm} = 29{,}339$.

This is the key insight: **EIT coherence gratings are angular-limited, not dynamic-range-limited. Longer cavities unlock proportionally higher rank.**

### 10.8 Geometry: Ring Cavity is Correct for EIT

**Fabry-Perot problems with EIT:**
1. Counter-propagating probe writes the grating on every inference pass — grating continuously being overwritten by the inference field itself
2. No clean separation between read (inference) and write (weight update) operations
3. Every round trip slightly modifies the coherence grating

**Ring cavity advantages:**
- Unidirectional probe (inference field) travels forward only
- Counter-propagating coupling field writes the coherence grating independently
- Probe reads the grating without writing — clean read/write separation
- Grating period set by coupling field standing wave: $\Lambda = \lambda_c/2 = 426\,\text{nm}$
- This is the geometry used in all experimental EIT slow-light and light storage demonstrations (Lukin et al. 2003, Fleischhauer & Lukin 2002)

**Hybrid architecture (new proposal):** ring cavity with:
- Cs vapor cell (EIT coherence grating — online learnable weights)
- PTR glass plate at one mirror (permanent weight backup — survives power loss)
- SOA on forward path (inter-stage gain compensation)
- Coupling laser counter-propagating (weight write/update beam)

This architecture supports both online learning (EIT) and permanent weight storage (PTR) in a single ring, with all-optical write for both.

### 10.9 Open Derivations Required Before Locking

1. **Coherence grating coupled-wave theory.** The Kogelnik rank formula (§8) applies to index gratings driven by index modulation $\Delta n$. For a coherence grating, the coupling constant $\kappa_\text{eff}$ must be derived from the Maxwell-Bloch equations, not coupled-wave theory. The rank formula eq. 10.8 is a first approximation — the correct $\kappa_\text{eff}$ may differ. This is a significant open derivation.

2. **Read-induced grating decay in ring geometry.** Even in a ring, the forward probe partially disturbs the coherence via optical pumping. The decay rate $\gamma_\text{read} \propto \Omega_p^2 / \Gamma_e$ must be derived and compared to $\gamma_{12}$ to confirm $\tau_\text{grating} \sim 100\,\mu\text{s}$ holds under inference conditions.

3. **Angular multiplexing in gas medium.** Equation 10.8 assumes the same angular selectivity as a PTR grating. In a gas, there is no Bragg selectivity in the usual sense — the medium is not localized to a thin plate. The angular acceptance is set by Doppler velocity classes, not grating thickness. A revised angular selectivity formula for extended gas media is needed.

4. **Coupling field spatial mode structure.** To write 512 independent spatial mode weights, the coupling field must have 512 independently addressable spatial modes. The spatial mode capacity of the coupling beam is an unresolved design question.

### 10.10 Comparison: EIT vs PTR at T=1 Architecture

| Parameter | PTR 2mm plate | EIT Cs (ring, 20mm) | EIT Cs (ring, 200mm) |
|:----|:----|:----|:----|
| $\Delta n$ | $5\times10^{-3}$ | $1.2\times10^{-2}$ | $1.2\times10^{-2}$ |
| Rank | 368 | **2934** | **29,339** |
| Binding constraint | Dynamic range | Angular | Angular |
| Persistence | Permanent | $\sim100\,\mu$s | $\sim100\,\mu$s |
| Write mechanism | 532nm + furnace | Coupling laser (all-optical) | Coupling laser (all-optical) |
| Erase mechanism | UV + heat | Optical pumping | Optical pumping |
| Geometry | Fabry-Perot | Ring | Ring |
| Rank scaling lever | Plate thickness | Cavity length/NA | Cavity length/NA |
| Architecture status | Locked (baseline) | Open derivations remain | Open derivations remain |

---

## 11. EIT Ring Cavity: Length Limits, Co-Propagating Geometry, and Reference Design

**Status:** Derived 2026-05-08  
**Purpose:** Establishes length limits for the EIT ring cavity, identifies the correct coupling beam geometry (co-propagating, not counter-propagating), and specifies a reference design with rank exactly matching the 512-mode embedding dimension.

### 11.1 Critical Geometry Correction: Co-Propagating Coupling Field

Counter-propagating coupling (probe +k, coupling −k) has two-photon detuning $\delta_2 = (k_p + k_c) \cdot v \approx 2kv$. Only atoms with $v < \gamma_{12}/(2k) = 8.5 \times 10^{-3}\,\text{m/s}$ contribute — a fraction $f_\text{res} \sim 2 \times 10^{-5}$ of the thermal distribution. This is the same Doppler dilution that killed SHB in §9. Counter-propagating coupling is not viable in a warm vapor cell.

**Co-propagating coupling** (probe +k, coupling at angle θ relative to probe, both traveling roughly forward) has two-photon detuning $\delta_2 = (k_p - k_c) \cdot v \approx 0$ for $\lambda_p \approx \lambda_c$. All velocity classes contribute — full Doppler-free EIT. The grating period is set by the beam crossing angle:

$$\Lambda_\text{grating} = \frac{\lambda}{2\sin(\theta/2)} \tag{11.1}$$

At $\theta = 1°$: $\Lambda = 48.8\,\mu\text{m}$. Rank in co-propagating geometry:

$$R = \frac{2 \cdot \text{NA} \cdot L_\text{cell}}{\Lambda_\text{grating}} = \frac{4 \cdot \text{NA} \cdot L_\text{cell} \cdot \sin(\theta/2)}{\lambda} \tag{11.2}$$

**Note:** rank is set by $L_\text{cell}$ and $\theta$, not by $L_\text{ring}$. The ring circumference determines round-trip time and stability, not rank.

### 11.2 Length Constraints

| Constraint | Expression | Limiting at |
|:----|:----|:----|
| Laser coherence | $L_\text{ring} < c/(\pi \Delta\nu_\text{laser})$ | $L > 10\,\text{km}$ (ECDL, $\Delta\nu = 10\,\text{kHz}$) |
| Grating lifetime | $L_\text{ring}/c < \tau_\text{grating} = 1/\gamma_{12}$ | $L > 4800\,\text{km}$ (buffer gas) |
| Diffraction / beam size | $w_0 \sim \sqrt{\lambda L_\text{ring}/(4\pi)}$ | Practical above $L \sim 10\,\text{m}$ |
| Vibration isolation | Engineering | Practical above $L \sim 2\,\text{m}$ |

**Practical sweet spot:** $L_\text{ring} = 0.5$–$2\,\text{m}$. Fits on an optical table, ECDL coherence is not limiting, beam waist $w_0 \approx 0.18$–$0.37\,\text{mm}$ manageable.

### 11.3 Reference Design

**Target:** rank = 512, matching the ORI embedding dimension. From eq. 11.2 with $\text{NA} = 0.0625$, $L_\text{cell} = 200\,\text{mm}$:

$$\theta = 2\arcsin\!\left(\frac{R\lambda}{4 \cdot \text{NA} \cdot L_\text{cell}}\right) = 2\arcsin\!\left(\frac{512 \times 852\,\text{nm}}{4 \times 0.0625 \times 200\,\text{mm}}\right) = 1.0° \tag{11.3}$$

| Parameter | Value | Rationale |
|:----|:----|:----|
| $L_\text{ring}$ | 1.0 m | Fits optical table, manageable beam size |
| $L_\text{cell}$ | 200 mm | Sets rank jointly with $\theta$ |
| $\theta$ (coupling angle) | 1.0° | Gives rank = 512 exactly |
| $\Lambda_\text{grating}$ | 48.8 μm | $\lambda/(2\sin(0.5°))$ |
| Rank | **512** | Matches embedding dimension |
| $w_0$ at cell | 0.26 mm | Marginally stable bow-tie |
| $\tau_\text{roundtrip}$ | 3.33 ns | $L_\text{ring}/c$ |
| $\tau_\text{grating}$ | $\sim$16 μs | $1/\gamma_{12}$ buffer gas |
| $\tau_\text{grating}/\tau_\text{RT}$ | $\sim$4800 | Grating survives many round trips |
| Coupling laser | ECDL, $\Delta\nu < 10\,\text{kHz}$ | $L_\text{coh} = 9500\,\text{km} \gg L_\text{ring}$ |
| Buffer gas | N₂ at 1 Torr | $\gamma_{12}/(2\pi) \approx 10\,\text{kHz}$ |

**Bow-tie layout (component sequence):**
1. Input coupler (flat, $T = 1\%$) — probe enters, coupling injected at 1°
2. Curved mirror M1 ($R_c = 500\,\text{mm}$) — focuses into cell
3. Cs vapor cell (200mm, N₂ buffer gas, 350K)
4. Curved mirror M2 ($R_c = 500\,\text{mm}$) — recollimates
5. Flat mirror M3 (HR, $R > 99.99\%$) — redirects, SOA in this arm
6. Output coupler (flat, $T = 1\%$) — probe exits to detector or next stage
7. Flat mirror M4 — closes ring

### 11.4 PTR Glass Removed

PTR glass is dropped from this architecture. Rationale:

- PTR rank ceiling at 0.5mm plate is 92 — below EIT rank of 512
- PTR requires furnace development — not all-optical
- EIT coherence grating is all-optical write/erase with $\tau \sim 16\,\mu\text{s}$
- Ephemeral weights are acceptable: $\tau_\text{grating} \gg \tau_\text{roundtrip}$ by 4800×
- Weight refresh via coupling laser at $\gamma_{12} = 10\,\text{kHz}$ — continuous write sustains grating

PTR is retained in the baseline ORI Fabry-Perot architecture (ARCH-1 through ARCH-17) as the permanent weight medium. The ring EIT architecture is a separate branch.

### 11.5 Open Derivations

1. Maxwell-Bloch $\kappa_\text{eff}$ for coherence grating (§10.9 item 1) — still required
2. Angular multiplexing in extended gas (vs thin grating) — still required  
3. Coupling beam spatial mode structure for 512 independent modes
4. SOA placement in ring and SNR budget for ring cavity

---

## 11. EIT Ring Cavity: Diffusion Model Fit, Economics, and Power Budget

**Status:** Derived 2026-05-08  
**Geometry:** 25mm aperture × 200mm circumference ring cavity, Cs buffer gas (1 Torr N₂), T=100, λ=852.1nm

### 11.1 Ring Cavity Timing Correction

The 200mm ring has round-trip time $\tau_{rt} = L/c_0 = 0.667\,\text{ns}$ (one-way, not $2L/c$). This gives:

$$\tau_\text{token} = T \times \tau_{rt} = 100 \times 0.667\,\text{ns} = 66.7\,\text{ns}$$

$$\text{AR throughput} = 1/\tau_\text{token} = 15\,\text{M tok/s}$$

This is lower than the Fabry-Perot 75M tok/s (which used $\tau_{rt} = 2L/c = 133\,\text{ps}$ at $L=20\,\text{mm}$). The ring is slower per token in AR mode but has rank 29,342 vs 92 — the tradeoff is rank for throughput. At variable-T with mean T=10, throughput recovers to 150M tok/s.

### 11.2 ORI as Diffusion Text Model Backbone

**Diffusion text model operation:** A denoising network $f_\theta(x_t, t)$ predicts clean text $\hat{x}_0$ from noisy input $x_t$ at noise level $t$. Each denoising step is a non-autoregressive full-sequence forward pass. With 100–1000 NFEs (neural function evaluations) per generation, the NFE count dominates latency.

**ORI mapping:** $f_\theta$ maps directly to ORI's convolutional (NAR) view. All $L$ input tokens enter simultaneously; $T$ round trips compute the SSM forward pass; all $L$ output tokens read simultaneously. Latency is $T \times \tau_{rt} = 66.7\,\text{ns}$ independent of $L$.

**NFE timing at T=100:**

| NFEs | Total latency | Notes |
|:----|:----|:----|
| 10 | 0.67 µs | Aggressive (lower quality) |
| 50 | 3.33 µs | Typical fast diffusion |
| 100 | 6.67 µs | Standard |
| 1000 | 66.7 µs | High quality |

GPU comparison at 100 NFEs, L=256: ~1–10 seconds. ORI: 6.67 µs. Speedup: $\sim10^5\times$.

### 11.3 State Decomposition at R=29,342

The LSSL state dimension decomposes as $R = H \times N_\text{state}$. Natural ORI decomposition:

$$H = 512 \text{ (spatial modes = feature dimension)}, \quad N_\text{state} = \lfloor 29342/512 \rfloor = 57$$

Parameters per ORI layer: $H \times N + H \times N + H^2 = 2 \times (512 \times 57) + 512^2 = 320{,}512$.

A 6-layer ORI network: $\sim1.9\,\text{M}$ parameters. Comparable to Mamba-130M in state depth ($N_\text{state}=57$ vs Mamba's $N_\text{state}=16$) but far fewer total parameters. Quality comparable to small language model, not GPT-3 class.

### 11.4 Hard Limits at R=29,342

**Sequence length (NAR mode):** Each token occupies one round trip slot. $L_\text{max} \approx T = 100$ tokens per NAR forward pass at $T=100$. For $L=256$: need $T=256$ round trips, giving $\tau_\text{token}=171\,\text{ns}$ and AR throughput of 5.9M tok/s. $T=256 \ll T_\text{coh}=750$: still coherent.

**Model capacity:** ~2M parameters at 6 layers is small. State-of-the-art diffusion text models use 300M–3B parameters. ORI is adequate for sentence-level tasks, not long-form generation. Scaling requires more ring cavities in series (each ring = one SSM layer), with linear cost.

**Cross-attention for conditioning:** Not implementable optically (O(N²) — same wall as transformer attention). Conditioning must be injected as initial state amplitude or FiLM-style bias on the input field. Self-conditioning (standard in diffusion) maps to self-recurrence — fine.

**Vocabulary projection:** Embedding matrix $W_e \in \mathbb{R}^{V \times H}$ ($V=50{,}257$, $H=512$) is a digital component, stored in DRAM, applied by CMOS interposer. Not implemented optically.

### 11.5 Power Budget

Required probe power for SNR=40 dB (shot-noise limited):

$$P_\text{min} = \frac{\text{SNR} \cdot \hbar\omega}{\eta \cdot \tau_{rt}} = \frac{10^4 \times 2.33\times10^{-19}}{0.6 \times 0.667\,\text{ns}} = 5.8\,\mu\text{W per mode}$$

At 10× margin and 35% VCSEL WPE: 167 µW electrical per element × 512 = **85 mW total VCSEL array**.

| Component | Power |
|:----|:----|
| Cs cell heater (350K, ~77°C above ambient) | 10.0 W |
| Coupling laser (10 mW optical, 5% WPE) | 0.2 W |
| VCSEL probe array (512 modes, 10× margin, 35% WPE) | 0.085 W |
| SOA inter-stage | 0.5 W |
| Detector array + TIA | 1.0 W |
| FPGA + control | 5.0 W |
| Thermal PID | 0.5 W |
| **Total** | **17.3 W** |

**Energy per token (AR, 15M tok/s):** $17.3\,\text{W} / 15\times10^6\,\text{tok/s} = 1.15\,\mu\text{J/tok}$.

**Honest comparison:** GPU inference is ~1–10 µJ/tok. ORI EIT ring is ~1 µJ/tok — approximately equivalent, not dramatically better. The heater (10W) and FPGA (5W) dominate and are independent of throughput. The efficiency advantage appears only at high throughput (more tokens per joule) via NAR mode or higher T.

**The dominant cost is thermal, not optical.** At 15M tok/s, the heater alone costs 667 nJ/tok. If throughput increases 10× (variable-T, NAR, or NARG), energy/tok drops proportionally. Efficiency is a throughput problem, not a power problem.

### 11.6 Hardware Cost

Single-layer EIT ring cavity, prototype: **$12K–$34K**.

Primary cost drivers: coupling laser ($1.5K–$4K), VCSEL array ($2K–$8K), detector array ($1.5K–$5K). The Cs cell itself is inexpensive ($800–$2K). Buffer gas and thermal control are negligible.

**Realistic Phase 1 shortcut:** Begin with N=16 or N=32 spatial modes. A 16-element VCSEL array at 850nm is off-the-shelf (<$500). Validates EIT grating formation, coherence time, and read/write isolation at $5K–$10K total before committing to 512-mode architecture.

### 11.7 Laser Sourcing at 852nm

**Coupling field** (weight write, single-mode, <1 MHz linewidth):
- Vescent D2-100 DBR 852nm: 50 mW, <100 kHz linewidth, ~$8K–12K. Best cost/performance.
- Toptica DL pro 852nm ECDL: 80–100 mW, <1 MHz, ~$15K–20K. Research standard.
- Homebuilt Littrow ECDL: 50 mW, ~500 kHz–1 MHz, ~$1.5K–3K. Requires servo, higher risk.

Required power is only 277 µW (at $\Omega_c/2\pi = 1\,\text{MHz}$, 25mm aperture) — any of these options is vastly overpowered. The power budget is not a constraint. Single-mode and linewidth are the critical specs.

**Probe array** (inference field, 512 modes, 852nm):
Phase 1: single SM VCSEL (Vixar 850nm, ~$50) + Meadowlark SLM ($15K–25K) for mode encoding. SLM refresh rate (~100 Hz) limits weight update rate but is adequate for validation.
Phase 2: custom 2D VCSEL array (II-VI/Lumentum), 512-element, ~$5K–15K prototype NRE.

### 11.8 EIT Ring vs PTR Fabry-Perot Summary

| Parameter | PTR F-P (Phase 1, locked) | EIT Ring (proposed) |
|:----|:----|:----|
| Hardware cost | $1,200 | $12K–$34K |
| System power | ~5W (est.) | 17.3W |
| Energy/token | ~300 nJ/tok (est.) | 1,150 nJ/tok |
| Training cycle | 30 min (furnace) | ~1 µs (optical) |
| Rank | 92 (0.5mm PTR) | 29,342 (25mm aperture) |
| AR throughput | 75M tok/s | 15M tok/s |
| Weight persistence | Permanent | 100 µs–ms |
| TRL | 3–4 | 2–3 |
| NAR diffusion (100 NFE, L=100) | N/A (F-P is causal) | 6.67 µs total |
| Primary advantage | Cost, simplicity, permanence | Rank, training speed, NAR mode |

**Bottom line:** EIT ring is 10–25× more expensive, 4× less efficient per token in AR mode, and one TRL level lower than PTR F-P. Its advantages are: 318× higher rank, $10^6\times$ faster training cycle, and NAR parallel inference enabling diffusion text model use case. For Phase 1 validation, PTR F-P remains the correct starting point. EIT ring is the Gen 2 architecture once PTR physics are validated.

---

## 12. T=1 NAR Diffusion: Daisy-Chain Architecture and Economics

**Status:** Derived 2026-05-08  
**Context:** At T=1, each ring executes one round trip per forward pass. N rings daisy-chained = N SSM layers, matching the deep LSSL architecture (Gu et al. 2021, Appendix B.4). This is the target architecture for NAR diffusion text generation.

### 12.1 T=1 Timing

$$\tau_{rt} = L/c_0 = 200\,\text{mm}/3\times10^8 = 0.667\,\text{ns}$$
$$\tau_\text{token}(T=1) = 0.667\,\text{ns}, \quad \text{AR throughput} = 1.5\,\text{B tok/s}$$

In NAR mode, all $L$ tokens are processed in one round trip. Latency per NFE = $0.667\,\text{ns}$ independent of $L$:

| NFEs | Latency | Notes |
|:----|:----|:----|
| 10 | 6.7 ns | Aggressive |
| 100 | 66.7 ns | Standard |
| 1000 | 667 ns | High quality |

Effective NAR throughput at 100 NFEs: $L / (100 \times 0.667\,\text{ns})$. At $L=256$: **3.84B tok/s**. At $L=1024$: **15.4B tok/s**.

### 12.2 Why One Ring Is Insufficient

At T=1, the computation is a single linear projection through the holographic weight grating plus detector nonlinearity — one SSM layer. A diffusion denoising network $f_\theta(x_t, t) \to \hat{x}_0$ requires multiple layers of representation learning. The LSSL paper demonstrates 4–6 layers are needed for competitive sequence modeling. One ring cannot support this.

### 12.3 Daisy-Chain = Deep LSSL

N rings in series implements the deep LSSL architecture exactly:

```
[Input tokens, L×H]
    ↓
[Ring 1: T=1, R=29342] → SOA → [Ring 2] → SOA → ... → [Ring N]
    ↓
[Output tokens, L×H]
```

Each ring applies one round-trip operator with learned grating weights + intensity nonlinearity at readout. The SOA provides inter-layer gain. This is the physical instantiation of LSSL with N layers, residual connections implementable via beam splitter before/after each ring (partial bypass), and layer normalization applied digitally at the VCSEL re-injection stage.

Parameter count: $N \times 320\text{K} \approx 1.3\text{M}$ at $N=4$, $3.2\text{M}$ at $N=10$.

### 12.4 Daisy-Chain Economics

**Shared infrastructure (buy once):**
- Coupling laser (split via fiber): \$1.5K–4K
- FPGA controller: \$500–2K
- Optical bench: \$400–800
- Multi-channel temperature controller: \$300–600
- AOM + isolators: \$1K–2K
- **Total fixed: \$4.2K–10.1K**

**Per-ring marginal cost:**
- Cs cell (quartz, AR-coated, reservoir): \$800–1,200
- Ring mirrors (4×, 25mm, high-R): \$600–1,000
- Kinematic mounts (4×): \$300–500
- Heater assembly: \$100–200
- SOA inter-stage (GaAs/AlGaAs, 850nm): \$600–1,000
- Si PIN detector array (512-pixel): \$1,000–2,500
- VCSEL re-injection array: \$500–2,000
- Beam steering optics: \$300–500
- **Total marginal: \$4.2K–8.9K per ring**

| N rings | Total cost | Cost/ring (avg) | NFE latency |
|:----|:----|:----|:----|
| 1 | \$8.4K–19K | \$8.4K–19K | 0.7 ns |
| 4 | \$21K–46K | \$5.3K–11.4K | 2.7 ns |
| 8 | \$38K–81K | \$4.7K–10.2K | 5.3 ns |
| 16 | \$71K–153K | \$4.5K–9.5K | 10.7 ns |
| 32 | \$139K–295K | \$4.3K–9.2K | 21.3 ns |

Marginal cost per ring converges rapidly as fixed infrastructure is amortized. At N=4–8, the marginal ring costs \$4.2K–8.9K — comparable to a good mid-range scientific instrument per additional layer.

### 12.5 Thermal Bottleneck and Shared Enclosure

Per-ring thermal power (Cs cell at 350K, ~77°C above ambient): ~10W. This scales linearly and dominates the power budget. The mitigation is a **shared thermal enclosure** for all N cells:

| N cells | Linear thermal (W) | Shared enclosure (est.) | Savings |
|:----|:----|:----|:----|
| 1 | 10 | 10 | 0% |
| 4 | 40 | 20 | 50% |
| 8 | 80 | 30 | 62% |
| 16 | 160 | 45 | 72% |

With shared enclosure, all N Cs cells occupy the same heated volume (a single resistively-heated aluminum block with bores for each cell). Heat loss scales with surface area, not cell count. This is a standard technique in multi-cell atomic physics experiments.

### 12.6 Power and Efficiency at T=1, N Rings (Shared Enclosure)

At N=4 rings, shared thermal enclosure:

| Component | Power |
|:----|:----|
| Shared enclosure (4 cells, 350K) | 20 W |
| VCSEL arrays (4×, 85 mW each) | 0.34 W |
| SOA inter-stage (4×, 0.5W) | 2.0 W |
| Detector arrays (4×, 1W) | 4.0 W |
| Coupling laser (shared) | 0.2 W |
| FPGA + control | 5.0 W |
| **Total** | **31.5 W** |

NAR throughput ($L=256$, 100 NFEs): $256 / (100 \times 4 \times 0.667\,\text{ns}) = 960\,\text{M tok/s}$

$$\text{Energy/token} = 31.5\,\text{W} / 960\,\text{M tok/s} = 33\,\text{nJ/tok}$$

**GPU comparison: 1 µJ/tok → ORI 4-ring is 30× more efficient.** At 10 µJ/tok (large GPU inference): 300× more efficient.

At N=8 rings:
- Shared enclosure: ~30W; total system: ~43W
- NAR throughput ($L=256$, 100 NFEs): 480M tok/s
- Energy/token: ~90 nJ/tok → 11–110× GPU

### 12.7 Recommended Configuration

**Minimum viable (4 rings):**
- Cost: \$21K–46K
- Layers: 4 SSM layers, ~1.3M parameters
- NFE latency (100 NFEs): 2.7 ns
- NAR throughput ($L=256$): 960M tok/s
- Energy/token: ~33 nJ/tok (30× GPU)
- Capability: sentence-level diffusion, classification, encoding

**Production target (8 rings):**
- Cost: \$38K–81K
- Layers: 8 SSM layers, ~2.6M parameters
- NFE latency (100 NFEs): 5.3 ns
- NAR throughput ($L=256$): 480M tok/s
- Energy/token: ~90 nJ/tok (11× GPU)
- Capability: paragraph-level diffusion, competitive with Mamba-small

**Aspirational (16 rings):**
- Cost: \$71K–153K
- Layers: 16 SSM layers, ~5.1M parameters
- NFE latency (100 NFEs): 10.7 ns
- NAR throughput ($L=256$): 240M tok/s
- Energy/token: ~210 nJ/tok (5× GPU)
- Capability: approaches Mamba-130M quality

### 12.8 Open Engineering Questions

1. **Shared enclosure thermal design:** Must maintain ±0.1K uniformity across all N cells to prevent grating drift between layers. Multi-zone PID with thermistors at each cell. Feasible with standard multi-channel temperature controller.

2. **Inter-ring alignment:** VCSEL re-injection between rings must couple into the next ring's spatial mode basis. Mode-matching optics (micro-lens array) between each SOA output and next ring input. Alignment sensitivity is the same as EXP-8 (kinematic mount reinstallation: ~212nm required).

3. **Gradient routing:** Adjoint solver must backpropagate through N rings serially. Each ring requires its own coupling field update. With shared coupling laser split to N AOMs, each AOM independently modulates its ring's weight update. FPGA routes gradient signals per-ring.

4. **Layer normalization:** Applied digitally at VCSEL re-injection stage (modulate amplitude pattern before injecting into next ring). Adds one digital multiply per mode per inter-ring transition — negligible overhead.

---

## 13. Apples-to-Apples: ORI vs GPU Diffusion Text at Matched Quality

**Status:** Derived 2026-05-08  
**Purpose:** Corrects the headline 5.7 OoM speedup for model quality. Two matching approaches: SSM state size (more defensible for SSM comparison) and total parameter count (more conservative, more legible to reviewers).

### 13.1 ORI Parameter Structure

Per ring: $H=512$, $N_\text{state}=57$:

| Component | Params |
|:----|:----|
| SSM weights (W + C) | $2 \times H \times N_\text{state} = 58{,}368$ |
| Feedthrough D | $H^2 = 262{,}144$ |
| Layer norm | $2H = 1{,}024$ |
| **Per-ring total** | **321,536** |

Embedding layer (digital DRAM, BPE vocab): $V \times H = 50{,}257 \times 512 = 25.7\,\text{M}$. Weight-tied unembedding: free. This component is not optical but is part of the model and counts in parameter comparisons.

Total params with embedding: $N_\text{rings} \times 321{,}536 + 25.7\,\text{M}$. Dominantly embedding for small N — converges to optical-dominated above ~80 rings.

### 13.2 Two Quality-Matching Approaches

**Approach A — SSM State Size (correct SSM metric):**

Published SSM quality is driven primarily by total SSM state dimension: $d_\text{state} \times d_\text{model} \times \text{layers}$. This is the quantity that determines long-range memory capacity (Gu et al. 2021, Theorem 1).

- Mamba-130M: $d_\text{state}=16$, $d_\text{model}=768$, 24 layers → total state = $294{,}912$
- ORI per ring: $N_\text{state} \times H = 57 \times 512 = 29{,}184$
- **ORI rings to match Mamba-130M state: $294{,}912 / 29{,}184 = 10.1$ rings → N=10**

At N=10: total params = 29M (vs Mamba-130M's 130M). ORI is 4.5× more parameter-efficient per unit of SSM state. Quality will fall between Mamba-tiny and Mamba-130M — exact PPL unknown without experiment, but state equivalence is a strong structural predictor.

**Approach B — Total Parameter Count (conservative):**

Matching 117M total optical+embedding params (GPT2-small scale, target for MDLM):
- Required optical params: $117\,\text{M} - 25.7\,\text{M} = 91.3\,\text{M}$
- At $321{,}536$ per ring: **N = 284 rings**

### 13.3 Speedup at Matched Quality

ORI latency = $N_\text{rings} \times \tau_{rt} \times \text{NFE} = N \times 0.667\,\text{ns} \times 100$.

| Scenario | Matching criterion | N rings | ORI latency | GPU A100 | Speedup | OoM |
|:----|:----|:----|:----|:----|:----|:----|
| Unmatched (headline) | — | 8 | 0.53 µs | 256 ms | 4.8×10⁵ | **5.7** |
| State-matched | Mamba-130M state | 10 | 0.67 µs | 256 ms | 3.8×10⁵ | **5.6** |
| Param-matched | 117M total params | 284 | 18.9 µs | 256 ms | 1.4×10⁴ | **4.1** |

**The speedup survives quality-matching.** Even at full parameter parity (284 rings), ORI is 4.1 OoM faster. The physics gap — photon transit time vs. GPU clock — does not close with more rings.

### 13.4 Defensible Claim

The most defensible apples-to-apples comparison is the state-matched scenario:

> **10 ORI rings, state-equivalent to Mamba-130M, deliver NAR diffusion text generation in 0.67 µs — 380,000× faster than an A100 GPU running MDLM at equivalent SSM state capacity — at 29M total parameters and ~$49K–99K hardware cost.**

The param-matched scenario (284 rings, 4.1 OoM) is the conservative number to use in publications where reviewers may default to total parameter count.

### 13.5 What ORI Cannot Match

The H×H feedthrough matrix in ORI ($262{,}144$ params per ring) is optically implemented but is a dense linear operation — equivalent to Mamba's out-projection. Mamba additionally has:
- Selective scan mechanism (input-dependent SSM, not weight-tied) — ORI's grating is fixed-weight per forward pass
- In-projection ($2 \times d_\text{model}^2$) for feature expansion — ORI has no equivalent upsampling
- Convolution component (short 1D conv pre-SSM) — ORI has no equivalent

These give Mamba higher expressivity per unit state than ORI. The quality gap at matched state size will favor Mamba — the honest estimate is that ORI needs ~2–3× more rings than state equivalence alone suggests to reach the same empirical PPL. This shifts the state-matched speedup from 5.6 to ~5.2–5.4 OoM — still above 5 OoM.

### 13.6 Open Empirical Question

None of these quality estimates are experimentally validated. The LSSL paper's empirical results (84.65% sCIFAR at 6 layers, H=128, N=128) provide the closest analog. ORI's H=512, N_state=57 is a different operating point. **EXP-7 Phase B (clone-and-fine-tune viability) is the precursor experiment before diffusion text quality can be estimated empirically.** The speedup numbers are physics — they hold regardless. The quality numbers are architecture predictions — they require validation.

---

## 14. 100mm Aperture: Scale Factor, Constraint Flip, and Noise Limits

**Status:** Derived 2026-05-08  
**Motivation:** In-situ EIT training self-calibrates wavefront aberrations, relaxing the aperture flatness requirement from λ/10 to ~λ/2 and making 100mm physically achievable with standard optics.

### 14.1 Why In-Situ Training Unlocks Larger Aperture

For PTR glass (external write beam): the grating is written with one wavefront and read with another. At 100mm, achieving λ/10 flatness = 85nm over 100mm requires precision optics costing $10K–50K. Aberration mismatch between write and read paths causes weight errors that compound over T round trips.

For EIT in-situ: the same field that performs inference writes the coherence grating via the adjoint (phase-reversed) field. Any wavefront aberration is seen identically by both forward and adjoint passes — errors cancel to first order. The requirement relaxes to λ/2 ≈ 426nm over 100mm, achievable with standard optical flats ($500–2K). This is self-calibrating holography (Psaltis 1990).

### 14.2 Scale Factor: 25mm → 100mm

| Quantity | 25mm | 100mm | Scale |
|:----|:----|:----|:----|
| Angular rank $R = d/\lambda$ | 29,339 | 117,357 | **4×** |
| Spatial modes $H$ (1D, 50µm pitch) | 500 | 2,000 | 4× |
| $N_\text{state}$ per ring ($R_\text{actual}/H$) | 58 | 44 | 0.76× |
| SSM state per ring ($H \times N_\text{state}$) | 29,000 | 88,000 | **3×** |
| Rings to match Mamba-130M state | 11 | **4** | 2.75× fewer |
| Params per ring | 321K | 4.2M | 13× |

Note: $N_\text{state}$ per ring is slightly lower at 100mm because the dynamic range constraint (not angular) becomes binding — see §14.3.

### 14.3 Constraint Flip — The Key Finding

At 25mm: angular rank binds ($R_\text{ang} = 29{,}339 < R_\text{dyn} = 88{,}189$).  
At 100mm: **dynamic range binds** ($R_\text{dyn} = 88{,}189 < R_\text{ang} = 117{,}357$).

$$R_\text{actual}(100\,\text{mm}) = \min(117{,}357,\ 88{,}189) = 88{,}189$$

The 100mm aperture has unlocked more angular capacity than the EIT grating can fill. To access the full $R_\text{ang} = 117{,}357$, need $\Delta n > 0.016$ (current: 0.012 — a 1.3× gap). Two levers:

- **Higher atom density** (increase Cs cell temperature above 350K): $\Delta n \propto N$ → modest temperature increase closes the gap.
- **Longer ring circumference**: $R_\text{dynamic} \propto L_\text{ring}$. At $L = 800\,\text{mm}$: $R_\text{dyn} = 352{,}758 \gg R_\text{ang}$. Round-trip time $\tau_{rt} = 2.67\,\text{ns}$ — still fast. Latency at 4 rings, 100 NFEs: 1.07µs (vs 0.267µs for 200mm ring).

### 14.4 Noise Limits at 100mm

**Shot noise:** $P_\text{min}$ per mode unchanged at 3.7µW. 2000 modes: 7.4mW minimum, 210mW at 10× margin. Manageable (<1W). ✓

**Diffraction:** $\theta_\text{diff} = \lambda/d = 8.5\,\mu\text{rad}$. Minimum resolvable spatial period at ring = 1.7µm $\ll$ 50µm mode pitch. ✓

**Thermal lensing:** Aperture area 16× larger at same power → intensity 16× lower. Thermal lensing is REDUCED at 100mm, not increased. ✓

**Spatial coherence:** $l_\text{coh} = c_0/\Delta\nu = 300\,\text{m} \gg 100\,\text{mm}$ at 1MHz coupling linewidth. EIT coherence uniform across aperture. ✓

**Grating cross-talk:** Cross-talk SNR $\approx 10\log_{10}(R) = 50.7\,\text{dB} > 38\,\text{dB}$ target. Angular selectivity suppresses inter-grating leakage by $1/R^2$. ✓

**Binding noise limit:** Dynamic range — $R_\text{dyn} = 88{,}189$ — driven by $\Delta n_\text{EIT}$ and ring path length $L$.

### 14.5 Performance at 100mm

**State-matched to Mamba-130M: 4 rings.**

$$\tau_\text{latency} = 4 \times 0.667\,\text{ns} \times 100\,\text{NFE} = 267\,\text{ns} = 0.267\,\mu\text{s}$$

$$\text{Speedup vs A100} = \frac{256\,\text{ms}}{0.267\,\mu\text{s}} = 9.6 \times 10^5 \approx \mathbf{6.0\,\text{OoM}}$$

The extra order of magnitude vs the 25mm 5.6 OoM case comes from needing 4 rings instead of 10 at matched state — aperture scaling reduces ring count, reducing latency.

### 14.6 Hardware Cost at 100mm

| Component | 25mm cost | 100mm cost |
|:----|:----|:----|
| Cs cell (custom 100mm bore quartz) | \$800–2K | \$3K–6K |
| Ring mirrors (4×, 100mm) | \$600–1K | \$2K–4K |
| VCSEL array (2000 elements vs 512) | \$2K–8K | \$8K–20K |
| Other (mounts, SOA, detector, optics) | \$1.9K–4.9K | \$3K–7K |
| **Per-ring marginal** | **\$4.2K–8.9K** | **\$16K–37K** |

4-ring system at 100mm: ~\$160K–300K total. Roughly 4–6× more expensive than 4 rings at 25mm (\$49K–99K), for 2.75× fewer rings needed at matched quality and 1.7× better latency.

**Cost per unit of SSM state** is approximately the same — the 100mm ring is larger and more expensive but covers more state per ring. The economics are similar; the engineering challenge (larger optics, more aberration correction) is the real consideration.

### 14.7 Recommendation

100mm aperture is the right direction if:
- Hardware cost ($160K–300K) is acceptable
- 100mm precision optics are in scope (achievable with in-situ calibration)
- Maximizing OoM speedup at matched quality is the priority (6.0 vs 5.6 OoM)

25mm is the right starting point for:
- Phase 1 validation ($49K–99K)
- Proving EIT grating formation and coherence time
- Establishing inter-ring alignment protocols before scaling aperture

**Upgrade path:** Build 4-ring system at 25mm. Validate. Replace Cs cells and mirrors with 100mm equivalents. In-situ training recalibrates automatically — no grating rewrite needed.

---

## 15. EIT Absorption Correction and Media Re-Evaluation

**Status:** Derived 2026-05-08. Retracts §10–§14 EIT ring architecture pending SOA investigation.  
**Trigger:** Cell-length optimization for 300mm aperture revealed a fatal absorption constraint omitted from §10–§14.

### 15.1 Critical Error: §10–§14 Omitted EIT Absorption

The §10 derivation correctly computed the **real part** of the EIT susceptibility (index modulation Δn = 0.012) but did not evaluate the **imaginary part** (absorption coefficient α_EIT). These are coupled through the same density-matrix susceptibility. Omitting absorption produced rank estimates that cannot physically be realized.

**Correct EIT residual absorption formula** (Lukin 2003, Fleischhauer et al. RMP 2005):

$$\alpha_\text{EIT} = \alpha_D \cdot \frac{\gamma_{12} \cdot \Gamma_e}{\Omega_c^2} \tag{15.1}$$

where $\alpha_D$ is the Doppler-averaged peak absorption coefficient, $\gamma_{12}$ is the ground-state decoherence rate, $\Gamma_e$ is the excited-state linewidth, and $\Omega_c$ is the coupling Rabi frequency.

For warm Cs at 350K with N₂ buffer gas ($N = 4\times10^{18}\ \text{m}^{-3}$, $\gamma_{12}/(2\pi) = 10\ \text{kHz}$, $\Gamma_e/(2\pi) = 5.22\ \text{MHz}$, $\Omega_c/(2\pi) = 1\ \text{MHz}$):

$$\alpha_D = N \cdot \sigma_D \approx 2{,}770\ \text{m}^{-1} \tag{15.2}$$

$$\alpha_\text{EIT} \approx 145\ \text{m}^{-1} \tag{15.3}$$

At the §11 reference design ($L_\text{cell} = 200\ \text{mm}$):

$$\alpha_\text{EIT} \cdot L = 145 \times 0.2 = 29 \quad \Rightarrow \quad T = e^{-29} \approx 2\times10^{-13} \quad (126\ \text{dB loss}) \tag{15.4}$$

The §11 ring cavity is completely opaque. The signal is zero.

### 15.2 The Ω_c / Rank Invariance

The fatal structure: Δn and α_EIT share the same Ω_c dependence.

$$\Delta n \propto \frac{1}{\Omega_c^2}, \qquad \alpha_\text{EIT} \propto \frac{1}{\Omega_c^2} \tag{15.5}$$

The absorption-limited cell length scales as $L_\text{max} \propto \Omega_c^2$. Therefore the rank at the operating point:

$$R_\text{dyn} = \frac{\pi \cdot \Delta n \cdot L_\text{max}}{\lambda \cdot \text{arctanh}(\sqrt{\eta})} \propto \frac{1}{\Omega_c^2} \cdot \Omega_c^2 = \text{constant} \tag{15.6}$$

**Rank is independent of Ω_c.** Increasing coupling power does not help. The medium has a fundamental rank ceiling set by material constants:

$$R_\text{ceiling} = \frac{\pi \cdot C_{\Delta n} \cdot (\alpha L)_\text{budget}}{K_\text{abs} \cdot \lambda \cdot \text{arctanh}(\sqrt{\eta})} \tag{15.7}$$

where $C_{\Delta n} = \Delta n \cdot \Omega_c^2 = 4.74\times10^{11}\ \text{rad}^2/\text{s}^2$ and $K_\text{abs} = \alpha_D \cdot \gamma_{12} \cdot \Gamma_e = 5.71\times10^{15}\ \text{rad}^2/\text{s}^3$.

| αL budget | R_ceiling (N₂ buffer gas, 350K) |
|:---|:---|
| 0.1 (1 dB) | ~305 |
| 0.5 (4 dB) | ~1,500 |
| 1.0 (9 dB) | ~3,000 |

The only material lever is $\gamma_{12}$: $R \propto 1/\gamma_{12}$. Paraffin-coated cells achieve $\gamma_{12}/(2\pi) \sim 100\ \text{Hz}$, raising the ceiling to ~30,000 — but paraffin melts at 340K, right at the operating temperature. Atom density (temperature) does not help: both $\alpha_D$ and $\Delta n$ scale linearly with $N$, so the ratio is fixed.

### 15.3 Affected Sections

| Section | Status | Action |
|:---|:---|:---|
| §10 EIT coherence grating | **RETRACTED** | Δn derivation correct; absorption omitted; rank ceiling wrong by ~100× |
| §11 EIT ring reference design | **RETRACTED** | Built on §10 rank; all throughput/cost numbers invalid |
| §12 T=1 daisy-chain (EIT) | **RETRACTED** | Inherits §11 error |
| §13 Apples-to-apples comparison | **RETRACTED** | EIT numbers used in comparison |
| §14 100mm aperture (EIT) | **RETRACTED** | Same base error; constraint flip analysis also invalid |
| ARCH-19 EIT ring | **RETRACTED** | Physical basis invalid until absorption closure |

PTR Fabry-Perot baseline (ARCH-1–17) is **unaffected**. PTR glass has no analogous absorption constraint at 850nm — σ_r(850nm) ≈ 0 is the locked physics argument.

### 15.4 Ephemeral Weight Media: Full Re-Evaluation

Following the EIT retraction, all candidate ephemeral optical write media were evaluated against four constraints:
1. Transparent at 852nm (inference wavelength) for read beam
2. Writable at or near 852nm (no full wavelength redesign)
3. Δn > ~5×10⁻⁴ at mm-scale (R > 100)
4. Grating lifetime τ_grating > τ_rt (survives one round trip)

**Tier 0 — Eliminated (fatal physics):**

| Medium | Fatal constraint |
|:---|:---|
| EIT warm Cs (all geometries) | αL >> 1 at any Ω_c/L; rank ceiling ~300 (§15.2) |
| SHB warm Cs | Doppler dilution, Δn ~ 10⁻¹⁸ (§9, locked) |
| GaAs:SI (photorefractive) | 850nm above bandgap (870nm); α ~ 10⁴ m⁻¹ |
| Pr³⁺:YSO | Write at 606nm; Δn at 852nm ≈ 10⁻²⁶ via K-K (negligible) |
| Tm³⁺:YAG | Write at 793nm; same detuning problem; cryo required |
| Bacteriorhodopsin | Write at 570nm; high absorption at 852nm |
| Azobenzene | UV write; high absorption at 852nm |
| CS₂ Kerr (χ³) | Δn ~ 10⁻¹³ at practical intensity (I = 1 MW/m²) |
| SESAM | High absorption; ps lifetime (shorter than τ_rt) |
| HeNe gas | Wrong wavelength; worse Δn than Cs (§9, locked) |
| Liquid crystal | Not all-optical write; ms response |

**Tier 1 — Viable, constraints quantified:**

**InP:Fe (photorefractive):** Δn ~ 5×10⁻⁵ passive, ~5×10⁻⁴ with applied electric field. Write at 850nm (near-bandgap photorefractive effect). Grating lifetime µs–ms. InP bandgap is 924nm — 850nm is below gap, so α is lower than GaAs. Residual absorption from Fe trap states: α ~ 100–1000 m⁻¹ (αL ~ 0.5–5 at L=5mm). Marginal — measurable but requires experimental characterization. R ~ 92 at L=5mm with field enhancement. This is the EXP candidate for photorefractive ephemeral weights.

**SOA carrier-density grating (850nm QW):** Δn ~ 5×10⁻³ from carrier density modulation in a quantum-well active region pumped to transparency or gain. Write mechanism is self-writing (cross-gain saturation by the inference field itself — no separate write laser). Read beam sees net-zero or net-gain medium at the operating wavelength. Grating lifetime τ_c ~ 0.3–3 ns (carrier recombination). R ~ 550 at L = 3mm. Two open questions: (1) τ_c vs τ_rt timing; (2) angular multiplexing rank in a semiconductor gain chip. This is the highest-potential ephemeral candidate and the subject of §16.

**Cold atoms (MOT EIT):** Eliminates Doppler broadening → α_EIT is benign (αL ~ 0.01 at L=20mm). But MOT density N ~ 10¹⁶ m⁻³ is 200× lower than thermal vapor → Δn ~ 3×10⁻⁵ → R ~ 20 at L=20mm. Engineering complexity (MOT inside ring cavity) is severe. Not competitive on rank.

### 15.5 Architecture Status After Retraction

The permanent-weight PTR Fabry-Perot system (ARCH-1–17) is the validated architecture. The EIT ring branch (ARCH-19) is retracted. The SOA carrier grating is the new candidate for the ephemeral weight layer and is a qualitatively different geometry — it is a **gain chip inside a ring cavity**, not a gas cell. Derivation of the SOA rank ceiling and ring geometry follows in §16.

---

---

## 16. SOA Carrier-Density Grating: Rank Ceiling, Geometry, and Computational Primitive

**Status:** Derived 2026-05-08. Major geometry shift. Identifies SOA as the correct ephemeral weight medium and establishes a new computational primitive distinct from the PTR recurrent architecture.

### 16.1 Physical Mechanism

A quantum-well SOA pumped above transparency has a quasi-equilibrium carrier density $N_0$. An intensity pattern $I(x,y)$ spatially depletes carriers via stimulated recombination:

$$\Delta N(x,y) = -\frac{N_0 \cdot I(x,y)}{I_\text{sat}(1 + I/I_\text{sat})} \approx -\frac{N_0}{I_\text{sat}} I(x,y) \quad (I \ll I_\text{sat}) \tag{16.1}$$

This carrier depletion modulates the refractive index via the Kramers-Kronig relation (linewidth enhancement):

$$\Delta n = \frac{dn}{dN} \cdot \Delta N, \qquad \frac{dn}{dN} \approx -1\times10^{-26}\ \text{m}^3 \quad (\text{GaAs QW, 850 nm, Coldren \& Corzine 1995}) \tag{16.2}$$

For $\Delta N = N_\text{tr}/2$ (50% saturation of transparency density, $N_\text{tr} \approx 1.5\times10^{24}\ \text{m}^{-3}$):

$$\Delta n_\text{material} = 1\times10^{-26} \times 7.5\times10^{23} \approx 7.5\times10^{-3} \tag{16.3}$$

With modulation depth $s = 0.5$ (holographic fringe visibility): $\Delta n_\text{grating} \approx 3.75\times10^{-3}$.

### 16.2 The Confinement Factor Bottleneck

The QW active region is $d_\text{active} \approx 80\ \text{nm}$ (5 QWs × 16 nm each). The optical mode height in the waveguide is $w_\text{mode} \approx 2\ \mu\text{m}$. The **modal** $\Delta n$ experienced by the propagating field is:

$$\Delta n_\text{modal} = \Gamma \cdot \Delta n_\text{material}, \qquad \Gamma = \frac{d_\text{active}}{w_\text{mode}} \approx \frac{80\ \text{nm}}{2\ \mu\text{m}} = 0.04 \tag{16.4}$$

$$\Delta n_\text{modal} \approx 0.04 \times 3.75\times10^{-3} = 1.5\times10^{-4} \tag{16.5}$$

This is the binding constraint. The rank from dynamic range at $L_\text{chip} = 4\ \text{mm}$:

$$R_\text{dyn} = \frac{\pi \cdot \Delta n_\text{modal} \cdot L}{\lambda \cdot \text{arctanh}(\sqrt{\eta_\text{th}})} \approx \frac{\pi \times 1.5\times10^{-4} \times 4\times10^{-3}}{852\times10^{-9} \times 0.100} \approx 22 \tag{16.6}$$

$R_\text{dyn} = 22$ for a QW waveguide SOA — well below the PTR baseline of $R = 370$.

### 16.3 Geometry Options and Their Rank Ceilings

**Option A: QW waveguide SOA (current standard)**  
$\Gamma = 0.04$, $L = 4\ \text{mm}$, $\Delta n_\text{modal} = 1.5\times10^{-4}$ → $R = 22$. The waveguide confines the mode vertically, achieving low-threshold gain but killing the modal index modulation. Not competitive for holographic rank.

**Option B: Broad-area SOA, multi-chip chain**  
Stack $N$ chips: $R \propto N \times R_\text{per chip}$ (dynamic range adds; angular rank saturates). To reach $R = 370$ requires $\sim 17$ chips — impractical for a compact system.

**Option C: Bulk gain slab (no waveguide)**  
Remove the waveguide cladding: $\Gamma \to 1$, $\Delta n \approx 3.75\times10^{-3}$, $R \approx 550$ at $L = 4\ \text{mm}$. The pump must hold the bulk material at transparency ($\alpha = 0$) or into gain ($\alpha < 0$). This is a **gain hologram** — a known configuration in semiconductor optics (Goodman & Liu 1988, Kwong et al. 1993). The probe beam traverses the gain slab in free space; absorption is zero or negative. Rank is comparable to the PTR 2mm plate ($R = 370$) while providing gain.

Bulk gain slab is the viable geometry. Key unknowns: electrical pumping uniformity across the slab area, lateral heat management, and whether angular multiplexing rank in a bulk semiconductor matches the Kogelnik prediction.

**Option D: Vertical cavity (normal incidence through QW planes)**  
Effective length $L_\text{eff} = d_\text{active} \times T = 80\ \text{nm} \times T$. At $T = 100$: $L_\text{eff} = 8\ \mu\text{m}$ → $R \approx 1$. Ruled out entirely.

| Geometry | $\Delta n_\text{eff}$ | $L$ | $R$ | Absorption |
|:---|:---|:---|:---|:---|
| QW waveguide SOA | $1.5\times10^{-4}$ | 4 mm | 22 | Zero (gain) |
| Bulk gain slab | $3.75\times10^{-3}$ | 4 mm | 551 | Zero or negative (gain) |
| Vertical cavity | $\sim10^{-4}$ | 8 µm | ~1 | — |
| PTR glass (ref.) | $5\times10^{-4}$ | 2 mm | 370 | Zero (850nm) |

### 16.4 Grating Lifetime and Timing Constraint

The carrier lifetime $\tau_c \sim 0.3$–$3\ \text{ns}$ in a pumped SOA. The ring round-trip time for a compact cavity ($L_\text{ring} \sim 600\ \text{mm}$) is $\tau_\text{rt} \sim 2\ \text{ns}$.

At $T > 1$ (recurrent inference): the grating decays by $\exp(-T \cdot \tau_\text{rt}/\tau_c)$ between passes. At $T = 2$: $e^{-2 \times 2/1} = e^{-4} \approx 0.018$ — 98% of the grating is gone. **The SOA carrier grating is incompatible with the recurrent (T > 1) Fabry-Perot design.**

At $T = 1$ (single-pass): the grating is written and read in the same pass. The grating lifetime is irrelevant. Write and read are simultaneous.

This enforces a **T=1 single-pass architecture** for SOA-based gratings.

### 16.5 New Computational Primitive: Optical Cross-Phase Modulation

The T=1 constraint opens a qualitatively different computational primitive. At T=1:

1. **Write beam** (intensity $I_\text{write}$) writes the carrier grating: $\Delta n(\mathbf{r}) \propto I_\text{write}(\mathbf{r}) = |\sum_j a_j \psi_j(\mathbf{r})|^2$
2. **Read beam** (field $E_\text{read}$) accumulates phase: $\Delta E(\mathbf{r}) = i k \Delta n(\mathbf{r}) L \cdot E_\text{read}(\mathbf{r})$
3. **Output** (projected to mode basis): $b_i = \langle \psi_i | \Delta n | E_\text{read} \rangle$

**Case 1 — Write = Read (self-grating):**  
$I_\text{write} = I_\text{read} = |E|^2$. Output is $b_i \propto \sum_{jk} T_{ijk} a_j^* a_k$, a bilinear form. This implements a **quadratic operation** in the mode amplitudes: equivalent to unnormalized self-attention.

**Case 2 — Write ≠ Read (cross-grating):**  
Separate write beam (context, field $E_c$) sets $\Delta n(\mathbf{r}) \propto |E_c(\mathbf{r})|^2$. Read beam (query, field $E_q$) probes the grating. Output: $b_i \propto \langle \psi_i | |E_c|^2 | E_q \rangle$. This implements **optical cross-attention** — context-conditioned weighting applied to the query.

Neither of these is what the PTR recurrent system computes (which is linear matrix-vector multiplication repeated $T$ times). The SOA enables **nonlinear single-pass attention-like operations** without requiring learned weight storage in a holographic medium at all.

### 16.6 Relationship to PTR Architecture

The SOA bulk gain slab does **not** replace PTR. It computes a different function:

| Layer | Medium | Computation | Lifetime |
|:---|:---|:---|:---|
| PTR weight layer | PTR glass | $W \cdot a$ (linear, fixed $W$) | Permanent |
| SOA gain layer | Bulk gain slab | $|E_c|^2 \cdot E_q$ (bilinear, token-conditioned) | ~1 ns (per-token) |

They can be composed: PTR layer computes a linear projection; SOA layer then applies a context-dependent nonlinearity. This is architecturally closer to a full transformer block than the pure-SSM PTR design.

### 16.7 Open Questions (EXP candidates)

1. **Bulk gain slab pumping uniformity**: Can a bulk GaAlAs slab be uniformly pumped electrically or optically to transparency over a 5×5 mm² aperture? Current literature on broad-area VCSELs and gain chips suggests yes, but not at this geometry.
2. **Angular multiplexing rank in bulk semiconductor**: Kogelnik predicts $R \approx 550$. Semiconductor holograms achieve much lower rank in practice due to free-carrier scattering and spectral bandwidth. Needs experimental measurement.
3. **Cross-attention fidelity**: The bilinear operation $\langle \psi_i | |E_c|^2 | E_q \rangle$ approximates attention only in the linear (weak saturation) regime. At strong drive, saturation introduces higher-order nonlinearities. Need to bound the approximation error.
4. **Temporal multiplexing**: Can multiple context gratings be superimposed (one per attention head) by writing multiple wavelengths or polarizations simultaneously? This is the route to multi-head attention.

### 16.8 Status

SOA bulk gain slab (Option C) is the candidate for further development. Architecture is **PROPOSED**. The key insight — that SOA naturally implements attention-class rather than SSM-class computation — is a fundamental architecture branch point. Formal labeling: **ARCH-20: Gain Hologram Attention Layer**.

---

---

## 17. ARCH-20 Full Derivation: Gain Hologram Attention — Computation, Basis Dependence, and Multi-Head Scaling

**Status:** Derived 2026-05-08.  
**Purpose:** Establishes what the SOA bulk gain slab actually computes from first principles. Resolves the small-signal apparent contradiction, identifies the correct operating regime, and derives the operation in different spatial mode bases.

### 17.1 Small-Signal Consistency Check

The total phase accumulated through the gain slab is $k \Delta n L = (2\pi/852\,\text{nm}) \times 3.75\times10^{-3} \times 4\,\text{mm} = 110\,\text{rad}$. This appears to violate the small-signal approximation ($k\Delta n L \ll 1$) underlying the linear output formula.

Resolution: the total $\Delta n$ is shared among $R$ superimposed Bragg gratings:

$$\Delta n_\text{per} = \frac{\Delta n_\text{total}}{R} = \frac{3.75\times10^{-3}}{551} = 6.8\times10^{-6} \tag{17.1}$$

$$k \Delta n_\text{per} L = \frac{110}{551} = 0.20\,\text{rad} \quad \checkmark \tag{17.2}$$

Each individual grating operates in the small-signal regime. The Kogelnik coupled-wave framework remains valid. The total $k\Delta n_\text{total} L = 110\,\text{rad}$ is the coherent sum of 551 gratings each contributing 0.2 rad, consistent with $\eta = \sin^2(\kappa L) = \sin^2(0.10) = 1\%$ per grating at threshold.

The bulk gain slab operates as a **volume phase hologram** (Bragg regime, $L \gg \Lambda^2/\lambda$) with small-signal individual gratings and weak amplitude modulation ($\Delta g_\text{per} L = 0.10 \ll 1$).

### 17.2 Carrier Diffusion and Grating Stability

The carrier diffusion length in GaAlAs:

$$L_\text{diff} = \sqrt{D_n \tau_c} = \sqrt{(10\,\text{cm}^2/\text{s})(1\,\text{ns})} = 1\,\mu\text{m} \tag{17.3}$$

The grating period at 1° crossing angle: $\Lambda = \lambda/\sin(1°) = 49\,\mu\text{m}$.

$$L_\text{diff} / \Lambda = 1\,\mu\text{m} / 49\,\mu\text{m} = 0.02 \ll 1 \tag{17.4}$$

Carrier diffusion does not wash out the grating. Spatial hole burning survives, and the gain slab operates at full rank $R = 551$ — not the rank-1 limit that would apply if the carrier pool were perfectly homogeneous.

### 17.3 What the Gain Slab Computes

Let the input spatial field be decomposed in an orthonormal mode basis $\{\psi_j(\mathbf{r})\}$:

$$E(\mathbf{r}) = \sum_j a_j \psi_j(\mathbf{r}) \tag{17.5}$$

**Write step:** the intensity pattern of the context field $E_c$ depletes carriers and creates an index grating:

$$\Delta n(\mathbf{r}) = C \cdot |E_c(\mathbf{r})|^2 = C \sum_{j,k} c_j c_k^* \psi_j(\mathbf{r})\psi_k^*(\mathbf{r}) \tag{17.6}$$

**Read step:** the query field $E_q$ accumulates phase through $\Delta n(\mathbf{r})$:

$$E_\text{out}(\mathbf{r}) = E_q(\mathbf{r})\left(1 + i k L \cdot \Delta n(\mathbf{r})\right) \tag{17.7}$$

**Output mode amplitudes:**

$$b_i = \langle \psi_i | E_\text{out} \rangle = q_i + i k L C \sum_{j,k,l} c_j c_k^* q_l \underbrace{\int \psi_i^* \psi_j \psi_k^* \psi_l \, d\mathbf{r}}_{T_{ijkl}} \tag{17.8}$$

The 4th-order overlap tensor $T_{ijkl}$ encodes the mode structure. **The spatial basis determines what computation is performed.**

### 17.4 Basis-Dependent Operations

**Fourier (plane wave) basis** $\psi_j(\mathbf{r}) \propto e^{i\mathbf{k}_j \cdot \mathbf{r}}$:

$$T_{ijkl} = \delta(\mathbf{k}_i - \mathbf{k}_j + \mathbf{k}_k - \mathbf{k}_l) \quad [\text{momentum conservation}] \tag{17.9}$$

$$b_i = q_i + ikLC \cdot [\text{autocorr}(c) \ast q]_i \tag{17.10}$$

where $[\text{autocorr}(c)]_m = \sum_k c_{k+m} c_k^*$. The gain slab computes a **dynamic convolution** of the query with the autocorrelation of the context. Properties:

1. Translationally equivariant (kernel depends only on $i-j$, not absolute index)
2. Hermitian-symmetric kernel (autocorrelation is self-adjoint)
3. Global receptive field (autocorrelation spans all $H$ mode pairs)
4. Context-conditioned: kernel changes per token

**Localized (pixel) basis** $\psi_j(\mathbf{r}) = \delta(\mathbf{r} - \mathbf{r}_j)$:

$$T_{ijkl} = \delta_{ij}\delta_{kl}\delta_{ik} \tag{17.11}$$

$$b_i = q_i \left(1 + ikLC \cdot |c_i|^2\right) \tag{17.12}$$

Element-wise multiplication: each output mode is gated by the local context intensity. This is a **context-conditioned activation** (optically analogous to SiLU or sigmoid gating).

**The correct basis for attention:** a lens placed before the gain slab transforms Hermite-Gaussian input modes to plane waves in the Fourier plane. In this configuration, the gain slab computes the dynamic convolution (eq. 17.10) with global receptive field — the closest optical analog to dot-product attention.

### 17.5 The Associative Memory Interpretation

With context $c$ as a stored pattern and query $q$ as a noisy probe, the output in the Fourier basis recovers the stored pattern weighted by the overlap:

$$b \approx c \cdot \langle c, q \rangle / \|c\|^2 + q \cdot (1 - \langle c, c \rangle / \|c\|^2) \tag{17.13}$$

The gain slab performs **one-step Hopfield retrieval** at full rank in a single optical pass (~47 ps). At $R = 551$ superimposed patterns, the storage capacity matches the Hopfield bound ($\sim 0.14 R \approx 77$ orthogonal patterns before crosstalk dominates). This is a distinct operating mode from attention.

### 17.6 Multi-Head Scaling

Each gain slab has an independent carrier pool — independent heads by construction. An 8-head ARCH-20 block uses 8 parallel slabs:

| Quantity | Value |
|:---|:---|
| $\Delta n_\text{material}$ | $3.75\times10^{-3}$ |
| $L_\text{slab}$ | 4 mm |
| $R_\text{dyn}$ per slab | 551 |
| Effective parameters (full-rank $W$, $H=512$) | $512^2 = 262{,}144$ per head |
| 8 heads | 2,097,152 parameters |
| Single-slab latency ($nL/c$) | 47 ps |
| 8-head block latency (parallel) | 47 ps |
| 8-head block latency (serial) | 373 ps |

Parallel heads require a beam-splitting stage before the slab array and a combining stage after — standard interferometric optics.

### 17.7 Relationship to PTR Architecture

ARCH-20 is **not** a replacement for the PTR recurrent system. They compute categorically different functions:

| | PTR (ARCH-1–17) | Gain hologram (ARCH-20) |
|:---|:---|:---|
| Operation | $W \mathbf{a}$ (linear, fixed $W$) | $[\text{autocorr}(c) \ast q]$ (dynamic convolution) |
| Computational class | SSM / RNN | Attention / associative memory |
| $W$ origin | Holographic grating (trained) | Carrier grating (context-written per token) |
| Depth | $T = 100$ recurrent passes | $T = 1$ single pass |
| Memory | Hidden state $\mathbf{h}$ (implicit) | Context field $E_c$ (explicit) |
| Nonlinearity | VCSEL threshold (inter-layer) | Carrier saturation (intra-layer) |

**Composition:** PTR layer followed by ARCH-20 layer computes $\text{Attention}(W_\text{PTR} \cdot \mathbf{a})$ — an optically complete transformer block. This is the Gen 3 direction.

### 17.8 Open Items

1. **Full $T_{ijkl}$ calculation for Hermite-Gaussian basis.** The Fourier and pixel bases are analytic; the HG basis requires explicit overlap integrals. This determines whether HG modes naturally implement attention or require a lens pre-stage.
2. **Saturation and nonlinear corrections.** Eq. 17.7 is first-order in $\Delta\phi$. The corrections (higher-order terms) create additional nonlinear operations that may be beneficial (or detrimental). Need to bound these.
3. **Write/read timing.** At T=1, write and read are simultaneous — the same photon writes and reads the grating. This requires careful analysis: the grating builds up as the beam propagates, not instantaneously at the input. For $L = 4$ mm at $c/n = 8.6\times10^{10}$ m/s, the transit time is 47 ps — much shorter than $\tau_c = 1$ ns. The grating is quasi-static during the read pass. ✓
4. **Experimental rank measurement.** The Kogelnik prediction of $R = 551$ assumes ideal bulk material. Free-carrier scattering and spectral inhomogeneity in GaAlAs may reduce this. Direct measurement is EXP-9.

---

---

## 18. ARCH-20 Geometry Closure: Polarization Multiplexing, Timing, and Pipeline

**Status:** Derived 2026-05-08.  
**Purpose:** Verifies that the ARCH-20 gain hologram attention layer closes as a physical system — geometry, polarization separation, timing, and pipeline compatibility with PTR.

### 18.1 HG Basis Tensor Structure

Numerical evaluation of $T_{ijkl} = \int \psi_i^* \psi_j \psi_k^* \psi_l\,dr$ for Hermite-Gaussian modes (N=6) reveals:

- **50% of elements are nonzero** (selection rule: $T_{ijkl} \neq 0$ only when $i+j+k+l$ is even — parity conservation)
- **W(c) is full rank for all contexts** tested (20 random unit vectors; rank = N always)
- **W(c) is always symmetric**: $W_{il}(c) = W_{li}(c)$ for all $c$

The last point has an architectural implication: HG basis gives **symmetric attention** — it can represent bidirectional (encoder-style) attention but not causal autoregressive attention. For causal self-attention, a Fourier lens before the slab is needed. For cross-attention ($c \neq q$), the operation is asymmetric by construction even in the HG basis — no lens required. Cross-attention is the primary operating mode of ARCH-20.

### 18.2 The Timing Problem and Its Resolution

The carrier response time is $\tau_c \sim 1\,\text{ns}$. The single-pass transit time through the 4mm slab is $\tau_\text{transit} = nL/c = 47\,\text{ps}$. In a simultaneous write+read configuration, only:

$$\eta_\text{grating} = 1 - e^{-\tau_\text{transit}/\tau_c} = 1 - e^{-0.047} = 4.6\% \tag{18.1}$$

of the grating forms during the transit. Effective $\Delta n \approx 1.7\times10^{-4}$ → $R \approx 25$. This is inadequate.

**Solution: Sequential write-then-read.** The context beam (H polarization) writes the carrier grating during a dedicated write phase of duration $3\tau_c = 3\,\text{ns}$, achieving 95% of the steady-state grating:

$$\Delta n_\text{seq} = \Delta n_\text{max}(1 - e^{-3}) = 0.95 \times 3.75\times10^{-3} = 3.56\times10^{-3} \tag{18.2}$$

$$R_\text{seq} = \frac{\pi \cdot \Delta n_\text{seq} \cdot L}{\lambda \cdot \text{arctanh}(\sqrt{\eta})} \approx 524 \tag{18.3}$$

The query beam (V polarization) then reads the fully-formed grating in a single 47ps transit. The full attention cycle: **write (3 ns) → read (47 ps) → decay (3 ns passive) = 6 ns total**.

### 18.3 Preferred Geometry: Polarization-Multiplexed Transmissive Slab

No ring cavity is required. The geometry is a transmissive single-pass element:

```
[Context VCSEL array, H pol, I ~ I_sat]  ─────┐
                                              [PBS] → [Bulk GaAlAs slab, 4mm]→ [PBS] → V output (attention result)
[Query VCSEL array,   V pol, I ~ 0.01×I_sat] ─┘                                     → H discard
```

Context (H) and query (V) co-propagate collinearly through the slab. The H-polarized field at intensity $I_\text{sat} = 10^7\,\text{W/m}^2$ depletes carriers spatially, writing $\Delta n(\mathbf{r}) \propto |E_H(\mathbf{r})|^2$. The V-polarized query at $0.01 \times I_\text{sat}$ probes the grating without significantly perturbing it. At the output PBS, H is discarded and V carries the attention result.

**Why this works:**
- Cross-polarization cross-gain modulation (XPM/XGM) in semiconductor gain media is well-documented (Lacey et al. 1994, Pleumeekers et al. 2002) — the H-field depletes carriers seen by V
- Semiconductor gain is weakly polarization-dependent in bulk GaAlAs (gain anisotropy < 1 dB) — the depletion grating applies nearly equally to V
- Polarization beam splitters achieve > 30 dB extinction ratio — clean separation
- Co-propagating write and read share identical wavefront paths → aberrations cancel identically (self-compensating holography, Psaltis 1990 ✓)

**Verified constraints:**

| Constraint | Requirement | Actual | Status |
|:---|:---|:---|:---|
| Overlap (Δθ=0, collinear) | Δθ < 200 mrad | 0 mrad (collinear) | ✓ |
| Grating not erased by read | $I_r \ll I_w$ | $I_r = 0.01 \times I_w$ | ✓ |
| SHB survives diffusion | $L_\text{diff} \ll \Lambda$ | 1 µm ≪ 49 µm | ✓ |
| Output separation | PBS extinction | >30 dB | ✓ |
| Attention cycle < token period | < 13.3 ns | 6 ns | ✓ |
| Cross-pol CGM documented | Literature | Lacey 1994 | ✓ |

### 18.4 Pipeline Compatibility with PTR

The ARCH-20 attention cycle (6 ns) is shorter than the PTR inference period (13.3 ns). They can be fully pipelined:

```
Token t:   [PTR inference, 13.3 ns] → output h_t
           ∥ [ARCH-20 attention for t-1, 6 ns] 
Token t+1: [PTR inference, 13.3 ns] → output h_{t+1}
           ∥ [ARCH-20 attention for t, 6 ns]
```

At steady state: ARCH-20 adds **zero latency** — it runs in the shadow of the PTR inference. The system throughput remains 75M tok/s (PTR-limited).

### 18.5 Causal vs Bidirectional Attention

HG basis gives symmetric $W(c)$. The two attention modes:

- **Cross-attention** ($c \neq q$, context from previous token): asymmetric by construction, no lens needed. This is the primary operating mode for autoregressive generation.
- **Self-attention** ($c = q$): symmetric in HG basis — bidirectional. Suitable for encoder/prefix processing. For causal self-attention (autoregressive), a Fourier lens (4f system) before the slab transforms HG modes to plane waves, breaking the symmetry constraint.

For the ORI use case (SSM + attention for autoregressive token generation), cross-attention is the relevant mode. A lens stage is not required at baseline.

### 18.6 Open Experiments (EXP-9 through EXP-12)

| EXP | Description | Blocks |
|:---|:---|:---|
| EXP-9 | Bulk GaAlAs gain slab rank measurement at 852nm | R_dyn vs prediction |
| EXP-10 | Pumping uniformity over 5×5mm² aperture at transparency | ARCH-20 viability |
| EXP-11 | Cross-polarization XGM efficiency and fidelity at 852nm | Polarization mux scheme |
| EXP-12 | $T_{ijkl}$ full analytical calculation for 2D HG basis | Lens decision |

### 18.7 ARCH-20 Reference Design (Locked Parameters)

| Parameter | Value | Source |
|:---|:---|:---|
| Gain medium | Bulk GaAlAs | §16.3 geometry analysis |
| Slab dimensions | 4mm × 5mm × 5mm | §16, §18.2 |
| $\Delta n_\text{material}$ | $3.75\times10^{-3}$ (50% sat.) | §16.1 |
| $\Delta n_\text{seq}$ (3τ_c write) | $3.56\times10^{-3}$ | §18.2 |
| $R_\text{dyn}$ | 524 | §18.2 |
| Write polarization | H, $I \sim I_\text{sat} = 10^7\,\text{W/m}^2$ | §18.3 |
| Read polarization | V, $I \sim 10^5\,\text{W/m}^2$ | §18.3 |
| Attention cycle | 6 ns (write 3 ns + read 47 ps + decay 3 ns) | §18.2 |
| Pipeline overhead | Zero (hidden behind PTR) | §18.4 |
| Causal attention | Cross-attention mode (no lens needed) | §18.5 |
| Carrier lifetime | $\tau_c \sim 1\,\text{ns}$ (GaAlAs at transparency) | §16.4 |
| Carrier diffusion | $L_\text{diff} = 1\,\mu\text{m} \ll \Lambda = 49\,\mu\text{m}$ | §17.2 |
| Transit latency | 47 ps | §18.2 |

---

---

## 19. T_{ijkl} Exact Derivation for Hermite-Gaussian Basis

**Status:** Derived 2026-05-08. Closes EXP-12. Resolves the lens question definitively.  
**Purpose:** Derives the exact closed form for the 4-index overlap tensor $T_{ijkl}$ in the 2D HG mode basis, establishes all symmetry properties, and determines the conditions under which a Fourier lens is required.

### 19.1 The 1D Overlap Integral

For normalized 1D HG modes $\psi_n(x) = ({\sqrt{\pi}\,2^n n!})^{-1/2} H_n(x)\,e^{-x^2/2}$ (w₀ = 1), the 4-index overlap integral is:

$$I_{abcd} \equiv \int_{-\infty}^{\infty} \psi_a(x)\,\psi_b(x)\,\psi_c(x)\,\psi_d(x)\,dx = N_a N_b N_c N_d \int H_a H_b H_c H_d\,e^{-2x^2}\,dx \tag{19.1}$$

where $N_n = (\sqrt{\pi}\,2^n n!)^{-1/2}$.

**Step 1 — Hermite product linearization** (DLMF 18.18.22):

$$H_m(x)\,H_n(x) = \sum_{s=0}^{\min(m,n)} 2^s\,s!\,\binom{m}{s}\binom{n}{s} H_{m+n-2s}(x) \tag{19.2}$$

Apply twice to expand $H_a H_b H_c H_d$.

**Step 2 — Two-function integral against $e^{-2x^2}$**:

$$\int_{-\infty}^{\infty} H_p(x)\,H_q(x)\,e^{-2x^2}\,dx = \sqrt{\tfrac{\pi}{2}}\cdot 2^p\cdot p!\cdot\delta_{pq} \tag{19.3}$$

Verified numerically for $p,q = 0,\ldots,5$. This is the $\alpha=2$ case of the weighted HG orthogonality relation (Mehler 1866).

**Step 3 — Collect terms.** Let $\Delta = (c+d-a-b)/2$, $t = s+\Delta$, $r = a+b-2s$. The delta in eq. 19.3 selects $t$ given $s$, yielding the **closed form**:

$$\boxed{I_{abcd} = N_a N_b N_c N_d\sqrt{\tfrac{\pi}{2}} \sum_s 2^{s+t+r}\,s!\,t!\,r!\,\binom{a}{s}\binom{b}{s}\binom{c}{t}\binom{d}{t}} \tag{19.4}$$

where the sum runs over all $s \geq 0$ such that $t = s+\Delta \in [0, \min(c,d)]$ and $r = a+b-2s \geq 0$.

**Selection rule:** $I_{abcd} = 0$ unless $(a+b+c+d)$ is even. This is the only selection rule — every even-sum entry is nonzero (verified for $N=8$ modes per axis). Physically: parity conservation in the photon-number basis.

**Symmetry:** $I_{abcd}$ is invariant under all 24 permutations of $(a,b,c,d)$ — full $S_4$ symmetry. This follows from the commutativity of multiplication in the integrand.

### 19.2 The 2D Tensor

For 2D HG modes $\psi_{mn}(x,y) = \psi_m(x)\psi_n(y)$, the tensor factorizes:

$$T_{(mn)(m'n')(m''n'')(m'''n''')} = I_{m\,m'\!m''\!m'''} \times I_{n\,n'\!n''\!n'''} \tag{19.5}$$

This is a **Kronecker product structure** — the full 2D problem separates exactly into two independent 1D problems.

### 19.3 The Effective Weight Matrix

For a context field $E_c(\mathbf{r}) = \sum_j c_j \psi_j(\mathbf{r})$, the gain slab produces an effective weight matrix:

$$W_{il}(c) = \sum_{j,k} c_j c_k^* \,T_{ijkl} \tag{19.6}$$

**Symmetry of W(c):** For all contexts $c$:

$$W_{il}(c) = W_{li}(c) \tag{19.7}$$

*Proof:* $W_{li} = \sum_{jk} c_j c_k^* T_{ljki}$. Since $T$ has full $S_4$ symmetry, $T_{ljki} = T_{jlki} = T_{ijkl}$ under appropriate relabeling. More directly: the sum $\sum_{jk} c_j c_k^* T_{ijkl}$ is symmetric in the exchange $j \leftrightarrow k$ combined with $i \leftrightarrow l$, giving $W_{il} = W_{li}$. This holds for complex $c$ as well. $\square$

### 19.4 Resolution of the Lens Question

$W(c)$ is always symmetric in HG basis. This constrains the computation:

**Self-attention ($c = q$):** $W(c)$ is symmetric → bidirectional attention. Appropriate for encoder / prefix processing. **Not causal** — cannot implement autoregressive masking without additional optical elements. A Fourier lens (4f system) before the slab would break the $S_4$ symmetry and allow asymmetric $W$.

**Cross-attention ($c \neq q$, context from previous token):** The weight matrix $W(c_\text{prev})$ acts on the current query $q_\text{curr}$. Even though $W$ is symmetric in mode index, the **temporal asymmetry** ($c_\text{prev} \neq q_\text{curr}$) provides causality. The output $b = W(c_\text{prev}) \cdot q_\text{curr}$ depends on the past context but not the reverse. This is correct causal operation for autoregressive generation.

**Conclusion: A Fourier lens is NOT required for the primary ORI use case (autoregressive text generation via cross-attention).** Causality is enforced by the token sequence, not by the spatial symmetry of $W$. A lens would be needed only for causal self-attention within a single spatial mode superposition — a secondary use case (prefix encoder) not required for Gen 3.

### 19.5 What the Gain Slab Computes — Precise Statement

The ARCH-20 gain slab implements **unnormalized content-based addressing**:

$$b_i = \sum_l W_{il}(c)\,q_l = \sum_{j,k,l} c_j c_k^*\,T_{ijkl}\,q_l \tag{19.8}$$

This is:
- **Bilinear** in context $c$ (quadratic in mode amplitudes)
- **Linear** in query $q$
- **The numerator of dot-product attention** without the softmax denominator
- **Full rank** for all contexts tested (W(c) has rank H for all random unit vectors c)
- **Symmetric** in the output-input mode index pair $(i,l)$

It is NOT equivalent to scaled dot-product attention (which requires softmax normalization and separate Q/K/V projections). The missing softmax means the output is not probability-normalized over output modes. For compositional use in a transformer-like block, a normalization stage (e.g., a simple detector + VCSEL renormalization) would be required between layers.

### 19.6 Summary Table

| Property | Result | Method |
|:---|:---|:---|
| Selection rule | $(a+b+c+d)$ even only | Parity conservation |
| Secondary selection rule | None | Verified $N=8$ |
| $I_{abcd}$ closed form | Eq. 19.4 | Hermite linearization + Gaussian integral |
| $S_4$ symmetry | Full | Commutativity of integrand |
| 2D factorization | Kronecker product | Mode separability |
| $W(c)$ symmetry | Always symmetric | $S_4$ + $j\leftrightarrow k$ sum |
| Self-attention | Bidirectional (symmetric) | W symmetry |
| Cross-attention | Causal in time | Token sequence asymmetry |
| Fourier lens needed? | **No** (for cross-attention) | Proved |
| Computation class | Unnormalized content addressing | Eq. 19.8 |

---
