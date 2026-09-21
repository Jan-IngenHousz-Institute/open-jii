# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Contributor Bridge
# Gold: the experiment-to-user pairs that have contributed data. Many-to-many,
# so a bridge rather than a dimension.
#
# Split out of experiment_contributors so the aggregate is the top node of its
# own table. A materialized view whose aggregate is not the top node cannot
# refresh incrementally, and the profile lookup above the distinct was enough to
# force a full scan of silver on every trigger.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import BRIDGE_EXPERIMENT_CONTRIBUTOR_TABLE, EXPERIMENT_UPLOADED_DATA_TABLE
from openjii.centrum.runtime import SILVER_TABLE

# COMMAND ----------

@dlt.table(
    name=BRIDGE_EXPERIMENT_CONTRIBUTOR_TABLE,
    comment="Gold layer: one row per (experiment_id, user_id) that has contributed data.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    }
)
def bridge_experiment_contributor():
    """Distinct contributor pairs, nothing above the aggregate.

    Sourced from sensor measurements plus data uploaders: an uploader may never
    have submitted a measurement, so include their created_by here too, otherwise
    the enriched_experiment_uploaded_data contributor join can't resolve them.
    """
    sensor_users = (
        dlt.read(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .filter("user_id IS NOT NULL")
        .select("experiment_id", "user_id")
    )

    upload_users = (
        dlt.read(EXPERIMENT_UPLOADED_DATA_TABLE)
        .filter("experiment_id IS NOT NULL")
        .filter("created_by IS NOT NULL")
        .select("experiment_id", F.col("created_by").alias("user_id"))
    )

    return sensor_users.unionByName(upload_users).distinct()
