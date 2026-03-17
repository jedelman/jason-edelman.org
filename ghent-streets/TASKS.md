# Ghent Zoning Reform — TASKS.md

Campaign site for HC-G2 zoning text amendment in Norfolk, Virginia.
Repo: https://github.com/jedelman/ghent-zoning-reform
Live at: jedelman.github.io/ghent-zoning-reform (enable GitHub Pages: Settings → Pages → Branch: main, root /)

---

## BLOCKING: Must Fix Before Any Public Hearing Use

These are factual or legal claims that could be disproved in the room and damage credibility.

- [x] **Verify "blank cell = prohibited"** — CONFIRMED. Verbatim table key in every Norfolk use table: "P = PERMITTED BY RIGHT / C = ALLOWED ONLY WITH APPROVAL OF A CONDITIONAL USE PERMIT / BLANK CELL = PROHIBITED." Confirmed in two official City Council ordinance amendment PDFs (ADU amendment, self-storage amendment). Cited verbatim in Brief 01 Section I. Source: data/sources/norfolk-zoning-amendment-adu-2023.pdf

- [ ] **Verify 7-Eleven and Harris Teeter are actually nonconforming** — Not yet verified. Until confirmed, do not assert "nonconforming use" as fact in public materials. Check city permit records or call planning dept.

- [x] **Find or replace the ULI citation** — "Ground Floor Activation and Property Value, 2021" does not exist. Replaced in Brief 02 with: ULI *Reshaping the City* (2022) + Matthews Georgia State working paper (2007). Adjacent residential uplift footnote updated to "estimated 3–7%" with honest caveat. Source: data/sources/SOURCES.md

- [x] **Verify plaNorfolk2030 quotes** — Full plan text downloaded and extracted (data/sources/planorfolk2030-comprehensive-plan.txt). Results: Phrase 1 (LU1.2 "development regulations...quality built environment") CONFIRMED verbatim. Phrase 2 ("activating ground floors in historic districts...") NOT IN DOCUMENT — removed. Brief 01 Section VII rebuilt with 5 real verbatim citations (LU1.2, LU1.2.5, N3.1.6, N5.1.2(b), N5.1.12). Note: plaNorfolk2030 superseded by NFK2050 (2025) — check NFK2050 for updated language.

- [x] **Verify the CUP fee range** — CONFIRMED from fee schedule (data/sources/norfolk-planning-fee-schedule-fy2025.pdf, effective July 1, 2024). CUP: **$1,080**. Text amendment: **$915**. All "$5,000+" references updated site-wide to "$1,080 city fee + legal consultants ($3K–$8K typical total)."

- [ ] **Verify Table 3.6.11 actual current cell values** — Still needed. Requires browser access to norfolkva.gov/norfolkzoningordinance/. Cannot be automated (JS-rendered site).

---

## HIGH PRIORITY: Data and Argument Refinement

- [x] **Fix Brief 02 section numbering** — Added "IV-A." prefix to appreciation trend section heading.

- [x] **Fix stale link in Brief 01** — Removed "Coming Soon", updated card title to match published Brief 02 title.

- [x] **Reconcile Colley residential parcel count** — Data confirms 64 is correct (FY22–FY26 all show 64). References section was wrong (said ~114). Fixed references to say ~64, with note that FY21 showed 82 (likely a reclassification event). Body text was already correct.

- [x] **Show the $3.36 billion calculation** — Confirmed from data: $3,359,240,700 total AV across all Ghent PD 61-64 (3,138 parcels). Added references footnote citing the source dataset and calculation.

- [x] **Explain or remove the 817 "activatable proxy" stat** — Added definition in source note: PD 64 parcels, not commercial, acreage < 0.25, improvement value > $0. From analyze.py lines 213-218.

- [x] **Rewrite Section IV-B (permit data) with honest framing** — Rewrote section. Removed overclaim about "operators giving up after approval." Added explicit note on what this data can and cannot establish. Section now labeled "suggests" rather than "proves." Added pointer to Section VI for the further analysis needed to isolate CUP-specific data.

- [x] **Revise or remove the Richmond Fan District comparison** — Removed the Fan District example from Zine 02. Replaced with a general claim about Virginia and national historic districts showing that architectural protection and active ground floors are compatible. Avoids the inaccuracy without requiring a verified substitute example.

- [x] **Soften the unhoused argument** — Rewrote both zine sections. Zine 2 section 5: removed "some of that use will be displaced. That's real." and reframed entirely around active streets = safer for everyone. Changed question heading to avoid framing around displacement. Zine 1 section 5: removed "unhoused individuals concentrate" framing; reframed as eyes-on-the-street safety argument for everyone.

- [x] **Address the "market demand vs. zoning barrier" counter-argument** — Added fifth objection/response to Brief 01 Section IX. Response uses: (a) revealed preference — operators aren't using the CUP at scale; (b) the capital screen argument — CUP filters independent operators, not corporate ones; (c) operator pipeline gap acknowledged honestly; (d) asymmetry argument — if demand doesn't exist, removing the CUP requirement costs nothing; if it does, the upside is fully documented.

---

## RESEARCH TASKS

- [ ] **Check whether Colley PCO pre-existed commercial activity** — Was Colley Avenue commercially active before the PCO designation, or did the PCO create its commercial life? Norfolk planning archives, old Sanborn maps, or a call to Jeremy Sharp would answer this. If the PCO legalized existing uses rather than generating new ones, the precedent argument weakens and needs recalibration.

- [ ] **Pull pre-PCO Colley assessment data (FY18–FY20)** — Extends the appreciation curve before PCO adoption. This is the single most powerful data argument available: before/after AV on the same corridor. Check data.norfolk.gov for FY18/FY19/FY20 dataset IDs. Add to fetch_extended.py if available.

- [ ] **Locate real CUP applications in HC-G2** — The permit dataset (fahm-yuh4) contains all permits. A targeted query for use_class='Commercial' AND type='Zoning' on HC-G2 streets, with manual review of work_type or use_type fields, might isolate actual CUP applications vs. building permits. This is what section IV-B needs to make its argument.

- [ ] **Pull plaNorfolk2030 Land Use Strategies chapter** — Blog post "plaNorfolk2030 Already Supports This" is a planned piece. Before writing it, get the actual text. This document is likely available at norfolk.gov or through the planning department directly. Required to verify the Brief 01 citations and write the blog post with real quotes.

- [ ] **Identify the HC-G2 precise boundary** — Norfolk GIS viewer (norfolkgis.norfolk.gov or similar) should show zoning district boundaries. Screenshot or note the HC-G2 boundary vs. PD 64 boundary and document the gap. If HC-G2 includes or excludes specific blocks that PD 64 doesn't, the parcel count needs adjustment or a more specific caveat.

- [ ] **Identify operator pipeline (Jason-led)** — Who specifically wants to open in HC-G2 and is blocked? Even one or two named operators willing to be quoted or to testify is worth more than all the data in Brief 02 at a public hearing. Task for Jason: canvas property owners with ground-floor vacancies, reach out to operators who recently opened on Colley or 21st Street and ask if they ever considered HC-G2.

---

## Policy Track

### Brief No. 2 — Refinement Pass (see above for specifics)
- [x] Fix section IV-A heading (missing)
- [x] Fix stale Brief 01 cross-link
- [x] Reconcile Colley residential count (64 vs 114)
- [x] Show $3.36B calculation or correct figure
- [x] Explain 817 activatable proxy threshold
- [x] Rewrite IV-B permit section with honest framing
- [ ] Pre-PCO Colley data (FY18–FY20) — strongest available upgrade

### Brief No. 1 — Refinement Pass
- [ ] Verify Table 3.6.11 real cell values (see BLOCKING above)
- [x] Add response to "operators would just use the CUP if demand existed"
- [x] Replace Richmond Fan District example with accurate comparable (in Zine 02)
- [ ] Confirm blank cell = prohibited in general provisions; cite the specific provision
- [ ] Replace/verify ULI citation (see BLOCKING above)
- [ ] Consistent CUP fee ($1,500 vs $5,000) — use verified figure

### Brief No. 3: The ARB and Commercial Use
- [ ] Research Virginia Code § 15.2-2306 (ARB enabling statute — exact scope)
- [ ] Pull Norfolk's ARB ordinance (separate from the zoning ordinance) — what does it say about change-of-use?
- [ ] Confirm: does HC-G2 change-of-use to commercial require ARB sign-off absent any exterior alteration?
- [ ] Case studies: Alexandria Old Town, Fredericksburg Historic District (Virginia examples preferred)
- [ ] Draft policy/brief-03.html

---

## Blog Track

- [ ] "plaNorfolk2030 Already Supports This" — requires actual plan text first (see research tasks)
- [ ] "How to File a Text Amendment Application in Norfolk" — process walkthrough; verify fee schedule
- [ ] "What HC-G1 Can Teach HC-G2" — compare the two Ghent sub-districts; what uses does HC-G1 permit that HC-G2 doesn't?
- [ ] Interview post: residents and operators on what they want (quotes from Jason's network)
- [ ] Fix the Colley PCO origin story — was it commercially active before the overlay? (informs the pco-precedent.html blog post)
- [ ] **"Carytown and Colonial: A Tale of Two Cities"** — Research sprint. Carytown (Richmond, VA) as an out-of-city comparison: dense historic residential neighborhood with active street-level commercial. Research needed: Carytown's zoning designation, whether commercial uses are by-right or overlay, Richmond historic district rules, assessed value data if available. Do NOT write until research is done. Relevant to the "historic districts can support commercial life" argument and the Fan District gap left by Zine 02 section 3 revision.

---

## Zine Track

- [x] Zine No. 2: "A Tale of Two Streets"
- [x] Zine No. 1: Rewrite section 5 (unhoused argument) — done
- [x] Zine No. 2: Rewrite section 3 (Richmond Fan District) — done; also rewrote section 5 (unhoused)
- [x] Zine No. 3: "Your Neighborhood Is Worth More Than This" — economic argument, plain language
- [ ] **Printable PDF of Zine No. 1** — high priority for door-to-door
  - Letter/A4 format, half-sheet booklet fold (8 pages)
  - Print run target: 300 copies

---

## Political / Operational (Jason-led)

- [ ] **Identify operator pipeline** — who wants to open in HC-G2 and is blocked? Names and quotes. This is the gap that data cannot fill.
- [ ] File text amendment application — Jeremy Sharp, (757) 439-4833, jeremy.sharp@norfolk.gov
- [ ] Request ARB agenda slot (30–45 days lead time)
- [ ] Contact Ghent Civic League — present campaign, request endorsement
- [ ] Identify sympathetic Council member (Superward 6 covers Ghent)
- [ ] Plan door-to-door zine distribution in HC-G2
- [ ] Get Colley PCO history from planning staff — when was it adopted, what was the commercial activity like before?

---

## Data Needed / Future Analysis

- [x] HC-G2 parcel data (via Socrata API, PD 64 proxy): 945 parcels, 13 commercial (1.4%)
- [x] Colley Ave assessed values FY21–FY26 (six assessment datasets via API)
- [x] Ghent permits dataset (fahm-yuh4): 151 zoning permits, 52% never completed
- [ ] Pre-PCO Colley baseline: FY18–FY20 assessment datasets (check data.norfolk.gov)
- [ ] CUP-specific permit isolation: requery fahm-yuh4 for use_class='Commercial', type='Zoning' on HC-G2 addresses — isolate actual CUP/use permit applications from building permits
- [ ] HC-G2 precise zoning boundary from Norfolk GIS — quantify PD 64 vs HC-G2 gap
- [ ] Complete list of nonconforming commercial uses in HC-G2 (verify vs CUP-permitted uses)
- [ ] plaNorfolk2030 full text — Land Use Strategies chapter (required before Brief 01 citations can stand)
- [ ] Interactive visualizations — data ready in data/output/ CSVs; see memory/project_viz_opportunity.md

---

## Design / Dev

- [x] Print CSS for zines
- [x] Add canonical link tags
- [ ] Accessibility pass: alt text, color contrast check on amber-gold
- [ ] Verify all internal links are relative and resolve correctly
- [ ] Enable GitHub Pages: Settings → Pages → Branch: main, root /

---

## Content Rules (preserve across sessions)

- **Policy briefs:** cite zoning code sections precisely, use ordinance terminology, anticipate objections
- **Blog:** full argument, named sources, footnotes as superscripts (power-explained pattern)
- **Zines:** eighth-grade reading level, no unexplained jargon, explicitly licensed for free printing
- **Design:** amber-gold (#b07c2a), warm paper (#f3ede0), Cormorant Garamond / Lora / DM Mono
- **Links:** all internal links relative only
- **Index:** keep index.html current when adding any new piece
- **Adversarial standard:** before any piece goes in front of a public body, every factual claim must be source-verifiable and every causal claim must acknowledge alternative explanations

---

## Key References

- Planning staff: Jeremy Sharp, (757) 439-4833, jeremy.sharp@norfolk.gov
- Norfolk Zoning Ordinance: https://www.norfolkva.gov/norfolkzoningordinance/
- Norfolk AIR (parcel/GIS data): https://norfolk.gov/air
- Norfolk open data: https://data.norfolk.gov (Socrata API, apptoken in scripts)
- Key ordinance sections: Table 3.6.11 (HC uses), Table 3.9.21 (PCO uses), § 3.6, § 3.9
- Amendment process: Norfolk Zoning Procedures Manual (Dec. 2023), Section 3.3(B)
- Virginia ARB statute: Virginia Code § 15.2-2306
