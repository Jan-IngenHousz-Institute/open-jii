# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Device Bridge
# Gold: the experiment-to-client_id pairs that have published data. Many-to-many,
# so a bridge rather than a dimension.
#
# A streaming dropDuplicates keeps the first row it sees for each pair and holds
# only the pairs in its state. It appends and never merges: every MERGE is
# followed by an auto compaction on the pipeline's driver that cannot be turned
# off. The registry lookup is downstream, in experiment_devices.

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
        "delta.autoOptimize.autoCompact": "false",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    },
    spark_conf={"spark.sql.streaming.stateStore.partitions": "2"},
)
def bridge_experiment_device():
    return (
        dlt.read_stream(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .filter("client_id IS NOT NULL")
        .select("experiment_id", "client_id")
        .dropDuplicates(["experiment_id", "client_id"])
    )
