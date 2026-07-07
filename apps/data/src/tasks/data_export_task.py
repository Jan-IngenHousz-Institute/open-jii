# Databricks notebook source
# DBTITLE 1,Data Export Task
# Standalone task to export experiment table data in multiple formats (CSV, NDJSON, JSON Array, Parquet, Excel)
# This task runs independently and outputs files to Unity Catalog volumes

# COMMAND ----------

# DBTITLE 1,Imports
import json
import uuid
from datetime import datetime
from typing import Optional
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.functions import to_json, col, lit, expr, when, struct
from pyspark.sql.types import StructType, ArrayType, MapType, VariantType, StringType
from pyspark.dbutils import DBUtils

# Import openjii utilities
import sys
sys.path.append("/Workspace/Repos/open-jii/apps/data/src/lib/openjii")
from openjii.helpers import load_experiment_table

# Use print() for logging — Databricks captures stdout/stderr from the
# driver on the compute cluster, but the Python logging module is often
# swallowed (especially when running as a Databricks task/workflow).
def log(msg: str, level: str = "INFO"):
    print(f"[{level}] {msg}", flush=True)

# COMMAND ----------

# DBTITLE 1,Task Configuration
# Required parameters
EXPERIMENT_ID = dbutils.widgets.get("EXPERIMENT_ID")
TABLE_NAME = dbutils.widgets.get("TABLE_NAME")
CATALOG_NAME = dbutils.widgets.get("CATALOG_NAME")
FORMAT = dbutils.widgets.get("FORMAT").lower()  # csv, ndjson, json-array, parquet, or xlsx
USER_ID = dbutils.widgets.get("USER_ID")  # User who initiated the export
ENVIRONMENT = dbutils.widgets.get("ENVIRONMENT") if dbutils.widgets.get("ENVIRONMENT") else "DEV"
try:
    ANONYMIZE_CONTRIBUTORS = (dbutils.widgets.get("ANONYMIZE_CONTRIBUTORS") or "").lower() == "true"
except Exception:
    ANONYMIZE_CONTRIBUTORS = False

# Generate unique export ID within the task
EXPORT_ID = str(uuid.uuid4())

spark = SparkSession.builder.getOrCreate()
dbutils = DBUtils(spark)

# Metadata table for tracking exports
EXPORT_METADATA_TABLE = f"{CATALOG_NAME}.centrum.experiment_export_metadata"

# Generate write timestamp
write_time = datetime.now().strftime("%Y%m%d_%H%M%S")

# Output paths
# Structure: /Volumes/{catalog}/centrum/data-exports/{experiment_id}/{table_name}/{format}/{export_id}/
VOLUME_BASE_PATH = f"/Volumes/{CATALOG_NAME}/centrum/data-exports"
OUTPUT_BASE_PATH = f"{VOLUME_BASE_PATH}/{EXPERIMENT_ID}/{TABLE_NAME}/{FORMAT}"
OUTPUT_PATH = f"{OUTPUT_BASE_PATH}/{EXPORT_ID}"

log(f"Exporting data for experiment: {EXPERIMENT_ID}")
log(f"Table name: {TABLE_NAME}")
log(f"Format: {FORMAT}")
log(f"Export ID: {EXPORT_ID}")
log(f"Catalog: {CATALOG_NAME}")
log(f"Output path: {OUTPUT_PATH}")
log(f"Anonymise contributors: {ANONYMIZE_CONTRIBUTORS}")

# COMMAND ----------

# DBTITLE 1,Load Data
def load_data():
    """
    Load experiment data using openjii utility.
    This handles all variant parsing and column selection automatically.
    """
    try:
        log("Loading experiment data using openjii utility")
        
        # Use openjii utility to load data with proper variant parsing
        df = load_experiment_table(
            experiment_id=EXPERIMENT_ID,
            table_name=TABLE_NAME,
            catalog_name=CATALOG_NAME,
            schema_name="centrum"
        )
        
        row_count = df.count()
        log(f"Loaded {row_count} rows with parsed variants")
        
        if row_count == 0:
            log("No data found matching the criteria", "WARN")
        
        return df, row_count
    
    except Exception as e:
        log(f"Error loading data: {e}", "ERROR")
        raise

# COMMAND ----------

# DBTITLE 1,Anonymise Contributors
# Well-known CONTRIBUTOR struct: STRUCT<id: STRING, name: STRING, avatar: STRING>.
# Identifying by the full type signature mirrors the API's `WellKnownColumnTypes.CONTRIBUTOR`
# check, so a generic struct named "contributor" wouldn't get rewritten.
CONTRIBUTOR_STRUCT_FIELDS = ("id", "name", "avatar")


def _is_contributor_field(field) -> bool:
    """Match the well-known CONTRIBUTOR struct shape exactly."""
    if not isinstance(field.dataType, StructType):
        return False
    field_names = tuple(f.name for f in field.dataType.fields)
    if field_names != CONTRIBUTOR_STRUCT_FIELDS:
        return False
    return all(isinstance(f.dataType, StringType) for f in field.dataType.fields)


def anonymize_contributors(df: DataFrame, experiment_id: str) -> DataFrame:
    """
    Rewrite every CONTRIBUTOR-typed column in the dataframe to a deterministic
    pseudonym, matching the API's `ContributorAnonymizerService` exactly:

        Contributor-{upper(substring(sha256(experimentId:userId), 1, 6))}

    `id` and `name` both receive the pseudonym (no side-channel back to the
    real identity); `avatar` is nulled out. Null cells pass through.

    The Spark expression mirrors the JS `createHash("sha256").update(...).digest("hex").slice(0,6).toUpperCase()`
    pipeline: `sha2(..., 256)` returns lowercase hex, `substring(_, 1, 6)`
    takes the first 6 chars, `upper(_)` matches the `.toUpperCase()`.
    """
    contributor_fields = [f for f in df.schema.fields if _is_contributor_field(f)]
    if not contributor_fields:
        return df
    for field in contributor_fields:
        col_name = field.name
        # `concat('Contributor-', upper(substring(sha2(<experimentId>:<userId>, 256), 1, 6)))`
        pseudonym_expr = (
            f"concat('Contributor-', upper(substring(sha2(concat('{experiment_id}', ':', `{col_name}`.id), 256), 1, 6)))"
        )
        df = df.withColumn(
            col_name,
            when(
                col(col_name).isNotNull(),
                struct(
                    expr(pseudonym_expr).alias("id"),
                    expr(pseudonym_expr).alias("name"),
                    lit(None).cast(StringType()).alias("avatar"),
                ),
            ).otherwise(col(col_name)),
        )
        log(f"Anonymised contributor column: {col_name}")
    return df

# COMMAND ----------

# DBTITLE 1,Export Data
# Excel worksheets are hard-capped at 1,048,576 rows (incl. header) and 16,384 columns.
EXCEL_MAX_ROWS = 1_048_576
EXCEL_MAX_COLUMNS = 16_384


def flatten_complex_columns(df):
    """
    Serialise struct/array/map columns to JSON strings and cast VARIANT to string.
    Flat formats (CSV, Excel) can't hold nested types; VARIANT already stores JSON.
    """
    for field in df.schema.fields:
        if isinstance(field.dataType, (StructType, ArrayType, MapType)):
            df = df.withColumn(field.name, to_json(col(field.name)))
        elif isinstance(field.dataType, VariantType):
            df = df.withColumn(field.name, col(field.name).cast("string"))
    return df


def export_data(df, row_count):
    """
    Export data in the requested format
    """
    try:
        log(f"Exporting to {FORMAT.upper()}: {OUTPUT_PATH}")
        
        if FORMAT == "csv":
            df = flatten_complex_columns(df)
            df.coalesce(1).write.mode("overwrite").option("header", True).option("escape", '"').csv(OUTPUT_PATH)
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
        elif FORMAT == "xlsx":
            if row_count >= EXCEL_MAX_ROWS:
                raise ValueError(
                    f"Export has {row_count} rows, which exceeds Excel's {EXCEL_MAX_ROWS}-row "
                    "limit per sheet. Use CSV or Parquet for datasets this large."
                )
            column_count = len(df.columns)
            if column_count > EXCEL_MAX_COLUMNS:
                raise ValueError(
                    f"Export has {column_count} columns, which exceeds Excel's {EXCEL_MAX_COLUMNS}-column "
                    "limit per sheet. Use CSV or Parquet for tables this wide."
                )
            df = flatten_complex_columns(df)
            df.coalesce(1).write.mode("overwrite").format("excel").option("header", True).save(OUTPUT_PATH)
        else:
            raise ValueError(f"Unsupported format: {FORMAT}")
        
        log(f"{FORMAT.upper()} export completed")
        return OUTPUT_PATH
    
    except Exception as e:
        log(f"Error exporting data: {e}", "ERROR")
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
                log("Found single data file")
                return _strip_dbfs_prefix(data_files[0])
            else:
                log(f"Found {len(data_files)} data files")
                return _strip_dbfs_prefix(directory_path)
        else:
            log(f"No data files found in {directory_path}", "WARN")
            return _strip_dbfs_prefix(directory_path)
            
    except Exception as e:
        log(f"Error listing files: {e}", "ERROR")
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
        log(f"Creating export metadata for export_id: {EXPORT_ID}")
        
        # Calculate file size if possible
        try:
            files = dbutils.fs.ls(file_path)
            file_size = sum(f.size for f in files if not f.name.startswith("_") and not f.name.startswith("."))
        except Exception as e:
            log(f"Could not calculate file size: {e}", "WARN")
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
        
        log("Export metadata created successfully with status='completed'")
        
    except Exception as e:
        log(f"Error creating export metadata: {e}", "ERROR")
        # Don't fail the job if metadata creation fails
        pass

# COMMAND ----------

# DBTITLE 1,Main Execution
def main():
    """
    Main execution function
    """
    log("=" * 80)
    log("Starting data export task")
    log("=" * 80)
    
    # Load data
    df, row_count = load_data()

    if row_count == 0:
        log("No data to export", "WARN")
        dbutils.notebook.exit({"status": "no_data", "row_count": 0})
        return

    if ANONYMIZE_CONTRIBUTORS:
        df = anonymize_contributors(df, EXPERIMENT_ID)

    # Export data in requested format
    output_path = export_data(df, row_count)
    
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
    
    log("=" * 80)
    log("Data export task completed successfully")
    log(f"Total rows exported: {row_count}")
    log(f"Format: {FORMAT.upper()}")
    log(f"File path: {file_path}")
    log("=" * 80)
    
    # Return results as notebook exit value
    dbutils.notebook.exit(output)

# Run main
main()
