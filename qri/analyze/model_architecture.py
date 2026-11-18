#!/usr/bin/env python3
"""
QRI Model Architecture: Parameter Counting and Capacity Analysis

Calculates model size, rank-factorized weight matrices, holographic storage capacity.

Architecture:
- 24 layers (coherent Fabry-Perot resonators)
- 512-dim token embedding
- Rank-50 low-rank factorization per layer
- 1.23M total parameters
- Holographic weight storage in PTR glass

Usage:
    python analyze/model_architecture.py
    python analyze/model_architecture.py --output json
"""

import json
import math
import argparse
from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class ModelArchitecture:
    """QRI end-to-end model architecture and parameter accounting."""
    
    num_layers: int = 24
    embedding_dim: int = 512
    rank: int = 50  # Low-rank factorization
    num_experts: int = 4_000_000  # For MoE with rank-50
    
    @property
    def params_per_layer_full_rank(self) -> int:
        """Full rank: d × d weight matrix."""
        return self.embedding_dim ** 2
    
    @property
    def params_per_layer_rank_r(self) -> int:
        """Rank-r factorization: d×r + r×d (U·V^T)."""
        return (self.embedding_dim * self.rank) + (self.rank * self.embedding_dim)
    
    @property
    def total_params_full_rank(self) -> int:
        """Full rank over all layers."""
        return self.num_layers * self.params_per_layer_full_rank
    
    @property
    def total_params_rank_r(self) -> int:
        """Rank-r over all layers."""
        return self.num_layers * self.params_per_layer_rank_r
    
    @property
    def compression_ratio(self) -> float:
        """Rank-r vs full rank."""
        return self.total_params_full_rank / self.total_params_rank_r
    
    @property
    def params_per_expert(self) -> float:
        """If using MoE: params per expert module."""
        return self.total_params_rank_r / self.num_experts
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "architecture": {
                "num_layers": self.num_layers,
                "embedding_dim": self.embedding_dim,
                "rank": self.rank,
            },
            "parameters_per_layer": {
                "full_rank_d×d": self.params_per_layer_full_rank,
                "rank_r_u_v": self.params_per_layer_rank_r,
                "savings": f"{self.compression_ratio:.1f}× compression",
            },
            "total_parameters": {
                "full_rank_layers": f"{self.total_params_full_rank:,}",
                "rank_r_factorized": f"{self.total_params_rank_r:,}",
                "notation": "1.23M params = 24 layers × (512×50 + 50×512) / layer",
            },
            "moe_scaling": {
                "num_experts": f"{self.num_experts:,}",
                "params_per_expert": round(self.params_per_expert, 3),
                "sparsity": "K=4 (4 active per token)",
                "effective_params": f"{self.num_experts * self.params_per_expert / 1e6:.1f}M per layer",
            },
        }


@dataclass
class HologramCapacity:
    """ARCH-7: Weight storage in holographic PTR glass.
    
    PTR plate stores Δn(x,y) via multiplexed gratings.
    Capacity limited by:
    1. Angular resolution (max ~1000 gratings)
    2. Spatial pixels (10k pixels at 50µm pitch)
    3. Δn bits of precision (~4-5 bits)
    """
    
    aperture_mm: float = 2.5
    pixel_pitch_um: float = 50
    delta_n_range_max: float = 5e-3
    delta_n_bits_precision: int = 4
    max_multiplexed_gratings: int = 1000
    
    @property
    def active_aperture_mm2(self) -> float:
        """Circular aperture area."""
        radius_mm = self.aperture_mm / 2
        return math.pi * radius_mm ** 2
    
    @property
    def spatial_pixels_per_aperture(self) -> int:
        """Number of pixels in aperture at 50µm pitch."""
        pixels_per_side = int(self.aperture_mm / (self.pixel_pitch_um / 1000))
        return pixels_per_side ** 2
    
    @property
    def bits_per_pixel(self) -> int:
        """Δn quantization levels."""
        return self.delta_n_bits_precision
    
    @property
    def total_capacity_bits(self) -> int:
        """Total information capacity: pixels × bits/pixel."""
        return self.spatial_pixels_per_aperture * self.bits_per_pixel
    
    @property
    def capacity_with_multiplexing(self) -> Dict[str, Any]:
        """Angular multiplexing increases capacity ~1000×."""
        return {
            "spatial_capacity_bits": self.total_capacity_bits,
            "max_gratings": self.max_multiplexed_gratings,
            "total_bits_with_multiplexing": self.total_capacity_bits * self.max_multiplexed_gratings,
            "total_bytes": self.total_capacity_bits * self.max_multiplexed_gratings // 8,
            "total_mbytes": (self.total_capacity_bits * self.max_multiplexed_gratings // 8) / 1e6,
        }
    
    @property
    def params_per_grating(self) -> int:
        """Parameters stored per holographic grating.
        
        A single grating encodes an outer product of two vectors.
        For d-dimensional embedding: O(d²) parameters per grating.
        With ~10k spatial pixels at 4-5 bits: ~50k bits ≈ 6.25 kB per grating.
        """
        return self.spatial_pixels_per_aperture * self.bits_per_pixel // 8  # Bytes
    
    def to_dict(self) -> Dict[str, Any]:
        mux_cap = self.capacity_with_multiplexing
        return {
            "ARCH-7-hologram-capacity": "Weight storage in PTR glass via angular multiplexing",
            "plate_parameters": {
                "aperture_mm": self.aperture_mm,
                "active_area_mm2": round(self.active_aperture_mm2, 2),
                "pixel_pitch_um": self.pixel_pitch_um,
            },
            "spatial_capacity": {
                "pixels_per_aperture": self.spatial_pixels_per_aperture,
                "bits_per_pixel": self.bits_per_pixel,
                "total_bits": self.total_capacity_bits,
                "bytes": self.total_capacity_bits // 8,
            },
            "angular_multiplexing": {
                "max_gratings": self.max_multiplexed_gratings,
                "bits_with_mux": mux_cap["total_bits_with_multiplexing"],
                "bytes_with_mux": mux_cap["total_bytes"],
                "mbytes_with_mux": round(mux_cap["total_mbytes"], 2),
            },
            "per_grating": {
                "bytes_per_grating": self.params_per_grating,
                "capacity_note": "Grating stores outer-product weight matrix",
            },
        }


@dataclass
class WeightQuantization:
    """4-5 bit quantization for weight storage and inference.
    
    Trade-off: quantization loss vs. storage savings and inference speed.
    """
    
    num_bits: int = 4
    total_params: int = 1_230_000
    
    @property
    def levels_per_param(self) -> int:
        """Number of discrete values: 2^bits."""
        return 2 ** self.num_bits
    
    @property
    def bits_total(self) -> int:
        """Total bits needed."""
        return self.num_bits * self.total_params
    
    @property
    def bytes_total(self) -> int:
        """Total bytes."""
        return self.bits_total // 8
    
    @property
    def mbytes_total(self) -> float:
        """Total MBytes."""
        return self.bytes_total / 1e6
    
    @property
    def expected_perplexity_loss_pct(self) -> float:
        """Rough estimate: 4-5 bit quantization → 1-3% perplexity increase.
        
        From literature (Dettmers 2022, Frantar 2022):
        - 8-bit: <0.5% loss
        - 6-bit: ~0.5-1% loss
        - 4-bit: ~1-5% loss
        
        For rank-50 factorization + 4-bit: expect ~2-3% loss.
        """
        if self.num_bits >= 8:
            return 0.5
        elif self.num_bits >= 6:
            return 1.0
        elif self.num_bits >= 4:
            return 2.5
        else:
            return 5.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "quantization": {
                "bits_per_param": self.num_bits,
                "levels_per_param": self.levels_per_param,
                "range_example": f"[-1, 1] into {self.levels_per_param} levels",
            },
            "storage": {
                "total_params": f"{self.total_params:,}",
                "total_bits": f"{self.bits_total:,}",
                "total_bytes": f"{self.bytes_total:,}",
                "total_mbytes": round(self.mbytes_total, 2),
            },
            "expected_impact": {
                "perplexity_loss_pct": self.expected_perplexity_loss_pct,
                "note": f"{self.num_bits}-bit quantization typically causes {self.expected_perplexity_loss_pct}% perplexity increase",
            },
        }


def print_model_architecture_report():
    """Print comprehensive model architecture report."""
    
    print("\n" + "="*80)
    print("QRI MODEL ARCHITECTURE & PARAMETER ACCOUNTING")
    print("="*80 + "\n")
    
    # Model architecture
    print("MODEL ARCHITECTURE")
    print("-" * 80)
    model = ModelArchitecture()
    model_dict = model.to_dict()
    print(json.dumps(model_dict, indent=2))
    
    # Hologram capacity
    print("\n\nHOLOGRAM CAPACITY (ARCH-7)")
    print("-" * 80)
    holo = HologramCapacity()
    holo_dict = holo.to_dict()
    print(json.dumps(holo_dict, indent=2))
    
    # Quantization
    print("\n\nWEIGHT QUANTIZATION")
    print("-" * 80)
    quant = WeightQuantization()
    quant_dict = quant.to_dict()
    print(json.dumps(quant_dict, indent=2))
    
    # Compatibility check
    print("\n\nCAPACITY COMPATIBILITY CHECK")
    print("-" * 80)
    model_mbytes = (model.total_params_rank_r * 4) / (8 * 1e6)  # 4-bit
    holo_mbytes = holo.capacity_with_multiplexing["total_mbytes"]
    
    print(f"Model size (4-bit quantized):  {model_mbytes:.2f} MBytes")
    print(f"Hologram capacity (PTR glass): {holo_mbytes:.2f} MBytes")
    print(f"Fits in hologram?:             {'✓ YES' if model_mbytes <= holo_mbytes else '✗ NO'}")
    print(f"Utilization ratio:             {100 * model_mbytes / holo_mbytes:.1f}%")
    
    print("\n" + "="*80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", choices=["table", "json"], default="table")
    args = parser.parse_args()
    
    if args.output == "table":
        print_model_architecture_report()
    else:
        result = {
            "model": ModelArchitecture().to_dict(),
            "hologram": HologramCapacity().to_dict(),
            "quantization": WeightQuantization().to_dict(),
        }
        print(json.dumps(result, indent=2))
