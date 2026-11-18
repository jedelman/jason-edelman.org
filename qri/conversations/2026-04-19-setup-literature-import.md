# 2026-04-19 — Setup and Literature Import

## What happened
- Scaffolded repo from scratch: directory structure, architecture.md, properties.toml, parameters.toml, generate_sysdoc.py, Makefile
- Build system tested: validates cite fields (hard error), flags TBD params (warning), generates renders/sysdoc.md
- Pulled quantum optics papers from Notion (Science database)
- Assessed relevance, wrote citation summaries, populated TASKS.md with citation investigation tasks

## Papers found in Notion
1. **ONN Review** — Fu et al. 2024, Light: Sci. & Appl. — HIGH relevance. Field map. 160+ references covering every major ONN approach.
2. **Dual-comb holography** — Vicentini et al. 2021, Nat. Photonics — MEDIUM relevance. Coherent frequency-multiplex field reconstruction. Relevant to token encoding question.
3. **Opto-magnetic CGH** — Makowski et al. 2022, Nat. Commun. — LOW relevance. Display holography with GdFeCo. Noted only.
4. **Quantum bottleneck article** — blank page, skipped.

## Key finding from literature review
The ONN field maps cleanly into two camps:
- **Feedforward spatial** (D2NN, 4f): weights in phase masks, computation = diffraction, nonlinearity = electronic or PCM
- **Integrated guided-wave** (MZI, MRR): weights in phase shifters/ring resonators, computation = interference, scales poorly

**What's missing in the literature:** A resonator-based architecture where the resonator itself IS the computational primitive, not just a component. Hughes et al. 2019 (wave physics as RNN) is closest — add to HIGH priority.

## Decisions
- ONN review and dual-comb paper added to citations/ with relevance assessments
- Opto-magnetic paper added as LOW relevance note (don't chase this thread)
- TASKS.md populated with 14 citation investigation tasks + 5 architecture derivation tasks + 3 infra tasks

## Next session
Recommend starting with ARCH-1 (optical primitive derivation) informed by:
1. Psaltis 1990 (holography in NNs) — historical precedent
2. Hughes 2019 (wave physics as RNN) — theoretical framework
3. Lin 2018 (D2NN) — geometry that's closest to our PTR plate system
