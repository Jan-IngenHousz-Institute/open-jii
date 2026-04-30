"""Patches corrupted data downstream of bronze. See README.md."""
__version__ = "0.1.0"

from .manifest import (
    InlineRepair,
    Severity,
    apply_inline_repairs,
    inline_repair,
    list_repairs,
)
from . import repairs  # noqa: F401  (import triggers @inline_repair registrations)

__all__ = [
    "InlineRepair",
    "Severity",
    "apply_inline_repairs",
    "inline_repair",
    "list_repairs",
]
