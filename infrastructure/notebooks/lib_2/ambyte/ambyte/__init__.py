"""
Ambyte Data Processing Package

This package provides Ambyte trace file processing capabilities for OpenJII.
It includes parsing and volume I/O utilities for Databricks Delta Live Tables pipeline.
"""

# Import the main functions from modules to make them directly accessible
from .ambyte_parsing import process_trace_files
from .volume_io import prepare_ambyte_files
    
# Define what gets imported with "from ambyte import *"
__all__ = [
    'process_trace_files',
    'prepare_ambyte_files',
]

# Package metadata
__version__ = "0.1.0"
__author__ = "OpenJII Team"