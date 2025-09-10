"""
Databricks Delta Live Tables pipeline for processing ambyte trace files.
"""

import dlt
from pyspark.sql.types import StructType, StructField, TimestampType, IntegerType, FloatType, BooleanType, StringType, ArrayType
from pyspark.sql import SparkSession

import os

# Import the processing functions from the separate module
from ambyte_parsing import find_byte_folders, load_files_per_byte, process_trace_files

# Import volume I/O utilities
from volume_io import discover_and_validate_upload_directories, parse_upload_time


spark = SparkSession.builder.getOrCreate()

# Constants
YEAR_PREFIX = "2025"

# Define the schema for the output table
output_schema = StructType([
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

@dlt.table(
    name="raw_ambyte_data",
    comment="ambyte trace data processed from raw files stored in Databricks volume"
)
def ambyte_data():
    """
    Main DLT table-generating function that processes Ambyte trace files from a Databricks volume
    and creates a Delta table with the processed data.
    """
    # Configuration - specify the base path in the Databricks volume
    # This should be configured based on your actual volume mount point
    ambyte_base_path = "/Volumes/{CATALOG_NAME}/{SCHEMA_NAME}/data-uploads/ambyte"
    
    # Find all upload directories with the format upload_YYYYMMDD_SS
    upload_directories, success = discover_and_validate_upload_directories(ambyte_base_path)
    
    if not success or not upload_directories:
        # Return an empty dataframe with the correct schema if no upload directories are found
        return spark.createDataFrame([], schema=output_schema)
    
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
        return spark.createDataFrame([], schema=output_schema)
