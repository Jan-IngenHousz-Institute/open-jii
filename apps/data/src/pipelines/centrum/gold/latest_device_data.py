# Databricks notebook source
# DBTITLE 1,Gold Layer - Latest Device Data
# Gold: the newest measurement time per client_id, the data half of
# device_last_activity. AUTO CDC keyed on client_id merges only the rows a
# trigger brought in, where device_last_activity used to aggregate all of silver.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import LATEST_DEVICE_DATA_TABLE
from openjii.centrum.runtime import SILVER_TABLE

# COMMAND ----------

LATEST_DEVICE_DATA_SOURCE = f"{LATEST_DEVICE_DATA_TABLE}_source"

dlt.create_streaming_table(
    name=LATEST_DEVICE_DATA_TABLE,
    comment="Gold layer: the latest measurement timestamp per client_id.",
    # A merge costs seconds of fixed work however few rows it carries, and every
    # reader of this table judges freshness in minutes or hours.
    spark_conf={"pipelines.trigger.interval": "2 minutes"},
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        # Each merge rewrites this small table's one file anyway; predictive
        # optimization compacts it asynchronously instead.
        "delta.autoOptimize.autoCompact": "false",
    },
)


@dlt.view(name=LATEST_DEVICE_DATA_SOURCE)
def latest_device_data_source():
    """The rows a trigger brought in. Silver drops rows without a timestamp, which
    AUTO CDC needs as its sequence."""
    return (
        dlt.read_stream(SILVER_TABLE)
        .filter("client_id IS NOT NULL")
        .select("client_id", F.col("timestamp").alias("last_data_at"))
    )


# SCD type 1 keeps one row per key and only replaces it with a row of a later
# sequence, so the stored value is the maximum whatever order rows arrive in.
dlt.create_auto_cdc_flow(
    target=LATEST_DEVICE_DATA_TABLE,
    source=LATEST_DEVICE_DATA_SOURCE,
    keys=["client_id"],
    sequence_by=F.col("last_data_at"),
    stored_as_scd_type=1,
)
