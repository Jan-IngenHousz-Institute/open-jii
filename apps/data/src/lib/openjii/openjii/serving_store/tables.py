"""What each store table holds, built from its gold table's change feed."""

from __future__ import annotations

from datetime import datetime, timezone

from pyspark.sql import Column, DataFrame
from pyspark.sql import functions as F

from openjii.centrum.constants import (
    EXPERIMENT_MACRO_DATA_TABLE,
    EXPERIMENT_RAW_DATA_TABLE,
    EXPERIMENT_UPLOADED_DATA_TABLE,
)
from openjii.variant_schema import merged_variant_schema

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


def or_empty(column: str) -> Column:
    """A nullable key column as the store keys it, where null and empty are one value."""
    return F.coalesce(F.col(column), F.lit("")).alias(column)


class StoreTable:
    """A store table fed from one gold table."""

    name: str
    gold_table: str
    # The time the store table's month partitions follow.
    partitioned_by = "timestamp"
    # How gold's table listing (experiment_table_metadata) types the experiment tables this table
    # holds, and the payload columns whose schemas it lists.
    table_type: str
    payloads: tuple[str, ...]

    def lines(self, changes: DataFrame, reloaded: bool = False) -> DataFrame:
        """One JSON line, in column ``line``, per row gold inserted or updated in ``changes``, with
        the time the store partitions it by in ``partition_time``.

        A reloaded line says it arrived when gold committed it, so the store's delivery metrics,
        which read ``inserted_at``, count only the rows the feed sends.
        """
        rows = changes.filter(F.col("_change_type").isin(*_KEPT_CHANGES))
        fields = [*self.columns(), "_commit_version", "_commit_timestamp"]
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

    def key(self) -> list[Column]:
        """The store table's sorting key, on which it folds rows into one, from gold's columns."""
        raise NotImplementedError


class Measurements(StoreTable):
    name = "measurements"
    gold_table = EXPERIMENT_RAW_DATA_TABLE
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


class MacroResults(StoreTable):
    name = "macro_results"
    gold_table = EXPERIMENT_MACRO_DATA_TABLE
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
            "macro_error",
            "processed_timestamp",
            "questions_data",
            "annotations",
        ]


class Uploads(StoreTable):
    name = "uploads"
    gold_table = EXPERIMENT_UPLOADED_DATA_TABLE
    partitioned_by = "uploaded_at"
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
        ]


MEASUREMENTS = Measurements()
MACRO_RESULTS = MacroResults()
UPLOADS = Uploads()
