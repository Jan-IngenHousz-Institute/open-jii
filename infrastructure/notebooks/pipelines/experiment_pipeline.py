# Databricks notebook source
# DBTITLE 1,OpenJII Experiment Pipeline
# Implementation of experiment-specific medallion architecture pipeline
# Processes data from central silver layer into experiment-specific bronze/silver/gold tables

%pip install /Workspace/Shared/wheels/multispeq-0.1.0-py3-none-any.whl
%pip install /Workspace/Shared/wheels/mini_racer-0.12.4-py3-none-manylinux_2_31_x86_64.whl

# COMMAND ----------

import dlt
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.sql.types import StringType, TimestampType, DoubleType, StructType, StructField, IntegerType, FloatType, BooleanType, ArrayType, MapType
from pyspark.sql import SparkSession
from pyspark.sql.functions import pandas_udf
from delta.tables import DeltaTable
import pandas as pd
import os
import json
import sys
from typing import Dict, Any, List

# Import the ambyte processing utilities
from ambyte_parsing import find_byte_folders, load_files_per_byte, process_trace_files
# Import volume I/O utilities
from volume_io import discover_and_validate_upload_directories, parse_upload_time

# Import our macro processing library
from multispeq import execute_macro_script, get_available_macros, process_macro_output_for_spark, infer_macro_schema

# COMMAND ----------

# DBTITLE 1,Pipeline Configuration
EXPERIMENT_ID = spark.conf.get("EXPERIMENT_ID", "")  # Experiment identifier
EXPERIMENT_SCHEMA = spark.conf.get("EXPERIMENT_SCHEMA", "")  # Target schema for output
CATALOG_NAME = spark.conf.get("CATALOG_NAME", "open_jii_dev")
CENTRAL_SCHEMA = spark.conf.get("CENTRAL_SCHEMA", "centrum")
CENTRAL_SILVER_TABLE = spark.conf.get("CENTRAL_SILVER_TABLE", "clean_data")

# Constants for ambyte processing
YEAR_PREFIX = "2025"

# Macro processing configuration
MACROS_PATH = "/Workspace/Shared/macros"  # Path to macro scripts
ENABLE_MACRO_PROCESSING = spark.conf.get("ENABLE_MACRO_PROCESSING", "true").lower() == "true"

# Output table names
DEVICE_TABLE = "device"
SAMPLE_TABLE = "sample"
RAW_AMBYTE_TABLE = "raw_ambyte_data"

spark = SparkSession.builder.getOrCreate()

print(f"Processing experiment: {EXPERIMENT_ID}")
print(f"Using experiment schema: {EXPERIMENT_SCHEMA}")
print(f"Reading from central schema: {CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}")
print(f"Macro processing enabled: {ENABLE_MACRO_PROCESSING}")
if ENABLE_MACRO_PROCESSING:
    print(f"Macros path: {MACROS_PATH}")

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
    df = (
        spark.read.table("open_jii_dev.centrum.clean_data")
        .filter(F.col("experiment_id") == EXPERIMENT_ID)
        .select(
            F.col("device_name"),
            F.col("device_version"),
            F.col("device_id"),
            F.col("device_battery"),
            F.col("device_firmware"),
            F.col("processed_timestamp")
        )
    )
    return (
        df.groupBy("device_id", "device_firmware")
          .agg(
              F.max("device_name").alias("device_name"),
              F.max("device_version").alias("device_version"),
              F.max("device_battery").alias("device_battery"),
              F.max("processed_timestamp").alias("processed_timestamp")
          )
    )

# COMMAND ----------

# DBTITLE 1,Sample Table (Core Table)
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
    base_df = (
        spark.readStream.table(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}")
        .filter(F.col("experiment_id") == EXPERIMENT_ID)  # Filter for specific experiment
    )
    
    # Process sample data and include user_answers columns directly
    return (
        base_df
        .select(
            F.col("device_id"),
            F.col("device_name"),
            F.col("timestamp"),
            F.col("plot_number"),
            F.col("plant"),
            F.col("stem_count"),
            F.explode(F.from_json(F.col("sample"), "array<string>")).alias("sample_data_str")
        )
        .select(
            F.col("device_id"),
            F.col("device_name"),
            F.col("timestamp"),
            F.col("plot_number"),
            F.col("plant"),
            F.col("stem_count"),
            F.get_json_object(F.col("sample_data_str"), "$.v_arrays").alias("v_arrays"),
            F.get_json_object(F.col("sample_data_str"), "$.set_repeats").cast("int").alias("set_repeats"),
            F.get_json_object(F.col("sample_data_str"), "$.protocol_id").alias("protocol_id"),
            F.get_json_object(F.col("sample_data_str"), "$.macros").alias("macros"),
            F.when(F.get_json_object(F.col("sample_data_str"), "$.set").isNotNull(), 
                   F.from_json(F.get_json_object(F.col("sample_data_str"), "$.set"), "array<string>"))
            .otherwise(
                # Extract all fields except v_arrays, set_repeats, and protocol_id as JSON strings
                F.expr("""
                    transform(
                        filter(
                            map_keys(from_json(sample_data_str, 'map<string,string>')),
                            key -> key NOT IN ('v_arrays', 'set_repeats', 'protocol_id')
                        ),
                        key -> to_json(map(key, get_json_object(sample_data_str, concat('$.', key))))
                    )
                """)
            ).alias("measurement_sets"),
            F.abs(
                F.hash(
                    F.lit(EXPERIMENT_ID),
                    F.col("device_id"),
                    F.col("sample_data_str")
                )
            ).alias("sample_id"),
            F.current_timestamp().alias("processed_timestamp")
        )
        .withColumn("measurement_set_types", 
            F.when(F.col("measurement_sets").isNotNull(),
                   F.when(F.expr("size(filter(transform(measurement_sets, x -> get_json_object(x, '$.label')), label -> label is not null)) > 0"),
                          F.expr("transform(measurement_sets, x -> get_json_object(x, '$.label'))"))
                   .otherwise(F.lit(None)))
            .otherwise(F.array())
        )
    )

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

# COMMAND ----------

# DBTITLE 1,Macro Processing Pipeline
def create_macro_tables():
    """
    Create DLT tables for each macro found in the experiment data.
    This function analyzes macro outputs to generate proper schemas.
    """
    if not ENABLE_MACRO_PROCESSING:
        return [], [], {}
    
    try:
        # Get all macros used in the experiment
        macros_df = (
            spark.read.table(
                f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}"
            )
            .filter(F.col("experiment_id") == EXPERIMENT_ID)
            .filter(F.col("macros").isNotNull())
            .filter(F.size(F.col("macros")) > 0)
            .select(F.explode(F.col("macros")).alias("macro_name"))
            .distinct()
        )
        
        # Get a sample row for schema inference
        sample_row = (
            spark.read.table(
                f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}"
            )
            .filter(F.col("experiment_id") == EXPERIMENT_ID)
            .filter(F.col("macros").isNotNull())
            .filter(F.size(F.col("macros")) > 0)
            .first()
        )
        
        available_macros = get_available_macros(MACROS_PATH)
        experiment_macros = [row.macro_name for row in macros_df.collect()]
        
        print(f"Available macros: {available_macros}")
        print(f"Macros used in experiment: {experiment_macros}")
        
        # Generate schemas for each macro
        macro_schemas = {}
        if sample_row:
            # Prepare sample data for macro execution
            sample_data = {
                "device_id": sample_row["device_id"],
                "device_name": sample_row["device_name"],
                "experiment_id": sample_row["experiment_id"],
                "sample": sample_row["sample"],
                "macros": sample_row["macros"],
            }
            sample_data = {k: v for k, v in sample_data.items() if v is not None}
            
            print("Inferring schemas for macros using sample data...")
            for macro_name in experiment_macros:
                if macro_name in available_macros:
                    print(f"Inferring schema for macro: {macro_name}")
                    schema = infer_macro_schema(macro_name, sample_data, MACROS_PATH)
                    if schema:
                        macro_schemas[macro_name] = schema
                        print(f"Schema for {macro_name}: {len(schema.fields)} fields")
                    else:
                        print(f"Warning: Could not infer schema for macro {macro_name}")
                else:
                    print(f"Warning: Macro {macro_name} referenced in data but script not found")
        else:
            print("Warning: No sample data found for schema inference")
        
        return experiment_macros, available_macros, macro_schemas
    except Exception as e:
        print(f"Error reading macros from central table: {str(e)}")
        return [], [], {}

def create_macro_table_code(macro_name: str, macro_schema: StructType) -> str:
    """
    Generate Python code for a macro streaming table function.
    UDF returns JSON string, then we parse it using the inferred StructType schema.
    """
    # Base schema for the UDF output (just the essential fields + JSON)
    udf_schema = (
        "device_id string, device_name string, plot_number int, plant string, stem_count int, "
        "processed_timestamp timestamp, macro_output_json string"
    )
    
    # Convert StructType to a string representation for the exec'd code
    schema_str = str(macro_schema)
    
    return f'''
@dlt.table(
    name="macro_{macro_name}",
    comment="Output from macro: {macro_name}",
    table_properties={{
        "quality": "silver",
        "pipelines.autoOptimize.managed": "true"
    }}
)
def macro_{macro_name}_table():
    base_df = (
        spark.readStream.table(f"{{CATALOG_NAME}}.{{CENTRAL_SCHEMA}}.{{CENTRAL_SILVER_TABLE}}")
        .filter(F.col("experiment_id") == EXPERIMENT_ID)
        .filter(F.array_contains(F.col("macros"), "{macro_name}"))
    )

    @pandas_udf("{udf_schema}")
    def process_macro_udf(pdf: pd.DataFrame) -> pd.DataFrame:
        import json
        import pandas as pd
        results = []
        for _, row in pdf.iterrows():
            input_data = {{
                "device_id": row.get("device_id"),
                "device_name": row.get("device_name"),
                "experiment_id": row.get("experiment_id"),
                "sample": row.get("sample"),
                "macros": row.get("macros"),
            }}
            input_data = {{k: v for k, v in input_data.items() if v is not None}}
            try:
                raw_macro_output = execute_macro_script("{macro_name}", input_data, MACROS_PATH)
                if raw_macro_output is not None:
                    macro_output = process_macro_output_for_spark(raw_macro_output)
                    debug_str = json.dumps(macro_output)
                else:
                    debug_str = "None"
            except Exception as e:
                macro_output = {{}}
                debug_str = f"error: {{str(e)}}"
            
            # Create result row with base fields only
            result_row = {{
                "device_id": row.get("device_id"),
                "device_name": row.get("device_name"),
                "plot_number": row.get("plot_number"),
                "plant": row.get("plant"),
                "stem_count": row.get("stem_count"),
                "processed_timestamp": pd.Timestamp.now(),
                "macro_output_json": debug_str
            }}
            
            results.append(result_row)
        
        if results:
            return pd.DataFrame(results)
        else:
            # Return empty DataFrame with correct columns
            return pd.DataFrame(columns=[
                "device_id", "device_name", "plot_number", "plant", "stem_count", 
                "processed_timestamp", "macro_output_json"
            ])

    # Apply the pandas UDF to get the base data with JSON
    processed_df = base_df.withColumn(
        "macro_struct", process_macro_udf(F.struct([base_df[x] for x in base_df.columns]))
    ).select("macro_struct.*")
    
    # Now parse the JSON using the inferred StructType schema with from_json
    try:
        macro_schema_def = {schema_str}
        
        # Parse the JSON using from_json with the inferred schema
        parsed_json_df = processed_df.withColumn(
            "parsed_macro_output",
            F.from_json(F.col("macro_output_json"), macro_schema_def)
        )
        
        # Expand the parsed struct into individual columns
        parsed_columns = []
        for field in macro_schema_def.fields:
            parsed_columns.append(F.col(f"parsed_macro_output.{{field.name}}").alias(field.name))
        
        # Select all base columns plus the parsed macro fields
        final_df = parsed_json_df.select(
            # Base columns
            F.col("device_id"),
            F.col("device_name"),
            F.col("plot_number"),
            F.col("plant"),
            F.col("stem_count"),
            F.col("processed_timestamp"),
            # Parsed macro fields
            *parsed_columns
        )
        
        return final_df
        
    except Exception as e:
        print(f"JSON parsing failed for macro {macro_name}: {{e}}")
        return processed_df
'''

# Initialize macro processing by generating table functions at module level
if ENABLE_MACRO_PROCESSING:
    try:
        experiment_macros, available_macros, macro_schemas = create_macro_tables()
        for macro_name in experiment_macros:
            if macro_name in available_macros and macro_name in macro_schemas:
                print(f"Creating DLT table function for macro: {macro_name}")
                schema = macro_schemas[macro_name]
                table_code = create_macro_table_code(macro_name, schema)
                exec(table_code, globals())
            else:
                if macro_name not in available_macros:
                    print(f"Warning: Macro {macro_name} referenced in data but script not found")
                if macro_name not in macro_schemas:
                    print(f"Warning: Could not infer schema for macro {macro_name}")
        print("Macro processing setup complete")
    except Exception as e:
        print(f"Error setting up macro processing: {str(e)}")
        print("Continuing without macro processing...")
else:
    print("Macro processing disabled")