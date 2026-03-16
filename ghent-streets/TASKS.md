# Ghent Zoning Reform — TASKS.md

Campaign site for HC-G2 zoning text amendment in Norfolk, Virginia.
Repo: https://github.com/jedelman/ghent-zoning-reform
Live at: jedelman.github.io/ghent-zoning-reform (enable GitHub Pages: Settings → Pages → Branch: main, root /)

---

## BLOCKING: Must Fix Before Any Public Hearing Use

These are factual or legal claims that could be disproved in the room and damage credibility.

- [ ] **Verify "blank cell = prohibited"** — The entire campaign rests on the claim that blank cells in Table 3.6.11 mean prohibited. Verify this against the Norfolk Zoning Ordinance general provisions (Article 1 or § 1.3 / § 1.4). If Norfolk has a default rule ("any use not listed is prohibited") cite it explicitly in Brief 01. If blank means something else, the argument changes.

- [ ] **Verify 7-Eleven and Harris Teeter are actually nonconforming** — The 2018 ordinance replaced the old code. Did both stores open before 2018? Harris Teeter at 1320 Colonial Ave may have a knowable opening date. If either opened post-2018 via CUP, they are conditionally permitted uses, not nonconforming — and that changes (a) the "only corporate retail survives the CUP" argument, and (b) whether the CUP can actually produce outcomes we endorse. Verify against city permit records or property history.

- [ ] **Find or replace the ULI citation** — "Urban Land Institute, *Ground Floor Activation and Property Value*, 2021" cannot be confirmed as a real ULI publication. Either locate the actual report (ULI.org document search) and verify the 5% residential uplift figure comes from it, or replace with a verifiable citation (Lincoln Institute of Land Policy, NLIHC, academic literature on commercial ground-floor activation and adjacent residential AV). Do not leave a potentially fabricated citation in a document going before a Planning Commission.

- [ ] **Verify plaNorfolk2030 quotes** — Brief 01 section VII contains three provisions attributed to plaNorfolk2030, one in direct quotation marks ("activating ground floors in historic districts to support neighborhood vitality while preserving architectural character"). Locate the actual plan text and confirm these are accurate. If they're paraphrases, remove the quotation marks. Planning staff will have the document.

- [ ] **Verify the CUP fee range** — Zines consistently say "$5,000+"; Brief 01 says "$1,500–$5,000." Pull Norfolk's actual fee schedule (Planning Department fee schedule, norfolk.gov or by calling Jeremy Sharp). Use the real number. If it's $1,500 for most residential-district CUPs, the "$5,000+" claim is vulnerable. If it's higher, document it.

- [ ] **Verify Table 3.6.11 actual current cell values** — Brief 01 uses a reconstructed amendment table. Pull the real table from norfolkva.gov/norfolkzoningordinance/ (browser only). Confirm which uses are blank vs. C vs. P in the current HC-G2 column. Update the amendment language table to match exactly.

---

## HIGH PRIORITY: Data and Argument Refinement

- [ ] **Fix Brief 02 section numbering** — There is a "IV." and a "IV-B." with no "IV-A." heading. The Colley appreciation table section should be labeled "IV-A. Colley Ave Appreciation Trend: FY2021–FY2026" explicitly. Ref section calls it "Section IV-A" — the heading needs to match.

- [ ] **Fix stale link in Brief 01** — The cross-link card at the bottom of brief-01.html says "Policy Brief · No. 2 — Coming Soon." Brief 02 is published. Remove "Coming Soon."

- [ ] **Reconcile Colley residential parcel count** — Brief 02 body says "64 total [residential parcels]." References section says "~114 residential." Determine which is right (64 may be SFD/townhouse only; 114 may include apartments). Add a clarifying note in the references or fix the body text. These cannot both appear in the same document.

- [ ] **Show the $3.36 billion calculation** — This number appears once in the final paragraph of Brief 02 with no source. Add a references footnote: total assessed value of PD 64 parcels × [n parcels] from the FY2026 dataset. If the math doesn't support $3.36B, correct the figure.

- [ ] **Explain or remove the 817 "activatable proxy" stat** — The stat block shows 817 parcels as "small urban lots with structure (activatable proxy)" but the text never defines what makes a parcel qualify. Either define the threshold in a footnote (e.g., "lots under X sq ft with a structure classified as residential or commercial, excluding multi-family over Y units") or remove the stat if it can't be defended.

- [ ] **Rewrite Section IV-B (permit data) with honest framing** — The current text overclaims. "Expired" permits are not operators who gave up after CUP approval. Revise to say: the permit expiration data shows that a majority of zoning permits on these streets never reach final completion — which may reflect the friction of the CUP process, the economics of conversion, or both. Remove the claim "operators go through the process, get approval, and then give up before opening" unless it can be supported by permit type analysis showing these are specifically use/CUP permits rather than building/renovation permits. Consider labeling this section as suggestive rather than conclusive.

- [ ] **Revise or remove the Richmond Fan District comparison** — The Fan District's active commercial life (Carytown, West Main) is on explicitly commercial-zoned streets that *border* the residential grid, not within it. The residential streets of the Fan are not commercially activated. Either replace with a more accurate example (Alexandria Old Town? Georgetown?) or rephrase: "the Fan District demonstrates that a thriving residential neighborhood can coexist with active commercial corridors immediately adjacent" — which is actually the PCO model, not the table amendment model.

- [ ] **Soften the unhoused argument or cut it** — Zine 1 (section 5) and Zine 2 (section 5) use unhoused concentration as an argument for retail activation. Zine 2 acknowledges "some of that use will be displaced." Together these read as displacement-as-benefit. Either (a) reframe entirely around "active streets are safer for everyone including people without housing" and drop the displacement implication, or (b) cut the homeless reference from the zines entirely and keep only the urbanist safety argument in the policy brief where it can be properly caveated.

- [ ] **Address the "market demand vs. zoning barrier" counter-argument explicitly** — Brief 01 section IX has four objections/responses but none addresses: "If there's demand, operators will use the CUP process." This is the strongest opposing argument. Add a response that either (a) cites identified operators blocked by CUP, or (b) argues from revealed preference data (where did Ghent-adjacent operators actually locate, and why?), or (c) acknowledges that market analysis would strengthen the case and that's a task for the full application.

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
- [ ] Fix section IV-A heading (missing)
- [ ] Fix stale Brief 01 cross-link
- [ ] Reconcile Colley residential count (64 vs 114)
- [ ] Show $3.36B calculation or correct figure
- [ ] Explain 817 activatable proxy threshold
- [ ] Rewrite IV-B permit section with honest framing
- [ ] Pre-PCO Colley data (FY18–FY20) — strongest available upgrade

### Brief No. 1 — Refinement Pass
- [ ] Verify Table 3.6.11 real cell values (see BLOCKING above)
- [ ] Add response to "operators would just use the CUP if demand existed"
- [ ] Replace Richmond Fan District example with accurate comparable
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

---

## Zine Track

- [x] Zine No. 2: "A Tale of Two Streets"
- [ ] Zine No. 1: Rewrite section 5 (unhoused argument) — see HIGH PRIORITY above
- [ ] Zine No. 2: Rewrite section 3 (Richmond Fan District) — see HIGH PRIORITY above
- [ ] Zine No. 3: "Your Neighborhood Is Worth More Than This" — economic argument, plain language
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
