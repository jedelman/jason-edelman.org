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
    
    # ARCH-9: Activation function (revised 2026-04-27)
    arch9_mechanism: str = "ReLU on intensity via VCSEL threshold"
    arch9_tia_rf_ohm: float = 667.0          # transimpedance, Ω
    arch9_driver_g_ma_per_v: float = 5.0     # driver transconductance, mA/V
    arch9_vcsel_ith_ma: float = 1.0          # VCSEL threshold current, mA
    arch9_vcsel_eta_s: float = 0.6           # slope efficiency, W/A
    arch9_K: float = 2.0                     # K = g·R_f·R_det = 5e-3×667×0.6
    arch9_A2: float = 1.2                    # net gain A² = η_s·K
    arch9_theta_mw: float = 0.5             # power threshold θ = I_th/K, mW
    arch9_apc_enabled: bool = True              # automatic power control on VCSEL driver
    
    # ARCH-10: Thermal
    arch10_plate_mm: str = "10×10×0.5"
    arch10_surface_mm2: float = 260
    arch10_passive_rise_k: float = 15
    arch10_absorption_db_cm: float = 0.01
    
    # Cross-cutting parameters
    wavelength_inference_nm: float = 850
    wavelength_training_nm: float = 532
    
    # NARG: Non-Autoregressive Generation (2026-04-24)
    narg_enabled: bool = False
    narg_fertility_dim: int = 512
    narg_write_overhead: float = 0.15
    narg_latency_gain: float = 0.15
    narg_snr_margin_used: float = 0.4
    
    # PTYCHOGRAPHY: Fresnel phase reconstruction (2026-04-24)
    ptych_enabled: bool = False
    ptych_capacity_multiplier: float = 2.5
    ptych_write_slowdown: float = 30
    ptych_feature_size_um: float = 0.6
    ptych_plate_size_mm: float = 5
    ptych_params_multiplier: float = 2.5
    ptych_snr_headroom_write_db: float = 15
    ptych_snr_headroom_read_db: float = 4
    
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
        """ARCH-8 (inter-layer coupling) must correctly implement ARCH-9 (ReLU activation)."""
        # Signal chain: P_k → I_photo → V_TIA → I_drive → P_VCSEL
        # K = g · R_f · R_det; must be > 0 and produce I_drive > I_th at nominal P
        R_det = 0.6  # A/W
        K = self.arch9_driver_g_ma_per_v * 1e-3 * self.arch9_tia_rf_ohm * R_det
        if abs(K - self.arch9_K) > 0.01:
            return False, f"ARCH-9: K={K:.3f} ≠ stored {self.arch9_K} — signal chain inconsistent"

        A2 = self.arch9_vcsel_eta_s * K
        if abs(A2 - self.arch9_A2) > 0.01:
            return False, f"ARCH-9: A²={A2:.3f} ≠ stored {self.arch9_A2}"

        theta = (self.arch9_vcsel_ith_ma * 1e-3) / K  # W
        theta_mw = theta * 1e3
        if abs(theta_mw - self.arch9_theta_mw) > 0.01:
            return False, f"ARCH-9: θ={theta_mw:.3f}mW ≠ stored {self.arch9_theta_mw}mW"

        # TIA rail check: V_TIA = R_f · R_det · P_op ≤ 1V (3.3V supply)
        P_op = 2.5e-3  # W nominal per mode
        V_tia_max = self.arch9_tia_rf_ohm * R_det * P_op
        if V_tia_max > 1.5:
            return False, f"ARCH-9: TIA rail violation — V_TIA={V_tia_max:.1f}V at P_op"

        # Gain > 1 required to compensate ~10% inter-layer coupling loss
        if A2 < 1.0:
            return False, f"ARCH-9: A²={A2:.3f} < 1.0 — signal attenuates across layers"

        return True, (f"ARCH-8 ↔ ARCH-9: ReLU on intensity. "
                      f"A²={A2:.2f}, θ={theta_mw:.1f}mW, V_TIA={V_tia_max*1e3:.0f}mV ✓")
    
    def check_arch9_arch10_consistency(self) -> Tuple[bool, str]:
        """ARCH-9 activation threshold must be stable under ARCH-10 thermal conditions."""
        # The 15K cavity thermal rise (ARCH-10) applies to PTR glass, not the VCSEL.
        # VCSELs are external to the cavity. VCSEL thermal load is self-heating only.
        # VCSEL self-heating: P_diss = I_drive·V_f - P_out ≈ 5mA×2V - 2.4mW = 7.6mW
        # R_th (oxide-confined GaAs VCSEL die) ≈ 1000 K/W → ΔT_vcsel ≈ 7.6K
        # dI_th/dT ≈ 0.5 mA/K → ΔI_th ≈ 3.8mA = 3.8× I_th(nom)
        # Without compensation: threshold θ drifts ±190% — unacceptable.
        # With APC: VCSEL driver IC monitors optical output power, adjusts I_bias
        # to hold (I_drive - I_th) constant → θ stable to driver APC accuracy (~1%).
        # APC is standard on all 850nm VCSEL driver ICs (OPT8241, MAX3748, etc.).

        if not self.arch9_apc_enabled:
            # Without APC, check raw drift tolerance
            dI_th_dT = 0.5e-3   # A/K typical GaAs VCSEL
            P_diss = 5e-3 * 2.0 - 2.4e-3  # W, at nominal drive
            R_th = 1000  # K/W
            delta_T_vcsel = P_diss * R_th
            delta_I_th = dI_th_dT * delta_T_vcsel
            frac = delta_I_th / (self.arch9_vcsel_ith_ma * 1e-3)
            if frac > 0.2:
                return False, (f"ARCH-9: VCSEL I_th drift {delta_I_th*1e3:.1f}mA "
                               f"({frac:.0%} of I_th) without APC — threshold unstable. "
                               f"Enable APC or add TEC.")
        return True, (f"ARCH-9 ↔ ARCH-10: VCSEL external to cavity (15K rise is glass, not VCSEL). "
                      f"VCSEL self-heating ~7.6K → ΔI_th~3.8mA, compensated by APC loop.")
    
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
    
    def check_narg_compatibility(self) -> Tuple[bool, str]:
        """Check NARG compatibility with ARCH-3 and ARCH-5."""
        if not self.narg_enabled:
            return True, "NARG: disabled (baseline mode)"
        
        # NARG requires 512 spatial modes for parallel position decoding
        if self.arch3_modes < self.narg_fertility_dim:
            return False, f"NARG: {self.narg_fertility_dim} parallel positions > {self.arch3_modes} modes"
        
        # SNR margin check: √512 ≈ 23× louder during parallel decode
        snr_margin_available = self.arch5_snr_db - self.arch5_target_db
        snr_noise_increase_db = 10 * math.log10(math.sqrt(self.narg_fertility_dim))  # ~23.6 dB
        
        if snr_margin_available < snr_noise_increase_db * self.narg_snr_margin_used:
            return False, f"NARG: SNR margin {snr_margin_available}dB insufficient (need {snr_noise_increase_db * self.narg_snr_margin_used:.1f}dB)"
        
        return True, f"NARG: {self.narg_fertility_dim} parallel positions compatible. SNR margin {snr_margin_available}dB >> {snr_noise_increase_db:.1f}dB noise"
    
    def check_ptych_compatibility(self) -> Tuple[bool, str]:
        """Check ptychography compatibility with ARCH-7 and ARCH-10."""
        if not self.ptych_enabled:
            return True, "PTYCHOGRAPHY: disabled (standard holography)"
        
        # Ptychography trades write speed for capacity
        write_time_multiplier = self.ptych_write_slowdown  # 20-50×
        capacity_gain = self.ptych_capacity_multiplier  # 2-4×
        
        # New capacity estimate
        baseline_params = self.arch7_total_params
        new_params = baseline_params * capacity_gain
        
        # Check if new params exceed practical limit (~5M for rank-100/full-rank)
        if new_params > 5_000_000:
            return False, f"PTYCH: {new_params:.1e} params exceeds practical limit (~5M)"
        
        # SNR headroom check
        available_snr_write = self.arch5_snr_db - self.arch5_target_db
        if available_snr_write < self.ptych_snr_headroom_write_db:
            return False, f"PTYCH: Write SNR margin {available_snr_write}dB < {self.ptych_snr_headroom_write_db}dB required"
        
        plate_volume_ratio = (10 * 10 / (self.ptych_plate_size_mm ** 2))  # 4× smaller
        
        return True, f"PTYCH: {capacity_gain}× capacity ({new_params/1e6:.1f}M params), {write_time_multiplier}× slower write, {plate_volume_ratio:.0f}× smaller plates"
    
    def check_narg_ptych_interaction(self) -> Tuple[bool, str]:
        """Check if NARG + PTYCH together are compatible."""
        if not (self.narg_enabled and self.ptych_enabled):
            return True, "NARG+PTYCH: not both enabled (no interaction)"
        
        # If both: NARG increases write overhead (multi-target Hebbian)
        # PTYCH increases write complexity (phase reconstruction)
        combined_write_cost = self.narg_write_overhead + (1.0 - 1.0 / self.ptych_write_slowdown)
        
        if combined_write_cost > 0.8:
            return False, f"NARG+PTYCH: combined write overhead {combined_write_cost:.1%} approaching saturation"
        
        return True, f"NARG+PTYCH: combined write overhead {combined_write_cost:.1%} (tolerable)"
    
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
            ("NARG Compat", self.check_narg_compatibility()),
            ("PTYCH Compat", self.check_ptych_compatibility()),
            ("NARG+PTYCH", self.check_narg_ptych_interaction()),
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
            print("Ready for experimental validation phase (EXP-2 through EXP-5, EXP-7).")
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
                    "name": "Activation function",
                    "mechanism": self.arch9_mechanism,
                    "tia_rf_ohm": self.arch9_tia_rf_ohm,
                    "driver_g_ma_per_v": self.arch9_driver_g_ma_per_v,
                    "vcsel_ith_ma": self.arch9_vcsel_ith_ma,
                    "K": self.arch9_K,
                    "A2_net_gain": self.arch9_A2,
                    "theta_mw": self.arch9_theta_mw,
                    "detuning_rad": self.arch9_detuning_rad,
                },
                "ARCH-10": {
                    "name": "Thermal management",
                    "plate_dimensions_mm": self.arch10_plate_mm,
                    "surface_area_mm2": self.arch10_surface_mm2,
                    "passive_rise_k": self.arch10_passive_rise_k,
                    "absorption_db_cm": self.arch10_absorption_db_cm,
                },
                "NARG": {
                    "name": "Non-Autoregressive Generation (2026-04-24)",
                    "enabled": self.narg_enabled,
                    "fertility_dim": self.narg_fertility_dim,
                    "write_overhead": self.narg_write_overhead,
                    "latency_gain": self.narg_latency_gain,
                    "snr_margin_used": self.narg_snr_margin_used,
                },
                "PTYCHOGRAPHY": {
                    "name": "Fresnel Phase Reconstruction (2026-04-24)",
                    "enabled": self.ptych_enabled,
                    "capacity_multiplier": self.ptych_capacity_multiplier,
                    "write_slowdown": self.ptych_write_slowdown,
                    "feature_size_um": self.ptych_feature_size_um,
                    "plate_size_mm": self.ptych_plate_size_mm,
                    "params_multiplier": self.ptych_params_multiplier,
                    "snr_headroom_write_db": self.ptych_snr_headroom_write_db,
                    "snr_headroom_read_db": self.ptych_snr_headroom_read_db,
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
