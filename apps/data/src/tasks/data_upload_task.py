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
# The backend creates the upload record, follows the run, and reads the outcome from the exit value
# once the run succeeds, so this task writes no metadata of its own. Input the upload cannot use
# ends the run with a failed outcome; only a crash fails the run.

# COMMAND ----------

# DBTITLE 1,Imports
import json
import logging
import os
import time
from datetime import datetime, timezone

import pandas as pd
from pyspark.dbutils import DBUtils
from pyspark.sql import Column, DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (
    ArrayType,
    DataType,
    DoubleType,
    FloatType,
    LongType,
    MapType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)

from ambyte import find_byte_folders, load_files_per_byte, process_trace_files
from openjii.json_scrub import scrub_non_finite_json_value
from openjii.variant_schema import merged_variant_schema, variant_schema_key

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# COMMAND ----------

# DBTITLE 1,Task Configuration
EXPERIMENT_ID = dbutils.widgets.get("EXPERIMENT_ID")
CATALOG_NAME = dbutils.widgets.get("CATALOG_NAME")
UPLOAD_DIRECTORY = dbutils.widgets.get("UPLOAD_DIRECTORY")
SOURCE_KIND = dbutils.widgets.get("SOURCE_KIND")
UPLOAD_ID = dbutils.widgets.get("UPLOAD_ID")

# Optional widgets (set only for some source kinds; not all paths use them).
def _optional_widget(name: str) -> str | None:
    try:
        value = dbutils.widgets.get(name)
        return value or None
    except Exception:
        return None


UPLOAD_TABLE_NAME = _optional_widget("UPLOAD_TABLE_NAME")
UPLOAD_TABLE_ID = _optional_widget("UPLOAD_TABLE_ID")
EXPERIMENT_NAME = _optional_widget("EXPERIMENT_NAME")
YEAR_PREFIX = _optional_widget("YEAR_PREFIX")
USER_ID = _optional_widget("USER_ID")

spark = SparkSession.builder.getOrCreate()
dbutils = DBUtils(spark)

PROCESSED_UPLOADS_PATH = f"/Volumes/{CATALOG_NAME}/centrum/data-imports/{EXPERIMENT_ID}/processed-uploads"
# A retry of this run reuses the upload id, so it finds what an earlier attempt wrote here.
OUTPUT_PATH = f"{PROCESSED_UPLOADS_PATH}/upload_{UPLOAD_ID}"

logger.info(
    f"Data upload task starting: experiment_id={EXPERIMENT_ID} source_kind={SOURCE_KIND} "
    f"upload_dir={UPLOAD_DIRECTORY}"
)

# COMMAND ----------

# DBTITLE 1,Outcome
def has_committed_output(output_path: str) -> bool:
    return os.path.exists(os.path.join(output_path, "_SUCCESS"))


def rejected_file(path: str, reason: str) -> dict:
    return {"name": os.path.basename(path.rstrip("/")), "reason": reason}


def build_outcome(upload_id: str, row_count: int, rejected_files: list, queryable: bool) -> dict:
    """``queryable`` only counts once rows were written."""
    # Every input either adds rows or is rejected, so no rows and no rejections means none matched.
    nothing_matched = row_count == 0 and not rejected_files

    if nothing_matched:
        error_code = "no_files"
    elif row_count == 0:
        error_code = "no_rows"
    elif not queryable:
        error_code = "not_queryable"
    else:
        error_code = None

    return {
        "uploadId": upload_id,
        "outcome": "failed" if error_code else "completed",
        "rowCount": row_count,
        "rejectedFiles": rejected_files,
        "errorCode": error_code,
    }

# COMMAND ----------

# DBTITLE 1,Tabular Processor (csv/tsv/json/ndjson)
def _serialize_dataframe_rows(frame: pd.DataFrame) -> list[str | None]:
    """Encode dataframe rows as strict JSON, replacing non-finite values with null."""
    rows = frame.astype(object).where(pd.notnull(frame), None).to_dict(orient="records")
    return [scrub_non_finite_json_value(json.dumps(row, default=str)) for row in rows]


def _parse_tabular_files(paths: list[str], parser) -> tuple[list[str | None], list[dict]]:
    """The rows of every usable file as JSON payloads, and the files that yielded none."""
    payloads: list[str | None] = []
    rejected_files: list[dict] = []

    for path in paths:
        try:
            # pandas reads UC volumes via the /Volumes FUSE path; strip the dbfs:
            # scheme dbutils.fs.ls prepends. /dbfs only mounts DBFS, not volumes.
            local_path = path[len("dbfs:") :] if path.startswith("dbfs:") else path
            file_payloads = _serialize_dataframe_rows(parser(local_path))
            logger.info(f"Parsed {os.path.basename(path)}: {len(file_payloads)} rows")
            if not file_payloads:
                rejected_files.append(rejected_file(path, "no_rows"))
                continue

            payloads.extend(file_payloads)
        except Exception as e:
            logger.error(f"Error parsing {path}: {e}")
            rejected_files.append(rejected_file(path, "unparseable"))

    return payloads, rejected_files


def _process_tabular_upload(label: str, extensions: tuple[str, ...], parser) -> dict:
    """Shared pipeline for tabular uploads: pandas parse → JSON-encode rows → write parquet.

    Per-kind functions just supply a label, accepted extensions, and a parser
    that takes a local filesystem path and returns a pandas DataFrame.
    """
    if not UPLOAD_TABLE_NAME:
        raise Exception(f"UPLOAD_TABLE_NAME is required for source_kind={label}")
    if not UPLOAD_TABLE_ID:
        raise Exception(f"UPLOAD_TABLE_ID is required for source_kind={label}")

    upload_base_path = (
        f"/Volumes/{CATALOG_NAME}/centrum/data-imports/{EXPERIMENT_ID}/uploads/{UPLOAD_DIRECTORY}"
    )

    try:
        entries = dbutils.fs.ls(upload_base_path)
    except Exception as e:
        raise Exception(f"Upload directory not found: {upload_base_path}. Error: {e}")

    matched_files = [e.path for e in entries if e.path.lower().endswith(extensions)]
    if not matched_files:
        logger.warning(f"No {label} files found in {upload_base_path} (expected {extensions})")
        return {"rows_written": 0, "rejected_files": []}

    logger.info(f"Found {len(matched_files)} {label} file(s) to process")

    uploaded_at = datetime.now(timezone.utc)
    all_payloads, rejected_files = _parse_tabular_files(matched_files, parser)

    if not all_payloads:
        logger.warning(f"No rows parsed from {len(matched_files)} files ({len(rejected_files)} rejected)")
        return {"rows_written": 0, "rejected_files": rejected_files}

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

    try:
        dbutils.fs.mkdirs(PROCESSED_UPLOADS_PATH)
    except Exception:
        pass

    spark_df.write.mode("overwrite").parquet(OUTPUT_PATH)

    logger.info(f"Saved {len(records)} rows to {OUTPUT_PATH} ({len(rejected_files)} files rejected)")
    return {"rows_written": len(records), "rejected_files": rejected_files}


def process_csv_upload() -> dict:
    return _process_tabular_upload("csv", (".csv",), pd.read_csv)


def process_tsv_upload() -> dict:
    return _process_tabular_upload("tsv", (".tsv",), lambda p: pd.read_csv(p, sep="\t"))


def _serialize_parquet_rows(frame: DataFrame) -> DataFrame:
    """Encode Spark rows with non-finite floats replaced by null at every nesting level."""
    def normalize(value: Column, data_type: DataType) -> Column:
        if isinstance(data_type, (FloatType, DoubleType)):
            return F.when(
                F.isnan(value) | (value == float("inf")) | (value == float("-inf")),
                F.lit(None).cast(data_type),
            ).otherwise(value)
        if isinstance(data_type, ArrayType):
            return F.transform(value, lambda item: normalize(item, data_type.elementType))
        if isinstance(data_type, MapType):
            return F.transform_values(value, lambda key, item: normalize(item, data_type.valueType))
        if isinstance(data_type, StructType):
            fields = [
                normalize(value.getField(field.name), field.dataType).alias(field.name)
                for field in data_type.fields
            ]
            return F.when(value.isNotNull(), F.struct(*fields))
        return value

    columns = [
        normalize(F.col("`" + field.name.replace("`", "``") + "`"), field.dataType).alias(field.name)
        for field in frame.schema.fields
    ]
    return frame.select(
        F.to_json(F.struct(*columns), options={"ignoreNullFields": "false"}).alias("uploaded_data")
    )


def _read_parquet_files(paths: list[str]) -> tuple[DataFrame | None, list[dict]]:
    """The rows of every usable file as JSON payloads, and the files that yielded none."""
    combined: DataFrame | None = None
    rejected_files: list[dict] = []

    for path in paths:
        try:
            # Spark reads UC volumes via /Volumes; strip the dbfs: scheme dbutils adds.
            spark_path = path[len("dbfs:") :] if path.startswith("dbfs:") else path
            frame = spark.read.parquet(spark_path)
            if frame.isEmpty():
                rejected_files.append(rejected_file(path, "no_rows"))
                continue

            row_json = _serialize_parquet_rows(frame)
            combined = row_json if combined is None else combined.unionByName(row_json)
        except Exception as e:
            logger.error(f"Error parsing {path}: {e}")
            rejected_files.append(rejected_file(path, "unparseable"))

    return combined, rejected_files


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

    upload_base_path = (
        f"/Volumes/{CATALOG_NAME}/centrum/data-imports/{EXPERIMENT_ID}/uploads/{UPLOAD_DIRECTORY}"
    )

    try:
        entries = dbutils.fs.ls(upload_base_path)
    except Exception as e:
        raise Exception(f"Upload directory not found: {upload_base_path}. Error: {e}")

    matched_files = [e.path for e in entries if e.path.lower().endswith(".parquet")]
    if not matched_files:
        logger.warning(f"No parquet files found in {upload_base_path}")
        return {"rows_written": 0, "rejected_files": []}

    logger.info(f"Found {len(matched_files)} parquet file(s) to process")

    uploaded_at = datetime.now(timezone.utc)
    combined, rejected_files = _read_parquet_files(matched_files)

    if combined is None:
        logger.warning(f"No rows parsed from {len(matched_files)} files ({len(rejected_files)} rejected)")
        return {"rows_written": 0, "rejected_files": rejected_files}

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

    try:
        dbutils.fs.mkdirs(PROCESSED_UPLOADS_PATH)
    except Exception:
        pass

    result.write.mode("overwrite").parquet(OUTPUT_PATH)
    # Count the written output instead of result: a second action on the plan
    # would recompute it, and persist/cache is unsupported on serverless compute.
    row_count = spark.read.parquet(OUTPUT_PATH).count()

    logger.info(f"Saved {row_count} rows to {OUTPUT_PATH} ({len(rejected_files)} files rejected)")
    return {"rows_written": row_count, "rejected_files": rejected_files}


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
def _parse_ambyte_folders(
    folders: list[str], year_prefixes: tuple[str, ...]
) -> tuple[list[pd.DataFrame], list[dict]]:
    """The trace rows of every usable folder, and the folders that yielded none."""
    frames: list[pd.DataFrame] = []
    rejected_files: list[dict] = []

    for ambyte_folder in folders:
        ambyte_folder_name = os.path.basename(ambyte_folder.rstrip("/"))
        try:
            files_per_byte, _ = load_files_per_byte(ambyte_folder, year_prefix=year_prefixes)
            files_per_byte = [lst for lst in files_per_byte if lst]

            df = process_trace_files(ambyte_folder_name, files_per_byte)
            if df is None or df.empty:
                logger.warning(f"No data returned from process_trace_files for {ambyte_folder_name}")
                rejected_files.append(rejected_file(ambyte_folder, "no_rows"))
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

            frames.append(df)
            logger.info(
                f"Processed {ambyte_folder_name}: {len(df):,} rows, {len(df.columns)} columns"
            )
        except Exception as e:
            logger.error(f"Error processing {ambyte_folder_name}: {e}")
            rejected_files.append(rejected_file(ambyte_folder, "unparseable"))

    return frames, rejected_files


def process_ambyte_upload() -> dict:
    """Parse ambyte trace folders into rows, encode each row as JSON in uploaded_data,
    and write a single parquet under processed-uploads, the same sink as the tabular
    processors. The downstream raw_uploaded_data / experiment_uploaded_data DLT
    tables ingest these alongside csv/tsv/parquet/json/ndjson uploads."""
    if not YEAR_PREFIX:
        raise Exception("YEAR_PREFIX is required for source_kind=ambyte")
    if not UPLOAD_TABLE_NAME:
        raise Exception("UPLOAD_TABLE_NAME is required for source_kind=ambyte")
    if not UPLOAD_TABLE_ID:
        raise Exception("UPLOAD_TABLE_ID is required for source_kind=ambyte")

    # Ambyte files land under the shared "uploads" volume dir (the backend uses
    # volumeSourceType="uploads" for every kind), not a dedicated ambyte dir.
    ambyte_base_path = (
        f"/Volumes/{CATALOG_NAME}/centrum/data-imports/{EXPERIMENT_ID}/uploads/{UPLOAD_DIRECTORY}"
    )

    try:
        dbutils.fs.ls(ambyte_base_path)
    except Exception as e:
        raise Exception(f"Ambyte directory not found: {ambyte_base_path}. Error: {e}")

    logger.info(f"Processing ambyte directory: {ambyte_base_path}")

    try:
        byte_parent_folders = find_byte_folders(ambyte_base_path)
    except Exception as e:
        raise Exception(f"Error finding byte folders in {ambyte_base_path}: {e}")

    if not byte_parent_folders:
        logger.warning(f"No valid byte parent folders found in {ambyte_base_path}")
        return {"rows_written": 0, "rejected_files": []}

    logger.info(f"Found {len(byte_parent_folders)} valid byte parent folder(s)")

    # Ambyte files are named by their record date, which can trail into the previous
    # calendar year; accept both the upload year and the one before it.
    year_prefixes = (YEAR_PREFIX, str(int(YEAR_PREFIX) - 1))

    combined_dataframes, rejected_files = _parse_ambyte_folders(byte_parent_folders, year_prefixes)

    if not combined_dataframes:
        logger.warning(f"All ambyte processing failed ({len(rejected_files)} folders rejected)")
        return {"rows_written": 0, "rejected_files": rejected_files}

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

    try:
        dbutils.fs.mkdirs(PROCESSED_UPLOADS_PATH)
    except Exception:
        pass

    spark_df.write.mode("overwrite").parquet(OUTPUT_PATH)

    logger.info(f"Saved ambyte upload: {OUTPUT_PATH} ({len(records):,} rows)")
    return {"rows_written": len(records), "rejected_files": rejected_files}

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


def process_upload() -> dict:
    processor = PROCESSORS.get(SOURCE_KIND)
    if processor is None:
        raise ValueError(f"Unsupported source kind: {SOURCE_KIND}")
    return processor()

# COMMAND ----------

# DBTITLE 1,Wait Until Queryable
UPLOADED_DATA_TABLE = f"{CATALOG_NAME}.centrum.experiment_uploaded_data"
UPLOADED_DATA_SCHEMAS_TABLE = f"{CATALOG_NAME}.centrum.experiment_uploaded_data_schemas"
TABLE_METADATA = f"{CATALOG_NAME}.centrum.experiment_table_metadata"
# The pipeline is continuous, so an upload is usually queryable within minutes; an hour means it is stuck.
TABLE_WAIT_SECONDS = 60 * 60
TABLE_POLL_SECONDS = 15


def _upload_table_rows(table: str) -> DataFrame:
    return spark.table(table).where(
        (F.col("experiment_id") == EXPERIMENT_ID) & (F.col("upload_table_id") == UPLOAD_TABLE_ID)
    )


def upload_schema_keys(expected_rows: int) -> list[str] | None:
    """The distinct schemas of the upload's rows once all of them are in its table, else None."""
    rows = _upload_table_rows(UPLOADED_DATA_TABLE).where(F.col("upload_id") == UPLOAD_ID)
    if rows.count() < expected_rows:
        return None
    keys = rows.select(variant_schema_key("uploaded_data").alias("schema_key")).distinct()
    return [row["schema_key"] for row in keys.collect()]


def table_list_shows(schema_keys: list[str]) -> bool:
    """True once the table list has refreshed since the upload's schemas reached the
    table's samples, which the pipeline merges into the listed schema."""
    samples = _upload_table_rows(UPLOADED_DATA_SCHEMAS_TABLE)
    sampled = samples.where(F.col("schema_key").isin(schema_keys)).select("schema_key").distinct()
    if sampled.count() < len(schema_keys):
        return False

    merged = samples.agg(merged_variant_schema("sample").alias("schema")).first()["schema"]
    listed = (
        spark.table(TABLE_METADATA)
        .where(
            (F.col("experiment_id") == EXPERIMENT_ID)
            & (F.col("identifier") == UPLOAD_TABLE_ID)
            & (F.col("table_type") == "upload")
        )
        .select("upload_schema")
        .first()
    )
    return listed is not None and listed["upload_schema"] == merged


def wait_until_queryable(expected_rows: int) -> bool:
    """True once every row of the upload is in its table and the table list shows the
    table with the upload's columns; False if that does not happen in time."""
    deadline = time.monotonic() + TABLE_WAIT_SECONDS
    schema_keys: list[str] | None = None
    while time.monotonic() < deadline:
        try:
            if schema_keys is None:
                schema_keys = upload_schema_keys(expected_rows)
            if schema_keys is not None and table_list_shows(schema_keys):
                return True
        except Exception as e:
            # A failed check is retried at the next poll; raising would rerun the whole upload.
            logger.warning(f"Could not check whether the upload is queryable yet: {e}")
        time.sleep(TABLE_POLL_SECONDS)
    return False

# COMMAND ----------

# DBTITLE 1,Main Execution
def main():
    if has_committed_output(OUTPUT_PATH):
        # Writing the rows again would put them in files with new names, which the pipeline
        # would ingest a second time. Which files an earlier attempt rejected is not known here.
        rows_written = spark.read.parquet(OUTPUT_PATH).count()
        rejected_files: list[dict] = []
        logger.info(f"An earlier attempt already wrote {rows_written} rows to {OUTPUT_PATH}")
    else:
        result = process_upload()
        rows_written = result["rows_written"]
        rejected_files = result["rejected_files"]

    wrote_rows = rows_written > 0
    queryable = wrote_rows and wait_until_queryable(rows_written)
    if wrote_rows and not queryable:
        logger.error(f"Upload {UPLOAD_ID} was not queryable within {TABLE_WAIT_SECONDS} s")

    outcome = build_outcome(UPLOAD_ID, rows_written, rejected_files, queryable)
    logger.info(f"Upload outcome: {outcome['outcome']} (error code {outcome['errorCode']})")

    dbutils.notebook.exit(json.dumps(outcome))


main()
