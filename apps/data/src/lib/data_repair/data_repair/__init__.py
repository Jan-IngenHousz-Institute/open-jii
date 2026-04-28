"""
data_repair

Reusable framework for patching corrupted data downstream of bronze, without
mutating bronze and without full-refreshing experiment_ tables. See README.md
for the patterns supported and how to add a new repair.
"""
__version__ = "0.1.0"

from .manifest import (
    FunctionRepair,
    OverlayRepair,
    apply_function_repairs,
    apply_overlay_repairs,
    list_repairs,
    register_function_repair,
    register_overlay_repair,
)

# Trigger decorator registration for every repair file.
from . import repairs  # noqa: F401

__all__ = [
    "FunctionRepair",
    "OverlayRepair",
    "apply_function_repairs",
    "apply_overlay_repairs",
    "list_repairs",
    "register_function_repair",
    "register_overlay_repair",
]
