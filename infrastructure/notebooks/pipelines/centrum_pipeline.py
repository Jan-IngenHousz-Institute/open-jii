# Databricks notebook source
# DBTITLE 1,OpenJII Medallion Architecture Pipeline
# This notebook implements the complete medallion architecture (Bronze-Silver-Gold)
# for OpenJII IoT sensor data processing following the dual medallion pattern

# COMMAND ----------

import dlt
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType, MapType, ArrayType, IntegerType
from delta.tables import DeltaTable

# COMMAND ----------

# DBTITLE 1,Schema Definition
# Define schema for sensor data to parse JSON payloads
question_schema = StructType([
    StructField("question_label", StringType(), True),
    StructField("question_text", StringType(), True),
    StructField("question_answer", StringType(), True)
])

sensor_schema = StructType([
    StructField("topic", StringType(), False),
    StructField("device_name", StringType(), True),
    StructField("device_version", StringType(), True),
    StructField("device_id", StringType(), False),
    StructField("device_battery", DoubleType(), True),
    StructField("device_firmware", StringType(), True),
    StructField("sample", StringType(), True),
    StructField("timestamp", TimestampType(), False),
    StructField("output", StringType(), True),
    StructField("questions", ArrayType(question_schema), True)
])

# COMMAND ----------

# DBTITLE 1,Configuration
BRONZE_TABLE = spark.conf.get("BRONZE_TABLE", "raw_data")
SILVER_TABLE = spark.conf.get("SILVER_TABLE", "clean_data")

# Kinesis configuration parameters
KINESIS_STREAM_NAME = spark.conf.get("KINESIS_STREAM_NAME")
CHECKPOINT_PATH = spark.conf.get("CHECKPOINT_PATH")
SERVICE_CREDENTIAL_NAME = spark.conf.get("SERVICE_CREDENTIAL_NAME")


# COMMAND ----------

# DBTITLE 1,Bronze Layer - Raw Data Processing
@dlt.table(
    name=BRONZE_TABLE,
    comment="Bronze layer: Raw sensor data ingested from Kinesis",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.enableChangeDataFeed": "true"
    }
)
def raw_data():
    """
    Directly ingests raw Kinesis sensor data streams into structured bronze layer tables.
    
    This function:
    - Reads directly from Kinesis stream
    - Extracts device metadata and measurements from JSON payloads
    - Normalizes device readings across different sensor types
    - Performs initial deduplication using watermarking
    - Extracts plant metadata when available
    - Preserves the original raw payload for auditing and reprocessing
    """
    
    # Read directly from Kinesis stream - keep as raw as possible for bronze layer
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
        .select(
            "experiment_id", 
            "parsed_data",
            "ingestion_timestamp",
            "ingest_date",
            "kinesis_sequence_number",
            "kinesis_shard_id",
            "kinesis_arrival_time",
            "partitionKey"
        )
    )

# COMMAND ----------

# DBTITLE 1,Silver Layer - Clean Data
@dlt.table(
    name=SILVER_TABLE,
    comment="Silver layer: Cleaned and standardized sensor data",
    table_properties={
        "quality": "silver",
        "pipelines.autoOptimize.managed": "true",
        "delta.enableChangeDataFeed": "true"
    }
)
@dlt.expect_or_drop("valid_timestamp", "timestamp IS NOT NULL")
@dlt.expect_or_drop("valid_device_id", "device_id IS NOT NULL")
def clean_data():
    """
    Transforms Bronze data into a cleaned Silver table with standardized values,
    quality checks, and enriched metadata.
    
    This Silver layer serves as the handoff point for experiment-specific schemas.
    """
    # Read from bronze and extract/transform the data
    bronze_df = dlt.read_stream(BRONZE_TABLE)
    
    # Extract and transform the data
    df = (
        bronze_df
        .withColumn("device_id", F.col("parsed_data.device_id"))
        .withColumn("device_name", F.col("parsed_data.device_name"))
        .withColumn("device_version", F.col("parsed_data.device_version"))
        .withColumn("device_battery", F.col("parsed_data.device_battery"))
        .withColumn("device_firmware", F.col("parsed_data.device_firmware"))
        .withColumn("sample", F.col("parsed_data.sample"))
        .withColumn("output", F.col("parsed_data.output"))
        .withColumn("timestamp", F.col("parsed_data.timestamp"))
        .withColumn("processed_timestamp", F.current_timestamp())
        .withColumn("date", F.to_date("timestamp"))
        .withColumn("hour", F.hour("timestamp"))
    )
        
    # Calculate data latency (time between reading and ingestion)
    df = df.withColumn(
        "ingest_latency_ms", 
        F.unix_timestamp("ingestion_timestamp") - F.unix_timestamp("timestamp")
    )
    
    # Extract macros from sample data for downstream processing
    df = df.withColumn(
        "macros",
        F.when(F.col("sample").isNotNull(),
            F.expr("""
                flatten(
                    transform(
                        from_json(sample, 'array<string>'),
                        x -> from_json(get_json_object(x, '$.macros'), 'array<string>')
                    )
                )
            """)
        ).otherwise(F.array())
    )
    
    # Extract questions from the parsed_data and keep in original array structure
    df = df.withColumn(
        "questions",
        F.col("parsed_data.questions")
    )
    
    # Select final columns for silver layer
    return df.select(
        "device_id",
        "device_name",
        "device_version",
        "device_battery",
        "device_firmware",
        "sample",
        "output",
        "macros",
        "questions",
        "experiment_id",
        "timestamp",
        "date",
        "hour",
        "ingest_latency_ms",
        "processed_timestamp"
    )

# COMMAND ----------

# DBTITLE 1,Gold Layer - Experiment Status
@dlt.table(
    name="experiment_status",
    comment="Gold layer: Materialized view tracking experiment freshness status",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.enableChangeDataFeed": "true"
    }
)
def experiment_status():
    """
    Gold layer materialized view that tracks experiment freshness status.
    
    This function:
    - Queries the clean data (silver) table
    - Gets the latest timestamp for each experiment ID
    - Determines the status (fresh/stale) based on configurable freshness criteria
    - Structured for efficient incremental refreshes
    """
    
    # Configuration for freshness threshold (in minutes)
    # Data older than this threshold will be marked as "stale"
    FRESHNESS_THRESHOLD_MINUTES = 60  # Can be parameterized via spark.conf
    
    # Read from silver table
    silver_df = dlt.read(SILVER_TABLE)
    
    # Get the current timestamp for comparison
    current_timestamp = F.current_timestamp()
    
    # Calculate the latest timestamp for each experiment_id
    experiment_status_df = (
        silver_df
        .groupBy("experiment_id")
        .agg(
            F.max("timestamp").alias("latest_timestamp"),
            F.max("processed_timestamp").alias("latest_processed_timestamp")
        )
        .filter("experiment_id IS NOT NULL")  # Filter out records with null experiment_id
    )
    
    # Calculate freshness status
    # Compare timestamp difference in seconds against threshold converted to seconds
    freshness_threshold_seconds = FRESHNESS_THRESHOLD_MINUTES * 60
    status_df = (
        experiment_status_df
        .withColumn(
            "status",
            F.when(
                (current_timestamp.cast("long") - F.col("latest_processed_timestamp").cast("long")) <= freshness_threshold_seconds,
                F.lit("fresh")
            ).otherwise(F.lit("stale"))
        )
        .withColumn("status_updated_at", current_timestamp)
    )
    
    # Select final columns for the gold layer
    return status_df.select(
        "experiment_id",
        "latest_timestamp",
        "latest_processed_timestamp",
        "status",
        "status_updated_at"
    )