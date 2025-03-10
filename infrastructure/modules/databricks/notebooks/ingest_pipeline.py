import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType, IntegerType

# Configuration constants
KINESIS_STREAM_NAME = "open-jii-dev-data-ingest-stream"  # Update with your actual stream name
KINESIS_ENDPOINT = "https://kinesis.us-west-1.amazonaws.com"  # Update with your region
CENTRAL_SCHEMA = "centrum"  # Your central schema name
BRONZE_TABLE = "raw_data"

# Define the expected schema for sensor data - will use this to parse JSON payloads
sensor_schema = StructType([
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
    StructField("plant_name", StringType(), True),
    StructField("plant_genotype", StringType(), True),
    StructField("plant_id", StringType(), True),
    StructField("plant_location", IntegerType(), True),
    StructField("notes", StringType(), True),
    StructField("latitude", DoubleType(), True),
    StructField("longitude", DoubleType(), True)
])

@dlt.table(
    name="raw_kinesis_data",
    comment="Raw binary data directly from Kinesis stream with no transformations",
    table_properties={
        "quality": "bronze",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true"
    },
    temporary=True
)
def ingest_raw_kinesis():
    """
    Ingests raw binary data from the Kinesis stream.
    This is a temporary table that captures the raw stream without modifications.
    Uses Databricks service credential for secure AWS authentication.
    """
    return (
        spark.readStream
        .format("kinesis")
        .option("streamName", KINESIS_STREAM_NAME)
        .option("initialPosition", "TRIM_HORIZON")  # Start with earliest available data
        # Use service credential instead of instance profile
        .option("serviceCredential", "agricultural-iot-kinesis-credential")
        # .option("awsUseInstanceProfile", "true")  # Removed in favor of service credential
        .load()
        .withColumn("ingestion_timestamp", F.current_timestamp())
    )

@dlt.table(
    name=BRONZE_TABLE,
    schema=CENTRAL_SCHEMA,
    comment="Bronze layer: Raw sensor data ingested from Kinesis",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.enableChangeDataFeed": "true"
    },
    partition_cols=["ingest_date"]
)
@dlt.expect_or_drop("valid_data", "data IS NOT NULL")
def raw_data():
    """
    Transforms raw Kinesis data into the Bronze layer format.
    Performs minimal transformations - mainly converting binary data to structured format.
    """
    # Read from the temporary raw data table
    return (
        dlt.read_stream("raw_kinesis_data")
        # Convert binary data to string and parse JSON
        .withColumn("raw_payload", F.col("data").cast("string"))
        .withColumn("parsed_data", F.from_json(F.col("raw_payload"), sensor_schema))
        
        # Handle topic information (may come from Kinesis records)
        .withColumn("topic", 
                   F.coalesce(
                       F.col("partitionKey"),  # Use partitionKey if available
                       F.lit("default/topic")  # Default topic if not available
                   ))
        
        # Extract experiment_id (could be from parsed data or from topic pattern)
        .withColumn("experiment_id", 
                   F.coalesce(
                       F.col("parsed_data.experiment_id"),
                       # Try to extract from topic if following MQTT pattern
                       F.regexp_extract(F.col("topic"), r"/experiment/([^/]+)/", 1),
                       F.lit(None).cast(StringType())
                   ))
        
        # Extract all required fields from parsed data
        .withColumn("device_id", F.col("parsed_data.device_id"))
        .withColumn("device_type", F.col("parsed_data.device_type"))
        .withColumn("device_version", F.col("parsed_data.device_version"))
        .withColumn("device_name", F.col("parsed_data.device_name"))
        .withColumn("device_battery", F.col("parsed_data.device_battery"))
        .withColumn("device_firmware", F.col("parsed_data.device_firmware"))
        .withColumn("sensor_id", F.coalesce(F.col("parsed_data.device_id"), F.lit(None).cast(StringType())))
        .withColumn("measurement_type", F.col("parsed_data.sensor_type"))
        .withColumn("timestamp", F.col("parsed_data.timestamp"))
        .withColumn("measurement_value", F.col("parsed_data.reading_value"))
        .withColumn("protocol", F.coalesce(F.col("parsed_data.protocol"), F.lit("MQTT")))
        .withColumn("plant_name", F.col("parsed_data.plant_name"))
        .withColumn("plant_genotype", F.col("parsed_data.plant_genotype"))
        .withColumn("plant_id", F.col("parsed_data.plant_id"))
        .withColumn("plant_location", F.col("parsed_data.plant_location"))
        .withColumn("notes", F.col("parsed_data.notes"))
        .withColumn("ingest_date", F.to_date(F.col("ingestion_timestamp")))
        .withColumn("ingest_timestamp", F.col("ingestion_timestamp"))
        
        # Select final columns matching the raw_data table schema
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

# Data quality expectations
@dlt.table(
    name="bronze_data_quality",
    schema=CENTRAL_SCHEMA,
    comment="Data quality metrics for Bronze layer ingestion"
)
@dlt.expect("has_device_id", "device_id IS NOT NULL")
@dlt.expect("has_timestamp", "timestamp IS NOT NULL")
@dlt.expect("has_measurement", "measurement_value IS NOT NULL")
@dlt.expect_or_drop("valid_timestamp", "timestamp > '2020-01-01'")
def bronze_quality():
    """
    Apply data quality checks to the raw data.
    Records all data, but flags records that don't meet quality expectations.
    """
    return dlt.read("raw_data")

@dlt.table(
    name="bronze_monitoring",
    schema=CENTRAL_SCHEMA,
    comment="Monitoring metrics for bronze layer data by device and experiment"
)
def bronze_monitoring():
    """
    Create aggregated metrics to monitor data ingest by device and experiment.
    Useful for tracking data volumes and basic statistics.
    """
    return (
        dlt.read("raw_data")
        .groupBy(
            F.window(F.col("timestamp"), "1 hour").alias("time_window"),
            "device_id",
            "experiment_id"
        )
        .agg(
            F.count("*").alias("record_count"),
            F.min("timestamp").alias("min_timestamp"),
            F.max("timestamp").alias("max_timestamp"),
            F.avg("measurement_value").alias("avg_value"),
            F.avg("device_battery").alias("avg_battery"),
            F.count(F.when(F.col("measurement_value").isNull(), 1)).alias("null_value_count")
        )
    )