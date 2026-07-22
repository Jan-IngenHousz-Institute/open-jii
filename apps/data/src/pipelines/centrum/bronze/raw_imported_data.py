# Databricks notebook source
# DBTITLE 1,Raw Imported Data - Streaming Table
# Bronze: imported measurement data from external platforms (PhotosynQ transfers).

# COMMAND ----------
import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import (
    DoubleType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)

from openjii.centrum import RAW_IMPORTED_DATA_TABLE
from openjii.centrum.runtime import CATALOG_NAME

# COMMAND ----------

@dlt.table(
    name=RAW_IMPORTED_DATA_TABLE,
    comment="Streaming table: Imported measurement data from external platforms (e.g., PhotosynQ transfers), partitioned by experiment_id",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true"
    },
    partition_cols=["experiment_id"]
)
def raw_imported_data():
    """Streaming ingestion of imported measurement data from parquet files in data-imports volume."""
    imported_path = f"/Volumes/{CATALOG_NAME}/centrum/data-imports/*/photosynq_transfer"

    imported_data_schema = StructType([
        StructField("id", StringType(), True),
        StructField("device_id", StringType(), True),
        StructField("device_name", StringType(), True),
        StructField("device_version", StringType(), True),
        StructField("device_battery", DoubleType(), True),
        StructField("device_firmware", StringType(), True),
        StructField("sample", StringType(), True),
        StructField("output", StringType(), True),
        StructField("user_id", StringType(), True),
        StructField("experiment_id", StringType(), True),
        StructField("timestamp", TimestampType(), True),
        StructField("macro_id", StringType(), True),
        StructField("macro_filename", StringType(), True),
        StructField("macro_name", StringType(), True),
        StructField("questions", StringType(), True),
        # Null for parquet written before per-measurement location transfer.
        StructField("latitude", DoubleType(), True),
        StructField("longitude", DoubleType(), True),
    ])

    df = (
        spark.readStream
        .format("cloudFiles")
        .option("cloudFiles.format", "parquet")
        .option("recursiveFileLookup", "true")
        .option("ignoreMissingFiles", "true")
        .schema(imported_data_schema)
        .load(imported_path)
    )

    return (
        df
        .withColumn(
            "id",
            F.coalesce(
                F.col("id"),
                F.abs(F.hash(*[F.col(c) for c in df.columns])).cast("string")
            )
        )
        .withColumn("ingestion_timestamp", F.current_timestamp())
    )
