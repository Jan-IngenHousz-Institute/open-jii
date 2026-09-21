# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Device Bridge
# Gold: the experiment-to-client_id pairs that have published data. Many-to-many,
# so a bridge rather than a dimension.
#
# Split out of experiment_devices for the same reason as the contributor bridge:
# the registry lookup above the distinct made the aggregate a non-top node, which
# a streaming-table conversion cannot carry.

# COMMAND ----------
import dlt

from openjii.centrum import BRIDGE_EXPERIMENT_DEVICE_TABLE
from openjii.centrum.runtime import SILVER_TABLE

# COMMAND ----------

@dlt.table(
    name=BRIDGE_EXPERIMENT_DEVICE_TABLE,
    comment="Gold layer: one row per (experiment_id, client_id) that has published data.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    }
)
def bridge_experiment_device():
    """Distinct device pairs, nothing above the aggregate."""
    return (
        dlt.read(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .filter("client_id IS NOT NULL")
        .select("experiment_id", "client_id")
        .distinct()
    )
