"""
fetch.py — Pull Norfolk parcel + assessment data for HC-G2 zoning analysis.

Datasets used:
  ere7-kake  Address Information (planning district, civic league, lat/lng)
  m5ya-5grb  Property Assessment FY26
  g7sg-tivf  Property Assessment FY25
  fahm-yuh4  Permits (zoning permits)
  agip-sqwc  Violations

Outputs to data/cache/ (gitignored) and data/output/.
Run: python3 fetch.py
"""

import os
import json
import pandas as pd
from sodapy import Socrata

APP_TOKEN = "zMCBjEV4SBnmQJtMvEiRipdFq"
DOMAIN    = "data.norfolk.gov"

CACHE_DIR  = os.path.join(os.path.dirname(__file__), "../cache")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "../output")
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Dataset codes
ADDRESSES   = "ere7-kake"
ASSESS_FY26 = "m5ya-5grb"
ASSESS_FY25 = "g7sg-tivf"
ASSESS_FY24 = "9gmp-9x4c"
ASSESS_FY23 = "yvpm-8aid"
PERMITS     = "fahm-yuh4"
VIOLATIONS  = "agip-sqwc"

# Ghent HC-G2 planning districts and zips
GHENT_PDS   = ("61", "62", "63", "64")
GHENT_ZIPS  = ("23507", "23517")

def get_client():
    return Socrata(DOMAIN, APP_TOKEN, timeout=120)

def cached(name, fetch_fn):
    path = os.path.join(CACHE_DIR, f"{name}.csv")
    if os.path.exists(path):
        print(f"  [cache] {name}")
        return pd.read_csv(path, dtype=str)
    print(f"  [fetch] {name} ...")
    df = fetch_fn()
    df.to_csv(path, index=False)
    print(f"  [saved] {name} ({len(df)} rows)")
    return df


# ── 1. Ghent addresses (planning district + GPIN) ────────────────────────────

def fetch_ghent_addresses():
    client = get_client()
    rows = client.get(ADDRESSES,
        select="full_address,gpin,civic_league,planning_district_name,planning_district_number,zip_codes,parcel_centroid_latitude,parcel_centroid_longitude",
        where=f"planning_district_number in {GHENT_PDS}",
        limit=10000)
    return pd.DataFrame.from_records(rows)

# ── 2. Assessments by zip (FY26 and FY25 for year-over-year) ─────────────────

def fetch_assessments(dataset_code, label):
    client = get_client()
    zip_clause = " or ".join(f"property_zip like '{z}%'" for z in GHENT_ZIPS)
    rows = client.get(dataset_code,
        where=f"({zip_clause})",
        limit=10000)
    return pd.DataFrame.from_records(rows)

# ── 3. Colley Ave assessments (PCO comparison baseline) ──────────────────────

def fetch_colley_assessments():
    client = get_client()
    # Street name is mixed case in this dataset
    rows = client.get(ASSESS_FY26,
        where="property_street_name = 'Colley'",
        limit=500)
    return pd.DataFrame.from_records(rows)

# ── 4. Zoning permits in Ghent area ──────────────────────────────────────────

def fetch_ghent_permits():
    client = get_client()
    zip_clause = " or ".join(f"zip like '{z}%'" for z in GHENT_ZIPS)
    rows = client.get(PERMITS,
        where=f"({zip_clause}) and permit_type like '%Zoning%'",
        limit=2000)
    return pd.DataFrame.from_records(rows)

# ── 5. Multi-year assessments for trending ───────────────────────────────────

def fetch_multiyear():
    """Pull FY23-FY26 for year-over-year value trends."""
    frames = {}
    for code, label in [(ASSESS_FY26,"fy26"),(ASSESS_FY25,"fy25"),(ASSESS_FY24,"fy24"),(ASSESS_FY23,"fy23")]:
        frames[label] = cached(f"assess_{label}_ghent", lambda c=code, l=label: fetch_assessments(c, l))
    return frames


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== Fetching Ghent / HC-G2 parcel data ===\n")

    addr   = cached("ghent_addresses",      fetch_ghent_addresses)
    fy26   = cached("assess_fy26_ghent",    lambda: fetch_assessments(ASSESS_FY26, "fy26"))
    fy25   = cached("assess_fy25_ghent",    lambda: fetch_assessments(ASSESS_FY25, "fy25"))
    colley = cached("colley_assessments",   fetch_colley_assessments)

    print(f"\nAddresses fetched:       {len(addr):>6,}")
    print(f"FY26 assessments:        {len(fy26):>6,}")
    print(f"FY25 assessments:        {len(fy25):>6,}")
    print(f"Colley Ave assessments:  {len(colley):>6,}")

    # ── Join addresses → FY26 assessments on GPIN ────────────────────────────
    addr["gpin"] = addr["gpin"].astype(str).str.strip()
    fy26["gpin"] = fy26["gpin"].astype(str).str.strip()

    # Deduplicate addresses: one address row per GPIN (take first)
    addr_dedup = addr.drop_duplicates(subset="gpin")[
        ["gpin","planning_district_number","planning_district_name","civic_league",
         "parcel_centroid_latitude","parcel_centroid_longitude"]
    ]

    merged = fy26.merge(addr_dedup, on="gpin", how="left")

    # Filter to confirmed Ghent planning districts
    ghent = merged[merged["planning_district_number"].isin(GHENT_PDS)].copy()

    print(f"\nGhent parcels (FY26, PD 61-64): {len(ghent):,}")

    ghent.to_csv(os.path.join(OUTPUT_DIR, "hcg2_parcels_fy26.csv"), index=False)
    colley.to_csv(os.path.join(OUTPUT_DIR, "colley_parcels_fy26.csv"), index=False)

    print("\nSaved: data/output/hcg2_parcels_fy26.csv")
    print("Saved: data/output/colley_parcels_fy26.csv")
    print("\nRun analyze.py next.")
