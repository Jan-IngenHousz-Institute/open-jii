# Databricks notebook source
# DBTITLE 1,Raw Uploaded Data - Streaming Table
# Bronze: user-uploaded tabular data from parquet in the data-imports volume,
# parsed into VARIANT. Peer of raw_imported_data.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import (
    LongType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)

from openjii.centrum import RAW_UPLOADED_DATA_TABLE
from openjii.centrum.runtime import CATALOG_NAME

# COMMAND ----------

@dlt.table(
    name=RAW_UPLOADED_DATA_TABLE,
    comment="Streaming table: User-uploaded data with variant-encoded row payloads, partitioned by experiment_id",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.feature.variantType-preview": "supported",
    },
    partition_cols=["experiment_id"]
)
def raw_uploaded_data():
    """Bronze: streaming ingestion of user-uploaded tabular data from parquet files in the data-imports volume.

    The Python upload task writes uploaded_data as a JSON string in parquet, plus the stable upload_table_id
    that anchors a logical upload table across batches. Here we parse uploaded_data into VARIANT so downstream
    gold derivation and metadata aggregation can infer per-table schemas via schema_of_variant_agg.
    Peer of raw_imported_data."""
    uploaded_path = f"/Volumes/{CATALOG_NAME}/centrum/data-imports/*/processed-uploads"

    uploaded_data_schema = StructType([
        StructField("experiment_id", StringType(), True),
        StructField("upload_table_id", StringType(), True),
        StructField("upload_table_name", StringType(), True),
        StructField("upload_id", StringType(), True),
        StructField("created_by", StringType(), True),
        StructField("uploaded_at", TimestampType(), True),
        StructField("uploaded_data", StringType(), True),
        StructField("row_index", LongType(), True),
    ])

    return (
        spark.readStream
        .format("cloudFiles")
        .option("cloudFiles.format", "parquet")
        .option("recursiveFileLookup", "true")
        .option("ignoreMissingFiles", "true")
        .schema(uploaded_data_schema)
        .load(uploaded_path)
        .withColumn("uploaded_data", F.expr("try_parse_json(uploaded_data)"))
    )
