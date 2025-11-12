"""
Python Macro Executor

This module provides Python macro execution capabilities in a sandboxed environment.
Extracted from the main macro.py module for better organization and maintainability.
"""

import os
import json
import math
import statistics
from typing import Dict, Any, Callable

# Import importlib for dynamic module loading
import importlib.util

def execute_python_macro(script_path: str, input_data: str) -> Dict[str, Any]:
    """Execute a Python macro script in a restricted environment"""
    
    print(f"[PY_EXECUTOR] Executing Python macro at: {script_path}")
    print(f"[PY_EXECUTOR] Input data size: {len(input_data)} characters")
    
    # Create a restricted set of safe built-in functions
    safe_builtins = {
        # Basic types and constructors
        'bool': bool,
        'int': int,
        'float': float,
        'str': str,
        'list': list,
        'dict': dict,
        'tuple': tuple,
        'set': set,
        
        # Safe functions
        'len': len,
        'min': min,
        'max': max,
        'sum': sum,
        'abs': abs,
        'round': round,
        'sorted': sorted,
        'reversed': reversed,
        'enumerate': enumerate,
        'zip': zip,
        'range': range,
        'any': any,
        'all': all,
        'isinstance': isinstance,  # Required by helper functions for type checking
        'print': print,  # Required by helper functions for logging warnings/errors
        
        # Safe math functions (from math module)
        'pow': pow,
        
        # Exception handling
        'Exception': Exception,
        'ValueError': ValueError,
        'TypeError': TypeError,
        'IndexError': IndexError,
        'KeyError': KeyError,
    }
    
    # Add safe math functions
    safe_math_functions = {
        'math_sqrt': math.sqrt,
        'math_log': math.log,
        'math_exp': math.exp,
        'math_sin': math.sin,
        'math_cos': math.cos,
        'math_tan': math.tan,
        'math_floor': math.floor,
        'math_ceil': math.ceil,
        'math_pi': math.pi,
        'math_e': math.e,
    }
    
    # Add safe modules that can be imported directly
    safe_modules = {
        'math': math,
        'json': json,
        'statistics': statistics,
    }
    
    # Try to add numpy and scipy if available
    try:
        import numpy as np
        safe_modules['numpy'] = np
        safe_modules['np'] = np
        print(f"[PY_EXECUTOR] Added NumPy to execution context")
    except ImportError:
        print(f"[PY_EXECUTOR] NumPy not available in execution context")
    
    try:
        import scipy
        safe_modules['scipy'] = scipy
        print(f"[PY_EXECUTOR] Added SciPy to execution context")
    except ImportError:
        print(f"[PY_EXECUTOR] SciPy not available in execution context")
    
    # Load Python helper functions
    python_helpers = get_python_helpers()
    print(f"[PY_EXECUTOR] Loaded {len(python_helpers)} Python helper functions")
    
    # Convert input_data string to object
    try:
        parsed_input_data = json.loads(input_data)
        print(f"[PY_EXECUTOR] Successfully parsed input_data JSON")
        
        # If it's an array, take the first item
        if isinstance(parsed_input_data, list) and len(parsed_input_data) > 0:
            parsed_input_data = parsed_input_data[0]
            print(f"[PY_EXECUTOR] Taking first item from array")
        
    except json.JSONDecodeError as e:
        print(f"[PY_EXECUTOR] WARNING: Failed to parse input_data as JSON: {str(e)}")
        # Fall back to treating it as a plain string
        parsed_input_data = input_data
    
    # Create restricted execution environment
    exec_globals = {
        '__builtins__': safe_builtins,
        'input_data': parsed_input_data,
        'output': {},
        # Add safe math functions
        **safe_math_functions,
        # Add safe modules
        **safe_modules,
        # Add Python helper functions
        **python_helpers,
    }
    
    # Read and execute the Python script
    try:
        with open(script_path, 'r') as f:
            script_code = f.read()
        
        print(f"[PY_EXECUTOR] Read Python script, {len(script_code)} characters")
        
        # Add compatibility alias for JavaScript-style macros
        exec_globals['json'] = parsed_input_data
        
        # Wrap the macro in a function and execute it
        import textwrap
        wrapped_code = f"""
def execute_macro():
{textwrap.indent(script_code, '    ')}

result = execute_macro()
if isinstance(result, dict):
    output.update(result)
"""
        
        exec(wrapped_code, exec_globals)
        
        # Get the output
        result = exec_globals.get('output', {})
        print(f"[PY_EXECUTOR] Python macro execution completed, output: {len(str(result))} characters")
        return result
        
    except Exception as e:
        print(f"[PY_EXECUTOR] ERROR in Python macro execution: {str(e)}")
        raise


def get_python_helpers(helpers_path: str = None) -> Dict[str, Callable]:
    """
    Load Python helper functions from the helpers.py module
    
    Args:
        helpers_path: Path to the helpers.py file. If None, uses default location.
        
    Returns:
        Dictionary containing all Python helper functions
        
    Raises:
        FileNotFoundError: If helpers file is not found
        ImportError: If helpers file cannot be imported
    """
    if helpers_path is None:
        # Default to the helpers.py file in the helpers directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        helpers_path = os.path.join(os.path.dirname(current_dir), "helpers", "helpers.py")
    
    if not os.path.exists(helpers_path):
        print(f"[PY_EXECUTOR] WARNING: Python helpers file not found at: {helpers_path}")
        return {}
    
    try:
        # Import the helpers module dynamically
        spec = importlib.util.spec_from_file_location("helpers", helpers_path)
        helpers_module = importlib.util.module_from_spec(spec)
        
        # Execute the module to load all functions
        spec.loader.exec_module(helpers_module)
        
        # Extract all callable functions from the module
        helper_functions = {}
        for name in dir(helpers_module):
            obj = getattr(helpers_module, name)
            if callable(obj) and not name.startswith('_'):
                helper_functions[name] = obj
        
        print(f"[PY_EXECUTOR] Loaded Python helpers from: {helpers_path}")
        print(f"[PY_EXECUTOR] Available helper functions: {list(helper_functions.keys())}")
        return helper_functions
        
    except Exception as e:
        print(f"[PY_EXECUTOR] WARNING: Failed to load Python helpers file {helpers_path}: {str(e)}")
        # Return empty dict instead of raising to allow macros to run without helpers
        return {}