# Databricks notebook source
# DBTITLE 1,Gold Layer - Latest Experiment Activity
# Gold: the newest processed_timestamp per experiment, which is all
# experiment_status needs from silver.
#
# A streaming table maintained by AUTO CDC rather than a materialized view. This
# pipeline is not serverless, and a materialized view outside a serverless
# pipeline is always fully recomputed, so experiment_status used to aggregate all
# of silver on every trigger. Keyed on experiment_id, this merges only the rows a
# trigger brought in.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import LATEST_EXPERIMENT_ACTIVITY_TABLE
from openjii.centrum.runtime import SILVER_TABLE

# COMMAND ----------

LATEST_EXPERIMENT_ACTIVITY_SOURCE = f"{LATEST_EXPERIMENT_ACTIVITY_TABLE}_source"

dlt.create_streaming_table(
    name=LATEST_EXPERIMENT_ACTIVITY_TABLE,
    comment="Gold layer: the latest processed_timestamp per experiment_id.",
    # A merge costs seconds of fixed work however few rows it carries, and every
    # reader of this table judges freshness in minutes or hours.
    spark_conf={"pipelines.trigger.interval": "2 minutes"},
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        # Each merge rewrites this small table's one file anyway; predictive
        # optimization compacts it asynchronously instead.
        "delta.autoOptimize.autoCompact": "false",
    },
)


@dlt.view(name=LATEST_EXPERIMENT_ACTIVITY_SOURCE)
def latest_experiment_activity_source():
    """The rows a trigger brought in, nothing above the projection."""
    return (
        dlt.read_stream(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .select("experiment_id", F.col("processed_timestamp").alias("latest_processed_timestamp"))
    )


# SCD type 1 keeps one row per key and only replaces it with a row of a later
# sequence, so the stored value is the maximum whatever order rows arrive in.
dlt.create_auto_cdc_flow(
    target=LATEST_EXPERIMENT_ACTIVITY_TABLE,
    source=LATEST_EXPERIMENT_ACTIVITY_SOURCE,
    keys=["experiment_id"],
    sequence_by=F.col("latest_processed_timestamp"),
    stored_as_scd_type=1,
)
