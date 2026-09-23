# Databricks notebook source
# DBTITLE 1,Metrics - Experiment Device Counts
# Measurement counts per (experiment, device, firmware), read back by Centrum's
# experiment_device_data. A count cannot be kept incrementally in Centrum, which
# is not serverless; this pipeline is, so a deterministic view over a source with
# row tracking can refresh incrementally. Whether it does is recorded per update
# in the pipeline's planning_information events.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.metrics import EXPERIMENT_DEVICE_COUNTS_TABLE
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=EXPERIMENT_DEVICE_COUNTS_TABLE,
    comment="Measurement counts per (experiment_id, device_id, device_firmware).",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def experiment_device_counts():
    """No clock and no joins, so nothing stops the planner refreshing it
    incrementally."""
    return (
        spark.table(centrum_table(SILVER_TABLE))
        .filter("experiment_id IS NOT NULL")
        .groupBy("experiment_id", "device_id", "device_firmware")
        .agg(F.count("*").alias("total_measurements"))
    )
