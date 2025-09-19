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
            # processed_output[key] = json.dumps(value)
            # conversions_made += 1
            print(f"[MACRO] Converted dict '{key}' to JSON string")
        elif isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, dict):
                    # Flatten dict: convert all values to strings
                    processed_output[key] = {str(k): str(v) for k, v in parsed.items()}
                    conversions_made += 1
                    print(f"[MACRO] Parsed and flattened JSON string '{key}' to MAP<STRING,STRING>")
                elif isinstance(parsed, list):
                    processed_output[key] = parsed
                    conversions_made += 1
                    print(f"[MACRO] Parsed JSON string '{key}' to list")
            except (json.JSONDecodeError, TypeError):
                print(f"[MACRO] Kept string '{key}' as-is ({original_type})")
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
