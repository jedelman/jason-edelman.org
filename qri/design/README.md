# Design Renderers

This directory contains scripts that render system design documents into output formats (PDF, HTML, SVG, etc.).

Outputs go to `../renders/`.

## Convention

Each renderer is a standalone Python script:
- `render_<component>.py` → `../renders/<component>.*`

Renderers are called by `generate_sysdoc.py` or directly.
