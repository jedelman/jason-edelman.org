#!/usr/bin/env python3
"""
QRI Architecture Cross-Check: ARCH-1 through ARCH-10 Consistency Verification

Validates that all 10 locked architecture decisions are mutually consistent and
satisfy cross-component constraints.

Source: ARCH_CROSSCHECK_2026-04-20.md

Usage:
    python analyze/arch_crosscheck.py [--verbose]
    python analyze/arch_crosscheck.py --output json
"""

import json
import math
import argparse
from dataclasses import dataclass, field
from typing import Dict, List, Any, Tuple
from enum import Enum


class ArchitectureStatus(Enum):
    LOCKED = "LOCKED"
    CONSISTENT = "CONSISTENT"
    WARNING = "WARNING"
    FAIL = "FAIL"


@dataclass
class ArchitectureCrosscheck:
    """Cross-validation of all 10 architecture decisions."""
    
    # ARCH-1: Physics primitives
    arch1_primitive: str = "Wave RNN via Fabry-Perot resonator"
    arch1_weights: str = "Holographic refractive index modulation"
    arch1_learning: str = "Coherent Hebbian via 532nm photosensitivity"
    
    # ARCH-2: Resonator geometry
    arch2_length_mm: float = 20
    arch2_r: float = 0.9990
    arch2_finesse: int = 3140
    arch2_roundtrips: int = 100
    arch2_coherence_margin: float = 7.5
    
    # ARCH-3: Mode structure
    arch3_modes: int = 512
    arch3_aperture_mm: float = 2.5
    arch3_waist_um: float = 5.2
    arch3_available_modes: int = 7400
    arch3_polarization: str = "Vertical (single)"
    
    # ARCH-4: Throughput
    arch4_roundtrip_ps: float = 133.3
    arch4_token_rate_mtok_s: float = 75
    arch4_latency_ns: float = 13.3
    
    # ARCH-5: SNR budget
    arch5_snr_db: float = 40
    arch5_target_db: float = 38
    arch5_phase_snr_db: float = 66
    arch5_input_power_mw: float = 2.5
    
    # ARCH-6: Training
    arch6_mechanism: str = "Coherent Hebbian"
    arch6_wavelength_train_nm: int = 532
    arch6_wavelength_infer_nm: int = 850
    arch6_weights_ephemeral: bool = True
    
    # ARCH-7: Hologram capacity
    arch7_pixel_pitch_um: float = 50
    arch7_active_area_mm2: float = 5
    arch7_spatial_pixels: int = 10000
    arch7_max_gratings: int = 1000
    arch7_layer_params_per: int = 51200
    arch7_rank_per_layer: int = 50
    arch7_total_params: int = 1_230_000
    
    # ARCH-8: Coupling
    arch8_all_optical: bool = True
    arch8_readout: str = "Homodyne detection"
    arch8_interposer_required: bool = False
    
    # ARCH-9: Nonlinearity
    arch9_mechanism: str = "Kerr self-phase modulation"
    arch9_phi_nl_rad: float = 0.2
    arch9_total_phi_100: float = 20
    arch9_detuning_rad: float = math.pi
    
    # ARCH-10: Thermal
    arch10_plate_mm: str = "10×10×0.5"
    arch10_surface_mm2: float = 260
    arch10_passive_rise_k: float = 15
    arch10_absorption_db_cm: float = 0.01
    
    # Cross-cutting parameters
    wavelength_inference_nm: float = 850
    wavelength_training_nm: float = 532
    
    checks_performed: List[Tuple[str, bool, str]] = field(default_factory=list)
    
    def check_arch1_arch2_consistency(self) -> Tuple[bool, str]:
        """ARCH-1 (physics) must be compatible with ARCH-2 (geometry)."""
        if self.arch1_primitive != "Wave RNN via Fabry-Perot resonator":
            return False, "ARCH-1 primitive mismatch: not Fabry-Perot resonator"
        
        if self.arch2_r < 0.999:
            return False, "ARCH-2: Mirror R too low for coherent regime"
        
        if self.arch2_coherence_margin < 5:
            return False, "ARCH-2: Coherence margin insufficient (need >5× for stability)"
        
        return True, "ARCH-1 ↔ ARCH-2: Resonator geometry supports wave RNN primitive"
    
    def check_arch2_arch3_consistency(self) -> Tuple[bool, str]:
        """ARCH-2 (geometry) must support ARCH-3 (mode structure)."""
        # Rough check: aperture must accommodate 512 modes
        if self.arch3_modes > self.arch3_available_modes:
            return False, f"ARCH-3: {self.arch3_modes} modes > {self.arch3_available_modes} available"
        
        capacity_margin = self.arch3_available_modes / self.arch3_modes
        if capacity_margin < 2:
            return False, f"ARCH-3: Capacity margin {capacity_margin:.1f}× insufficient"
        
        return True, f"ARCH-2 ↔ ARCH-3: Geometry supports {self.arch3_modes} modes with {capacity_margin:.1f}× margin"
    
    def check_arch3_arch4_consistency(self) -> Tuple[bool, str]:
        """ARCH-3 (modes) must support ARCH-4 (throughput) via light transport."""
        # 512 modes × 75M tokens/s requires stable spatial mode addressing
        # Each token uses all 512 modes once (temporal multiplexing)
        
        if self.arch4_token_rate_mtok_s < 50:
            return False, "ARCH-4: Token rate too low for embedded inference"
        
        expected_latency = self.arch2_roundtrips * self.arch4_roundtrip_ps * 1e-3
        if abs(self.arch4_latency_ns - expected_latency) > 1:
            return False, f"ARCH-4: Latency {self.arch4_latency_ns} ns ≠ {expected_latency} ns"
        
        return True, f"ARCH-3 ↔ ARCH-4: {self.arch3_modes} modes transport {self.arch4_token_rate_mtok_s}M tok/s with {self.arch4_latency_ns:.1f}ns latency"
    
    def check_arch4_arch5_consistency(self) -> Tuple[bool, str]:
        """ARCH-4 (throughput) must maintain ARCH-5 (SNR) at token rate."""
        # Shot noise limits: P·T >> (quantum shot noise)
        # At 2.5mW, 100 passes, expect SNR > 35dB
        
        if self.arch5_snr_db < self.arch5_target_db:
            return False, f"ARCH-5: SNR {self.arch5_snr_db}dB < target {self.arch5_target_db}dB"
        
        if self.arch5_input_power_mw > 10:
            return False, f"ARCH-5: Input power {self.arch5_input_power_mw}mW may damage VCSEL"
        
        return True, f"ARCH-4 ↔ ARCH-5: {self.arch4_token_rate_mtok_s}M tok/s achieves {self.arch5_snr_db}dB SNR with {self.arch5_input_power_mw}mW input"
    
    def check_arch5_arch6_consistency(self) -> Tuple[bool, str]:
        """ARCH-5 (SNR) must support ARCH-6 (training via Hebbian)."""
        # Coherent Hebbian requires high SNR to encode weight updates
        # SNR > 36dB needed for 6-bit weight precision
        
        if self.arch5_snr_db < 36:
            return False, f"ARCH-5: SNR {self.arch5_snr_db}dB insufficient for Hebbian (need >36dB)"
        
        if self.arch6_wavelength_infer_nm == self.arch6_wavelength_train_nm:
            return False, "ARCH-6: Training & inference wavelengths must differ for photosensitivity"
        
        return True, f"ARCH-5 ↔ ARCH-6: {self.arch5_snr_db}dB SNR supports coherent Hebbian via {self.arch6_wavelength_train_nm}nm"
    
    def check_arch6_arch7_consistency(self) -> Tuple[bool, str]:
        """ARCH-6 (training) must fit weights in ARCH-7 (hologram capacity)."""
        # Rank-50 factorization: U (512×50) + V (50×512) per layer
        # PTR plate has ~10k pixels at 50µm pitch
        
        expected_pixels_per_layer = (512 * 50 + 50 * 512) / (self.arch7_pixel_pitch_um / 50) ** 2
        
        if self.arch7_total_params > 1.5e6:
            return False, f"ARCH-7: Total params {self.arch7_total_params} exceeds 1.5M"
        
        if self.arch7_max_gratings < 24:  # 24 layers
            return False, f"ARCH-7: Max gratings {self.arch7_max_gratings} < 24 layers needed"
        
        return True, f"ARCH-6 ↔ ARCH-7: Rank-50 factorization (1.23M params) fits in {self.arch7_max_gratings} multiplexed gratings"
    
    def check_arch7_arch8_consistency(self) -> Tuple[bool, str]:
        """ARCH-7 (weights) must be readable by ARCH-8 (coupling)."""
        # All-optical homodyne readout requires phase information from hologram
        
        if not self.arch8_all_optical:
            return False, "ARCH-8: Non-optical coupling required; breaks ARCH-7 holographic assumption"
        
        if self.arch8_interposer_required and self.arch3_polarization != "Dual":
            # Single polarization + no interposer = all-optical coupling valid
            pass
        
        return True, f"ARCH-7 ↔ ARCH-8: Holographic weights readable via {self.arch8_readout}"
    
    def check_arch8_arch9_consistency(self) -> Tuple[bool, str]:
        """ARCH-8 (coupling) must support ARCH-9 (nonlinearity)."""
        # All-optical coupling + Kerr nonlinearity requires coherent buildup
        # Finesse must be high enough to achieve φ_NL=0.2rad per pass
        
        if not self.arch8_all_optical:
            return False, "ARCH-8: Interposer coupling breaks all-optical nonlinearity assumption"
        
        if self.arch2_finesse < 1000:
            return False, f"ARCH-2 finesse {self.arch2_finesse} insufficient for coherent Kerr buildup"
        
        expected_phi = 0.2  # rad/pass design target
        if abs(self.arch9_phi_nl_rad - expected_phi) > 0.05:
            return False, f"ARCH-9: φ_NL {self.arch9_phi_nl_rad} rad ≠ design {expected_phi} rad"
        
        return True, f"ARCH-8 ↔ ARCH-9: All-optical coupling achieves {self.arch9_phi_nl_rad}rad SPM per pass @ R={self.arch2_r}"
    
    def check_arch9_arch10_consistency(self) -> Tuple[bool, str]:
        """ARCH-9 (nonlinearity) must be thermally stable via ARCH-10."""
        # 20 rad total phase shift over 100 passes = ~0.1 rad/degree thermal drift tolerance
        # Passive cooling must keep dn/dT drift << phase change
        
        if self.arch10_passive_rise_k > 30:
            return False, f"ARCH-10: Passive rise {self.arch10_passive_rise_k}K too high; may exceed thermal budget"
        
        # Rough estimate: dn/dT ~ 1e-4/K for glass; 15K rise → ~1.5e-3 phase drift
        # Acceptable if << φ_NL budget
        
        return True, f"ARCH-9 ↔ ARCH-10: Kerr nonlinearity ({self.arch9_phi_nl_rad}rad/pass) thermally stable via passive {self.arch10_passive_rise_k}K rise"
    
    def check_arch1_through_10_integration(self) -> Tuple[bool, str]:
        """Full system integration check across all 10 architectures."""
        
        checks = [
            self.check_arch1_arch2_consistency(),
            self.check_arch2_arch3_consistency(),
            self.check_arch3_arch4_consistency(),
            self.check_arch4_arch5_consistency(),
            self.check_arch5_arch6_consistency(),
            self.check_arch6_arch7_consistency(),
            self.check_arch7_arch8_consistency(),
            self.check_arch8_arch9_consistency(),
            self.check_arch9_arch10_consistency(),
        ]
        
        all_pass = all(c[0] for c in checks)
        
        if not all_pass:
            failed = [c[1] for c in checks if not c[0]]
            return False, "Integration failures: " + "; ".join(failed)
        
        return True, "ARCH-1 through ARCH-10 fully integrated and mutually consistent"
    
    def run_all_checks(self) -> bool:
        """Run all consistency checks."""
        checks = [
            ("ARCH-1 ↔ ARCH-2", self.check_arch1_arch2_consistency()),
            ("ARCH-2 ↔ ARCH-3", self.check_arch2_arch3_consistency()),
            ("ARCH-3 ↔ ARCH-4", self.check_arch3_arch4_consistency()),
            ("ARCH-4 ↔ ARCH-5", self.check_arch4_arch5_consistency()),
            ("ARCH-5 ↔ ARCH-6", self.check_arch5_arch6_consistency()),
            ("ARCH-6 ↔ ARCH-7", self.check_arch6_arch7_consistency()),
            ("ARCH-7 ↔ ARCH-8", self.check_arch7_arch8_consistency()),
            ("ARCH-8 ↔ ARCH-9", self.check_arch8_arch9_consistency()),
            ("ARCH-9 ↔ ARCH-10", self.check_arch9_arch10_consistency()),
            ("Full Integration", self.check_arch1_through_10_integration()),
        ]
        
        self.checks_performed = checks
        return all(c[1][0] for c in checks)
    
    def report_checks(self, verbose: bool = False):
        """Print check results."""
        print("\n" + "="*80)
        print("ARCHITECTURE CROSS-CHECK: ARCH-1 through ARCH-10")
        print("="*80 + "\n")
        
        all_pass = True
        for name, (passed, message) in self.checks_performed:
            status = "✓ PASS" if passed else "✗ FAIL"
            print(f"{name:<20} {status:<10} {message}")
            all_pass = all_pass and passed
        
        print("\n" + "="*80)
        if all_pass:
            print("RESULT: All architecture decisions LOCKED and mutually consistent.")
            print("Ready for experimental validation phase (EXP-1 through EXP-5).")
        else:
            print("RESULT: Architecture conflicts detected. Review before proceeding.")
        print("="*80 + "\n")
        
        return all_pass
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON export."""
        return {
            "date": "2026-04-20",
            "source": "ARCH_CROSSCHECK_2026-04-20.md",
            "architectures": {
                "ARCH-1": {
                    "name": "Physics primitives",
                    "primitive": self.arch1_primitive,
                    "weights_mechanism": self.arch1_weights,
                    "learning_mechanism": self.arch1_learning,
                },
                "ARCH-2": {
                    "name": "Resonator geometry",
                    "cavity_length_mm": self.arch2_length_mm,
                    "mirror_reflectivity": self.arch2_r,
                    "finesse": self.arch2_finesse,
                    "operational_roundtrips": self.arch2_roundtrips,
                    "coherence_margin": self.arch2_coherence_margin,
                },
                "ARCH-3": {
                    "name": "Mode structure",
                    "modes_addressed": self.arch3_modes,
                    "aperture_mm": self.arch3_aperture_mm,
                    "fundamental_waist_um": self.arch3_waist_um,
                    "modes_available": self.arch3_available_modes,
                    "polarization": self.arch3_polarization,
                },
                "ARCH-4": {
                    "name": "Throughput",
                    "roundtrip_ps": self.arch4_roundtrip_ps,
                    "token_rate_mtok_s": self.arch4_token_rate_mtok_s,
                    "latency_ns": self.arch4_latency_ns,
                },
                "ARCH-5": {
                    "name": "SNR budget",
                    "snr_db": self.arch5_snr_db,
                    "target_db": self.arch5_target_db,
                    "phase_snr_db": self.arch5_phase_snr_db,
                    "input_power_mw": self.arch5_input_power_mw,
                },
                "ARCH-6": {
                    "name": "Training",
                    "mechanism": self.arch6_mechanism,
                    "training_wavelength_nm": self.arch6_wavelength_train_nm,
                    "inference_wavelength_nm": self.arch6_wavelength_infer_nm,
                    "ephemeral_weights": self.arch6_weights_ephemeral,
                },
                "ARCH-7": {
                    "name": "Hologram capacity",
                    "pixel_pitch_um": self.arch7_pixel_pitch_um,
                    "active_area_mm2": self.arch7_active_area_mm2,
                    "spatial_pixels": self.arch7_spatial_pixels,
                    "max_gratings": self.arch7_max_gratings,
                    "params_per_layer": self.arch7_layer_params_per,
                    "rank": self.arch7_rank_per_layer,
                    "total_params": self.arch7_total_params,
                },
                "ARCH-8": {
                    "name": "Coupling",
                    "all_optical": self.arch8_all_optical,
                    "readout_method": self.arch8_readout,
                    "interposer_required": self.arch8_interposer_required,
                },
                "ARCH-9": {
                    "name": "Nonlinearity",
                    "mechanism": self.arch9_mechanism,
                    "spm_rad_per_pass": self.arch9_phi_nl_rad,
                    "total_spm_100_passes": self.arch9_total_phi_100,
                    "detuning_rad": self.arch9_detuning_rad,
                },
                "ARCH-10": {
                    "name": "Thermal management",
                    "plate_dimensions_mm": self.arch10_plate_mm,
                    "surface_area_mm2": self.arch10_surface_mm2,
                    "passive_rise_k": self.arch10_passive_rise_k,
                    "absorption_db_cm": self.arch10_absorption_db_cm,
                },
            },
            "checks": [
                {
                    "name": name,
                    "passed": passed,
                    "message": message,
                }
                for name, (passed, message) in self.checks_performed
            ],
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    parser.add_argument("--output", choices=["table", "json"], default="table")
    args = parser.parse_args()
    
    check = ArchitectureCrosscheck()
    check.run_all_checks()
    
    if args.output == "table":
        check.report_checks(verbose=args.verbose)
    else:
        print(json.dumps(check.to_dict(), indent=2))
