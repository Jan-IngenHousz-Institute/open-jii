"""Timestamp plausibility predicate shared by the metrics tables."""

from __future__ import annotations

from pyspark.sql import Column
from pyspark.sql import functions as F

from .constants import MEASUREMENT_TIMESTAMP_FLOOR


def within_plausible_range(timestamp: Column, now: Column) -> Column:
    """True when a measurement timestamp is neither epoch-era nor future."""
    return (timestamp >= F.lit(MEASUREMENT_TIMESTAMP_FLOOR).cast("timestamp")) & (timestamp <= now)
