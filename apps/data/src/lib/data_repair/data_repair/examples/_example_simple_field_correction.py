"""
Scenario: a top-level scalar field carries a known-bad value that needs
straight remapping. Smallest possible function-based repair.

Use case: "Mobile pre-v1.14 sent protocol_id as 'rides_2_0' (underscore) but
the canonical form is 'rides_2.0' (dot). One-to-one mapping, no transform."
"""
from pyspark.sql import functions as F

from ..manifest import register_function_repair


_PROTOCOL_ID_FIXES = {
    "rides_2_0": "rides_2.0",
    "rides_2_1": "rides_2.1",
}


@register_function_repair(
    table="experiment_raw_data",
    issue="OJD-XXXX / GH#YYYY",
    description="Normalize legacy protocol_id formats with underscores.",
)
def protocol_id_legacy_format(df):
    # Build a chained CASE WHEN matching each known bad value.
    # Idempotent: once normalized, the value no longer matches any key.
    fixed = F.col("protocol_id")
    for bad, good in _PROTOCOL_ID_FIXES.items():
        fixed = F.when(F.col("protocol_id") == F.lit(bad), F.lit(good)).otherwise(fixed)
    return df.withColumn("protocol_id", fixed)
