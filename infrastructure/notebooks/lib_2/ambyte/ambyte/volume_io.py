"""
Volume I/O utilities for Databricks Delta Live Tables pipeline.
Contains file system operations and directory discovery logic.
"""

import os
import re
from datetime import datetime
from typing import List, Optional, Tuple
from pyspark.sql import SparkSession
from pyspark.dbutils import DBUtils

# Initialize Spark and DBUtils for DBFS operations
spark = SparkSession.builder.getOrCreate()
dbutils = DBUtils(spark)

def parse_upload_time(upload_dir_name: str) -> Optional[datetime]:
    """
    Parse upload timestamp from directory name format: upload_YYYYMMDD_SS
    
    Args:
        upload_dir_name: Directory name like 'upload_20250901_01'
        
    Returns:
        datetime object representing the upload date (time set to midnight UTC)
        Returns None if parsing fails
    """
    try:
        # Extract date part from upload_YYYYMMDD_SS format
        match = re.match(r'upload_(\d{8})_\d{2}', upload_dir_name)
        if match:
            date_str = match.group(1)  # YYYYMMDD
            # Parse the date and set time to midnight UTC
            upload_date = datetime.strptime(date_str, '%Y%m%d')
            return upload_date
        else:
            print(f"Warning: Could not parse upload time from directory name: {upload_dir_name}")
            return None
    except Exception as e:
        print(f"Error parsing upload time from {upload_dir_name}: {e}")
        return None

def prepare_ambyte_files(files_data, upload_dir, ambyte_folder):
    """
    Prepare ambyte files from streaming data into files_per_byte structure for processing.
    
    This function handles ONLY the file organization workflow:
    1. Parse upload time for the folder
    2. Organize files into files_per_byte structure
    3. Return organized data for processing
    
    Args:
        files_data: File data structure for this ambyte folder
        upload_dir: Upload directory name
        ambyte_folder: Ambyte folder name
        
    Returns:
        Tuple of (files_per_byte, upload_time, ambyte_folder) or None if no valid files
    """
    try:
        # Parse upload time using existing utility
        upload_time = parse_upload_time(upload_dir)
        
        # Organize files into files_per_byte structure like existing logic
        files_per_byte = [[] for _ in range(4)]
        
        for file_info in files_data:
            content = file_info['content']
            ambit_index_str = file_info['ambit_index']
            
            # Convert content to lines format expected by existing parsing logic
            lines = content.split('\n')
            lines.append("EOF")
            
            if len(lines) <= 7:
                continue
            
            # Place in correct ambit slot
            if ambit_index_str and ambit_index_str.isdigit():
                ambit_index = int(ambit_index_str)
                if 1 <= ambit_index <= 4:
                    files_per_byte[ambit_index - 1].append(lines)
            else:
                # Unknown ambit case (put in first slot like existing logic)
                files_per_byte[0].append(lines)
        
        # Filter out empty slots
        files_per_byte = [lst for lst in files_per_byte if lst]
        
        if not files_per_byte:
            return None
            
        return files_per_byte, upload_time, ambyte_folder
        
    except Exception as e:
        print(f"Error organizing files for ambyte folder {ambyte_folder} in {upload_dir}: {e}")
        return None