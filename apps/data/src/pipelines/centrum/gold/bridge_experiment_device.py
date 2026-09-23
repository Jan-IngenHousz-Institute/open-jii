# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Device Bridge
# Gold: the experiment-to-client_id pairs that have published data. Many-to-many,
# so a bridge rather than a dimension.
#
# A streaming table rather than a materialized view. This pipeline is not
# serverless, and a materialized view outside a serverless pipeline is always
# fully recomputed, so the distinct over silver ran end to end on every trigger.
# AUTO CDC keyed on the pair keeps the same set by merging only the rows a
# trigger brought in. The registry lookup that used to sit above the distinct is
# downstream, in experiment_devices.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import BRIDGE_EXPERIMENT_DEVICE_TABLE
from openjii.centrum.runtime import SILVER_TABLE

# COMMAND ----------

BRIDGE_EXPERIMENT_DEVICE_SOURCE = f"{BRIDGE_EXPERIMENT_DEVICE_TABLE}_source"

dlt.create_streaming_table(
    name=BRIDGE_EXPERIMENT_DEVICE_TABLE,
    comment="Gold layer: one row per (experiment_id, client_id) that has published data.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    },
)


@dlt.view(name=BRIDGE_EXPERIMENT_DEVICE_SOURCE)
def bridge_experiment_device_source():
    """The pairs a trigger brought in, nothing above the projection."""
    return (
        dlt.read_stream(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .filter("client_id IS NOT NULL")
        .select("experiment_id", "client_id", "processed_timestamp")
    )


# SCD type 1 on the pair is a deduplicating upsert: a pair seen again overwrites
# itself. sequence_by only breaks ties between identical rows, so which one wins
# carries no meaning here. The sequence column is dropped so the table keeps the
# two-column shape its consumers already read.
dlt.create_auto_cdc_flow(
    target=BRIDGE_EXPERIMENT_DEVICE_TABLE,
    source=BRIDGE_EXPERIMENT_DEVICE_SOURCE,
    keys=["experiment_id", "client_id"],
    sequence_by=F.col("processed_timestamp"),
    stored_as_scd_type=1,
    except_column_list=["processed_timestamp"],
)
