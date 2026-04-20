#!/usr/bin/env python3
"""
generate_sysdoc.py
Assembles full system documentation from repo artifacts.
Main entry point for the build system.

Usage:
    python generate_sysdoc.py              # Full doc generation
    python generate_sysdoc.py --validate-only   # Validate properties/parameters only
"""

import argparse
import tomllib
import sys
from pathlib import Path
from datetime import date

ROOT = Path(__file__).parent


def load_and_validate_toml(path: Path) -> dict:
    """Load TOML and verify required fields."""
    with open(path, "rb") as f:
        data = tomllib.load(f)
    return data


def validate_properties(props: dict) -> list[str]:
    """Ensure every material entry has a cite field."""
    errors = []
    for material, values in props.items():
        if not isinstance(values, dict):
            continue
        if "cite" not in values:
            errors.append(f"properties.toml [{material}]: missing 'cite' field")
        if not values.get("cite", "").strip():
            errors.append(f"properties.toml [{material}]: 'cite' is empty")
    return errors


def validate_parameters(params: dict) -> list[str]:
    """Warn on TBD values — these are allowed but should be flagged."""
    warnings = []
    for section, values in params.items():
        if not isinstance(values, dict):
            continue
        for key, val in values.items():
            if val == "TBD":
                warnings.append(f"parameters.toml [{section}.{key}]: TBD (not yet derived)")
    return warnings


def assemble_sysdoc(props: dict, params: dict) -> str:
    """Render a markdown system document from repo artifacts."""
    doc = f"""# Quantum Resonator Inference — System Documentation

*Generated: {date.today().isoformat()}*

---

## Architecture

"""
    arch_path = ROOT / "architecture.md"
    if arch_path.exists():
        doc += arch_path.read_text()
    else:
        doc += "*architecture.md not found*\n"

    doc += "\n\n---\n\n## Material Properties\n\n"
    for material, values in props.items():
        if not isinstance(values, dict):
            continue
        doc += f"### `{material}`\n"
        if "description" in values:
            doc += f"*{values['description']}*\n\n"
        for k, v in values.items():
            if k not in ("description", "cite"):
                doc += f"- **{k}**: {v}\n"
        doc += f"\n> Cite: {values.get('cite', 'MISSING')}\n\n"

    doc += "---\n\n## Design Parameters\n\n"
    for section, values in params.items():
        if not isinstance(values, dict):
            continue
        doc += f"### `{section}`\n"
        for k, v in values.items():
            if k == "# Rationale":
                continue
            doc += f"- **{k}**: `{v}`\n"
        doc += "\n"

    return doc


def main():
    parser = argparse.ArgumentParser(description="Assemble system documentation.")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()

    props = load_and_validate_toml(ROOT / "properties.toml")
    params = load_and_validate_toml(ROOT / "parameters.toml")

    errors = validate_properties(props)
    warnings = validate_parameters(params)

    if errors:
        print("ERRORS:")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)

    if warnings:
        print("WARNINGS (TBD values):")
        for w in warnings:
            print(f"  ⚠ {w}")

    if args.validate_only:
        print("Validation complete.")
        return

    doc = assemble_sysdoc(props, params)
    out = ROOT / "renders" / "sysdoc.md"
    out.write_text(doc)
    print(f"System doc written to {out}")


if __name__ == "__main__":
    main()
