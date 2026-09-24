# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Status
# Gold: per-experiment freshness tracker. Marks an experiment "stale" if its
# latest processed_timestamp is older than 60 minutes. The latest timestamp per
# experiment is kept incrementally in latest_experiment_activity; this view only
# re-evaluates the status against the clock, over one row per experiment.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_STATUS_TABLE, LATEST_EXPERIMENT_ACTIVITY_TABLE

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_STATUS_TABLE,
    comment="Gold layer: Materialized view tracking experiment freshness status",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true"
    }
)
def experiment_status():
    """Track experiment data freshness."""
    FRESHNESS_THRESHOLD_MINUTES = 60

    # Get the current timestamp for comparison
    current_timestamp = F.current_timestamp()

    experiment_status_df = dlt.read(LATEST_EXPERIMENT_ACTIVITY_TABLE)

    freshness_threshold_seconds = FRESHNESS_THRESHOLD_MINUTES * 60
    status_df = (
        experiment_status_df
        .withColumn(
            "status",
            F.when(
                (current_timestamp.cast("long") - F.col("latest_processed_timestamp").cast("long")) <= freshness_threshold_seconds,
                F.lit("fresh")
            ).otherwise(F.lit("stale"))
        )
        .withColumn("status_updated_at", current_timestamp)
    )

    return status_df.select(
        "experiment_id",
        "latest_processed_timestamp",
        "status",
        "status_updated_at"
    )
