"""
analyze.py — Generate HC-G2 zoning reform economic analysis from real parcel data.

Reads:  data/output/hcg2_parcels_fy26.csv
        data/output/colley_parcels_fy26.csv
        data/cache/assess_fy25_ghent.csv  (for year-over-year)

Writes: data/output/hcg2_summary.json   (machine-readable stats for Brief No. 2)
        data/output/hcg2_analysis.txt    (human-readable report)
"""

import os, json
import pandas as pd

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "../output")
CACHE_DIR  = os.path.join(os.path.dirname(__file__), "../cache")

# ── Norfolk FY2025 tax rates ──────────────────────────────────────────────────
REAL_ESTATE_RATE   = 1.25 / 100   # $1.25 per $100 assessed value
MEALS_TAX_RATE     = 0.065         # 6.5% of food/bev gross sales
SALES_TAX_CITY     = 0.01          # 1.0% city share of Virginia sales tax
BPOL_RATE          = 0.20 / 100   # $0.20 per $100 gross receipts

# ── Load data ─────────────────────────────────────────────────────────────────
def load():
    ghent  = pd.read_csv(os.path.join(OUTPUT_DIR, "hcg2_parcels_fy26.csv"), dtype=str)
    colley = pd.read_csv(os.path.join(OUTPUT_DIR, "colley_parcels_fy26.csv"), dtype=str)
    fy25_path = os.path.join(CACHE_DIR, "assess_fy25_ghent.csv")
    fy25   = pd.read_csv(fy25_path, dtype=str) if os.path.exists(fy25_path) else None

    for df in [ghent, colley]:
        for col in ["current_total_value","current_land_value","current_improvement_value",
                    "acreage","land_square_footage","commercial_building_area"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

    if fy25 is not None:
        for col in ["current_total_value","current_land_value","current_improvement_value"]:
            fy25[col] = pd.to_numeric(fy25[col], errors="coerce")

    return ghent, colley, fy25


def analyze():
    ghent, colley, fy25 = load()

    lines = []
    summary = {}

    def h(title):
        lines.append("")
        lines.append("=" * 60)
        lines.append(title.upper())
        lines.append("=" * 60)

    def p(label, value):
        lines.append(f"  {label:<42} {value}")

    # ── 1. Ghent overview ────────────────────────────────────────────────────
    h("1. Ghent HC-G2 Parcel Overview (FY26)")

    by_pd = ghent.groupby("planning_district_name").size().sort_values(ascending=False)
    p("Total parcels (PD 61-64):", f"{len(ghent):,}")
    lines.append("")
    lines.append("  By planning district:")
    for pd_name, count in by_pd.items():
        lines.append(f"    {pd_name:<40} {count:>5,}")

    by_use = ghent["property_use"].value_counts()
    lines.append("")
    lines.append("  By property use:")
    for use, count in by_use.head(15).items():
        lines.append(f"    {str(use):<40} {count:>5,}")

    summary["total_parcels_ghent"] = int(len(ghent))
    summary["parcels_by_use"] = {str(k): int(v) for k, v in by_use.items()}
    summary["parcels_by_planning_district"] = {str(k): int(v) for k, v in by_pd.items()}

    # ── 2. Assessed values ───────────────────────────────────────────────────
    h("2. Assessed Values — Ghent (FY26)")

    total_av    = ghent["current_total_value"].sum()
    mean_av     = ghent["current_total_value"].mean()
    median_av   = ghent["current_total_value"].median()

    p("Total assessed value (all uses):", f"${total_av:>15,.0f}")
    p("Mean assessed value per parcel:", f"${mean_av:>15,.0f}")
    p("Median assessed value per parcel:", f"${median_av:>15,.0f}")

    # Residential only
    residential = ghent[ghent["property_use"].str.contains("Residential|Single Family|Townhouse|Condo", case=False, na=False)]
    commercial  = ghent[ghent["property_use"].str.contains("Commercial|Office|Retail|Restaurant|Store", case=False, na=False)]
    apartment   = ghent[ghent["property_use"].str.contains("Apartment", case=False, na=False)]

    lines.append("")
    p("Residential parcels:", f"{len(residential):,}")
    p("  Avg assessed value:", f"${residential['current_total_value'].mean():>15,.0f}")
    p("Apartment parcels:", f"{len(apartment):,}")
    p("  Avg assessed value:", f"${apartment['current_total_value'].mean():>15,.0f}")
    p("Commercial parcels:", f"{len(commercial):,}")
    p("  Avg assessed value:", f"${commercial['current_total_value'].mean():>15,.0f}")

    summary["assessed_values_ghent"] = {
        "total": int(total_av),
        "mean":  round(mean_av, 0),
        "median": round(median_av, 0),
        "residential_count": int(len(residential)),
        "residential_mean_av": round(residential['current_total_value'].mean(), 0),
        "apartment_count": int(len(apartment)),
        "apartment_mean_av": round(apartment['current_total_value'].mean(), 0),
        "commercial_count": int(len(commercial)),
        "commercial_mean_av": round(commercial['current_total_value'].mean(), 0) if len(commercial) else 0,
    }

    # ── 3. Year-over-year (FY25 → FY26) ─────────────────────────────────────
    h("3. Year-over-Year Assessment Change (FY25 → FY26)")

    if fy25 is not None:
        # Scope FY25 to only the GPINs in our confirmed Ghent (PD 61-64) set
        ghent_gpins = set(ghent["gpin"].astype(str).str.strip())
        fy25["gpin"] = fy25["gpin"].astype(str).str.strip()
        fy25_ghent = fy25[fy25["gpin"].isin(ghent_gpins)].copy()

        ghent_cp = ghent[["gpin","current_total_value"]].copy()
        ghent_cp["gpin"] = ghent_cp["gpin"].astype(str).str.strip()

        yoy = ghent_cp.merge(
            fy25_ghent[["gpin","current_total_value"]].rename(columns={"current_total_value":"fy25_value"}),
            on="gpin", how="inner")
        yoy["change"] = yoy["current_total_value"] - yoy["fy25_value"]
        yoy["pct_change"] = yoy["change"] / yoy["fy25_value"] * 100

        p("Parcels with both years of data:", f"{len(yoy):,}")
        p("Median value change FY25→FY26:", f"${yoy['change'].median():>+15,.0f}")
        p("Median % change:", f"{yoy['pct_change'].median():>+14.1f}%")
        p("Mean % change:", f"{yoy['pct_change'].mean():>+14.1f}%")
        p("Total appreciation (sum of gains):", f"${yoy['change'].sum():>15,.0f}")

        summary["yoy_fy25_to_fy26"] = {
            "matched_parcels": int(len(yoy)),
            "median_change_dollars": round(yoy["change"].median(), 0),
            "median_change_pct": round(yoy["pct_change"].median(), 2),
            "mean_change_pct": round(yoy["pct_change"].mean(), 2),
            "total_appreciation": round(yoy["change"].sum(), 0),
        }
    else:
        lines.append("  [FY25 data not available]")

    # ── 4. Colley Ave PCO comparison ─────────────────────────────────────────
    h("4. Colley Avenue PCO — Comparison Baseline")

    colley_commercial = colley[colley["property_use"].str.contains("Commercial|Office|Retail|Restaurant|Store", case=False, na=False)]
    colley_residential = colley[colley["property_use"].str.contains("Residential|Single Family|Townhouse|Condo", case=False, na=False)]
    colley_apartment  = colley[colley["property_use"].str.contains("Apartment", case=False, na=False)]

    p("Total Colley Ave parcels:", f"{len(colley):,}")
    p("Commercial parcels:", f"{len(colley_commercial):,}")
    p("  Avg assessed value:", f"${colley_commercial['current_total_value'].mean():>15,.0f}" if len(colley_commercial) else "n/a")
    p("Residential parcels:", f"{len(colley_residential):,}")
    p("  Avg assessed value:", f"${colley_residential['current_total_value'].mean():>15,.0f}" if len(colley_residential) else "n/a")
    p("Apartment parcels:", f"{len(colley_apartment):,}")

    lines.append("")
    lines.append("  Colley commercial property use breakdown:")
    for use, count in colley_commercial["property_use"].value_counts().items():
        lines.append(f"    {str(use):<40} {count:>5,}")

    lines.append("")
    lines.append("  Colley property class breakdown:")
    for cls, count in colley_commercial["property_class_description"].value_counts().head(15).items():
        lines.append(f"    {str(cls):<50} {count:>4,}")

    summary["colley_pco"] = {
        "total_parcels": int(len(colley)),
        "commercial_count": int(len(colley_commercial)),
        "commercial_mean_av": round(colley_commercial["current_total_value"].mean(), 0) if len(colley_commercial) else 0,
        "residential_count": int(len(colley_residential)),
        "residential_mean_av": round(colley_residential["current_total_value"].mean(), 0) if len(colley_residential) else 0,
        "apartment_count": int(len(colley_apartment)),
        "use_breakdown": {str(k): int(v) for k, v in colley_commercial["property_use"].value_counts().items()},
    }

    # ── 5. Commercial premium calculation ────────────────────────────────────
    h("5. Commercial Value Premium (Colley vs Ghent Residential)")

    ghent_res_mean  = residential["current_total_value"].mean()
    colley_com_mean = colley_commercial["current_total_value"].mean() if len(colley_commercial) else 0
    ghent_com_mean  = commercial["current_total_value"].mean() if len(commercial) else 0

    if ghent_res_mean and colley_com_mean:
        premium_colley_vs_ghent_res = (colley_com_mean - ghent_res_mean) / ghent_res_mean * 100
        lines.append(f"  Ghent residential mean AV:       ${ghent_res_mean:>12,.0f}")
        lines.append(f"  Ghent commercial mean AV:        ${ghent_com_mean:>12,.0f}")
        lines.append(f"  Colley commercial mean AV:       ${colley_com_mean:>12,.0f}")
        lines.append(f"  Colley commercial premium over")
        lines.append(f"    Ghent residential:              {premium_colley_vs_ghent_res:>+12.1f}%")

    summary["commercial_premium"] = {
        "ghent_residential_mean_av": round(ghent_res_mean, 0),
        "ghent_commercial_mean_av": round(ghent_com_mean, 0) if ghent_com_mean else 0,
        "colley_commercial_mean_av": round(colley_com_mean, 0) if colley_com_mean else 0,
        "colley_vs_ghent_res_premium_pct": round(premium_colley_vs_ghent_res, 1) if ghent_res_mean and colley_com_mean else None,
    }

    # ── 6. Revenue projection (using real parcel data) ───────────────────────
    h("6. Revenue Projection — Updated with Real Parcel Data")

    # Activatable parcels: residential/apartment parcels with street frontage potential
    # Proxy: parcels in PD 64 (core Ghent) that are NOT already commercial
    pd64 = ghent[ghent["planning_district_number"] == "64"]
    pd64_noncommercial = pd64[~pd64["property_use"].str.contains("Commercial|Office|Retail|Restaurant|Store", case=False, na=False)]

    # Street-facing proxy: look for parcels with low acreage (urban lot) and improvement > 0
    street_facing = pd64_noncommercial[
        (pd64_noncommercial["acreage"].notna()) &
        (pd64_noncommercial["acreage"] < 0.25) &
        (pd64_noncommercial["current_improvement_value"] > 0)
    ]

    p("PD 64 (core Ghent) total parcels:", f"{len(pd64):,}")
    p("PD 64 non-commercial parcels:", f"{len(pd64_noncommercial):,}")
    p("PD 64 small urban lots w/ structure:", f"{len(street_facing):,}")
    lines.append("    (proxy for street-facing activatable parcels)")

    # Property tax uplift: use Colley 418 Retail/Apartment Over (mixed-use conversion comparable)
    # These are the properties on Colley most analogous to what Ghent ground-floor activations would be.
    # Exclude large outliers (>$1M) — the small mixed-use lots are the right comparable.
    colley_mixed = colley[
        (colley["property_class_description"].str.contains("418", na=False)) &
        (colley["current_total_value"] < 1_000_000)
    ]
    colley_mixed_mean = colley_mixed["current_total_value"].mean() if len(colley_mixed) > 0 else 400000

    # Ghent single-family detached mean AV is the residential baseline for conversion parcels
    ghent_sf = ghent[ghent["property_use"] == "Single Family - Detached"]
    ghent_sf_mean = ghent_sf["current_total_value"].mean() if len(ghent_sf) > 0 else ghent_res_mean

    # Uplift = mixed-use comparable AV - baseline residential AV (floor at $50K)
    # Use Colley mixed-use mean as the post-activation value ceiling;
    # for single-family conversions the uplift is more modest (~$100-200K)
    # Apply conservative ($100K) and aggressive ($200K) uplift assumptions
    uplift_conservative = 100_000
    uplift_aggressive   = 200_000

    # Revenue model — conservative and aggressive
    scenarios = {
        "conservative": {"activations": 15, "fb_share": 0.50, "retail_share": 0.30, "svc_share": 0.20,
                         "fb_gross": 350000, "retail_gross": 250000, "svc_gross": 180000,
                         "av_uplift": uplift_conservative},
        "aggressive":   {"activations": 40, "fb_share": 0.50, "retail_share": 0.30, "svc_share": 0.20,
                         "fb_gross": 350000, "retail_gross": 250000, "svc_gross": 180000,
                         "av_uplift": uplift_aggressive},
    }

    lines.append(f"  Colley mixed-use (418) small-lot mean AV: ${colley_mixed_mean:>10,.0f}")
    lines.append(f"  Ghent single-family mean AV:              ${ghent_sf_mean:>10,.0f}")
    lines.append(f"  AV uplift assumption (conservative):      ${uplift_conservative:>10,.0f}")
    lines.append(f"  AV uplift assumption (aggressive):        ${uplift_aggressive:>10,.0f}")
    lines.append("")
    revenue_results = {}
    for name, s in scenarios.items():
        n = s["activations"]
        n_fb     = round(n * s["fb_share"])
        n_retail = round(n * s["retail_share"])
        n_svc    = n - n_fb - n_retail

        av_uplift_per_parcel = s["av_uplift"]
        prop_tax = n * av_uplift_per_parcel * REAL_ESTATE_RATE

        # Meals tax (food/bev only)
        meals    = n_fb * s["fb_gross"] * MEALS_TAX_RATE

        # Sales tax (retail goods — 60% of retail gross is taxable goods)
        sales    = (n_retail * s["retail_gross"] * 0.60) * SALES_TAX_CITY

        # BPOL (all locations, all gross receipts over $100K)
        blended_gross = (n_fb * s["fb_gross"] + n_retail * s["retail_gross"] + n_svc * s["svc_gross"])
        bpol     = (blended_gross - n * 100000) * BPOL_RATE  # subtract $100K exempt threshold per business

        # Adjacent residential uplift (50 proximate parcels × 5% uplift)
        adj_res  = 50 * ghent_res_mean * 0.05 * REAL_ESTATE_RATE

        total    = prop_tax + meals + sales + bpol + adj_res

        lines.append(f"  {name.upper()} ({n} activations):")
        lines.append(f"    Property tax uplift (${av_uplift_per_parcel:,.0f}/parcel × {n}): ${prop_tax:>10,.0f}")
        lines.append(f"    Meals tax ({n_fb} fb locations):                       ${meals:>10,.0f}")
        lines.append(f"    Sales tax (city share, {n_retail} retail):             ${sales:>10,.0f}")
        lines.append(f"    BPOL:                                                 ${bpol:>10,.0f}")
        lines.append(f"    Adjacent residential uplift:                          ${adj_res:>10,.0f}")
        lines.append(f"    ─────────────────────────────────────────────────────────")
        lines.append(f"    TOTAL ANNUAL CITY REVENUE:                            ${total:>10,.0f}")
        lines.append("")

        revenue_results[name] = {
            "activations": n,
            "av_uplift_per_parcel_assumed": round(av_uplift_per_parcel, 0),
            "property_tax": round(prop_tax, 0),
            "meals_tax": round(meals, 0),
            "sales_tax": round(sales, 0),
            "bpol": round(bpol, 0),
            "adjacent_residential_uplift": round(adj_res, 0),
            "total_annual_revenue": round(total, 0),
        }

    summary["revenue_projections"] = revenue_results
    summary["activatable_parcel_proxy"] = {
        "pd64_total": int(len(pd64)),
        "pd64_non_commercial": int(len(pd64_noncommercial)),
        "pd64_small_urban_lots_with_structure": int(len(street_facing)),
    }

    # ── 7. PD 64 detail (core HC-G2 block) ─────────────────────────────────
    h("7. PD 64 (Core Ghent) Detail")

    pd64_by_use = pd64["property_use"].value_counts()
    lines.append("  Property use breakdown in PD 64:")
    for use, count in pd64_by_use.items():
        lines.append(f"    {str(use):<40} {count:>5,}")
    lines.append("")
    p("PD 64 total assessed value:", f"${pd64['current_total_value'].sum():>15,.0f}")
    p("PD 64 mean AV per parcel:", f"${pd64['current_total_value'].mean():>15,.0f}")

    summary["pd64_detail"] = {
        "total_parcels": int(len(pd64)),
        "total_assessed_value": int(pd64["current_total_value"].sum()),
        "mean_assessed_value": round(pd64["current_total_value"].mean(), 0),
        "use_breakdown": {str(k): int(v) for k, v in pd64_by_use.items()},
    }

    # ── Write outputs ─────────────────────────────────────────────────────────
    report = "\n".join(lines)
    print(report)

    with open(os.path.join(OUTPUT_DIR, "hcg2_analysis.txt"), "w") as f:
        f.write(report)

    class NumpyEncoder(json.JSONEncoder):
        def default(self, obj):
            import numpy as np
            if isinstance(obj, (np.integer,)): return int(obj)
            if isinstance(obj, (np.floating,)): return float(obj)
            if isinstance(obj, np.ndarray): return obj.tolist()
            return super().default(obj)

    with open(os.path.join(OUTPUT_DIR, "hcg2_summary.json"), "w") as f:
        json.dump(summary, f, indent=2, cls=NumpyEncoder)

    print("\n\nSaved: data/output/hcg2_analysis.txt")
    print("Saved: data/output/hcg2_summary.json")

    return summary


if __name__ == "__main__":
    analyze()
