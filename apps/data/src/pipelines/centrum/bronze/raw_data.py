# Databricks notebook source
# DBTITLE 1,Bronze Layer - Raw Data Processing
# This notebook defines the bronze layer raw_data table - Kinesis ingestion of
# device sensor payloads. Part of the centrum DLT pipeline.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import StringType

from openjii.centrum import sensor_schema
from openjii.centrum.runtime import (
    BRONZE_TABLE,
    KINESIS_STREAM_NAME,
    SERVICE_CREDENTIAL_NAME,
)

# COMMAND ----------

@dlt.table(
    name=BRONZE_TABLE,
    comment="Bronze layer: Raw sensor data ingested from Kinesis",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableChangeDataFeed": "true",
        "pipelines.reset.allowed": "false"
    }
)
def raw_data():
    """Bronze layer: Ingest raw Kinesis sensor data."""

    return (
        spark.readStream
        .format("kinesis")
        .option("streamName", KINESIS_STREAM_NAME)
        .option("initialPosition", "TRIM_HORIZON")
        .option("serviceCredential", SERVICE_CREDENTIAL_NAME)
        .option("maxRecordsPerFetch", "10000")
        .load()
        .withColumn("ingestion_timestamp", F.current_timestamp())
        # Capture Kinesis metadata
        .withColumn("kinesis_sequence_number", F.col("sequenceNumber"))
        .withColumn("kinesis_shard_id", F.col("shardId"))
        .withColumn("kinesis_arrival_time", F.col("approximateArrivalTimestamp"))
        .withColumn("partitionKey", F.col("partitionKey"))
        # Parse data for basic extraction
        .withColumn("parsed_data", F.from_json(F.col("data").cast("string"), sensor_schema))
        .withColumn("ingest_date", F.to_date(F.col("ingestion_timestamp")))
        # Basic experiment_id extraction for partitioning
        .withColumn("experiment_id", F.coalesce(
            F.regexp_extract(F.col("parsed_data.topic"), r"experiment/data_ingest/v1/([^/]+)/", 1),
            F.regexp_extract(F.col("partitionKey"), r"/experiment/([^/]+)/", 1),
            F.lit(None).cast(StringType())
        ))
        # clientid() from the IoT rule is the broker-authenticated Thing name (X.509 devices);
        # extracted top-level to avoid evolving the non-resettable bronze parsed_data struct.
        .withColumn("client_id", F.get_json_object(F.col("data").cast("string"), "$.client_id"))
        # Workbook execution metadata is also extracted top-level. Adding fields
        # to parsed_data would evolve the nested struct of this non-resettable
        # bronze table. JSON-shaped values stay serialized strings.
        .withColumn(
            "workbook_version_id",
            F.get_json_object(F.col("data").cast("string"), "$.workbook_version_id"),
        )
        .withColumn(
            "macro_context",
            F.get_json_object(F.col("data").cast("string"), "$.macro_context"),
        )
        .withColumn(
            "producer_cell_id",
            F.get_json_object(F.col("data").cast("string"), "$.producer_cell_id"),
        )
        .withColumn(
            "producer_kind",
            F.get_json_object(F.col("data").cast("string"), "$.producer_kind"),
        )
        .withColumn(
            "dispatched_command",
            F.get_json_object(F.col("data").cast("string"), "$.dispatched_command"),
        )
        .withColumn(
            "command_source",
            F.get_json_object(F.col("data").cast("string"), "$.command_source"),
        )
        .withColumn(
            "execution_epoch",
            F.get_json_object(F.col("data").cast("string"), "$.execution_epoch"),
        )
        .select(
            "experiment_id",
            "client_id",
            "workbook_version_id",
            "macro_context",
            "producer_cell_id",
            "producer_kind",
            "dispatched_command",
            "command_source",
            "execution_epoch",
            "parsed_data",
            "ingestion_timestamp",
            "ingest_date",
            "kinesis_sequence_number",
            "kinesis_shard_id",
            "kinesis_arrival_time",
            "partitionKey"
        )
    )
