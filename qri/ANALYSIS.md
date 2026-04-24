# QRI Analysis Suite Quick Reference

Run any script to verify architecture decisions from first principles.

## One-Liners

```bash
# Economic: QRI vs. hyperscale
python analyze/economic_analysis.py

# Dimensional: all scales consistent?
python analyze/dimensions.py

# Architecture: ARCH-1 through ARCH-10 mutually consistent?
python analyze/arch_crosscheck.py

# Physics: Wave RNN, coherence, SNR, nonlinearity
python analyze/derivations.py

# Model: Does 1.23M param model fit in hologram?
python analyze/model_architecture.py

# JSON output (for dashboards, CI/CD)
python analyze/economic_analysis.py --output json
```

## Key Findings

| Finding | Value | Source |
|---------|-------|--------|
| Capital cost advantage | 130-186× | `economic_analysis.py` |
| Payback period | 1.7 months | `economic_analysis.py` |
| Coherence margin | 7.5× | `dimensions.py` |
| Mode capacity margin | 14.5× | `dimensions.py` |
| Architecture consistency | 10/10 checks pass | `arch_crosscheck.py` |
| SNR vs. target | 40dB vs. 38dB (+2dB) | `derivations.py` |
| Model fits hologram | 49% utilization | `model_architecture.py` |

## Integration

Add to Makefile:

```makefile
analyze:
	python analyze/economic_analysis.py --output json > renders/economic.json
	python analyze/dimensions.py --output json > renders/dimensions.json
	python analyze/arch_crosscheck.py --output json > renders/arch_check.json
	python analyze/derivations.py --output json > renders/derivations.json
	python analyze/model_architecture.py --output json > renders/model.json

.PHONY: analyze
```

## Documentation

See `analyze/README.md` for comprehensive guide, data flow, and extending instructions.

---

**All scripts test pass. Ready for production.**
