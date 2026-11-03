# Databricks notebook source
# DBTITLE 1,Bronze Layer - Ingest Health Checks
# The ingest health check's synthetic messages, read from the same Kinesis stream as raw_data and
# kept apart from it, so they never become measurements. The newest one's age is the platform
# heartbeat's end-to-end signal. Part of the centrum DLT pipeline.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum.constants import (
    INGEST_HEALTHCHECK_EXPERIMENT_ID,
    INGEST_HEALTHCHECKS_TABLE,
    INGEST_TOPIC_EXPERIMENT_PATTERN,
    MEASUREMENT_PATH_TRIGGER_INTERVAL,
)
from openjii.centrum.runtime import KINESIS_STREAM_NAME, SERVICE_CREDENTIAL_NAME

# COMMAND ----------

@dlt.table(
    name=INGEST_HEALTHCHECKS_TABLE,
    comment="Bronze layer: Synthetic messages the ingest health check sent through the ingest rule",
    spark_conf={"pipelines.trigger.interval": MEASUREMENT_PATH_TRIGGER_INTERVAL},
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        # Auto compaction plans every write at 200 partitions whatever the pipeline sets;
        # predictive optimization compacts these tables asynchronously instead.
        "delta.autoOptimize.autoCompact": "false",
    }
)
def ingest_healthchecks():
    """Bronze layer: Ingest the health check's messages from Kinesis."""

    payload = F.col("data").cast("string")
    experiment_id = F.regexp_extract(F.col("topic"), INGEST_TOPIC_EXPERIMENT_PATTERN, 1)

    return (
        spark.readStream
        .format("kinesis")
        .option("streamName", KINESIS_STREAM_NAME)
        # Only health checks from now on matter; the stream's backlog is all measurements.
        .option("initialPosition", "latest")
        .option("serviceCredential", SERVICE_CREDENTIAL_NAME)
        # Two polling readers share each shard's five GetRecords calls a second, and this table tolerates latency.
        .option("minFetchPeriod", "2s")
        .option("maxRecordsPerFetch", "10000")
        .load()
        .withColumn("topic", F.get_json_object(payload, "$.topic"))
        # The topic is open to any publisher and payload, so a message without the publisher's flag is not one.
        .filter(
            (experiment_id == F.lit(INGEST_HEALTHCHECK_EXPERIMENT_ID))
            & (F.get_json_object(payload, "$.healthcheck") == F.lit("true"))
        )
        .select(
            # The publisher stamps epoch milliseconds
            (F.get_json_object(payload, "$.sent_at").cast("long") / 1000).cast("timestamp").alias("sent_at"),
            F.get_json_object(payload, "$.environment").alias("environment"),
            F.col("approximateArrivalTimestamp").alias("kinesis_arrival_time"),
            F.current_timestamp().alias("ingestion_timestamp"),
        )
    )
