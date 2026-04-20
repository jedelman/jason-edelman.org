# Quantum Resonator Inference — Architecture Specification

**Status:** INITIAL SCAFFOLD — 2026-04-19  
**Project:** All-optical resonator for learned token inference  
**Approach:** First-principles derivation of coherent optical inference

---

## 1. Problem Statement

Standard LLM inference is memory-bandwidth-bound and thermodynamically inefficient. Every token requires moving billions of weight parameters through digital electronics at ~pJ/MAC. We are deriving an alternative: a coherent all-optical resonator that encodes model weights in optical degrees of freedom and executes inference via photon-weight interactions at the speed of light.

The goal is not to emulate digital compute optically — it is to find the natural optical primitive that corresponds to token inference, and build from there.

---

## 2. Design Principles

1. **First-principles only.** Every architectural decision must be justified by physics, not by analogy to digital systems.
2. **Coherence as a resource.** The design exploits optical coherence (phase, polarization, wavelength) as a computational degree of freedom.
3. **Learning is structural.** Model weights are encoded in material structure (holographic, diffractive, or resonant), not in volatile electronic state.
4. **Token inference is a transform.** Each inference step is a physically realizable linear transform followed by a nonlinearity. The resonator implements both.
5. **No hallucinated specs.** All parameters in parameters.toml require rationale. All material properties in properties.toml require citation.

---

## 3. Architecture (To Be Derived)

This section will be populated as the first-principles derivation proceeds.

### 3.1 Optical Primitive (TBD)
What is the fundamental optical operation that corresponds to matrix-vector multiplication for transformer inference?

Candidates under consideration:
- Coherent holographic diffraction (PTR glass, as in Glass Brain)
- Resonant cavity mode coupling
- Parametric down-conversion / optical nonlinearity
- 4f Fourier processing

### 3.2 Nonlinearity (TBD)
Transformers require nonlinear activation. Options:
- Optoelectronic (detect → threshold → re-emit)
- All-optical (saturable absorber, Kerr nonlinearity, EIT)
- Hybrid (optical linear + electronic nonlinear)

### 3.3 Token Encoding (TBD)
How is a token embedding encoded as an optical field?
- Spatial amplitude/phase modulation
- Wavelength division multiplexing
- Temporal encoding (pulse shaping)

### 3.4 Resonator Role (TBD)
What does the resonator add that a single-pass system cannot?
- Recurrence / memory (fixed-point iteration)
- Gain (compensate propagation loss)
- Mode selection (filtering, discretization)
- All of the above

---

## 4. Relationship to Glass Brain

This project is conceptually adjacent to Glass Brain (jedelman/pure-light-inference-device) but asks a different question.

Glass Brain: Can we build a feedforward optical inference engine using PTR holographic plates and a 4f geometry, implementing a known architecture (RetNet) in optics?

This project: Can we derive the natural computational primitive of a coherent optical resonator and show it corresponds to token inference — possibly revealing a new architecture rather than implementing an existing one?

The distinction matters. Glass Brain maps a digital architecture to optics. This project asks what architecture the physics demands.

---

## 5. Open Questions

1. What is the optical analogue of attention?
2. Can a resonator implement recurrence without electronic feedback?
3. What is the SNR budget for coherent optical inference at room temperature?
4. What material system supports the required nonlinearity with acceptable loss?
5. Can the resonator learn (update weights) in-situ, or are weights static?

---

## 6. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-19 | Project scaffolded | Initial setup |

