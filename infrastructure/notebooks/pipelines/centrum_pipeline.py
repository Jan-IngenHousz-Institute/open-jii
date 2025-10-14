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
    StructField("user_answers", MapType(StringType(), StringType()), True)
])

# COMMAND ----------

# DBTITLE 1,Configuration
CATALOG_NAME = spark.conf.get("CATALOG_NAME", "open_jii_dev")
CENTRAL_SCHEMA = spark.conf.get("CENTRAL_SCHEMA", "centrum")
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

    # Apply watermarking and deduplication
    df = df.withWatermark("timestamp", "1 hour") \
        .dropDuplicates(["device_id", "timestamp", "kinesis_sequence_number"])
        
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
    
    # Extract user_answers from the parsed_data (same level as device_id, device_name, etc.)
    df = df.withColumn(
        "user_answers_json",
        F.col("parsed_data.user_answers")
    )
    
    # Extract specific user answer fields as separate columns
    df = df.withColumn(
        "plot_number",
        F.when(F.col("user_answers_json").isNotNull(),
            F.get_json_object(F.to_json(F.col("user_answers_json")), "$.59988").cast("int")
        ).otherwise(F.lit(None).cast("int"))
    ).withColumn(
        "plant",
        F.when(F.col("user_answers_json").isNotNull(),
            F.get_json_object(F.to_json(F.col("user_answers_json")), "$.59989")
        ).otherwise(F.lit(None).cast("string"))
    ).withColumn(
        "stem_count",
        F.when(F.col("user_answers_json").isNotNull(),
            F.get_json_object(F.to_json(F.col("user_answers_json")), "$.59994").cast("int")
        ).otherwise(F.lit(None).cast("int"))
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
        "plot_number",
        "plant", 
        "stem_count",
        "experiment_id",
        "timestamp",
        "date",
        "hour",
        "ingest_latency_ms",
        "processed_timestamp"
    )
