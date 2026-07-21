# Databricks notebook source
# DBTITLE 1,Experiment Uploaded Data - Gold
# Gold: rows from raw_uploaded_data with a per-row id. Peer of experiment_macro_data.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_UPLOADED_DATA_TABLE, RAW_UPLOADED_DATA_TABLE

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_UPLOADED_DATA_TABLE,
    comment="Gold layer: User-uploaded tabular data with VARIANT row payloads. Peer of experiment_macro_data; anchored by stable upload_table_id.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
        "delta.feature.variantType-preview": "supported",
    },
)
def experiment_uploaded_data():
    """Gold: rows from raw_uploaded_data with a per-row id, ready for the enriched view.

    id is an opaque hash of (upload_id, row_index), mirroring experiment_macro_data's
    derived id; annotations join on it. xxhash64 rather than 32-bit hash() because a
    single upload can exceed the ~77k rows where 32-bit collisions become likely.
    """
    return (
        dlt.read_stream(RAW_UPLOADED_DATA_TABLE)
        .withColumn(
            "id",
            F.abs(F.xxhash64(F.col("upload_id"), F.col("row_index"))),
        )
        .select(
            F.col("id"),
            F.col("experiment_id"),
            F.col("upload_table_id"),
            F.col("upload_table_name"),
            F.col("upload_id"),
            F.col("created_by"),
            F.col("uploaded_at"),
            F.col("uploaded_data"),
        )
    )
