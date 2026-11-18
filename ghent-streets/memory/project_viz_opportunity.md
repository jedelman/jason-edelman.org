---
name: Interactive visualization opportunity
description: Norfolk open data pipeline enables interactive charts for the Ghent Streets campaign
type: project
---

The Norfolk open data pipeline (data.norfolk.gov, Socrata API) gives us parcel-level data suitable for interactive visualizations. Noted as a future build.

**Why:** Real FY2026 assessment data, 6-year Colley appreciation trend, permit/violation history — all structured data that tells a compelling story visually.

**Potential charts:**
- Colley Ave commercial vs. residential AV trend line (FY21–FY26) — the PCO appreciation curve
- Colonial vs. Colley bar chart: 1.4% vs. 46% commercial share — single most damning comparison
- Permit status donut: 41% expired, showing the CUP barrier in action
- Assessed value scatter: each parcel as a dot, commercial vs. residential by street
- Year-over-year appreciation heatmap by block

**Tech options:**
- Observable Plot or Chart.js — static embed in policy brief pages
- Vega-Lite JSON specs committed alongside the HTML (reproducible)
- D3 if more interactivity needed
- All data already in data/output/ CSVs — ready to wire up

**How to apply:** When building future briefs or a data page, wire the hcg2_summary.json and colley_multiyear.csv into client-side charts. A `data.html` page with embedded charts would be a strong public-facing addition to the site.
