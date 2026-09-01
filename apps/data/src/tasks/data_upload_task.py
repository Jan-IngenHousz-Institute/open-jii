# Databricks notebook source
# DBTITLE 1,Data Upload Task
# Dispatches an upload run to the right processor based on SOURCE_KIND.
# - csv/tsv/json/ndjson: pandas parse, encode each row as JSON in uploaded_data,
#   write parquet to processed-uploads (centrum pipeline ingests into
#   raw_uploaded_data with a parsed VARIANT column; nested per-row values preserved).
# - parquet: native Spark read (not pandas/pyarrow) so Databricks logical types
#   like VARIANT load; each row JSON-encoded into uploaded_data, same sink.
# - ambyte: parse ambyte trace folders and JSON-encode each measurement row
#           into uploaded_data; written to processed-uploads alongside the tabular sinks.
# Add more SOURCE_KIND handlers below as new upload formats are added.

# COMMAND ----------

# DBTITLE 1,Imports
import json
import logging
import os
from datetime import datetime, timezone

import pandas as pd
from pyspark.dbutils import DBUtils
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import LongType, StringType, StructField, StructType, TimestampType

from ambyte import find_byte_folders, load_files_per_byte, process_trace_files
from openjii.centrum.upload_queryability import (
    UploadQueryability,
    build_queryability_query,
    run_upload_lifecycle,
    wait_until_queryable,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Task Configuration
EXPERIMENT_ID = dbutils.widgets.get("EXPERIMENT_ID")
CATALOG_NAME = dbutils.widgets.get("CATALOG_NAME")
UPLOAD_DIRECTORY = dbutils.widgets.get("UPLOAD_DIRECTORY")
SOURCE_KIND = dbutils.widgets.get("SOURCE_KIND")

# Optional widgets (set only for some source kinds; not all paths use them).
def _optional_widget(name: str) -> str | None:
    try:
        value = dbutils.widgets.get(name)
        return value or None
    except Exception:
        return None


UPLOAD_TABLE_NAME = _optional_widget("UPLOAD_TABLE_NAME")
UPLOAD_TABLE_ID = _optional_widget("UPLOAD_TABLE_ID")
UPLOAD_ID = _optional_widget("UPLOAD_ID")
EXPERIMENT_NAME = _optional_widget("EXPERIMENT_NAME")
YEAR_PREFIX = _optional_widget("YEAR_PREFIX")
USER_ID = _optional_widget("USER_ID")
ENVIRONMENT = _optional_widget("ENVIRONMENT")
QUERYABILITY_TIMEOUT_SECONDS = 3600 if ENVIRONMENT == "DEV" else 900
QUERYABILITY_POLL_SECONDS = 15

# Mirrors the export-side history table; backend reads this to render an upload history.
UPLOAD_METADATA_TABLE = f"{CATALOG_NAME}.centrum.experiment_upload_metadata"

spark = SparkSession.builder.getOrCreate()
dbutils = DBUtils(spark)

logger.info(
    f"Data upload task starting: experiment_id={EXPERIMENT_ID} source_kind={SOURCE_KIND} "
    f"upload_dir={UPLOAD_DIRECTORY}"
)

# COMMAND ----------

# DBTITLE 1,Tabular Processor (csv/tsv/json/ndjson)
def _process_tabular_upload(label: str, extensions: tuple[str, ...], parser) -> dict:
    """Shared pipeline for tabular uploads: pandas parse → JSON-encode rows → write parquet.

    Per-kind functions just supply a label, accepted extensions, and a parser
    that takes a local filesystem path and returns a pandas DataFrame.
    """
    if not UPLOAD_TABLE_NAME:
        raise Exception(f"UPLOAD_TABLE_NAME is required for source_kind={label}")
    if not UPLOAD_TABLE_ID:
        raise Exception(f"UPLOAD_TABLE_ID is required for source_kind={label}")
    if not UPLOAD_ID:
        raise Exception(f"UPLOAD_ID is required for source_kind={label}")

    upload_base_path = (
        f"/Volumes/{CATALOG_NAME}/centrum/data-imports/{EXPERIMENT_ID}/uploads/{UPLOAD_DIRECTORY}"
    )
    processed_output_path = (
        f"/Volumes/{CATALOG_NAME}/centrum/data-imports/{EXPERIMENT_ID}/processed-uploads"
    )

    try:
        entries = dbutils.fs.ls(upload_base_path)
    except Exception as e:
        raise Exception(f"Upload directory not found: {upload_base_path}. Error: {e}")

    matched_files = [e.path for e in entries if e.path.lower().endswith(extensions)]
    if not matched_files:
        raise Exception(f"No {label} files found in {upload_base_path} (expected {extensions})")

    logger.info(f"Found {len(matched_files)} {label} file(s) to process")

    uploaded_at = datetime.now(timezone.utc)
    all_rows: list[dict] = []
    file_count = 0
    error_count = 0

    for path in matched_files:
        try:
            # pandas reads UC volumes via the /Volumes FUSE path; strip the dbfs:
            # scheme dbutils.fs.ls prepends. /dbfs only mounts DBFS, not volumes.
            local_path = path[len("dbfs:") :] if path.startswith("dbfs:") else path
            df = parser(local_path)
            df = df.where(pd.notnull(df), None)
            rows = df.to_dict(orient="records")
            logger.info(f"Parsed {os.path.basename(path)}: {len(rows)} rows")
            all_rows.extend(rows)
            file_count += 1
        except Exception as e:
            logger.error(f"Error parsing {path}: {e}")
            error_count += 1

    if not all_rows:
        raise Exception(f"No rows parsed from {file_count} files ({error_count} errors)")

    records = [
        {
            "experiment_id": EXPERIMENT_ID,
            "upload_table_id": UPLOAD_TABLE_ID,
            "upload_table_name": UPLOAD_TABLE_NAME,
            "upload_id": UPLOAD_ID,
            "created_by": USER_ID,
            "uploaded_at": uploaded_at,
            "uploaded_data": json.dumps(row, default=str),
            "row_index": i,
        }
        for i, row in enumerate(all_rows)
    ]

    schema = StructType([
        StructField("experiment_id", StringType(), True),
        StructField("upload_table_id", StringType(), True),
        StructField("upload_table_name", StringType(), True),
        StructField("upload_id", StringType(), True),
        StructField("created_by", StringType(), True),
        StructField("uploaded_at", TimestampType(), True),
        StructField("uploaded_data", StringType(), True),
        StructField("row_index", LongType(), True),
    ])

    spark_df = spark.createDataFrame(records, schema=schema)

    output_path = f"{processed_output_path}/upload_{UPLOAD_ID}"

    try:
        dbutils.fs.mkdirs(processed_output_path)
    except Exception:
        pass

    spark_df.write.mode("overwrite").parquet(output_path)

    logger.info(f"Saved {len(records)} rows to {output_path}")
    return {
        "rows_written": len(records),
        "files_processed": file_count,
        "files_failed": error_count,
        "output_path": output_path,
    }


def process_csv_upload() -> dict:
    return _process_tabular_upload("csv", (".csv",), pd.read_csv)


def process_tsv_upload() -> dict:
    return _process_tabular_upload("tsv", (".tsv",), lambda p: pd.read_csv(p, sep="\t"))


def process_parquet_upload() -> dict:
    """Parquet uploads via the native Spark reader (not pandas/pyarrow), so files
    written with newer parquet logical types (e.g. VARIANT in platform exports)
    load without a reader-version mismatch. Each row is JSON-encoded into
    uploaded_data with to_json(struct("*")), matching the shared parquet sink.
    Self-contained because the read path is Spark, not the pandas pipeline."""
    if not UPLOAD_TABLE_NAME:
        raise Exception("UPLOAD_TABLE_NAME is required for source_kind=parquet")
    if not UPLOAD_TABLE_ID:
        raise Exception("UPLOAD_TABLE_ID is required for source_kind=parquet")
    if not UPLOAD_ID:
        raise Exception("UPLOAD_ID is required for source_kind=parquet")

    upload_base_path = (
        f"/Volumes/{CATALOG_NAME}/centrum/data-imports/{EXPERIMENT_ID}/uploads/{UPLOAD_DIRECTORY}"
    )
    processed_output_path = (
        f"/Volumes/{CATALOG_NAME}/centrum/data-imports/{EXPERIMENT_ID}/processed-uploads"
    )

    try:
        entries = dbutils.fs.ls(upload_base_path)
    except Exception as e:
        raise Exception(f"Upload directory not found: {upload_base_path}. Error: {e}")

    matched_files = [e.path for e in entries if e.path.lower().endswith(".parquet")]
    if not matched_files:
        raise Exception(f"No parquet files found in {upload_base_path}")

    logger.info(f"Found {len(matched_files)} parquet file(s) to process")

    uploaded_at = datetime.now(timezone.utc)
    combined = None
    file_count = 0
    error_count = 0

    for path in matched_files:
        try:
            # Spark reads UC volumes via /Volumes; strip the dbfs: scheme dbutils adds.
            spark_path = path[len("dbfs:") :] if path.startswith("dbfs:") else path
            row_json = spark.read.parquet(spark_path).select(
                F.to_json(F.struct("*")).alias("uploaded_data")
            )
            combined = row_json if combined is None else combined.unionByName(row_json)
            file_count += 1
        except Exception as e:
            logger.error(f"Error parsing {path}: {e}")
            error_count += 1

    if combined is None:
        raise Exception(f"No rows parsed from {file_count} files ({error_count} errors)")

    result = combined.select(
        F.lit(EXPERIMENT_ID).cast("string").alias("experiment_id"),
        F.lit(UPLOAD_TABLE_ID).cast("string").alias("upload_table_id"),
        F.lit(UPLOAD_TABLE_NAME).cast("string").alias("upload_table_name"),
        F.lit(UPLOAD_ID).cast("string").alias("upload_id"),
        F.lit(USER_ID).cast("string").alias("created_by"),
        F.lit(uploaded_at).cast("timestamp").alias("uploaded_at"),
        F.col("uploaded_data"),
        # Unique per-row id within this upload; the task writes it, the gold table reads it.
        F.monotonically_increasing_id().alias("row_index"),
    )

    output_path = f"{processed_output_path}/upload_{UPLOAD_ID}"

    try:
        dbutils.fs.mkdirs(processed_output_path)
    except Exception:
        pass

    result.write.mode("overwrite").parquet(output_path)
    # Count the written output instead of result: a second action on the plan
    # would recompute it, and persist/cache is unsupported on serverless compute.
    row_count = spark.read.parquet(output_path).count()

    logger.info(f"Saved {row_count} rows to {output_path}")
    return {
        "rows_written": row_count,
        "files_processed": file_count,
        "files_failed": error_count,
        "output_path": output_path,
    }


def process_json_upload() -> dict:
    # Top-level array of objects; nested values per row are preserved (downstream
    # VARIANT handles arbitrary nesting, same shape macros work with).
    def _read_json_array(path: str):
        with open(path) as f:
            data = json.load(f)
        # A single top-level object is one record; wrap it so it lands as one row.
        if isinstance(data, dict):
            data = [data]
        if not isinstance(data, list):
            raise Exception(
                f"JSON must be an object or an array of objects, got {type(data).__name__}"
            )
        if data and not isinstance(data[0], dict):
            raise Exception("JSON array elements must be objects")
        return pd.DataFrame(data)

    return _process_tabular_upload("json", (".json",), _read_json_array)


def process_ndjson_upload() -> dict:
    # One JSON object per line; pandas read_json with lines=True preserves
    # nested dict/list values in cells, which json.dumps re-serialises into uploaded_data.
    return _process_tabular_upload(
        "ndjson", (".ndjson", ".jsonl"), lambda p: pd.read_json(p, lines=True)
    )

# COMMAND ----------

# DBTITLE 1,Ambyte Processor
def process_ambyte_upload() -> dict:
    """Parse ambyte trace folders into rows, encode each row as JSON in uploaded_data,
    and write a single parquet under processed-uploads — same sink as the tabular
    processors. The downstream raw_uploaded_data / experiment_uploaded_data DLT
    tables ingest these alongside csv/tsv/parquet/json/ndjson uploads."""
    if not YEAR_PREFIX:
        raise Exception("YEAR_PREFIX is required for source_kind=ambyte")
    if not UPLOAD_TABLE_NAME:
        raise Exception("UPLOAD_TABLE_NAME is required for source_kind=ambyte")
    if not UPLOAD_TABLE_ID:
        raise Exception("UPLOAD_TABLE_ID is required for source_kind=ambyte")
    if not UPLOAD_ID:
        raise Exception("UPLOAD_ID is required for source_kind=ambyte")

    # Ambyte files land under the shared "uploads" volume dir (the backend uses
    # volumeSourceType="uploads" for every kind), not a dedicated ambyte dir.
    ambyte_base_path = (
        f"/Volumes/{CATALOG_NAME}/centrum/data-imports/{EXPERIMENT_ID}/uploads/{UPLOAD_DIRECTORY}"
    )
    processed_output_path = (
        f"/Volumes/{CATALOG_NAME}/centrum/data-imports/{EXPERIMENT_ID}/processed-uploads"
    )

    try:
        dbutils.fs.ls(ambyte_base_path)
    except Exception as e:
        raise Exception(f"Ambyte directory not found: {ambyte_base_path}. Error: {e}")

    logger.info(f"Processing ambyte directory: {ambyte_base_path}")

    processed_count = 0
    error_count = 0
    combined_dataframes = []

    try:
        byte_parent_folders = find_byte_folders(ambyte_base_path)
    except Exception as e:
        raise Exception(f"Error finding byte folders in {ambyte_base_path}: {e}")

    if not byte_parent_folders:
        raise Exception(f"No valid byte parent folders found in {ambyte_base_path}")

    logger.info(f"Found {len(byte_parent_folders)} valid byte parent folder(s)")

    # Ambyte files are named by their record date, which can trail into the previous
    # calendar year; accept both the upload year and the one before it.
    year_prefixes = (YEAR_PREFIX, str(int(YEAR_PREFIX) - 1))

    for ambyte_folder in byte_parent_folders:
        ambyte_folder_name = os.path.basename(ambyte_folder.rstrip("/"))
        try:
            files_per_byte, _ = load_files_per_byte(ambyte_folder, year_prefix=year_prefixes)
            files_per_byte = [lst for lst in files_per_byte if lst]

            df = process_trace_files(ambyte_folder_name, files_per_byte)
            if df is None:
                logger.warning(f"No data returned from process_trace_files for {ambyte_folder_name}")
                error_count += 1
                continue

            df = df.reset_index()
            df["ambyte_folder"] = ambyte_folder_name

            if hasattr(df, "attrs") and df.attrs:
                for attr_key, attr_value in df.attrs.items():
                    col_name = f"meta_{attr_key}"
                    if col_name not in df.columns:
                        df[col_name] = attr_value

            # Drop pandas-only types that don't survive json.dumps cleanly.
            for col in df.columns:
                dtype_name = getattr(df[col].dtype, "name", "")
                if dtype_name == "category":
                    df[col] = df[col].astype(str)

            combined_dataframes.append(df)
            processed_count += 1
            logger.info(
                f"Processed {ambyte_folder_name}: {len(df):,} rows, {len(df.columns)} columns"
            )
        except Exception as e:
            logger.error(f"Error processing {ambyte_folder_name}: {e}")
            error_count += 1

    if not combined_dataframes:
        raise Exception(f"All ambyte processing failed ({error_count} errors)")

    combined_df = pd.concat(combined_dataframes, ignore_index=True)
    combined_df = combined_df.where(pd.notnull(combined_df), None)
    rows = combined_df.to_dict(orient="records")

    uploaded_at = datetime.now(timezone.utc)
    records = [
        {
            "experiment_id": EXPERIMENT_ID,
            "upload_table_id": UPLOAD_TABLE_ID,
            "upload_table_name": UPLOAD_TABLE_NAME,
            "upload_id": UPLOAD_ID,
            "created_by": USER_ID,
            "uploaded_at": uploaded_at,
            "uploaded_data": json.dumps(row, default=str),
            "row_index": i,
        }
        for i, row in enumerate(rows)
    ]

    schema = StructType([
        StructField("experiment_id", StringType(), True),
        StructField("upload_table_id", StringType(), True),
        StructField("upload_table_name", StringType(), True),
        StructField("upload_id", StringType(), True),
        StructField("created_by", StringType(), True),
        StructField("uploaded_at", TimestampType(), True),
        StructField("uploaded_data", StringType(), True),
        StructField("row_index", LongType(), True),
    ])

    spark_df = spark.createDataFrame(records, schema=schema)

    output_path = f"{processed_output_path}/upload_{UPLOAD_ID}"

    try:
        dbutils.fs.mkdirs(processed_output_path)
    except Exception:
        pass

    spark_df.write.mode("overwrite").parquet(output_path)

    logger.info(f"Saved ambyte upload: {output_path} ({len(records):,} rows)")
    return {
        "rows_written": len(records),
        "files_processed": processed_count,
        "files_failed": error_count,
        "output_path": output_path,
    }

# COMMAND ----------

# DBTITLE 1,Queryability Boundary
def wait_for_upload_queryability(expected_upload_rows: int) -> None:
    if not UPLOAD_ID or not UPLOAD_TABLE_ID:
        raise ValueError("UPLOAD_ID and UPLOAD_TABLE_ID are required to verify queryability")

    count_query = build_queryability_query(
        CATALOG_NAME,
        EXPERIMENT_ID,
        UPLOAD_TABLE_ID,
        UPLOAD_ID,
        include_schema=False,
    )
    schema_query = build_queryability_query(CATALOG_NAME, EXPERIMENT_ID, UPLOAD_TABLE_ID, UPLOAD_ID)

    def observe() -> UploadQueryability:
        current = UploadQueryability.from_row(spark.sql(count_query).first().asDict())
        if current.counts_match(expected_upload_rows):
            current = UploadQueryability.from_row(spark.sql(schema_query).first().asDict())
        logger.info("Upload queryability observation: %s", current)
        return current

    try:
        wait_until_queryable(
            observe,
            expected_upload_rows,
            QUERYABILITY_TIMEOUT_SECONDS,
            QUERYABILITY_POLL_SECONDS,
        )
    except TimeoutError as error:
        schedule_context = (
            " The DEV Centrum pipeline is scheduled every 30 minutes from 06:00 through 18:30 UTC "
            "on weekdays; uploads outside that window require a later retry."
            if ENVIRONMENT == "DEV"
            else " The continuously running Centrum pipeline did not publish the upload in time."
        )
        raise TimeoutError(f"{error}.{schedule_context}") from error


# COMMAND ----------

# DBTITLE 1,Upload Metadata Record
def write_upload_metadata(status: str, result: dict | None, error_message: str | None) -> None:
    """Upsert the upload's terminal record after processing and queryability finish.

    One row per upload_id makes terminal state durable and retry-safe. In-flight
    state remains sourced from the Databricks job-runs API.
    """
    if not UPLOAD_ID:
        return

    # Belt-and-suspenders SQL-literal quoting: the backend zod schema already
    # restricts upload_table_name to [A-Za-z0-9_] and UUIDs are fixed-shape,
    # but widgets can be set out-of-band (Databricks UI / manual run-now).
    def quote(value: str | None) -> str:
        if value is None:
            return "NULL"
        return "'" + value.replace("'", "''") + "'"

    completed_at = datetime.now(timezone.utc)
    file_count = int(result.get("files_processed", 0)) if result else 0
    row_count = int(result.get("rows_written", 0)) if result else 0

    spark.sql(
        f"""
        MERGE INTO {UPLOAD_METADATA_TABLE} AS target
        USING (
          SELECT
            {quote(UPLOAD_ID)} AS upload_id,
            {quote(EXPERIMENT_ID)} AS experiment_id,
            {quote(UPLOAD_TABLE_ID or "")} AS upload_table_id,
            {quote(UPLOAD_TABLE_NAME or "")} AS upload_table_name,
            {quote(SOURCE_KIND)} AS source_kind,
            {quote(status)} AS status,
            {file_count} AS file_count,
            {row_count} AS row_count,
            {quote(USER_ID or "")} AS created_by,
            {quote(completed_at.isoformat())} AS created_at,
            {quote(completed_at.isoformat())} AS completed_at,
            {quote(error_message)} AS error_message
        ) AS source
        ON target.upload_id = source.upload_id
        WHEN MATCHED THEN UPDATE SET *
        WHEN NOT MATCHED THEN INSERT *
        """
    )
    logger.info(f"Wrote upload metadata record (status={status}, upload_id={UPLOAD_ID})")

# COMMAND ----------

# DBTITLE 1,Dispatch
PROCESSORS = {
    "csv": process_csv_upload,
    "tsv": process_tsv_upload,
    "parquet": process_parquet_upload,
    "json": process_json_upload,
    "ndjson": process_ndjson_upload,
    "ambyte": process_ambyte_upload,
}


def main() -> dict:
    processor = PROCESSORS.get(SOURCE_KIND)
    if processor is None:
        def unsupported_processor() -> dict:
            raise ValueError(f"Unsupported source kind: {SOURCE_KIND}")

        processor = unsupported_processor

    result, run_status = run_upload_lifecycle(
        processor,
        wait_for_upload_queryability,
        write_upload_metadata,
    )
    return {
        "status": run_status,
        "experiment_id": EXPERIMENT_ID,
        "source_kind": SOURCE_KIND,
        "upload_table_name": UPLOAD_TABLE_NAME,
        "upload_id": UPLOAD_ID,
        **result,
    }

try:
    result = main()
except Exception:
    logger.exception("Task execution failed")
    raise
logger.info(f"Status: {result['status']}")
# notebook.exit serialises whatever it's given via repr(), which produces a
# Python-literal blob that downstream callers (jobs API, runs.get) can't parse.
# Emit JSON so consumers can ingest the result directly.
dbutils.notebook.exit(json.dumps(result))
