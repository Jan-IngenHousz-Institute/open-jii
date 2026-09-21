# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Device Data
# Gold: the device aggregate joined to its registry-resolved device struct.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import (
    AGG_EXPERIMENT_DEVICE_TABLE,
    EXPERIMENT_DEVICE_DATA_TABLE,
    EXPERIMENT_DEVICES_TABLE,
)

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_DEVICE_DATA_TABLE,
    comment="Gold layer: Device metadata aggregated per experiment",
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
    """Join only, so it refreshes row by row once its sources carry row tracking.

    The aggregate it used to perform now lives in agg_experiment_device, which is
    what lets that side refresh incrementally instead of rescanning silver.
    """
    aggregated = dlt.read(AGG_EXPERIMENT_DEVICE_TABLE).withColumn(
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
        .select(
            aggregated.id,
            aggregated.experiment_id,
            aggregated.device_id,
            aggregated.client_id,
            aggregated.device_firmware,
            aggregated.device_name,
            aggregated.device_version,
            aggregated.device_battery,
            aggregated.total_measurements,
            aggregated.processed_timestamp,
            devices.device,
        )
    )
