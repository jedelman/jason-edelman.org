# Holography in Artificial Neural Networks
**Source:** Nature 343, 325-330 (1990)
**DOI:** 10.1038/343325a0
**Authors:** D. Psaltis, D. Brady, X.G. Gu, S. Lin
**Institution:** Caltech

## Core Claim
Dense neural network interconnections are naturally implemented by holographic recording in photorefractive crystals. Optoelectronic neurons (semiconductor detector/emitter pairs) interconnected by holograms constitute a complete optical neural network capable of Hebbian learning.

## Architecture
- Neurons: optoelectronic (detect → threshold → re-emit)
- Weights: holographic gratings in photorefractive crystal (BaTiO3 or BSO)
- Learning: Hebbian — simultaneous illumination of pre/post-synaptic patterns writes a grating
- Readout: diffraction from hologram → weighted sum at detector plane
- Nonlinearity: provided by thresholding electronics at each neuron

## Key Physics: Holographic Weight Storage
One hologram stores one outer product (weight matrix for one pattern pair).
Angular multiplexing stores multiple patterns in same crystal volume.
Weight update: new exposure adds new grating (can decay old ones — forgetting).
This is analog weight storage in a physical medium. Not volatile.

## Why Relevant
First demonstration that holography naturally implements the MVM (matrix-vector multiply) in a neural network:
  output_i = Σ_j W_ij · input_j
where W_ij is encoded in the holographic grating amplitude/phase at the corresponding angle.

For our resonator: if the cavity medium contains a holographic grating, diffraction from the grating implements an inner product between the input field and the stored pattern.
Multiple gratings (angle-multiplexed) = multiple weight rows.

## Critical Limitation (1990)
Learning was optical (Hebbian) — not backprop. No gradient descent.
Photorefractive crystals required continuous illumination to maintain weights (volatile).
Solution adopted by Glass Brain: PTR glass = thermally fixed gratings (non-volatile).
Solution for learning: train offline (compute Δn pattern), write once with UV.

## Connection to Our Architecture
Psaltis 1990 established: hologram = weight matrix.
Hughes 2019 established: wave medium = RNN.
Synthesis: a holographic resonator = a recurrent weight matrix whose entries are stored as Δn(x,y).
The resonator's round trips iterate the recurrence.
