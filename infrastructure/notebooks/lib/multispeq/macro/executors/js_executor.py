"""
JavaScript Macro Executor

This module provides JavaScript macro execution capabilities using PyMiniRacer (V8 engine).
Extracted from the main macro.py module for better organization and maintainability.
"""

import os
import json
from typing import Dict, Any

# Import PyMiniRacer for JavaScript execution
try:
    from py_mini_racer import py_mini_racer
    JS_AVAILABLE = True
    print(f"[JS_EXECUTOR] Using PyMiniRacer (V8) for JavaScript execution")
except ImportError:
    JS_AVAILABLE = False
    print(f"[JS_EXECUTOR] WARNING: PyMiniRacer not available. JavaScript macros will be skipped.")


def execute_javascript_macro(
    script_path: str, 
    input_data: str, 
    macro_name: str, 
    helpers_path: str = None
) -> Dict[str, Any]:
    """Execute a JavaScript macro script using PyMiniRacer (V8 engine)"""
    print(f"[JS_EXECUTOR] Executing JavaScript macro: {macro_name} at: {script_path}")
    
    if not JS_AVAILABLE:
        print(f"[JS_EXECUTOR] WARNING: PyMiniRacer not available, cannot execute JavaScript macro {macro_name}")
        return {}
    
    try:
        # Read the JavaScript script
        with open(script_path, 'r') as f:
            script_code = f.read()
        
        print(f"[JS_EXECUTOR] Read JavaScript script, {len(script_code)} characters")
        
        # Create V8 context
        ctx = py_mini_racer.MiniRacer()
        
        # Convert input_data string to object
        try:
            parsed_input_data = json.loads(input_data)
            print(f"[JS_EXECUTOR] Successfully parsed input_data JSON")
            
            # If it's an array, take the first item
            if isinstance(parsed_input_data, list) and len(parsed_input_data) > 0:
                parsed_input_data = parsed_input_data[0]
                print(f"[JS_EXECUTOR] Taking first item from array")
            
        except json.JSONDecodeError as e:
            print(f"[JS_EXECUTOR] WARNING: Failed to parse input_data as JSON: {str(e)}")
            # Fall back to treating it as a plain string
            parsed_input_data = input_data
        
        # Add input data to context
        ctx.eval(f"var input_data = {json.dumps(parsed_input_data)};")
        ctx.eval(f"var json = {json.dumps(parsed_input_data)};")  # For compatibility

        # Add helper functions
        helpers = get_javascript_helpers(helpers_path)
        ctx.eval(helpers)
        print(f"[JS_EXECUTOR] Added JavaScript helper functions")
        
        # Wrap the macro script in a function to handle return statements
        wrapped_script = f"""
        function executeMacro() {{
            {script_code}
        }}
        
        // Execute the macro function and capture any return value
        var macroResult = executeMacro();
        
        // If the macro returned something, use it as output, otherwise use the global output
        if (macroResult !== undefined) {{
            output = macroResult;
        }}
        """
        
        # Execute the wrapped macro script
        ctx.eval(wrapped_script)
        print(f"[JS_EXECUTOR] Executed JavaScript macro script")
        
        # Get the output object
        output_json = ctx.eval("JSON.stringify(output)")
        result = json.loads(output_json) if output_json and output_json != "undefined" else {}
        print(f"[JS_EXECUTOR] PyMiniRacer execution completed, output: {len(str(result))} characters")
        return result
        
    except Exception as e:
        print(f"[JS_EXECUTOR] ERROR in JavaScript macro execution: {str(e)}")
        raise


def get_javascript_helpers(helpers_path: str = None) -> str:
    """
    Load JavaScript helper functions from external file
    
    Args:
        helpers_path: Path to the helpers.js file. If None, uses default location.
        
    Returns:
        String containing all JavaScript helper functions
        
    Raises:
        FileNotFoundError: If helpers file is not found
        IOError: If helpers file cannot be read
    """
    if helpers_path is None:
        # Default to the helpers.js file in the helpers directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        helpers_path = os.path.join(os.path.dirname(current_dir), "helpers", "helpers.js")
    
    if not os.path.exists(helpers_path):
        raise FileNotFoundError(f"JavaScript helpers file not found at: {helpers_path}")
    
    try:
        with open(helpers_path, 'r') as f:
            helpers_content = f.read()
        print(f"[JS_EXECUTOR] Loaded JavaScript helpers from: {helpers_path}")
        return helpers_content
    except Exception as e:
        raise IOError(f"Failed to read JavaScript helpers file {helpers_path}: {str(e)}")