"""
Ambyte Data Processing Package

This package provides Ambyte trace file processing capabilities for OpenJII.
It includes parsing and volume I/O utilities for Databricks Delta Live Tables pipeline.
"""

# Import the main functions from modules to make them directly accessible
from .ambyte_parsing import parse_trace, process_trace_files
from .volume_io import parse_upload_time, prepare_ambyte_files

# Define what gets imported with "from ambyte import *"
__all__ = [
    'parse_trace', 
    'process_trace_files',
    'parse_upload_time',
    'prepare_ambyte_files'
]

# Package metadata
__version__ = "0.1.0"
__author__ = "OpenJII Team"