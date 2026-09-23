# Databricks notebook source
# DBTITLE 1,Gold Layer - Latest Device Event
# Gold: the newest connectivity event per client_id, the event half of
# device_last_activity. AUTO CDC keyed on client_id merges only the events a
# trigger brought in, where device_last_activity used to aggregate them all.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import CLEAN_DEVICE_LIFECYCLE_EVENTS_TABLE, LATEST_DEVICE_EVENT_TABLE

# COMMAND ----------

LATEST_DEVICE_EVENT_SOURCE = f"{LATEST_DEVICE_EVENT_TABLE}_source"

dlt.create_streaming_table(
    name=LATEST_DEVICE_EVENT_TABLE,
    comment="Gold layer: the latest connectivity event per client_id.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)


@dlt.view(name=LATEST_DEVICE_EVENT_SOURCE)
def latest_device_event_source():
    """The events a trigger brought in. AUTO CDC rejects a null sequence."""
    return (
        dlt.read_stream(CLEAN_DEVICE_LIFECYCLE_EVENTS_TABLE)
        .filter("client_id IS NOT NULL")
        .filter("event_timestamp IS NOT NULL")
        .select(
            "client_id",
            F.col("event_type").alias("last_event_type"),
            F.col("event_timestamp").alias("last_event_at"),
        )
    )


# SCD type 1 keeps one row per key and only replaces it with a row of a later
# sequence, so the stored event is the latest whatever order events arrive in.
dlt.create_auto_cdc_flow(
    target=LATEST_DEVICE_EVENT_TABLE,
    source=LATEST_DEVICE_EVENT_SOURCE,
    keys=["client_id"],
    sequence_by=F.col("last_event_at"),
    stored_as_scd_type=1,
)
