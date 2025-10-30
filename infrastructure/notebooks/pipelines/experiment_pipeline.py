# Databricks notebook source
# DBTITLE 1,OpenJII Experiment Pipeline
# Implementation of experiment-specific medallion architecture pipeline
# Processes data from central silver layer into experiment-specific bronze/silver/gold tables

%pip install /Workspace/Shared/wheels/multispeq-0.1.0-py3-none-any.whl
%pip install /Workspace/Shared/wheels/ambyte-0.2.0-py3-none-any.whl
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
#from ambyte import prepare_ambyte_files, process_trace_files
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
        spark.read.table(f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}")
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
    
    # Process sample data and include questions columns directly
    return (
        base_df
        .select(
            F.col("id"),
            F.col("device_id"),
            F.col("device_name"),
            F.col("timestamp"),
            F.col("questions"),
            F.explode(F.from_json(F.col("sample"), "array<string>")).alias("sample_data_str")
        )
        .select(
            F.col("id"),
            F.col("device_id"),
            F.col("device_name"),
            F.col("timestamp"),
            F.col("questions"),
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
# # Define the schema for the raw ambyte data table
# raw_ambyte_schema = StructType([
#     StructField("Time", TimestampType(), False),
#     StructField("SigF", IntegerType(), True),
#     StructField("RefF", IntegerType(), True),
#     StructField("Sun", IntegerType(), True),
#     StructField("Leaf", IntegerType(), True),
#     StructField("Sig7", IntegerType(), True),
#     StructField("Ref7", IntegerType(), True),
#     StructField("Actinic", IntegerType(), True),
#     StructField("Temp", FloatType(), True),
#     StructField("Res", IntegerType(), True),
#     StructField("Full", BooleanType(), True),
#     StructField("Type", StringType(), True),
#     StructField("Count", IntegerType(), True),
#     StructField("PTS", IntegerType(), True),
#     StructField("PAR", FloatType(), True),
#     StructField("raw", FloatType(), True),
#     StructField("spec", ArrayType(IntegerType()), True),
#     StructField("BoardT", FloatType(), True),
#     StructField("ambyte_folder", StringType(), True),
#     StructField("ambit_index", IntegerType(), True),
#     StructField("meta_Actinic", FloatType(), True),
#     StructField("meta_Dark", IntegerType(), True),
#     StructField("upload_directory", StringType(), True),
#     StructField("upload_time", TimestampType(), True)
# ])
# # COMMAND ----------

# # DBTITLE 1,Raw Ambyte Data Table
# def create_ambyte_table_code():
#     """Generate code for ambyte streaming table."""
#     return '''
# @dlt.table(
#     name=RAW_AMBYTE_TABLE,
#     comment="ambyte trace data processed from raw files stored in Databricks volume"
# )
# def raw_ambyte_data():
#     """
#     Streaming DLT table-generating function that processes Ambyte trace files from a Databricks volume
#     and creates a Delta table with the processed data using Auto Loader.
#     """
    
#     # Configuration - specify the base path in the Databricks volume
#     ambyte_base_path = f"/Volumes/{CATALOG_NAME}/{EXPERIMENT_SCHEMA}/data-uploads/ambyte"
    
#     # For streaming tables, we cannot use discovery functions in the main function
#     # Instead, use Auto Loader to stream files and process using pandas UDF
#     df = (
#         spark.readStream.format("cloudFiles")
#         .option("cloudFiles.format", "text")
#         .option("recursiveFileLookup", "true")
#         .option("cloudFiles.schemaLocation", f"/tmp/checkpoints/{EXPERIMENT_SCHEMA}/ambyte_schema")
#         .option("pathGlobFilter", f"{YEAR_PREFIX}*_.txt")
#         .option("cloudFiles.allowOverwrites", "true")
#         .option("cloudFiles.ignoreDataLoss", "true")
#         .load(ambyte_base_path)
#     )
    
#     # Add file path information
#     df = df.withColumn("file_path", F.col("_metadata.file_path"))
    
#     # Filter to only process data files (same logic as existing load_files_per_byte)
#     df = df.filter(
#         F.col("file_path").rlike(f".*/{YEAR_PREFIX}.*_.txt$")
#     )
    
#     # Extract upload directory and ambyte folder information from file path using string functions
#     # Split path by "/" and extract relevant parts
#     path_parts = F.split(F.col("file_path"), "/")
    
#     # Find upload directory (contains "upload_")
#     df = df.withColumn("upload_dir", 
#         F.expr("filter(split(file_path, '/'), x -> x like 'upload_%')[0]")
#     )
    
#     # Find ambyte folder (contains "Ambyte_" or "unknown_ambyte")  
#     df = df.withColumn("ambyte_folder",
#         F.expr("filter(split(file_path, '/'), x -> x like 'Ambyte_%' or x = 'unknown_ambyte')[0]")
#     )
    
#     # Find ambit index (numeric folders 1-4 or "unknown_ambit")
#     df = df.withColumn("ambit_index",
#         F.expr("filter(split(file_path, '/'), x -> x in ('1','2','3','4','unknown_ambit'))[0]")
#     )
    
#     # Create ambyte folder path by reconstructing path up to ambyte folder
#     df = df.withColumn("ambyte_folder_path",
#         F.expr("concat_ws('/', slice(split(file_path, '/'), 1, size(split(file_path, '/')) - 2))")
#     )
    
#     # TODO: Need to handle streaming aggregation issue
#     # For now, return the dataframe without groupBy to avoid streaming aggregation error
    
#     # Define pandas UDF
#     @pandas_udf(returnType=ArrayType(raw_ambyte_schema))
#     def process_ambyte_folder(folder_data: pd.Series, upload_dirs: pd.Series, ambyte_folders: pd.Series) -> pd.Series:
#         """
#         Process ambyte folders
#         """
        
#         all_results = []
        
#         for files_data, upload_dir, ambyte_folder in zip(folder_data, upload_dirs, ambyte_folders):
#             # Organize files using embedded function (exact copy of volume_io.prepare_ambyte_files)
#             organized_data = prepare_ambyte_files(files_data, upload_dir, ambyte_folder)
            
#             if organized_data is None:
#                 continue
                
#             files_per_byte, upload_time, folder_name = organized_data
            
#             try:                
#                 df_result = process_trace_files(folder_name or 'unknown', files_per_byte)
                
#                 if df_result is not None:
#                     df_result = df_result.reset_index()
#                     df_result[\'upload_directory\'] = upload_dir
#                     df_result[\'upload_time\'] = upload_time
                    
#                     records = df_result.to_dict(\'records\')
#                     all_results.extend(records)
                    
#             except Exception as e:
#                 print(f"Error processing ambyte folder {folder_name}: {e}")
#                 continue
        
#         return pd.Series([all_results])
    
#     # Apply pandas UDF to process ambyte folders using existing logic
#     df = df.select(
#         F.explode(
#             process_ambyte_folder(F.col("file_data"), F.col("upload_dir"), F.col("ambyte_folder"))
#         ).alias("parsed_data")
#     )
    
#     # Expand the parsed data into individual columns matching the schema
#     df = df.select("parsed_data.*")
    
#     return df
# '''

# # Check if volume exists and only create table if it does
# try:
#     # Try to read from the volume path to check if it exists
#     volume_path = f"/Volumes/{CATALOG_NAME}/{EXPERIMENT_SCHEMA}/data-uploads"
#     test_df = spark.read.format("text").load(volume_path)
#     # If we can create the DataFrame, the volume exists
#     print(f"Volume data-uploads exists at {volume_path}")
#     print("Creating streaming raw_ambyte_data table")
#     exec(create_ambyte_table_code(), globals())
#     print("Raw ambyte table created successfully")
        
# except Exception as e:
#     print(f"Volume data-uploads does not exist or is not accessible: {e}")
#     print("Skipping raw_ambyte_data table creation")

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
        
        available_macros = get_available_macros(MACROS_PATH)
        experiment_macros = [row.macro_name for row in macros_df.collect()]
        
        print(f"Available macros: {available_macros}")
        print(f"Macros used in experiment: {experiment_macros}")
        
        # Generate schemas for each macro using macro-specific sample data
        macro_schemas = {}
        print("Inferring schemas for macros using macro-specific sample data...")
        
        for macro_name in experiment_macros:
            if macro_name in available_macros:
                print(f"Getting sample data for macro: {macro_name}")
                
                # Get a sample row that specifically contains this macro
                macro_sample_row = (
                    spark.read.table(
                        f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}"
                    )
                    .filter(F.col("experiment_id") == EXPERIMENT_ID)
                    .filter(F.array_contains(F.col("macros"), macro_name))
                    .first()
                )
                
                if macro_sample_row:
                    # Prepare sample data specific to this macro
                    sample_data = {
                        "device_id": macro_sample_row["device_id"],
                        "device_name": macro_sample_row["device_name"],
                        "experiment_id": macro_sample_row["experiment_id"],
                        "sample": macro_sample_row["sample"],
                        "macros": macro_sample_row["macros"],
                    }
                    sample_data = {k: v for k, v in sample_data.items() if v is not None}
                    
                    print(f"Inferring schema for macro: {macro_name}")
                    schema = infer_macro_schema(macro_name, sample_data, MACROS_PATH)
                    if schema:
                        macro_schemas[macro_name] = schema
                        print(f"Schema for {macro_name}: {len(schema.fields)} fields")
                    else:
                        print(f"Warning: Could not infer schema for macro {macro_name}")
                else:
                    print(f"Warning: No sample data found for macro {macro_name}")
            else:
                print(f"Warning: Macro {macro_name} referenced in data but script not found")
        
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
        "id long, device_id string, device_name string, timestamp timestamp, questions array<struct<question_label:string,question_text:string,question_answer:string>>, "
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
                "questions": row.get("questions"),
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
                "id": row.get("id"),
                "device_id": row.get("device_id"),
                "device_name": row.get("device_name"),
                "timestamp": row.get("timestamp"),
                "questions": row.get("questions"),
                "processed_timestamp": pd.Timestamp.now(),
                "macro_output_json": debug_str
            }}
            
            results.append(result_row)
        
        if results:
            return pd.DataFrame(results)
        else:
            # Return empty DataFrame with correct columns
            return pd.DataFrame(columns=[
                "id", "device_id", "device_name", "timestamp", "questions", "processed_timestamp", "macro_output_json"
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
            F.col("id"),
            F.col("device_id"),
            F.col("device_name"),
            F.col("timestamp"),
            F.col("questions"),
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
