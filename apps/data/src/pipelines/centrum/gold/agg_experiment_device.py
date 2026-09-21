# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Device Aggregate
# Gold: per-device measurement counts and latest attributes, aggregated from
# silver. An aggregate, not a dimension: one row per (experiment, device,
# firmware), and the grain moves when a device is reflashed.
#
# Split out of experiment_device_data so the aggregate is the top node of its own
# table. The registry join that used to sit above it forced a full scan of silver
# on every trigger.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import AGG_EXPERIMENT_DEVICE_TABLE
from openjii.centrum.runtime import SILVER_TABLE

# COMMAND ----------

@dlt.table(
    name=AGG_EXPERIMENT_DEVICE_TABLE,
    comment="Gold layer: measurement counts and latest attributes per (experiment_id, device_id, device_firmware).",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    }
)
def agg_experiment_device():
    """Device stats per experiment, nothing above the aggregate.

    Every function here is additive or idempotent, which is what lets the refresh
    be incremental. Note max(client_id) is arbitrary for a device that changed
    client_id; that was true before this split and is unchanged by it.
    """
    return (
        dlt.read(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .groupBy("experiment_id", "device_id", "device_firmware")
        .agg(
            F.max("device_name").alias("device_name"),
            F.max("device_version").alias("device_version"),
            F.max("device_battery").alias("device_battery"),
            F.max("client_id").alias("client_id"),
            F.count("*").alias("total_measurements"),
            F.max("processed_timestamp").alias("processed_timestamp")
        )
    )
