# Databricks notebook source
# DBTITLE 1,Metrics - Activity Windows
# Public metrics: windowed scalar counters (24h and 30d). Contributor counts
# are aggregated here so no user identifier is stored in a public-facing table.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.metrics import ACTIVITY_WINDOW_DAYS, ACTIVITY_WINDOWS_TABLE, within_plausible_range
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=ACTIVITY_WINDOWS_TABLE,
    comment="Public metrics: one row of rolling 24h and 30d activity counters.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def activity_windows():
    """One row: the community line and the liveness indicator in scalars."""
    now = F.current_timestamp()

    in_24h = F.col("timestamp") >= now - F.expr("INTERVAL 24 HOURS")
    in_window = F.col("timestamp") >= now - F.expr(f"INTERVAL {ACTIVITY_WINDOW_DAYS} DAYS")

    return (
        spark.table(centrum_table(SILVER_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .agg(
            F.count(F.when(in_24h, True)).alias("measurements_24h"),
            F.count(F.when(in_window, True)).alias("measurements_30d"),
            F.countDistinct(F.when(in_window, F.col("experiment_id"))).alias("experiments_30d"),
            F.countDistinct(F.when(in_window, F.col("user_id"))).alias("contributors_30d"),
            F.countDistinct(F.when(in_window, F.col("device_id"))).alias("devices_30d"),
            F.max("timestamp").alias("last_measurement_at"),
        )
        .withColumn("computed_at", now)
    )
