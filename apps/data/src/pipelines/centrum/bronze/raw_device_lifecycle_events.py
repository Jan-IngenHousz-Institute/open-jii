# Databricks notebook source
# DBTITLE 1,Raw Lifecycle Events - Streaming Table
# Bronze: AWS IoT presence lifecycle events (connect/disconnect) archived to S3
# by the lifecycle topic rule, ingested with Auto Loader directory listing.
# Peer of raw_large_data; deliberately outside the Kinesis measurement stream.

# COMMAND ----------
import dlt
from openjii.centrum import RAW_DEVICE_LIFECYCLE_EVENTS_TABLE, device_lifecycle_event_schema
from openjii.centrum.runtime import DEVICE_LIFECYCLE_EVENTS_S3_PATH
from pyspark.sql import functions as F

# COMMAND ----------


@dlt.table(
    name=RAW_DEVICE_LIFECYCLE_EVENTS_TABLE,
    comment="Streaming table: AWS IoT presence lifecycle events (connect/disconnect) archived by the lifecycle topic rule",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def raw_device_lifecycle_events():
    """Streaming ingestion of presence lifecycle events from S3 via Auto Loader."""
    return (
        spark.readStream.format("cloudFiles")
        .option("cloudFiles.format", "json")
        .option("recursiveFileLookup", "true")
        .option("ignoreMissingFiles", "true")
        .schema(device_lifecycle_event_schema)
        .load(DEVICE_LIFECYCLE_EVENTS_S3_PATH)
        .withColumn("ingestion_timestamp", F.current_timestamp())
    )
