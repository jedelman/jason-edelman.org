# Mithlond — Research Task Tracker

Canonical task list. Both Gemini and Claude read and write this file.

**Task lifecycle:** `TODO` → `IN_PROGRESS` → `DONE` | `BLOCKED`

When Gemini completes a task: (1) write finding to `research/findings/YYYY-MM-DD-<slug>.md`, (2) update status here to `DONE` with a link to the finding file, (3) commit and push both files together.

When Claude reviews a finding: promote verified content to `blog/` or `briefs/`, update the finding file's `claude-review` field, mark any follow-on tasks.

---

## Track A — Power & Grid

| ID | Task | Status | Finding |
|----|------|--------|---------|
| A1 | Dominion GS-4 rate schedule — extract demand charge per kW, energy rate, riders | TODO | — |
| A2 | Brambleton Substation — confirm Parcel ID 04337700 via Norfolk GIS; get zoning + ownership | TODO | — |
| A3 | SNA RCR completion status — confirm "~80% complete" figure with source | TODO | — |
| A4 | Dominion interconnect queue — sub-100 MW customers: same 20-year bottleneck? | TODO | — |

## Track B — Buildings & Vacancy

| ID | Task | Status | Finding |
|----|------|--------|---------|
| B1 | 440 Monticello Ave — confirm ownership/REO status, lease rate, floor plates via LoopNet/Norfolk Assessor | TODO | — |
| B2 | Identify 1–2 additional building candidates (vacancy >30%, near SNA fiber, outside FEMA AE zone) | TODO | — |
| B3 | FEMA flood zone check — 3800 Village Ave, 440 Monticello, Dominion Tower | TODO | — |
| B4 | 440 Monticello $45M loan figure — verify via county assessor or CoStar public data | TODO | — |

## Track C — Legal & Regulatory

| ID | Task | Status | Finding |
|----|------|--------|---------|
| C1 | DEQ APG-576 — final BACT outcome; any Hampton Roads orgs in the comment record? | TODO | — |
| C2 | Virginia DCRSUT budget status — did special session resolve the exemption? Current law? | TODO | — |
| C3 | SNA Comprehensive Agreement — locate document; confirm Article VIII open access language | TODO | — |
| C4 | BVU Authority enabling legislation — identify statutory provisions enabling public broadband/utility | TODO | — |

## Track D — Market & Operators

| ID | Task | Status | Finding |
|----|------|--------|---------|
| D1 | 3800 Village Ave and Corporate Landing — current operators, announced expansions since late 2024 | TODO | — |
| D2 | Any new data center permit applications in Hampton Roads filed since Jan 2026 | TODO | — |

## Track E — Elected Officials

| ID | Task | Status | Finding |
|----|------|--------|---------|
| E1 | Sen. Louise Lucas — committee assignments, recent statements on economic dev or data centers, relevant 2025-26 bills | TODO | — |
| E2 | Hampton Roads delegation — identify members on Finance and Commerce and Labor committees | TODO | — |

---

## Blocked / Needs Offline Fetch

These endpoints are blocked in Claude's environment. Gemini should attempt native fetch:

| ID | Endpoint | Notes |
|----|----------|-------|
| X1 | data.norfolk.gov/resource/bnrb-u445.json | Socrata permits API; filter on permit type for generators/data centers |
| X2 | data.virginia.gov | Statewide permits |
| X3 | scc.virginia.gov — PUR-2024-00184 | Appalachian Voices testimony PDF |
| X4 | scc.virginia.gov — PUR-2025-00058 | Consumer Counsel brief PDF |

---

*Last updated: 2026-03-15 by Claude*
