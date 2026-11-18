"""
EO Modulator Strategy: PTR Cavity + 4WM vs. Integrated LiNbO3
Comparative analysis for weight encoding via passive nonlinearity.

Key constraint: 4-wave mixing (χ^(3)) as weight modulation mechanism.
- PTR: high χ^(2) NOT usable; must rely on χ^(3) or Kerr nonlinearity
- LiNbO3: high χ^(2) AND χ^(3); more flexible

Trade: Cavity geometry (PTR) vs. weight encoding (4WM nonlinearity).
"""

import numpy as np
from dataclasses import dataclass

@dataclass
class EOModulator:
    name: str
    material: str
    chi2: float  # susceptibility (relative)
    chi3: float
    insertion_loss_db: float
    modulation_bandwidth_ghz: float
    thermal_stability_ppmp_k: float  # phase ppm/K
    cost_per_unit_usd: float
    integration: str  # "integrated" or "external"
    weight_encoding_mechanism: str
    notes: str

modulators = [
    EOModulator(
        name="PTR Cavity + External 4WM",
        material="PTR glass (cavity) + Fused silica/glass (4WM cell)",
        chi2=0.0,  # PTR not electro-optic
        chi3=1e-20,  # silica χ^(3) in m^2/V^2
        insertion_loss_db=0.5,
        modulation_bandwidth_ghz=1.0,  # limited by thermal dephasing in nonlinear medium
        thermal_stability_ppmp_k=5.0,  # PTR excellent; 4WM cell add drift
        cost_per_unit_usd=500,  # PTR cavity ~$200 + 4WM cell ~$300
        integration="external",
        weight_encoding_mechanism="4WM (χ^(3)) driven by orthogonal pump beams",
        notes=(
            "Strengths: (1) PTR optimized for cavity Q, (2) passive 4WM requires no voltage bias, "
            "(3) inherently low phase noise. "
            "Weakness: χ^(3) is 100x weaker than χ^(2); requires high pump power (mW scale). "
            "4WM bandwidth ~1 GHz (thermal limit in glass). Weight update timescale: ~100ns (slow)."
        )
    ),
    EOModulator(
        name="LiNbO3 Integrated Resonator",
        material="LiNbO3 ridge waveguide with Pockels electrodes",
        chi2=670e-12,  # LiNbO3 χ^(2) in m/V
        chi3=1e-19,  # LiNbO3 χ^(3) also present
        insertion_loss_db=3.0,
        modulation_bandwidth_ghz=100.0,  # MHz-GHz electrical driving; no nonlinear medium limit
        thermal_stability_ppmp_k=25.0,  # LiNbO3 higher drift; needs tuning PID
        cost_per_unit_usd=800,  # integrated platform
        integration="integrated",
        weight_encoding_mechanism="Pockels (χ^(2)) linear EO modulation; can add χ^(3) for higher-order terms",
        notes=(
            "Strengths: (1) High χ^(2) enables fast, efficient modulation, (2) bandwidth 100+ GHz, "
            "(3) weight update timescale ~1ns (optical). "
            "Weakness: 3dB insertion loss (vs 0.5dB for PTR), thermal drift requires active stabilization, "
            "higher cost. LiNbO3 as cavity not ideal (lower Q than PTR). Hybrid approach: LiNbO3 modulator "
            "in PTR cavity geometry."
        )
    ),
    EOModulator(
        name="Hybrid: PTR Cavity + LiNbO3 Inline Phase Modulator",
        material="PTR cavity with integrated LiNbO3 Mach-Zehnder modulator",
        chi2=670e-12,
        chi3=1e-19,
        insertion_loss_db=1.5,
        modulation_bandwidth_ghz=50.0,
        thermal_stability_ppmp_k=10.0,  # weighted: PTR cavity + LiNbO3 mod
        cost_per_unit_usd=1200,
        integration="integrated",
        weight_encoding_mechanism="Pockels in inline MZM; 4WM can be added if needed for χ^(3) terms",
        notes=(
            "Best of both: PTR cavity geometry for high Q + LiNbO3 fast EO modulation. "
            "Insertion loss 1.5dB (acceptable). Weight update: 1ns. "
            "Thermal: LiNbO3 PID stabilization on-chip. Cost: higher upfront, but proven performance. "
            "Integration: couple PTR cavity to LiNbO3 waveguide. Complexity: moderate."
        )
    )
]

def analyze():
    print("=" * 100)
    print("EO MODULATOR STRATEGY: PTR + 4WM vs. ALTERNATIVES")
    print("=" * 100)
    print()
    
    for mod in modulators:
        print(f"### {mod.name}")
        print(f"Material: {mod.material}")
        print(f"χ^(2): {mod.chi2:.2e}, χ^(3): {mod.chi3:.2e}")
        print(f"Insertion loss: {mod.insertion_loss_db} dB")
        print(f"Modulation BW: {mod.modulation_bandwidth_ghz} GHz")
        print(f"Thermal stability: ±{mod.thermal_stability_ppmp_k} ppm/K")
        print(f"Cost: ${mod.cost_per_unit_usd}")
        print(f"Integration: {mod.integration}")
        print(f"Weight mechanism: {mod.weight_encoding_mechanism}")
        print(f"\nNotes: {mod.notes}")
        print()
    
    print("=" * 100)
    print("DECISION MATRIX")
    print("=" * 100)
    print()
    print("Criterion                      | PTR+4WM    | LiNbO3     | Hybrid")
    print("-" * 70)
    print(f"Cavity Q (key for SNR)         | ✓✓ HIGH    | ✗ MEDIUM   | ✓✓ HIGH")
    print(f"Weight update speed            | ✗ 100ns    | ✓✓ 1ns     | ✓✓ 1ns")
    print(f"Thermal stability              | ✓✓ BEST    | ✗ NEEDS PID| ✓ GOOD")
    print(f"Insertion loss                 | ✓✓ 0.5dB   | ✗ 3.0dB    | ✓ 1.5dB")
    print(f"Power budget (4WM or Pockels)  | ✗ mW pump  | ✓ V control| ✓ V control")
    print(f"Cost (per unit)                | ✓ $500     | ~ $800     | ✗ $1200")
    print(f"Integration complexity         | ✓ LOW      | ✓ MEDIUM   | ~ MEDIUM")
    print(f"Convergence (gradient descent) | ? Unknown  | ✓ Proven   | ✓ Proven")
    print()
    
    print("=" * 100)
    print("RECOMMENDATION")
    print("=" * 100)
    print()
    print("PRIMARY: Hybrid (PTR Cavity + LiNbO3 MZM)")
    print("  Rationale:")
    print("  1. PTR cavity geometry locked (you confirmed). Use it.")
    print("  2. 4WM passive χ^(3) is low-efficiency; Pockels χ^(2) is proven + fast.")
    print("  3. LiNbO3 modulator integrated as inline phase shifter minimizes loss.")
    print("  4. Thermal: LiNbO3 PID lock on reference cavity → stable.")
    print("  5. Weight updates: 1ns (gradient descent converges faster).")
    print()
    print("FALLBACK: PTR+4WM (if you want to stay passive/nonlinear)")
    print("  Rationale:")
    print("  1. All-optical, no electronics in cavity.")
    print("  2. Pump beam ~ 780nm or 1064nm drives 4WM in silica cell.")
    print("  3. Weight encoding: phase modulation of pump = weight update.")
    print("  4. Risk: 100ns weight update slow; convergence uncertain.")
    print("  5. Need Phase 1 validation: does 4WM gradient descent converge?")
    print()
    
    print("=" * 100)
    print("NEXT STEPS")
    print("=" * 100)
    print()
    print("1. You: Photonic backprop convergence literature dive.")
    print("2. Me: Detailed hybrid (PTR+LiNbO3) design specs.")
    print("   - MZM insertion loss budget (0.5dB → 1.5dB acceptable?)")
    print("   - Coupling efficiency PTR→LiNbO3 waveguide")
    print("   - Thermal PID control loop design")
    print("   - Vendor availability (LiNbO3 MZM modules)")
    print()

if __name__ == "__main__":
    analyze()
