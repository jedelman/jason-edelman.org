# Dual-Comb Hyperspectral Digital Holography
**Source:** Nature Photonics (2021)
**DOI:** https://doi.org/10.1038/s41566-021-00892-x
**Authors:** Vicentini E., Wang Z., Van Gasse K., Hänsch T.W., Picqué N.
**Institution:** Max Planck Institute of Quantum Optics

## Relevance to Project
MEDIUM. Not directly about inference, but demonstrates:
- Coherent field reconstruction across 100,000 simultaneous frequency channels
- Amplitude AND phase recovered for each frequency (complex field measurement)
- Dual-comb interferometry as a readout mechanism with sub-Hz precision

## Key Concepts
- Two frequency combs with slightly different rep rates (δf_rep = 1-2 Hz) produce multiheterodyne signal
- Each pixel carries a full complex spectrum across all comb lines
- Ambiguity range: c/f_rep (~30cm at 1GHz rep rate)
- SNR limited by technical noise (camera frame rate, laser RIN) not fundamental

## Relevance to Token Encoding Question
Frequency-comb token encoding: one token = one set of amplitudes/phases across N comb lines. This is WDM generalized to coherent complex encoding. Could map token embedding dimensions onto comb frequencies. Bandwidth = N_lines × f_rep. For 512-dim embedding at 500MHz rep rate: 256 GHz total bandwidth (feasible in C-band).

## Key Citations to Investigate
- Picqué & Hänsch 2019, Nat. Photonics — frequency comb spectroscopy review
- Coddington et al. 2009, Nat. Photonics — dual-comb ranging
- Ideguchi et al. 2013, Nature — coherent Raman dual-comb
- Shams-Ansari et al. 2020 — TFLN electro-optic micro-ring dual-comb (directly relevant to our platform)
