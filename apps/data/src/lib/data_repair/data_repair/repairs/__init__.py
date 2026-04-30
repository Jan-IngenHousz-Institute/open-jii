"""Repairs auto-register on import via @inline_repair. New files: follow
the _YYYY_MM_<name>.py convention and add an import line below."""
from . import _2026_04_rides_inplace  # noqa: F401
