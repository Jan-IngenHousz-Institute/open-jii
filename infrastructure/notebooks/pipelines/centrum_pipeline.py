# Databricks notebook source
# DBTITLE 1,OpenJII Medallion Architecture Pipeline
# This notebook implements the complete medallion architecture (Bronze-Silver-Gold)
# for OpenJII IoT sensor data processing following the dual medallion pattern

# COMMAND ----------

import dlt
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.sql.types import StringType, TimestampType, MapType, ArrayType, DoubleType, IntegerType
from delta.tables import DeltaTable

# COMMAND ----------

# DBTITLE 1,Configuration
# Runtime configuration parameters with default values
# Override these via pipeline parameters when deploying
CENTRAL_SCHEMA = spark.conf.get("CENTRAL_SCHEMA", "centrum")
CATALOG_NAME = spark.conf.get("CATALOG_NAME", "open_jii_dev")
BRONZE_TABLE = spark.conf.get("BRONZE_TABLE", "raw_data")
SILVER_TABLE = spark.conf.get("SILVER_TABLE", "clean_data")
RAW_KINESIS_TABLE = spark.conf.get("RAW_KINESIS_TABLE", "raw_kinesis_data")

# COMMAND ----------

# DBTITLE 1,Bronze Layer - Raw Data Processing
@dlt.table(
    name=BRONZE_TABLE,
    comment="Bronze layer: Raw sensor data ingested from Kinesis",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.enableChangeDataFeed": "true"
    },
    partition_cols=["ingest_date"]
)
@dlt.expect_or_drop("valid_data", "topic IS NOT NULL")
def raw_data():
    """
    Transforms raw Kinesis sensor data streams into structured bronze layer tables.
    
    This function:
    - Extracts device metadata and measurements from JSON payloads
    - Normalizes device readings across different sensor types
    - Performs initial deduplication using watermarking
    - Extracts plant metadata when available
    - Preserves the original raw payload for auditing and reprocessing
    """
    df = (
        spark.readStream.table(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{RAW_KINESIS_TABLE}")
        .withColumn("topic", 
                    F.coalesce(F.col("partitionKey"), F.lit("default/topic")))
        .withColumn("device_id", F.col("parsed_data.device_id"))
        .withColumn("device_type", F.col("parsed_data.device_type"))
        .withColumn("device_version", F.col("parsed_data.device_version"))
        .withColumn("device_name", F.col("parsed_data.device_name"))
        .withColumn("device_battery", F.col("parsed_data.device_battery"))
        .withColumn("device_firmware", F.col("parsed_data.device_firmware"))
        .withColumn("sensor_id", F.coalesce(F.col("parsed_data.device_id"), F.lit(None).cast(StringType())))
        .withColumn("timestamp", 
            F.coalesce(
                F.col("parsed_data.timestamp"),
                F.col("parsed_data.created_at"),
                F.current_timestamp()
            )
        )
        .withColumn("measurement_value", 
            F.coalesce(
                F.col("parsed_data.reading_value"),
                F.col("parsed_data.SPAD")
            )
        )
        .withColumn("measurement_type", 
            F.when(F.col("parsed_data.SPAD").isNotNull(), F.lit("SPAD"))
            .otherwise(F.col("parsed_data.sensor_type"))
        )
        .withColumn("md5_protocol", F.col("parsed_data.md5_protocol"))
        .withColumn("md5_measurement", F.col("parsed_data.md5_measurement"))
        .withColumn("protocol", F.coalesce(F.col("parsed_data.protocol"), F.lit("MQTT")))
        .withColumn("plant_name", F.col("parsed_data.plant_metadata.plant_name"))
        .withColumn("plant_genotype", F.col("parsed_data.plant_metadata.plant_genotype"))
        .withColumn("plant_id", F.col("parsed_data.plant_metadata.plant_id"))
        .withColumn("plant_location", F.col("parsed_data.plant_metadata.plant_location"))
        .withColumn("notes", F.col("parsed_data.plant_metadata.notes"))
    )

    # Apply watermarking and deduplication
    df = df.withWatermark("timestamp", "1 hour") \
        .dropDuplicates(["device_id", "timestamp", "kinesis_sequence_number"])

    return df.select(
        "topic",
        "experiment_id",
        "device_type",
        "device_version",
        "sensor_id",
        "timestamp",
        "measurement_type",
        "measurement_value",
        "md5_protocol",
        "md5_measurement",
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
        "ingestion_timestamp",
        "ingest_date",
        "kinesis_sequence_number",
        "kinesis_shard_id",
        "kinesis_arrival_time"
    )

# COMMAND ----------

# DBTITLE 1,Data Quality Monitoring
@dlt.table(
    name="bronze_data_quality",
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
    return dlt.read(BRONZE_TABLE)

# COMMAND ----------

# DBTITLE 1,Bronze Monitoring Table
@dlt.table(
    name="bronze_monitoring",
    comment="Monitoring metrics for bronze layer data by device and experiment"
)
def bronze_monitoring():
    """
    Create aggregated metrics to monitor data ingest by device and experiment.
    Useful for tracking data volumes and basic statistics.
    """
    return (
        dlt.read(BRONZE_TABLE)
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
@dlt.expect_or_fail("valid_timestamp", "timestamp IS NOT NULL")
@dlt.expect_or_fail("valid_device_id", "device_id IS NOT NULL")
def clean_data():
    """
    Transforms Bronze data into a cleaned Silver table with standardized values,
    quality checks, and enriched metadata.
    
    This Silver layer serves as the handoff point for experiment-specific schemas.
    """
    return (
        spark.readStream.table(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{BRONZE_TABLE}")
        .withColumn("processed_timestamp", F.current_timestamp())
        .withColumn("date", F.to_date("timestamp"))
        .withColumn("hour", F.hour("timestamp"))
        .withColumn("standardized_value", F.col("measurement_value"))
        .withColumn("standardized_unit", F.lit("SI"))
        
        # Deduplication using dropDuplicates
        .dropDuplicates(["device_id", "timestamp", "measurement_type"])
        
        # Enrich with quality flags
        .withColumn(
            "quality_check_passed", 
            (
                (F.col("device_battery") > 10) &  # Battery check
                (F.col("measurement_value").isNotNull()) &  # Value present
                (F.col("timestamp") > F.lit("2020-01-01"))  # Valid timestamp
            )
        )
        
        # Calculate data latency (time between reading and ingestion)
        .withColumn(
            "ingest_latency_ms", 
            F.unix_timestamp("ingestion_timestamp") - F.unix_timestamp("timestamp")
        )
        
        # Select final columns for silver layer
        .select(
            "device_id",
            "sensor_id",
            "experiment_id",
            "timestamp",
            "date",
            "hour",
            "measurement_type",
            "measurement_value",
            "md5_protocol",
            "md5_measurement",
            "standardized_value",
            "standardized_unit",
            "quality_check_passed",
            "device_type",
            "device_name",
            "device_battery",
            "device_firmware",
            "plant_id",
            "plant_name",
            "plant_genotype",
            "plant_location",
            "ingest_latency_ms",
            "processed_timestamp",
            "topic"
        )
    )

# COMMAND ----------

# DBTITLE 1,Gold Layer - Hourly Analytics
@dlt.table(
    name="hourly_analytics",
    comment="Gold layer: Hourly aggregated sensor metrics",
    table_properties={
        "quality": "gold"
    }
)
def hourly_analytics():
    """
    Creates hourly aggregations of sensor data for dashboards and analytics.
    This is part of the central Gold tier for operational analytics.
    """
    return (
        dlt.read(SILVER_TABLE)
        .where("quality_check_passed = true")  # Only include validated data
        .groupBy(
            "experiment_id",
            "date",
            "hour",
            "measurement_type",
            "device_type"
        )
        .agg(
            F.count("*").alias("reading_count"),
            F.avg("standardized_value").alias("avg_value"),
            F.min("standardized_value").alias("min_value"),
            F.max("standardized_value").alias("max_value"),
            F.stddev("standardized_value").alias("stddev_value"),
            F.expr("percentile(standardized_value, 0.95)").alias("p95_value"),
            F.avg("device_battery").alias("avg_battery_level"),
            F.min("ingest_latency_ms").alias("min_latency_ms"),
            F.max("ingest_latency_ms").alias("max_latency_ms"),
            F.avg("ingest_latency_ms").alias("avg_latency_ms")
        )
    )

# COMMAND ----------

# DBTITLE 1,Gold Layer - Daily Analytics
@dlt.table(
    name="daily_analytics",
    comment="Gold layer: Daily aggregated sensor metrics",
    table_properties={
        "quality": "gold"
    }
)
def daily_analytics():
    """
    Creates daily aggregations of sensor data for analytics dashboards.
    This is part of the central Gold tier for operational insights.
    """
    return (
        dlt.read(SILVER_TABLE)
        .where("quality_check_passed = true")  # Only include validated data
        .groupBy(
            "experiment_id",
            "date",
            "measurement_type",
            "device_type"
        )
        .agg(
            F.count("*").alias("reading_count"),
            F.avg("standardized_value").alias("avg_value"),
            F.min("standardized_value").alias("min_value"),
            F.max("standardized_value").alias("max_value"),
            F.stddev("standardized_value").alias("stddev_value"),
            F.avg("device_battery").alias("avg_battery_level"),
            F.countDistinct("device_id").alias("active_device_count")
        )
    )

# COMMAND ----------

# DBTITLE 1,Gold Layer - Device Health
@dlt.table(
    name="device_health",
    comment="Gold layer: Device health and performance metrics",
    table_properties={
        "quality": "gold"
    }
)
def device_health():
    """
    Creates device health analytics for monitoring and maintenance.
    Tracks battery levels, connectivity, and other device metrics.
    """
    return (
        dlt.read(SILVER_TABLE)
        .groupBy(
            "date",
            "device_id",
            "device_type",
            "experiment_id"
        )
        .agg(
            F.min("device_battery").alias("min_battery_level"),
            F.max("device_battery").alias("max_battery_level"),
            F.avg("device_battery").alias("avg_battery_level"),
            F.count("*").alias("reading_count"),
            F.avg("ingest_latency_ms").alias("avg_latency_ms"),
            F.max("processed_timestamp").alias("last_reading_time")
        )
        .withColumn(
            "battery_status",
            F.when(F.col("min_battery_level") < 10, "critical")
             .when(F.col("min_battery_level") < 25, "low")
             .otherwise("normal")
        )
    )

# COMMAND ----------

# DBTITLE 1,Data Quality Summary View
@dlt.view(
    name="data_quality_summary",
    comment="View summarizing data quality metrics across the central schema"
)
def data_quality_summary():
    """
    Creates a monitoring view that summarizes data quality metrics.
    """
    return (
        dlt.read(SILVER_TABLE)
        .groupBy("date", "experiment_id")
        .agg(
            F.count("*").alias("total_records"),
            F.sum(F.when(F.col("quality_check_passed") == True, 1).otherwise(0)).alias("valid_records"),
            F.sum(F.when(F.col("quality_check_passed") == False, 1).otherwise(0)).alias("invalid_records"),
            F.round(
                F.sum(F.when(F.col("quality_check_passed") == True, 1).otherwise(0)) / F.count("*") * 100, 
                2
            ).alias("valid_percentage")
        )
        .orderBy(F.desc("date"))
    )

# COMMAND ----------

# DBTITLE 1,Pipeline Metrics
@dlt.table(
    name="pipeline_metrics",
    comment="Pipeline operational metrics for monitoring",
    table_properties={
        "quality": "system"
    }
)
def pipeline_metrics():
    """
    Records operational metrics about the pipeline execution
    for monitoring and alerting purposes.
    """
    from datetime import datetime
    
    metrics_df = spark.createDataFrame([
        {
            "pipeline_name": "unified_pipeline",
            "execution_timestamp": datetime.now(),
            "central_schema": CENTRAL_SCHEMA,
            "bronze_table": BRONZE_TABLE,
            "silver_table": SILVER_TABLE,
            "status": "running"
        }
    ])
    
    return metrics_df