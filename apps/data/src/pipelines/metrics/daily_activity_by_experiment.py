# Databricks notebook source
# DBTITLE 1,Metrics - Daily Activity by Experiment
# Backend-only scope table: per-experiment daily counts powering org- and
# user-scoped activity. Experiment-grain rows never leave the backend
# unaggregated; the public endpoint must not expose this table.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.metrics import DAILY_ACTIVITY_BY_EXPERIMENT_TABLE, within_plausible_range
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=DAILY_ACTIVITY_BY_EXPERIMENT_TABLE,
    comment="Backend-only: per-experiment daily measurement counts for scoped activity.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def daily_activity_by_experiment():
    """One row per (date, experiment) with measurement and device counts."""
    now = F.current_timestamp()

    return (
        spark.table(centrum_table(SILVER_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .filter(F.col("experiment_id").isNotNull())
        .groupBy("date", "experiment_id")
        .agg(
            F.count("*").alias("measurements"),
            F.countDistinct("device_id").alias("active_devices"),
        )
        .withColumn("computed_at", now)
    )
