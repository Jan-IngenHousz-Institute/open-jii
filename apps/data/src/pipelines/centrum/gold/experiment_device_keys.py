# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Device Keys
# Gold: the (experiment_id, device_id, device_firmware) keys that have data, one
# row each, which is the device table's row set. The table listing counts these
# instead of scanning silver, which is not clustered by experiment. The device
# rows themselves are built when someone reads, by the experiment_device_data view.
#
# Appended through a streaming dropDuplicates, which holds only the keys in its
# state and never merges.

# COMMAND ----------
import dlt

from openjii.centrum import EXPERIMENT_DEVICE_KEYS_TABLE
from openjii.centrum.runtime import SILVER_TABLE

# COMMAND ----------


@dlt.table(
    name=EXPERIMENT_DEVICE_KEYS_TABLE,
    comment="Gold layer: one row per (experiment_id, device_id, device_firmware) that has data.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "false",
    },
    spark_conf={"spark.sql.streaming.stateStore.partitions": "2"},
)
def experiment_device_keys():
    return (
        dlt.read_stream(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .select("experiment_id", "device_id", "device_firmware")
        .dropDuplicates(["experiment_id", "device_id", "device_firmware"])
    )
