# Databricks notebook source
# DBTITLE 1,OpenJII Experiment Pipeline
# Implementation of experiment-specific medallion architecture pipeline
# Processes data from central silver layer into experiment-specific bronze/silver/gold tables

%pip install /Workspace/Shared/wheels/multispeq-0.1.0-py3-none-any.whl
%pip install /Workspace/Shared/wheels/mini_racer-0.12.4-py3-none-manylinux_2_31_aarch64.whl

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

# Import our macro processing library
from multispeq import execute_macro_script, get_available_macros, process_macro_output_for_spark, infer_macro_schema

# COMMAND ----------

# DBTITLE 1,Pipeline Configuration
EXPERIMENT_ID = spark.conf.get("EXPERIMENT_ID")  # Experiment identifier
EXPERIMENT_SCHEMA = spark.conf.get("EXPERIMENT_SCHEMA")  # Target schema for output
CATALOG_NAME = spark.conf.get("CATALOG_NAME")
CENTRAL_SCHEMA = spark.conf.get("CENTRAL_SCHEMA")
CENTRAL_SILVER_TABLE = spark.conf.get("CENTRAL_SILVER_TABLE")

# Constants for ambyte processing
# YEAR_PREFIX is now used by the ambyte_processing_task instead of this pipeline

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
            F.col("macros"),
            F.explode(F.from_json(F.col("sample"), "array<string>")).alias("sample_data_str")
        )
        .select(
            F.col("id"),
            F.col("device_id"),
            F.col("device_name"),
            F.col("timestamp"),
            F.col("questions"),
            F.col("macros"),
            F.get_json_object(F.col("sample_data_str"), "$.v_arrays").alias("v_arrays"),
            F.get_json_object(F.col("sample_data_str"), "$.set_repeats").cast("int").alias("set_repeats"),
            F.get_json_object(F.col("sample_data_str"), "$.protocol_id").alias("protocol_id"),
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

# DBTITLE 1,Raw Ambyte Data Table (Dynamic Creation)
def check_ambyte_volume_exists():
    """
    Check if the ambyte volume directory exists by trying to read from it.
    Returns True if the volume and processed-ambyte directory exist and contain data.
    """
    processed_path = f"/Volumes/{CATALOG_NAME}/{EXPERIMENT_SCHEMA}/processed-ambyte"
    
    try:
        # Try to create a streaming read on the path - this will fail if path doesn't exist
        # Use cloudFiles format which is what we'll use in the actual table
        test_stream = (
            spark.readStream
            .format("cloudFiles")
            .option("cloudFiles.format", "parquet")
            .option("cloudFiles.maxFilesPerTrigger", "1")
            .load(processed_path)
        )
        
        # If we can create the stream definition without error, the path exists
        # We don't need to actually start the stream, just validate the path
        print(f"Ambyte volume found: {processed_path}")
        return True
        
    except Exception as e:
        print(f"Ambyte volume not available: {processed_path} - {str(e)}")
        return False

def create_ambyte_table():
    """
    Dynamically create the raw ambyte data table if the volume exists.
    """
    if not check_ambyte_volume_exists():
        print("Ambyte volume does not exist - skipping raw ambyte data table creation")
        return False
    
    print("Ambyte volume found - creating raw ambyte data table")
    
    # Generate the table function code
    table_code = '''
@dlt.table(
    name=RAW_AMBYTE_TABLE,
    comment="ambyte trace data from processed parquet files (streaming table)"
)
def raw_ambyte_data():
    """
    Streaming table that reads pre-processed Ambyte data from parquet files.
    The ambyte_processing_task must be run first to generate the parquet files.
    """
    # Path to processed parquet files
    processed_path = f"/Volumes/{CATALOG_NAME}/{EXPERIMENT_SCHEMA}/processed-ambyte"
    
    # Path for schema metadata (persistent location in volumes)
    schema_location = f"/Volumes/{CATALOG_NAME}/{EXPERIMENT_SCHEMA}/_schemas/ambyte_schema"
    
    # Read all parquet files recursively using cloudFiles for auto loader (streaming)
    # This will automatically detect new files as they are added
    # Schema location stores inferred schema and checkpoint data for Auto Loader
    return (
        spark.readStream
        .format("cloudFiles")
        .option("cloudFiles.format", "parquet")
        .option("cloudFiles.schemaLocation", schema_location)
        .option("recursiveFileLookup", "true")
        .load(processed_path)
    )
'''
    
    # Execute the table creation code
    exec(table_code, globals())
    return True

# Initialize ambyte table creation
try:
    ambyte_table_created = create_ambyte_table()
    if ambyte_table_created:
        print("Raw ambyte data table created successfully")
    else:
        print("Raw ambyte data table skipped - volume not available")
except Exception as e:
    print(f"Error during ambyte table creation: {str(e)}")
    
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
        # Now macros is array<struct<id:string, name:string, filename:string>>
        macro_df = (
            spark.read.table(
                f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}"
            )
            .filter(F.col("experiment_id") == EXPERIMENT_ID)
            .filter(F.col("macros").isNotNull())
            .filter(F.size(F.col("macros")) > 0)
            .select(F.explode(F.col("macros")).alias("macro_struct"))
            .select(
                F.col("macro_struct.id").alias("macro_id"),
                F.col("macro_struct.name").alias("macro_name"),
                F.col("macro_struct.filename").alias("macro_filename")
            )
            .distinct()
        )
        
        available_macros = get_available_macros(MACROS_PATH)
        experiment_macros = macro_df.collect()  # Now contains macro_id, macro_name, macro_filename
        
        print(f"Available macros: {available_macros}")
        print(f"Macros used in experiment: {[row.macro_name for row in experiment_macros]}")
        
        # Generate schemas for each macro using macro-specific sample data
        macro_schemas = {}
        print("Inferring schemas for macros using macro-specific sample data...")
        
        for macro_row in experiment_macros:
            macro_id = macro_row.macro_id
            macro_name = macro_row.macro_name
            macro_filename = macro_row.macro_filename
            
            if macro_filename in available_macros:
                print(f"Getting sample data for macro: {macro_name} (filename: {macro_filename})")
                
                # Get a sample row that specifically contains this macro (by ID)
                macro_sample_row = (
                    spark.read.table(
                        f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{CENTRAL_SILVER_TABLE}"
                    )
                    .filter(F.col("experiment_id") == EXPERIMENT_ID)
                    .filter(F.exists(F.col("macros"), lambda x: x.id == macro_id))
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
                    
                    print(f"Inferring schema for macro: {macro_name} (filename: {macro_filename})")
                    schema = infer_macro_schema(macro_filename, sample_data, MACROS_PATH)
                    if schema:
                        # Use macro_id as key for uniqueness, but store both name and filename
                        macro_schemas[macro_id] = {
                            'schema': schema,
                            'name': macro_name,
                            'filename': macro_filename
                        }
                        print(f"Schema for {macro_name}: {len(schema.fields)} fields")
                    else:
                        print(f"Warning: Could not infer schema for macro {macro_name}")
                else:
                    print(f"Warning: No sample data found for macro {macro_name}")
            else:
                print(f"Warning: Macro {macro_name} referenced in data but script {macro_filename} not found")
        
        return experiment_macros, available_macros, macro_schemas
    except Exception as e:
        print(f"Error reading macros from central table: {str(e)}")
        return [], [], {}

def create_macro_table_code(macro_id: str, macro_name: str, macro_filename: str, macro_schema: StructType) -> str:
    """
    Generate Python code for a macro streaming table function.
    UDF returns JSON string, then we parse it using the inferred StructType schema.
    """
    # Normalize macro name for table creation (same as backend logic)
    normalized_name = macro_name.lower().strip().replace(" ", "_")
    # Base schema for the UDF output (just the essential fields + JSON)
    udf_schema = (
        "id long, device_id string, device_name string, timestamp timestamp, questions array<struct<question_label:string,question_text:string,question_answer:string>>, "
        "processed_timestamp timestamp, macro_output_json string"
    )
    
    # Convert StructType to a string representation for the exec'd code
    schema_str = str(macro_schema)
    
    return f'''
@dlt.table(
    name="macro_{normalized_name}",
    comment="Output from macro: {macro_name}",
    table_properties={{
        "quality": "silver",
        "pipelines.autoOptimize.managed": "true"
    }}
)
def macro_{normalized_name}_table():
    base_df = (
        spark.readStream.table(f"{{CATALOG_NAME}}.{{CENTRAL_SCHEMA}}.{{CENTRAL_SILVER_TABLE}}")
        .filter(F.col("experiment_id") == EXPERIMENT_ID)
        .filter(F.exists(F.col("macros"), lambda x: x.id == "{macro_id}"))
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
                raw_macro_output = execute_macro_script("{macro_filename}", input_data, MACROS_PATH)
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
        for macro_row in experiment_macros:
            macro_id = macro_row.macro_id
            macro_name = macro_row.macro_name
            macro_filename = macro_row.macro_filename
            
            if macro_filename in available_macros and macro_id in macro_schemas:
                print(f"Creating DLT table function for macro: {macro_name} (ID: {macro_id})")
                schema_info = macro_schemas[macro_id]
                schema = schema_info['schema']
                table_code = create_macro_table_code(macro_id, macro_name, macro_filename, schema)
                exec(table_code, globals())
            else:
                if macro_filename not in available_macros:
                    print(f"Warning: Macro {macro_name} referenced in data but script {macro_filename} not found")
                if macro_id not in macro_schemas:
                    print(f"Warning: Could not infer schema for macro {macro_name}")
        print("Macro processing setup complete")
    except Exception as e:
        print(f"Error setting up macro processing: {str(e)}")
        print("Continuing without macro processing...")
else:
    print("Macro processing disabled")
