"""
Macro Processing Library for OpenJII MultispeQ Data

This module provides utilities for executing JavaScript and Python macros
on MultispeQ measurement data within Databricks pipelines.

Key Features:
- Dynamic execution of JS macros using js2py
- Safe execution of Python macros
- Schema inference for macro outputs
- Support for primitive arrays and complex objects
"""

import os
import json
import sys
from typing import Dict, Any, List, Callable
from pyspark.sql.types import (
    StringType, TimestampType, DoubleType, IntegerType, 
    StructType, StructField, ArrayType
)

sys.path.append("/Workspace/Shared/notebooks/lib/multispeq/macro/executors")

# Import the new executor modules
from js_executor import execute_javascript_macro
from py_executor import execute_python_macro


def execute_macro_script(
    macro_name: str, 
    input_data: Dict[str, Any], 
    macros_path: str = "/Shared/Workspace/macros",
    helpers_path: str = None
) -> Dict[str, Any]:
    """
    Execute a macro script (JS or Python) and return the output object
    
    Args:
        macro_name: Name of the macro script (without extension)
        input_data: Input data to pass to the script
        macros_path: Path to the macros directory
        helpers_path: Path to the JavaScript helpers file (optional)
        
    Returns:
        Dictionary containing the macro output
    """
    print(f"[MACRO] Starting execution of macro: {macro_name}")
    print(f"[MACRO] Macros path: {macros_path}")
    print(f"[MACRO] Input data keys: {list(input_data.keys()) if input_data else 'None'}")
    
    # Check for Python script first, then JavaScript
    script_extensions = ['.py', '.js']
    script_path = None
    script_type = None
    
    for ext in script_extensions:
        potential_path = f"{macros_path}/{macro_name}{ext}"
        print(f"[MACRO] Checking for script at: {potential_path}")
        if os.path.exists(potential_path):
            script_path = potential_path
            script_type = 'python' if ext == '.py' else 'javascript'
            print(f"[MACRO] Found {script_type} script: {script_path}")
            break
    
    if not script_path:
        print(f"[MACRO] WARNING: Macro script not found for {macro_name}")
        return {}
    
    try:
        print(f"[MACRO] Executing {script_type} macro: {macro_name}")
        if script_type == 'python':
            result = execute_python_macro(script_path, input_data.get("sample"))
        else:  # JavaScript
            result = execute_javascript_macro(script_path, input_data.get("sample"), macro_name, helpers_path)
        
        print(f"[MACRO] Successfully executed macro {macro_name}, output keys: {list(result.keys()) if result else 'None'}")

        return result
            
    except Exception as e:
        print(f"[MACRO] ERROR executing macro {macro_name}: {str(e)}")
        return {}


def get_available_macros(macros_path: str = "/Shared/Workspace/macros") -> List[str]:
    """
    Get list of available macros from the macros directory
    
    Args:
        macros_path: Path to the macros directory
        
    Returns:
        List of macro names (without extensions)
    """
    print(f"[MACRO] Scanning for available macros in: {macros_path}")
    
    if not os.path.exists(macros_path):
        print(f"[MACRO] WARNING: Macros directory does not exist: {macros_path}")
        return []
    
    macros = set()
    try:
        files = os.listdir(macros_path)
        print(f"[MACRO] Found {len(files)} files in macros directory")
        
        for file in files:
            if file.endswith(('.py', '.js')):
                macro_name = os.path.splitext(file)[0]
                macros.add(macro_name)
                print(f"[MACRO] Found macro: {macro_name} ({file})")
    
        result = list(macros)
        print(f"[MACRO] Total available macros: {len(result)}")
        return result
        
    except Exception as e:
        print(f"[MACRO] ERROR scanning macros directory: {str(e)}")
        return []


def infer_schema_from_output(output: Dict[str, Any]) -> StructType:
    """
    Infer Spark schema from macro output structure
    
    This function analyzes the macro output and creates an appropriate Spark schema,
    handling different data types intelligently:
    - Integers remain as IntegerType
    - Floats become DoubleType
    - Arrays of primitives become ArrayType with appropriate element type
    - Complex objects become JSON strings
    
    Args:
        output: Dictionary containing the macro output
        
    Returns:
        StructType representing the schema
    """
    fields = []
    
    for key, value in output.items():
        if isinstance(value, str):
            fields.append(StructField(key, StringType(), True))
        elif isinstance(value, int):
            # Use DoubleType for integers to maintain consistency with normalization
            fields.append(StructField(key, DoubleType(), True))
        elif isinstance(value, float):
            fields.append(StructField(key, DoubleType(), True))
        elif isinstance(value, bool):
            fields.append(StructField(key, StringType(), True))  # Store as string for simplicity
        elif isinstance(value, list):
            # Handle arrays based on their content type
            if len(value) > 0:
                # Check if all elements are numeric (int or float)
                all_numeric = all(isinstance(elem, (int, float)) for elem in value)
                all_strings = all(isinstance(elem, str) for elem in value)
                
                if all_strings:
                    fields.append(StructField(key, ArrayType(StringType()), True))
                elif all_numeric:
                    # For spectrum data and other numeric arrays, always use DoubleType
                    # to handle mixed int/float values from JavaScript TransformTrace function
                    fields.append(StructField(key, ArrayType(DoubleType()), True))
                else:
                    # For complex arrays or mixed non-numeric types, store as JSON string
                    fields.append(StructField(key, StringType(), True))
            else:
                # Empty array - default to string array, let Spark infer later if needed
                fields.append(StructField(key, ArrayType(StringType()), True))
        elif isinstance(value, dict):
            fields.append(StructField(key, StringType(), True))  # Store as JSON string
        else:
            fields.append(StructField(key, StringType(), True))  # Default to string
    
    # Add standard metadata fields
    fields.extend([
        StructField("macro_name", StringType(), False),
        StructField("experiment_id", StringType(), False),
        StructField("processed_timestamp", TimestampType(), False)
    ])
    
    return StructType(fields)


def process_macro_output_for_spark(output: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process macro output to ensure compatibility with Spark DataFrame creation
    
    This function converts complex objects to JSON strings while preserving
    primitive arrays and basic data types.
    
    Args:
        output: Raw macro output dictionary
        
    Returns:
        Processed output ready for Spark DataFrame creation
    """
    print(f"[MACRO] Processing macro output for Spark compatibility")
    print(f"[MACRO] Input output keys: {list(output.keys()) if output else 'None'}")
    
    processed_output = output.copy()
    conversions_made = 0
    
    for key, value in processed_output.items():
        original_type = type(value).__name__
        
        if isinstance(value, dict):
            # Convert dictionaries to JSON strings
            processed_output[key] = json.dumps(value)
            conversions_made += 1
            print(f"[MACRO] Converted dict '{key}' to JSON string")
        elif isinstance(value, list):
            # Check if it's an array of primitives (strings, numbers)
            if len(value) > 0:
                first_element = value[0]
                if not isinstance(first_element, (str, int, float)):
                    # Convert complex arrays to JSON string
                    processed_output[key] = json.dumps(value)
                    conversions_made += 1
                    print(f"[MACRO] Converted complex array '{key}' to JSON string")
                else:
                    # Check if this is a numeric array that needs type normalization
                    all_numeric = all(isinstance(elem, (int, float)) for elem in value if elem is not None)
                    if all_numeric:
                        # Convert all numeric arrays to float to prevent LongType/DoubleType conflicts
                        # This is essential because JavaScript TransformTrace functions can return mixed int/float arrays
                        processed_output[key] = [float(elem) if elem is not None else None for elem in value]
                        conversions_made += 1
                        print(f"[MACRO] Normalized numeric array '{key}' to all floats ({original_type})")
                    else:
                        print(f"[MACRO] Kept primitive array '{key}' as-is ({original_type})")
            else:
                print(f"[MACRO] Kept empty array '{key}' as-is")
            # else: keep as array for primitive types
        elif key != "processed_timestamp":
            # Convert individual numeric values to float to ensure consistency across rows
            if isinstance(value, int):
                processed_output[key] = float(value)
                conversions_made += 1
                print(f"[MACRO] Converted integer '{key}' to float for consistency")
            elif not isinstance(value, (str, float, bool)):
                # Convert other non-primitive types to string
                processed_output[key] = str(value)
                conversions_made += 1
                print(f"[MACRO] Converted non-primitive '{key}' ({original_type}) to string")
            else:
                print(f"[MACRO] Kept primitive '{key}' as-is ({original_type})")
    
    print(f"[MACRO] Macro output processing completed, {conversions_made} conversions made")
    return processed_output


def create_macro_table_function(
    macro_name: str,
    experiment_id: str,
    catalog_name: str,
    central_schema: str,
    central_silver_table: str,
    macros_path: str
):
    """
    Create the logic for a macro table function (without DLT decorator)
    
    This returns a function that can be decorated with @dlt.table in the pipeline.
    The DLT decorator must be applied in the pipeline file, not in a library.
    
    Args:
        macro_name: Name of the macro to create table for
        experiment_id: Experiment identifier for filtering
        catalog_name: Databricks catalog name
        central_schema: Schema containing the central silver table
        central_silver_table: Name of the central silver table
        macros_path: Path to macro scripts
        
    Returns:
        Function that implements the macro table logic
    """
    def macro_table_logic():
        """
        Process records through the macro and create output table
        """
        from pyspark.sql import SparkSession
        from pyspark.sql import functions as F
        
        print(f"[MACRO] Starting macro table logic for: {macro_name}")
        print(f"[MACRO] Experiment ID: {experiment_id}")
        print(f"[MACRO] Reading from: {catalog_name}.{central_schema}.{central_silver_table}")
        
        spark = SparkSession.getActiveSession()
        
        # Read data that has this macro
        print(f"[MACRO] Filtering data for macro: {macro_name}")
        base_df = (
            spark.read.table(f"{catalog_name}.{central_schema}.{central_silver_table}")
            .filter(F.col("experiment_id") == experiment_id)
            .filter(F.array_contains(F.col("macros"), macro_name))
        )
        
        # Collect all data to process through macro
        rows_data = base_df.collect()
        print(f"[MACRO] Found {len(rows_data)} rows containing macro: {macro_name}")
        
        processed_rows = []
        
        for i, row in enumerate(rows_data):
            print(f"[MACRO] Processing row {i+1}/{len(rows_data)} for macro: {macro_name}")
            try:
                # Prepare input data for the macro
                input_data = {
                    "device_id": getattr(row, 'device_id', None),
                    "device_name": getattr(row, 'device_name', None),
                    "experiment_id": getattr(row, 'experiment_id', None),
                    "sample": getattr(row, 'sample', None),
                    "macros": getattr(row, 'macros', None),
                    # Add other fields as needed
                }
                
                # Remove None values
                input_data = {k: v for k, v in input_data.items() if v is not None}
                
                # Execute the macro using the library function
                output = execute_macro_script(macro_name, input_data, macros_path)

                if output:
                    # Add metadata to output
                    output["macro_name"] = macro_name
                    output["experiment_id"] = experiment_id
                    
                    # Process output for Spark compatibility using library function
                    processed_output = process_macro_output_for_spark(output)
                    processed_rows.append(processed_output)
                    print(f"[MACRO] Successfully processed row {i+1} for macro: {macro_name}")
                else:
                    print(f"[MACRO] No output from macro {macro_name} for row {i+1}")
            
            except Exception as e:
                print(f"[MACRO] ERROR processing row {i+1} for macro {macro_name}: {str(e)}")
                continue
        
        print(f"[MACRO] Processed {len(processed_rows)} rows successfully for macro: {macro_name}")
        
        if processed_rows:
            # Create DataFrame from processed rows
            df = spark.createDataFrame(processed_rows)
            # Add processed timestamp
            result_df = df.withColumn("processed_timestamp", F.current_timestamp())
            print(f"[MACRO] Created DataFrame with {result_df.count()} rows for macro: {macro_name}")
            return result_df
        else:
            print(f"[MACRO] No processed rows, returning empty DataFrame for macro: {macro_name}")
            # Return empty DataFrame with minimal schema
            minimal_schema = StructType([
                StructField("macro_name", StringType(), False),
                StructField("experiment_id", StringType(), False),
                StructField("processed_timestamp", TimestampType(), False)
            ])
            empty_df = spark.createDataFrame([], minimal_schema)
            return empty_df.withColumn("processed_timestamp", F.current_timestamp())
    
    return macro_table_logic