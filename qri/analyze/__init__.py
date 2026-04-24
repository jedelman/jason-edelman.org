"""
QRI Analysis Scripts

Reproducible analysis tools derived from conversations and design documents.

Modules:
- economic_analysis: QRI vs. hyperscale cost comparison
- dimensions: Dimensional analysis and scale factor verification
- arch_crosscheck: Architecture consistency validation

Usage:
    python -m analyze.economic_analysis [--years 5] [--output json|table]
    python -m analyze.dimensions [--output json|table]
    python -m analyze.arch_crosscheck [--verbose] [--output json|table]
"""

__version__ = "0.1.0"
__all__ = ["economic_analysis", "dimensions", "arch_crosscheck"]
