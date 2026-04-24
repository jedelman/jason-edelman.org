#!/usr/bin/env python3
"""
Economic Analysis: QRI Refrigerator-Scale 5T vs. Hyperscale Compute

Compares total cost of ownership, operational efficiency, and environmental impact
for a QRI embedded inference device vs. hyperscale datacenter running equivalent 5T model.

Source: ECONOMIC_ANALYSIS_2026-04-20.md

Usage:
    python analyze/economic_analysis.py [--years 5] [--output json|table|both]
"""

import json
import argparse
from dataclasses import dataclass
from typing import Optional


@dataclass
class HyperscaleConfig:
    """Hyperscale 5T LLM Datacenter baseline."""
    
    # Hardware
    gpu_cost: float = 40_000  # H100 cost USD
    gpu_power_w: float = 700  # TDP watts
    gpus_required: int = 2_500_000  # To match 75M tok/s throughput
    hbm_per_gpu: float = 10_000  # HBM3E cost
    nvlink_per_gpu: float = 1_000  # NVLink interconnect
    storage_cost: float = 15_000_000_000  # Checkpoints, KV cache
    
    # Facilities
    datacenter_build: float = 750_000_000  # Small/medium
    cooling_infrastructure: float = 75_000_000
    redundancy_backup: float = 75_000_000
    pue: float = 1.5  # Power Usage Effectiveness
    
    # Operations
    power_cost_per_kwh: float = 0.08  # Hyperscale rates
    ml_engineers: int = 500
    ml_engineer_salary: float = 200_000
    ops_engineers: int = 500
    ops_engineer_salary: float = 150_000
    ml_scientists: int = 200
    scientist_salary: float = 250_000
    
    # Maintenance
    hardware_lifecycle_years: int = 5
    software_license_cost: float = 50_000_000
    
    def capital_cost(self) -> dict:
        compute = self.gpu_cost * self.gpus_required
        memory_net = (self.hbm_per_gpu + self.nvlink_per_gpu) * self.gpus_required + self.storage_cost
        facilities = self.datacenter_build + self.cooling_infrastructure + self.redundancy_backup
        return {
            "compute": compute,
            "memory_networking": memory_net,
            "facilities": facilities,
            "total": compute + memory_net + facilities,
        }
    
    def annual_opex(self, years: int = 1) -> dict:
        total_power_w = self.gpu_power_w * self.gpus_required
        total_power_w_with_pue = total_power_w * self.pue
        energy_cost = (total_power_w_with_pue / 1000) * 24 * 365.25 * self.power_cost_per_kwh
        
        personnel = (
            self.ml_engineers * self.ml_engineer_salary +
            self.ops_engineers * self.ops_engineer_salary +
            self.ml_scientists * self.scientist_salary
        )
        
        hardware_replacement = self.capital_cost()["total"] / self.hardware_lifecycle_years
        maintenance = hardware_replacement + self.software_license_cost
        
        return {
            "energy": energy_cost,
            "personnel": personnel,
            "maintenance": maintenance,
            "total": energy_cost + personnel + maintenance,
        }
    
    def tokens_per_year(self) -> float:
        """75M tokens/sec throughout year."""
        return 75e6 * 365.25 * 24 * 3600
    
    def cost_per_token(self, years: int = 5) -> float:
        capex = self.capital_cost()["total"]
        opex = self.annual_opex()["total"] * years
        total_cost = capex + opex
        tokens = self.tokens_per_year() * years
        return total_cost / tokens
    
    def annual_energy_kwh(self) -> float:
        total_power_w = self.gpu_power_w * self.gpus_required
        return (total_power_w / 1000) * 24 * 365.25
    
    def annual_co2_kg(self, kg_co2_per_kwh: float = 0.4) -> float:
        return self.annual_energy_kwh() * kg_co2_per_kwh


@dataclass
class QRIConfig:
    """QRI Refrigerator-scale 5T inference device."""
    
    # Hardware (per expert module)
    unit_cost: float = 200  # Mature Year 4 cost
    num_experts: int = 4_000_000  # For rank-50, 512-dim embedding
    assembly_cost_per_unit: float = 50
    
    # Control electronics
    control_cost_per_1000: float = 500  # FPGA/ASIC
    control_units: int = 4000  # 1 per 1000 experts
    
    # Facilities (small datacentr)
    datacenter_build: float = 35_000_000  # Modest scale
    cooling_infra: float = 3_500_000  # Passive + liquid loop
    
    # Operations
    power_base_w: float = 10  # Per expert base power
    power_per_active_w: float = 4  # Per active expert (sparse K=4)
    avg_active_experts: int = 4  # K=4 sparsity
    power_cost_per_kwh: float = 0.08
    pue: float = 1.1  # Efficient passive cooling
    
    personnel_engineers: int = 10
    engineer_salary: float = 200_000
    ops_staff: int = 2
    ops_salary: float = 100_000
    
    # Maintenance
    vcsel_cost: float = 50  # Replacement
    vcsel_lifecycle_years: int = 5
    
    def capital_cost(self) -> dict:
        hardware = self.unit_cost * self.num_experts
        assembly = self.assembly_cost_per_unit * self.num_experts
        control = self.control_cost_per_1000 * (self.num_experts / 1000)
        facilities = self.datacenter_build + self.cooling_infra
        return {
            "hardware": hardware,
            "assembly": assembly,
            "control": control,
            "facilities": facilities,
            "total": hardware + assembly + control + facilities,
        }
    
    def avg_power_w(self) -> float:
        """Average power draw under sparse activation."""
        return (self.power_base_w * self.num_experts) + (self.power_per_active_w * self.avg_active_experts)
    
    def annual_opex(self) -> dict:
        avg_power_w = self.avg_power_w()
        avg_power_w_with_pue = avg_power_w * self.pue
        energy_cost = (avg_power_w_with_pue / 1000) * 24 * 365.25 * self.power_cost_per_kwh
        
        personnel = (
            self.personnel_engineers * self.engineer_salary +
            self.ops_staff * self.ops_salary
        )
        
        vcsel_replacement = (self.vcsel_cost * self.num_experts) / self.vcsel_lifecycle_years
        
        return {
            "energy": energy_cost,
            "personnel": personnel,
            "maintenance": vcsel_replacement,
            "total": energy_cost + personnel + vcsel_replacement,
        }
    
    def tokens_per_year(self) -> float:
        """75M tokens/sec throughout year."""
        return 75e6 * 365.25 * 24 * 3600
    
    def cost_per_token(self, years: int = 5) -> float:
        capex = self.capital_cost()["total"]
        opex = self.annual_opex()["total"] * years
        total_cost = capex + opex
        tokens = self.tokens_per_year() * years
        return total_cost / tokens
    
    def annual_energy_kwh(self) -> float:
        avg_power_w = self.avg_power_w()
        return (avg_power_w / 1000) * 24 * 365.25
    
    def annual_co2_kg(self, kg_co2_per_kwh: float = 0.4) -> float:
        return self.annual_energy_kwh() * kg_co2_per_kwh


def format_currency(value: float) -> str:
    """Format large currency values with M/B/T suffix."""
    if value >= 1e12:
        return f"${value/1e12:.1f}T"
    elif value >= 1e9:
        return f"${value/1e9:.1f}B"
    elif value >= 1e6:
        return f"${value/1e6:.1f}M"
    elif value >= 1e3:
        return f"${value/1e3:.1f}k"
    else:
        return f"${value:.2f}"


def format_scientific(value: float, precision: int = 2) -> str:
    """Format very small numbers in scientific notation."""
    if abs(value) < 1e-6:
        return f"{value:.{precision}e}"
    return f"{value:.{precision}e}"


def print_table_comparison(hs: HyperscaleConfig, qri: QRIConfig, years: int = 5):
    """Print side-by-side comparison table."""
    print("\n" + "="*80)
    print("HYPERSCALE vs. QRI ECONOMIC COMPARISON")
    print("="*80)
    
    # Capital costs
    print("\n--- CAPITAL COSTS ---")
    hs_cap = hs.capital_cost()
    qri_cap = qri.capital_cost()
    
    print(f"{'Compute/Hardware':<30} {format_currency(hs_cap['compute']):>20} {format_currency(qri_cap['hardware']):>20}")
    print(f"{'Memory/Networking':<30} {format_currency(hs_cap['memory_networking']):>20} {'—':>20}")
    print(f"{'Assembly':<30} {'—':>20} {format_currency(qri_cap['assembly']):>20}")
    print(f"{'Control Electronics':<30} {'—':>20} {format_currency(qri_cap['control']):>20}")
    print(f"{'Facilities':<30} {format_currency(hs_cap['facilities']):>20} {format_currency(qri_cap['facilities']):>20}")
    print("-" * 70)
    print(f"{'TOTAL CAPITAL':<30} {format_currency(hs_cap['total']):>20} {format_currency(qri_cap['total']):>20}")
    ratio = hs_cap['total'] / qri_cap['total']
    print(f"{'Capital Advantage (ratio)':<30} {'Hyperscale baseline':>20} {f'{ratio:.0f}× cheaper':>20}")
    
    # Annual OpEx
    print("\n--- ANNUAL OPERATIONS ---")
    hs_opex = hs.annual_opex()
    qri_opex = qri.annual_opex()
    
    print(f"{'Energy':<30} {format_currency(hs_opex['energy']):>20} {format_currency(qri_opex['energy']):>20}")
    print(f"{'Personnel':<30} {format_currency(hs_opex['personnel']):>20} {format_currency(qri_opex['personnel']):>20}")
    print(f"{'Maintenance':<30} {format_currency(hs_opex['maintenance']):>20} {format_currency(qri_opex['maintenance']):>20}")
    print("-" * 70)
    print(f"{'ANNUAL OpEx':<30} {format_currency(hs_opex['total']):>20} {format_currency(qri_opex['total']):>20}")
    opex_ratio = hs_opex['total'] / qri_opex['total']
    print(f"{'OpEx Advantage (ratio)':<30} {'Hyperscale baseline':>20} {f'{opex_ratio:.0f}× cheaper':>20}")
    
    # 5-year TCO
    print(f"\n--- {years}-YEAR TOTAL COST OF OWNERSHIP ---")
    hs_tco = hs_cap['total'] + (hs_opex['total'] * years)
    qri_tco = qri_cap['total'] + (qri_opex['total'] * years)
    
    print(f"{'Capital':<30} {format_currency(hs_cap['total']):>20} {format_currency(qri_cap['total']):>20}")
    print(f"{'OpEx ({} years)':<30} {format_currency(hs_opex['total'] * years):>20} {format_currency(qri_opex['total'] * years):>20}")
    print("-" * 70)
    print(f"{'TOTAL {}-YEAR TCO':<30} {format_currency(hs_tco):>20} {format_currency(qri_tco):>20}".format(years))
    tco_ratio = hs_tco / qri_tco
    print(f"{'TCO Advantage (ratio)':<30} {'Hyperscale baseline':>20} {f'{tco_ratio:.0f}× cheaper':>20}")
    
    # Cost per token
    print(f"\n--- COST PER TOKEN (amortized over {years} years) ---")
    hs_cpt = hs.cost_per_token(years)
    qri_cpt = qri.cost_per_token(years)
    
    print(f"{'Cost per token':<30} {format_scientific(hs_cpt, 2):>20} {format_scientific(qri_cpt, 2):>20}")
    cpt_ratio = hs_cpt / qri_cpt
    print(f"{'Token Cost Advantage':<30} {'Hyperscale baseline':>20} {f'{cpt_ratio:.0f}× cheaper':>20}")
    
    # Energy & environmental
    print("\n--- POWER & ENVIRONMENTAL IMPACT ---")
    hs_kwh = hs.annual_energy_kwh()
    qri_kwh = qri.annual_energy_kwh()
    hs_co2 = hs.annual_co2_kg()
    qri_co2 = qri.annual_co2_kg()
    
    print(f"{'Annual energy (kWh)':<30} {hs_kwh:>20.1e} {qri_kwh:>20.1e}")
    print(f"{'Annual CO₂ (kg @ 0.4kg/kWh)':<30} {hs_co2:>20.1e} {qri_co2:>20.1e}")
    co2_ratio = hs_co2 / qri_co2 if qri_co2 > 0 else float('inf')
    print(f"{'Carbon Reduction Ratio':<30} {'Hyperscale baseline':>20} {f'{co2_ratio:,.0f}× lower':>20}")
    
    # Throughput efficiency
    print("\n--- THROUGHPUT EFFICIENCY ---")
    hs_power_w = hs.gpu_power_w * hs.gpus_required
    qri_power_w = qri.avg_power_w()
    hs_efficiency = 75e6 / hs_power_w  # tok/sec per watt
    qri_efficiency = 75e6 / qri_power_w
    
    print(f"{'Total power draw (W)':<30} {hs_power_w:>20.1e} {qri_power_w:>20.1f}")
    print(f"{'Tokens/sec per Watt':<30} {hs_efficiency:>20.1f} {qri_efficiency:>20.0f}")
    efficiency_ratio = qri_efficiency / hs_efficiency
    print(f"{'Efficiency Advantage':<30} {'Hyperscale baseline':>20} {f'{efficiency_ratio:,.0f}× better':>20}")
    
    # Break-even
    print("\n--- PAYBACK PERIOD ---")
    annual_savings = hs_opex['total'] - qri_opex['total']
    payback_months = (qri_cap['total'] / annual_savings) * 12
    payback_months_conservative = (qri_cap['total'] / (annual_savings * 0.5)) * 12  # 50% efficiency
    
    print(f"{'Annual savings vs hyperscale':<30} {format_currency(annual_savings):>20}")
    print(f"{'QRI capital investment':<30} {format_currency(qri_cap['total']):>20}")
    print(f"{'Payback period (100% efficiency)':<30} {f'{payback_months:.1f} months':>20}")
    print(f"{'Payback period (50% efficiency)':<30} {f'{payback_months_conservative:.1f} months':>20}")
    
    print("\n" + "="*80)


def output_json(hs: HyperscaleConfig, qri: QRIConfig, years: int = 5) -> str:
    """Generate JSON output."""
    result = {
        "date": "2026-04-20",
        "source": "ECONOMIC_ANALYSIS_2026-04-20.md",
        "years_projected": years,
        "hyperscale": {
            "capital_cost": hs.capital_cost(),
            "annual_opex": hs.annual_opex(),
            "total_cost_ownership": hs.capital_cost()["total"] + (hs.annual_opex()["total"] * years),
            "tokens_per_year": hs.tokens_per_year(),
            "cost_per_token": hs.cost_per_token(years),
            "annual_energy_kwh": hs.annual_energy_kwh(),
            "annual_co2_kg": hs.annual_co2_kg(),
        },
        "qri": {
            "capital_cost": qri.capital_cost(),
            "annual_opex": qri.annual_opex(),
            "total_cost_ownership": qri.capital_cost()["total"] + (qri.annual_opex()["total"] * years),
            "tokens_per_year": qri.tokens_per_year(),
            "cost_per_token": qri.cost_per_token(years),
            "annual_energy_kwh": qri.annual_energy_kwh(),
            "annual_co2_kg": qri.annual_co2_kg(),
        },
        "comparison": {
            "capital_advantage": hs.capital_cost()["total"] / qri.capital_cost()["total"],
            "opex_advantage": hs.annual_opex()["total"] / qri.annual_opex()["total"],
            "tco_advantage": (hs.capital_cost()["total"] + hs.annual_opex()["total"] * years) / 
                           (qri.capital_cost()["total"] + qri.annual_opex()["total"] * years),
            "cost_per_token_advantage": hs.cost_per_token(years) / qri.cost_per_token(years),
            "energy_ratio": hs.annual_energy_kwh() / qri.annual_energy_kwh(),
            "carbon_reduction": hs.annual_co2_kg() / qri.annual_co2_kg(),
        },
    }
    return json.dumps(result, indent=2, default=str)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--years", type=int, default=5, help="Years to project (default: 5)")
    parser.add_argument("--output", choices=["table", "json", "both"], default="table",
                       help="Output format")
    args = parser.parse_args()
    
    hs = HyperscaleConfig()
    qri = QRIConfig()
    
    if args.output in ["table", "both"]:
        print_table_comparison(hs, qri, args.years)
    
    if args.output in ["json", "both"]:
        json_out = output_json(hs, qri, args.years)
        if args.output == "both":
            print("\n" + "="*80)
            print("JSON OUTPUT")
            print("="*80)
        print(json_out)
