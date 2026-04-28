"""
Scenario: a sensor occasionally returns out-of-range or sentinel values that
should be treated as missing. No "inverse" possible — the original was lost.
Just sanitize on read.

Use case: humidity readings of -1, 999, or NaN-equivalent values from certain
firmware revisions. Replace with NULL so downstream stats ignore them.
"""
from pyspark.sql import functions as F

from ..manifest import register_function_repair


@register_function_repair(
    table="experiment_raw_data",
    issue="OJD-XXXX / GH#YYYY",
    description="Treat out-of-range humidity readings as missing.",
)
def clamp_invalid_humidity(df):
    # Affected only on a specific firmware family.
    affected_firmware = F.col("device_firmware").rlike(r"^v0\.[0-3]\.")
    humidity = F.col("data").getField("humidity")
    in_range = (humidity >= F.lit(0.0)) & (humidity <= F.lit(100.0))

    cleaned = F.when(
        affected_firmware & ~in_range,
        F.col("data").dropFields("humidity"),
    ).otherwise(F.col("data"))

    return df.withColumn("data", cleaned)
