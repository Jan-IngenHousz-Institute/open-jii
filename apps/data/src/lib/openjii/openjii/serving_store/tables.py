"""What each store table holds, built from the change feed of the table it reads: a gold table, or
the lakehouse's copy of the metadata sheets."""

from __future__ import annotations

from datetime import datetime, timezone

from pyspark.sql import Column, DataFrame, Window
from pyspark.sql import functions as F

from openjii.centrum.constants import (
    EXPERIMENT_CUSTOM_METADATA_TABLE,
    EXPERIMENT_MACRO_DATA_TABLE,
    EXPERIMENT_RAW_DATA_TABLE,
    EXPERIMENT_UPLOADED_DATA_TABLE,
)
from openjii.metrics.constants import SENSOR_PARAMETER_ALLOWLIST
from openjii.metrics.sensor_readings import sensor_readings
from openjii.timezones import usable_timezone
from openjii.variant_schema import custom_metadata_schemas, merged_variant_schema

# The store parses microseconds without an offset. Spark's default writes milliseconds with the
# session's offset, and pre-1900 zones carry offsets such as +00:17:30 that the store refuses.
JSON_OPTIONS = {"timestampFormat": "yyyy-MM-dd HH:mm:ss.SSSSSS", "timeZone": "UTC"}

# DateTime64's range. The store clamps only the date of a value outside it and keeps the time of
# day, so the feed clamps whole values.
_EARLIEST = datetime(1900, 1, 1, tzinfo=timezone.utc)
_LATEST = datetime(2299, 12, 31, 23, 59, 59, 999999, tzinfo=timezone.utc)

# Only rows gold holds are sent. A refresh of gold sends every old row as a delete, which the feed
# drops, so a row gold removes stays in the store until a reload
# (docs/runbooks/procedures/serving-store-reload.md).
_KEPT_CHANGES = ("insert", "update_postimage")

# The store table that holds every table's payload schemas.
PAYLOAD_SCHEMAS = "payload_schemas"

# The store table that holds each metadata sheet's match and the schema its rows give.
METADATA_SHEETS = "metadata_sheets"

# The store's Float64 columns, which each line writes first so the writer can rewrite their digits
# without reading the rest of the line (writer.exact_doubles).
FLOAT64_COLUMNS = ("latitude", "longitude", "device_battery")

# Every reading of each sensor the platform metrics count, out of a measurement's payload, as an
# Array(Float64) column named after the sensor. They follow the Float64 columns in a line, for the
# same rewrite.
SENSOR_READINGS = {f"{name}_readings": name for name in SENSOR_PARAMETER_ALLOWLIST}


def clamped(column: str) -> Column:
    """A timestamp held within the store's range."""
    return F.least(F.greatest(F.col(column), F.lit(_EARLIEST)), F.lit(_LATEST)).alias(column)


def json_object(column: str) -> Column:
    """A VARIANT as a JSON object. The store's JSON type holds only objects, so an array is wrapped
    as ``{"_items": [...]}`` and a scalar as ``{"_value": x}``; a JSON null is a missing value."""
    return F.expr(
        f"""
        CASE
          WHEN {column} IS NULL OR schema_of_variant({column}) = 'VOID' THEN NULL
          WHEN schema_of_variant({column}) LIKE 'OBJECT%' THEN {column}
          WHEN schema_of_variant({column}) LIKE 'ARRAY%' THEN parse_json(concat('{{"_items":', to_json({column}), '}}'))
          ELSE parse_json(concat('{{"_value":', to_json({column}), '}}'))
        END
        """
    ).alias(column)


def json_text(column: str) -> Column:
    """A VARIANT as Spark writes it out, which is what the warehouse shows. The store's JSON type
    reprints numbers and drops keys whose value is null, so pages take their cells from this."""
    return F.to_json(column).alias(f"{column}_text")


def or_empty(column: str) -> Column:
    """A nullable key column as the store keys it, where null and empty are one value."""
    return F.coalesce(F.col(column), F.lit("")).alias(column)


class StoreTable:
    """A store table fed from the change feed of ``source_table``: a gold table, unless ``source``
    names another."""

    name: str
    source_table: str
    # The time the store table's month partitions follow.
    partitioned_by = "timestamp"
    # The time gold processed a row at, later on a recomputed copy than on the row it replaces.
    # Gold's uploads carry none.
    processed_at: str | None = "processed_timestamp"
    # How gold's table listing (experiment_table_metadata) types the experiment tables this table
    # holds, and the payload columns whose schemas it lists.
    table_type: str
    payloads: tuple[str, ...]
    # The store table its schema lines go to, after its rows.
    schema_table = PAYLOAD_SCHEMAS

    def source(self, catalog: str) -> str:
        """The table whose change feed the store table is fed from."""
        return f"LIVE.{self.source_table}"

    def lines(self, changes: DataFrame, reloaded: bool = False) -> DataFrame:
        """One JSON line, in column ``line``, per row gold inserted or updated in ``changes``, with
        the time the store partitions it by in ``partition_time``. The table's Float64 columns come
        first in the line, then its sensor readings.

        A reloaded line says it arrived when gold committed it, so the store's delivery metrics,
        which read ``inserted_at``, count only the rows the feed sends.
        """
        rows = changes.filter(F.col("_change_type").isin(*_KEPT_CHANGES))
        columns = self.columns()
        names = [column for column in columns if isinstance(column, str)]
        floats = [column for column in FLOAT64_COLUMNS if column in names]
        others = [column for column in columns if isinstance(column, Column) or column not in floats]
        fields = [*floats, *self.readings(), *others, "_commit_version", "_commit_timestamp"]
        if reloaded:
            fields.append(F.col("_commit_timestamp").alias("inserted_at"))
        row = F.struct(*fields)
        return rows.select(
            F.to_json(row, JSON_OPTIONS).alias("line"), F.col(self.partitioned_by).alias("partition_time")
        )

    def schema_lines(self, changes: DataFrame) -> DataFrame:
        """One JSON line, in column ``line``, per experiment table and payload column the rows in
        ``changes`` fill: the merge of their schemas, normalised as gold's listing normalises them,
        at the newest commit among them."""
        rows = changes.filter(F.col("_change_type").isin(*_KEPT_CHANGES))
        merged = rows.groupBy("experiment_id", self.identifier().alias("identifier")).agg(
            F.max("_commit_version").alias("_commit_version"),
            *[merged_variant_schema(payload).alias(payload) for payload in self.payloads],
        )
        schemas = merged.select(
            "experiment_id",
            "identifier",
            "_commit_version",
            F.explode(
                F.array(
                    *[F.struct(F.lit(p).alias("payload"), F.col(p).alias("schema")) for p in self.payloads]
                )
            ).alias("payload"),
        ).filter(F.col("identifier").isNotNull() & F.col("payload.schema").isNotNull())
        row = F.struct(
            "experiment_id",
            F.lit(self.table_type).alias("table_type"),
            "identifier",
            F.col("payload.payload").alias("payload"),
            F.col("payload.schema").alias("schema"),
            "_commit_version",
        )
        return schemas.select(F.to_json(row).alias("line"))

    def identifier(self) -> Column:
        """The experiment table a row belongs to, as gold's listing names it."""
        raise NotImplementedError

    def columns(self) -> list[str | Column]:
        raise NotImplementedError

    def readings(self) -> list[Column]:
        return []

    def key(self) -> list[Column]:
        """The store table's sorting key, on which it folds rows into one, from gold's columns."""
        raise NotImplementedError


class Measurements(StoreTable):
    name = "measurements"
    source_table = EXPERIMENT_RAW_DATA_TABLE
    table_type = "static"
    payloads = ("questions_data",)

    def identifier(self) -> Column:
        return F.lit("raw_data")

    def key(self) -> list[Column]:
        return [F.col("experiment_id"), clamped("timestamp"), F.col("id"), or_empty("device_id")]

    def columns(self) -> list[str | Column]:
        return [
            "experiment_id",
            "id",
            "device_id",
            "client_id",
            "device_name",
            "device_family",
            "device_version",
            "device_firmware",
            "device_battery",
            "device_address",
            "client_model",
            "client_manufacturer",
            "client_os",
            "client_os_version",
            "client_app_version",
            clamped("timestamp"),
            "timezone",
            # Gold's rows from before it checked zones keep any zone, and one Spark rejects fails the batch.
            F.hour(F.from_utc_timestamp("timestamp", usable_timezone(F.col("timezone")))).alias("hour_local"),
            "macros",
            "questions_data",
            "annotations",
            "user_id",
            "protocol_id",
            "workbook_run_id",
            "workbook_version_id",
            "macro_context",
            "latitude",
            "longitude",
            F.to_json("data").alias("data"),
            F.to_json("output_data").alias("output_data"),
            "processed_timestamp",
            "arrival_timestamp",
            "skip_macro_processing",
        ]

    def readings(self) -> list[Column]:
        return [
            sensor_readings("to_json(data)", name).alias(column) for column, name in SENSOR_READINGS.items()
        ]


class MacroResults(StoreTable):
    name = "macro_results"
    source_table = EXPERIMENT_MACRO_DATA_TABLE
    table_type = "macro"
    payloads = ("macro_output", "questions_data")

    def identifier(self) -> Column:
        return F.col("macro_id")

    def key(self) -> list[Column]:
        return [
            F.col("experiment_id"),
            or_empty("macro_id"),
            clamped("timestamp"),
            F.col("raw_id"),
            or_empty("macro_filename"),
            or_empty("device_id"),
        ]

    def columns(self) -> list[str | Column]:
        return [
            "experiment_id",
            "id",
            "raw_id",
            "device_id",
            "client_id",
            "device_name",
            clamped("timestamp"),
            "timezone",
            "user_id",
            "latitude",
            "longitude",
            "macro_id",
            "macro_name",
            "macro_filename",
            "workbook_run_id",
            "workbook_version_id",
            json_object("macro_output"),
            json_text("macro_output"),
            "macro_error",
            "processed_timestamp",
            "questions_data",
            "annotations",
        ]


class Uploads(StoreTable):
    name = "uploads"
    source_table = EXPERIMENT_UPLOADED_DATA_TABLE
    partitioned_by = "uploaded_at"
    processed_at = None
    table_type = "upload"
    payloads = ("uploaded_data",)

    def identifier(self) -> Column:
        return F.col("upload_table_id")

    def key(self) -> list[Column]:
        return [F.col("experiment_id"), or_empty("upload_table_id"), clamped("uploaded_at"), F.col("id")]

    def columns(self) -> list[str | Column]:
        return [
            "experiment_id",
            "id",
            "upload_table_id",
            "upload_table_name",
            "upload_id",
            "created_by",
            clamped("uploaded_at"),
            json_object("uploaded_data"),
            json_text("uploaded_data"),
        ]


class MetadataRows(StoreTable):
    """The rows of the experiments' metadata sheets, from the lakehouse's copy of the sheets, which
    the backend keeps to Postgres. That copy, unlike gold, edits and deletes a sheet in place, so this
    table takes deletions: an identifier an edit dropped, or every identifier of a deleted sheet, goes
    to the store as a row with ``is_deleted`` set at the commit that removed it.

    A sheet's rows are matched as the warehouse's enriched views match them, so both read the same
    metadata: by the identifier column's value as text, the first row of each identifier winning,
    and the rest of the row, without its ``_id``, as the fields. Each sheet also goes to
    ``metadata_sheets`` with the schema gold types its rows with."""

    name = "metadata_rows"
    source_table = EXPERIMENT_CUSTOM_METADATA_TABLE
    partitioned_by = "sheet_created_at"
    processed_at = None
    schema_table = METADATA_SHEETS

    def source(self, catalog: str) -> str:
        return f"{catalog}.centrum.{self.source_table}"

    def lines(self, changes: DataFrame, reloaded: bool = False) -> DataFrame:
        rows = self._sheet_rows(changes)
        keys = ["sheet_id", "identifier", "_commit_version"]
        current = rows.filter(F.col("_change_type").isin(*_KEPT_CHANGES))
        removed = rows.filter(F.col("_change_type").isin("update_preimage", "delete")).join(
            current.select(*keys), keys, "left_anti"
        )
        stored = current.withColumn("is_deleted", F.lit(0)).unionByName(
            removed.withColumn("is_deleted", F.lit(1))
        )
        row = F.struct(
            "experiment_id",
            "sheet_id",
            "sheet_created_at",
            "match_on",
            "identifier",
            "fields",
            "is_deleted",
            "_commit_version",
            "_commit_timestamp",
        )
        return stored.select(
            F.to_json(row, JSON_OPTIONS).alias("line"), F.col(self.partitioned_by).alias("partition_time")
        )

    def schema_lines(self, changes: DataFrame) -> DataFrame:
        """One JSON line per sheet in ``changes`` at each commit that changed it: its match and the
        schema of its rows as gold types custom metadata, none for a sheet without rows. A deleted
        sheet goes as deleted, as its rows do."""
        sheets = changes.selectExpr(
            "experiment_id",
            "metadata_id AS sheet_id",
            "created_at AS sheet_created_at",
            "coalesce(variant_get(metadata, '$.experimentQuestionId', 'STRING'), '') AS match_on",
            "metadata",
            "_change_type",
            "_commit_version",
        )
        keys = ["sheet_id", "_commit_version"]
        current = sheets.filter(F.col("_change_type").isin(*_KEPT_CHANGES))
        removed = sheets.filter(F.col("_change_type").isin("update_preimage", "delete")).join(
            current.select(*keys), keys, "left_anti"
        )
        typed = current.join(custom_metadata_schemas(current, *keys), keys, "left")
        stored = typed.withColumn("is_deleted", F.lit(0)).unionByName(
            removed.withColumn("custom_metadata_schema", F.lit(None).cast("string")).withColumn(
                "is_deleted", F.lit(1)
            )
        )
        row = F.struct(
            "experiment_id",
            "sheet_id",
            "sheet_created_at",
            "match_on",
            F.col("custom_metadata_schema").alias("schema"),
            "is_deleted",
            "_commit_version",
        )
        return stored.select(F.to_json(row, JSON_OPTIONS).alias("line"))

    def _sheet_rows(self, changes: DataFrame) -> DataFrame:
        """Each sheet's rows in ``changes``, one per identifier, per change. A sheet saved before its
        shape was checked, or a row that is no object, has none."""
        rows = (
            changes.selectExpr(
                "experiment_id",
                "metadata_id AS sheet_id",
                "created_at AS sheet_created_at",
                "variant_get(metadata, '$.experimentQuestionId', 'STRING') AS match_on",
                "variant_get(metadata, '$.identifierColumnId', 'STRING') AS identifier_column",
                "_change_type",
                "_commit_version",
                "_commit_timestamp",
                "posexplode(try_variant_get(metadata, '$.rows', 'ARRAY<VARIANT>')) AS (position, row)",
            )
            .selectExpr(
                "*",
                "try_variant_get(row, '$', 'MAP<STRING, VARIANT>') AS row_map",
            )
            .selectExpr(
                "experiment_id",
                "sheet_id",
                "sheet_created_at",
                "coalesce(match_on, '') AS match_on",
                "variant_get(element_at(row_map, identifier_column), '$', 'STRING') AS identifier",
                "to_json(map_filter(row_map, (k, v) -> k != '_id' AND k != identifier_column)) AS fields",
                "_change_type",
                "_commit_version",
                "_commit_timestamp",
                "position",
            )
            .filter(F.col("identifier").isNotNull())
        )
        first = Window.partitionBy("sheet_id", "identifier", "_commit_version", "_change_type").orderBy(
            "position"
        )
        return (
            rows.withColumn("_nth", F.row_number().over(first))
            .filter(F.col("_nth") == 1)
            .drop("_nth", "position")
        )


MEASUREMENTS = Measurements()
MACRO_RESULTS = MacroResults()
UPLOADS = Uploads()
METADATA_ROWS = MetadataRows()
