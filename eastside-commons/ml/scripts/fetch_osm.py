import requests, json, time

OVERPASS = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "alexander-pattern-validator/0.1 (edelmanja@gmail.com)"}

NEIGHBORHOODS = {
    "barcelona_eixample":    {"bbox": (41.385, 2.158, 41.395, 2.172),    "label": "positive"},
    "greenwich_village_nyc": {"bbox": (40.727, -74.006, 40.737, -73.996), "label": "positive"},
    "tysons_corner_va":      {"bbox": (38.918, -77.232, 38.928, -77.222), "label": "negative"},
    "military_circle_norfolk":{"bbox": (36.852, -76.202, 36.862, -76.192),"label": "target"},
    "kyoto_gion":            {"bbox": (35.002, 135.773, 35.012, 135.783), "label": "positive"},
}

QUERY = """[out:json][timeout:60];
(
  way["building"]({b});
  way["highway"]({b});
  node["amenity"]({b});
  node["shop"]({b});
  node["leisure"]({b});
  way["leisure"="park"]({b});
  way["landuse"]({b});
);
out body; >; out skel qt;"""

results = {}
for name, cfg in NEIGHBORHOODS.items():
    lat_min, lon_min, lat_max, lon_max = cfg["bbox"]
    b = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    try:
        r = requests.post(OVERPASS, data={"data": QUERY.format(b=b)},
                         headers=HEADERS, timeout=90)
        r.raise_for_status()
        data = r.json()
        els = data["elements"]
        nodes = {e["id"]: e for e in els if e["type"] == "node"}
        ways  = [e for e in els if e["type"] == "way"]
        buildings = [w for w in ways if "building" in w.get("tags", {})]
        streets   = [w for w in ways if "highway"  in w.get("tags", {})]
        amenities = [e for e in els if e["type"] == "node" and
                     any(k in e.get("tags",{}) for k in ["amenity","shop","leisure"])]
        results[name] = {
            "label": cfg["label"], "bbox": cfg["bbox"],
            "stats": {"buildings": len(buildings), "streets": len(streets),
                      "amenities": len(amenities), "nodes": len(nodes)},
            "nodes": nodes, "buildings": buildings,
            "streets": streets, "amenities": amenities,
        }
        print(f"✓ {name}: {len(buildings)} bldg  {len(streets)} streets  {len(amenities)} amenities")
        time.sleep(3)
    except Exception as e:
        print(f"✗ {name}: {e}")

with open("/tmp/osm_raw.json","w") as f:
    json.dump(results, f)
print("Saved /tmp/osm_raw.json")
