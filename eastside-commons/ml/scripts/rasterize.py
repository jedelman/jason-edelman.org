"""
Rasterize OSM data to field arrays at 1px=1m.
Output per neighborhood: 6 numpy arrays (1000x1000 each):
  0. built        — binary building footprint mask
  1. street       — binary street mask  
  2. amenity      — amenity point density (gaussian kernel, r=50m)
  3. building_ht  — building height proxy (stories tag, default 3)
  4. landuse      — landuse category index
  5. connectivity — intersection density (gaussian kernel, r=100m)

Each array saved as float32 .npy. Also saves a metadata JSON.
"""

import json, numpy as np
from shapely.geometry import Polygon, LineString, Point, MultiPolygon
from shapely.ops import unary_union
import pyproj
from scipy.ndimage import gaussian_filter

GRID = 1000  # 1000m x 1000m at 1px=1m

def bbox_to_proj(lat_min, lon_min, lat_max, lon_max):
    """Get UTM projection centered on bbox."""
    cx = (lon_min + lon_max) / 2
    cy = (lat_min + lat_max) / 2
    utm_zone = int((cx + 180) / 6) + 1
    hem = "north" if cy >= 0 else "south"
    return pyproj.Proj(proj="utm", zone=utm_zone, ellps="WGS84", hemisphere=hem)

def latlon_to_xy(lat, lon, proj, origin_x, origin_y, scale):
    """Convert lat/lon to pixel coordinates."""
    x, y = proj(lon, lat)
    px = (x - origin_x) / scale
    py = (y - origin_y) / scale
    return px, py

def rasterize_polygon(coords_px, grid):
    """Rasterize a polygon into a binary grid."""
    from PIL import Image, ImageDraw
    img = Image.new("L", (grid, grid), 0)
    draw = ImageDraw.Draw(img)
    flat = [(x, grid - y) for x, y in coords_px]  # flip y
    if len(flat) >= 3:
        draw.polygon(flat, fill=1)
    return np.array(img, dtype=np.float32)

def rasterize_line(coords_px, grid, width=3):
    """Rasterize a linestring into a binary grid."""
    from PIL import Image, ImageDraw
    img = Image.new("L", (grid, grid), 0)
    draw = ImageDraw.Draw(img)
    flat = [(x, grid - y) for x, y in coords_px]
    if len(flat) >= 2:
        draw.line(flat, fill=1, width=width)
    return np.array(img, dtype=np.float32)

def process_neighborhood(name, data):
    bbox = data["bbox"]
    lat_min, lon_min, lat_max, lon_max = bbox
    proj = bbox_to_proj(lat_min, lon_min, lat_max, lon_max)
    
    # Origin = SW corner in projected coords
    ox, oy = proj(lon_min, lat_min)
    # Scale: fit bbox into GRID pixels
    ex, ey = proj(lon_max, lat_max)
    width_m  = ex - ox
    height_m = ey - oy
    scale = max(width_m, height_m) / GRID  # meters per pixel
    
    nodes = data["nodes"]
    
    def node_px(nid):
        n = nodes.get(str(nid)) or nodes.get(nid)
        if n is None: return None
        px, py = latlon_to_xy(n["lat"], n["lon"], proj, ox, oy, scale)
        return px, py
    
    def way_px(way):
        coords = []
        for nid in way.get("nodes", []):
            pt = node_px(nid)
            if pt: coords.append(pt)
        return coords
    
    # Field arrays
    built       = np.zeros((GRID, GRID), dtype=np.float32)
    street      = np.zeros((GRID, GRID), dtype=np.float32)
    amenity_pts = np.zeros((GRID, GRID), dtype=np.float32)
    bldg_ht     = np.zeros((GRID, GRID), dtype=np.float32)
    connectivity= np.zeros((GRID, GRID), dtype=np.float32)
    
    # Buildings
    for bldg in data["buildings"]:
        coords = way_px(bldg)
        if len(coords) < 3: continue
        mask = rasterize_polygon(coords, GRID)
        built += mask
        # Height proxy
        tags = bldg.get("tags", {})
        stories = float(tags.get("building:levels", tags.get("levels", 3)))
        bldg_ht += mask * stories
    
    built = np.clip(built, 0, 1)
    bldg_ht = np.where(built > 0, bldg_ht / np.maximum(built, 1e-6), 0)
    
    # Streets + intersections
    intersection_pts = []
    street_ways_px = []
    for st in data["streets"]:
        coords = way_px(st)
        if len(coords) < 2: continue
        street_ways_px.append(coords)
        mask = rasterize_line(coords, GRID)
        street += mask
    street = np.clip(street, 0, 1)
    
    # Intersection detection: endpoints that appear in >1 way
    from collections import Counter
    endpoint_count = Counter()
    for coords in street_ways_px:
        for pt in coords:
            key = (round(pt[0]), round(pt[1]))
            endpoint_count[key] += 1
    
    for (px, py), count in endpoint_count.items():
        if count >= 2 and 0 <= px < GRID and 0 <= py < GRID:
            connectivity[GRID - 1 - int(py), int(px)] += 1
    connectivity = gaussian_filter(connectivity, sigma=50)  # 50m radius
    
    # Amenities
    for am in data["amenities"]:
        pt = node_px(am["id"])
        if pt is None: continue
        px, py = pt
        if 0 <= px < GRID and 0 <= py < GRID:
            amenity_pts[GRID - 1 - int(py), int(px)] += 1
    amenity_pts = gaussian_filter(amenity_pts, sigma=50)  # 50m radius
    
    # Normalize amenity and connectivity to [0,1]
    for arr in [amenity_pts, connectivity]:
        mx = arr.max()
        if mx > 0: arr /= mx
    
    fields = {
        "built": built,
        "street": street,
        "amenity": amenity_pts,
        "building_height": bldg_ht,
        "connectivity": connectivity,
    }
    
    # Coverage stats
    stats = {
        "name": name,
        "label": data["label"],
        "bbox": bbox,
        "scale_m_per_px": scale,
        "coverage": {k: float(v.mean()) for k, v in fields.items()},
        "amenity_count": len(data["amenities"]),
        "building_count": len(data["buildings"]),
        "street_count": len(data["streets"]),
    }
    
    return fields, stats

# Load data
with open("/tmp/osm_raw.json") as f:
    raw = json.load(f)

pip_check = True
try:
    from PIL import Image, ImageDraw
except ImportError:
    import subprocess
    subprocess.run(["pip", "install", "pillow", "--break-system-packages", "-q"])
    from PIL import Image, ImageDraw

import os
os.makedirs("/tmp/osm_fields", exist_ok=True)

all_stats = {}
for name, data in raw.items():
    print(f"Rasterizing {name}...")
    try:
        fields, stats = process_neighborhood(name, data)
        for field_name, arr in fields.items():
            np.save(f"/tmp/osm_fields/{name}_{field_name}.npy", arr)
        all_stats[name] = stats
        print(f"  scale={stats['scale_m_per_px']:.2f}m/px  "
              f"built={stats['coverage']['built']:.3f}  "
              f"amenity={stats['coverage']['amenity']:.4f}  "
              f"conn={stats['coverage']['connectivity']:.4f}")
    except Exception as e:
        import traceback
        print(f"  ERROR: {e}")
        traceback.print_exc()

with open("/tmp/osm_fields/metadata.json", "w") as f:
    json.dump(all_stats, f, indent=2)

print("\nDone. Files in /tmp/osm_fields/")
print(os.listdir("/tmp/osm_fields/"))
