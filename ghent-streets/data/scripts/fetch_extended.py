"""
fetch_extended.py — Extended data pulls:
  1. Colley Ave multi-year assessments (FY21-FY26) for PCO appreciation curve
  2. Permits/zoning history in Ghent (CUP barrier evidence)
  3. Known commercial parcels in HC-G2 (7-Eleven, Harris Teeter) by address
"""

import os, json
import pandas as pd
from sodapy import Socrata

APP_TOKEN = "zMCBjEV4SBnmQJtMvEiRipdFq"
DOMAIN    = "data.norfolk.gov"
CACHE_DIR  = os.path.join(os.path.dirname(__file__), "../cache")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "../output")

ASSESS_CODES = {
    "fy21": "8bfx-a5g8",
    "fy22": "7tu9-2ytx",
    "fy23": "yvpm-8aid",
    "fy24": "9gmp-9x4c",
    "fy25": "g7sg-tivf",
    "fy26": "m5ya-5grb",
}
PERMITS    = "fahm-yuh4"
VIOLATIONS = "agip-sqwc"
GHENT_ZIPS = ("23507", "23517")

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


# ── 1. Colley Ave multi-year assessments ─────────────────────────────────────

def fetch_colley_year(code):
    client = get_client()
    rows = client.get(code, where="property_street_name = 'Colley'", limit=500)
    return pd.DataFrame.from_records(rows)

def build_colley_multiyear():
    frames = []
    for yr, code in ASSESS_CODES.items():
        df = cached(f"colley_{yr}", lambda c=code: fetch_colley_year(c))
        df["fiscal_year"] = yr
        df["year_num"] = int(yr[2:]) + 2000
        frames.append(df)
    return pd.concat(frames, ignore_index=True)


# ── 2. Permits in Ghent (CUP / zoning history) ───────────────────────────────

GHENT_CIVIC_LEAGUES = (
    "Ghent Neighborhood League",
    "Ghent Square Community Association",
    "West Ghent",
)

def fetch_ghent_permits():
    """Zoning permits in Ghent — filter by type=Zoning + Ghent street addresses."""
    client = get_client()
    # Ghent streets: Colonial, Mowbray, Westover, Pembroke, etc.
    # Use address patterns for the core Colonial Ave corridor
    addr_clause = (
        "address like '%COLONIAL%' or "
        "address like '%MOWBRAY%' or "
        "address like '%WESTOVER%' or "
        "address like '%PEMBROKE%' or "
        "address like '%GRAYDON%' or "
        "address like '%BOISSEVAIN%' or "
        "address like '%SPOTSWOOD%'"
    )
    rows = client.get(PERMITS,
        where=f"type = 'Zoning' and ({addr_clause})",
        limit=2000)
    return pd.DataFrame.from_records(rows)

def fetch_ghent_violations():
    """Code violations in Ghent civic league areas."""
    client = get_client()
    league_clause = " or ".join(
        f"civic_league = '{l}'" for l in GHENT_CIVIC_LEAGUES
    )
    rows = client.get(VIOLATIONS,
        where=f"({league_clause})",
        limit=5000)
    return pd.DataFrame.from_records(rows)


# ── 3. Known HC-G2 commercial parcels ────────────────────────────────────────

def fetch_known_commercial():
    """Pull commercial parcels on Colonial Ave and W 21st St in the HC-G2 area."""
    client = get_client()
    targets = [
        ("Colonial Ave commercial",
         "property_street_name = 'Colonial' and property_use = 'Commercial'"),
        ("W 21st St commercial (7-Eleven area)",
         "property_street_name = '21st' and property_street_type = 'ST' and property_use = 'Commercial'"),
        ("Harris Teeter / grocery area",
         "property_street_name = 'Colonial' and property_class_description like '%Supermarket%'"),
        ("Colonial Ave all uses",
         "property_street_name = 'Colonial' and property_zip like '23507%'"),
    ]
    all_rows = []
    for label, where in targets:
        rows = client.get("m5ya-5grb", where=where, limit=30)
        for r in rows:
            r["search_label"] = label
        all_rows.extend(rows)
    return pd.DataFrame.from_records(all_rows) if all_rows else pd.DataFrame()


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== Extended data fetch ===\n")

    # 1. Multi-year Colley
    print("1. Colley Ave multi-year assessments (FY21-FY26)")
    colley_multi = build_colley_multiyear()
    colley_multi.to_csv(os.path.join(OUTPUT_DIR, "colley_multiyear.csv"), index=False)
    print(f"   Total rows: {len(colley_multi)}")

    # 2. Permits
    print("\n2. Ghent permits (zoning history)")
    permits = cached("ghent_permits", fetch_ghent_permits)
    print(f"   Columns: {list(permits.columns)}")
    print(f"   Total rows: {len(permits)}")

    # 3. Violations
    print("\n3. Ghent violations")
    violations = cached("ghent_violations", fetch_ghent_violations)
    print(f"   Total rows: {len(violations)}")

    # 4. Known commercial
    print("\n4. Known HC-G2 commercial parcels")
    known = fetch_known_commercial()
    if len(known):
        print(known[["property_street_number","property_street_name","property_street_type",
                      "owner","property_class_description","current_total_value"]].to_string())
    else:
        print("   No rows returned")

    print("\nDone.")
