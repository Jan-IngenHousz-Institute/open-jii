# Databricks notebook source
# DBTITLE 1,Gold Layer - Latest Experiment Device
# Gold: what each device last reported about itself, per experiment and firmware.
# One row per (experiment, device, firmware); the grain moves when a device is
# reflashed.
#
# A streaming table rather than a materialized view, which outside a serverless
# pipeline would aggregate all of silver on every trigger. AUTO CDC keeps the
# newest row per key from the rows a trigger brought in, so the attributes are the
# latest reported. It cannot sum, so the measurement count comes from the metrics
# pipeline's experiment_device_counts instead.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import LATEST_EXPERIMENT_DEVICE_TABLE
from openjii.centrum.runtime import SILVER_TABLE

# COMMAND ----------

LATEST_EXPERIMENT_DEVICE_SOURCE = f"{LATEST_EXPERIMENT_DEVICE_TABLE}_source"

dlt.create_streaming_table(
    name=LATEST_EXPERIMENT_DEVICE_TABLE,
    comment="Gold layer: latest reported attributes per (experiment_id, device_id, device_firmware).",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)


@dlt.view(name=LATEST_EXPERIMENT_DEVICE_SOURCE)
def latest_experiment_device_source():
    """The rows a trigger brought in.

    device_id and device_firmware can be null, and the docs do not say how AUTO
    CDC treats a null key, so the key is a JSON rendering of the pair: to_json
    omits a null field, which keeps a null apart from an empty string.
    """
    return (
        dlt.read_stream(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .select(
            "experiment_id",
            F.to_json(F.struct("device_id", "device_firmware")).alias("device_key"),
            "device_id",
            "device_firmware",
            "device_name",
            "device_version",
            "device_battery",
            "client_id",
            "processed_timestamp",
            "timestamp",
            "id",
        )
    )


# Rows from one batch share processed_timestamp, so the measurement's own time and
# then its id break the tie: the newest measurement's attributes win.
dlt.create_auto_cdc_flow(
    target=LATEST_EXPERIMENT_DEVICE_TABLE,
    source=LATEST_EXPERIMENT_DEVICE_SOURCE,
    keys=["experiment_id", "device_key"],
    sequence_by=F.struct("processed_timestamp", "timestamp", "id"),
    stored_as_scd_type=1,
    except_column_list=["timestamp", "id"],
)
