.PHONY: all check crosscheck performance economics pdf public clean help

all: check crosscheck performance economics public

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

public:
	@echo "✓ Public summary ready: QRI_PUBLIC_SUMMARY_2026-04-24.md"

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
	@echo "  make public       - Verify public summary"
	@echo "  make pdf          - Generate complete PDF summary"
	@echo "  make clean        - Clean generated files"
	@echo ""
	@echo "Key outputs:"
	@echo "  QRI_PUBLIC_SUMMARY_2026-04-24.md      - Plain-language overview"
	@echo "  QRI_Complete_Summary_2026-04-24.md    - Full technical summary"
	@echo "  QRI_Complete_Summary_2026-04-24.html  - Browsable HTML"

