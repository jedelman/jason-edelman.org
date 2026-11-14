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
3. **Links people add**: anyone with an atproto account can add a link to a place: a
   web address and a location, nothing else. Those are the amber dots, and each carries
   the handle of whoever added it. Anyone signed in can ask for a link to be taken down.

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
| `client-metadata.json` | The atproto OAuth client. Its scope is the two collections below. |
| `lexicons/` | The schemas of a link and of a takedown request. |
| `hidden.json` | What this page declines to show (`dids`, `uris`), and links it shows despite a takedown request (`keep`). |
| `data/` | Map shapes, layer values and the sourced entries. |
| `vendor/` | d3 7.9.0 and topojson-client 3.1.0, checked in; `vendor/LICENSES.txt` has the notices. |
| `build/` | The Python scripts that made `data/`. See "Rebuilding the data". |

Sign-in and the backlink index reuse the Library's code: `app.js` imports
`../library/lib.js` and the SDK under `../library/vendor/`. If the Library moves, this
breaks.

The services it calls: Google Fonts; then, for links people add, Constellation
(backlinks), plc.directory (DID documents), each author's PDS (their records), and
bsky.social (handle resolution at sign-in). No code loads from a CDN at runtime.

## What people can add

Two things, and neither carries any text of the person's own.

| Record | Repo | Meaning |
|---|---|---|
| `org.jason-edelman.atlas.link` | whoever added it | A web address and a place. |
| `org.jason-edelman.atlas.takedown` | whoever asked | A request that one link come off the page. It points at the link and gives no reason. |

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

**A takedown request** takes effect at once: the link stops being shown. Any signed-in
account can make one. If a request has been looked at and turned down, list the link's
URI under `keep` in `hidden.json` and it is shown again.

Nothing in a record is trusted. `parseLink` keeps only its own six fields, whatever
else the record holds. `cleanUrl` accepts an address only if it is http(s), has a real
host name (no IP addresses, no localhost), carries no credentials, contains no
whitespace or direction-changing characters, and is at most 400 characters; it drops
the fragment. A unit id is letters, digits, dot, underscore and hyphen, at most 64.

`loadCommunity` fails closed: if the index cannot be asked about links, or about
takedown requests, no links are shown, because one that someone asked to have removed
might otherwise come back.

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
- **A web address can still carry words** in its path or query. That is the only text a
  person can put on the page.
- **Anyone signed in can take a link down, and can do it to every link.** That is the
  chosen trade: a wrongly hidden link costs little, a wrongly shown one can cost a
  great deal. `keep` is the way back.
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
