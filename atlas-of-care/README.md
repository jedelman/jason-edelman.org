# Atlas of Care

A map of the work that keeps life going, served at `jason-edelman.org/atlas-of-care/`.
Plain browser JavaScript, no build step for the page. Subtitle: "find each other."

It has three parts:

1. **Layers**: statistics tinted onto a map, in six groups ordered by how soon it is
   felt when the work behind them stops. Four maps: the world by country, the United
   States by county, India by district, Europe by NUTS-2 region. Clicking a unit opens
   a profile of every layer for that place.
2. **Sourced entries** (`data/entries.json`): stories and interventions, each resting
   on a page that was fetched and quoted. A ring marks maintenance (it has to be done
   again); a diamond marks leverage (a bounded act that changes what follows).
3. **Entries people add**: anyone with an atproto account can add what they do in a
   place. Those are drawn in ochre and carry their author's handle.

## Files

| File | What it is |
|---|---|
| `index.html` | Markup and styles. |
| `app.js` | The map, layers, place profile, sign-in and the add form. |
| `atlas.js` | The rules for added entries: building, checking and loading them. No DOM, so it runs in Node tests. |
| `atlas.test.mjs` | `node --test atlas-of-care/atlas.test.mjs` |
| `client-metadata.json` | The atproto OAuth client. Its scope is one collection. |
| `lexicons/` | The schema of an added entry. |
| `hidden.json` | DIDs and record URIs this page declines to show. |
| `data/` | Map shapes, layer values and the sourced entries. |
| `vendor/` | d3 7.9.0 and topojson-client 3.1.0, checked in; `vendor/LICENSES.txt` has the notices. |
| `build/` | The Python scripts that made `data/`. See "Rebuilding the data". |

Sign-in and the backlink index reuse the Library's code: `app.js` imports
`../library/lib.js` and the SDK under `../library/vendor/`. If the Library moves, this
breaks.

The services it calls: Google Fonts; then, for added entries, Constellation
(backlinks), plc.directory (DID documents), each author's PDS (their records), and
bsky.social (handle resolution at sign-in). No code loads from a CDN at runtime.

## Entries people add

| Record | Repo | Meaning |
|---|---|---|
| `org.jason-edelman.atlas.entry` | the author's | One thing they do to keep a place going. |

Nobody keeps a list of contributors and this site stores nothing. Every entry names
the atlas's DID (`did:plc:zz4wcje4a2nbbtc7pdoth3f2`, jason-edelman.org) in its `atlas`
field. [Constellation](https://constellation.microcosm.blue/) answers "which entry
records point at this DID?", and each one it reports is read from its author's own
PDS. Deleting the record removes it from the map.

An entry is placed in an administrative unit (the country, county, district or region
that was selected when it was written), never at an address. Its coordinates are that
unit's centre, rounded to two decimal places. atproto records hold no floats, so the
coordinates are strings.

Nothing in an entry is trusted. `parseEntry` drops records with the wrong type, a
different atlas, unknown kinds, or out-of-range coordinates; it caps every text field
and keeps a link only if it is http(s). The page escapes all of it.

### Hiding an entry

Add its author's DID or its record URI (`at://did/org.jason-edelman.atlas.entry/rkey`)
to `hidden.json` and deploy. That hides it here. It does not delete it: the record
stays in its author's account.

## Known limits

- **Everything is public.** An entry sits in its author's public repo under their
  handle, readable by anyone whether or not this page shows it. The form says so. For
  work that depends on not being found, that is a reason not to add it.
- **Open writing.** Anyone can add anything, including about work that is not theirs.
  The only controls are `hidden.json` and the author's own delete. There is no review
  queue.
- **Constellation is a dependency.** If it is down, added entries go missing from the
  page and the page says so. The sourced entries and the layers still work.
- **No village or city level, and no street map.** The finest units are US counties,
  Indian districts and European regions. The map is drawn from boundary files with
  d3; there are no tiles.
- **Local layers differ by country.** Each country's layers come from its own surveys.
- **Sign-in and writing were not tested end to end** when this was first committed:
  the logic is unit-tested and the page was tested with a simulated index, but no real
  account signed in and wrote a record.

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

## Data sources

- Our World in Data: life expectancy; UN SDG 5.4.1 (unpaid care and domestic work);
  WHO and UNICEF DTP3 coverage; births attended by skilled staff; modern contraceptive
  use; children under treated nets; protected land.
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
