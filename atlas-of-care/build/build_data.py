"""Build data.json for the Geography of Tending page.

Usage: python3 -I build_data.py <dir with downloaded files> <out.json>

Inputs (downloaded 2026-11-14, see README.md for the URLs):
  dom.csv    Our World in Data grapher export of UN SDG 5.4.1 (hours/day unpaid domestic + care work, by sex)
  sfp.json   DBnomics mirror of ILO FOW_5SFP_SEX_RT (subsistence foodstuff production rate by sex, 19th ICLS)
  ste.csv    ILO EMP_2EMP_SEX_STE_NB_A, 2024 (employment by sex and status; modelled estimates, Nov. 2025)
  carer.csv  ILO EIP_RCAR_SEX_RT_A (share of persons outside the labour force due to care responsibilities)
  owid_dtp3.csv, owid_births.csv, owid_contra.csv, owid_nets.csv, owid_protected.csv
             Our World in Data grapher exports: DTP3 coverage (WHO/UNICEF), births attended by skilled staff,
             modern contraceptive use, children under insecticide-treated nets, protected land (all via World Bank
             except DTP3)
"""
import csv, json, sys, os
import pycountry

src, out = sys.argv[1], sys.argv[2]

def num(a3):
    c = pycountry.countries.get(alpha_3=a3)
    return c.numeric if c else None

def name(a3):
    c = pycountry.countries.get(alpha_3=a3)
    return getattr(c, "common_name", None) or c.name

layers = {}

# 1. Unpaid domestic and care work, hours per day, latest year per country
rows = list(csv.DictReader(open(os.path.join(src, "dom.csv"), encoding="utf-8-sig")))
fcol = [k for k in rows[0] if k.endswith("female")][0]
mcol = [k for k in rows[0] if k.endswith("__male")][0]
d = {}
for r in rows:
    a3 = r["code"]
    if len(a3) != 3 or not num(a3) or not r[fcol] or not r[mcol]:
        continue
    if a3 not in d or int(r["year"]) > d[a3]["y"]:
        f, m = float(r[fcol]), float(r[mcol])
        if m <= 0:
            continue
        d[a3] = {"y": int(r["year"]), "f": round(f, 2), "m": round(m, 2), "v": round(f / m, 2)}
layers["hours"] = d

# 2. Subsistence foodstuff production rate, latest year per country (one source per country: the latest)
j = json.load(open(os.path.join(src, "sfp.json")))
tmp = {}
for s in j["series"]["docs"]:
    dim = s["dimensions"]
    a3 = dim["ref_area"]
    if not num(a3):
        continue
    for p, v in zip(s["period"], s["value"]):
        if v in (None, "NA"):
            continue
        tmp.setdefault(a3, {}).setdefault((int(p), dim["source"]), {})[dim["sex"]] = float(v)
d = {}
for a3, by in tmp.items():
    full = {k: v for k, v in by.items() if {"SEX_T", "SEX_F", "SEX_M"} <= set(v)}
    if not full:
        continue
    k = max(full)
    v = full[k]
    d[a3] = {"y": k[0], "f": round(v["SEX_F"], 1), "m": round(v["SEX_M"], 1), "v": round(v["SEX_T"], 1)}
layers["subsistence"] = d

# 3. Contributing family workers as a share of employment, by sex, 2024
rows = list(csv.DictReader(open(os.path.join(src, "ste.csv"), encoding="utf-8-sig")))
tmp = {}
for r in rows:
    if r["classif1"] in ("STE_ICSE93_TOTAL", "STE_ICSE93_5") and r["obs_value"]:
        tmp.setdefault(r["ref_area"], {})[(r["sex"], r["classif1"])] = float(r["obs_value"])
d = {}
for a3, v in tmp.items():
    if not num(a3):
        continue
    try:
        sh = {s: 100 * v[(s, "STE_ICSE93_5")] / v[(s, "STE_ICSE93_TOTAL")] for s in ("SEX_F", "SEX_M", "SEX_T")}
    except (KeyError, ZeroDivisionError):
        continue
    d[a3] = {"y": 2024, "f": round(sh["SEX_F"], 1), "m": round(sh["SEX_M"], 1), "v": round(sh["SEX_F"], 1),
             "t": round(sh["SEX_T"], 1), "n": round(v[("SEX_F", "STE_ICSE93_5")] + v[("SEX_M", "STE_ICSE93_5")]),
             "nf": round(v[("SEX_F", "STE_ICSE93_5")])}
layers["family"] = d

# 4. Outside the labour force due to care responsibilities, latest year per country
rows = list(csv.DictReader(open(os.path.join(src, "carer.csv"), encoding="utf-8-sig")))
tmp = {}
for r in rows:
    if r["obs_value"]:
        tmp.setdefault(r["ref_area"], {}).setdefault(int(r["time"]), {})[r["sex"]] = float(r["obs_value"])
d = {}
for a3, by in tmp.items():
    if not num(a3):
        continue
    full = {y: v for y, v in by.items() if {"SEX_F", "SEX_M"} <= set(v)}
    if not full:
        continue
    y = max(full)
    v = full[y]
    d[a3] = {"y": y, "f": round(v["SEX_F"], 1), "m": round(v["SEX_M"], 1), "v": round(v["SEX_F"], 1)}
layers["carers"] = d

# 5-9. Reach of interventions: single figures from Our World in Data grapher exports, latest year per country.
# Surveys older than `since` are left out rather than shown as current.
for key, since in (("life", 2020), ("dtp3", 2020), ("births", 2005), ("contra", 2005), ("nets", 2005), ("protected", 2020)):
    rows = list(csv.DictReader(open(os.path.join(src, "owid_%s.csv" % key), encoding="utf-8-sig")))
    col = [c for c in rows[0] if c not in ("entity", "code", "year", "owid_region")][0]
    d = {}
    for r in rows:
        a3 = r["code"]
        if len(a3) != 3 or not num(a3) or r[col] == "" or int(r["year"]) < since or int(r["year"]) > 2025:
            continue
        if a3 not in d or int(r["year"]) > d[a3]["y"]:
            d[a3] = {"y": int(r["year"]), "v": round(float(r[col]), 1)}
    layers[key] = d

# More of the world: Our World in Data grapher exports (file owid_<key>.csv) and WHO Global Health
# Observatory OData downloads (file gho_<CODE>.json), latest year per country, nothing older than `since`.
MORE_OWID = [  # key, since, multiplier, decimals
    ("hale", 2015, 1, 1), ("u5", 2015, 10, 1), ("mmr", 2015, 1, 0), ("measles", 2020, 1, 0), ("hunger", 2015, 1, 1),
    ("stunting", 2010, 1, 1), ("water", 2015, 1, 0), ("sanitation", 2015, 1, 0), ("cleanfuel", 2020, 1, 0),
    ("agri", 2018, 1, 1), ("uhc", 2020, 1, 0), ("oop", 2018, 1, 0), ("forest", 2015, 1, 1), ("marine", 2020, 1, 1),
]
for key, since, mult, dec in MORE_OWID:
    rows = list(csv.DictReader(open(os.path.join(src, "owid_%s.csv" % key), encoding="utf-8-sig")))
    col = [c for c in rows[0] if c not in ("entity", "code", "year", "owid_region") and not c.endswith("annotations")][0]
    d = {}
    for r in rows:
        a3 = r["code"]
        if len(a3) != 3 or not num(a3) or r[col] == "" or not (since <= int(r["year"]) <= 2025):
            continue
        if a3 not in d or int(r["year"]) > d[a3]["y"]:
            d[a3] = {"y": int(r["year"]), "v": round(float(r[col]) * mult, dec)}
    layers[key] = d

MORE_WHO = [  # key, indicator code, since, keep(row), decimals, newest year allowed
    ("nurses", "HWF_0006", 2015, lambda r: True, 1, 2025),
    ("doctors", "HWF_0001", 2015, lambda r: True, 1, 2025),
    ("anc4", "WHS4_154", 2010, lambda r: True, 0, 2025),
    ("ebf", "NUT_BF_EBF", 2010, lambda r: r.get("Dim1Type") is None, 0, 2025),
    ("fp", "FAMILYPLANNINGUNPDUHC", 2024, lambda r: r.get("Dim2") == "MARITALSTATUS_TOTL", 0, 2024),
    ("handwash", "WSH_HYGIENE_BASIC", 2015, lambda r: r.get("Dim1") == "RESIDENCEAREATYPE_TOTL", 0, 2025),
]
for key, code, since, keep, dec, newest in MORE_WHO:
    rows = json.load(open(os.path.join(src, "gho_%s.json" % code), encoding="utf-8"))["value"]
    d = {}
    for r in rows:
        a3, y, v = r.get("SpatialDim"), r.get("TimeDim"), r.get("NumericValue")
        if r.get("SpatialDimType") != "COUNTRY" or v is None or not a3 or not num(a3) or not keep(r) or not (since <= y <= newest):
            continue
        if a3 not in d or y > d[a3]["y"]:
            d[a3] = {"y": y, "v": round(float(v), dec)}
    layers[key] = d

codes = sorted({a for L in layers.values() for a in L})
meta = {a: {"n": name(a), "id": num(a)} for a in codes}
json.dump({"countries": meta, "layers": layers}, open(out, "w"), separators=(",", ":"), ensure_ascii=False)
for k, L in layers.items():
    vals = sorted(x["v"] for x in L.values())
    q = lambda p: vals[int(p * (len(vals) - 1))]
    print(k, len(L), "min", vals[0], "q25", q(.25), "med", q(.5), "q75", q(.75), "q90", q(.9), "max", vals[-1],
          "years", min(x["y"] for x in L.values()), max(x["y"] for x in L.values()))
