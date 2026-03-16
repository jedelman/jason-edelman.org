# Ghent Zoning Reform — TASKS.md

Campaign site for HC-G2 zoning text amendment in Norfolk, Virginia.
Repo: https://github.com/jedelman/ghent-zoning-reform
Live at: jedelman.github.io/ghent-zoning-reform (enable GitHub Pages: Settings → Pages → Branch: main, root /)

---

## Immediate: Before Any Public Use

- [ ] **Verify Table 3.6.11** — policy/brief-01.html uses reconstructed amendment language based on confirmed table structure but unverified cell values. Pull the real table from https://www.norfolkva.gov/norfolkzoningordinance/ (browser only — robots.txt blocks fetchers). Reconcile exact use category names and current P/C/blank status for the HC-G2 column. Update brief-01.html amendment table to match real ordinance language precisely.

---

## Site Infrastructure

- [ ] Enable GitHub Pages: Settings → Pages → Branch: main, root /
- [x] Add OG meta tags to all pages (title, description, image) for social sharing
- [x] Add favicon (simple amber-gold SVG — street grid)
- [x] Create about.html — Jason's board history, why this matters, campaign context
- [x] Create get-involved.html — show up at hearings, write letters, print zines, contact
- [x] Wire get-involved.html into nav and homepage CTAs
- [ ] Verify all internal links are relative and resolve correctly

---

## Policy Track

### Brief No. 2: Economic Projections
- [ ] Pull HC-G2 parcel data from Norfolk AIR (https://norfolk.gov/air) or GIS
  - Count parcels with ground-floor street frontage
  - Estimate activatable commercial SF (15–20% conversion, ~1,000 sq ft avg)
- [ ] Revenue model: property tax uplift, sales tax (~1%), BPOL (~$0.20/$100 gross receipts)
  - Conservative scenario: 15 activations; aggressive: 40
- [ ] Compare: Colley Ave assessed values before/after PCO if data is available
- [x] Draft policy/brief-02.html — published; needs parcel data reconciliation from Norfolk AIR before official use

### Brief No. 3: The ARB and Commercial Use
- [ ] Research Virginia Code § 15.2-2306 (ARB enabling statute — scope of authority)
- [ ] Confirm legally: ARB reviews physical alterations, not change-of-use alone
- [ ] Case studies: Alexandria Old Town, Richmond Fan District, Charlottesville Downtown
- [ ] Draft policy/brief-03.html

---

## Blog Track

- [ ] "How to File a Text Amendment Application in Norfolk" — process walkthrough for activists
- [ ] "plaNorfolk2030 Already Supports This" — pull actual plan text, map to this proposal
- [ ] "What HC-G1 Can Teach HC-G2" — compare the two Ghent sub-districts
- [ ] Interview post: residents on what they want (quotes from Jason)

---

## Zine Track

- [x] Zine No. 2: "A Tale of Two Streets" — Colonial (HC-G2) vs. Colley (PCO), same city different rules
- [ ] Zine No. 3: "Your Neighborhood Is Worth More Than This" — economic argument, plain language
- [ ] **Printable PDF of Zine No. 1** — high priority for door-to-door
  - Letter/A4 format, half-sheet booklet fold (8 pages)
  - Print run target: 300 copies

---

## Political / Operational (Jason-led)

- [ ] File text amendment application — Jeremy Sharp, (757) 439-4833, jeremy.sharp@norfolk.gov
- [ ] Request ARB agenda slot (30–45 days lead time)
- [ ] Contact Ghent Civic League — present campaign, request endorsement
- [ ] Identify sympathetic Council member (Superward 6 covers Ghent)
- [ ] Draft template neighbor letter for get-involved.html
- [ ] Plan door-to-door zine distribution in HC-G2

---

## Data Needed

- [ ] Full HC-G2 parcel data: count, acreage, street frontage (Norfolk AIR or GIS)
- [ ] Assessed values of commercial parcels on Colley Ave (Norfolk AIR)
- [ ] CUP applications filed in HC-G2, last 5 years (FOIA if not public)
- [ ] Complete list of nonconforming commercial uses in HC-G2
- [ ] plaNorfolk2030 full text — Land Use Strategies chapter

---

## Design / Dev

- [x] Print CSS for zines (@media print — hide nav/header/footer, full-width body, preserve dark callout boxes)
- [ ] Accessibility pass: alt text, color contrast check on amber-gold
- [x] Add canonical link tags

---

## Content Rules (preserve across sessions)

- **Policy briefs:** cite zoning code sections precisely, use ordinance terminology, anticipate objections
- **Blog:** full argument, named sources, footnotes as superscripts (power-explained pattern)
- **Zines:** eighth-grade reading level, no unexplained jargon, explicitly licensed for free printing
- **Design:** amber-gold (#b07c2a), warm paper (#f3ede0), Cormorant Garamond / Lora / DM Mono
- **Links:** all internal links relative only
- **Index:** keep index.html current when adding any new piece

---

## Key References

- Planning staff: Jeremy Sharp, (757) 439-4833, jeremy.sharp@norfolk.gov
- Norfolk Zoning Ordinance: https://www.norfolkva.gov/norfolkzoningordinance/
- Norfolk AIR (parcel/GIS data): https://norfolk.gov/air
- Key ordinance sections: Table 3.6.11 (HC uses), Table 3.9.21 (PCO uses), § 3.6, § 3.9
- Amendment process: Norfolk Zoning Procedures Manual (Dec. 2023), Section 3.3(B)
