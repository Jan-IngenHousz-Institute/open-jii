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
DEVICE_TABLE = "device"
SAMPLE_TABLE = "sample"

print(f"Processing experiment: {EXPERIMENT_ID}")
print(f"Using experiment schema: {EXPERIMENT_SCHEMA}")
print(f"Reading from central schema: {CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}")

# COMMAND ----------

# DBTITLE 1,Device Table
@dlt.table(
    name=DEVICE_TABLE,
    comment="Device metadata from MultispeQ measurements",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true"
    }
)
def device():
    """Extract device metadata from central silver table filtered for MultispeQ data"""
    return (
        spark.readStream.table(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}")
        .filter(F.col("experiment_id") == EXPERIMENT_ID)  # Filter for specific experiment
        .filter(F.col("device_type") == "multispeq")  # Filter for MultispeQ devices
        .select(
            F.col("device_name"),
            F.col("device_version"),
            F.col("device_id"),
            F.col("device_battery"),
            F.col("device_firmware"),
            F.current_timestamp().alias("processed_timestamp")
        )
        .dropDuplicates(["device_id", "device_firmware"])
    )

# COMMAND ----------

# DLTITLE 1,Sample Table (Core Table)
@dlt.table(
    name=SAMPLE_TABLE,
    comment="Core sample table containing references to measurement sets",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.enableChangeDataFeed": "true"
    }
)
def sample():
    """Extract sample metadata and create references to measurement sets from central silver table"""
    return (
        spark.readStream.table(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}")
        .filter(F.col("experiment_id") == EXPERIMENT_ID)  # Filter for specific experiment
        .filter(F.col("device_type") == "multispeq")  # Filter for MultispeQ devices
        .select(
            F.col("device_id"),
            F.col("device_name"),
            F.explode(F.col("sample")).alias("sample_data")
        )
        .select(
            F.col("device_id"),
            F.col("device_name"),
            F.col("sample_data.v_arrays").alias("v_arrays"),
            F.col("sample_data.set_repeats").alias("set_repeats"),
            F.col("sample_data.protocol_id").alias("protocol_id"),
            F.col("sample_data.set").alias("measurement_sets"),
            F.hash(F.col("device_id"), F.col("sample_data")).alias("sample_id"),
            F.current_timestamp().alias("processed_timestamp")
        )
        .withColumn("measurement_set_types", 
            F.expr("transform(measurement_sets, x -> x.label)")
        )
    )
