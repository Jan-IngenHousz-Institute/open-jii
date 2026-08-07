# Databricks notebook source
# DBTITLE 1,Bronze Layer - Raw Data Processing
# This notebook defines the bronze layer raw_data table - Kinesis ingestion of
# device sensor payloads. Part of the centrum DLT pipeline.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import StringType

from openjii.centrum import WORKBOOK_RUN_CONTROL_TABLE, sensor_schema, workbook_run_control_schema
from openjii.centrum.routing import measurement_records, workbook_control_records
from openjii.centrum.runtime import (
    BRONZE_TABLE,
    KINESIS_STREAM_NAME,
    SERVICE_CREDENTIAL_NAME,
)

# COMMAND ----------


def _kinesis_records():
    return (
        spark.readStream
        .format("kinesis")
        .option("streamName", KINESIS_STREAM_NAME)
        .option("initialPosition", "TRIM_HORIZON")
        .option("serviceCredential", SERVICE_CREDENTIAL_NAME)
        .option("maxRecordsPerFetch", "10000")
        .load()
        .withColumn("ingestion_timestamp", F.current_timestamp())
        .withColumn("kinesis_sequence_number", F.col("sequenceNumber"))
        .withColumn("kinesis_shard_id", F.col("shardId"))
        .withColumn("kinesis_arrival_time", F.col("approximateArrivalTimestamp"))
        .withColumn("partitionKey", F.col("partitionKey"))
        .withColumn("payload_json", F.col("data").cast("string"))
        .withColumn("record_kind", F.get_json_object(F.col("payload_json"), "$.record_kind"))
    )


@dlt.table(
    name=WORKBOOK_RUN_CONTROL_TABLE,
    comment="Bronze control records describing terminal workbook attempts",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.enableChangeDataFeed": "true",
    },
)
def workbook_run_control():
    """Route terminal records into an isolated control table."""
    return (
        workbook_control_records(_kinesis_records())
        .withColumn("parsed_control", F.from_json(F.col("payload_json"), workbook_run_control_schema))
        .withColumn(
            "experiment_id",
            F.coalesce(
                F.expr(
                    r"nullif(regexp_extract(parsed_control.topic, 'experiment/data_ingest/v1/([^/]+)/', 1), '')"
                ),
                F.expr(r"nullif(regexp_extract(partitionKey, '/experiment/([^/]+)/', 1), '')"),
            ),
        )
        .select(
            "experiment_id",
            F.col("parsed_control.record_kind").alias("record_kind"),
            F.col("parsed_control.workbook_attempt_id").alias("workbook_attempt_id"),
            F.col("parsed_control.workbook_version_id").alias("workbook_version_id"),
            F.col("parsed_control.terminal_status").alias("terminal_status"),
            F.col("parsed_control.expected").alias("expected"),
            F.col("parsed_control.realized").alias("realized"),
            F.col("parsed_control._client_id").alias("client_row_id"),
            "ingestion_timestamp",
            "kinesis_sequence_number",
            "kinesis_shard_id",
            "kinesis_arrival_time",
            "partitionKey",
        )
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
        # Controls are removed before sensor-schema parsing.
        measurement_records(_kinesis_records())
        # Parse data for basic extraction
        .withColumn("parsed_data", F.from_json(F.col("payload_json"), sensor_schema))
        .withColumn("ingest_date", F.to_date(F.col("ingestion_timestamp")))
        # Basic experiment_id extraction for partitioning
        .withColumn("experiment_id", F.coalesce(
            F.regexp_extract(F.col("parsed_data.topic"), r"experiment/data_ingest/v1/([^/]+)/", 1),
            F.regexp_extract(F.col("partitionKey"), r"/experiment/([^/]+)/", 1),
            F.lit(None).cast(StringType())
        ))
        # clientid() from the IoT rule is the broker-authenticated Thing name (X.509 devices);
        # extracted top-level to avoid evolving the non-resettable bronze parsed_data struct.
        .withColumn("client_id", F.get_json_object(F.col("payload_json"), "$.client_id"))
        # Workbook execution metadata is also extracted top-level. Adding fields
        # to parsed_data would evolve the nested struct of this non-resettable
        # bronze table. macro_context stays JSON because its keys are dynamic.
        .withColumn(
            "workbook_version_id",
            F.get_json_object(F.col("payload_json"), "$.workbook_version_id"),
        )
        .withColumn(
            "workbook_attempt_id",
            F.get_json_object(F.col("payload_json"), "$.workbook_attempt_id"),
        )
        .withColumn(
            "producer_cell_id",
            F.get_json_object(F.col("payload_json"), "$.producer_cell_id"),
        )
        .withColumn(
            "macro_context",
            F.get_json_object(F.col("payload_json"), "$.macro_context"),
        )
        .select(
            "experiment_id",
            "client_id",
            "workbook_version_id",
            "workbook_attempt_id",
            "producer_cell_id",
            "macro_context",
            "parsed_data",
            "ingestion_timestamp",
            "ingest_date",
            "kinesis_sequence_number",
            "kinesis_shard_id",
            "kinesis_arrival_time",
            "partitionKey"
        )
    )
