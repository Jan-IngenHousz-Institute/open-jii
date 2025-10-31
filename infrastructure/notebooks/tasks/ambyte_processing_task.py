# Databricks notebook source
# DBTITLE 1,Ambyte Data Processing Task
# Standalone task to process raw ambyte trace files and write to parquet
# This task runs independently from the DLT pipeline and outputs processed parquet files

# COMMAND ----------

# DBTITLE 1,Install Dependencies
%pip install /Workspace/Shared/wheels/ambyte-0.2.0-py3-none-any.whl

# COMMAND ----------

# DBTITLE 1,Imports
import os
import pandas as pd
import numpy as np
from datetime import datetime
from pyspark.sql import SparkSession
from pyspark.dbutils import DBUtils

# Import the ambyte processing utilities
from ambyte import find_byte_folders, load_files_per_byte, process_trace_files, parse_upload_time

# COMMAND ----------

# DBTITLE 1,Configuration
EXPERIMENT_ID = dbutils.widgets.get("EXPERIMENT_ID")
EXPERIMENT_SCHEMA = dbutils.widgets.get("EXPERIMENT_SCHEMA")
CATALOG_NAME = dbutils.widgets.get("CATALOG_NAME")
UPLOAD_DIRECTORY = dbutils.widgets.get("UPLOAD_DIRECTORY")  # e.g., "upload_20250131_01"
YEAR_PREFIX = dbutils.widgets.get("YEAR_PREFIX", "2025")

# Paths
AMBYTE_BASE_PATH = f"/Volumes/{CATALOG_NAME}/{EXPERIMENT_SCHEMA}/data-uploads/ambyte"
PROCESSED_OUTPUT_PATH = f"/Volumes/{CATALOG_NAME}/{EXPERIMENT_SCHEMA}/processed-ambyte"

spark = SparkSession.builder.getOrCreate()
dbutils = DBUtils(spark)

print(f"Processing ambyte data for experiment: {EXPERIMENT_ID}")
print(f"Upload directory: {UPLOAD_DIRECTORY}")
print(f"Input path: {AMBYTE_BASE_PATH}/{UPLOAD_DIRECTORY}")
print(f"Output path: {PROCESSED_OUTPUT_PATH}/{UPLOAD_DIRECTORY}")

# COMMAND ----------

# DBTITLE 1,Process Ambyte Data
def process_and_save_ambyte_data():
    """
    Process raw ambyte trace files for a specific upload directory and save as parquet files.
    Preserves all data including dataframe attributes as columns.
    """
    # Construct full path to the specific upload directory
    upload_dir = f"{AMBYTE_BASE_PATH}/{UPLOAD_DIRECTORY}"
    
    # Verify the upload directory exists
    try:
        dbutils.fs.ls(upload_dir)
    except Exception as e:
        raise Exception(f"Upload directory not found: {upload_dir}. Error: {e}")
    
    print(f"\n{'='*80}")
    print(f"Processing upload directory: {UPLOAD_DIRECTORY}")
    print(f"Full path: {upload_dir}")
    print(f"{'='*80}")
    
    processed_count = 0
    error_count = 0
    
    # Parse upload time from directory name
    upload_time = parse_upload_time(UPLOAD_DIRECTORY)
    
    # Find all Ambyte_N and unknown_ambyte folders within this upload directory
    try:
        byte_parent_folders = find_byte_folders(upload_dir)
        
        if byte_parent_folders:
            print(f"Found {len(byte_parent_folders)} valid byte parent folders")
            print(f"Folders: {[os.path.basename(x.rstrip('/')) for x in byte_parent_folders]}")
        else:
            print(f"No valid byte parent folders found in {UPLOAD_DIRECTORY}")
            raise Exception(f"No valid byte parent folders found in {upload_dir}")
            
    except Exception as e:
        print(f"Error finding byte folders in {UPLOAD_DIRECTORY}: {e}")
        raise
    
    # Process each byte folder within this upload directory
    for ambyte_folder in byte_parent_folders:
        ambyte_folder_name = os.path.basename(ambyte_folder.rstrip('/'))
        
        try:
            # Load files from byte subfolders or unknown_ambit
            files_per_byte, _ = load_files_per_byte(ambyte_folder, year_prefix=YEAR_PREFIX)
            files_per_byte = [lst for lst in files_per_byte if lst]
            
            print(f"\nProcessing {ambyte_folder_name}: {len(files_per_byte)} ambit(s)")
            
            # Process trace files
            df = process_trace_files(ambyte_folder_name, files_per_byte)
            
            if df is not None:
                # Reset index to make Time a regular column
                df = df.reset_index()
                
                # Extract attributes and add as columns
                # The attrs dict contains metadata like 'Actinic' and 'Dark'
                if hasattr(df, 'attrs') and df.attrs:
                    print(f"Found dataframe attributes: {df.attrs.keys()}")
                    for attr_key, attr_value in df.attrs.items():
                        col_name = f"meta_{attr_key}"
                        if col_name not in df.columns:
                            df[col_name] = attr_value
                            print(f"Added attribute as column: {col_name} = {attr_value}")
                
                # Add upload directory info
                df['upload_directory'] = UPLOAD_DIRECTORY
                
                # Add upload time
                if upload_time is not None:
                    df['upload_time'] = upload_time
                else:
                    df['upload_time'] = None
                
                # Add processing timestamp
                df['processed_at'] = pd.Timestamp.now()
                
                # Ensure data types are Spark-compatible
                # Convert pandas nullable types to standard types for Spark
                for col in df.columns:
                    if hasattr(df[col].dtype, 'name'):
                        dtype_name = df[col].dtype.name
                        # Convert pandas nullable integer types to standard int32
                        if 'UInt16' in dtype_name:
                            df[col] = df[col].astype('Int32')
                        elif 'UInt8' in dtype_name:
                            df[col] = df[col].astype('Int32')
                        elif 'Int16' in dtype_name:
                            df[col] = df[col].astype('Int32')
                        # Convert pandas nullable float types to standard float32
                        elif 'Float32' in dtype_name:
                            df[col] = df[col].astype('float32')
                        # Convert categorical to string
                        elif df[col].dtype.name == 'category':
                            df[col] = df[col].astype(str)
                
                # Create output directory structure
                output_dir = f"{PROCESSED_OUTPUT_PATH}/{UPLOAD_DIRECTORY}/{ambyte_folder_name}"
                
                # Ensure directory exists
                try:
                    dbutils.fs.mkdirs(output_dir)
                except Exception:
                    pass  # Directory might already exist
                
                # Save as parquet
                output_path = f"{output_dir}/data.parquet"
                
                # Convert to Spark DataFrame and write as parquet
                spark_df = spark.createDataFrame(df)
                spark_df.write.mode("overwrite").parquet(output_path)
                
                print(f"✓ Saved: {output_path}")
                print(f"  Rows: {len(df):,}")
                print(f"  Columns: {len(df.columns)}")
                processed_count += 1
                
            else:
                print(f"✗ No data returned from process_trace_files for {ambyte_folder_name}")
                error_count += 1
                
        except Exception as e:
            print(f"✗ Error processing {ambyte_folder_name}: {e}")
            import traceback
            traceback.print_exc()
            error_count += 1
    
    # Summary
    print(f"\n{'='*80}")
    print(f"Processing Summary for {UPLOAD_DIRECTORY}:")
    print(f"  Processed: {processed_count} ambyte folder(s)")
    print(f"  Errors: {error_count}")
    print(f"{'='*80}")
    
    if error_count > 0 and processed_count == 0:
        raise Exception(f"All ambyte processing failed for {UPLOAD_DIRECTORY} ({error_count} errors)")
    
    return processed_count, error_count

# COMMAND ----------

# DBTITLE 1,Execute Processing
processed, errors = process_and_save_ambyte_data()

# Return status for task tracking
dbutils.notebook.exit({
    "status": "success" if processed > 0 else "no_data",
    "processed_count": processed,
    "error_count": errors
})
