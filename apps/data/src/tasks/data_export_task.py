# Databricks notebook source
# DBTITLE 1,Data Export Task
# Exports one experiment table in parts to the exports volume and describes the parts in
# manifest.json. The backend creates the export id, follows the run, and reads the manifest
# once the run succeeds, so this task writes no metadata of its own.

# COMMAND ----------

# DBTITLE 1,Imports
import io
import json
import math
import tempfile
from datetime import datetime, timezone

from openjii.helpers import load_experiment_table
from pyspark.dbutils import DBUtils
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col, expr, lit, struct, to_json, when
from pyspark.sql.types import ArrayType, MapType, StringType, StructType, VariantType


# Use print() for logging - Databricks captures stdout/stderr from the
# driver on the compute cluster, but the Python logging module is often
# swallowed (especially when running as a Databricks task/workflow).
def log(msg: str, level: str = "INFO"):
    print(f"[{level}] {msg}", flush=True)

# COMMAND ----------

# DBTITLE 1,Task Configuration
EXPORT_ID = dbutils.widgets.get("EXPORT_ID")
EXPERIMENT_ID = dbutils.widgets.get("EXPERIMENT_ID")
TABLE_NAME = dbutils.widgets.get("TABLE_NAME")
CATALOG_NAME = dbutils.widgets.get("CATALOG_NAME")
FORMAT = dbutils.widgets.get("FORMAT").lower()  # csv, ndjson, json-array, parquet, or xlsx
try:
    ANONYMIZE_CONTRIBUTORS = (dbutils.widgets.get("ANONYMIZE_CONTRIBUTORS") or "").lower() == "true"
except Exception:
    ANONYMIZE_CONTRIBUTORS = False

spark = SparkSession.builder.getOrCreate()
dbutils = DBUtils(spark)

# A retry of this run reuses the export id, so it overwrites the same folder.
OUTPUT_PATH = f"/Volumes/{CATALOG_NAME}/centrum/exports/{EXPERIMENT_ID}/{TABLE_NAME}/{FORMAT}/{EXPORT_ID}"
MANIFEST_NAME = "manifest.json"
SNAPSHOT_AT = datetime.now(timezone.utc).isoformat()

log(f"Exporting {TABLE_NAME} of experiment {EXPERIMENT_ID} as {FORMAT} to {OUTPUT_PATH}")
log(f"Anonymise contributors: {ANONYMIZE_CONTRIBUTORS}")

# COMMAND ----------

# DBTITLE 1,Limits and Manifest
# About 0.8 GiB of parquet per part at the row width of a large macro table.
ROWS_PER_PART = 1_000_000

# Excel caps a sheet at 1,048,576 rows including the header and at 16,384 columns. JSON array
# shares the row cap, because both formats are built on the driver one row at a time.
DRIVER_FORMAT_MAX_ROWS = 1_048_575
EXCEL_MAX_COLUMNS = 16_384

# Formats Spark writes in parts, with the reader that lists the files a write committed.
SPARK_FORMAT_READERS = {"csv": "text", "ndjson": "text", "parquet": "parquet"}
WRITES_IN_PARTS = FORMAT in SPARK_FORMAT_READERS


class ExportError(Exception):
    """A failure the platform explains to the user; the backend finds the code in the run's error."""

    def __init__(self, code: str, detail: str):
        super().__init__(f"EXPORT_ERROR[{code}] {detail}")


def part_count(row_count: int) -> int:
    return max(1, math.ceil(row_count / ROWS_PER_PART))


def check_driver_format_limits(export_format: str, row_count: int, column_count: int) -> None:
    if export_format not in ("xlsx", "json-array"):
        return

    if row_count > DRIVER_FORMAT_MAX_ROWS:
        raise ExportError(
            "too_many_rows_for_format",
            f"{row_count} rows exceed the {DRIVER_FORMAT_MAX_ROWS}-row limit of {export_format}",
        )

    if export_format == "xlsx" and column_count > EXCEL_MAX_COLUMNS:
        raise ExportError(
            "too_many_rows_for_format",
            f"{column_count} columns exceed Excel's {EXCEL_MAX_COLUMNS}-column limit",
        )


def build_manifest(export_id: str, export_format: str, row_count: int, snapshot_at: str, parts: list) -> dict:
    """``rowCount`` is the count taken when the export started; rows that arrive while it runs
    may or may not be in the files."""
    return {
        "exportId": export_id,
        "format": export_format,
        "rowCount": row_count,
        "snapshotAt": snapshot_at,
        "parts": parts,
    }


def is_part_file(name: str) -> bool:
    return not name.startswith(("_", ".")) and name != MANIFEST_NAME

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

# DBTITLE 1,Write Parts
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


def write_parts(df):
    """
    Write the table to OUTPUT_PATH. Spark formats write one part per partition of ``df``, which
    the loader split into ranges of the table's sort column, so the parts follow the rows' order.
    """
    if FORMAT == "csv":
        (
            flatten_complex_columns(df)
            .write.mode("overwrite")
            .option("header", True)
            .option("escape", '"')
            .option("compression", "gzip")
            .csv(OUTPUT_PATH)
        )
    elif FORMAT == "ndjson":
        df.write.mode("overwrite").option("compression", "gzip").json(OUTPUT_PATH)
    elif FORMAT == "parquet":
        df.write.mode("overwrite").parquet(OUTPUT_PATH)
    elif FORMAT == "json-array":
        # Rows stream to a local temp file one at a time, so the driver never holds the whole
        # export. The ", " separator matches json.dumps(list). Uploaded via the Files API:
        # dbutils.fs.put sends the whole file as one gRPC message, which serverless caps at 128 MiB.
        from databricks.sdk import WorkspaceClient

        w = WorkspaceClient()
        with tempfile.TemporaryFile() as payload:
            payload.write(b"[")
            for index, row in enumerate(df.toLocalIterator()):
                if index > 0:
                    payload.write(b", ")
                payload.write(json.dumps(row.asDict(recursive=True), default=str).encode("utf-8"))
            payload.write(b"]")
            payload.seek(0)
            w.files.create_directory(OUTPUT_PATH)
            w.files.upload(f"{OUTPUT_PATH}/part-00000.json", payload, overwrite=True)
    elif FORMAT == "xlsx":
        # Serverless has no Spark Excel writer; build the workbook in memory and upload it
        # via the Files API (binary-safe, uses the volume's UC grant like csv/parquet).
        from databricks.sdk import WorkspaceClient

        w = WorkspaceClient()
        buf = io.BytesIO()
        flatten_complex_columns(df).toPandas().to_excel(buf, index=False, engine="openpyxl")
        buf.seek(0)
        w.files.create_directory(OUTPUT_PATH)
        w.files.upload(f"{OUTPUT_PATH}/part-00000.xlsx", buf, overwrite=True)
    else:
        raise ValueError(f"Unsupported format: {FORMAT}")


def committed_names(directory):
    """Names of the files a Spark write committed. A task attempt that failed after writing can
    leave a file behind that the commit never listed."""
    reader = spark.read.format(SPARK_FORMAT_READERS[FORMAT])
    return {path.rsplit("/", 1)[-1] for path in reader.load(directory).inputFiles()}


def list_parts(directory):
    files = [f for f in dbutils.fs.ls(directory) if is_part_file(f.name)]
    if WRITES_IN_PARTS:
        committed = committed_names(directory)
        files = [f for f in files if f.name in committed]
    return [{"name": f.name, "sizeBytes": f.size} for f in sorted(files, key=lambda f: f.name)]


def write_manifest(manifest):
    from databricks.sdk import WorkspaceClient

    w = WorkspaceClient()
    w.files.create_directory(OUTPUT_PATH)
    w.files.upload(
        f"{OUTPUT_PATH}/{MANIFEST_NAME}",
        io.BytesIO(json.dumps(manifest).encode("utf-8")),
        overwrite=True,
    )

# COMMAND ----------

# DBTITLE 1,Main Execution
def load(parts=None):
    return load_experiment_table(
        experiment_id=EXPERIMENT_ID,
        table_name=TABLE_NAME,
        catalog_name=CATALOG_NAME,
        schema_name="centrum",
        parts=parts,
    )


def main():
    row_count = load().count()
    log(f"Loaded {row_count} rows")

    parts = []
    if row_count > 0:
        parts_planned = part_count(row_count) if WRITES_IN_PARTS else 1
        log(f"Writing {row_count} rows as {parts_planned} part(s)")
        df = load(parts_planned if WRITES_IN_PARTS else None)
        check_driver_format_limits(FORMAT, row_count, len(df.columns))
        if ANONYMIZE_CONTRIBUTORS:
            df = anonymize_contributors(df, EXPERIMENT_ID)
        write_parts(df)
        parts = list_parts(OUTPUT_PATH)

    manifest = build_manifest(EXPORT_ID, FORMAT, row_count, SNAPSHOT_AT, parts)
    write_manifest(manifest)
    log(f"Wrote {len(parts)} part(s) and the manifest")

    dbutils.notebook.exit(json.dumps(manifest))


main()
