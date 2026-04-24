.PHONY: all check crosscheck performance economics pdf clean help

all: check crosscheck performance economics

check:
	@echo "Running architecture crosscheck..."
	@python3 analyze/arch_crosscheck.py --output table

crosscheck:
	@echo "Generating crosscheck report..."
	@python3 analyze/arch_crosscheck.py --output json > /tmp/crosscheck.json
	@echo "✓ Crosscheck complete"

performance:
	@echo "Generating performance scenarios..."
	@python3 analyze/performance_update.py --output table

economics:
	@echo "Running economic analysis..."
	@python3 analyze/economic_analysis.py --years 5 --output table | head -50

pdf: check crosscheck performance economics
	@echo "Generating PDF report..."
	@python3 analyze/build_pdf_report.py

clean:
	@rm -f /tmp/qri_complete.md /tmp/crosscheck.json
	@rm -f QRI_Complete_Summary_*.pdf QRI_Complete_Summary_*.html
	@echo "✓ Cleaned"

help:
	@echo "QRI Makefile Targets:"
	@echo "  make all          - Run all analyses"
	@echo "  make check        - Architecture crosscheck"
	@echo "  make performance  - Performance comparison"
	@echo "  make economics    - Economic analysis"
	@echo "  make pdf          - Generate complete PDF summary"
	@echo "  make clean        - Clean generated files"

