"""
analyze_extended.py — Extended analysis:
  1. Colley Ave multi-year appreciation curve (FY21-FY26)
  2. Zoning permits in Ghent (CUP barrier evidence)
  3. Colonial Ave commercial vs residential AV comparison
  4. Combined summary update to hcg2_summary.json
"""

import os, json
import pandas as pd

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "../output")
CACHE_DIR  = os.path.join(os.path.dirname(__file__), "../cache")

def load_colley_multiyear():
    df = pd.read_csv(os.path.join(OUTPUT_DIR, "colley_multiyear.csv"), dtype=str)
    for col in ["current_total_value","current_land_value","current_improvement_value"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["year_num"] = pd.to_numeric(df["year_num"], errors="coerce")
    return df

def load_permits():
    return pd.read_csv(os.path.join(CACHE_DIR, "ghent_permits.csv"), dtype=str)

def load_violations():
    return pd.read_csv(os.path.join(CACHE_DIR, "ghent_violations.csv"), dtype=str)

def load_colonial():
    # Read from the extended fetch output (Colonial Ave all uses)
    from sodapy import Socrata
    client = Socrata("data.norfolk.gov", "zMCBjEV4SBnmQJtMvEiRipdFq", timeout=60)
    rows = client.get("m5ya-5grb",
        where="property_street_name = 'Colonial' and property_zip like '23507%'",
        limit=200)
    df = pd.DataFrame.from_records(rows)
    df["current_total_value"] = pd.to_numeric(df["current_total_value"], errors="coerce")
    return df


def analyze():
    lines = []
    summary = {}

    def h(t):
        lines.append(""); lines.append("=" * 60)
        lines.append(t.upper()); lines.append("=" * 60)

    # ── 1. Colley multi-year value trend ─────────────────────────────────────
    h("1. Colley Avenue Value Trend (FY21-FY26)")

    colley = load_colley_multiyear()
    commercial = colley[colley["property_use"] == "Commercial"]
    residential = colley[colley["property_use"].str.contains("Residential|Single Family|Townhouse|Condo", case=False, na=False)]
    apartment = colley[colley["property_use"].str.contains("Apartment", case=False, na=False)]

    # Aggregate by year
    com_trend = commercial.groupby("year_num")["current_total_value"].agg(["median","mean","count"]).round(0)
    res_trend = residential.groupby("year_num")["current_total_value"].agg(["median","mean","count"]).round(0)

    lines.append("\n  Commercial parcels by fiscal year:")
    lines.append(f"  {'Year':<8} {'Count':>6} {'Median AV':>14} {'Mean AV':>14}")
    lines.append("  " + "-"*46)
    for yr, row in com_trend.iterrows():
        lines.append(f"  {yr:<8} {int(row['count']):>6} ${row['median']:>13,.0f} ${row['mean']:>13,.0f}")

    lines.append("\n  Residential parcels by fiscal year:")
    lines.append(f"  {'Year':<8} {'Count':>6} {'Median AV':>14} {'Mean AV':>14}")
    lines.append("  " + "-"*46)
    for yr, row in res_trend.iterrows():
        lines.append(f"  {yr:<8} {int(row['count']):>6} ${row['median']:>13,.0f} ${row['mean']:>13,.0f}")

    # Calculate FY21→FY26 appreciation
    if 2021 in com_trend.index and 2026 in com_trend.index:
        com_change = (com_trend.loc[2026,"median"] - com_trend.loc[2021,"median"]) / com_trend.loc[2021,"median"] * 100
        res_change = (res_trend.loc[2026,"median"] - res_trend.loc[2021,"median"]) / res_trend.loc[2021,"median"] * 100 if 2021 in res_trend.index and 2026 in res_trend.index else None
        lines.append(f"\n  Colley commercial median AV change FY21→FY26: {com_change:+.1f}%")
        if res_change:
            lines.append(f"  Colley residential median AV change FY21→FY26: {res_change:+.1f}%")

    summary["colley_multiyear"] = {
        "commercial_trend": {
            str(int(yr)): {"median_av": int(row["median"]), "mean_av": int(row["mean"]), "count": int(row["count"])}
            for yr, row in com_trend.iterrows()
        },
        "residential_trend": {
            str(int(yr)): {"median_av": int(row["median"]), "mean_av": int(row["mean"]), "count": int(row["count"])}
            for yr, row in res_trend.iterrows()
        },
    }

    # ── 2. Zoning permits analysis ───────────────────────────────────────────
    h("2. Zoning Permits in Ghent (CUP Barrier Evidence)")

    permits = load_permits()
    lines.append(f"  Total zoning permits found: {len(permits)}")

    if "status" in permits.columns:
        status_counts = permits["status"].value_counts()
        lines.append("\n  By status:")
        for s, c in status_counts.items():
            lines.append(f"    {str(s):<35} {c:>4}")

    if "use_type" in permits.columns:
        use_counts = permits["use_type"].value_counts()
        lines.append("\n  By use type (top 15):")
        for u, c in use_counts.head(15).items():
            if str(u) != "nan":
                lines.append(f"    {str(u):<45} {c:>4}")

    if "work_type" in permits.columns:
        work_counts = permits["work_type"].value_counts()
        lines.append("\n  By work type:")
        for w, c in work_counts.head(10).items():
            if str(w) != "nan":
                lines.append(f"    {str(w):<45} {c:>4}")

    # Look for CUP-like entries
    if "use_class" in permits.columns:
        lines.append("\n  Use class values:")
        for uc, c in permits["use_class"].value_counts().head(15).items():
            if str(uc) != "nan":
                lines.append(f"    {str(uc):<45} {c:>4}")

    summary["zoning_permits"] = {
        "total": int(len(permits)),
        "by_status": {str(k): int(v) for k, v in permits.get("status", pd.Series()).value_counts().items()} if "status" in permits.columns else {},
        "by_use_type": {str(k): int(v) for k, v in permits.get("use_type", pd.Series()).value_counts().head(20).items()} if "use_type" in permits.columns else {},
    }

    # ── 3. Violations analysis ───────────────────────────────────────────────
    h("3. Violations in Ghent Civic League Areas")

    violations = load_violations()
    lines.append(f"  Total violations: {len(violations)}")

    if "ordinance" in violations.columns:
        ord_counts = violations["ordinance"].value_counts()
        lines.append("\n  By ordinance type (top 10):")
        for o, c in ord_counts.head(10).items():
            lines.append(f"    {str(o):<50} {c:>4}")

    if "civic_league" in violations.columns:
        league_counts = violations["civic_league"].value_counts()
        lines.append("\n  By civic league:")
        for l, c in league_counts.items():
            lines.append(f"    {str(l):<45} {c:>4}")

    # ── 4. Colonial Ave: commercial vs residential AV comparison ─────────────
    h("4. Colonial Avenue: Commercial vs Residential AV")

    try:
        colonial = load_colonial()
        com = colonial[colonial["property_use"] == "Commercial"]
        res = colonial[colonial["property_use"].str.contains("Single Family|Townhouse|Attached|Detached|Condo", case=False, na=False)]

        lines.append(f"  Total Colonial Ave parcels (zip 23507): {len(colonial)}")
        lines.append(f"  Commercial parcels: {len(com)}")
        lines.append(f"  Residential parcels: {len(res)}")
        lines.append(f"\n  Commercial AV (mean):    ${com['current_total_value'].mean():>12,.0f}")
        lines.append(f"  Commercial AV (median):  ${com['current_total_value'].median():>12,.0f}")
        lines.append(f"  Residential AV (mean):   ${res['current_total_value'].mean():>12,.0f}")
        lines.append(f"  Residential AV (median): ${res['current_total_value'].median():>12,.0f}")

        lines.append("\n  Commercial parcels on Colonial Ave:")
        lines.append(f"  {'Addr':>6} {'Class':<38} {'Owner':<35} {'AV':>12}")
        lines.append("  " + "-"*97)
        for _, row in com.sort_values("current_total_value", ascending=False).iterrows():
            lines.append(f"  {str(row.get('property_street_number',''))[:6]:>6} "
                         f"{str(row.get('property_class_description',''))[:37]:<38} "
                         f"{str(row.get('owner',''))[:34]:<35} "
                         f"${float(row['current_total_value']):>11,.0f}")

        summary["colonial_ave"] = {
            "total_parcels": int(len(colonial)),
            "commercial_count": int(len(com)),
            "commercial_mean_av": round(com["current_total_value"].mean(), 0),
            "commercial_median_av": round(com["current_total_value"].median(), 0),
            "residential_count": int(len(res)),
            "residential_mean_av": round(res["current_total_value"].mean(), 0),
            "residential_median_av": round(res["current_total_value"].median(), 0),
            "notable_parcels": [
                {"address": str(r.get("property_street_number","")) + " Colonial Ave",
                 "class": str(r.get("property_class_description","")),
                 "owner": str(r.get("owner","")),
                 "av": int(r["current_total_value"])}
                for _, r in com.sort_values("current_total_value", ascending=False).iterrows()
            ]
        }
    except Exception as e:
        lines.append(f"  [colonial data fetch error: {e}]")

    # ── Write outputs ─────────────────────────────────────────────────────────
    report = "\n".join(lines)
    print(report)

    with open(os.path.join(OUTPUT_DIR, "extended_analysis.txt"), "w") as f:
        f.write(report)

    # Merge into existing summary
    existing_path = os.path.join(OUTPUT_DIR, "hcg2_summary.json")
    existing = {}
    if os.path.exists(existing_path):
        with open(existing_path) as f:
            existing = json.load(f)
    existing.update(summary)
    with open(existing_path, "w") as f:
        json.dump(existing, f, indent=2)

    print("\n\nSaved: data/output/extended_analysis.txt")
    print("Updated: data/output/hcg2_summary.json")


if __name__ == "__main__":
    analyze()
