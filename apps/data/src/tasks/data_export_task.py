# Databricks notebook source
# DBTITLE 1,Data Export Task
# Standalone task to export experiment table data in multiple formats (CSV, NDJSON, JSON Array, Parquet)
# This task runs independently and outputs files to Unity Catalog volumes

# COMMAND ----------

# DBTITLE 1,Imports
import json
import logging
import uuid
from datetime import datetime
from typing import Optional
from pyspark.sql import SparkSession
from pyspark.sql.functions import to_json, col, lit
from pyspark.sql.types import StructType, ArrayType, MapType
from pyspark.dbutils import DBUtils

# Import openjii utilities
import sys
sys.path.append("/Workspace/Repos/open-jii/apps/data/src/lib/openjii")
from openjii.helpers import load_experiment_table

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Task Configuration
# Required parameters
EXPERIMENT_ID = dbutils.widgets.get("EXPERIMENT_ID")
TABLE_NAME = dbutils.widgets.get("TABLE_NAME")
CATALOG_NAME = dbutils.widgets.get("CATALOG_NAME")
FORMAT = dbutils.widgets.get("FORMAT").lower()  # csv, ndjson, json-array, or parquet
USER_ID = dbutils.widgets.get("USER_ID")  # User who initiated the export
ENVIRONMENT = dbutils.widgets.get("ENVIRONMENT") if dbutils.widgets.get("ENVIRONMENT") else "DEV"

# Generate unique export ID within the task
EXPORT_ID = str(uuid.uuid4())

spark = SparkSession.builder.getOrCreate()
dbutils = DBUtils(spark)

# Metadata table for tracking exports
EXPORT_METADATA_TABLE = f"{CATALOG_NAME}.centrum.experiment_export_metadata"

# Generate write timestamp
write_time = datetime.now().strftime("%Y%m%d_%H%M%S")

# Output paths
# Structure: /Volumes/{catalog}/centrum/data-downloads/{experiment_id}/{table_name}/{format}/{export_id}/
VOLUME_BASE_PATH = f"/Volumes/{CATALOG_NAME}/centrum/data-downloads"
OUTPUT_BASE_PATH = f"{VOLUME_BASE_PATH}/{EXPERIMENT_ID}/{TABLE_NAME}/{FORMAT}"
OUTPUT_PATH = f"{OUTPUT_BASE_PATH}/{EXPORT_ID}"

logger.info(f"Exporting data for experiment: {EXPERIMENT_ID}")
logger.info(f"Table name: {TABLE_NAME}")
logger.info(f"Format: {FORMAT}")
logger.info(f"Export ID: {EXPORT_ID}")
logger.info(f"Catalog: {CATALOG_NAME}")
logger.info(f"Output path: {OUTPUT_PATH}")

# COMMAND ----------

# DBTITLE 1,Load Data
def load_data():
    """
    Load experiment data using openjii utility.
    This handles all variant parsing and column selection automatically.
    """
    try:
        logger.info(f"Loading experiment data using openjii utility")
        
        # Use openjii utility to load data with proper variant parsing
        df = load_experiment_table(
            experiment_id=EXPERIMENT_ID,
            table_name=TABLE_NAME,
            catalog_name=CATALOG_NAME,
            schema_name="centrum"
        )
        
        row_count = df.count()
        logger.info(f"Loaded {row_count} rows with parsed variants")
        
        if row_count == 0:
            logger.warning("No data found matching the criteria")
        
        return df, row_count
    
    except Exception as e:
        logger.error(f"Error loading data: {e}")
        raise

# COMMAND ----------

# DBTITLE 1,Export Data
def export_data(df):
    """
    Export data in the requested format
    """
    try:
        logger.info(f"Exporting to {FORMAT.upper()}: {OUTPUT_PATH}")
        
        if FORMAT == "csv":
            # CSV doesn't support complex types (structs, arrays, maps)
            # Convert them to JSON strings
            for field in df.schema.fields:
                if isinstance(field.dataType, (StructType, ArrayType, MapType)):
                    df = df.withColumn(field.name, to_json(col(field.name)))
            
            df.coalesce(1).write.mode("overwrite").option("header", True).csv(OUTPUT_PATH)
        elif FORMAT == "ndjson":
            # Write as newline-delimited JSON (NDJSON/JSONL)
            # Each line is a valid JSON object, which is standard for big data exports
            # and compatible with most data processing tools
            df.coalesce(1).write.mode("overwrite").json(OUTPUT_PATH)
        elif FORMAT == "json-array":
            # Write as a proper JSON array: [{}, {}, ...]
            # Collects all rows to the driver — suitable for reasonably sized exports.
            # We write into a Spark-style partitioned directory so the output layout
            # (single data file + _SUCCESS marker) matches csv/ndjson/parquet, which
            # keeps get_export_file_path() and the downstream download flow consistent.
            rows = [row.asDict(recursive=True) for row in df.collect()]
            dbutils.fs.put(f"{OUTPUT_PATH}/part-00000.json", json.dumps(rows, default=str), overwrite=True)
            dbutils.fs.put(f"{OUTPUT_PATH}/_SUCCESS", "", overwrite=True)
        elif FORMAT == "parquet":
            df.coalesce(1).write.mode("overwrite").parquet(OUTPUT_PATH)
        else:
            raise ValueError(f"Unsupported format: {FORMAT}")
        
        logger.info(f"{FORMAT.upper()} export completed")
        return OUTPUT_PATH
    
    except Exception as e:
        logger.error(f"Error exporting data: {e}")
        raise

# COMMAND ----------

# DBTITLE 1,Get File Path
def _strip_dbfs_prefix(path):
    """
    Strip the "dbfs:" prefix that Spark/dbutils adds to file paths.
    The Databricks Files API (used by the backend for downloads) requires
    plain /Volumes/... paths, so we normalise them here before persisting.
    """
    if path and path.startswith("dbfs:"):
        return path[len("dbfs:"):]
    return path


def get_export_file_path(directory_path):
    """
    Get the actual file path from the export directory.
    Returns a clean path with the dbfs: prefix stripped.
    """
    try:
        # List files in the directory
        files = dbutils.fs.ls(directory_path)
        
        # Filter out metadata files and get actual data files
        data_files = [
            f.path for f in files 
            if not f.name.startswith("_") and not f.name.startswith(".")
        ]
        
        if data_files:
            # For single file output, return the file path
            # For multi-part output, return the directory path
            if len(data_files) == 1:
                logger.info(f"Found single data file")
                return _strip_dbfs_prefix(data_files[0])
            else:
                logger.info(f"Found {len(data_files)} data files")
                return _strip_dbfs_prefix(directory_path)
        else:
            logger.warning(f"No data files found in {directory_path}")
            return _strip_dbfs_prefix(directory_path)
            
    except Exception as e:
        logger.error(f"Error listing files: {e}")
        return _strip_dbfs_prefix(directory_path)

# COMMAND ----------

# DBTITLE 1,Create Export Metadata on Completion
def create_export_metadata(file_path, row_count):
    """
    Create export metadata record with completion status.
    This is called ONLY when the export completes successfully.
    In-progress exports are tracked via Databricks job runs API, not in this table.
    """
    try:
        logger.info(f"Creating export metadata for export_id: {EXPORT_ID}")
        
        # Calculate file size if possible
        try:
            files = dbutils.fs.ls(file_path)
            file_size = sum(f.size for f in files if not f.name.startswith("_") and not f.name.startswith("."))
        except Exception as e:
            logger.warning(f"Could not calculate file size: {e}")
            file_size = None
        
        # Get current timestamp
        completed_at = datetime.now()
        
        # Insert metadata record with status='completed'
        if file_size is not None:
            insert_query = f"""
            INSERT INTO {EXPORT_METADATA_TABLE}
            (export_id, experiment_id, table_name, format, status, file_path, row_count, file_size, created_by, created_at, completed_at)
            VALUES ('{EXPORT_ID}', '{EXPERIMENT_ID}', '{TABLE_NAME}', '{FORMAT}', 'completed', '{file_path}', {row_count}, {file_size}, '{USER_ID}', '{completed_at.isoformat()}', '{completed_at.isoformat()}')
            """
        else:
            insert_query = f"""
            INSERT INTO {EXPORT_METADATA_TABLE}
            (export_id, experiment_id, table_name, format, status, file_path, row_count, created_by, created_at, completed_at)
            VALUES ('{EXPORT_ID}', '{EXPERIMENT_ID}', '{TABLE_NAME}', '{FORMAT}', 'completed', '{file_path}', {row_count}, '{USER_ID}', '{completed_at.isoformat()}', '{completed_at.isoformat()}')
            """
        
        spark.sql(insert_query)
        
        logger.info(f"Export metadata created successfully with status='completed'")
        
    except Exception as e:
        logger.error(f"Error creating export metadata: {e}")
        # Don't fail the job if metadata creation fails
        pass

# COMMAND ----------

# DBTITLE 1,Main Execution
def main():
    """
    Main execution function
    """
    logger.info("="*80)
    logger.info("Starting data export task")
    logger.info("="*80)
    
    # Load data
    df, row_count = load_data()
    
    if row_count == 0:
        logger.warning("No data to export")
        dbutils.notebook.exit({"status": "no_data", "row_count": 0})
        return
    
    # Export data in requested format
    output_path = export_data(df)
    
    # Get actual file path
    file_path = get_export_file_path(output_path)
    
    # Create export metadata record
    create_export_metadata(file_path, row_count)
    
    # Prepare output
    output = {
        "status": "success",
        "row_count": row_count,
        "experiment_id": EXPERIMENT_ID,
        "table_name": TABLE_NAME,
        "format": FORMAT,
        "export_id": EXPORT_ID,
        "write_time": write_time,
        "file_path": file_path,
    }
    
    logger.info("="*80)
    logger.info("Data export task completed successfully")
    logger.info(f"Total rows exported: {row_count}")
    logger.info(f"Format: {FORMAT.upper()}")
    logger.info(f"File path: {file_path}")
    logger.info("="*80)
    
    # Return results as notebook exit value
    dbutils.notebook.exit(output)

# Run main
main()
