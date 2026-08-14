"""Shared building blocks for the metrics DLT pipeline.

Same split as ``openjii.centrum``: this ``__init__`` re-exports only the
spark-free surface; ``openjii.metrics.runtime`` reads ``spark.conf`` eagerly
and must only be imported inside the running pipeline.
"""

from .constants import (
    DAILY_ACTIVITY_TABLE,
    FAMILY_TOTALS_TABLE,
    MEASUREMENT_TIMESTAMP_FLOOR,
    PLATFORM_TOTALS_TABLE,
    UNATTRIBUTED_FAMILY,
)
from .timestamps import within_plausible_range

__all__ = [
    "DAILY_ACTIVITY_TABLE",
    "FAMILY_TOTALS_TABLE",
    "MEASUREMENT_TIMESTAMP_FLOOR",
    "PLATFORM_TOTALS_TABLE",
    "UNATTRIBUTED_FAMILY",
    "within_plausible_range",
]
