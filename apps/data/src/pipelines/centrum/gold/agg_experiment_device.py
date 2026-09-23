# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Device Aggregate
# Gold: per-device measurement counts and latest attributes, aggregated from
# silver. An aggregate, not a dimension: one row per (experiment, device,
# firmware), and the grain moves when a device is reflashed.
#
# Split out of experiment_device_data so the aggregate is the top node of its own
# table. The registry join that used to sit above it forced a full scan of silver
# on every trigger.
#
# The one gold aggregate that stays a materialized view. AUTO CDC upserts by key
# but does not sum, and a running count over an unbounded stream is stateful, so
# neither of the constructs the bridges converted to can carry total_measurements.
#
# It gets its own trigger interval instead. The only consumer is the measurement
# count shown against a device in an experiment's device list, and the pipeline's
# own end-to-end lag runs from six to eighty-six minutes, so refreshing this every
# ten minutes leaves the number fresher than the data it describes. Unset, it
# would take Databricks' one-minute default for a materialized view over Delta
# inputs: up to 1,440 full scans of silver a day instead of up to 144. Both are
# ceilings; a scan that outlasts the interval pushes the next one back.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import AGG_EXPERIMENT_DEVICE_TABLE
from openjii.centrum.runtime import SILVER_TABLE

# COMMAND ----------

AGG_EXPERIMENT_DEVICE_INTERVAL = "10 minutes"

@dlt.table(
    name=AGG_EXPERIMENT_DEVICE_TABLE,
    comment="Gold layer: measurement counts and latest attributes per (experiment_id, device_id, device_firmware).",
    spark_conf={"pipelines.trigger.interval": AGG_EXPERIMENT_DEVICE_INTERVAL},
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

    Every function here is additive or idempotent, so partial results over
    disjoint inputs would combine, which is what would make this convertible if
    the pipeline ever gains a construct that accumulates. Note max(client_id) is
    arbitrary for a device that changed client_id; that predates this split.
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
