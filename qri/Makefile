# Quantum Resonator Inference — Build System

.PHONY: all doc validate clean

all: doc

doc:
	python generate_sysdoc.py

validate:
	python generate_sysdoc.py --validate-only

clean:
	rm -rf renders/*.pdf renders/*.html renders/*.md
	@echo "Renders cleaned."

