# Databricks notebook source
# DBTITLE 1,Raw Large IoT Data - Streaming Table
# Bronze: large IoT payloads (>128 KB) uploaded to S3 via pre-signed URL,
# ingested with Auto Loader directory listing. Peer of raw_imported_data.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import RAW_LARGE_DATA_TABLE, large_iot_schema
from openjii.centrum.runtime import LARGE_IOT_S3_PATH

# COMMAND ----------

@dlt.table(
    name=RAW_LARGE_DATA_TABLE,
    comment="Streaming table: Large IoT payloads (>128 KB) uploaded to S3 via pre-signed URL, partitioned by experiment_id",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true"
    },
    partition_cols=["experiment_id"]
)
def raw_large_data():
    """Streaming ingestion of large IoT payloads from S3 via Auto Loader directory listing."""
    df = (
        spark.readStream
        .format("cloudFiles")
        .option("cloudFiles.format", "json")
        .option("recursiveFileLookup", "true")
        .option("ignoreMissingFiles", "true")
        .schema(large_iot_schema)
        .load(LARGE_IOT_S3_PATH)
    )

    # experiment_id comes from the S3 key (large-iot/{experimentId}/{uuid}.json).
    # The key is server-issued (pre-signed URL scoped to a membership-checked
    # experiment), so it wins over the client-controlled payload field.
    path_experiment_id = F.regexp_extract(F.col("_metadata.file_path"), r"large-iot/([^/]+)/", 1)

    return (
        df
        .withColumn(
            "experiment_id",
            F.coalesce(
                F.when(path_experiment_id != "", path_experiment_id),
                F.col("experiment_id"),
            )
        )
        .withColumn("ingestion_timestamp", F.current_timestamp())
    )
