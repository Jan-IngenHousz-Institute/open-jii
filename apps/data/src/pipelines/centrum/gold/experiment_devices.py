# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Devices
# Gold: registry-resolved devices per experiment (full refresh on each pipeline run).

# COMMAND ----------
import dlt

from enrich.device_metadata import add_device_registry
from openjii.centrum import EXPERIMENT_DEVICES_TABLE
from openjii.centrum.runtime import ENVIRONMENT, SILVER_TABLE

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_DEVICES_TABLE,
    comment="Gold layer: Registry-resolved devices per experiment (client_id -> device), full refresh each run.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    }
)
def experiment_devices():
    """Devices observed per experiment, resolved against the registry via the
    broker-authenticated client_id (== Thing name for X.509 devices). Cognito
    rows have a non-Thing client_id and resolve to a NULL device struct.

    Mirrors experiment_contributors: distinct keys from the data, enriched once
    per run from the backend, then joined by the gold device dimension.
    """
    unique_devices = (
        dlt.read(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .filter("client_id IS NOT NULL")
        .select("experiment_id", "client_id")
        .distinct()
    )

    return add_device_registry(unique_devices, ENVIRONMENT, dbutils)
