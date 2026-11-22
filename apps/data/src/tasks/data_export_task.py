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

from openjii.helpers import ExperimentTable, TableMetadataNotFound
from pyspark.dbutils import DBUtils
from pyspark.sql import Column, DataFrame, SparkSession
from pyspark.sql.functions import col, concat, lit, sha2, struct, substring, to_json, transform, upper, when
from pyspark.sql.types import ArrayType, DecimalType, LongType, MapType, StringType, StructType, VariantType


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

# A retry of this run reuses the export id, so it overwrites the same folders.
OUTPUT_PATH = f"/Volumes/{CATALOG_NAME}/centrum/exports/{EXPERIMENT_ID}/{TABLE_NAME}/{FORMAT}/{EXPORT_ID}"
SNAPSHOT_PATH = f"{OUTPUT_PATH}-snapshot"
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
            f"more than {DRIVER_FORMAT_MAX_ROWS} rows, the limit of {export_format}",
        )

    if export_format == "xlsx" and column_count > EXCEL_MAX_COLUMNS:
        raise ExportError(
            "too_many_rows_for_format",
            f"{column_count} columns exceed Excel's {EXCEL_MAX_COLUMNS}-column limit",
        )


def build_manifest(export_id: str, export_format: str, row_count: int, snapshot_at: str, parts: list) -> dict:
    """``rowCount`` is the number of rows in the parts, which all come from one read of the table
    taken just after ``snapshotAt``."""
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


def _contributor_pseudonym(experiment_id: str, user_id: Column) -> Column:
    # Match the API's ContributorAnonymizerService.pseudonymFor.
    digest = sha2(concat(lit(experiment_id), lit(":"), user_id), 256)
    return concat(lit("Contributor-"), upper(substring(digest, 1, 6)))


def _anonymize_annotation(annotation: Column, experiment_id: str) -> Column:
    author = annotation.getField("createdBy")
    pseudonym = _contributor_pseudonym(experiment_id, author)
    return when(
        author.isNotNull(),
        annotation.withField("createdBy", pseudonym).withField("createdByName", pseudonym),
    ).otherwise(annotation)


def anonymize_contributors(df: DataFrame, experiment_id: str) -> DataFrame:
    """Use the same per-experiment pseudonym for contributors and annotation authors."""
    contributor_fields = [f for f in df.schema.fields if _is_contributor_field(f)]
    for field in contributor_fields:
        col_name = field.name
        pseudonym = _contributor_pseudonym(experiment_id, col(col_name).getField("id"))
        df = df.withColumn(
            col_name,
            when(
                col(col_name).isNotNull(),
                struct(
                    pseudonym.alias("id"),
                    pseudonym.alias("name"),
                    lit(None).cast(StringType()).alias("avatar"),
                ),
            ).otherwise(col(col_name)),
        )
        log(f"Anonymised contributor column: {col_name}")

    for col_name in ("annotations", "payload_annotations"):
        if col_name in df.columns:
            df = df.withColumn(
                col_name,
                transform(col(col_name), lambda annotation: _anonymize_annotation(annotation, experiment_id)),
            )
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


def _excel_integer(value: object) -> int | str | None:
    if not isinstance(value, str):
        return None
    return int(value) if len(value.lstrip("-")) <= 15 else value


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
        import pandas as pd
        from databricks.sdk import WorkspaceClient

        w = WorkspaceClient()
        buf = io.BytesIO()
        # Excel keeps 15 significant digits. Cast before pandas can round nullable BIGINTs as floats.
        flat = flatten_complex_columns(df)
        integer_text = {}
        for field in flat.schema.fields:
            dtype = field.dataType
            if isinstance(dtype, LongType) or (
                isinstance(dtype, DecimalType) and dtype.scale == 0 and dtype.precision > 15
            ):
                quoted_name = field.name.replace("`", "``")
                integer_text[field.name] = col(f"`{quoted_name}`").cast("string")
        frame = flat.withColumns(integer_text).toPandas()
        for name in integer_text:
            frame[name] = pd.Series(
                (_excel_integer(value) for value in frame[name]), index=frame.index, dtype=object
            )
        frame.to_excel(buf, index=False, engine="openpyxl")
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
def take_snapshot(table):
    """Read the table's source once, into files the count, the limits and the parts all read.

    Files rather than ``cache()``: serverless caches a DataFrame only from environment version 5
    (docs.databricks.com/aws/en/compute/serverless/dataframe-cache). The payloads stay VARIANT in
    the files, because a parsed payload can hold an empty struct or ARRAY<VOID>, which parquet
    cannot. The files are read with the rows' own schema, so a VARIANT reads back as one whatever
    their footers say. Anonymisation runs before the snapshot is written.
    """
    rows = table.rows()
    if ANONYMIZE_CONTRIBUTORS:
        rows = anonymize_contributors(rows, EXPERIMENT_ID)

    # One row past the limit is enough to refuse, so a refused export never copies the whole table.
    if not WRITES_IN_PARTS:
        rows = rows.limit(DRIVER_FORMAT_MAX_ROWS + 1)

    rows.write.mode("overwrite").parquet(SNAPSHOT_PATH)
    return spark.read.schema(rows.schema).parquet(SNAPSHOT_PATH)


def remove_snapshot():
    """The bucket's expiry rule collects a snapshot left behind, so a failed delete does not fail
    an export whose parts and manifest are written."""
    try:
        dbutils.fs.rm(SNAPSHOT_PATH, True)
    except Exception as error:
        log(f"Could not remove the snapshot at {SNAPSHOT_PATH}: {error}", "WARN")


def open_table():
    """The table to export, or None for one that never held a row: gold writes a table's metadata
    only once its first row arrives, so such an export is empty rather than failed."""
    try:
        return ExperimentTable(EXPERIMENT_ID, TABLE_NAME, CATALOG_NAME, schema_name="centrum")
    except TableMetadataNotFound:
        return None


def main():
    table = open_table()

    if table is None:
        log("Loaded 0 rows: the table has never held one")
        manifest = build_manifest(EXPORT_ID, FORMAT, 0, SNAPSHOT_AT, [])
        write_manifest(manifest)
    else:
        try:
            snapshot = take_snapshot(table)
            row_count = snapshot.count()
            log(f"Loaded {row_count} rows")

            parts = []
            if row_count > 0:
                parts_planned = part_count(row_count) if WRITES_IN_PARTS else 1
                log(f"Writing {row_count} rows as {parts_planned} part(s)")
                df = table.shape(snapshot, parts_planned if WRITES_IN_PARTS else None)
                check_driver_format_limits(FORMAT, row_count, len(df.columns))
                write_parts(df)
                parts = list_parts(OUTPUT_PATH)

            manifest = build_manifest(EXPORT_ID, FORMAT, row_count, SNAPSHOT_AT, parts)
            write_manifest(manifest)
            log(f"Wrote {len(parts)} part(s) and the manifest")
        finally:
            remove_snapshot()

    dbutils.notebook.exit(json.dumps(manifest))


main()
