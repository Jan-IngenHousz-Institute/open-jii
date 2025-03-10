import dlt
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.sql.types import StringType, TimestampType, MapType, ArrayType
from delta.tables import DeltaTable

# Configuration constants
CENTRAL_SCHEMA = "centrum"  # Central schema name
BRONZE_TABLE = "raw_data"   # Bronze table created by ingest_pipeline.py
SILVER_TABLE = "clean_data" # Silver tier table
GOLD_TABLE = "analytics_data" # Gold tier aggregations

# Unit conversion dictionary for standardizing measurement units
UNIT_CONVERSIONS = {
    "celsius": {"fahrenheit": lambda x: (x * 9/5) + 32},
    "fahrenheit": {"celsius": lambda x: (x - 32) * 5/9},
    "kPa": {"hPa": lambda x: x * 10},
    "hPa": {"kPa": lambda x: x / 10},
    # Add more conversions as needed
}

# Silver Layer: Cleaned and standardized data
@dlt.table(
    name=SILVER_TABLE,
    schema=CENTRAL_SCHEMA,
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
        # Read from Bronze layer
        dlt.read(f"{CENTRAL_SCHEMA}.{BRONZE_TABLE}")
        
        # Standardize timestamp formats
        .withColumn("processed_timestamp", F.current_timestamp())
        .withColumn("date", F.to_date("timestamp"))
        .withColumn("hour", F.hour("timestamp"))
        
        # Apply unit standardization where needed
        .withColumn("standardized_value", F.col("measurement_value"))
        .withColumn("standardized_unit", F.lit("SI"))  # Default to SI units
        
        # Deduplicate records (using window function to keep latest by device and timestamp)
        .withColumn(
            "row_number", 
            F.row_number().over(
                Window.partitionBy("device_id", "timestamp", "measurement_type")
                .orderBy(F.desc("ingest_timestamp"))
            )
        )
        .filter(F.col("row_number") == 1)
        .drop("row_number")
        
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
            F.unix_timestamp("ingest_timestamp") - F.unix_timestamp("timestamp")
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

# Gold Layer: Hourly aggregations for analytics
@dlt.table(
    name="hourly_analytics",
    schema=CENTRAL_SCHEMA,
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
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
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

# Gold Layer: Daily aggregations for analytics
@dlt.table(
    name="daily_analytics",
    schema=CENTRAL_SCHEMA,
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
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
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

# Gold Layer: Device health metrics
@dlt.table(
    name="device_health",
    schema=CENTRAL_SCHEMA,
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
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
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

# Experiment registry update
@dlt.table(
    name="experiment_status_updates",
    schema=CENTRAL_SCHEMA,
    comment="Updates to experiment registry tracking data freshness",
    temporary=True
)
def experiment_status_updates():
    """
    Creates a temporary table with experiment status updates based on new data.
    This drives the event-driven processing of experiment-specific pipelines.
    """
    # Get latest data timestamp by experiment
    latest_data = (
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
        .groupBy("experiment_id")
        .agg(
            F.max("timestamp").alias("last_data_arrival_timestamp"),
            F.count("*").alias("new_records_count")
        )
        .filter("experiment_id IS NOT NULL")
    )
    
    return latest_data

# Final view for monitoring
@dlt.view(
    name="data_quality_summary",
    schema=CENTRAL_SCHEMA,
    comment="View summarizing data quality metrics across the central schema"
)
def data_quality_summary():
    """
    Creates a monitoring view that summarizes data quality metrics.
    """
    return (
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
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

# Experiment freshness status view - used for orchestration
@dlt.view(
    name="experiment_freshness",
    schema=CENTRAL_SCHEMA,
    comment="View showing experiment data freshness status"
)
def experiment_freshness():
    """
    Provides a view of experiment data freshness to drive pipeline orchestration.
    """
    return (
        dlt.read(f"{CENTRAL_SCHEMA}.experiment_status_updates")
        .withColumn("status_update_time", F.current_timestamp())
        .withColumn("readings_status", F.lit("stale"))
        .select(
            "experiment_id", 
            "last_data_arrival_timestamp", 
            "new_records_count",
            "status_update_time",
            "readings_status"
        )
    )

# Gold Layer: Hourly aggregations for analytics
@dlt.table(
    name="hourly_analytics",
    schema=CENTRAL_SCHEMA,
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
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
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

# Gold Layer: Daily aggregations for analytics
@dlt.table(
    name="daily_analytics",
    schema=CENTRAL_SCHEMA,
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
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
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

# Gold Layer: Device health metrics
@dlt.table(
    name="device_health",
    schema=CENTRAL_SCHEMA,
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
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
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

# Experiment registry update
@dlt.table(
    name="experiment_status_updates",
    schema=CENTRAL_SCHEMA,
    comment="Updates to experiment registry tracking data freshness",
    temporary=True
)
def experiment_status_updates():
    """
    Creates a temporary table with experiment status updates based on new data.
    This drives the event-driven processing of experiment-specific pipelines.
    """
    # Get latest data timestamp by experiment
    latest_data = (
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
        .groupBy("experiment_id")
        .agg(
            F.max("timestamp").alias("last_data_arrival_timestamp"),
            F.count("*").alias("new_records_count")
        )
        .filter("experiment_id IS NOT NULL")
    )
    
    return latest_data

# Final view for monitoring
@dlt.view(
    name="data_quality_summary",
    schema=CENTRAL_SCHEMA,
    comment="View summarizing data quality metrics across the central schema"
)
def data_quality_summary():
    """
    Creates a monitoring view that summarizes data quality metrics.
    """
    return (
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
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

# Experiment freshness status view - used for orchestration
@dlt.view(
    name="experiment_freshness",
    schema=CENTRAL_SCHEMA,
    comment="View showing experiment data freshness status"
)
def experiment_freshness():
    """
    Provides a view of experiment data freshness to drive pipeline orchestration.
    """
    return (
        dlt.read(f"{CENTRAL_SCHEMA}.experiment_status_updates")
        .withColumn("status_update_time", F.current_timestamp())
        .withColumn("readings_status", F.lit("stale"))
        .select(
            "experiment_id", 
            "last_data_arrival_timestamp", 
            "new_records_count",
            "status_update_time",
            "readings_status"
        )
    )

# Gold Layer: Hourly aggregations for analytics
@dlt.table(
    name="hourly_analytics",
    schema=CENTRAL_SCHEMA,
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
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
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

# Gold Layer: Daily aggregations for analytics
@dlt.table(
    name="daily_analytics",
    schema=CENTRAL_SCHEMA,
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
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
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

# Gold Layer: Device health metrics
@dlt.table(
    name="device_health",
    schema=CENTRAL_SCHEMA,
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
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
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

# Experiment registry update
@dlt.table(
    name="experiment_status_updates",
    schema=CENTRAL_SCHEMA,
    comment="Updates to experiment registry tracking data freshness",
    temporary=True
)
def experiment_status_updates():
    """
    Creates a temporary table with experiment status updates based on new data.
    This drives the event-driven processing of experiment-specific pipelines.
    """
    # Get latest data timestamp by experiment
    latest_data = (
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
        .groupBy("experiment_id")
        .agg(
            F.max("timestamp").alias("last_data_arrival_timestamp"),
            F.count("*").alias("new_records_count")
        )
        .filter("experiment_id IS NOT NULL")
    )
    
    return latest_data

# Final view for monitoring
@dlt.view(
    name="data_quality_summary",
    schema=CENTRAL_SCHEMA,
    comment="View summarizing data quality metrics across the central schema"
)
def data_quality_summary():
    """
    Creates a monitoring view that summarizes data quality metrics.
    """
    return (
        dlt.read(f"{CENTRAL_SCHEMA}.{SILVER_TABLE}")
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

# Experiment freshness status view - used for orchestration
@dlt.view(
    name="experiment_freshness",
    schema=CENTRAL_SCHEMA,
    comment="View showing experiment data freshness status"
)
def experiment_freshness():
    """
    Provides a view of experiment data freshness to drive pipeline orchestration.
    """
    return (
        dlt.read(f"{CENTRAL_SCHEMA}.experiment_status_updates")
        .withColumn("status_update_time", F.current_timestamp())
        .withColumn("readings_status", F.lit("stale"))
        .select(
            "experiment_id", 
            "last_data_arrival_timestamp", 
            "new_records_count",
            "status_update_time",
            "readings_status"
        )
    )