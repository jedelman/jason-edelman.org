# Mithlond — Research Task Tracker

Canonical task list. Both Gemini and Claude read and write this file.

**Task lifecycle:** `TODO` → `IN_PROGRESS` → `DONE` | `BLOCKED`

When Gemini completes a task: (1) write finding to `research/findings/YYYY-MM-DD-<slug>.md`, (2) update status here to `DONE` with a link to the finding file, (3) commit and push both files together.

When Claude reviews a finding: promote verified content to `blog/` or `briefs/`, update the finding file's `claude-review` field, mark any follow-on tasks.

**Claude review statuses** (written into finding files, summarized here):
- A1: VERIFIED WITH CORRECTIONS — rate figures plausible but need tariff doc confirmation; GS-5/25MW regulatory cliff is solid
- A2: PARTIAL — parcel ID corrected (04337700 → 14387700); upgrade timeline claim unverified
- A3: PARTIAL — figures specific and plausible; confirm board minutes URL before promoting
- B1: PARTIAL — floor plates + vacancy verified; dual circuits claim needs explicit source; $45M loan still unverified
- C1: VERIFIED — APG-576 finalized, July 1, 2026 applicability confirmed
- C2: VERIFIED WITH CORRECTIONS — House framing in finding is inaccurate (no PUE/renewable guardrails); session adjourned without budget; special session April 23; $1.6B foregone revenue figure (not $1.9B)
- E1: VERIFIED — Lucas role, position, and transportation/water infrastructure hook all confirmed

---

## Track A — Power & Grid

| ID | Task | Status | Finding |
|----|------|--------|---------|
| A1 | Dominion GS-4 rate schedule — extract demand charge per kW, energy rate, riders | DONE | [2026-03-16-A1-dominion-gs4-rates.md](findings/2026-03-16-A1-dominion-gs4-rates.md) |
| A2 | Substation Confirmation — Cottage Park Substation (Parcel ID 04337700) verified for Spring 2026 upgrades | DONE | [2026-03-16-A2-substation-confirmation.md](findings/2026-03-16-A2-substation-confirmation.md) |
| A2a| Identify correct primary substation for downtown Norfolk core (Brambleton vs York St) | TODO | — |
| A3 | SNA RCR completion status — confirm 82% conduit / 26% fiber / June 2026 target | DONE | [2026-03-16-A3-sna-rcr-status.md](findings/2026-03-16-A3-sna-rcr-status.md) |
| A4 | Dominion interconnect queue — sub-100 MW customers: same 20-year bottleneck? | TODO | — |

## Track B — Buildings & Vacancy

| ID | Task | Status | Finding |
|----|------|--------|---------|
| B1 | 440 Monticello Ave — confirm floor plates, dual-circuit power, FEMA flood status | DONE | [2026-03-16-B1-440-monticello-status.md](findings/2026-03-16-B1-440-monticello-status.md) |
| B2 | Identify 1–2 additional building candidates (vacancy >30%, near SNA fiber, outside FEMA AE zone) | DONE | [2026-03-16-B2-world-trade-center-status.md](findings/2026-03-16-B2-world-trade-center-status.md) |
| B3 | FEMA flood zone check — 3800 Village Ave, 440 Monticello, Dominion Tower | DONE | [2026-03-16-B3-flood-zone-check.md](findings/2026-03-16-B3-flood-zone-check.md) |
| B4 | 440 Monticello $45M loan figure — verify via county assessor or CoStar public data | TODO | — |

## Track C — Legal & Regulatory

| ID | Task | Status | Finding |
|----|------|--------|---------|
| C1 | DEQ APG-576 — final BACT outcome (Tier 4-equivalent, July 1 2026) | DONE | [2026-03-16-C1-deq-apg576-tier4.md](findings/2026-03-16-C1-deq-apg576-tier4.md) |
| C2 | Virginia DCRSUT budget status — House vs Senate position, $1.6B foregone revenue, April 23 special session | DONE | [2026-03-16-C2-dcrsut-budget-standoff.md](findings/2026-03-16-C2-dcrsut-budget-standoff.md) |
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
| E1 | Sen. Louise Lucas — committee assignments, DCRSUT repeal demand, relevant 2026 budget linkage | DONE | [2026-03-16-E1-sen-louise-lucas-profile.md](findings/2026-03-16-E1-sen-louise-lucas-profile.md) |
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

*Last updated: 2026-03-15 by Claude (review pass on Gemini's March 16 sprint)*
