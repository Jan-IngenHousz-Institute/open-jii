# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Contributors
# Gold: cached user profiles per experiment (full refresh on each pipeline run).

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from enrich.user_metadata import add_user_column
from openjii.centrum import EXPERIMENT_CONTRIBUTORS_TABLE, EXPERIMENT_UPLOADED_DATA_TABLE
from openjii.centrum.runtime import ENVIRONMENT, SILVER_TABLE

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_CONTRIBUTORS_TABLE,
    comment="Gold layer: Cached user profiles for enrichment (full refresh on each pipeline run)",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    }
)
def experiment_contributors():
    """Cached user profiles per experiment, keyed by (experiment_id, user_id).

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

    unique_users = sensor_users.unionByName(upload_users).distinct()

    return add_user_column(unique_users, ENVIRONMENT, dbutils)
