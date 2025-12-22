# Databricks notebook source
# DBTITLE 1,Centrum Raw Data Backup Task
# Creates incremental backups of raw_data table from centrum schema
# Backs up data directly to S3 external location (survives catalog deletion)
# Maintains only the 10 most recent backups

# COMMAND ----------

# DBTITLE 1,Imports
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from delta.tables import DeltaTable
from datetime import datetime, timezone
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Configuration
# Get configuration from widgets
CATALOG_NAME = dbutils.widgets.get("CATALOG_NAME")
CENTRAL_SCHEMA = dbutils.widgets.get("CENTRAL_SCHEMA")
SOURCE_TABLE = dbutils.widgets.get("SOURCE_TABLE")
BACKUP_LOCATION = dbutils.widgets.get("BACKUP_LOCATION")
ENVIRONMENT = dbutils.widgets.get("ENVIRONMENT")

# Backup retention configuration
MAX_BACKUPS_TO_KEEP = 90  # Keep only the 90 most recent backups

# Initialize Spark session
spark = SparkSession.builder.getOrCreate()

# Construct full table name
source_table_full = f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.{SOURCE_TABLE}"

# Metadata stored in S3 alongside backups (survives catalog deletion)
metadata_location = f"{BACKUP_LOCATION}_metadata"

# Generate backup timestamp (filesystem-friendly format)
backup_timestamp = datetime.now(timezone.utc)
backup_timestamp_str = backup_timestamp.strftime("%Y%m%d_%H%M%S")
backup_date = backup_timestamp.strftime("%Y-%m-%d")
backup_hour = backup_timestamp.strftime("%H")

logger.info(f"Starting backup for table: {source_table_full}")
logger.info(f"Backup location (S3): {BACKUP_LOCATION}")
logger.info(f"Metadata location (S3): {metadata_location}")
logger.info(f"Backup timestamp: {backup_timestamp}")
logger.info(f"Max backups to keep: {MAX_BACKUPS_TO_KEEP}")

# COMMAND ----------

# DLTITLE 1,Backup Strategy
"""
This backup implements a full snapshot strategy writing directly to S3:
1. Reads entire source table (full snapshot)
2. Writes directly to S3 external location as Delta format
3. Each backup is timestamped and independent
4. Maintains only the N most recent backups
5. Everything survives catalog/schema deletion since all data is in external S3
"""

# COMMAND ----------

# DBTITLE 1,Perform Full Snapshot Backup
def perform_backup():
    """
    Perform full snapshot backup of raw_data table directly to S3.
    Maintains only the most recent backups.
    """
    logger.info("Starting full snapshot backup...")
    
    # Read entire source table (full snapshot)
    source_df = spark.read.table(source_table_full)
    
    # Count records
    record_count = source_df.count()
    logger.info(f"Records to backup: {record_count}")
    
    if record_count == 0:
        logger.info("No data to backup (table is empty)")
        return {
            "status": "success",
            "records_backed_up": 0,
            "message": "No data to backup"
        }
    
    # Add backup metadata columns
    backup_df = (
        source_df
        .withColumn("backup_timestamp", F.lit(backup_timestamp_str))
        .withColumn("backup_date", F.lit(backup_date))
        .withColumn("backup_hour", F.lit(backup_hour))
    )
    
    # Write directly to S3 external location as Delta
    logger.info(f"Writing {record_count} records directly to S3: {BACKUP_LOCATION}")
    (
        backup_df
        .write
        .format("delta")
        .mode("append")
        .option("mergeSchema", "true")
        .partitionBy("backup_date", "backup_hour")
        .save(BACKUP_LOCATION)
    )
    
    logger.info(f"Backup completed successfully. Records backed up: {record_count}")
    
    # Clean up old backups
    cleanup_old_backups()
    
    return {
        "status": "success",
        "records_backed_up": record_count,
        "backup_timestamp": backup_timestamp_str,
        "backup_location": BACKUP_LOCATION
    }

# COMMAND ----------

# DBTITLE 1,Cleanup Old Backups
def cleanup_old_backups():
    """
    Delete old backups, keeping only the most recent N backups.
    """
    try:
        logger.info(f"Starting cleanup: keeping {MAX_BACKUPS_TO_KEEP} most recent backups")
        
        # Read backup data to get distinct backup timestamps
        backup_df = spark.read.format("delta").load(BACKUP_LOCATION)
        
        # Get all distinct backup timestamps, ordered newest to oldest
        distinct_backups = (
            backup_df
            .select("backup_timestamp")
            .distinct()
            .orderBy(F.col("backup_timestamp").desc())
            .collect()
        )
        
        backup_count = len(distinct_backups)
        logger.info(f"Found {backup_count} distinct backup timestamps")
        
        if backup_count <= MAX_BACKUPS_TO_KEEP:
            logger.info(f"Current backup count ({backup_count}) is within limit. No cleanup needed.")
            return
        
        # Get timestamps to delete (everything after the Nth most recent)
        backups_to_delete = distinct_backups[MAX_BACKUPS_TO_KEEP:]
        delete_timestamps = [row['backup_timestamp'] for row in backups_to_delete]
        
        logger.info(f"Deleting {len(delete_timestamps)} old backups")
        
        # Load as Delta table for deletion
        delta_table = DeltaTable.forPath(spark, BACKUP_LOCATION)
        
        # Delete old backups
        for ts in delete_timestamps:
            logger.info(f"Deleting backup from: {ts}")
            delta_table.delete(F.col("backup_timestamp") == F.lit(ts))
        
        # Optimize after deletion
        logger.info("Optimizing table after deletion...")
        delta_table.optimize().executeCompaction()
        
        # Vacuum to remove deleted files (7 day retention)
        logger.info("Vacuuming deleted files (7 day retention)...")
        delta_table.vacuum(168)
        
        logger.info(f"Cleanup completed. Kept {MAX_BACKUPS_TO_KEEP} most recent backups, deleted {len(delete_timestamps)} old backups")
        
    except Exception as e:
        logger.error(f"Failed to cleanup old backups: {e}")
        logger.warning("Continuing despite cleanup failure")

# COMMAND ----------

# DLTITLE 1,Execute Backup
try:
    # Perform full snapshot backup (writes directly to S3 and cleans up old backups)
    result = perform_backup()
    
    # Log results
    logger.info(f"Backup result: {result}")
    
    # Output result for job status (use json for proper formatting)
    import json
    dbutils.notebook.exit(json.dumps(result))
    
except Exception as e:
    error_msg = f"Backup failed with error: {str(e)}"
    logger.error(error_msg)
    
    import json
    dbutils.notebook.exit(json.dumps({"status": "failed", "error": error_msg}))

# COMMAND ----------

# DLTITLE 1,Backup Maintenance and Recovery
"""
Maintenance tasks and recovery procedures:

1. List all backups:
   SELECT DISTINCT backup_timestamp, COUNT(*) as record_count
   FROM delta.`{BACKUP_LOCATION}`
   GROUP BY backup_timestamp
   ORDER BY backup_timestamp DESC;

2. Query backup statistics:
   SELECT 
     backup_date,
     COUNT(*) as record_count,
     COUNT(DISTINCT experiment_id) as experiment_count,
     MIN(timestamp) as earliest_record,
     MAX(timestamp) as latest_record
   FROM delta.`{BACKUP_LOCATION}`
   GROUP BY backup_date
   ORDER BY backup_date DESC;

4. Restore from backup (create new table):
   CREATE TABLE {CATALOG_NAME}.{CENTRAL_SCHEMA}.raw_data_restored
   USING DELTA
   LOCATION '{BACKUP_LOCATION}';

5. Restore specific backup:
   CREATE OR REPLACE TABLE {CATALOG_NAME}.{CENTRAL_SCHEMA}.raw_data_restored AS
   SELECT * FROM delta.`{BACKUP_LOCATION}`
   WHERE backup_timestamp = '2025-12-19 08:00:00';

6. Verify backup integrity:
   SELECT COUNT(*) FROM delta.`{BACKUP_LOCATION}`;

Note: 
- Backups are full snapshots stored in external S3 location: {BACKUP_LOCATION}
- Each backup is independent and contains complete table state at that time
- Only the {MAX_BACKUPS_TO_KEEP} most recent backups are retained
- Everything survives catalog/schema deletion
- Direct S3 access available if needed
"""
