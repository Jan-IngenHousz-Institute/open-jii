# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Table Metadata
# Gold: consolidated metadata cache for all experiment tables (row counts +
# inferred VARIANT schemas).

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import (
    EXPERIMENT_DEVICE_DATA_TABLE,
    EXPERIMENT_MACRO_DATA_TABLE,
    EXPERIMENT_RAW_DATA_TABLE,
    EXPERIMENT_TABLE_METADATA,
    EXPERIMENT_UPLOADED_DATA_TABLE,
    METADATA_SOURCE_TABLE,
)

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_TABLE_METADATA,
    comment="Gold layer: Consolidated metadata cache for all experiment tables (row counts, schemas). Single query optimization. Replaces EXPERIMENT_MACROS_TABLE and EXPERIMENT_QUESTIONS_TABLE.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.feature.variantType-preview": "supported",
    }
)
def experiment_table_metadata():
    """Metadata for all experiment tables."""

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

    macro_metadata = (
        dlt.read(EXPERIMENT_MACRO_DATA_TABLE)
        .filter("macro_output IS NOT NULL")
        .groupBy("experiment_id", "macro_id")
        .agg(
            F.count("*").alias("row_count"),
            F.expr("nullif(schema_of_variant_agg(macro_output), 'VOID')").alias("macro_schema"),
            F.expr("nullif(schema_of_variant_agg(questions_data), 'VOID')").alias("questions_schema")
        )
        .join(custom_metadata_schemas, "experiment_id", "left")
        .select(
            F.col("experiment_id"),
            F.col("macro_id").alias("identifier"),
            F.lit("macro").alias("table_type"),
            F.lit(None).cast("string").alias("display_name"),
            F.col("row_count"),
            F.col("macro_schema"),
            F.col("questions_schema"),
            F.col("custom_metadata_schema"),
            F.lit(None).cast("string").alias("upload_schema"),
        )
    )

    raw_data_metadata = (
        dlt.read(EXPERIMENT_RAW_DATA_TABLE)
        .groupBy("experiment_id")
        .agg(
            F.count("*").alias("row_count"),
            F.expr("nullif(schema_of_variant_agg(questions_data), 'VOID')").alias("questions_schema")
        )
        .join(custom_metadata_schemas, "experiment_id", "left")
        .select(
            F.col("experiment_id"),
            F.lit("raw_data").alias("identifier"),
            F.lit("static").alias("table_type"),
            F.lit(None).cast("string").alias("display_name"),
            F.col("row_count"),
            F.lit(None).cast("string").alias("macro_schema"),
            F.col("questions_schema"),
            F.col("custom_metadata_schema"),
            F.lit(None).cast("string").alias("upload_schema"),
        )
    )

    device_metadata = (
        dlt.read(EXPERIMENT_DEVICE_DATA_TABLE)
        .groupBy("experiment_id")
        .agg(F.count("*").alias("row_count"))
        .select(
            F.col("experiment_id"),
            F.lit("device").alias("identifier"),
            F.lit("static").alias("table_type"),
            F.lit(None).cast("string").alias("display_name"),
            F.col("row_count"),
            F.lit(None).cast("string").alias("macro_schema"),
            F.lit(None).cast("string").alias("questions_schema"),
            F.lit(None).cast("string").alias("custom_metadata_schema"),
            F.lit(None).cast("string").alias("upload_schema"),
        )
    )

    upload_metadata = (
        dlt.read(EXPERIMENT_UPLOADED_DATA_TABLE)
        .filter("uploaded_data IS NOT NULL")
        .groupBy("experiment_id", "upload_table_id")
        .agg(
            F.count("*").alias("row_count"),
            # Latest user-chosen label for this logical upload table, picked by
            # the most recent uploaded_at so renames take effect deterministically.
            F.max(F.struct(F.col("uploaded_at"), F.col("upload_table_name"))).getField("upload_table_name").alias("display_name"),
            F.expr("nullif(schema_of_variant_agg(uploaded_data), 'VOID')").alias("upload_schema")
        )
        .select(
            F.col("experiment_id"),
            F.col("upload_table_id").alias("identifier"),
            F.lit("upload").alias("table_type"),
            F.col("display_name"),
            F.col("row_count"),
            F.lit(None).cast("string").alias("macro_schema"),
            F.lit(None).cast("string").alias("questions_schema"),
            F.lit(None).cast("string").alias("custom_metadata_schema"),
            F.col("upload_schema"),
        )
    )

    return (
        macro_metadata
        .unionByName(raw_data_metadata)
        .unionByName(device_metadata)
        .unionByName(upload_metadata)
    )
