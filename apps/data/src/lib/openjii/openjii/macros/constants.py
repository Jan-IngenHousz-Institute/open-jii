"""Pure string constants used by the macro-execution DLT pipeline.

No Spark session dependency. Safe to import anywhere.
"""

from __future__ import annotations

from openjii.centrum.constants import (
    EXPERIMENT_MACRO_DATA_TABLE,
    EXPERIMENT_RAW_DATA_TABLE,
    FACT_MACRO_RESULT_TABLE,
)

# The centrum table the one-time backfill drains, so history moves across
# without re-executing a single macro through the sandbox.
LEGACY_MACRO_DATA_TABLE = EXPERIMENT_MACRO_DATA_TABLE

MACRO_RESULT_LIVE_FLOW = "fact_macro_result_live"
MACRO_RESULT_BACKFILL_FLOW = "fact_macro_result_backfill"

__all__ = [
    "EXPERIMENT_RAW_DATA_TABLE",
    "FACT_MACRO_RESULT_TABLE",
    "LEGACY_MACRO_DATA_TABLE",
    "MACRO_RESULT_BACKFILL_FLOW",
    "MACRO_RESULT_LIVE_FLOW",
]
