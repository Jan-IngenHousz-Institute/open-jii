# Databricks notebook source
# MAGIC %md
# MAGIC # Agricultural Sensor Data Ingestion Pipeline
# MAGIC 
# MAGIC This notebook implements the data ingestion process from AWS Kinesis streams to the central Bronze layer, following the medallion architecture. The pipeline:
# MAGIC 
# MAGIC 1. Reads streaming data from a Kinesis stream in real-time
# MAGIC 2. Performs initial parsing and validation of the raw data
# MAGIC 3. Preserves raw data in the Bronze layer with minimal transformations
# MAGIC 4. Extracts experiment ID information for later routing
# MAGIC 5. Creates monitoring views for data quality tracking
# MAGIC 
# MAGIC ## Architecture
# MAGIC - **Source**: AWS Kinesis Stream containing raw sensor readings
# MAGIC - **Destination**: Bronze layer tables in the central schema
# MAGIC - **Processing**: Streaming ingest with minimal transformations to preserve raw data fidelity

# COMMAND ----------

# MAGIC %md
# MAGIC ## Configuration

# COMMAND ----------

# DBTITLE 1,Pipeline Configuration
# Import required libraries
import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType, IntegerType

# Define constants
KINESIS_STREAM_NAME = "agricultural_sensors_stream"
KINESIS_ENDPOINT = "https://kinesis.us-west-2.amazonaws.com"
AWS_REGION = "us-west-2"
CATALOG_NAME = "open_jii_dev"
CENTRAL_SCHEMA = "centrum"
BRONZE_TABLE = "raw_data"
BRONZE_PROCESSED_TABLE = "bronze_parsed"
CHECKPOINT_PATH = "/tmp/checkpoints/kinesis_ingest"

# COMMAND ----------

# MAGIC %md
# MAGIC ## Schema Definitions

# COMMAND ----------

# Define the expected schema for sensor data
sensor_schema = StructType([
    StructField("device_id", StringType(), False),
    StructField("timestamp", TimestampType(), False),
    StructField("experiment_id", StringType(), True),
    StructField("sensor_type", StringType(), False),
    StructField("reading_value", DoubleType(), False),
    StructField("reading_unit", StringType(), True),
    StructField("latitude", DoubleType(), True),
    StructField("longitude", DoubleType(), True),
    StructField("battery_level", IntegerType(), True),
    StructField("signal_strength", IntegerType(), True),
    StructField("firmware_version", StringType(), True),
    StructField("plant_id", StringType(), True),
    StructField("plant_genotype", StringType(), True),
    StructField("error_code", StringType(), True)
])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Bronze Layer Ingestion

# COMMAND ----------

# DBTITLE 1,Initial Raw Data Ingestion
@dlt.table(
    name="raw_kinesis_data",
    comment="Raw unstructured data directly from Kinesis stream with no transformations",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.enableChangeDataFeed": "true"
    }
)
def ingest_raw_kinesis_data():
    """
    Ingest raw data directly from Kinesis with minimal processing.
    This function captures the data exactly as received from Kinesis.
    """
    return (
        spark.readStream
            .format("kinesis")
            .option("streamName", KINESIS_STREAM_NAME)
            .option("endpointUrl", KINESIS_ENDPOINT)
            .option("region", AWS_REGION)
            # Start with the earliest available data
            .option("startingPosition", "TRIM_HORIZON")
            # Use IAM role attached to the cluster
            .option("awsUseInstanceProfile", "true")
            .load()
            # Add ingestion metadata
            .withColumn("kinesis_ingestion_time", F.current_timestamp())
            .withColumn("kinesis_shard_id", F.col("shardId"))
            .withColumn("kinesis_sequence_number", F.col("sequenceNumber"))
    )

# COMMAND ----------

# DBTITLE 1,Process Raw Data to Bronze
@dlt.table(
    name=BRONZE_TABLE,
    comment="Raw sensor data processed from Kinesis stream with initial parsing",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.enableChangeDataFeed": "true",
        "delta.partitionBy": "ingest_date,experiment_id"
    }
)
def process_raw_sensor_data():
    """
    Process raw Kinesis data into the Bronze layer format.
    Performs initial JSON parsing and extracts experiment_id for partitioning.
    """
    # Read from raw Kinesis data
    return (
        dlt.read("raw_kinesis_data")
        # Convert binary data to string for JSON parsing
        .withColumn("raw_payload", F.col("data").cast("string"))
        # Parse the JSON payload using our defined schema
        .withColumn("parsed_data", F.from_json(F.col("raw_payload"), sensor_schema))
        # Extract experiment_id for two possible sources:
        # 1. From the JSON payload
        # 2. From a potential MQTT topic pattern using regex
        .withColumn("experiment_id", 
            F.coalesce(
                # Try to get from parsed JSON first
                F.col("parsed_data.experiment_id"),
                # If not found, try to extract from topic if present (MQTT pattern)
                F.regexp_extract(F.col("topic"), r"/experiment/([^/]+)/", 1)
            )
        )
        # Add date for partitioning
        .withColumn("ingest_date", F.to_date(F.col("approximateArrivalTimestamp")))
        # Extract fields from parsed data
        .withColumn("device_id", F.col("parsed_data.device_id"))
        .withColumn("device_type", F.lit(null).cast(StringType()))
        .withColumn("device_version", F.lit(null).cast(StringType()))
        .withColumn("device_name", F.lit(null).cast(StringType()))
        .withColumn("device_battery", F.col("parsed_data.battery_level"))
        .withColumn("device_firmware", F.col("parsed_data.firmware_version"))
        .withColumn("sensor_id", F.col("device_id"))
        .withColumn("measurement_type", F.col("parsed_data.sensor_type"))
        .withColumn("timestamp", F.col("parsed_data.timestamp"))
        .withColumn("measurement_value", F.col("parsed_data.reading_value"))
        .withColumn("protocol", F.lit("MQTT").cast(StringType()))
        .withColumn("plant_id", F.col("parsed_data.plant_id"))
        .withColumn("plant_name", F.lit(null).cast(StringType()))
        .withColumn("plant_genotype", F.col("parsed_data.plant_genotype"))
        .withColumn("plant_location", F.lit(null).cast(IntegerType()))
        .withColumn("notes", F.lit(null).cast(StringType()))
        .withColumn("topic", F.col("topic"))
        .withColumn("ingest_timestamp", F.current_timestamp())
        # Select final columns matching the raw_data schema
        .select(
            "topic",
            "experiment_id",
            "device_type",
            "device_version",
            "sensor_id",
            "measurement_type",
            "timestamp",
            "measurement_value",
            "notes",
            "protocol",
            "device_name",
            "device_id",
            "device_battery",
            "device_firmware",
            "plant_name",
            "plant_genotype",
            "plant_id",
            "plant_location",
            "raw_payload",
            "ingest_timestamp",
            "ingest_date"
        )
    )

# COMMAND ----------

# MAGIC %md
# MAGIC ## Views for Data Exploration and Monitoring

# COMMAND ----------

# DBTITLE 1,Raw Data View
@dlt.view(
    name="raw_bronze_view",
    comment="View of the raw bronze data for ad-hoc exploration"
)
def view_raw_bronze():
    """
    Create a view of raw bronze data for exploration and troubleshooting.
    """
    return dlt.read(BRONZE_TABLE)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Data Quality Expectations

# COMMAND ----------

# Add data quality expectations for the bronze data
@dlt.expect_or_drop("valid_device_id", "device_id IS NOT NULL")
@dlt.expect_or_drop("valid_timestamp", "timestamp IS NOT NULL")
@dlt.expect_or_drop("valid_measurement", "measurement_value IS NOT NULL")
@dlt.expect("valid_experiment_id", "experiment_id IS NULL OR length(experiment_id) > 0")
def bronze_with_expectations():
    """
    Apply basic data quality checks to the Bronze layer data.
    Records that don't meet expectations will be dropped.
    """
    return dlt.read(BRONZE_TABLE)

# COMMAND ----------

# DBTITLE 1,Monitoring View
@dlt.view(
    name="bronze_monitoring",
    comment="Monitoring view for bronze layer ingestion"
)
def monitor_bronze_ingest():
    """
    Create a monitoring view to track data flow and quality metrics.
    """
    return (
        dlt.read(BRONZE_TABLE)
            .filter("device_id IS NOT NULL")  # Only include valid records
            .groupBy(
                F.window(F.col("timestamp"), "1 hour"),
                "device_id",
                "experiment_id"
            )
            .agg(
                F.count("*").alias("record_count"),
                F.avg("measurement_value").alias("avg_reading"),
                F.min("measurement_value").alias("min_reading"),
                F.max("measurement_value").alias("max_reading"),
                F.stddev("measurement_value").alias("stddev_reading"),
                F.avg("device_battery").alias("avg_battery_level")
            )
    )

# COMMAND ----------

# DBTITLE 1,Data Quality Metrics
@dlt.view(
    name="data_quality_metrics",
    comment="View tracking data quality metrics and validation results"
)
def data_quality_metrics():
    """
    Create a view to track data quality metrics.
    """
    # Access system tables using the spark session
    expectations = spark.table(f"{CATALOG_NAME}.system.events")
    
    return (
        expectations
        .filter("event_type = 'expectations'")
        .select(
            "timestamp", 
            "details:flow_progress.metrics.num_output_rows",
            "details:flow_progress.metrics.num_output_generated_bytes",
            "details:flow_progress.data_quality.dropped_records",
            "details:flow_progress.status"
        )
    )
