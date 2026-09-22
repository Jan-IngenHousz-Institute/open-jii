# Databricks notebook source
# DBTITLE 1,Metrics - Experiment Contributors Window
# Backend-only scope table: distinct (experiment, contributor) pairs in the
# activity window, so the backend can deduplicate contributors across an
# organization's experiments. User-grain rows never leave the backend
# unaggregated; the public endpoint must not expose this table.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.metrics import (
    ACTIVITY_WINDOW_DAYS,
    EXPERIMENT_CONTRIBUTORS_WINDOW_TABLE,
    within_plausible_range,
)
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=EXPERIMENT_CONTRIBUTORS_WINDOW_TABLE,
    comment="Backend-only: distinct experiment-contributor pairs in the 30-day window.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def experiment_contributors_window():
    """Distinct (experiment_id, user_id) pairs with measurement activity."""
    now = F.current_timestamp()

    return (
        spark.table(centrum_table(SILVER_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .filter(F.col("timestamp") >= now - F.expr(f"INTERVAL {ACTIVITY_WINDOW_DAYS} DAYS"))
        .filter(F.col("experiment_id").isNotNull() & F.col("user_id").isNotNull())
        .select("experiment_id", "user_id")
        .distinct()
        .withColumn("computed_at", now)
    )
