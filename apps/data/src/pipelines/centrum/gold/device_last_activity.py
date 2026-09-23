# Databricks notebook source
# DBTITLE 1,Gold Layer - Device Last Activity
# Gold: per-device last measurement and last connectivity event. Keyed on
# client_id, which equals the Thing name for X.509 registry devices; Cognito
# publishers carry a non-Thing client_id and are simply absent from the registry
# join downstream. Both halves are kept incrementally in latest_device_data and
# latest_device_event; this view only joins one row per device from each.

# COMMAND ----------
import dlt
from openjii.centrum import DEVICE_LAST_ACTIVITY_TABLE, LATEST_DEVICE_DATA_TABLE, LATEST_DEVICE_EVENT_TABLE

# COMMAND ----------


@dlt.table(
    name=DEVICE_LAST_ACTIVITY_TABLE,
    comment="Gold layer: last measurement and last connectivity event per client_id.",
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
    last_data = dlt.read(LATEST_DEVICE_DATA_TABLE)
    last_event = dlt.read(LATEST_DEVICE_EVENT_TABLE)

    return last_data.join(last_event, on="client_id", how="full_outer")
