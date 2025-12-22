"""
Macro Processing Library for openJII MultispeQ Data

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
    StructType, StructField, ArrayType, BooleanType, MapType
)

# Import the executor modules using relative imports
from .executors.js_executor import execute_javascript_macro
from .executors.py_executor import execute_python_macro
from .executors.r_executor import execute_r_macro

def execute_macro_script(
    macro_name: str, 
    input_data: Dict[str, Any], 
    macros_path: str = "/Shared/Workspace/macros",
    helpers_path: str = None
) -> Dict[str, Any]:
    """
    Execute a macro script and return the output object.
    Searches for the first file with the macro name and a recognized extension.
    
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
    
    # Define supported extensions and their executors
    executors = {
        '.py': ('python', execute_python_macro),
        '.js': ('javascript', execute_javascript_macro),
        '.r': ('r', execute_r_macro)
    }
    
    # Find the first existing file with a recognized extension
    script_path = None
    script_type = None
    executor_func = None
    
    for extension, (lang_type, func) in executors.items():
        candidate_path = f"{macros_path}/{macro_name}{extension}"
        if os.path.exists(candidate_path):
            script_path = candidate_path
            script_type = lang_type
            executor_func = func
            print(f"[MACRO] Found {script_type} script: {script_path}")
            break
    
    if script_path is None:
        supported_extensions = list(executors.keys())
        print(f"[MACRO] ERROR: No macro script found for '{macro_name}' with supported extensions: {supported_extensions}")
        return {}
    
    try:
        print(f"[MACRO] Executing {script_type} macro: {macro_name}")
        
        # Execute based on script type
        sample_data = input_data.get("sample")
        if script_type == 'javascript':
            result = executor_func(script_path, sample_data, macro_name, helpers_path)
        else:
            result = executor_func(script_path, sample_data)
        
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
            if file.endswith(('.py', '.js', '.r')):
                macro_name = os.path.splitext(file)[0]
                macros.add(macro_name)
                print(f"[MACRO] Found macro: {macro_name} ({file})")
    
        result = list(macros)
        print(f"[MACRO] Total available macros: {len(result)}")
        return result
        
    except Exception as e:
        print(f"[MACRO] ERROR scanning macros directory: {str(e)}")
        return []


def process_macro_output_for_spark(output: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process macro output to ensure compatibility with Spark DataFrame creation
    
    This function converts complex objects to JSON strings while preserving
    primitive arrays and basic data types. Also sanitizes column names for Delta compatibility.
    
    Args:
        output: Raw macro output dictionary
        
    Returns:
        Processed output ready for Spark DataFrame creation
    """
    import re
    
    print(f"[MACRO] Processing macro output for Spark compatibility")
    print(f"[MACRO] Input output keys: {list(output.keys()) if output else 'None'}")
    
    def sanitize_column_name(name: str) -> str:
        """Replace invalid characters in column names with underscores"""
        # Replace spaces and invalid characters ( ,;{}()\n\t=) with underscores
        sanitized = re.sub(r'[ ,;{}\(\)\n\t=]', '_', name)
        # Remove any consecutive underscores
        sanitized = re.sub(r'_+', '_', sanitized)
        # Remove leading/trailing underscores
        sanitized = sanitized.strip('_')
        return sanitized
    
    processed_output = {}
    conversions_made = 0
    
    for key, value in output.items():
        sanitized_key = sanitize_column_name(key)
        original_type = type(value).__name__
        
        if isinstance(value, dict):
            # Flatten dict: convert all keys and values to strings for MAP<STRING,STRING>
            processed_output[sanitized_key] = {str(k): str(v) for k, v in value.items()}
            conversions_made += 1
            print(f"[MACRO] Flattened dict '{key}' to MAP<STRING,STRING> (sanitized: '{sanitized_key}')")
        elif isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict):
                    # Flatten dict: convert all values to strings
                    processed_output[sanitized_key] = {str(k): str(v) for k, v in parsed.items()}
                    conversions_made += 1
                    print(f"[MACRO] Parsed and flattened JSON string '{key}' to MAP<STRING,STRING> (sanitized: '{sanitized_key}')")
                elif isinstance(parsed, list):
                    processed_output[sanitized_key] = parsed
                    conversions_made += 1
                    print(f"[MACRO] Parsed JSON string '{key}' to list (sanitized: '{sanitized_key}')")
            except (json.JSONDecodeError, TypeError):
                processed_output[sanitized_key] = value
                print(f"[MACRO] Kept string '{key}' as-is ({original_type}) (sanitized: '{sanitized_key}')")
        elif isinstance(value, list):
            # Check if it's an array of primitives (strings, numbers)
            if len(value) > 0:
                # Find first non-None element to determine array type
                first_non_none = next((elem for elem in value if elem is not None), None)
                
                if first_non_none is None:
                    # All elements are None, treat as array of zeros
                    processed_output[sanitized_key] = value
                    print(f"[MACRO] Kept all-null array '{key}' as-is (sanitized: '{sanitized_key}')")
                elif not isinstance(first_non_none, (str, int, float)):
                    # Convert complex arrays to JSON string
                    processed_output[sanitized_key] = json.dumps(value)
                    conversions_made += 1
                    print(f"[MACRO] Converted complex array '{key}' to JSON string (sanitized: '{sanitized_key}')")
                else:
                    # Check if this is a numeric array that needs type normalization
                    all_numeric = all(isinstance(elem, (int, float)) for elem in value if elem is not None)
                    if all_numeric:
                        # Convert all numeric arrays to float to prevent LongType/DoubleType conflicts
                        # This is essential because JavaScript TransformTrace functions can return mixed int/float arrays
                        processed_output[sanitized_key] = [float(elem) if elem is not None else 0.0 for elem in value]
                        conversions_made += 1
                        print(f"[MACRO] Normalized numeric array '{key}' to all floats ({original_type}) (sanitized: '{sanitized_key}')")
                    else:
                        processed_output[sanitized_key] = value
                        print(f"[MACRO] Kept primitive array '{key}' as-is ({original_type}) (sanitized: '{sanitized_key}')")
            else:
                processed_output[sanitized_key] = value
                print(f"[MACRO] Kept empty array '{key}' as-is (sanitized: '{sanitized_key}')")
            # else: keep as array for primitive types
        elif key != "processed_timestamp":
            # Convert individual numeric values to float to ensure consistency across rows
            if isinstance(value, int):
                processed_output[sanitized_key] = float(value)
                conversions_made += 1
                print(f"[MACRO] Converted integer '{key}' to float for consistency (sanitized: '{sanitized_key}')")
            elif not isinstance(value, (str, float, bool)):
                # Convert other non-primitive types to string
                processed_output[sanitized_key] = str(value)
                conversions_made += 1
                print(f"[MACRO] Converted non-primitive '{key}' ({original_type}) to string (sanitized: '{sanitized_key}')")
            else:
                processed_output[sanitized_key] = value
                print(f"[MACRO] Kept primitive '{key}' as-is ({original_type}) (sanitized: '{sanitized_key}')")
    
    print(f"[MACRO] Macro output processing completed, {conversions_made} conversions made")
    return processed_output


def infer_macro_schema(macro_name: str, sample_data: dict, macros_path: str = "/Shared/Workspace/macros") -> StructType:
    """
    Infer the schema of a macro's output by running it on sample data.
    Returns a StructType for use with from_json.
    
    Args:
        macro_name: Name of the macro script
        sample_data: Sample data to use for schema inference
        macros_path: Path to the macros directory
        
    Returns:
        StructType schema for the macro output or None if inference fails
    """
    try:
        # Execute the macro with sample data
        raw_output = execute_macro_script(macro_name, sample_data, macros_path)
        
        if raw_output is None:
            return None
        
        # Process the output the same way it will be processed in the actual pipeline
        output = process_macro_output_for_spark(raw_output)
        
        # Sanitize column names for Delta table compatibility
        def sanitize_column_name(name: str) -> str:
            """Replace invalid characters in column names with underscores"""
            import re
            # Replace spaces and invalid characters ( ,;{}()\n\t=) with underscores
            sanitized = re.sub(r'[ ,;{}\(\)\n\t=]', '_', name)
            # Remove any consecutive underscores
            sanitized = re.sub(r'_+', '_', sanitized)
            # Remove leading/trailing underscores
            sanitized = sanitized.strip('_')
            return sanitized
            
        # Analyze the macro output structure and build StructType
        def infer_spark_field(key, value):
            if value is None:
                return StructField(key, StringType(), True)  # Default to string for null values
            elif isinstance(value, bool):
                return StructField(key, BooleanType(), True)
            elif isinstance(value, int):
                # After processing, integers are converted to floats for consistency
                return StructField(key, DoubleType(), True)
            elif isinstance(value, float):
                return StructField(key, DoubleType(), True)
            elif isinstance(value, str):
                return StructField(key, StringType(), True)
            elif isinstance(value, list):
                if len(value) == 0:
                    return StructField(key, ArrayType(StringType()), True)  # Default array type
                # Infer array element type from first non-null element
                # Note: process_macro_output_for_spark converts all numeric arrays to float
                for item in value:
                    if item is not None:
                        if isinstance(item, bool):
                            return StructField(key, ArrayType(BooleanType()), True)
                        elif isinstance(item, int):
                            # This shouldn't happen after processing, but handle it
                            return StructField(key, ArrayType(DoubleType()), True)
                        elif isinstance(item, float):
                            return StructField(key, ArrayType(DoubleType()), True)
                        elif isinstance(item, str):
                            return StructField(key, ArrayType(StringType()), True)
                        elif isinstance(item, list):
                            # Array of arrays - keep as array of strings for simplicity
                            return StructField(key, ArrayType(StringType()), True)
                        elif isinstance(item, dict):
                            # Array of objects - treat as Array<Map<String, String>> for simplicity
                            return StructField(key, ArrayType(MapType(StringType(), StringType())), True)
                        else:
                            return StructField(key, ArrayType(StringType()), True)
                return StructField(key, ArrayType(StringType()), True)
            elif isinstance(value, dict):
                # After processing, dicts should have string keys and string values
                return StructField(key, MapType(StringType(), StringType()), True)
            else:
                return StructField(key, StringType(), True)  # Default fallback
        
        # Build struct fields from macro output with sanitized column names
        struct_fields = []
        for key, value in output.items():
            sanitized_key = sanitize_column_name(key)
            field = infer_spark_field(sanitized_key, value)
            struct_fields.append(field)
        
        return StructType(struct_fields)
        
    except Exception as e:
        print(f"Error inferring schema for macro {macro_name}: {str(e)}")
        return None
