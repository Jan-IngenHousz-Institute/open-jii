# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Contributors
# Gold: contributor pairs joined to the profiles the backend copies to the lakehouse.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import BRIDGE_EXPERIMENT_CONTRIBUTOR_TABLE, EXPERIMENT_CONTRIBUTORS_TABLE
from openjii.centrum.runtime import CATALOG_NAME

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_CONTRIBUTORS_TABLE,
    comment="Gold layer: User profiles for enrichment, keyed by (experiment_id, user_id)",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "false",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    }
)
def experiment_contributors():
    """Profiles for the contributor pairs, from the copy the backend keeps of them.

    Reads the bridge rather than silver, so a refresh recomputes the few hundred
    distinct pairs instead of every measurement. A user the copy lacks, such as
    one without a profile, gets an empty name.
    """
    profiles = spark.read.table(f"{CATALOG_NAME}.centrum.contributor_profiles")

    return (
        dlt.read(BRIDGE_EXPERIMENT_CONTRIBUTOR_TABLE)
        .join(profiles, "user_id", "left")
        .select(
            "experiment_id",
            "user_id",
            F.struct(
                F.col("user_id").alias("id"),
                F.concat_ws(" ", "first_name", "last_name").alias("name"),
                F.col("avatar_url").alias("avatar"),
            ).alias("user"),
        )
    )
