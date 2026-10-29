# Databricks notebook source
# DBTITLE 1,Raw Large IoT Data - Streaming Table
# Bronze: large IoT payloads (>128 KB) uploaded to S3 via pre-signed URL,
# ingested with Auto Loader directory listing. Peer of raw_imported_data.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import RAW_LARGE_DATA_TABLE, large_iot_schema
from openjii.centrum.measurement_provenance import is_simulated, parse_large_iot_key
from openjii.centrum.runtime import LARGE_IOT_S3_PATH

# COMMAND ----------

@dlt.table(
    name=RAW_LARGE_DATA_TABLE,
    comment="Streaming table: Large IoT payloads (>128 KB) uploaded to S3 via pre-signed URL, partitioned by experiment_id",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "false"
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

    return extract_large_data(df)


def extract_large_data(df):
    # The signed key binds the experiment and uploader; payload authors are untrusted.
    uploader = F.col("_upload_key.uploader_id")

    return (
        df
        .withColumn("_upload_key", parse_large_iot_key(F.col("_metadata.file_path")))
        .withColumn(
            "experiment_id",
            F.coalesce(F.col("_upload_key.experiment_id"), F.col("experiment_id"))
        )
        .withColumn(
            "user_id",
            F.when(uploader.isNotNull(), uploader)
            .when(F.col("_upload_key.is_guest"), F.lit(None).cast("string"))
            .otherwise(F.col("user_id"))
        )
        .withColumn(
            "annotations",
            F.when(
                uploader.isNotNull(),
                F.transform(
                    F.col("annotations"),
                    lambda annotation: annotation.withField("createdBy", uploader)
                    .withField("createdByName", F.lit(None).cast("string")),
                ),
            ).otherwise(F.col("annotations"))
        )
        .withColumn("is_simulated", is_simulated(F.col("simulated"), F.col("device_id")))
        .withColumn("is_guest", F.col("_upload_key.is_guest"))
        .withColumn("ingestion_timestamp", F.current_timestamp())
        .drop("_upload_key")
    )
