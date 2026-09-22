# Databricks notebook source
# DBTITLE 1,Metrics - Hourly Activity
# Public metrics: measurement counts by local hour of day. Field measurement
# tracks daylight; this is the profile behind the landing-page sun clock.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.metrics import HOURLY_ACTIVITY_TABLE, within_plausible_range
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=HOURLY_ACTIVITY_TABLE,
    comment="Public metrics: measurement counts by local hour of day.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def hourly_activity():
    """Up to 24 rows keyed by local hour.

    Rows without an IANA timezone (imported, large-IoT) have no defensible
    local hour and are excluded rather than binned at UTC.
    """
    now = F.current_timestamp()

    return (
        spark.table(centrum_table(SILVER_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .filter(F.col("timezone").isNotNull())
        .withColumn("hour_local", F.hour(F.from_utc_timestamp(F.col("timestamp"), F.col("timezone"))))
        .groupBy("hour_local")
        .agg(F.count("*").alias("measurements"))
        .withColumn("computed_at", now)
    )
