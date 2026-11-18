#!/usr/bin/env python3
"""
QRI Performance Update: NARG, Ptychography, SNR scenarios

Compares baseline, Path A (NARG), Path B (SNR upgrade), Path C (aggressive)
against hyperscale baseline on throughput, latency, efficiency.

Usage:
    python analyze/performance_update.py [--output table|json|both]
"""

import json
import argparse
from dataclasses import dataclass
from typing import Dict, Tuple

@dataclass
class ScenarioSpec:
    name: str
    snr_db: float
    narg_positions: int
    ptychography_enabled: bool
    throughput_mtoks: float
    params_m: float
    latency_ns: float
    power_mw: float
    write_overhead_pct: float
    timeline_weeks: int
    cost_k: int
    description: str

# Baseline (ARCH 1-10 locked)
baseline = ScenarioSpec(
    name="Baseline (ARCH 1-10 Locked)",
    snr_db=40.0,
    narg_positions=1,
    ptychography_enabled=False,
    throughput_mtoks=75,
    params_m=1.23,
    latency_ns=13.3,
    power_mw=86,
    write_overhead_pct=0,
    timeline_weeks=0,
    cost_k=0,
    description="75 M tok/s, 1.23M params, passive cooling, 40dB SNR"
)

# Path A: Conservative (NARG only, baseline SNR)
path_a = ScenarioSpec(
    name="Path A: NARG 16-pos (Conservative)",
    snr_db=40.0,
    narg_positions=16,
    ptychography_enabled=False,
    throughput_mtoks=75,
    params_m=1.23,
    latency_ns=13.3 / 16,  # 0.83 ns per-position
    power_mw=86 * 1.1,  # +10% fertility overhead
    write_overhead_pct=10,
    timeline_weeks=2,
    cost_k=0,
    description="16-pos parallel (10% latency gain, $0 cost, 2 weeks)"
)

# Path B: Moderate (SNR upgrade + NARG 128)
path_b = ScenarioSpec(
    name="Path B: SNR +8dB + NARG 128-pos (Recommended)",
    snr_db=48.0,
    narg_positions=128,
    ptychography_enabled=False,
    throughput_mtoks=75,
    params_m=1.23,
    latency_ns=13.3 / 128,  # 0.104 ns per-position
    power_mw=(86 * 1.1) + 5,  # +10% fertility + 5mW optical upgrade
    write_overhead_pct=10,
    timeline_weeks=6,
    cost_k=5,
    description="128-pos parallel (8-16× latency, ptychography marginal, $5k, 6 wks)"
)

# Path C: Aggressive (SNR + full ptychography + NARG 128)
path_c = ScenarioSpec(
    name="Path C: SNR + Ptych 2× + NARG 128-pos (Aggressive)",
    snr_db=48.0,
    narg_positions=128,
    ptychography_enabled=True,
    throughput_mtoks=75,
    params_m=2.46,  # 2× from ptychography
    latency_ns=13.3 / 128,  # Same as Path B
    power_mw=(86 * 1.1) + 5 + 2,  # +ptych write power
    write_overhead_pct=13,  # 10% NARG + 3% ptych
    timeline_weeks=8,
    cost_k=6,
    description="2.46M params, 128-pos parallel (full unlock, $6k, 8 wks, tight SNR)"
)

scenarios = [baseline, path_a, path_b, path_c]

def efficiency_gain(scenario: ScenarioSpec) -> float:
    """Tokens per Watt vs baseline."""
    baseline_eff = (baseline.throughput_mtoks * 1e6) / (baseline.power_mw / 1000)
    scenario_eff = (scenario.throughput_mtoks * 1e6) / (scenario.power_mw / 1000)
    return scenario_eff / baseline_eff

def latency_gain(scenario: ScenarioSpec) -> float:
    """Latency reduction vs baseline."""
    return baseline.latency_ns / scenario.latency_ns

def report_table():
    print("\n" + "="*120)
    print("QRI PERFORMANCE: Baseline vs. Path A/B/C")
    print("="*120 + "\n")
    
    print(f"{'Metric':<30} {'Baseline':<20} {'Path A (Cons)':<20} {'Path B (Rec)':<20} {'Path C (Agg)':<20}")
    print("-"*120)
    
    # SNR
    print(f"{'SNR (dB)':<30} {baseline.snr_db:<20.1f} {path_a.snr_db:<20.1f} {path_b.snr_db:<20.1f} {path_c.snr_db:<20.1f}")
    
    # NARG positions
    print(f"{'NARG positions':<30} {baseline.narg_positions:<20} {path_a.narg_positions:<20} {path_b.narg_positions:<20} {path_c.narg_positions:<20}")
    
    # Throughput (per-position)
    print(f"{'Throughput (M tok/s)':<30} {baseline.throughput_mtoks:<20.1f} {path_a.throughput_mtoks:<20.1f} {path_b.throughput_mtoks:<20.1f} {path_c.throughput_mtoks:<20.1f}")
    
    # Latency (per-position)
    print(f"{'Latency per-pos (ns)':<30} {baseline.latency_ns:<20.2f} {path_a.latency_ns:<20.3f} {path_b.latency_ns:<20.3f} {path_c.latency_ns:<20.3f}")
    
    # Latency gain
    print(f"{'Latency gain (×)':<30} {'—':<20} {latency_gain(path_a):<20.1f} {latency_gain(path_b):<20.1f} {latency_gain(path_c):<20.1f}")
    
    # Parameters
    print(f"{'Parameters (M)':<30} {baseline.params_m:<20.2f} {path_a.params_m:<20.2f} {path_b.params_m:<20.2f} {path_c.params_m:<20.2f}")
    
    # Power
    print(f"{'Power (mW)':<30} {baseline.power_mw:<20.1f} {path_a.power_mw:<20.1f} {path_b.power_mw:<20.1f} {path_c.power_mw:<20.1f}")
    
    # Efficiency gain
    print(f"{'Efficiency gain (×)':<30} {'—':<20} {efficiency_gain(path_a):<20.2f} {efficiency_gain(path_b):<20.2f} {efficiency_gain(path_c):<20.2f}")
    
    # Write overhead
    print(f"{'Write overhead (%)':<30} {baseline.write_overhead_pct:<20.0f} {path_a.write_overhead_pct:<20.0f} {path_b.write_overhead_pct:<20.0f} {path_c.write_overhead_pct:<20.0f}")
    
    # Timeline
    print(f"{'Timeline (weeks)':<30} {baseline.timeline_weeks:<20} {path_a.timeline_weeks:<20} {path_b.timeline_weeks:<20} {path_c.timeline_weeks:<20}")
    
    # Cost
    print(f"{'Cost ($k)':<30} {baseline.cost_k:<20} {path_a.cost_k:<20} {path_b.cost_k:<20} {path_c.cost_k:<20}")
    
    # Ptychography
    ptych_str = lambda s: "✓ Yes (2×)" if s.ptychography_enabled else "No"
    print(f"{'Ptychography':<30} {ptych_str(baseline):<20} {ptych_str(path_a):<20} {ptych_str(path_b):<20} {ptych_str(path_c):<20}")
    
    print("\n" + "="*120)
    print("\nRECOMMENDATION: Path B (SNR upgrade + NARG 128)")
    print("  • 8-16× latency improvement")
    print("  • Realistic electronics (no exotic parts)")
    print("  • Unlocks ptychography as well (marginal write SNR)")
    print("  • $5k cost, 4-6 week timeline")
    print("  • Medium risk (TIA fab), medium-high reward")
    print("\n" + "="*120 + "\n")

def report_json():
    data = {
        "date": "2026-04-24",
        "source": "performance_update.py",
        "scenarios": [
            {
                "name": s.name,
                "snr_db": s.snr_db,
                "narg_positions": s.narg_positions,
                "ptychography_enabled": s.ptychography_enabled,
                "throughput_mtoks": s.throughput_mtoks,
                "params_m": s.params_m,
                "latency_ns_per_pos": s.latency_ns,
                "power_mw": s.power_mw,
                "efficiency_gain_vs_baseline": efficiency_gain(s) if s != baseline else 1.0,
                "latency_gain_vs_baseline": latency_gain(s) if s != baseline else 1.0,
                "write_overhead_pct": s.write_overhead_pct,
                "timeline_weeks": s.timeline_weeks,
                "cost_k": s.cost_k,
                "description": s.description,
            }
            for s in scenarios
        ]
    }
    print(json.dumps(data, indent=2))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", choices=["table", "json", "both"], default="table")
    args = parser.parse_args()
    
    if args.output in ("table", "both"):
        report_table()
    if args.output in ("json", "both"):
        report_json()

