# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Contributor Bridge
# Gold: the experiment-to-user pairs that have contributed data. Many-to-many,
# so a bridge rather than a dimension.
#
# Appended through a streaming dropDuplicates, like the device bridge, so it
# never merges. The profile lookup is downstream, in experiment_contributors.

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
        "delta.autoOptimize.autoCompact": "false",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    },
    spark_conf={"spark.sql.streaming.stateStore.partitions": "2"},
)
def bridge_experiment_contributor():
    """Sensor measurements plus data uploaders: an uploader may never have
    submitted a measurement, so their created_by counts too, otherwise the
    enriched uploaded data view's contributor join can't resolve them.
    """
    sensor_users = (
        dlt.read_stream(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .filter("user_id IS NOT NULL")
        .select("experiment_id", "user_id")
    )
    upload_users = (
        dlt.read_stream(EXPERIMENT_UPLOADED_DATA_TABLE)
        .filter("experiment_id IS NOT NULL")
        .filter("created_by IS NOT NULL")
        .select("experiment_id", F.col("created_by").alias("user_id"))
    )

    return sensor_users.unionByName(upload_users).dropDuplicates(["experiment_id", "user_id"])
