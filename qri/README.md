# Quantum Resonator Inference

First-principles derivation of a coherent all-optical resonator that learns and executes token inference.

## What This Is

This is not an implementation project. It's a derivation project. The question is: what does physics demand as the natural architecture for optical token inference? We start from first principles — Maxwell's equations, information theory, thermodynamics — and derive upward.

Adjacent to [Glass Brain](https://github.com/jedelman/pure-light-inference-device), which maps a known digital architecture (RetNet) into optics. This project asks what architecture the physics demands.

## Repo Structure

```
conversations/          work session transcripts and summaries
architecture.md         architectural spec — every decision justified
citations/              papers cited, full PDFs where possible
properties.toml         material properties, ALL with citation
parameters.toml         design parameters, ALL with rationale
Makefile                build system
generate_sysdoc.py      main entry point — assembles system documentation
design/                 renderers for design documents
renders/                render output directory
```

## Conventions

- **properties.toml**: Every entry requires `cite = "Author Year, DOI"`. No undocumented values.
- **parameters.toml**: Every entry requires a `# Rationale` comment. No arbitrary numbers.
- **architecture.md**: Every architectural decision requires physics justification.
- **conversations/**: Session transcripts stored as `YYYY-MM-DD-slug.md`.

## Build

```bash
make           # assemble full system doc → renders/sysdoc.md
make validate  # check properties and parameters only
make clean     # clear render output
```

## Status

2026-04-19: Scaffold. First-principles derivation not yet begun.
