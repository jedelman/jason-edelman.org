# GEMINI.md — Mithlond Research Assistant

This file orients Gemini CLI to the Mithlond project and defines its role in the two-agent research workflow.

---

## What This Project Is

**Mithlond** applies the commons framework to data center infrastructure in Hampton Roads, Virginia. We research and advocate for community ownership of compute, environmental accountability, and social equity in AI infrastructure — focused on Norfolk and the broader Hampton Roads region.

Three working thesis pillars:
1. **Bioregional Sovereignty over Compute** — Municipalities can own/operate GPU compute using existing legal structures (SNA, IDA, utility district). Virginia law allows it. Barrier is political will and information asymmetry.
2. **Environmental Accountability** — Hampton Roads data centers externalize costs onto a flood-stressed, majority-Black region. No CBAs exist. Norfolk subsides ~4.5mm/year.
3. **Social Equity for the AI Era** — Who owns the infrastructure, who captures the value, who bears the cost.

Site: https://jedelman.github.io/mithlond  
Repo: https://github.com/jedelman/mithlond  
Research Logs (Google Doc): https://docs.google.com/document/d/1IlkgmarullMJWUDUJTr-sj3A2OOx5ON33_Fvia3ZO9Y/edit

---

## Two-Agent Architecture

| Agent | Role | Output Surface |
|-------|------|----------------|
| **Gemini (you)** | Research sprints, web fetch, synthesis of public records | Mithlond Research Logs Google Doc |
| **Claude** | Fact-flagging, synthesis, GitHub commits, policy artifacts | GitHub repo (blog/, briefs/, data/) |

Jason handles copy-paste between your output and the Research Logs doc. You do not push to GitHub directly. Write for an auditor, not a reader — Claude reviews before anything enters the public record.

---

## Standards

- **Anti-slop, pro-reality.** No filler, no hedging theater.
- **Verification standard:** Every specific fact — document numbers, parcel IDs, financial figures, regulatory citations, agreement language — must be explicitly flagged as VERIFIED (with URL/source) or UNVERIFIED. Do not present unverified specifics as established fact.
- **Research first, advocacy second.** Dead ends and corrections are worth documenting.
- **Source discipline:** Prefer primary sources (DEQ, SCC, JLARC, Norfolk GIS, Dominion rate schedules, SNA documents) over secondary coverage.

---

## Output Format — Research Log Entry

Use one entry per distinct finding. Do not bundle unrelated findings.

```
## Research Log Entry
**Date:** YYYY-MM-DD
**Track:** [A / B / C / D / E]
**Status:** VERIFIED | UNVERIFIED | PARTIAL

### Finding
[1–3 sentences. What was found.]

### Source
[Specific URL, document number, or "interpolated from X" if inferred.]

### Verification Status
[What is confirmed vs. what needs ground-truth check before policy use.]

### Implications for Mithlond
[How this affects the policy brief, open letter, or a specific track.]

### Open Questions
[What this finding raises that still needs research.]
```

---

## Research Tracks

### Track A — Power & Grid
**Goal:** Map Dominion power infrastructure for downtown Norfolk; identify grid entry points for municipal compute.

**Established:**
- Primary substation: Brambleton (Parcel ID 04337700 — UNVERIFIED, needs Norfolk GIS confirmation)
- York Street and Front Street as secondary hubs
- Schedule GS-4 (Primary Voltage) creates ~$10k/year demand charge savings per 500kW unit — UNVERIFIED, directional logic sound, needs verification against Dominion public rate schedules
- SCC Case PUR-2025-00058: Dominion interconnect queue for customers >100 MW; applications submitted 2025 may wait up to 20 years

**Open:**
- Actual GS-4 rate schedule numbers (pull from dominionenergy.com/rates)
- Queue position timeline for sub-100 MW customers (not subject to same bottleneck?)
- Brambleton parcel ID confirmation via norfolk.gov GIS

---

### Track B — Buildings & Vacancy
**Goal:** Identify viable candidate buildings for modular colocation (5,000–15,000 sqft).

**Established:**
- **440 Monticello Ave (Wells Fargo Center):** REO/Default, 59% leased, 24,500 SF floor plates — UNVERIFIED, verify via CoStar/LoopNet/Norfolk EDA
- **Dominion Tower:** ~130k SF vacancy — UNVERIFIED
- **3800 Village Ave:** 99,962 sqft total; EdgeConneX occupies portion; remainder marketed for "Telecom Hotel Data Hosting" by Cushman & Wakefield | Thalhimer (Dec 2024) — VERIFIED via search
- **3700 Village Ave:** 150,000 sqft industrial, available May 2025 — VERIFIED via search

**Open:**
- 1–2 additional candidates beyond 440 Monticello and Dominion Tower; criteria: fiber proximity, structural load capacity, flood zone status
- $45M loan / 59% lease rate on 440 Monticello needs CoStar or county assessor verification
- Flood zone status: 3800 Village Ave + candidates vs VIMS 2050 sea level projections

---

### Track C — Legal & Regulatory
**Goal:** Map Virginia legal structures for municipal compute ownership; track DEQ permitting landscape.

**Established:**
- **IDA (§15.2-4905):** Can own/finance via revenue bonds but "shall not have power to operate any facility as a business other than as lessor" — hard statutory limit
- **Southside Network Authority (SNA):** Cleanest model for public compute; SNA Regional Connectivity Ring (RCR) ~80% complete as of March 2026 — UNVERIFIED, needs SNA/city confirmation
- **BVU Authority (Bristol, VA):** Municipal utility with broadband — nonprofit compute precedent
- **DEQ APG-576:** Comment period was March 9–April 8, 2026 (may be closed). Revised BACT: Tier 4-equivalent for data center generators. Applies July 1, 2026+.
- **Virginia data center tax exemption (DCRSUT):** ~$1.6B/year FY2025 (JLARC). Senate accelerated sunset to Jan 1, 2027.
- **Hampton Roads air permits:** Zero dedicated data center air permits in Tidewater region as of Jan 29, 2026 DEQ table (Northern VA has 155+).

**Open:**
- SNA Article VIII open access language — pull actual Comprehensive Agreement before citing
- DEQ APG-576 docket outcome — what BACT was finalized?
- Virginia budget status on DCRSUT: did special session resolve the FY2025-26 exemption?
- Three viable legal paths need attorney review: (1) IDA + CBA lease, (2) SNA mandate extension, (3) new Hampton Roads Compute Authority legislation

---

### Track D — Market & Operators
**Goal:** Map existing data center operators in Hampton Roads; identify market entry dynamics.

**Established:**
- **3800 Village Ave (Globalinx/EdgeConneX):** Active, expanding
- **Corporate Landing (Virginia Beach):** Existing facility
- **Virginia Beach:** Cable landing hub (subsea cables), not compute hub
- SNA RCR ~80% complete — UNVERIFIED

**Open:**
- Who are the active operators at 3800 Village Ave and Corporate Landing?
- Any announced deals or permit applications filed since January 2026?
- Competitive positioning: what would differentiate a public compute offering?

---

### Track E — Elected Officials & Advocacy
**Goal:** Identify leverage points in the Virginia General Assembly and Hampton Roads delegation.

**Established:**
- Sen. Louise Lucas: priority target for briefing memo connecting DCRSUT sunset to urban revenue strategy
- Sen. Richard Stuart (R-VA): voted to end exemption — "This ain't going to slow this train down one iota"
- National wave: IL, AZ, MN have all moved on data center tax reform

**Open:**
- **Priority:** Briefing memo for Sen. Louise Lucas — connect DCRSUT sunset to Hampton Roads municipal compute strategy
- List of Hampton Roads delegation members on relevant committees (Finance, Commerce and Labor)
- Any bills filed in the 2026 session directly relevant to data center accountability or municipal broadband/compute

---

## Current Task Queue

Tasks in priority order. Complete one track at a time. Output each finding as a Research Log Entry.

### High Priority

**[A1] Dominion GS-4 Rate Schedule**
Fetch current Schedule GS-4 (Primary Voltage) from dominionenergy.com or SCC filings. Extract demand charge per kW, energy rate, and any relevant riders. Goal: replace the UNVERIFIED "$10k/year per 500kW" figure with actual numbers.

**[B1] Norfolk GIS — Brambleton Substation**
Confirm Parcel ID 04337700 is Brambleton Substation via Norfolk's GIS portal (norfolk.gov/gis or norfolk-gis.maps.arcgis.com). Also check zoning and ownership record.

**[B2] 440 Monticello Ave Verification**
Search LoopNet, CoStar (public-facing), and Norfolk City Assessor's real estate records for 440 Monticello Ave. Confirm: ownership/REO status, lease rate, floor plate sizes, assessed value.

**[C1] DEQ APG-576 Outcome**
Check DEQ website for final outcome of the APG-576 comment period (closed April 8, 2026 or possibly still open). What BACT was adopted? Did any Hampton Roads organizations file comments?
URL: https://www.deq.virginia.gov and https://townhall.virginia.gov

**[C2] Virginia Budget / DCRSUT Status**
Search for current status of Virginia data center tax exemption (DCRSUT) after the March 14 budget deadline. Did the General Assembly pass a budget in special session? Did the Senate-passed sunset language survive?

### Medium Priority

**[E1] Louise Lucas Briefing Memo — Research Support**
Pull publicly available information on Sen. Louise Lucas's committee assignments, recent statements on economic development or data centers, and any relevant bills she has sponsored or opposed in the 2025-2026 session.

**[B3] Additional Building Candidates**
Identify 1–2 additional downtown Norfolk buildings beyond 440 Monticello and Dominion Tower that could support 5,000–15,000 sqft modular colocation. Criteria: (1) vacancy rate >30%, (2) proximity to fiber (SNA ring), (3) not in a FEMA AE flood zone, (4) structural load capacity plausible (industrial or Class A office).

**[D1] Active Hampton Roads Data Center Operators**
Who currently operates at 3800 Village Ave and Corporate Landing? Any announced expansions or new entrants since late 2024? Check LoopNet, Cushman & Wakefield Thalhimer listings, Norfolk/Virginia Beach EDA press releases.

**[A2] SNA Regional Connectivity Ring Status**
Confirm current completion status of the SNA RCR. Primary source: southsidenetwork.com or Virginia Business / local press. Is the "80% complete" figure current and sourced?

### Lower Priority (research support only)

**[C3] SNA Comprehensive Agreement**
Locate the actual SNA Comprehensive Agreement (the document governing SNA operations and member rights). Confirm whether Article VIII contains open access language, and if so, what it says exactly.

**[C4] BVU Authority Enabling Legislation**
Pull the Virginia enabling act for BVU Authority (Bristol). Identify the statutory provisions that allow it to operate broadband as a public utility. This is the legal template for a Hampton Roads Compute Authority.

**[D2] FEMA Flood Zone Status for Key Sites**
Check FEMA FIRM maps for: 3800 Village Ave, 440 Monticello Ave, Dominion Tower address. Report flood zone designation (AE, X, etc.) and base flood elevation.

---

## Known API / Fetch Blocks

These endpoints are blocked for Claude's bash environment. Route to your native fetch capabilities:

| Endpoint | Block Type | Notes |
|----------|-----------|-------|
| data.norfolk.gov/resource/bnrb-u445.json | PERMISSIONS_ERROR | Socrata permits API; `$where` filter on permit type |
| data.virginia.gov | PERMISSIONS_ERROR | Statewide permits |
| scc.virginia.gov PDFs | ROBOTS_DISALLOWED | PUR-2024-00184, PUR-2025-00058 |

If you can fetch these, do so and structure as Research Log Entries.

---

## Key Sources

- **JLARC:** jlarc.virginia.gov — authoritative on Virginia incentive spending
- **DEQ Air Permits:** https://www.deq.virginia.gov/news-info/shortcuts/permits/air/issued-air-permits-for-data-centers
- **SCC Docket Search:** scc.virginia.gov/docketsearch — cases PUR-2024-00184, PUR-2025-00058
- **Norfolk GIS:** norfolk.gov/gis
- **Norfolk Assessor:** https://www.norfolk.gov/2304/Real-Estate
- **Dominion Rates:** dominionenergy.com/rates (or SCC electric rate filings)
- **SNA:** southsidenetwork.com
- **Virginia Townhall (APG-576):** townhall.virginia.gov
- **VIMS Sea Level:** https://www.vims.edu/research/departments/physical/programs/sealevel/

---

## Contacts (Do Not Contact — Research Reference Only)

- Nate Benforado, Southern Environmental Law Center — utility regulation
- Paige Wesselink, Sierra Club Virginia Chapter — data center energy policy
- Tim Cywinski, Sierra Club Virginia

---

*This file is maintained by Claude. Last updated: 2026-03-15.*
