# Databricks notebook source
# DBTITLE 1,Gold Layer - Device Last Activity
# Gold: per-device last measurement and last connectivity event (full refresh
# on each pipeline run). Keyed on client_id, which equals the Thing name for
# X.509 registry devices; Cognito publishers carry a non-Thing client_id and
# are simply absent from the registry join downstream.

# COMMAND ----------
import dlt
from openjii.centrum import CLEAN_DEVICE_LIFECYCLE_EVENTS_TABLE, DEVICE_LAST_ACTIVITY_TABLE
from openjii.centrum.runtime import SILVER_TABLE
from pyspark.sql import functions as F

# COMMAND ----------


@dlt.table(
    name=DEVICE_LAST_ACTIVITY_TABLE,
    comment="Gold layer: last measurement and last connectivity event per client_id, full refresh each run.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def device_last_activity():
    """Latest data arrival per device, joined with its latest connectivity
    event so the table is ready for uptime analytics."""
    last_data = (
        dlt.read(SILVER_TABLE)
        .filter("client_id IS NOT NULL")
        .groupBy("client_id")
        .agg(
            F.max("timestamp").alias("last_data_at"),
            F.count("*").alias("measurement_count"),
        )
    )

    last_event = (
        dlt.read(CLEAN_DEVICE_LIFECYCLE_EVENTS_TABLE)
        .groupBy("client_id")
        .agg(
            F.max_by("event_type", "event_timestamp").alias("last_event_type"),
            F.max("event_timestamp").alias("last_event_at"),
        )
    )

    return last_data.join(last_event, on="client_id", how="full_outer")
