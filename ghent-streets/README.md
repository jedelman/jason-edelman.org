# Ghent Streets

Campaign site for zoning reform in Norfolk's HC-G2 (Ghent Historic and Cultural Conservation) district.

**Campaign goal:** Amend Table 3.6.11 of the Norfolk Zoning Ordinance to permit neighborhood-scale retail uses by right on ground floors in HC-G2.

## Site structure

```
/                   Homepage
/policy/            Policy briefs (planners, council members, technical audience)
  brief-01.html     The Case for By-Right Retail — amendment language + argument
  brief-02.html     Economic Projections (forthcoming)
  brief-03.html     The ARB and Commercial Use (forthcoming)
/blog/              Long-form analysis (grassroots activists, engaged citizens)
  how-norfolk-zoning-kills-street-life.html
  pco-precedent.html
  ghent-unhoused.html
/zines/             Plain-language explainers (neighbors, renters, general public)
  zine-01.html      Why Is Your Street Dead?
  zine-02.html      A Tale of Two Streets (forthcoming)
  zine-03.html      Your Neighborhood Is Worth More Than This (forthcoming)
/explorer/          Parcel explorer: HC-G2 in 3D; pick a lot, see the assessor's photo and the
                    rule, transform the ground floor (coffee shop, bookshop, bistro, design studio)
  data/ghent.json   Built by data/scripts/build_explorer.py (see below)
/assets/css/style.css   Shared design system
```

## Parcel explorer data

`explorer/data/ghent.json` is built from the City of Norfolk's public GIS (zoning, parcels,
buildings, street centerlines) and open-data portal (addresses, FY26 assessments; owners are
not kept). The assessor's photos are referenced by URL and stay on the city's server. To rebuild:

```
pip install -r data/scripts/requirements.txt
python3 data/scripts/build_explorer.py
```

The explorer loads three.js 0.160.0 from jsdelivr; there's no build step. Building heights are
approximate (the city's building "Elevation" field, read as roof elevation less ~7 ft of ground).
The rule shown for each use was read from Table 3.6.11 and the §4.2 definitions on 2026-11-14;
re-check them if the ordinance is amended.

## Design system

Same editorial design language as power-explained:
- Warm paper (`#f3ede0`), dark ink (`#1a1714`), amber-gold accent (`#b07c2a`)
- Fonts: Cormorant Garamond (display), Lora (body), DM Mono (labels/mono)
- Dark mode supported

## Key references

- Norfolk Zoning Ordinance Table 3.6.11 (HC district use table)
- Norfolk Zoning Procedures Manual (December 2023)
- plaNorfolk2030 Land Use Strategies
- Norfolk PCO districts: Colley, 21st Street, Riverview, 35th Street, Lafayette

## GitHub Pages

Enable at: Settings → Pages → Branch: main, root `/`

## Content rules

- Policy briefs: cite zoning code sections, use precise language, anticipate objections
- Blog posts: full argument, named sources, footnotes
- Zines: eighth-grade reading level, printable, no jargon without explanation
- All internal links use relative paths
- Always keep index.html current when adding new pieces
