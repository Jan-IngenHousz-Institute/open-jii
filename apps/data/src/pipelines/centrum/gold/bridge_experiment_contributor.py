# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Contributor Bridge
# Gold: the experiment-to-user pairs that have contributed data. Many-to-many,
# so a bridge rather than a dimension.
#
# A streaming table rather than a materialized view, for the same reason as the
# device bridge: a materialized view in a non-serverless pipeline is always
# fully recomputed, so the distinct over silver ran end to end on every
# trigger. The profile lookup that used to sit above the distinct is downstream,
# in experiment_contributors.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import BRIDGE_EXPERIMENT_CONTRIBUTOR_TABLE, EXPERIMENT_UPLOADED_DATA_TABLE
from openjii.centrum.runtime import SILVER_TABLE

# COMMAND ----------

BRIDGE_EXPERIMENT_CONTRIBUTOR_SOURCE = f"{BRIDGE_EXPERIMENT_CONTRIBUTOR_TABLE}_source"

dlt.create_streaming_table(
    name=BRIDGE_EXPERIMENT_CONTRIBUTOR_TABLE,
    comment="Gold layer: one row per (experiment_id, user_id) that has contributed data.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    },
)


@dlt.view(name=BRIDGE_EXPERIMENT_CONTRIBUTOR_SOURCE)
def bridge_experiment_contributor_source():
    """The pairs a trigger brought in, nothing above the projection.

    Sourced from sensor measurements plus data uploaders: an uploader may never
    have submitted a measurement, so include their created_by here too, otherwise
    the enriched uploaded data view's contributor join can't resolve them.
    """
    sensor_users = (
        dlt.read_stream(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .filter("user_id IS NOT NULL")
        .select("experiment_id", "user_id", "processed_timestamp")
    )

    # uploaded_at is nullable upstream and AUTO CDC does not support a null
    # sequencing value, so the fallback keeps the flow from meeting one.
    upload_users = (
        dlt.read_stream(EXPERIMENT_UPLOADED_DATA_TABLE)
        .filter("experiment_id IS NOT NULL")
        .filter("created_by IS NOT NULL")
        .select(
            F.col("experiment_id"),
            F.col("created_by").alias("user_id"),
            F.coalesce(F.col("uploaded_at"), F.current_timestamp()).alias("processed_timestamp"),
        )
    )

    return sensor_users.unionByName(upload_users)


# SCD type 1 on the pair is a deduplicating upsert, which is what replaces the
# distinct. The sequence column is dropped so the table keeps the two-column
# shape its consumers already read.
dlt.create_auto_cdc_flow(
    target=BRIDGE_EXPERIMENT_CONTRIBUTOR_TABLE,
    source=BRIDGE_EXPERIMENT_CONTRIBUTOR_SOURCE,
    keys=["experiment_id", "user_id"],
    sequence_by=F.col("processed_timestamp"),
    stored_as_scd_type=1,
    except_column_list=["processed_timestamp"],
)
