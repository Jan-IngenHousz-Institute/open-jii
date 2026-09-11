# Databricks notebook source
# DBTITLE 1,Metrics - Experiment Devices Window
# Backend-only scope table: distinct (experiment, publisher) pairs in the
# activity window. A logger publishes with no contributor at all, so counting
# people alone credits none of the volume it records. Publisher-grain rows
# never leave the backend unaggregated; the public endpoint must not expose
# this table.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.metrics import (
    ACTIVITY_WINDOW_DAYS,
    EXPERIMENT_DEVICES_WINDOW_TABLE,
    within_plausible_range,
)
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=EXPERIMENT_DEVICES_WINDOW_TABLE,
    comment="Backend-only: distinct experiment-device pairs in the 30-day window.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def experiment_devices_window():
    """Distinct (experiment_id, client_id) pairs with measurement activity.

    `client_id` is the publisher as it identified itself, which the device
    registry cannot always resolve to a registered device. Counting distinct
    publishers needs no such resolution.
    """
    now = F.current_timestamp()

    return (
        spark.table(centrum_table(SILVER_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .filter(F.col("timestamp") >= now - F.expr(f"INTERVAL {ACTIVITY_WINDOW_DAYS} DAYS"))
        .filter(F.col("experiment_id").isNotNull() & F.col("client_id").isNotNull())
        .select("experiment_id", "client_id")
        .distinct()
        .withColumn("computed_at", now)
    )
