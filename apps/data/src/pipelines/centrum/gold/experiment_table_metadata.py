# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Table Metadata
# Gold: one row per experiment table with the VARIANT schemas the backend builds
# its queries from. Schemas merge the samples in the *_schemas tables, so a
# refresh never reads the measurements; decimals are reported as DOUBLE. Row
# counts and upload names are added when someone reads, by the
# experiment_table_metadata view.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import (
    EXPERIMENT_DEVICE_DATA_TABLE,
    EXPERIMENT_MACRO_DATA_SCHEMAS_TABLE,
    EXPERIMENT_RAW_DATA_SCHEMAS_TABLE,
    EXPERIMENT_TABLE_METADATA,
    EXPERIMENT_UPLOADED_DATA_SCHEMAS_TABLE,
    METADATA_SOURCE_TABLE,
)
from openjii.centrum.runtime import CATALOG_NAME
from openjii.variant_schema import merged_variant_schema

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_TABLE_METADATA,
    comment="Gold layer: VARIANT schemas per experiment table, merged from one sample per distinct schema.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.feature.variantType-preview": "supported",
    }
)
def experiment_table_metadata():
    """Schemas for all experiment tables."""

    # Pre-compute custom_metadata_schema per experiment from the metadata source.
    # Each experiment's metadata blob has $.rows, an array of VARIANT objects
    # whose keys are already human-readable (remapped at upload time).
    # We drop internal keys (_id, identifier column) from each row before schema
    # inference so the backend doesn't expand them into duplicate query columns.
    metadata_source = dlt.read(METADATA_SOURCE_TABLE)
    custom_metadata_schemas = (
        metadata_source
        .select(
            F.col("experiment_id"),
            F.expr("variant_get(metadata, '$.identifierColumnId', 'STRING')").alias("_id_col"),
            F.expr("explode(variant_get(metadata, '$.rows', 'ARRAY<VARIANT>'))").alias("_row"),
        )
        .withColumn("_row", F.expr("""
            parse_json(to_json(map_filter(
                cast(_row AS MAP<STRING, VARIANT>),
                (k, v) -> k != '_id' AND k != _id_col
            )))
        """))
        .groupBy("experiment_id")
        .agg(
            F.expr("nullif(schema_of_variant_agg(_row), 'VOID')").alias("custom_metadata_schema")
        )
    )

    raw_data_metadata = (
        dlt.read(EXPERIMENT_RAW_DATA_SCHEMAS_TABLE)
        .groupBy("experiment_id")
        .agg(merged_variant_schema("sample").alias("questions_schema"))
        .join(custom_metadata_schemas, "experiment_id", "left")
        .select(
            F.col("experiment_id"),
            F.lit("raw_data").alias("identifier"),
            F.lit("static").alias("table_type"),
            F.lit(None).cast("string").alias("macro_schema"),
            F.col("questions_schema"),
            F.col("custom_metadata_schema"),
            F.lit(None).cast("string").alias("upload_schema"),
        )
    )

    device_metadata = (
        dlt.read(EXPERIMENT_DEVICE_DATA_TABLE)
        .select("experiment_id")
        .distinct()
        .select(
            F.col("experiment_id"),
            F.lit("device").alias("identifier"),
            F.lit("static").alias("table_type"),
            F.lit(None).cast("string").alias("macro_schema"),
            F.lit(None).cast("string").alias("questions_schema"),
            F.lit(None).cast("string").alias("custom_metadata_schema"),
            F.lit(None).cast("string").alias("upload_schema"),
        )
    )

    upload_metadata = (
        dlt.read(EXPERIMENT_UPLOADED_DATA_SCHEMAS_TABLE)
        .groupBy("experiment_id", "upload_table_id")
        .agg(merged_variant_schema("sample").alias("upload_schema"))
        .select(
            F.col("experiment_id"),
            F.col("upload_table_id").alias("identifier"),
            F.lit("upload").alias("table_type"),
            F.lit(None).cast("string").alias("macro_schema"),
            F.lit(None).cast("string").alias("questions_schema"),
            F.lit(None).cast("string").alias("custom_metadata_schema"),
            F.col("upload_schema"),
        )
    )

    metadata = raw_data_metadata.unionByName(device_metadata).unionByName(upload_metadata)

    macro_metadata = (
        # Published by the macro pipeline, so read by qualified name.
        spark.read.table(f"{CATALOG_NAME}.centrum.{EXPERIMENT_MACRO_DATA_SCHEMAS_TABLE}")
        .groupBy("experiment_id", "macro_id")
        .agg(
            merged_variant_schema("CASE WHEN column_name = 'macro_output' THEN sample END").alias("macro_schema"),
            merged_variant_schema("CASE WHEN column_name = 'questions_data' THEN sample END").alias("questions_schema"),
        )
        .join(custom_metadata_schemas, "experiment_id", "left")
        .select(
            F.col("experiment_id"),
            F.col("macro_id").alias("identifier"),
            F.lit("macro").alias("table_type"),
            F.col("macro_schema"),
            F.col("questions_schema"),
            F.col("custom_metadata_schema"),
            F.lit(None).cast("string").alias("upload_schema"),
        )
    )

    return macro_metadata.unionByName(metadata)
