# Databricks notebook source
# DBTITLE 1,IoT Data Kinesis Ingestion Task
# This task reads raw data from AWS Kinesis stream and writes it to a Delta table
# One-time batch processing (non-continuous)

# COMMAND ----------

import pyspark.sql.functions as F
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType, IntegerType
from pyspark.sql.streaming import StreamingQueryListener
import time

# COMMAND ----------

# DBTITLE 1,Configuration
# Read configuration from job parameters
KINESIS_STREAM_NAME = dbutils.widgets.get("kinesis_stream_name")
CHECKPOINT_PATH = dbutils.widgets.get("checkpoint_path")
CATALOG_NAME = dbutils.widgets.get("catalog_name") 
SCHEMA_NAME = dbutils.widgets.get("schema_name")
TARGET_TABLE = dbutils.widgets.get("target_table")
SERVICE_CREDENTIAL_NAME = dbutils.widgets.get("service_credential_name")

# COMMAND ----------

# DBTITLE 1,Schema Definition
# Define schema for sensor data to parse JSON payloads
sensor_schema = StructType([
    StructField("topic", StringType(), False),
    StructField("device_id", StringType(), False),
    StructField("timestamp", TimestampType(), False),
    StructField("experiment_id", StringType(), True),
    StructField("sensor_type", StringType(), True),
    StructField("reading_value", DoubleType(), True),
    StructField("reading_unit", StringType(), True),
    StructField("device_type", StringType(), True),
    StructField("device_version", StringType(), True), 
    StructField("device_name", StringType(), True),
    StructField("device_battery", DoubleType(), True),
    StructField("device_firmware", StringType(), True),
    StructField("measurement_type", StringType(), True),
    StructField("protocol", StringType(), True),
    StructField("latitude", DoubleType(), True),
    StructField("longitude", DoubleType(), True),

    StructField("plant_metadata", StructType([
        StructField("plant_id", StringType(), True),
        StructField("plant_name", StringType(), True),
        StructField("plant_genotype", StringType(), True),
        StructField("plant_location", StringType(), True),
        StructField("notes", StringType(), True)
    ]), True),

    # Temporary
    StructField("SPAD", DoubleType(), True),                # MultispeQ-specific measurement
    StructField("created_at", TimestampType(), True),       # Alternative timestamp field
    StructField("md5_protocol", StringType(), True),        # Integrity validation
    StructField("md5_measurement", StringType(), True),     # Integrity validation
])


# COMMAND ----------

class KinesisListener(StreamingQueryListener):
    def onQueryStarted(self, event):
        print(f"Query started: {event.id}")

    def onQueryProgress(self, event):
        print(f"Query made progress: {event.progress}")
        print(f"Input rows per second: {event.progress['inputRowsPerSecond']}")
        print(f"Processed rows per second: {event.progress['processedRowsPerSecond']}")

    def onQueryTerminated(self, event):
        print(f"Query terminated: {event.id}")

# Add the listener to the Spark session
spark.streams.addListener(KinesisListener())

# COMMAND ----------

# DBTITLE 1,Kinesis Stream Reader (One-time Batch)
def ingest_from_kinesis():
    return (
        spark.readStream
        .format("kinesis")
        .option("streamName", KINESIS_STREAM_NAME)
        .option("initialPosition", "LATEST") 
        .option("serviceCredential", SERVICE_CREDENTIAL_NAME)
        .option("checkpointLocation", CHECKPOINT_PATH)
        .option("failOnDataLoss", "false")
        .option("maxRecordsPerFetch", "10000")
        .load()
        .withColumn("ingestion_timestamp", F.current_timestamp())
        .withColumn("raw_payload", F.col("data").cast("string"))
        # Capture Kinesis metadata
        .withColumn("kinesis_sequence_number", F.col("sequenceNumber"))
        .withColumn("kinesis_shard_id", F.col("shardId"))
        .withColumn("kinesis_arrival_time", F.col("approximateArrivalTimestamp"))
        # Parse data
        .withColumn("parsed_data", F.from_json(F.col("raw_payload"), sensor_schema))
        .withColumn("ingest_date", F.to_date(F.col("ingestion_timestamp")))
        # Fix topic reference
        .withColumn("experiment_id", F.coalesce(
            F.col("parsed_data.experiment_id"),
            F.regexp_extract(F.col("parsed_data.topic"), r"experiment/data_ingest/v1/([^/]+)/", 1),
            F.regexp_extract(F.col("partitionKey"), r"/experiment/([^/]+)/", 1),
            F.lit(None).cast(StringType())
        ))
    )

# COMMAND ----------

# DBTITLE 1,Write to Delta Lake as One-time Batch
# Execute the stream ingestion and write to Delta table
stream_df = ingest_from_kinesis()

# Write the stream to Delta table with availableNow (modern API)
query = (stream_df.writeStream
    .format("delta")
    .outputMode("append")
    .option("checkpointLocation", f"{CHECKPOINT_PATH}/write")
    .option("mergeSchema", "true")
    .partitionBy("ingest_date")
    .trigger(processingTime="30 seconds")
    .table(f"{CATALOG_NAME}.{SCHEMA_NAME}.{TARGET_TABLE}")
)

# COMMAND ----------

query.awaitTermination()