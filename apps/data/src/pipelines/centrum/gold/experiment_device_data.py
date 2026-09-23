# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Device Data
# Gold: each device's latest attributes, joined to its measurement count and its
# registry-resolved device struct.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import (
    EXPERIMENT_DEVICE_DATA_TABLE,
    EXPERIMENT_DEVICES_TABLE,
    LATEST_EXPERIMENT_DEVICE_TABLE,
)
from openjii.centrum.runtime import CATALOG_NAME, METRICS_SCHEMA_NAME
from openjii.metrics import EXPERIMENT_DEVICE_COUNTS_TABLE

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_DEVICE_DATA_TABLE,
    comment="Gold layer: Device metadata aggregated per experiment",
    cluster_by=["experiment_id"],
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    }
)
def experiment_device_data():
    """Joins only, over inputs of one row per device, so a refresh never touches
    the measurements themselves.
    """
    aggregated = dlt.read(LATEST_EXPERIMENT_DEVICE_TABLE).withColumn(
        "id",
        F.abs(
            F.hash(
                F.col("experiment_id"),
                F.col("device_id"),
                F.col("device_firmware")
            )
        )
    )
    devices = dlt.read(EXPERIMENT_DEVICES_TABLE)

    # Published by the metrics pipeline, so read by qualified name.
    counts = spark.read.table(f"{CATALOG_NAME}.{METRICS_SCHEMA_NAME}.{EXPERIMENT_DEVICE_COUNTS_TABLE}")

    # Attach the registry-resolved device struct via the trusted client_id
    # (NULL for Cognito/unregistered rows; left join keeps every device row).
    return (
        aggregated
        .join(
            devices,
            (aggregated.experiment_id == devices.experiment_id)
            & (aggregated.client_id == devices.client_id),
            "left"
        )
        .join(
            counts,
            aggregated.experiment_id.eqNullSafe(counts.experiment_id)
            & aggregated.device_id.eqNullSafe(counts.device_id)
            & aggregated.device_firmware.eqNullSafe(counts.device_firmware),
            "left"
        )
        .select(
            aggregated.id,
            aggregated.experiment_id,
            aggregated.device_id,
            aggregated.client_id,
            aggregated.device_firmware,
            aggregated.device_name,
            aggregated.device_version,
            aggregated.device_battery,
            counts.total_measurements,
            aggregated.processed_timestamp,
            devices.device,
        )
    )
