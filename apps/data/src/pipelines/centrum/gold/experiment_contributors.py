# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Contributors
# Gold: contributor pairs resolved to user profiles through the backend.

# COMMAND ----------
import dlt

from enrich.user_metadata import add_user_column
from openjii.centrum import BRIDGE_EXPERIMENT_CONTRIBUTOR_TABLE, EXPERIMENT_CONTRIBUTORS_TABLE
from openjii.centrum.runtime import ENVIRONMENT

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_CONTRIBUTORS_TABLE,
    comment="Gold layer: Cached user profiles for enrichment, keyed by (experiment_id, user_id)",
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
    """Profiles for the contributor pairs, one backend call per Arrow batch.

    Reads the bridge rather than silver. The profile lookup is a non-deterministic
    UDF, so this table still recomputes in full, but over the few hundred distinct
    pairs instead of every measurement ever recorded.
    """
    return add_user_column(dlt.read(BRIDGE_EXPERIMENT_CONTRIBUTOR_TABLE), ENVIRONMENT, dbutils)
