# Databricks notebook source
# DBTITLE 1,OpenJII Experiment Pipeline
# Implementation of experiment-specific medallion architecture pipeline
# Processes data from central silver layer into experiment-specific bronze/silver/gold tables

# COMMAND ----------

import dlt
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.sql.types import StringType, TimestampType, DoubleType
from delta.tables import DeltaTable

# COMMAND ----------

# DBTITLE 1,Pipeline Configuration
# Runtime configuration parameters
EXPERIMENT_ID = spark.conf.get("EXPERIMENT_ID", "")  # Experiment identifier
EXPERIMENT_SCHEMA = spark.conf.get("EXPERIMENT_SCHEMA", "")  # Target schema for output
CATALOG_NAME = spark.conf.get("CATALOG_NAME", "open_jii_dev")
CENTRAL_SCHEMA = spark.conf.get("CENTRAL_SCHEMA", "centrum")
CENTRAL_SILVER_TABLE = spark.conf.get("CENTRAL_SILVER_TABLE", "clean_data")

# Output table names
BRONZE_TABLE = "bronze_data_exp"
SILVER_TABLE = "silver_data_exp"
GOLD_TABLE = "gold_data_exp"

print(f"Processing experiment: {EXPERIMENT_ID}")
print(f"Using experiment schema: {EXPERIMENT_SCHEMA}")
print(f"Reading from central schema: {CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}")

# COMMAND ----------

# DBTITLE 1,Bronze Layer - Experiment Data Extraction
@dlt.table(
    name=BRONZE_TABLE,
    comment=f"Bronze layer: Experiment-specific data for {EXPERIMENT_ID} from central Silver tier",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.enableChangeDataFeed": "true"
    }
)
def experiment_bronze():
    """
    Reads data from central schema Silver layer that matches the experiment ID.
    This creates an experiment-specific snapshot as the foundation for scientific analysis.
    """
    # Read from central Silver tier, filtering for this experiment only
    return (
        spark.readStream.table(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}")
        .filter(F.col("experiment_id") == EXPERIMENT_ID)
        .withColumn("experiment_import_timestamp", F.current_timestamp())
    )

# COMMAND ----------

# DBTITLE 1,Experiment Silver Layer - Specialized Processing
@dlt.table(
    name=SILVER_TABLE,
    comment=f"Silver layer: Experiment-specific processed data for {EXPERIMENT_ID}",
    table_properties={
        "quality": "silver",
        "pipelines.autoOptimize.managed": "true"
    }
)
@dlt.expect_or_fail("valid_measurement", "measurement_value IS NOT NULL")
def experiment_silver():
    """
    Applies experiment-specific transformations and quality checks.
    This is where scientific protocol-specific processing happens.
    """
    return (
        dlt.read(BRONZE_TABLE)
        # Add experiment-specific fields and transformations
        .withColumn("experiment_specific_flag", 
                   F.when(F.col("measurement_value") > 100, "high")
                    .when(F.col("measurement_value") < 0, "error")
                    .otherwise("normal"))
        
        # Apply experiment-specific quality check
        .withColumn("experiment_quality_check", 
                   (F.col("quality_check_passed") == True) & 
                   (F.col("measurement_value").between(-100, 1000)))
                   
        # Add processing metadata
        .withColumn("experiment_processed_timestamp", F.current_timestamp())
        .withColumn("experiment_process_date", F.to_date(F.col("experiment_processed_timestamp")))
    )

# COMMAND ----------

# DBTITLE 1,Experiment Gold Layer - Scientific Analytics
@dlt.table(
    name=GOLD_TABLE,
    comment=f"Gold layer: Experiment-specific analytics for {EXPERIMENT_ID}",
    table_properties={
        "quality": "gold"
    }
)
def experiment_gold():
    """
    Creates experiment-specific aggregations and metrics for scientific analysis.
    These are tailored to the scientific questions being investigated.
    """
    return (
        dlt.read(SILVER_TABLE)
        .where("experiment_quality_check = true")  # Use experiment-specific quality check
        .groupBy(
            "date",
            "device_id",
            "sensor_id",
            "plant_id",
            "measurement_type"
        )
        .agg(
            # Standard aggregations
            F.count("*").alias("reading_count"),
            F.avg("standardized_value").alias("avg_value"),
            F.min("standardized_value").alias("min_value"),
            F.max("standardized_value").alias("max_value"),
            F.stddev("standardized_value").alias("stddev_value"),
            
            # Experiment-specific metrics
            F.expr("percentile(standardized_value, 0.95)").alias("p95_value"),
            F.expr("percentile(standardized_value, 0.05)").alias("p05_value"),
            
            # Count by experiment-specific flag
            F.sum(F.when(F.col("experiment_specific_flag") == "high", 1).otherwise(0)).alias("high_value_count"),
            F.sum(F.when(F.col("experiment_specific_flag") == "error", 1).otherwise(0)).alias("error_value_count")
        )
    )

# COMMAND ----------

# DBTITLE 1,Experiment Daily Trends
@dlt.table(
    name="daily_trends",
    comment=f"Gold layer: Daily trends for experiment {EXPERIMENT_ID}",
    table_properties={
        "quality": "gold" 
    }
)
def daily_trends():
    """
    Creates experiment-specific daily trend analysis
    """
    return (
        dlt.read(SILVER_TABLE)
        .where("experiment_quality_check = true")
        .groupBy("date", "device_type", "measurement_type")
        .agg(
            F.count("*").alias("reading_count"),
            F.avg("standardized_value").alias("daily_avg"),
            F.max("standardized_value").alias("daily_max"),
            F.min("standardized_value").alias("daily_min")
        )
    )

# COMMAND ----------

# DBTITLE 1,Experiment Status
@dlt.table(
    name="experiment_status",
    comment=f"System table: Processing status for experiment {EXPERIMENT_ID}",
    table_properties={
        "quality": "system"
    }
)
def experiment_status():
    """
    Tracking table for experiment processing status
    """
    from datetime import datetime
    
    status_df = spark.createDataFrame([
        {
            "experiment_id": EXPERIMENT_ID,
            "experiment_schema": EXPERIMENT_SCHEMA,
            "pipeline_name": "experiment_pipeline",
            "execution_timestamp": datetime.now(),
            "source_schema": CENTRAL_SCHEMA,
            "source_table": CENTRAL_SILVER_TABLE,
            "status": "completed"
        }
    ])
    
    return status_df