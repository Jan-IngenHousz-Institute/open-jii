# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Uploaded Data Schemas
# Gold: one sample of the uploaded rows per distinct schema and upload table, so
# experiment_table_metadata infers the schema without reading every row. Kept
# the same way as experiment_raw_data_schemas.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_UPLOADED_DATA_SCHEMAS_TABLE, EXPERIMENT_UPLOADED_DATA_TABLE
from openjii.variant_schema import variant_schema_key

# COMMAND ----------


@dlt.table(
    name=EXPERIMENT_UPLOADED_DATA_SCHEMAS_TABLE,
    comment="Gold layer: one uploaded_data sample per (experiment_id, upload_table_id, normalised schema).",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.feature.variantType-preview": "supported",
    },
)
def experiment_uploaded_data_schemas():
    return (
        dlt.read_stream(EXPERIMENT_UPLOADED_DATA_TABLE)
        .select(
            "experiment_id",
            "upload_table_id",
            variant_schema_key("uploaded_data").alias("schema_key"),
            F.col("uploaded_data").alias("sample"),
        )
        .dropDuplicates(["experiment_id", "upload_table_id", "schema_key"])
    )
