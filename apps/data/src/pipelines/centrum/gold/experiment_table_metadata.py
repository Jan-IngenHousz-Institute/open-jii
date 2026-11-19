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
    EXPERIMENT_DEVICE_KEYS_TABLE,
    EXPERIMENT_MACRO_DATA_SCHEMAS_TABLE,
    EXPERIMENT_RAW_DATA_SCHEMAS_TABLE,
    EXPERIMENT_TABLE_METADATA,
    EXPERIMENT_UPLOADED_DATA_SCHEMAS_TABLE,
    METADATA_SOURCE_TABLE,
)
from openjii.centrum.runtime import CATALOG_NAME
from openjii.variant_schema import custom_metadata_schemas, merged_variant_schema

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_TABLE_METADATA,
    comment="Gold layer: VARIANT schemas per experiment table, merged from one sample per distinct schema.",
    table_properties={
        "quality": "gold",
        "delta.autoOptimize.autoCompact": "false",
        "pipelines.autoOptimize.managed": "true",
        "delta.feature.variantType-preview": "supported",
    },
    spark_conf={"pipelines.trigger.interval": "1 minute"},
)
def experiment_table_metadata():
    """Schemas for all experiment tables."""

    # Each experiment's metadata sheets type its custom metadata. The serving store's feed types
    # each sheet with the same function, and the backend merges them into this.
    experiment_metadata_schemas = custom_metadata_schemas(dlt.read(METADATA_SOURCE_TABLE), "experiment_id")

    raw_data_metadata = (
        dlt.read(EXPERIMENT_RAW_DATA_SCHEMAS_TABLE)
        .groupBy("experiment_id")
        .agg(merged_variant_schema("sample").alias("questions_schema"))
        .join(experiment_metadata_schemas, "experiment_id", "left")
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
        dlt.read(EXPERIMENT_DEVICE_KEYS_TABLE)
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
        .join(experiment_metadata_schemas, "experiment_id", "left")
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
