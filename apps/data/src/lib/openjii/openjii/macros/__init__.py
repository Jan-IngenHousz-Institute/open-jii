"""Shared building blocks for the macro-execution DLT pipeline.

Same split as ``openjii.centrum``: this ``__init__`` re-exports only the
spark-free surface; ``openjii.macros.runtime`` reads ``spark.conf`` eagerly
and must only be imported inside the running pipeline.

This is a separate deployment, not a separate domain. Macro execution calls the
backend sandbox over HTTP from a Spark task, and while it shared the centrum
pipeline those tasks held its slots for hours and ingestion stalled behind them.
The table it publishes is centrum-schema gold either way: a compute boundary does
not get its own namespace.
"""

from .constants import (
    EXPERIMENT_RAW_DATA_TABLE,
    FACT_MACRO_RESULT_TABLE,
    LEGACY_MACRO_DATA_TABLE,
    MACRO_RESULT_BACKFILL_FLOW,
    MACRO_RESULT_LIVE_FLOW,
)

__all__ = [
    "EXPERIMENT_RAW_DATA_TABLE",
    "FACT_MACRO_RESULT_TABLE",
    "LEGACY_MACRO_DATA_TABLE",
    "MACRO_RESULT_BACKFILL_FLOW",
    "MACRO_RESULT_LIVE_FLOW",
]
