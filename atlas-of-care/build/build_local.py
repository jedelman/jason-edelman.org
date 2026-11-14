"""Build the local packs: US counties, India districts, Europe NUTS-2 regions.

Usage: python3 -I build_local.py <local dir> <geo dir> <out dir>

<local dir>: chr.csv (County Health Rankings 2025 analytic data), india.csv (NFHS-5 district fact sheets as CSV),
             eu_life.json, eu_infant.json, eu_phys.json, eu_emp.json (Eurostat JSON-stat)
<geo dir>:   us.json (us-atlas counties-10m), ind_adm2.geojson + ind_adm1.geojson (geoBoundaries, simplified),
             nuts2.json (GISCO NUTS 2021, 1:20M, level 2)
Writes <out dir>/us.values.json, in.values.json, in.units.geojson (ids attached), eu.values.json.
Geometry is converted to TopoJSON afterwards with mapshaper (see README).

Each values file: {"layers": [...], "values": {unit id: [one number or null per layer]}, "names": {unit id: name}}.
A layer's "cuts" are the 20/40/60/80th percentiles of its units, so each tint holds a fifth of them.
"""
import csv, json, sys, os, re, unicodedata, difflib, collections

local, geo, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)


def pct(vals, p):
    s = sorted(vals)
    return s[min(len(s) - 1, int(p * len(s)))]


def finish(layers, values, names, path, note):
    for i, L in enumerate(layers):
        vals = [v[i] for v in values.values() if v[i] is not None]
        L["n"] = len(vals)
        L["cuts"] = [round(pct(vals, p), L["dec"] + 1) for p in (.2, .4, .6, .8)]
        L["min"], L["max"] = round(min(vals), L["dec"]), round(max(vals), L["dec"])
    json.dump({"layers": layers, "values": values, "names": names}, open(path, "w", encoding="utf-8"),
              separators=(",", ":"), ensure_ascii=False)
    print(path, len(values), "units;", note, [(L["id"], L["n"]) for L in layers])


# ---------------------------------------------------------------- United States
r = csv.reader(open(os.path.join(local, "chr.csv"), encoding="utf-8-sig"))
head = next(r); next(r)
rows = [dict(zip(head, x)) for x in r]
SRC_US = "County Health Rankings & Roadmaps, 2025 release"
US = [  # id, group, name, column, multiplier, decimals, unit, measure
    ("life", "life", "Life expectancy", "Life Expectancy", 1, 1, " years", "Average years a newborn would live at current death rates."),
    ("lbw", "birth", "Babies born underweight", "Low Birth Weight", 100, 1, "%", "Share of live births under 2,500 grams."),
    ("ccc", "care", "Child care centres", "Child Care Centers", 1, 1, " per 1,000 under-fives", "Licensed child care centres for every 1,000 children under five."),
    ("ccb", "care", "What child care costs a household", "Child Care Cost Burden", 100, 0, "% of income", "Cost of care for two children as a share of median household income."),
    ("single", "care", "Children in one-parent households", "Children in Single-Parent Households", 100, 0, "%", "Share of children living with a single parent."),
    ("assoc", "care", "Clubs, congregations and associations", "Social Associations", 1, 1, " per 10,000 people", "Membership associations (civic, religious, sports, labour and others) for every 10,000 people."),
    ("food", "food", "Not enough food", "Food Insecurity", 100, 1, "%", "Share of people without reliable access to enough food."),
    ("flu", "disease", "Flu vaccination", "Flu Vaccinations", 100, 0, "%", "Share of fee-for-service Medicare enrollees vaccinated against flu in a year."),
    ("pcp", "disease", "Family doctors", "Primary Care Physicians", 100000, 0, " per 100,000 people", "Primary care physicians for every 100,000 people."),
    ("unins", "disease", "No health insurance", "Uninsured", 100, 1, "%", "Share of people under 65 without health insurance."),
]
layers = [{"id": a, "group": g, "name": n, "dec": d, "unit": u, "measure": m, "src": SRC_US} for a, g, n, c, k, d, u, m in US]
values, names = {}, {}
for x in rows:
    if x["County FIPS Code"] == "000":
        continue
    fips = x["5-digit FIPS Code"]
    v = []
    for a, g, n, c, k, d, u, m in US:
        s = x.get(c + " raw value", "")
        v.append(round(float(s) * k, d + 1) if s not in ("", "NA") else None)
    if any(t is not None for t in v):
        values[fips] = v
        names[fips] = x["Name"] + ", " + x["State Abbreviation"]
finish(layers, values, names, os.path.join(out, "us.values.json"), "counties")

# ---------------------------------------------------------------- India
from shapely.geometry import shape


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().replace("&", "and")
    return re.sub(r"[^a-z]", "", s)


STATE_ALIAS = {"andamanandnicobarisland": "andamanandnicobarislands", "nctofdelhi": "delhi",
               "dadraandnagarhaveli": "dadraandnagarhavelianddamananddiu", "damananddiu": "dadraandnagarhavelianddamananddiu"}
a1 = json.load(open(os.path.join(geo, "ind_adm1.geojson"), encoding="utf-8"))["features"]
a2 = json.load(open(os.path.join(geo, "ind_adm2.geojson"), encoding="utf-8"))["features"]
states = [(norm(f["properties"]["shapeName"]), f["properties"]["shapeName"], shape(f["geometry"]).buffer(0)) for f in a1]
units = {}  # (state norm, district norm) -> feature
for f in a2:
    g = shape(f["geometry"]).buffer(0)
    p = g.representative_point()
    st = next((s for s in states if s[2].contains(p)), None) or min(states, key=lambda s: s[2].distance(p))
    f["properties"] = {"name": f["properties"]["shapeName"], "state": st[1], "sid": f["properties"]["shapeID"]}
    units.setdefault(st[0], {})[norm(f["properties"]["name"])] = f

IN = [  # id, group, name, indicator text (exact match after stripping), decimals, measure
    ("inst", "birth", "Births in a health facility", "Institutional births (%)", "Share of births in the five years before the survey that took place in a health facility."),
    ("skilled", "birth", "A trained hand at the birth", "Births attended by skilled health personnel", "Share of births attended by a doctor, nurse, midwife or other skilled health worker."),
    ("anc", "birth", "Four check-ups in pregnancy", "Mothers who had at least 4 antenatal care visits", "Share of mothers who had at least four antenatal visits for their last birth."),
    ("vacc", "birth", "Children fully vaccinated", "Children age 12-23 months fully vaccinated based on information from either vaccination card or mother's recall", "Share of children aged 12 to 23 months with all basic vaccinations, from the card or the mother's recall."),
    ("school", "care", "Women with ten years of school", "Women with 10 or more years of schooling", "Share of women aged 15 to 49 with ten or more years of schooling."),
    ("early", "care", "Married before eighteen", "Women age 20-24 years married before age 18 years", "Share of women aged 20 to 24 who were married before they turned 18."),
    ("water", "food", "Improved drinking water", "Population living in households with an improved drinking", "Share of people in households with an improved source of drinking water."),
    ("toilet", "food", "An improved toilet", "Population living in households that use an improved sanitation facility", "Share of people in households using an improved sanitation facility."),
    ("fuel", "food", "Clean cooking fuel", "Households using clean fuel for cooking", "Share of households cooking with clean fuel."),
    ("stunt", "food", "Children too short for their age", "Children under 5 years who are stunted", "Share of children under five who are stunted, a sign of long-term undernourishment."),
    ("anaemia", "food", "Women with anaemia", "All women age 15-49 years who are anaemic", "Share of women aged 15 to 49 who are anaemic."),
    ("visit", "disease", "A health worker came to talk", "Health worker ever talked to female non-users about family planning", "Share of women not using contraception whom a health worker has ever spoken to about family planning."),
    ("modern", "disease", "Modern contraception in use", "Any modern method", "Share of married women aged 15 to 49 using a modern method of contraception."),
]
SRC_IN = "National Family Health Survey 5 (2019-21), district fact sheets"
ir = list(csv.DictReader(open(os.path.join(local, "india.csv"), encoding="utf-8-sig")))
byd = collections.defaultdict(dict)
for x in ir:
    ind = re.sub(r"\d*\s*\(%\)\s*$", "", x["Indicator"].strip()).strip()
    byd[(x["State"].strip(), x["District"].strip())][norm(ind)] = x["NFHS 5"]
layers = [{"id": a, "group": g, "name": n, "dec": 1, "unit": "%", "measure": m, "src": SRC_IN} for a, g, n, c, m in IN]
values, names, unmatched = {}, {}, []
for (st, dist), inds in byd.items():
    sk = norm(st); sk = STATE_ALIAS.get(sk, sk)
    pool = units.get(sk, {})
    dk = norm(dist)
    hit = pool.get(dk)
    if not hit:
        m = difflib.get_close_matches(dk, list(pool), n=1, cutoff=0.82)
        hit = pool.get(m[0]) if m else None
    if not hit:
        unmatched.append((st, dist)); continue
    v = []
    for a, g, n, c, m in IN:
        key = norm(re.sub(r"\s*\(%\)\s*$", "", c))
        cands = sorted((k for k in inds if k.startswith(key)), key=len)  # exact first, else the shortest that starts with it
        s = inds[cands[0]] if cands else ""
        s = re.sub(r"[()*\s]", "", s or "")
        try:
            v.append(round(float(s), 1))
        except ValueError:
            v.append(None)
    sid = hit["properties"]["sid"]
    if sid in values:
        continue
    values[sid] = v
    names[sid] = dist + ", " + st
feats = []
for pool in units.values():
    for f in pool.values():
        f["id"] = f["properties"]["sid"]
        f["properties"] = {"name": f["properties"]["name"], "state": f["properties"]["state"]}
        if f["id"] not in names:
            names[f["id"]] = f["properties"]["name"] + ", " + f["properties"]["state"]
        feats.append(f)
json.dump({"type": "FeatureCollection", "features": feats}, open(os.path.join(out, "in.units.geojson"), "w", encoding="utf-8"))
finish(layers, values, names, os.path.join(out, "in.values.json"), "districts; unmatched survey districts: %d %s" % (len(unmatched), unmatched[:12]))

# ---------------------------------------------------------------- Europe (NUTS 2)
def jsonstat(path, fixed):
    d = json.load(open(os.path.join(local, path), encoding="utf-8"))
    ids, size = d["id"], d["size"]
    idx = {k: d["dimension"][k]["category"]["index"] for k in ids}
    geo_i = idx["geo"]; times = sorted(idx["time"], key=lambda t: idx["time"][t])
    mult = [1] * len(ids)
    for i in range(len(ids) - 2, -1, -1):
        mult[i] = mult[i + 1] * size[i + 1]
    res = {}
    for g in geo_i:
        if len(g) != 4:
            continue
        for t in reversed(times):
            pos = 0
            for i, k in enumerate(ids):
                key = g if k == "geo" else t if k == "time" else fixed.get(k, list(idx[k])[0])
                pos += idx[k][key] * mult[i]
            v = d["value"].get(str(pos))
            if v is not None:
                res[g] = (v, t); break
    return res


life = jsonstat("eu_life.json", {"sex": "T", "age": "Y_LT1"})
inf = jsonstat("eu_infant.json", {"unit": "RT"})
phys = jsonstat("eu_phys.json", {"unit": "P_HTHAB"})
ef = jsonstat("eu_emp.json", {"sex": "F", "age": "Y20-64"})
em = jsonstat("eu_emp.json", {"sex": "M", "age": "Y20-64"})
SRC_EU = "Eurostat regional statistics, NUTS 2, latest year 2022 to 2025"
layers = [
    {"id": "life", "group": "life", "name": "Life expectancy", "dec": 1, "unit": " years", "measure": "Average years a newborn would live at current death rates.", "src": SRC_EU},
    {"id": "infant", "group": "birth", "name": "Babies who die before one", "dec": 1, "unit": " per 1,000 births", "measure": "Deaths of infants under one year for every 1,000 live births.", "src": SRC_EU},
    {"id": "phys", "group": "disease", "name": "Doctors", "dec": 0, "unit": " per 100,000 people", "measure": "Practising physicians for every 100,000 inhabitants.", "src": SRC_EU},
    {"id": "gap", "group": "care", "name": "The gap between men and women in paid work", "dec": 1, "unit": " points", "measure": "Employment rate of men aged 20 to 64 minus that of women, in percentage points. Unpaid care is one of the things that keeps women out of paid work.", "src": SRC_EU},
]
n2 = json.load(open(os.path.join(geo, "nuts2.json"), encoding="utf-8"))
obj = list(n2["objects"])[0]
values, names = {}, {}
for gmt in n2["objects"][obj]["geometries"]:
    p = gmt["properties"]; nid = p["NUTS_ID"]
    names[nid] = p["NAME_LATN"] + ", " + p["CNTR_CODE"]
    v = [life.get(nid, (None,))[0], inf.get(nid, (None,))[0], phys.get(nid, (None,))[0],
         round(em[nid][0] - ef[nid][0], 1) if nid in em and nid in ef else None]
    if any(t is not None for t in v):
        values[nid] = v
finish(layers, values, names, os.path.join(out, "eu.values.json"), "NUTS-2 regions")
