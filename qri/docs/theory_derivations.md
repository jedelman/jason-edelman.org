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

**SNR budget.** Each round trip incurs loss from mirror reflectivity ($-0.023$ dB per round trip at
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
