# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Device Data
# Gold: device metadata aggregated per experiment.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_DEVICE_DATA_TABLE, EXPERIMENT_DEVICES_TABLE
from openjii.centrum.runtime import SILVER_TABLE

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_DEVICE_DATA_TABLE,
    comment="Gold layer: Device metadata aggregated per experiment",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    }
)
def experiment_device_data():
    """
    Aggregate device stats per experiment from clean_data.
    """
    silver_df = dlt.read(SILVER_TABLE)
    devices = dlt.read(EXPERIMENT_DEVICES_TABLE)

    aggregated = (
        silver_df
        .filter("experiment_id IS NOT NULL")
        .groupBy("experiment_id", "device_id", "device_firmware")
        .agg(
            F.max("device_name").alias("device_name"),
            F.max("device_version").alias("device_version"),
            F.max("device_battery").alias("device_battery"),
            F.max("client_id").alias("client_id"),
            F.count("*").alias("total_measurements"),
            F.max("processed_timestamp").alias("processed_timestamp")
        )
        .withColumn(
            "id",
            F.abs(
                F.hash(
                    F.col("experiment_id"),
                    F.col("device_id"),
                    F.col("device_firmware")
                )
            )
        )
    )

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
