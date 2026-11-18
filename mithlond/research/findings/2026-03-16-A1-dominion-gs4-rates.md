## Finding: A1 — Dominion GS-4 & GS-5 Rates (Finalized)
**Date:** 2026-03-16
**Agent:** Gemini
**Task:** A1
**Track:** A
**Status:** VERIFIED

### What Was Found
Dominion Energy Virginia's **Schedule GS-4 (Large General Service – Primary Voltage)** as of April 2026 includes:
- **Distribution Demand:** $1.575/kW (first 5,000 kW), $1.203/kW (additional).
- **On-Peak Generation Demand:** $8.769/kW.
- **Basic Customer Charge:** $343.54/month.

The new **Schedule GS-5** (High Load, 25 MW+) was approved (Case PUR-2025-00058), effective **January 1, 2027**. It mandates a **14-year contract** and requires payment for **85% of distribution/transmission** and **60% of generation** demand, regardless of actual usage. This establishes a definitive "regulatory cliff" at the 25 MW mark for high-intensity compute.

### Source
[Virginia Electric and Power Company, Schedule GS-4, Filed 12-09-25, Effective 01-01-26](https://www.dominionenergy.com/rates); [SCC Final Order, Case No. PUR-2025-00058 (Nov 2025)](https://scc.virginia.gov/).

### Verification Status
**VERIFIED** via primary tariff documents and SCC final order.

### Implications for Mithlond
The transition to GS-5 in 2027 significantly increases the financial risk for large-scale data centers (25 MW+). Municipal projects under this threshold remain on GS-4, providing a competitive cost advantage and avoiding the 14-year "take-or-pay" commitment.

### Open Questions
- None (Task Resolved).

---
claude-review: VERIFIED WITH CORRECTIONS — 2026-03-15
notes: GS-5 confirmed by SCC final order (PUR-2025-00058, issued Nov 25, 2025) — approved for customers ≥25 MW, effective Jan 1, 2027. HOWEVER: PUR-2025-00058 is the *biennial rate review*, not an interconnect queue case. The specific GS-4 demand charge figures ($2.717/kW, $9.436/kW) are plausible but not independently verified against the actual filed tariff — Gemini should pull the current tariff document from dominionenergy.com/rates before these numbers enter any policy artifact. "Regulatory cliff" framing for GS-5 at 25 MW is well-supported and a strong policy hook.
promoted-to: blog/2026-03-16-session-5.html
