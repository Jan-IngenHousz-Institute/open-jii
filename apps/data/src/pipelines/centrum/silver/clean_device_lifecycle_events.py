# Databricks notebook source
# DBTITLE 1,Clean Connectivity Events - Streaming Table
# Silver: normalized device connect/disconnect events. Presence events can
# arrive out of order and redelivered, so rows are deduplicated on
# (client_id, event_timestamp, event_type) within a watermark window. The
# watermark is wide because rows older than it are DROPPED, not just deduped:
# the first Auto Loader backlog (archive accrues before the pipeline deploys)
# and any pipeline downtime must not lose history. Presence volume is tiny,
# so the extra dedup state is negligible.

# COMMAND ----------
import dlt
from openjii.centrum import CLEAN_DEVICE_LIFECYCLE_EVENTS_TABLE, RAW_DEVICE_LIFECYCLE_EVENTS_TABLE
from pyspark.sql import functions as F

# COMMAND ----------


@dlt.table(
    name=CLEAN_DEVICE_LIFECYCLE_EVENTS_TABLE,
    comment="Silver layer: deduplicated device connectivity events (client_id, event type, event time)",
    table_properties={
        "quality": "silver",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
@dlt.expect_all_or_drop(
    {
        "valid_client_id": "client_id IS NOT NULL",
        "valid_event_timestamp": "event_timestamp IS NOT NULL",
        "valid_event_type": "event_type IN ('connected', 'disconnected')",
    }
)
def clean_device_lifecycle_events():
    """Normalize the raw lifecycle events into snake_case columns and drop
    duplicate deliveries of the same event."""
    return (
        dlt.read_stream(RAW_DEVICE_LIFECYCLE_EVENTS_TABLE)
        .select(
            F.col("clientId").alias("client_id"),
            F.col("eventType").alias("event_type"),
            (F.col("timestamp") / 1000).cast("timestamp").alias("event_timestamp"),
            F.col("sessionIdentifier").alias("session_identifier"),
            F.col("disconnectReason").alias("disconnect_reason"),
            F.col("ingestion_timestamp"),
        )
        .withWatermark("event_timestamp", "7 days")
        .dropDuplicates(["client_id", "event_timestamp", "event_type"])
    )
