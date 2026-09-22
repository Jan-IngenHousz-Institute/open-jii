# Databricks notebook source
# DBTITLE 1,Metrics - Family Totals
# Public metrics: per-sensor-family counters. Family comes from the device
# registry via the broker-authenticated client_id; rows without one (imported,
# large-IoT, Cognito) or without a registry match land in "unattributed".

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_DEVICES_TABLE
from openjii.metrics import FAMILY_TOTALS_TABLE, UNATTRIBUTED_FAMILY, within_plausible_range
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=FAMILY_TOTALS_TABLE,
    comment="Public metrics: measurement and device counters per sensor family.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def family_totals():
    """One row per family with all-time and 7-day activity counters."""
    now = F.current_timestamp()

    family_by_client = (
        spark.table(centrum_table(EXPERIMENT_DEVICES_TABLE))
        .filter("device.device_type IS NOT NULL")
        .groupBy("client_id")
        .agg(F.max("device.device_type").alias("registry_family"))
    )

    measurements = (
        spark.table(centrum_table(SILVER_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .join(family_by_client, on="client_id", how="left")
        .withColumn("family", F.coalesce(F.col("registry_family"), F.lit(UNATTRIBUTED_FAMILY)))
    )

    is_recent = F.col("timestamp") >= now - F.expr("INTERVAL 7 DAYS")

    return (
        measurements.groupBy("family")
        .agg(
            F.count("*").alias("total_measurements"),
            F.countDistinct("device_id").alias("devices_all_time"),
            F.countDistinct(F.when(is_recent, F.col("device_id"))).alias("devices_active_7d"),
            F.max("timestamp").alias("last_measurement_at"),
        )
        .withColumn("computed_at", now)
    )
