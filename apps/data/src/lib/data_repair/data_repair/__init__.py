"""
data_repair

Reusable framework for patching corrupted data downstream of bronze, without
mutating bronze. See README.md for how to add a new repair.
"""
__version__ = "0.1.0"

from .manifest import (
    InlineRepair,
    Severity,
    apply_inline_repairs,
    inline_repair,
    list_repairs,
)

# Trigger decorator registration for every repair file.
from . import repairs  # noqa: F401

__all__ = [
    "InlineRepair",
    "Severity",
    "apply_inline_repairs",
    "inline_repair",
    "list_repairs",
]
