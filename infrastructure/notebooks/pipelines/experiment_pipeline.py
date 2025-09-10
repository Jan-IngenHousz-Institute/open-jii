# Databricks notebook source
# DBTITLE 1,OpenJII Experiment Pipeline
# Implementation of experiment-specific medallion architecture pipeline
# Processes data from central silver layer into experiment-specific bronze/silver/gold tables
# Includes raw ambyte data processing capabilities

# COMMAND ----------

import dlt
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.sql.types import StringType, TimestampType, DoubleType, StructType, StructField, IntegerType, FloatType, BooleanType, ArrayType
from pyspark.sql import SparkSession
from delta.tables import DeltaTable
import os
import sys
import pandas as pd

sys.path.append("/Workspace/Shared/lib")

# Import the processing functions from the separate module
from ambyte_parsing import find_byte_folders, load_files_per_byte, process_trace_files

# Import volume I/O utilities
from volume_io import discover_and_validate_upload_directories, parse_upload_time

# COMMAND ----------

# DBTITLE 1,Pipeline Configuration
# Runtime configuration parameters
EXPERIMENT_ID = spark.conf.get("EXPERIMENT_ID", "")  # Experiment identifier
EXPERIMENT_SCHEMA = spark.conf.get("EXPERIMENT_SCHEMA", "")  # Target schema for output
CATALOG_NAME = spark.conf.get("CATALOG_NAME", "open_jii_dev")
CENTRAL_SCHEMA = spark.conf.get("CENTRAL_SCHEMA", "centrum")
CENTRAL_SILVER_TABLE = spark.conf.get("CENTRAL_SILVER_TABLE", "clean_data")

# Constants for ambyte processing
YEAR_PREFIX = "2025"

# Output table names
BRONZE_TABLE = "bronze_data_exp"
SILVER_TABLE = "silver_data_exp"
GOLD_TABLE = "gold_data_exp"
RAW_AMBYTE_TABLE = "raw_ambyte_data"

spark = SparkSession.builder.getOrCreate()

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

# COMMAND ----------

# DBTITLE 1,Raw Ambyte Data Table Schema
# Define the schema for the raw ambyte data table
raw_ambyte_schema = StructType([
    StructField("Time", TimestampType(), False),
    StructField("SigF", IntegerType(), True),
    StructField("RefF", IntegerType(), True),
    StructField("Sun", IntegerType(), True),
    StructField("Leaf", IntegerType(), True),
    StructField("Sig7", IntegerType(), True),
    StructField("Ref7", IntegerType(), True),
    StructField("Actinic", IntegerType(), True),
    StructField("Temp", FloatType(), True),
    StructField("Res", IntegerType(), True),
    StructField("Full", BooleanType(), True),
    StructField("Type", StringType(), True),
    StructField("Count", IntegerType(), True),
    StructField("PTS", IntegerType(), True),
    StructField("PAR", FloatType(), True),
    StructField("raw", FloatType(), True),
    StructField("spec", ArrayType(IntegerType()), True),
    StructField("BoardT", FloatType(), True),
    StructField("ambyte_folder", StringType(), True),
    StructField("ambit_index", IntegerType(), True),
    StructField("meta_Actinic", FloatType(), True),
    StructField("meta_Dark", IntegerType(), True),
    StructField("upload_directory", StringType(), True),
    StructField("upload_time", TimestampType(), True)
])
# COMMAND ----------

# DBTITLE 1,Raw Ambyte Data Table
@dlt.table(
    name=RAW_AMBYTE_TABLE,
    comment="ambyte trace data processed from raw files stored in Databricks volume"
)
def raw_ambyte_data():
    """
    Main DLT table-generating function that processes Ambyte trace files from a Databricks volume
    and creates a Delta table with the processed data.
    """
    # Configuration - specify the base path in the Databricks volume
    # This should be configured based on your actual volume mount point
    ambyte_base_path = f"/Volumes/{CATALOG_NAME}/{EXPERIMENT_SCHEMA}/data-uploads/ambyte"
    
    # Find all upload directories with the format upload_YYYYMMDD_SS
    upload_directories, success = discover_and_validate_upload_directories(ambyte_base_path)
    
    if not success or not upload_directories:
        # Return an empty dataframe with the correct schema if no upload directories are found
        return spark.createDataFrame([], schema=raw_ambyte_schema)
    
    # Process each upload directory
    all_data = []
    
    for upload_dir in upload_directories:
        upload_dir_name = os.path.basename(upload_dir)
        print(f"Processing upload directory: {upload_dir_name}")
        
        # Parse upload time from directory name
        upload_time = parse_upload_time(upload_dir_name)
        
        # Find all Ambyte_N and unknown_ambyte folders within this upload directory
        # Each of these folders should contain either 1-4 subfolders or unknown_ambit subfolder
        try:
            # Use the existing find_byte_folders function to discover valid byte parent folders
            byte_parent_folders = find_byte_folders(upload_dir)
            
            if byte_parent_folders:
                print(f"Found {len(byte_parent_folders)} valid byte parent folders in {upload_dir_name}")
                print(f"Byte parent folders: {[os.path.basename(x.rstrip('/')) for x in byte_parent_folders]}")
            else:
                print(f"No valid byte parent folders found in {upload_dir_name}")
                continue
                
        except Exception as e:
            print(f"Error finding byte folders in {upload_dir_name}: {e}")
            continue
        
        # Process each byte folder within this upload directory
        for ambyte_folder in byte_parent_folders:
            ambyte_folder_name = os.path.basename(ambyte_folder.rstrip('/'))
            
            # Load files from byte subfolders or unknown_ambit
            files_per_byte, _ = load_files_per_byte(ambyte_folder, year_prefix=YEAR_PREFIX)
            files_per_byte = [lst for lst in files_per_byte if lst]
            
            print(f"Loaded files for {ambyte_folder_name} in {upload_dir_name}: {len(files_per_byte)}")
            
            # Process trace files
            df = process_trace_files(ambyte_folder_name, files_per_byte)
            
            if df is not None:
                # Convert pandas DataFrame to Spark DataFrame
                try:
                    # Reset index to make Time a regular column
                    df = df.reset_index()
                    
                    # Add upload directory info to the dataframe
                    df['upload_directory'] = upload_dir_name
                    
                    # Add upload time to the dataframe (convert to pandas timestamp first)
                    if upload_time is not None:
                        df['upload_time'] = upload_time
                    else:
                        df['upload_time'] = None
                    
                    # Convert pandas DataFrame to Spark DataFrame
                    spark_df = spark.createDataFrame(df)
                    
                    all_data.append(spark_df)
                except Exception as e:
                    print(f"Error converting DataFrame to Spark DataFrame for {ambyte_folder_name} in {upload_dir_name}: {e}")
    
    # Combine all spark dataframes if any were created
    if all_data:
        return all_data[0] if len(all_data) == 1 else all_data[0].unionAll(*all_data[1:])
    else:
        return spark.createDataFrame([], schema=raw_ambyte_schema)
