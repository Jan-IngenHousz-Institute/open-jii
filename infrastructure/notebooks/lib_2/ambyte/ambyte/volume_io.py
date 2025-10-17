"""
Volume I/O utilities for Databricks Delta Live Tables pipeline.
Contains file system operations and directory discovery logic.
"""

import os
import re
from datetime import datetime
from typing import List, Optional, Tuple


def find_upload_directories(base_path: str) -> List[str]:
    """
    Find all upload directories with the format upload_YYYYMMDD_SS in the given base path.
    
    Args:
        base_path: The base path to search for upload directories
        
    Returns:
        List of full paths to upload directories
    """
    upload_directories = []
    
    try:
        if os.path.exists(base_path):
            for item in os.listdir(base_path):
                item_path = os.path.join(base_path, item)
                if os.path.isdir(item_path) and item.startswith("upload_"):
                    upload_directories.append(item_path)
    except Exception as e:
        print(f"Error accessing volume or finding upload directories: {e}")
        
    return upload_directories


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


def discover_and_validate_upload_directories(base_path: str) -> Tuple[List[str], bool]:
    """
    Discover upload directories and validate their existence.
    
    Args:
        base_path: The base path to search for upload directories
        
    Returns:
        Tuple of (list of upload directories, success flag)
    """
    upload_directories = find_upload_directories(base_path)
    
    if upload_directories:
        print(f"Found {len(upload_directories)} upload directories")
        print(f"Upload directories: {[os.path.basename(x) for x in upload_directories]}")
        return upload_directories, True
    else:
        print("No upload directories found")
        return [], False
