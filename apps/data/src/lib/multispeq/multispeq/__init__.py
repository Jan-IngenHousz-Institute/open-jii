"""
MultispeQ Macro Processing Package

This package provides macro execution capabilities for openJII MultispeQ data processing.
It includes support for both JavaScript and Python macros.
"""

# Import the main functions from core to make them directly accessible
from .core import execute_macro_script, get_available_macros, process_macro_output_for_spark, infer_macro_schema

# Define what gets imported with "from multispeq import *"
__all__ = ['execute_macro_script', 'get_available_macros', 'process_macro_output_for_spark', 'infer_macro_schema']

# Package metadata
__version__ = "0.1.0"
__author__ = "openJII Team"
