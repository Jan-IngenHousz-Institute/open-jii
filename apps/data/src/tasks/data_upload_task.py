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

import numpy as np
import pandas as pd
from pyspark.dbutils import DBUtils
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, FloatType, LongType, StringType, StructField, StructType, TimestampType

from ambyte import find_byte_folders, load_files_per_byte, process_trace_files
from openjii.json_scrub import scrub_non_finite_json_value

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
def _serialize_dataframe_rows(frame: pd.DataFrame) -> list[str]:
    """Encode dataframe rows as strict JSON, replacing non-finite values with null."""
    def encode_scalar(value):
        if isinstance(value, np.floating) and not np.isfinite(value):
            return None
        return str(value)

    rows = frame.astype(object).where(pd.notnull(frame), None).to_dict(orient="records")
    payloads = []
    for row in rows:
        payload = scrub_non_finite_json_value(json.dumps(row, default=encode_scalar))
        if payload is None:
            raise AssertionError("A serialized dataframe row cannot be None")
        payloads.append(payload)
    return payloads


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
    all_payloads: list[str] = []
    file_count = 0
    error_count = 0

    for path in matched_files:
        try:
            # pandas reads UC volumes via the /Volumes FUSE path; strip the dbfs:
            # scheme dbutils.fs.ls prepends. /dbfs only mounts DBFS, not volumes.
            local_path = path[len("dbfs:") :] if path.startswith("dbfs:") else path
            payloads = _serialize_dataframe_rows(parser(local_path))
            logger.info(f"Parsed {os.path.basename(path)}: {len(payloads)} rows")
            all_payloads.extend(payloads)
            file_count += 1
        except Exception as e:
            logger.error(f"Error parsing {path}: {e}")
            error_count += 1

    if not all_payloads:
        raise Exception(f"No rows parsed from {file_count} files ({error_count} errors)")

    records = [
        {
            "experiment_id": EXPERIMENT_ID,
            "upload_table_id": UPLOAD_TABLE_ID,
            "upload_table_name": UPLOAD_TABLE_NAME,
            "upload_id": UPLOAD_ID,
            "created_by": USER_ID,
            "uploaded_at": uploaded_at,
            "uploaded_data": payload,
            "row_index": i,
        }
        for i, payload in enumerate(all_payloads)
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


def _serialize_parquet_rows(frame: DataFrame) -> DataFrame:
    """Encode Spark rows with non-finite floating columns represented as JSON null."""
    columns = []
    for field in frame.schema.fields:
        value = F.col("`" + field.name.replace("`", "``") + "`")
        if isinstance(field.dataType, (FloatType, DoubleType)):
            value = F.when(
                F.isnan(value) | (value == float("inf")) | (value == float("-inf")),
                F.lit(None).cast(field.dataType),
            ).otherwise(value)
        columns.append(value.alias(field.name))
    return frame.select(
        F.to_json(F.struct(*columns), options={"ignoreNullFields": "false"}).alias("uploaded_data")
    )


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
            row_json = _serialize_parquet_rows(spark.read.parquet(spark_path))
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
    payloads = _serialize_dataframe_rows(combined_df)

    uploaded_at = datetime.now(timezone.utc)
    records = [
        {
            "experiment_id": EXPERIMENT_ID,
            "upload_table_id": UPLOAD_TABLE_ID,
            "upload_table_name": UPLOAD_TABLE_NAME,
            "upload_id": UPLOAD_ID,
            "created_by": USER_ID,
            "uploaded_at": uploaded_at,
            "uploaded_data": payload,
            "row_index": i,
        }
        for i, payload in enumerate(payloads)
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

# DBTITLE 1,Upload Metadata Record
def _quote_spark_sql_string(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def write_upload_metadata(status: str, result: dict | None, error_message: str | None) -> None:
    """Append a completion record into experiment_upload_metadata.

    Mirrors the export task's create_export_metadata. Backend reads from this
    table to render an upload history; in-flight runs are tracked via the
    Databricks job-runs API and joined on job_run_id.
    """
    if not UPLOAD_ID:
        return

    try:
        completed_at = datetime.now(timezone.utc)
        file_count = int(result.get("files_processed", 0)) if result else 0
        row_count = int(result.get("rows_written", 0)) if result else 0

        spark.sql(
            f"""
            INSERT INTO {UPLOAD_METADATA_TABLE}
              (upload_id, experiment_id, upload_table_id, upload_table_name, source_kind, status,
               file_count, row_count, created_by, created_at, completed_at, error_message)
            VALUES (
              {_quote_spark_sql_string(UPLOAD_ID)}, {_quote_spark_sql_string(EXPERIMENT_ID)},
              {_quote_spark_sql_string(UPLOAD_TABLE_ID or "")}, {_quote_spark_sql_string(UPLOAD_TABLE_NAME or "")},
              {_quote_spark_sql_string(SOURCE_KIND)}, {_quote_spark_sql_string(status)},
              {file_count}, {row_count}, {_quote_spark_sql_string(USER_ID or "")},
              {_quote_spark_sql_string(completed_at.isoformat())},
              {_quote_spark_sql_string(completed_at.isoformat())},
              {_quote_spark_sql_string(error_message)}
            )
            """
        )
        logger.info(f"Wrote upload metadata record (status={status}, upload_id={UPLOAD_ID})")
    except Exception as e:
        # Don't fail the job if metadata write fails; surfacing the upstream error matters more.
        logger.error(f"Failed to write upload metadata: {e}")

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
        write_upload_metadata("failed", None, f"Unsupported source kind: {SOURCE_KIND}")
        return {
            "status": "error",
            "error_message": f"Unsupported source kind: {SOURCE_KIND}",
            "experiment_id": EXPERIMENT_ID,
            "source_kind": SOURCE_KIND,
        }
    try:
        result = processor()
        # A processor can finish with files_failed > 0 — surface that as
        # "partial" instead of pretending we're done with a clean success.
        files_failed = int(result.get("files_failed", 0)) if result else 0
        status = "partial" if files_failed > 0 else "completed"
        run_status = "partial" if files_failed > 0 else "success"
        write_upload_metadata(status, result, None)
        return {
            "status": run_status,
            "experiment_id": EXPERIMENT_ID,
            "source_kind": SOURCE_KIND,
            "upload_table_name": UPLOAD_TABLE_NAME,
            "upload_id": UPLOAD_ID,
            **result,
        }
    except Exception as e:
        logger.error(f"Task execution failed: {e}")
        write_upload_metadata("failed", None, str(e))
        return {
            "status": "error",
            "error_message": str(e),
            "experiment_id": EXPERIMENT_ID,
            "source_kind": SOURCE_KIND,
            "upload_table_name": UPLOAD_TABLE_NAME,
            "upload_id": UPLOAD_ID,
        }

result = main()
logger.info(f"Status: {result['status']}")
# notebook.exit serialises whatever it's given via repr(), which produces a
# Python-literal blob that downstream callers (jobs API, runs.get) can't parse.
# Emit JSON so consumers can ingest the result directly.
dbutils.notebook.exit(json.dumps(result))
