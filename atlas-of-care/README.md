# Atlas of Care

A map of the work that keeps life going, served at `jason-edelman.org/atlas-of-care/`.
Plain browser JavaScript, no build step for the page. Subtitle: "find each other."

It has three parts:

1. **Layers**: statistics tinted onto a map, in six groups ordered by how soon it is
   felt when the work behind them stops. The world map has 29, most of them covering
   150 to 215 countries. Four maps: the world by country, the United
   States by county, India by district, Europe by NUTS-2 region. Clicking a unit opens
   a profile of every layer for that place.
2. **Case studies**: stories and interventions, each resting on a page that was
   fetched and quoted. A ring marks maintenance (it has to be done again); a diamond
   marks leverage (a bounded act that changes what follows). They are atproto records
   (`org.jason-edelman.atlas.case`) in the atlas owner's repo. Until the owner has
   published them there, the page shows the copies in `data/entries.json`.
3. **What people add**: the page opens on two questions. "What do you do to hold your
   world together?" takes a link to a place, or a case study of one's own in the
   atlas's form, with its source. "Who holds your world together?" takes a vouch for an
   organisation or a person. Those are drawn in amber and carry the handle of whoever
   added them. Anyone signed in can ask for one to be taken down.

It is styled to the rest of the site: the field-notes palette, Epilogue and Charis SIL,
no rounded corners, shadows or gradients (`.impeccable.md`). One colour comes from
outside the palette: the violet of the men's bars, because green against amber cannot
be told apart with red-green colour blindness.

## Files

| File | What it is |
|---|---|
| `index.html` | Markup and styles. |
| `app.js` | The map, layers, place profile, sign-in, adding a link and asking for a takedown. |
| `atlas.js` | The rules for links and takedown requests: building, checking and loading them. No DOM, so it runs in Node tests. |
| `atlas.test.mjs` | `node --test atlas-of-care/atlas.test.mjs` |
| `client-metadata.json` | The atproto OAuth client. Its scope is the four collections below. |
| `lexicons/` | The schemas of a link, a case study, a vouch and a takedown request. |
| `hidden.json` | What this page declines to show (`dids`, `uris`), and links it shows despite a takedown request (`keep`). |
| `data/` | Map shapes, layer values, the case studies' seed file (`entries.json`) and the prior-work list (`prior.json`). |
| `vendor/` | d3 7.9.0 and topojson-client 3.1.0, checked in; `vendor/LICENSES.txt` has the notices. |
| `build/` | The Python scripts that made `data/`. See "Rebuilding the data". |

Sign-in and the backlink index reuse the Library's code: `app.js` imports
`../library/lib.js` and the SDK under `../library/vendor/`. If the Library moves, this
breaks.

The services it calls: Google Fonts; then, for links people add, Constellation
(backlinks), plc.directory (DID documents), each author's PDS (their records), and
bsky.social (handle resolution at sign-in). No code loads from a CDN at runtime.

## What people can add

| Record | Repo | Meaning |
|---|---|---|
| `org.jason-edelman.atlas.link` | whoever added it | A web address and a place. No text of the person's own. |
| `org.jason-edelman.atlas.case` | the atlas owner, or whoever wrote it | A case study: who does what, who pays, what came of it, and its source. |
| `org.jason-edelman.atlas.vouch` | whoever vouched | "This one holds my world together, here": an atproto account or a web address, and a place. No text of the voucher's own. |
| `org.jason-edelman.atlas.takedown` | whoever asked | A request that one link, contributed case study or vouch come off the page. It points at the record and gives no reason. |

### The atlas's own case studies

They live in the owner's repo (`did:plc:zz4wcje4a2nbbtc7pdoth3f2`) and are read from it
directly with `listRecords`, with no index in between. To put them there, the owner
signs in on the page and presses "Publish the N from the site's file" in the Add a
link section. That writes each entry of `data/entries.json` with `putRecord` under a
key made from its title, so pressing it again updates the records and does not double
them. After that the repo is the source of truth: edit a record there and the page
follows; `data/entries.json` is only what the page shows when the repo cannot be read
or has none. Takedown requests do not apply to the owner's own case studies.

### Case studies people contribute

Written in the form in a place's profile and saved to the writer's own repo. A
contributed case study must name a source with an http(s) address, and it is placed in
the unit that was selected, under the atlas's own name for that unit (a typed place
name is ignored). Its text is the writer's: capped in length, stripped of control
characters, and escaped by the page. It shows beside the atlas's own with "Contributed
by @handle. Not checked by the atlas." and a takedown button.

Nobody keeps a list of contributors and this site stores nothing. Both records name
the atlas's DID (`did:plc:zz4wcje4a2nbbtc7pdoth3f2`, jason-edelman.org) in their
`atlas` field. [Constellation](https://constellation.microcosm.blue/) answers "which
records point at this DID?", and each one it reports is read from its author's own PDS.

**A link** holds `url`, `scope`, `unit`, `lat`, `lon` and `createdAt`. The unit is the
country, county, district or region that was selected when it was added; the
coordinates are that unit's centre, rounded to two decimal places, as strings (atproto
records hold no floats). A link is never placed at an address. Its place name is looked
up from the unit id, so a record cannot supply one; a link whose unit this atlas does
not have is not shown. The heading on its card is the address's host name.

### Vouches

A vouch names who it is for in one of two ways: an atproto account, stored as its DID
(the form takes a handle and looks the DID up), or an http(s) address. It cannot hold a
name typed as text, so nobody is put on the map who has neither an account nor a web
page. It is placed in the selected unit, like a link.

Vouches for the same one in the same unit show as one entry with everyone who vouched;
a voucher counts once, and a vouch for oneself is not counted (`groupVouches`). The
entry's heading is the account's handle, or the address's host name. "I vouch too" adds
the signed-in person's own record. "Withdraw my vouch" deletes it.

Whoever is vouched for has the same remedy as anyone: a takedown request, which takes
the entry off at once. Because an entry stands for one record per voucher, the button
writes one takedown record for each. Listing a DID or an address under `dids` or `uris`
in `hidden.json` also stops anyone showing as vouched for under it.

**A takedown request** takes effect at once: the link, contributed case study or vouch
stops being shown. Any signed-in account can make one. If a request has been looked at and
turned down, list the record's URI under `keep` in `hidden.json` and it is shown again.

Nothing in a record is trusted. `parseLink` keeps only its own six fields, whatever
else the record holds. `cleanUrl` accepts an address only if it is http(s), has a real
host name (no IP addresses, no localhost), carries no credentials, contains no
whitespace or direction-changing characters, and is at most 400 characters; it drops
the fragment. A unit id is letters, digits, dot, underscore and hyphen, at most 64.

`loadCommunity` fails closed: if the index cannot be asked about links, contributed
case studies or takedown requests, nothing people have added is shown, because
something that someone asked to have removed might otherwise come back.

### Hiding a link, or keeping one

`hidden.json`:

- `dids`: nothing added by these accounts is shown.
- `uris`: these links (`at://did/org.jason-edelman.atlas.link/rkey`) are not shown.
- `keep`: these links are shown even though someone has asked for a takedown.

Hiding does not delete: the record stays in its author's account. Its author can
delete it with the Remove button.

## Known limits

- **Links are public.** A link sits in the public repo of whoever added it, under their
  handle, readable by anyone whether or not this page shows it. The form says so.
- **Nobody checks where a link leads.** The page shows the host name and the address
  and says it is unchecked.
- **Contributed case studies are free text.** Anyone signed in can put their own words
  on the page under their handle. The checks are a required source, length caps,
  escaping, the takedown button and `hidden.json`. Nobody reviews them first.
- **Anyone signed in can take a link down, and can do it to every link.** That is the
  chosen trade: a wrongly hidden link costs little, a wrongly shown one can cost a
  great deal. `keep` is the way back.
- **A vouch places someone on a map who did not ask to be there.** It is limited to
  public accounts and web addresses, sits at the level of a county or district and not
  an address, and comes off at once on request. It is still a claim about a named
  organisation or person made by someone else.
- **A takedown request needs an atproto account.** Someone without one cannot make one
  here. The sourced entries have no takedown button at all.
- **Constellation is a dependency.** If it does not answer, no links are shown and the
  page says so. The sourced entries and the layers still work.
- **No village or city level, and no street map.** The finest units are US counties,
  Indian districts and European regions. The map is drawn from boundary files with
  d3; there are no tiles.
- **Local layers differ by country.** Each country's layers come from its own surveys.
- **Sign-in and writing were not tested end to end** when this was first committed:
  the rules are unit-tested and the page was tested against a simulated index and
  simulated accounts, but no real account signed in and wrote a record.

## Running it locally

Serve the repo root and open `http://127.0.0.1:<port>/atlas-of-care/`. On a loopback
address the app uses atproto's loopback OAuth client. Use `127.0.0.1`, not `localhost`.

## Rebuilding the data

The scripts in `build/` need Python 3 with `pycountry` and `shapely`.

```bash
D=<a new empty dir>
g(){ curl -sSL --compressed -A "Mozilla/5.0" -o "$D/$1" "$2"; }
O="https://ourworldindata.org/grapher"; Q="v=1&csvType=full&useColumnShortNames=true"
g dom.csv   "$O/time-spend-in-domestic-work-female-vs-male.csv?$Q"
g sfp.json  "https://api.db.nomics.world/v22/series/ILO/FOW_5SFP_SEX_RT?observations=1&limit=1000"
g ste.csv   "https://rplumber.ilo.org/data/indicator/?id=EMP_2EMP_SEX_STE_NB_A&timefrom=2024&timeto=2024&format=.csv"
g carer.csv "https://rplumber.ilo.org/data/indicator/?id=EIP_RCAR_SEX_RT_A&format=.csv"
for p in life-expectancy:life share-of-children-immunized-dtp3:dtp3 births-attended-by-health-staff-sdgs:births \
         share-of-women-using-modern-contraceptive-methods:contra children-sleeping-under-treated-bednet:nets \
         terrestrial-protected-areas:protected; do g "owid_${p##*:}.csv" "$O/${p%%:*}.csv?$Q"; done
for p in healthy-life-expectancy-at-birth:hale child-mortality:u5 maternal-mortality:mmr \
         share-of-children-vaccinated-against-measles:measles prevalence-of-undernourishment:hunger \
         share-of-children-younger-than-5-who-suffer-from-stunting:stunting \
         proportion-using-safely-managed-drinking-water:water share-using-safely-managed-sanitation:sanitation \
         access-to-clean-fuels-and-technologies-for-cooking:cleanfuel share-of-the-labor-force-employed-in-agriculture:agri \
         universal-health-coverage-index:uhc share-of-out-of-pocket-expenditure-on-healthcare:oop \
         forest-area-as-share-of-land-area:forest marine-protected-areas:marine; do g "owid_${p##*:}.csv" "$O/${p%%:*}.csv?$Q"; done
# WHO Global Health Observatory (OData). The filter is SpatialDimType eq 'COUNTRY'.
for c in HWF_0006 HWF_0001 WHS4_154 NUT_BF_EBF FAMILYPLANNINGUNPDUHC WSH_HYGIENE_BASIC; do
  g "gho_$c.json" "https://ghoapi.azureedge.net/api/$c?\$filter=SpatialDimType%20eq%20'COUNTRY'"; done
python3 -I build/build_data.py "$D" data/world.values.json
curl -sSL -o data/world.topo.json https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json

L=<a new empty dir>; G=<another new empty dir>
h(){ curl -sSL --compressed -A "Mozilla/5.0" -o "$1" "$2"; }
h $L/chr.csv   "https://www.countyhealthrankings.org/sites/default/files/media/document/analytic_data2025.csv"
h $L/india.csv "https://raw.githubusercontent.com/SaiSiddhardhaKalla/NFHS/main/India.csv"
E="https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data"
h $L/eu_life.json   "$E/demo_r_mlifexp?format=JSON&sex=T&age=Y_LT1&lastTimePeriod=3"
h $L/eu_infant.json "$E/demo_r_minfind?format=JSON&unit=RT&lastTimePeriod=3"
h $L/eu_phys.json   "$E/hlth_rs_physreg?format=JSON&unit=P_HTHAB&lastTimePeriod=4"
h $L/eu_emp.json    "$E/lfst_r_lfe2emprt?format=JSON&age=Y20-64&lastTimePeriod=2"
h $G/us.json    "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-10m.json"
h $G/nuts2.json "https://gisco-services.ec.europa.eu/distribution/v2/nuts/topojson/NUTS_RG_20M_2021_4326_LEVL_2.json"
B=https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/IND
h $G/ind_adm2.geojson "$B/ADM2/geoBoundaries-IND-ADM2_simplified.geojson"
h $G/ind_adm1.geojson "$B/ADM1/geoBoundaries-IND-ADM1_simplified.geojson"
python3 -I build/build_local.py $L $G pack
cp pack/us.values.json pack/in.values.json pack/eu.values.json data/
cp $G/us.json data/us.topo.json; cp $G/nuts2.json data/eu.topo.json
```

`pack/in.units.geojson` (7 MB) was then simplified to `data/in.geo.json` with shapely:
`buffer(0)`, `simplify(0.012, preserve_topology=True)`, exterior rings turned
clockwise (d3-geo needs that), coordinates rounded to three places.

`build/merge_entries.py` adds researched entries to `data/entries.json` only when
their quote is found in a saved copy of the source page. Do not add a sourced entry
without fetching its source.

## Prior work

`data/prior.json` holds the works cited in the page's Prior work section. Each was
checked against a page fetched on 2026-11-14: the publisher's, the project's own, or a
catalogue record; `notes` says which, and what could not be confirmed. Four entries
(Waring, Fisher and Tronto, Peluso, Mattern) rest on a catalogue or bibliographic record
only and say so. Add a work only after opening its page. Describe what the work is;
do not claim it influenced this atlas.

An organisation called Atlas of Care (formerly Atlas of Caregiving) used this name
first. Its own About page says it shut down at the end of 2025. It is the first entry.

## Data sources

- Our World in Data: life expectancy and healthy life expectancy; child and maternal
  mortality; UN SDG 5.4.1 (unpaid care and domestic work); WHO and UNICEF DTP3 and
  measles coverage; births attended by skilled staff; undernourishment (FAO); stunting;
  drinking water and sanitation (WHO/UNICEF JMP); clean cooking fuel; employment in
  agriculture; universal health coverage index; out-of-pocket health spending; children
  under treated nets; protected land and sea; forest area.
- World Health Organization, Global Health Observatory: nursing and midwifery personnel
  (`HWF_0006`); medical doctors (`HWF_0001`); antenatal care, four visits (`WHS4_154`);
  exclusive breastfeeding (`NUT_BF_EBF`); family planning need met with modern methods
  (`FAMILYPLANNINGUNPDUHC`, the 2024 estimate for all women); basic handwashing
  facilities at home (`WSH_HYGIENE_BASIC`). The WHO's community health worker and
  traditional birth attendant indicators returned no country rows on 2026-11-14.
- International Labour Organization: status in employment (modelled estimates);
  persons outside the labour force due to care responsibilities; subsistence foodstuff
  production (from the DBnomics copy of February 2024; the ILO's current catalogue no
  longer lists it).
- United States: County Health Rankings & Roadmaps, 2025 analytic data.
- India: National Family Health Survey 5 (2019-21) district fact sheets, from the CSV
  compiled at github.com/SaiSiddhardhaKalla/NFHS. 687 of 709 surveyed districts were
  matched to a boundary.
- Europe: Eurostat regional statistics, NUTS 2.
- Boundaries: Natural Earth through world-atlas and us-atlas; geoBoundaries (India,
  Open Database License 1.0); Eurostat GISCO NUTS 2021.
