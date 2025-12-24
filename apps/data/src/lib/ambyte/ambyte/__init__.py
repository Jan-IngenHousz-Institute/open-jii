"""
Ambyte Data Processing Package

This package provides Ambyte trace file processing capabilities for openJII.
It includes parsing and volume I/O utilities for Databricks Delta Live Tables pipeline.
"""

# Import the main functions from modules to make them directly accessible
from .ambyte_parsing import process_trace_files, find_byte_folders, load_files_per_byte
from .volume_io import discover_and_validate_upload_directories, parse_upload_time
    
# Define what gets imported with "from ambyte import *"
__all__ = [
    'process_trace_files',
    'find_byte_folders',
    'load_files_per_byte',
    'discover_and_validate_upload_directories',
    'parse_upload_time'
]

# Package metadata
__version__ = "0.1.0"
__author__ = "openJII Team"
