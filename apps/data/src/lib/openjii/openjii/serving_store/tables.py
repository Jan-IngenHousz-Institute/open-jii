"""What each store table holds, built from the change feed of the table it reads: a gold or silver
table, or the lakehouse's copy of the metadata sheets."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

from pyspark.sql import Column, DataFrame, Window
from pyspark.sql import functions as F

from openjii.centrum.constants import (
    CLEAN_DEVICE_LIFECYCLE_EVENTS_TABLE,
    EXPERIMENT_CUSTOM_METADATA_TABLE,
    EXPERIMENT_MACRO_DATA_TABLE,
    EXPERIMENT_RAW_DATA_TABLE,
    EXPERIMENT_UPLOADED_DATA_TABLE,
    SILVER_TABLE_DEFAULT,
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


@dataclass(frozen=True)
class Settle:
    """A statement the writer runs once each chunk of a table has landed, over the chunk's lines,
    which it sends beside the statement as the table ``chunk`` with ``structure``."""

    statement: str
    structure: str


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
    """A store table fed from the change feed of ``source_table``: a table of gold, or of silver for
    rows no experiment holds, unless ``source`` names another."""

    name: str
    source_table: str
    # The time the store table's month partitions follow.
    partitioned_by = "timestamp"
    # The time the source processed a row at, later on a recomputed copy than on the row it replaces.
    # Gold's uploads carry none.
    processed_at: str | None = "processed_timestamp"
    # How gold's table listing (experiment_table_metadata) types the experiment tables this table
    # holds, and the payload columns whose schemas it lists.
    table_type: str
    payloads: tuple[str, ...] = ()
    # The store table its schema lines go to, after its rows.
    schema_table = PAYLOAD_SCHEMAS
    # A table whose rows belong to no experiment reloads whole and counts its rows by device.
    per_experiment = True
    # The store tables the migrations keep from this one by a materialized view, which a reload's
    # delete reaches too, since a view only adds rows.
    derived_tables: tuple[str, ...] = ()
    # Without its start version the pipeline fails at start, rather than leaving the table unfed.
    needs_start_version = True

    @property
    def counted_by(self) -> str:
        return "experiment_id" if self.per_experiment else "client_id"

    @property
    def sends_schemas(self) -> bool:
        """Whether a batch brings schema lines for ``schema_table``: a table's payload schemas."""
        return len(self.payloads) > 0

    def source(self, catalog: str) -> str:
        """The table whose change feed the store table is fed from."""
        return f"LIVE.{self.source_table}"

    def lines(self, changes: DataFrame, reloaded: bool = False) -> DataFrame:
        """One JSON line, in column ``line``, per row the source inserted or updated in ``changes``, with
        the time the store partitions it by in ``partition_time``. The table's Float64 columns come
        first in the line, then its sensor readings.

        A reloaded line says it arrived when the source committed it, so the store's delivery metrics,
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
        """The store table's sorting key, on which it folds rows into one, from the source's columns."""
        raise NotImplementedError

    def reloaded_rows(self, rows: DataFrame, read: Callable[[str], DataFrame]) -> DataFrame:
        """The rows a reload sends of the source's ``rows``, where ``read`` reads another table beside
        the source."""
        return rows

    def newest_copies(self, rows: DataFrame) -> DataFrame:
        """The source's newest copy of each store key in ``rows``, the one the store keeps. The
        source tables only append, so a recomputed row stands beside the one it replaces, and a load
        sends every row at one version, which would leave the store to keep either.

        The newest copy is the one of the newest commit, which a change feed's rows carry, and of those
        the one the source processed last. A reload's rows carry no commit: its dedicated compute
        reads the streaming tables through a view, which hides ``_metadata.row_commit_version``.
        Copies with one commit and processing time keep the first client's, and copies that tie on
        that too, such as a capture a client sent twice in one batch, the one whose fields hash
        lowest, so a batch and a reload of that commit send the same one."""
        newest_commit = [F.col("_commit_version").desc()] if "_commit_version" in rows.columns else []
        processed_last = F.col(self.processed_at).desc_nulls_last() if self.processed_at else F.lit(0)
        first_client = [F.col("client_id").asc_nulls_last()] if "client_id" in rows.columns else []
        # The source's own columns, which a change feed's rows and a snapshot's share, written in UTC.
        fields = F.struct(*[name for name in rows.columns if not name.startswith("_")])
        lowest_hash = F.xxhash64(F.to_json(fields, JSON_OPTIONS))
        newest = Window.partitionBy(*self.key()).orderBy(
            *newest_commit, processed_last, *first_client, lowest_hash
        )
        return rows.withColumn("_copy", F.row_number().over(newest)).filter(F.col("_copy") == 1).drop("_copy")


class Measurements(StoreTable):
    name = "measurements"
    source_table = EXPERIMENT_RAW_DATA_TABLE
    table_type = "static"
    payloads = ("questions_data",)
    derived_tables = ("measurements_by_device",)

    # measurements keeps one copy of a capture, whichever client sent it, while its copy by device
    # keeps each client's. Once a chunk has landed, every client's copy of the chunk's captures is
    # rewritten from the row measurements FINAL keeps: the kept client's with that row's fields, every
    # other replaced. The device copy then never disagrees with measurements on a client or a field,
    # whichever writer's copy measurements kept. The device copy's projection by capture keeps the
    # work to the chunk's captures.
    #
    # Each settle stamps its rows with a time the writer reads before sending it, so the stamp always
    # comes before the settle's own read, and the device copy orders by it. Every insert settles
    # after it lands, so the settle with the newest stamp read every insert's rows, and its rows win
    # over an older settle's, even one that finishes after it.
    settle = Settle(
        statement="""
            INSERT INTO {database}.measurements_by_device
                (client_id, timestamp, id, experiment_id, device_id, device_version, device_firmware,
                 device_battery, protocol_id, workbook_run_id, workbook_version_id, latitude, longitude,
                 macros, _commit_version, is_replaced, _settle_version)
            SELECT copy.client_id, copy.timestamp, copy.id, copy.experiment_id, copy.device_id,
                kept.device_version, kept.device_firmware, kept.device_battery, kept.protocol_id,
                kept.workbook_run_id, kept.workbook_version_id, kept.latitude, kept.longitude, kept.macros,
                kept._commit_version,
                -- A kept copy without a client leaves every client's copy replaced.
                copy.client_id != ifNull(kept.client_id, ''),
                {{stamp:UInt64}}
            FROM
            (
                -- Grouped rather than DISTINCT, which keeps the store off the projection by capture.
                SELECT client_id, timestamp, id, experiment_id, device_id,
                    ifNull(device_id, '') AS device_key
                FROM {database}.measurements_by_device
                WHERE (experiment_id, timestamp, id, ifNull(device_id, '')) IN (
                    SELECT experiment_id, timestamp, id, ifNull(device_id, '') FROM chunk
                )
                GROUP BY client_id, timestamp, id, experiment_id, device_id
            ) AS copy
            INNER JOIN
            (
                SELECT experiment_id, timestamp, id, ifNull(device_id, '') AS device_key, client_id,
                    device_version, device_firmware, device_battery, protocol_id, workbook_run_id,
                    workbook_version_id, latitude, longitude, macros, _commit_version
                FROM {database}.measurements FINAL
                WHERE (experiment_id, timestamp, id, ifNull(device_id, '')) IN (
                    SELECT experiment_id, timestamp, id, ifNull(device_id, '') FROM chunk
                )
            ) AS kept
            ON copy.experiment_id = kept.experiment_id AND copy.timestamp = kept.timestamp
                AND copy.id = kept.id AND copy.device_key = kept.device_key
        """,
        structure="experiment_id String, timestamp DateTime64(6, 'UTC'), id Int64, device_id Nullable(String)",
    )

    def lines(self, changes: DataFrame, reloaded: bool = False) -> DataFrame:
        """A batch's lines hold one copy of each capture, as a reload's do: of the batch's copies,
        the one the store would keep. A later batch can still bring a copy that replaces it."""
        if not reloaded:
            changes = self.newest_copies(changes.filter(F.col("_change_type").isin(*_KEPT_CHANGES)))
        return super().lines(changes, reloaded)

    def reloaded_rows(self, rows: DataFrame, read: Callable[[str], DataFrame]) -> DataFrame:
        """Gold's rows with the firmware and battery silver holds where gold has none: gold only
        filled both on rows it wrote after it began carrying them, while silver has them on nearly all.
        Both come from one silver row of the same capture and client, the one silver processed last,
        and of rows with one processing time the one whose fields hash lowest: silver keeps a capture
        it was sent twice twice, and two captures can share an id."""
        capture = F.struct(*self.key(), or_empty("client_id")).alias("_capture")
        lowest_hash = F.xxhash64(F.to_json(F.struct("_silver_version", "_silver_battery"), JSON_OPTIONS))
        processed_last = Window.partitionBy("_capture").orderBy(
            F.col("processed_timestamp").desc_nulls_last(), lowest_hash
        )
        gold = rows.withColumn("_capture", capture)
        silver = (
            read(SILVER_TABLE_DEFAULT)
            .select(
                capture,
                F.col("device_version").alias("_silver_version"),
                F.col("device_battery").alias("_silver_battery"),
                "processed_timestamp",
            )
            .join(gold.select("_capture").distinct(), "_capture", "left_semi")
            .withColumn("_copy", F.row_number().over(processed_last))
            .filter(F.col("_copy") == 1)
            .drop("_copy", "processed_timestamp")
        )
        return (
            gold.join(silver, "_capture", "left")
            .withColumns(
                {
                    "device_version": F.coalesce("device_version", "_silver_version"),
                    "device_battery": F.coalesce("device_battery", "_silver_battery"),
                }
            )
            .drop("_capture", "_silver_version", "_silver_battery")
        )

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

    @property
    def sends_schemas(self) -> bool:
        return True

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


class DeviceEvents(StoreTable):
    """Silver's connects and disconnects, which belong to a device and to no experiment."""

    name = "device_events"
    source_table = CLEAN_DEVICE_LIFECYCLE_EVENTS_TABLE
    partitioned_by = "event_timestamp"
    processed_at = "ingestion_timestamp"
    per_experiment = False
    # Fed once silver's change feed is on and a start version is set; until then it has no sink.
    needs_start_version = False

    def key(self) -> list[Column]:
        return [
            F.col("client_id"),
            clamped("event_timestamp"),
            F.col("event_type"),
            F.col("session_identifier").isNull().alias("session_identifier_is_null"),
            or_empty("session_identifier"),
        ]

    def columns(self) -> list[str | Column]:
        return [
            "client_id",
            "event_type",
            clamped("event_timestamp"),
            "session_identifier",
            "disconnect_reason",
        ]


MEASUREMENTS = Measurements()
MACRO_RESULTS = MacroResults()
UPLOADS = Uploads()
METADATA_ROWS = MetadataRows()
DEVICE_EVENTS = DeviceEvents()

# What the writer runs after each chunk it inserts, by the table the chunk went to.
SETTLES = {MEASUREMENTS.name: MEASUREMENTS.settle}
