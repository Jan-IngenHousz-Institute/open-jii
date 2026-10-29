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
from openjii.metrics.constants import SENSOR_PARAMETER_ALLOWLIST
from openjii.metrics.sensor_readings import sensor_readings

# The store parses microseconds without an offset. Spark's default writes milliseconds with the
# session's offset, and pre-1900 zones carry offsets such as +00:17:30 that the store refuses.
JSON_OPTIONS = {"timestampFormat": "yyyy-MM-dd HH:mm:ss.SSSSSS", "timeZone": "UTC"}

# DateTime64's range. The store clamps only the date of a value outside it and keeps the time of
# day, so the feed clamps whole values.
_EARLIEST = datetime(1900, 1, 1, tzinfo=timezone.utc)
_LATEST = datetime(2299, 12, 31, 23, 59, 59, 999999, tzinfo=timezone.utc)

# Only rows gold holds are sent. A refresh of gold sends every old row as a delete, which the feed
# drops, so a row gold removes stays in the store until a reload.
_KEPT_CHANGES = ("insert", "update_postimage")

_DEVICE_FIELDS = (
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
)


def clamped(column: str) -> Column:
    """A timestamp held within the store's range."""
    return F.least(F.greatest(F.col(column), F.lit(_EARLIEST)), F.lit(_LATEST)).alias(column)


def local_time() -> Column:
    """The measurement's wall-clock time where it was taken, as the enriched views give it. The store
    cannot convert with a zone that differs per row, so the feed sends it ready."""
    return F.when(
        F.col("timezone").isNotNull(),
        F.date_format(F.from_utc_timestamp("timestamp", F.col("timezone")), "yyyy-MM-dd HH:mm:ss"),
    ).alias("measurement_time_local")


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


class StoreTable:
    """A store table fed from one gold table."""

    name: str
    gold_table: str
    # The time the store table's month partitions follow.
    partitioned_by = "timestamp"

    def lines(self, changes: DataFrame) -> DataFrame:
        """One JSON line, in column ``line``, per row gold inserted or updated in ``changes``, with
        the time the store partitions it by in ``partition_time``."""
        rows = self.prepared(changes.filter(F.col("_change_type").isin(*_KEPT_CHANGES)))
        row = F.struct(*self.columns(), "_commit_version", "_commit_timestamp")
        return rows.select(
            F.to_json(row, JSON_OPTIONS).alias("line"), F.col(self.partitioned_by).alias("partition_time")
        )

    def prepared(self, changes: DataFrame) -> DataFrame:
        return changes

    def columns(self) -> list[str | Column]:
        raise NotImplementedError


class Measurements(StoreTable):
    name = "measurements"
    gold_table = EXPERIMENT_RAW_DATA_TABLE

    def prepared(self, changes: DataFrame) -> DataFrame:
        return changes.withColumn("_payload", F.to_json("data"))

    def columns(self) -> list[str | Column]:
        sensors = [
            sensor_readings("_payload", name).alias(f"sensor_{name}") for name in SENSOR_PARAMETER_ALLOWLIST
        ]
        return [
            "experiment_id",
            "id",
            "device_id",
            "client_id",
            "device_name",
            *_DEVICE_FIELDS,
            clamped("timestamp"),
            "timezone",
            local_time(),
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
            F.col("_payload").alias("data"),
            F.to_json("output_data").alias("output_data"),
            *sensors,
            "processed_timestamp",
            "arrival_timestamp",
            "skip_macro_processing",
        ]


class MacroResults(StoreTable):
    name = "macro_results"
    gold_table = EXPERIMENT_MACRO_DATA_TABLE

    def columns(self) -> list[str | Column]:
        # Both are in the store's sort key, which cannot hold a null.
        macro_id = F.coalesce(F.col("macro_id"), F.lit("")).alias("macro_id")
        macro_filename = F.coalesce(F.col("macro_filename"), F.lit("")).alias("macro_filename")
        return [
            "experiment_id",
            "id",
            "raw_id",
            "device_id",
            "client_id",
            "device_name",
            clamped("timestamp"),
            "timezone",
            local_time(),
            "user_id",
            "latitude",
            "longitude",
            macro_id,
            "macro_name",
            macro_filename,
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

    def columns(self) -> list[str | Column]:
        return [
            "experiment_id",
            "id",
            F.coalesce(F.col("upload_table_id"), F.lit("")).alias("upload_table_id"),
            "upload_table_name",
            "upload_id",
            "created_by",
            clamped("uploaded_at"),
            json_object("uploaded_data"),
        ]


MEASUREMENTS = Measurements()
MACRO_RESULTS = MacroResults()
UPLOADS = Uploads()
