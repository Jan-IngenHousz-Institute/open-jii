# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Devices
# Gold: registry-resolved devices per experiment (full refresh on each pipeline run).

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import BRIDGE_EXPERIMENT_DEVICE_TABLE, EXPERIMENT_DEVICES_TABLE
from openjii.centrum.runtime import CATALOG_NAME

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_DEVICES_TABLE,
    comment="Gold layer: Registry-resolved devices per experiment (client_id -> device).",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "false",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    }
)
@dlt.expect(
    "registered_ambyte_metadata",
    "client_id IS NULL OR NOT startswith(client_id, 'ambyte_') OR device.device_type IS NOT NULL",
)
def experiment_devices():
    """Devices observed per experiment, resolved against the copy of the registry
    the backend keeps, by the broker-authenticated client_id (== Thing name for
    X.509 devices). Cognito rows have a non-Thing client_id and resolve to a
    device struct whose fields are all NULL.

    Mirrors experiment_contributors: distinct keys from the bridge, joined to the
    copy, then joined by the gold device dimension.
    """
    registry = spark.read.table(f"{CATALOG_NAME}.centrum.device_registry")
    bridge = dlt.read(BRIDGE_EXPERIMENT_DEVICE_TABLE)

    return bridge.join(registry, bridge.client_id == registry.thing_name, "left").select(
        bridge.experiment_id,
        bridge.client_id,
        F.struct(
            registry.id,
            registry.serial_number,
            registry.created_by.alias("owner"),
            registry.status,
            registry.device_type,
        ).alias("device"),
    )
