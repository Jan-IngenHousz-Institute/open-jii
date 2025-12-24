"""
R Macro Executor

This module provides R macro execution capabilities using rpy2 for Python-R bridge.
Extracted from the main macro.py module for better organization and maintainability.
"""

import os
import json
from typing import Dict, Any

# Import rpy2 for R execution
try:
    import rpy2.robjects as robjects
    from rpy2.robjects import r, pandas2ri
    import rpy2.rinterface_lib.callbacks as rcb
    R_AVAILABLE = True
    print(f"[R_EXECUTOR] Using rpy2 for R execution")
    
    # Initialize pandas converter for better data handling
    pandas2ri.activate()
    
    # Capture R output
    rcb.logger.setLevel(rcb.logging.ERROR)  # Reduce R verbosity
    
except ImportError:
    R_AVAILABLE = False
    print(f"[R_EXECUTOR] WARNING: rpy2 not available. R macros will be skipped.")


def execute_r_macro(script_path: str, input_data: str) -> Dict[str, Any]:
    """Execute an R macro script using rpy2"""
    
    print(f"[R_EXECUTOR] Executing R macro at: {script_path}")
    print(f"[R_EXECUTOR] Input data size: {len(input_data)} characters")
    
    if not R_AVAILABLE:
        print(f"[R_EXECUTOR] ERROR: rpy2 not available, cannot execute R macro")
        print(f"[R_EXECUTOR] Install R support with: pip install multispeq[r]")
        return {"error": "R executor not available", "message": "Install rpy2 with: pip install multispeq[r]"}
    
    try:
        # Read the R script
        with open(script_path, 'r') as f:
            script_code = f.read()
        
        print(f"[R_EXECUTOR] Read R script, {len(script_code)} characters")
        
        # Convert input_data string to object
        try:
            parsed_input_data = json.loads(input_data)
            print(f"[R_EXECUTOR] Successfully parsed input_data JSON")
            
            # If it's an array, take the first item
            if isinstance(parsed_input_data, list) and len(parsed_input_data) > 0:
                parsed_input_data = parsed_input_data[0]
                print(f"[R_EXECUTOR] Taking first item from array")
            
        except json.JSONDecodeError as e:
            print(f"[R_EXECUTOR] WARNING: Failed to parse input_data as JSON: {str(e)}")
            # Fall back to treating it as a plain string
            parsed_input_data = input_data
        
        # Load R helper functions
        r_helpers = get_r_helpers()
        print(f"[R_EXECUTOR] Loaded R helper functions")
        
        # Convert Python data to R objects
        # Handle different data types appropriately
        if isinstance(parsed_input_data, dict):
            # Convert dictionary to R list
            robjects.globalenv['input_data'] = robjects.ListVector(parsed_input_data)
            # Also provide as json for compatibility
            robjects.globalenv['json'] = robjects.ListVector(parsed_input_data)
        else:
            # For other types, convert directly
            robjects.globalenv['input_data'] = parsed_input_data
            robjects.globalenv['json'] = parsed_input_data
        
        # Initialize output list in R
        r('output <- list()')
        
        # Load helper functions into R environment
        if r_helpers:
            r(r_helpers)
            print(f"[R_EXECUTOR] Added R helper functions to environment")
        
        # Wrap the macro script to handle return values
        wrapped_script = f'''
        execute_macro <- function() {{
            {script_code}
        }}
        
        # Execute the macro function and capture any return value
        macro_result <- execute_macro()
        
        # If the macro returned something, use it as output, otherwise use the global output
        if (!is.null(macro_result)) {{
            output <- macro_result
        }}
        '''
        
        # Execute the wrapped R script
        r(wrapped_script)
        print(f"[R_EXECUTOR] Executed R macro script")
        
        # Get the output object from R
        r_output = r('output')
        
        # Convert R output back to Python using pandas2ri conversion
        try:
            # Use pandas2ri to convert R objects to Python objects
            with robjects.conversion.localconverter(robjects.default_converter + pandas2ri.converter):
                result = robjects.conversion.rpy2py(r_output)
            
            # Handle the case where result is not a dict
            if not isinstance(result, dict):
                result = {'value': result}
                
        except Exception as e:
            print(f"[R_EXECUTOR] WARNING: Failed to convert R output to Python: {str(e)}")
            result = {}
        
        print(f"[R_EXECUTOR] R macro execution completed, output: {len(str(result))} characters")
        return result
        
    except Exception as e:
        print(f"[R_EXECUTOR] ERROR in R macro execution: {str(e)}")
        raise


def get_r_helpers(helpers_path: str = None) -> str:
    """
    Load R helper functions from external file
    
    Args:
        helpers_path: Path to the helpers.r file. If None, uses default location.
        
    Returns:
        String containing all R helper functions
        
    Raises:
        FileNotFoundError: If helpers file is not found
        IOError: If helpers file cannot be read
    """
    if helpers_path is None:
        # Default to the helpers.r file in the helpers directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        helpers_path = os.path.join(os.path.dirname(current_dir), "helpers", "helpers.r")
    
    if not os.path.exists(helpers_path):
        print(f"[R_EXECUTOR] WARNING: R helpers file not found at: {helpers_path}")
        return ""
    
    try:
        with open(helpers_path, 'r') as f:
            helpers_content = f.read()
        print(f"[R_EXECUTOR] Loaded R helpers from: {helpers_path}")
        return helpers_content
    except Exception as e:
        print(f"[R_EXECUTOR] WARNING: Failed to read R helpers file {helpers_path}: {str(e)}")
        # Return empty string instead of raising to allow macros to run without helpers
        return ""


