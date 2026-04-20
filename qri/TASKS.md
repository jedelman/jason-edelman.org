# Tasks
## Convention
- `[ ]` open
- `[x]` done
- Priority: HIGH / MED / LOW

---

## Literature Investigation

### From ONN Review (Fu et al. 2024, Light: Sci. & Appl.)

**Foundational papers — HIGH priority**
- [ ] Lin et al. 2018, Science — "All-optical machine learning using diffractive deep neural networks" — D2NN original. Rayleigh-Sommerfeld propagation as forward pass. Training via backprop on phase masks. Key for understanding D2NN geometry and its limits.
- [ ] Shen et al. 2017, Nature Photonics — "Deep learning with coherent nanophotonic circuits" — MZI mesh ONN, SVD-based weight decomposition, first integrated ONN chip. Establishes unitary constraint and its consequences.
- [ ] Psaltis et al. 1990, Nature — "Holography in artificial neural networks" — Foundational. Photoreactive crystals for nonlinearity in ONNs. Directly relevant: holography + NN from first principles.
- [ ] Farhat et al. 1985, Appl. Opt. — "Optical implementation of the Hopfield model" — First optical neural network. Understand the original motivation and what was achieved.
- [ ] Reck et al. 1994, Phys. Rev. Lett. — "Experimental realization of any discrete unitary operator" — Beam splitter + phase shifter decomposition of arbitrary unitary. Foundation of MZI mesh approach.

**Nonlinearity papers — HIGH priority**
- [ ] Feldmann et al. 2019, Nature — "All-optical spiking neurosynaptic networks with self-learning capabilities" — PCM + MRR spiking ONN. Nonlinearity via PCM state switch. Understand endurance limits.
- [ ] Feldmann et al. 2021, Nature — "Parallel convolutional processing using an integrated photonic tensor core" — PCM + microcomb, TOPS-scale. Understand architecture and why PCM failed for our use case.
- [ ] Zhong et al. 2023, Nature Communications — "Graphene/silicon heterojunction for reconfigurable phase-relevant activation function" — All-optical nonlinearity without PCM. Promising alternative. Investigate saturation behavior, loss, bandwidth.

**Reservoir computing — MED priority**
- [ ] Duport et al. 2012, Opt. Express — "All-optical reservoir computing" — SOA delay-loop reservoir. First all-optical reservoir. Understand connection to resonator recurrence.
- [ ] Hughes et al. 2019, Sci. Adv. — "Wave physics as an analog recurrent neural network" — Scattering matrix of a wave medium IS an RNN. Directly relevant to resonator-as-computation concept.

**Integrated platforms — MED priority**
- [ ] Bogaerts et al. 2020, Nature — "Programmable photonic circuits" — State of art programmable PICs. Understand what's achievable in integrated optics.
- [ ] Xu et al. 2021, Nature — "11 TOPS photonic convolutional accelerator" — Optical frequency comb + WDM for convolution. Time-wavelength interleaving. Key for throughput comparison.

**Scaling / energy — LOW priority (but read abstracts)**
- [ ] Xu et al. 2024, Science — "Large-scale photonic chiplet Taichi empowers 160-TOPS/W" — Latest energy efficiency benchmark for optical compute.

---

### From Dual-Comb Holography (Vicentini et al. 2021, Nat. Photonics)

**HIGH priority**
- [ ] Picqué & Hänsch 2019, Nat. Photonics — "Frequency comb spectroscopy" — Review of dual-comb technique. Essential for understanding frequency-multiplex token encoding.
- [ ] Shams-Ansari et al. 2020, arXiv:2003.04533 — "Integrated lithium-niobate electro-optic platform for spectrally tailored dual-comb spectroscopy" — TFLN micro-ring dual-comb. Directly bridges our modulator platform to frequency-comb encoding.

**MED priority**
- [ ] Coddington et al. 2009, Nat. Photonics — "Rapid and precise absolute distance measurements" — Dual-comb ranging. Understand coherence and precision limits.
- [ ] Ideguchi et al. 2013, Nature — "Coherent Raman spectro-imaging with laser frequency combs" — Dual-comb with nonlinear process. Nonlinear optics + comb = interesting for all-optical nonlinearity.

---

## Architecture Derivation Tasks

- [x] ARCH-1: Identify the optical primitive — What is the natural optical operation corresponding to MVM? Compare: (a) 4f holographic diffraction, (b) MZI interference, (c) resonant mode coupling, (d) parametric interaction. Derive from Maxwell's equations, not analogy.
- [ ] ARCH-2: Resonator geometry choice — Fabry-Perot vs ring vs bowtie vs Sagnac. Criteria: (a) round-trip loss budget, (b) mode volume, (c) FSR vs token bandwidth, (d) mechanical stability.
- [ ] ARCH-3: Nonlinearity mechanism — What provides the activation function? Options: (a) saturable absorber, (b) Kerr effect, (c) EIT, (d) optoelectronic. Derive SNR cost of each.
- [ ] ARCH-4: Token encoding — How does a token embedding vector enter the resonator? Map options to optical degrees of freedom.
- [ ] ARCH-5: Learning mechanism — Are weights static (fab-time) or in-situ tunable? What does "learning" mean physically for a resonator?

---

## Build / Infrastructure Tasks

- [ ] INFRA-1: Add PDF fetching to generate_sysdoc.py — download full PDFs where DOI is available, store in citations/
- [ ] INFRA-2: Add design/render_resonator.py — placeholder renderer for resonator geometry diagrams
- [ ] INFRA-3: Set up conversations/ log rotation — one file per session


---

## Architecture Derivation Tasks (derived from ARCH-1)

- [x] ARCH-1: Optical primitive LOCKED — Fabry-Perot resonator as wave RNN (Hughes 2019 mapping)
- [ ] ARCH-2: Resonator geometry — derive L, mirror R, round-trips T_max from loss budget and SNR requirement
- [ ] ARCH-3: Mode structure — derive aperture size from d=512 embedding; confirm N ≥ 512 orthogonal modes fit
- [ ] ARCH-4: Token throughput — derive token rate from L and T (tau = 2L/c, rate = 1/T*tau)
- [ ] ARCH-5: SNR budget — derive noise accumulation over T round trips; confirm 6-bit precision achievable
- [ ] ARCH-6: Training pipeline — adjoint method for wave dynamics; compute UV hologram from Δn(x,y)
- [ ] ARCH-7: Hologram capacity — how many weight matrix parameters fit in PTR plate at 50um pitch?
- [ ] ARCH-8: Interposer — confirm Glass Brain design reusable; derive changes needed for resonator vs. feedforward

