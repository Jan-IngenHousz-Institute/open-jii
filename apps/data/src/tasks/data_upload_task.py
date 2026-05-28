# Databricks notebook source
# DBTITLE 1,Data Upload Task
# Dispatches an upload run to the right processor based on SOURCE_KIND.
# - csv/tsv/parquet/xlsx/json/ndjson: pandas parse, encode each row as JSON
#   in uploaded_data, write parquet to processed-uploads (centrum pipeline ingests
#   into raw_uploaded_data with a parsed VARIANT column; nested per-row values
#   are preserved).
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
from pyspark.sql.types import StringType, StructField, StructType, TimestampType

from ambyte import find_byte_folders, load_files_per_byte, process_trace_files

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

# DBTITLE 1,Tabular Processor (csv/tsv/parquet/xlsx)
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
            local_path = path.replace("dbfs:", "/dbfs") if path.startswith("dbfs:") else path
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
        }
        for row in all_rows
    ]

    schema = StructType([
        StructField("experiment_id", StringType(), True),
        StructField("upload_table_id", StringType(), True),
        StructField("upload_table_name", StringType(), True),
        StructField("upload_id", StringType(), True),
        StructField("created_by", StringType(), True),
        StructField("uploaded_at", TimestampType(), True),
        StructField("uploaded_data", StringType(), True),
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
    return _process_tabular_upload("parquet", (".parquet",), pd.read_parquet)


def process_xlsx_upload() -> dict:
    # Excel files can have multiple sheets; concat them so users don't lose data.
    def _read_excel_all_sheets(path: str):
        sheets = pd.read_excel(path, sheet_name=None)
        if not sheets:
            return pd.DataFrame()
        if len(sheets) == 1:
            return next(iter(sheets.values()))
        frames = []
        for sheet_name, sheet_df in sheets.items():
            sheet_df = sheet_df.copy()
            sheet_df["sheet"] = sheet_name
            frames.append(sheet_df)
        return pd.concat(frames, ignore_index=True)

    return _process_tabular_upload("xlsx", (".xlsx", ".xls"), _read_excel_all_sheets)


def process_json_upload() -> dict:
    # Top-level array of objects; nested values per row are preserved (downstream
    # VARIANT handles arbitrary nesting, same shape macros work with).
    def _read_json_array(path: str):
        with open(path) as f:
            data = json.load(f)
        if not isinstance(data, list):
            raise Exception(
                f"JSON file must be a top-level array of objects, got {type(data).__name__}"
            )
        if data and not isinstance(data[0], dict):
            raise Exception("JSON file array elements must be objects")
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
    tables ingest these alongside csv/tsv/parquet/xlsx/json/ndjson uploads."""
    if not YEAR_PREFIX:
        raise Exception("YEAR_PREFIX is required for source_kind=ambyte")
    if not UPLOAD_TABLE_NAME:
        raise Exception("UPLOAD_TABLE_NAME is required for source_kind=ambyte")
    if not UPLOAD_TABLE_ID:
        raise Exception("UPLOAD_TABLE_ID is required for source_kind=ambyte")
    if not UPLOAD_ID:
        raise Exception("UPLOAD_ID is required for source_kind=ambyte")

    ambyte_base_path = (
        f"/Volumes/{CATALOG_NAME}/centrum/data-imports/{EXPERIMENT_ID}/ambyte/{UPLOAD_DIRECTORY}"
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

    for ambyte_folder in byte_parent_folders:
        ambyte_folder_name = os.path.basename(ambyte_folder.rstrip("/"))
        try:
            files_per_byte, _ = load_files_per_byte(ambyte_folder, year_prefix=YEAR_PREFIX)
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
        }
        for row in rows
    ]

    schema = StructType([
        StructField("experiment_id", StringType(), True),
        StructField("upload_table_id", StringType(), True),
        StructField("upload_table_name", StringType(), True),
        StructField("upload_id", StringType(), True),
        StructField("created_by", StringType(), True),
        StructField("uploaded_at", TimestampType(), True),
        StructField("uploaded_data", StringType(), True),
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
def write_upload_metadata(status: str, result: dict | None, error_message: str | None) -> None:
    """Append a completion record into experiment_upload_metadata.

    Mirrors the export task's create_export_metadata. Backend reads from this
    table to render an upload history; in-flight runs are tracked via the
    Databricks job-runs API and joined on job_run_id.
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

    try:
        completed_at = datetime.now()
        file_count = int(result.get("files_processed", 0)) if result else 0
        row_count = int(result.get("rows_written", 0)) if result else 0

        spark.sql(
            f"""
            INSERT INTO {UPLOAD_METADATA_TABLE}
              (upload_id, experiment_id, upload_table_id, upload_table_name, source_kind, status,
               file_count, row_count, created_by, created_at, completed_at, error_message)
            VALUES (
              {quote(UPLOAD_ID)}, {quote(EXPERIMENT_ID)},
              {quote(UPLOAD_TABLE_ID or "")}, {quote(UPLOAD_TABLE_NAME or "")},
              {quote(SOURCE_KIND)}, {quote(status)},
              {file_count}, {row_count}, {quote(USER_ID or "")},
              {quote(completed_at.isoformat())}, {quote(completed_at.isoformat())}, {quote(error_message)}
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
    "xlsx": process_xlsx_upload,
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
