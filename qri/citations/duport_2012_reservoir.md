# All-Optical Reservoir Computing
**Source:** Optics Express (2012)
**DOI:** 10.1364/OE.20.022783
**Authors:** Francois Duport, Bendix Schneider, Anteo Smerieri, Marc Haelterman, Serge Massar
**Institution:** Université Libre de Bruxelles

## Core Claim
A semiconductor optical amplifier (SOA) in a delay loop implements reservoir computing — a form of recurrent neural network where only the output weights are trained. Demonstrated spoken digit recognition at 0.8% word error rate.

## Architecture
- Reservoir: SOA + delay fiber loop (~100ns delay) + mask modulation
- Input: single node, time-multiplexed into N virtual nodes via mask
- Nonlinearity: SOA gain saturation
- Training: only output weights (linear regression) — reservoir fixed
- No backpropagation into the reservoir

## Connection to QRI
This is the closest prior art to QRI's resonator-as-computation concept:
- Delay loop ↔ resonator round trip: both are recurrent optical systems
- SOA saturation ↔ VCSEL threshold: both provide nonlinearity at boundary
- Virtual nodes via time-multiplexing ↔ spatial modes via Hermite-Gaussian basis

## Key Difference
Reservoir computing trains ONLY output weights. The reservoir (delay loop / resonator) is random and fixed — its parameters are not trained. QRI trains the resonator itself (Δn(x,y) = the weight matrix IS the resonator medium). This is a fundamentally deeper level of optimization.

Also: SOA requires active gain (power hungry, noisy). QRI resonator is passive (PTR glass, no gain element).

## Citation in QRI Architecture
Establishes optical delay-loop reservoir as prior recurrent optical computing. QRI extends this by: (1) training the reservoir medium itself (not just output weights), (2) passive resonator (no SOA), (3) spatial mode multiplexing (not time-multiplexing), (4) gradient-based training (not linear regression).
