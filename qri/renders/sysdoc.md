# Quantum Resonator Inference — System Documentation

*Generated: 2026-04-20*

---

## Architecture

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



---

## Material Properties

### `ptr_glass`
*Photo-thermo-refractive glass for holographic recording*

- **wavelength_range_nm**: [300, 3000]
- **max_refractive_index_change**: 0.005
- **absorption_coefficient_per_cm**: 0.01
- **diffraction_efficiency_max**: 0.99
- **write_wavelength_nm**: 325
- **erase_wavelength_nm**: 0
- **thermal_stability_C**: 400

> Cite: Glebov 2010, Proc. SPIE 7504, doi:10.1117/12.838767

### `linbo3_tfln`
*Thin-film lithium niobate electro-optic modulator platform*

- **half_wave_voltage_V**: 1.5
- **bandwidth_GHz**: 100
- **propagation_loss_dB_per_cm**: 0.27
- **coupling_loss_dB**: 0.5
- **pockels_coefficient_r33_pm_per_V**: 30.9

> Cite: Wang et al. 2018, Nature, doi:10.1038/s41586-018-0551-y

### `sin_pic_a150`
*Ligentec A150 silicon nitride PIC platform, NIR optimized*

- **wavelength_range_nm**: [700, 1060]
- **propagation_loss_dB_per_m**: 3.0
- **minimum_bend_radius_um**: 10
- **coupling_loss_fiber_to_chip_dB**: 1.5
- **platform**: Ligentec A150

> Cite: Ligentec A150 PDK documentation, https://www.ligentec.com/products/a150/

### `gaas_vcsel_850nm`
*GaAs vertical-cavity surface-emitting laser at 850nm*

- **threshold_current_mA**: 0.5
- **slope_efficiency_W_per_A**: 0.6
- **wall_plug_efficiency**: 0.35
- **linewidth_MHz**: 50
- **coherence_length_m**: 3.0
- **modulation_bandwidth_GHz**: 10

> Cite: Iga 2000, IEEE J. Sel. Top. Quantum Electron., doi:10.1109/2944.902166

### `ingaas_pin_detector`
*InGaAs PIN photodetector, telecom/NIR*

- **responsivity_A_per_W**: 0.85
- **bandwidth_GHz**: 50
- **dark_current_nA**: 1.0
- **noise_equivalent_power_W_per_rtHz**: 1e-14

> Cite: Bowers & Burrus 1987, J. Lightwave Technol., doi:10.1109/JLT.1987.1075507

### `si_pin_detector_850nm`
*Silicon PIN photodetector at 850nm*

- **responsivity_A_per_W**: 0.6
- **bandwidth_GHz**: 10
- **dark_current_nA**: 0.1

> Cite: Saleh & Teich, Fundamentals of Photonics, 3rd Ed., Ch. 18

### `silica_fiber_smf28`
*Corning SMF-28 single-mode fiber*

- **attenuation_dB_per_km_1550nm**: 0.18
- **attenuation_dB_per_km_1310nm**: 0.35
- **attenuation_dB_per_km_850nm**: 2.5
- **core_diameter_um**: 8.2
- **numerical_aperture**: 0.14

> Cite: Corning SMF-28 Ultra datasheet, 2023, https://www.corning.com/media/worldwide/coc/documents/Fiber/SMF-28%20Ultra.pdf

---

## Design Parameters

### `optical`
- **wavelength_nm**: `850`

### `token_embedding`
- **dimension**: `512`

### `spatial`
- **pixel_pitch_um**: `100`
- **aperture_mm**: `512`

### `resonator`
- **finesse**: `TBD`
- **round_trip_loss_dB**: `TBD`
- **free_spectral_range_GHz**: `TBD`

### `snr`
- **target_bits**: `6`
- **target_snr_dB**: `38.0`

### `power`
- **optical_input_mW**: `TBD`
- **facility_W**: `TBD`

