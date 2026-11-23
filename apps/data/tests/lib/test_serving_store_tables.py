"""What the feed sends for each gold table: the rows gold holds now, in the shapes the store reads.

The tests marked ``clickhouse`` also send them through the writer into the migrations' tables on the
test store ``pnpm test`` starts, of the version the store runs.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
import requests
from openjii.serving_store import writer as writer_module
from openjii.serving_store.tables import (
    DEVICE_EVENTS,
    MACRO_RESULTS,
    MEASUREMENTS,
    METADATA_ROWS,
    SENSOR_READINGS,
    UPLOADS,
    StoreTable,
)
from openjii.serving_store.writer import StoreWriter, Written, exact_doubles, storable
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

pytestmark = pytest.mark.spark

_DATABASE = "feed_test"
_WRITER = "feed_test_writer"

_RAW_DATA_CHANGES = """
    SELECT
      'e1' AS experiment_id, id, 'd1' AS device_id, 'c1' AS client_id, 'MultispeQ' AS device_name,
      'multispeq' AS device_family, '2' AS device_version, '2.345' AS device_firmware,
      87.5D AS device_battery, 'AA:BB:CC:DD:EE:FF' AS device_address, 'Pixel 8' AS client_model,
      'Google' AS client_manufacturer, 'android' AS client_os, '15' AS client_os_version,
      '1.42.0' AS client_app_version, ts AS timestamp, 'Europe/Amsterdam' AS timezone,
      array(named_struct('id', 'm1', 'name', 'Phi2', 'filename', 'phi2.js')) AS macros,
      parse_json('{"plot": "A1", "note": null}') AS questions_data,
      array(named_struct(
        'id', 'a1', 'rowId', '1', 'type', 'comment',
        'content', named_struct('text', 'leaf torn', 'flagType', CAST(NULL AS STRING)),
        'createdBy', 'u1', 'createdByName', 'Ada',
        'createdAt', TIMESTAMP'2026-10-19 10:05:00', 'updatedAt', CAST(NULL AS TIMESTAMP)
      )) AS annotations,
      'u1' AS user_id, 'p1' AS protocol_id, CAST(NULL AS STRING) AS workbook_run_id,
      CAST(NULL AS STRING) AS workbook_version_id, CAST(NULL AS STRING) AS macro_context,
      52.1D AS latitude, 5.1D AS longitude,
      parse_json('[{"set": [{"temperature": 19.5}, {"temperature": 20}]}, {"data": {"par": 120}}]') AS data,
      parse_json('{"phi2": 0.7}') AS output_data, DATE'2026-10-19' AS date,
      TIMESTAMP'2026-10-19 10:00:03' AS processed_timestamp, CAST(NULL AS TIMESTAMP) AS arrival_timestamp,
      CAST(NULL AS BOOLEAN) AS skip_macro_processing,
      change AS _change_type, 7L AS _commit_version, TIMESTAMP'2026-10-19 10:00:04' AS _commit_timestamp
    FROM VALUES
      (1L, TIMESTAMP'2026-10-19 10:00:00.123456', 'insert'),
      (2L, TIMESTAMP'2500-01-01 07:00:00', 'update_postimage'),
      (3L, TIMESTAMP'1850-06-01 07:42:30', 'insert'),
      (4L, TIMESTAMP'2026-10-19 10:00:00', 'delete'),
      (5L, TIMESTAMP'2026-10-19 10:00:00', 'update_preimage')
    AS t(id, ts, change)
"""

_MACRO_DATA_CHANGES = """
    SELECT
      'e1' AS experiment_id, id, id - 10 AS raw_id, 'd1' AS device_id, 'c1' AS client_id,
      'MultispeQ' AS device_name, TIMESTAMP'2026-10-19 10:00:00' AS timestamp, 'UTC' AS timezone,
      'u1' AS user_id, CAST(NULL AS DOUBLE) AS latitude, CAST(NULL AS DOUBLE) AS longitude,
      macro_id, 'Phi2' AS macro_name, macro_filename, CAST(NULL AS STRING) AS workbook_run_id,
      CAST(NULL AS STRING) AS workbook_version_id, parse_json(output) AS macro_output,
      CAST(NULL AS STRING) AS macro_error, TIMESTAMP'2026-10-19 10:00:05' AS processed_timestamp,
      DATE'2026-10-19' AS date, CAST(NULL AS VARIANT) AS questions_data,
      CAST(array() AS ARRAY<STRUCT<id: STRING>>) AS annotations,
      'insert' AS _change_type, 9L AS _commit_version, TIMESTAMP'2026-10-19 10:00:06' AS _commit_timestamp
    FROM VALUES
      (11L, 'm1', 'phi2.js', '{"phi2": 0.7, "Plot no.": "A1"}'),
      (12L, 'm1', 'phi2.js', '[0.7, 0.71]'),
      (13L, 'm1', 'phi2.js', '0.7'),
      (14L, 'm1', 'phi2.js', 'null'),
      (15L, CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS STRING)),
      (16L, 'm2', 'count.js', '{"w": 18446744073709551616, "n": [1, -99999999999999999999]}')
    AS t(id, macro_id, macro_filename, output)
"""

_UPLOADED_DATA_CHANGES = """
    SELECT
      'e1' AS experiment_id, 21L AS id, CAST(NULL AS STRING) AS upload_table_id, 'Soil' AS upload_table_name,
      'up1' AS upload_id, 'u1' AS created_by, TIMESTAMP'2026-10-19 09:00:00' AS uploaded_at,
      parse_json('[{"ph": 6.5}]') AS uploaded_data,
      'insert' AS _change_type, 3L AS _commit_version, TIMESTAMP'2026-10-19 09:00:01' AS _commit_timestamp
"""

# Silver's lifecycle events, with the ingestion time silver adds.
_LIFECYCLE_EVENT_CHANGES = """
    SELECT client_id, event_type, ts AS event_timestamp, session AS session_identifier,
      reason AS disconnect_reason, TIMESTAMP'2026-10-19 09:05:00' AS ingestion_timestamp,
      change AS _change_type, 12L AS _commit_version, TIMESTAMP'2026-10-19 09:05:01' AS _commit_timestamp
    FROM VALUES
      ('c1', 'connected', TIMESTAMP'2026-10-19 09:00:00.123', 's1', CAST(NULL AS STRING), 'insert'),
      ('c1', 'disconnected', TIMESTAMP'2026-10-19 09:04:00', 's1', 'CLIENT_INITIATED_DISCONNECT', 'insert'),
      ('c2', 'connected', TIMESTAMP'1850-01-01 00:00:00', CAST(NULL AS STRING), CAST(NULL AS STRING), 'insert'),
      ('c3', 'connected', TIMESTAMP'2026-10-19 09:00:00', 's3', CAST(NULL AS STRING), 'delete')
    AS t(client_id, event_type, ts, session, reason, change)
"""


@pytest.fixture(autouse=True)
def utc(spark: SparkSession) -> Iterator[None]:
    """Databricks sessions run in UTC, which the fixtures' timestamps assume."""
    spark.conf.set("spark.sql.session.timeZone", "UTC")
    yield
    spark.conf.unset("spark.sql.session.timeZone")


def _rows(lines: DataFrame) -> dict[int, dict]:
    rows = [json.loads(row.line) for row in lines.collect()]
    return {row["id"]: row for row in rows}


def test_a_line_starts_with_its_float64_columns_for_the_writer_to_rewrite(spark: SparkSession) -> None:
    measurement = MEASUREMENTS.lines(spark.sql(_RAW_DATA_CHANGES)).first()
    upload = UPLOADS.lines(spark.sql(_UPLOADED_DATA_CHANGES)).first()

    assert measurement is not None and upload is not None
    assert measurement.line.startswith(
        '{"latitude":52.1,"longitude":5.1,"device_battery":87.5,'
        '"par_readings":[120.0],"temperature_readings":[19.5,20.0],"humidity_readings":[],'
        '"pressure_readings":[],"light_intensity_readings":[],"thickness_readings":[],"experiment_id":'
    )
    assert upload.line.startswith('{"experiment_id":')


def test_a_measurement_carries_its_columns(spark: SparkSession) -> None:
    row = _rows(MEASUREMENTS.lines(spark.sql(_RAW_DATA_CHANGES)))[1]

    assert row["timestamp"] == "2026-10-19 10:00:00.123456"
    assert row["device_family"] == "multispeq"
    assert row["client_app_version"] == "1.42.0"
    assert row["questions_data"] == {"plot": "A1", "note": None}
    assert row["annotations"][0]["content"] == {"text": "leaf torn"}
    assert row["annotations"][0]["createdAt"] == "2026-10-19 10:05:00.000000"
    assert json.loads(row["data"]) == [
        {"set": [{"temperature": 19.5}, {"temperature": 20}]},
        {"data": {"par": 120}},
    ]
    assert json.loads(row["output_data"]) == {"phi2": 0.7}
    assert row["_commit_version"] == 7
    assert row["_commit_timestamp"] == "2026-10-19 10:00:04.000000"
    assert "date" not in row


def test_a_measurement_carries_every_sensor_reading_of_both_payload_shapes(spark: SparkSession) -> None:
    changes = _RAW_DATA_CHANGES.replace(
        """parse_json('[{"set": [{"temperature": 19.5}, {"temperature": 20}]}, {"data": {"par": 120}}]')""",
        """parse_json('[{"data": {"par": 120, "thickness": "0.42"}, "set": [{"par": 80}, {"par": "dim"}]}, '
        '{"data": {"humidity": null}, "set": [{"pressure": 1013.25}]}]')""",
    )

    row = _rows(MEASUREMENTS.lines(spark.sql(changes)))[1]

    assert {column: row[column] for column in SENSOR_READINGS} == {
        "par_readings": [120.0, 80.0],
        "temperature_readings": [],
        "humidity_readings": [],
        "pressure_readings": [1013.25],
        "light_intensity_readings": [],
        "thickness_readings": [0.42],
    }


@pytest.mark.parametrize(
    ("zone", "hour"),
    [("'Europe/Amsterdam'", 12), ("'+02:00'", 12), ("'PST'", 3), ("'UTC+2'", 12), ("'Z'", 10)],
)
def test_a_measurement_carries_its_local_hour_in_every_zone_spark_knows(
    spark: SparkSession, zone: str, hour: int
) -> None:
    changes = _RAW_DATA_CHANGES.replace("'Europe/Amsterdam' AS timezone", f"{zone} AS timezone")

    row = _rows(MEASUREMENTS.lines(spark.sql(changes)))[1]

    assert row["hour_local"] == hour


def test_a_measurement_without_a_zone_has_no_local_hour(spark: SparkSession) -> None:
    changes = _RAW_DATA_CHANGES.replace("'Europe/Amsterdam' AS timezone", "CAST(NULL AS STRING) AS timezone")

    assert "hour_local" not in _rows(MEASUREMENTS.lines(spark.sql(changes)))[1]


@pytest.mark.parametrize("zone", ["AMT", "Mars/Olympus"])
def test_a_row_gold_kept_with_a_zone_spark_rejects_loses_only_its_local_hour(
    spark: SparkSession, zone: str
) -> None:
    changes = _RAW_DATA_CHANGES.replace("'Europe/Amsterdam' AS timezone", f"'{zone}' AS timezone")

    # Gold's rows reach the probe as data. Over inline rows Spark evaluates it while planning, where
    # a zone it rejects throws instead of giving null, so the rows are shuffled first.
    rows = _rows(MEASUREMENTS.lines(spark.sql(changes).repartition(1)))

    assert set(rows) == {1, 2, 3}
    assert rows[1]["timezone"] == zone
    assert "hour_local" not in rows[1]


def test_a_payload_that_is_not_a_list_of_samples_has_no_readings(spark: SparkSession) -> None:
    changes = _RAW_DATA_CHANGES.replace(
        """parse_json('[{"set": [{"temperature": 19.5}, {"temperature": 20}]}, {"data": {"par": 120}}]')""",
        """parse_json('{"data": {"par": 120}}')""",
    )

    row = _rows(MEASUREMENTS.lines(spark.sql(changes)))[1]

    assert not any(column in row for column in SENSOR_READINGS)


def test_only_rows_gold_holds_now_are_sent(spark: SparkSession) -> None:
    assert set(_rows(MEASUREMENTS.lines(spark.sql(_RAW_DATA_CHANGES)))) == {1, 2, 3}


def test_a_batch_that_holds_a_capture_twice_sends_the_copy_gold_processed_last(spark: SparkSession) -> None:
    first = spark.sql(_RAW_DATA_CHANGES).filter("id = 1")
    again = first.withColumns(
        {"client_id": F.lit("c2"), "processed_timestamp": F.lit("2026-10-19 10:05:00").cast("timestamp")}
    )
    removed = first.withColumns({"client_id": F.lit("c3"), "_change_type": F.lit("delete")}).withColumn(
        "processed_timestamp", F.lit("2026-10-19 11:00:00").cast("timestamp")
    )

    lines = MEASUREMENTS.lines(first.unionByName(again).unionByName(removed))

    sent = [json.loads(row.line) for row in lines.collect()]
    assert [(row["id"], row["client_id"]) for row in sent] == [(1, "c2")]


def test_a_batch_that_holds_a_capture_in_two_commits_sends_the_newer_commits_copy(
    spark: SparkSession,
) -> None:
    older = (
        spark.sql(_RAW_DATA_CHANGES)
        .filter("id = 1")
        .withColumns(
            {
                "client_id": F.lit("c1"),
                "_commit_version": F.lit(11).cast("long"),
                "processed_timestamp": F.lit("2026-10-19 10:05:00").cast("timestamp"),
            }
        )
    )
    newer = older.withColumns(
        {
            "client_id": F.lit("c2"),
            "_commit_version": F.lit(12).cast("long"),
            "processed_timestamp": F.lit("2026-10-19 10:01:00").cast("timestamp"),
        }
    )

    lines = MEASUREMENTS.lines(older.unionByName(newer))

    sent = [json.loads(row.line) for row in lines.collect()]
    assert [(row["client_id"], row["_commit_version"]) for row in sent] == [("c2", 12)]


def test_copies_with_one_commit_and_processing_time_keep_the_first_clients_in_a_batch_and_a_reload_alike(
    spark: SparkSession,
) -> None:
    second = (
        spark.sql(_RAW_DATA_CHANGES)
        .filter("id = 1")
        .withColumns(
            {
                "client_id": F.lit("c2"),
                "_commit_version": F.lit(12).cast("long"),
                "processed_timestamp": F.lit("2026-10-19 10:05:00").cast("timestamp"),
            }
        )
    )
    copies = second.unionByName(second.withColumn("client_id", F.lit("c1")))

    batch = [json.loads(row.line)["client_id"] for row in MEASUREMENTS.lines(copies).collect()]
    reloaded = [row.client_id for row in MEASUREMENTS.newest_copies(copies.drop("_commit_version")).collect()]

    assert (batch, reloaded) == (["c1"], ["c1"])


@pytest.mark.parametrize("reversed_input", [False, True], ids=["in-order", "reversed"])
def test_copies_that_tie_on_commit_processing_time_and_client_keep_one_copy_in_a_batch_and_a_reload_alike(
    spark: SparkSession, reversed_input: bool
) -> None:
    # A capture one client sent twice in one silver batch: everything the order reads ties.
    copy = (
        spark.sql(_RAW_DATA_CHANGES)
        .filter("id = 1")
        .withColumns(
            {
                "_commit_version": F.lit(12).cast("long"),
                "processed_timestamp": F.lit("2026-10-19 10:05:00").cast("timestamp"),
            }
        )
    )
    first, second = (
        copy.withColumn("device_battery", F.lit(43.0)),
        copy.withColumn("device_battery", F.lit(82.0)),
    )
    copies = second.unionByName(first) if reversed_input else first.unionByName(second)

    batch = [
        json.loads(row.line)["device_battery"] for row in MEASUREMENTS.lines(copies.repartition(1)).collect()
    ]
    reloaded = [
        row.device_battery
        for row in MEASUREMENTS.newest_copies(
            copies.drop("_change_type", "_commit_version", "_commit_timestamp")
        )
        .repartition(1)
        .collect()
    ]

    assert len(batch) == 1
    assert batch == reloaded
    assert batch[0] == _TIED_COPY_KEPT


# Which of the two tied copies both keep, by the hash of their fields; fixed, so the choice never
# depends on the input order or on which writer sends it.
_TIED_COPY_KEPT = 43.0


def test_timestamps_outside_the_stores_range_are_clamped_whole(spark: SparkSession) -> None:
    rows = _rows(MEASUREMENTS.lines(spark.sql(_RAW_DATA_CHANGES)))

    assert rows[2]["timestamp"] == "2299-12-31 23:59:59.999999"
    assert rows[3]["timestamp"] == "1900-01-01 00:00:00.000000"


def test_macro_output_is_an_object_or_missing(spark: SparkSession) -> None:
    rows = _rows(MACRO_RESULTS.lines(spark.sql(_MACRO_DATA_CHANGES)))

    assert rows[11]["macro_output"] == {"phi2": 0.7, "Plot no.": "A1"}
    assert rows[12]["macro_output"] == {"_items": [0.7, 0.71]}
    assert rows[13]["macro_output"] == {"_value": 0.7}
    assert "macro_output" not in rows[14]
    assert "macro_output" not in rows[15]
    assert "macro_id" not in rows[15]
    assert rows[11]["raw_id"] == 1


def test_macro_output_also_goes_as_the_text_spark_writes(spark: SparkSession) -> None:
    rows = _rows(MACRO_RESULTS.lines(spark.sql(_MACRO_DATA_CHANGES)))

    assert rows[11]["macro_output_text"] == '{"Plot no.":"A1","phi2":0.7}'
    assert rows[12]["macro_output_text"] == "[0.7,0.71]"
    assert rows[13]["macro_output_text"] == "0.7"
    assert rows[14]["macro_output_text"] == "null"
    assert "macro_output_text" not in rows[15]


def test_a_payloads_text_keeps_how_gold_holds_each_number_and_its_null_keys(spark: SparkSession) -> None:
    changes = _MACRO_DATA_CHANGES.replace(
        '\'{"phi2": 0.7, "Plot no.": "A1"}\'',
        '\'{"vH+": -2.89e-06, "ECSt": null, "plain": 0.00000289, "n": 123456789012345678901234567890}\'',
    )

    row = _rows(MACRO_RESULTS.lines(spark.sql(changes)))[11]

    assert row["macro_output_text"] == (
        '{"ECSt":null,"n":123456789012345678901234567890,"plain":0.00000289,"vH+":-2.89E-6}'
    )


def test_an_upload_row_wraps_its_data(spark: SparkSession) -> None:
    row = _rows(UPLOADS.lines(spark.sql(_UPLOADED_DATA_CHANGES)))[21]

    assert row["uploaded_data"] == {"_items": [{"ph": 6.5}]}
    assert row["uploaded_data_text"] == '[{"ph":6.5}]'
    assert "upload_table_id" not in row
    assert row["uploaded_at"] == "2026-10-19 09:00:00.000000"


_PLOTS = (
    '{"identifierColumnId": "plot", "experimentQuestionId": "q_plot", "rows": ['
    '{"_id": "r1", "plot": "A1", "soil": "clay", "area": 1.5}, {"_id": "r2", "plot": "A1", "soil": "sand"}, '
    '{"_id": "r3", "plot": 7, "soil": "loam"}, {"_id": "r4", "soil": "peat"}, "not a row"]}'
)
_PLOTS_EDITED = '{"identifierColumnId": "plot", "experimentQuestionId": "q_plot", "rows": [{"_id": "r1", "plot": "A1", "soil": "loam"}]}'
_DEVICES = '{"identifierColumnId": "serial", "experimentQuestionId": "column:device_id", "rows": [{"_id": "r1", "serial": "d1", "soil": "sand"}]}'

_SHEET_CHANGES = f"""
    SELECT experiment_id, metadata_id, parse_json(doc) AS metadata, 'u1' AS created_by,
      TIMESTAMP'2026-09-01 08:00:00' AS created_at, TIMESTAMP'2026-09-01 08:00:00' AS updated_at,
      _change_type, _commit_version, TIMESTAMP'2026-09-02 10:00:00' AS _commit_timestamp
    FROM VALUES
      ('e1', 's1', '{_PLOTS}', 'insert', 1L),
      ('e1', 's1', '{_PLOTS}', 'update_preimage', 2L),
      ('e1', 's1', '{_PLOTS_EDITED}', 'update_postimage', 2L),
      ('e1', 's2', '{_DEVICES}', 'delete', 3L),
      ('e1', 's3', '{{"name": "Plots"}}', 'insert', 4L)
    AS t(experiment_id, metadata_id, doc, _change_type, _commit_version)
"""


def test_a_sheets_rows_go_one_per_identifier_and_the_ones_an_edit_or_deletion_removed_go_as_deleted(
    spark: SparkSession,
) -> None:
    lines = [json.loads(row.line) for row in METADATA_ROWS.lines(spark.sql(_SHEET_CHANGES)).collect()]

    sent = {
        (line["sheet_id"], line["identifier"], line["_commit_version"]): (line["is_deleted"], line["fields"])
        for line in lines
    }
    assert sent == {
        ("s1", "A1", 1): (0, '{"area":1.5,"soil":"clay"}'),
        ("s1", "7", 1): (0, '{"soil":"loam"}'),
        ("s1", "A1", 2): (0, '{"soil":"loam"}'),
        ("s1", "7", 2): (1, '{"soil":"loam"}'),
        ("s2", "d1", 3): (1, '{"soil":"sand"}'),
    }
    assert {line["match_on"] for line in lines} == {"q_plot", "column:device_id"}
    assert lines[0]["sheet_created_at"] == "2026-09-01 08:00:00.000000"


_TYPED_PLOTS = (
    '{"identifierColumnId": "plot", "experimentQuestionId": "q_plot", "rows": ['
    '{"_id": "r1", "plot": "A1", "soil": "clay", "area": 1.5}, {"_id": "r2", "plot": "A1", "area": 12.25}, '
    '{"_id": "r3", "plot": 7, "soil": null}]}'
)

_SHEET_SCHEMA_CHANGES = f"""
    SELECT experiment_id, metadata_id, parse_json(doc) AS metadata, 'u1' AS created_by,
      TIMESTAMP'2026-09-01 08:00:00' AS created_at, TIMESTAMP'2026-09-01 08:00:00' AS updated_at,
      _change_type, _commit_version, TIMESTAMP'2026-09-02 10:00:00' AS _commit_timestamp
    FROM VALUES
      ('e1', 's1', '{_TYPED_PLOTS}', 'insert', 1L),
      ('e1', 's1', '{_TYPED_PLOTS}', 'update_preimage', 2L),
      ('e1', 's1', '{_PLOTS_EDITED}', 'update_postimage', 2L),
      ('e1', 's2', '{_DEVICES}', 'delete', 3L),
      ('e1', 's3', '{{"name": "Plots"}}', 'insert', 4L)
    AS t(experiment_id, metadata_id, doc, _change_type, _commit_version)
"""


def test_each_sheet_goes_once_per_commit_with_the_schema_gold_types_its_rows_with(
    spark: SparkSession,
) -> None:
    lines = [
        json.loads(row.line) for row in METADATA_ROWS.schema_lines(spark.sql(_SHEET_SCHEMA_CHANGES)).collect()
    ]

    sent = {
        (line["sheet_id"], line["_commit_version"]): (
            line["is_deleted"],
            line["match_on"],
            line.get("schema"),
        )
        for line in lines
    }
    # Every row counts, an identifier's repeats and the identifier's own column left out; a sheet
    # without rows has no schema.
    assert sent == {
        ("s1", 1): (0, "q_plot", "OBJECT<area: DECIMAL(4,2), soil: STRING>"),
        ("s1", 2): (0, "q_plot", "OBJECT<soil: STRING>"),
        ("s2", 3): (1, "column:device_id", None),
        ("s3", 4): (0, "", None),
    }
    assert len(lines) == 4
    assert {line["sheet_created_at"] for line in lines} == {"2026-09-01 08:00:00.000000"}
    assert METADATA_ROWS.schema_table == "metadata_sheets"


def test_a_sheets_schema_leaves_out_a_row_that_is_no_object_and_keeps_the_rest(
    spark: SparkSession,
) -> None:
    mixed = (
        '{"identifierColumnId": "plot", "rows": ['
        '{"_id": "r1", "plot": "A1", "soil": "clay", "area": 1.5}, "legacy", 7, [1]]}'
    )
    no_rows = '{"identifierColumnId": "plot", "rows": "legacy"}'
    changes = spark.sql(f"""
        SELECT experiment_id, metadata_id, parse_json(doc) AS metadata, 'u1' AS created_by,
          TIMESTAMP'2026-09-01 08:00:00' AS created_at, TIMESTAMP'2026-09-01 08:00:00' AS updated_at,
          'insert' AS _change_type, _commit_version, TIMESTAMP'2026-09-02 10:00:00' AS _commit_timestamp
        FROM VALUES ('e1', 's1', '{mixed}', 1L), ('e1', 's2', '{no_rows}', 1L)
        AS t(experiment_id, metadata_id, doc, _commit_version)
    """)

    lines = [json.loads(row.line) for row in METADATA_ROWS.schema_lines(changes).collect()]

    assert {line["sheet_id"]: line.get("schema") for line in lines} == {
        "s1": "OBJECT<area: DECIMAL(2,1), soil: STRING>",
        "s2": None,
    }


def test_each_table_reads_its_source_in_the_pipeline_or_the_sheets_copy_by_name() -> None:
    assert MEASUREMENTS.source("open_jii_dev") == "LIVE.experiment_raw_data"
    assert DEVICE_EVENTS.source("open_jii_dev") == "LIVE.clean_device_lifecycle_events"
    assert METADATA_ROWS.source("open_jii_dev") == "open_jii_dev.centrum.experiment_custom_metadata"


def _schemas(table: StoreTable, changes: DataFrame) -> list[dict]:
    lines = [json.loads(row.line) for row in table.schema_lines(changes).collect()]
    return sorted(lines, key=lambda line: (line["identifier"], line["payload"]))


def test_a_measurement_tables_questions_schema_is_merged_from_the_rows_gold_holds(
    spark: SparkSession,
) -> None:
    assert _schemas(MEASUREMENTS, spark.sql(_RAW_DATA_CHANGES)) == [
        {
            "experiment_id": "e1",
            "table_type": "static",
            "identifier": "raw_data",
            "payload": "questions_data",
            "schema": "OBJECT<note: VOID, plot: STRING>",
            "_commit_version": 7,
        }
    ]


def test_each_macro_gets_its_own_schemas_and_a_payload_without_a_type_gets_none(spark: SparkSession) -> None:
    schemas = _schemas(MACRO_RESULTS, spark.sql(_MACRO_DATA_CHANGES))

    # The result without a macro belongs to no table, and no result carries answers.
    assert [(s["identifier"], s["payload"]) for s in schemas] == [
        ("m1", "macro_output"),
        ("m2", "macro_output"),
    ]
    assert {s["table_type"] for s in schemas} == {"macro"}
    # An object, an array and a number in one table merge to VARIANT, as gold's listing has it.
    assert schemas[0]["schema"] == "VARIANT"
    assert schemas[1]["schema"].startswith("OBJECT<n: ARRAY<")


def test_an_upload_tables_schema_is_keyed_by_its_table(spark: SparkSession) -> None:
    changes = spark.sql(
        _UPLOADED_DATA_CHANGES.replace("CAST(NULL AS STRING) AS upload_table_id", "'t1' AS upload_table_id")
    )

    assert _schemas(UPLOADS, changes) == [
        {
            "experiment_id": "e1",
            "table_type": "upload",
            "identifier": "t1",
            "payload": "uploaded_data",
            "schema": "ARRAY<OBJECT<ph: DOUBLE>>",
            "_commit_version": 3,
        }
    ]
    assert _schemas(UPLOADS, spark.sql(_UPLOADED_DATA_CHANGES)) == []


@pytest.mark.parametrize(
    ("table", "changes", "column"),
    [
        (MEASUREMENTS, _RAW_DATA_CHANGES, "timestamp"),
        (MACRO_RESULTS, _MACRO_DATA_CHANGES, "timestamp"),
        (UPLOADS, _UPLOADED_DATA_CHANGES, "uploaded_at"),
    ],
)
def test_each_line_carries_the_time_its_store_table_is_partitioned_by(
    spark: SparkSession, table: StoreTable, changes: str, column: str
) -> None:
    gold = spark.sql(changes).where("_change_type IN ('insert', 'update_postimage')")

    sent = {json.loads(row.line)["id"]: row.partition_time for row in table.lines(gold).collect()}

    assert sent == {row.id: row[column] for row in gold.collect()}


def _events(lines: DataFrame) -> list[dict]:
    rows = [json.loads(row.line) for row in lines.collect()]
    return sorted(rows, key=lambda row: (row["client_id"], row["event_timestamp"]))


def test_a_lifecycle_event_carries_silvers_columns_without_its_ingestion_time(spark: SparkSession) -> None:
    [connected, disconnected, early] = _events(DEVICE_EVENTS.lines(spark.sql(_LIFECYCLE_EVENT_CHANGES)))

    assert connected == {
        "client_id": "c1",
        "event_type": "connected",
        "event_timestamp": "2026-10-19 09:00:00.123000",
        "session_identifier": "s1",
        "_commit_version": 12,
        "_commit_timestamp": "2026-10-19 09:05:01.000000",
    }
    assert disconnected["disconnect_reason"] == "CLIENT_INITIATED_DISCONNECT"
    assert early["event_timestamp"] == "1900-01-01 00:00:00.000000"
    assert "session_identifier" not in early


def test_a_lifecycle_event_is_partitioned_by_its_own_time(spark: SparkSession) -> None:
    silver = spark.sql(_LIFECYCLE_EVENT_CHANGES).where("_change_type = 'insert'")

    sent = sorted(row.partition_time for row in DEVICE_EVENTS.lines(silver).collect())

    assert sent == sorted(row.event_timestamp for row in silver.collect())


_FEED_FIXTURE = Path(__file__).parents[1] / "fixtures" / "serving_store_feed.json"

# One experiment's measurements and custom metadata as gold holds them, whose lines the backend's
# test store is seeded with, so its data page reads the rows the feed writes.
_FEED_RAW_DATA = """
    SELECT
      'e1' AS experiment_id, id, 'd1' AS device_id, 'c1' AS client_id, 'MultispeQ' AS device_name,
      'multispeq' AS device_family, '2' AS device_version, '2.345' AS device_firmware,
      87.5D AS device_battery, 'AA:BB:CC:DD:EE:FF' AS device_address, 'Pixel 8' AS client_model,
      'Google' AS client_manufacturer, 'android' AS client_os, '15' AS client_os_version,
      '1.42.0' AS client_app_version, ts AS timestamp, 'Europe/Amsterdam' AS timezone,
      array(named_struct('id', 'm1', 'name', 'Phi2', 'filename', 'phi2.js')) AS macros,
      parse_json(questions) AS questions_data,
      filter(array(named_struct(
        'id', 'a1', 'rowId', CAST(id AS STRING), 'type', 'comment',
        'content', named_struct('text', 'leaf torn', 'flagType', CAST(NULL AS STRING)),
        'createdBy', user_id, 'createdByName', 'Ada',
        'createdAt', TIMESTAMP'2026-10-19 10:05:00', 'updatedAt', CAST(NULL AS TIMESTAMP)
      )), annotation -> id = 1) AS annotations,
      user_id, 'p1' AS protocol_id, CAST(NULL AS STRING) AS workbook_run_id,
      CAST(NULL AS STRING) AS workbook_version_id, CAST(NULL AS STRING) AS macro_context,
      52.1D AS latitude, 5.1D AS longitude, parse_json('{"par": 120}') AS data,
      parse_json('{"phi2": 0.7}') AS output_data, CAST(ts AS DATE) AS date,
      ts + INTERVAL 3 SECONDS AS processed_timestamp, CAST(NULL AS TIMESTAMP) AS arrival_timestamp,
      CAST(NULL AS BOOLEAN) AS skip_macro_processing,
      'insert' AS _change_type, 1L AS _commit_version, TIMESTAMP'2026-10-19 13:00:00' AS _commit_timestamp
    FROM VALUES
      (1L, TIMESTAMP'2026-10-19 10:00:00', 'u1', '{"plot": "A1", "height": "12"}'),
      (2L, TIMESTAMP'2026-10-19 11:00:00', 'u2', '{"plot": "B2", "height": "9"}'),
      (3L, TIMESTAMP'2026-10-19 12:00:00', 'u1', '{"plot": "A1", "height": "15"}')
    AS t(id, ts, user_id, questions)
"""

_FEED_SHEETS = """
    SELECT 'e1' AS experiment_id, 's1' AS metadata_id, parse_json(
        '{"identifierColumnId": "plot", "experimentQuestionId": "plot", "rows": ['
        '{"_id": "r1", "plot": "A1", "soil": "clay"}, {"_id": "r2", "plot": "B2", "soil": "sand"}]}'
      ) AS metadata, 'u1' AS created_by, TIMESTAMP'2026-10-18 08:00:00' AS created_at,
      TIMESTAMP'2026-10-18 08:00:00' AS updated_at, 'insert' AS _change_type, 1L AS _commit_version,
      TIMESTAMP'2026-10-18 08:00:01' AS _commit_timestamp
"""


def _sent(lines: DataFrame, *keys: str) -> list[dict]:
    """The bodies the writer sends for ``lines``, in a fixed order."""
    sent = [json.loads(exact_doubles(storable(row.line))) for row in lines.collect()]
    return sorted(sent, key=lambda line: [str(line[key]) for key in keys])


def test_the_feed_sends_the_lines_the_backends_test_store_is_seeded_with(spark: SparkSession) -> None:
    rows, sheets = spark.sql(_FEED_RAW_DATA), spark.sql(_FEED_SHEETS)

    sent = {
        "measurements": _sent(MEASUREMENTS.lines(rows), "id"),
        "payload_schemas": _sent(MEASUREMENTS.schema_lines(rows), "identifier", "payload"),
        "metadata_sheets": _sent(METADATA_ROWS.schema_lines(sheets), "sheet_id"),
        "metadata_rows": _sent(METADATA_ROWS.lines(sheets), "sheet_id", "identifier"),
    }

    assert sent == json.loads(_FEED_FIXTURE.read_text())


class _Store:
    """The test's view of a real store, as its admin."""

    def __init__(self, url: str, user: str, password: str):
        self.url = url
        self.headers = {"X-ClickHouse-User": user, "X-ClickHouse-Key": password}

    def run(self, sql: str, database: str | None = None) -> str:
        params = {"database": database} if database else {}
        response = requests.post(self.url, params=params, data=sql.encode(), headers=self.headers, timeout=60)
        assert response.ok, response.text
        return response.text

    def rows(self, sql: str) -> list[dict]:
        text = self.run(f"{sql} SETTINGS json_type_escape_dots_in_keys = 1 FORMAT JSONEachRow")
        return [json.loads(line) for line in text.splitlines()]


@pytest.fixture(scope="module")
def store(store_admin: tuple[str, str, str], store_migrations: list[str], store_module) -> Iterator[_Store]:
    store = _Store(*store_admin)
    store.run(f"DROP DATABASE IF EXISTS {_DATABASE} SYNC")
    store.run(f"DROP USER IF EXISTS {_WRITER}")
    store.run(f"CREATE DATABASE {_DATABASE}")
    for statement in store_migrations:
        store.run(statement, database=_DATABASE)
    # The store's default profile sets these for every user; a test server has its own profile.
    store.run(
        f"CREATE USER {_WRITER} IDENTIFIED BY 'feed-test' SETTINGS json_type_escape_dots_in_keys = 1, "
        "input_format_try_infer_dates = 0, input_format_try_infer_datetimes = 0"
    )
    for grant in store_module.grants("writer"):
        store.run(f"{grant.replace(' ON store.', f' ON {_DATABASE}.')} TO {_WRITER}")

    yield store

    store.run(f"DROP USER {_WRITER}")
    store.run(f"DROP DATABASE {_DATABASE} SYNC")


@pytest.fixture
def writer(store: _Store) -> StoreWriter:
    return StoreWriter(store.url, _WRITER, "feed-test", database=_DATABASE)


def _stored_as_sent(
    store: _Store, table: str, lines: DataFrame, columns: str
) -> tuple[list[dict], list[dict]]:
    """The rows the store holds for ``columns`` next to the same columns as the lines sent them."""
    names = [name.strip() for name in columns.split(",")]
    sent = [{name: row.get(name) for name in names} for _, row in sorted(_rows(lines).items())]
    stored = store.rows(f"SELECT {columns} FROM {_DATABASE}.{table} FINAL ORDER BY id")
    return stored, sent


@pytest.mark.clickhouse
def test_measurements_land_from_executors_as_sent(
    spark: SparkSession, store: _Store, writer: StoreWriter
) -> None:
    lines = MEASUREMENTS.lines(spark.sql(_RAW_DATA_CHANGES))

    assert writer.write(lines, MEASUREMENTS.name) == Written(inserted=3)

    stored, sent = _stored_as_sent(
        store,
        "measurements",
        lines,
        "id, timestamp, questions_data",
    )
    assert stored == sent
    assert [row["timestamp"] for row in stored][1:] == [
        "2299-12-31 23:59:59.999999",
        "1900-01-01 00:00:00.000000",
    ]
    [annotation] = store.rows(f"SELECT annotations[1] AS a FROM {_DATABASE}.measurements FINAL WHERE id = 1")
    assert annotation["a"]["content"] == {"text": "leaf torn", "flagType": None}


@pytest.mark.clickhouse
def test_macro_output_lands_with_dotted_keys_whole_and_wide_integers_as_floats(
    spark: SparkSession, store: _Store, writer: StoreWriter
) -> None:
    lines = MACRO_RESULTS.lines(spark.sql(_MACRO_DATA_CHANGES))

    assert writer.write(lines, MACRO_RESULTS.name) == Written(inserted=6)

    outputs = {
        row["id"]: row["macro_output"]
        for row in store.rows(f"SELECT id, macro_output FROM {_DATABASE}.macro_results FINAL")
    }
    assert outputs[11] == {"phi2": 0.7, "Plot no.": "A1"}
    assert outputs[12] == {"_items": [0.7, 0.71]}
    assert outputs[14] is None
    assert outputs[15] is None
    assert outputs[16] == {"w": 18446744073709552000, "n": [1, -100000000000000000000]}

    # The text keeps every number as gold holds it, the integers too wide for the JSON column too.
    texts = {
        row["id"]: row["macro_output_text"]
        for row in store.rows(f"SELECT id, macro_output_text FROM {_DATABASE}.macro_results FINAL")
    }
    assert texts == {row_id: row.get("macro_output_text") for row_id, row in _rows(lines).items()}
    assert texts[16] == '{"n":[1,-99999999999999999999],"w":18446744073709551616}'


@pytest.mark.clickhouse
def test_a_replayed_batch_lands_once_and_a_row_the_store_cannot_read_is_set_aside(
    spark: SparkSession, store: _Store, writer: StoreWriter
) -> None:
    lines = [row.line for row in UPLOADS.lines(spark.sql(_UPLOADED_DATA_CHANGES)).collect()]
    # The store bends an unreadable timestamp to 1900 without a word, so the bad value is the id.
    unreadable = json.dumps({**json.loads(lines[0]), "id": "not a number"})

    first = writer.insert(UPLOADS.name, [*lines, unreadable])
    replay = writer.insert(UPLOADS.name, [*lines, unreadable])

    assert first == replay == Written(inserted=1, rejected=1)
    assert store.rows(f"SELECT id FROM {_DATABASE}.uploads") == [{"id": 21}]
    assert store.rows(
        f"SELECT source_table, commit_version, code, row FROM {_DATABASE}.feed_rejects"
        " WHERE source_table = 'uploads'"
    ) == [{"source_table": "uploads", "commit_version": 3, "code": 27, "row": unreadable}]


@pytest.mark.clickhouse
def test_a_field_the_table_lacks_holds_the_rows_back_for_a_migration(
    spark: SparkSession, store: _Store, writer: StoreWriter
) -> None:
    [line, *_] = [row.line for row in MEASUREMENTS.lines(spark.sql(_RAW_DATA_CHANGES)).collect()]
    renamed = json.dumps({**json.loads(line), "id": 99, "client_os_release": "15"})

    assert writer.insert(MEASUREMENTS.name, [line, renamed]) == Written(unfinished=2)
    assert store.rows(f"SELECT id FROM {_DATABASE}.measurements WHERE id = 99") == []
    assert store.rows(f"SELECT code FROM {_DATABASE}.feed_rejects WHERE source_table = 'measurements'") == []


@pytest.mark.clickhouse
def test_text_that_reads_as_a_date_lands_as_text(
    spark: SparkSession, store: _Store, writer: StoreWriter
) -> None:
    changes = _UPLOADED_DATA_CHANGES.replace(
        """parse_json('[{"ph": 6.5}]')""",
        """parse_json('{"day": "2026-05-01", "at": "2026-05-01T12:30:00.123"}')""",
    )

    assert writer.write(UPLOADS.lines(spark.sql(changes)), UPLOADS.name) == Written(inserted=1)

    [row] = store.rows(
        f"SELECT dynamicType(uploaded_data.day) AS day_type, toString(uploaded_data.at) AS at "
        f"FROM {_DATABASE}.uploads FINAL WHERE id = 21"
    )
    assert row == {"day_type": "String", "at": "2026-05-01T12:30:00.123"}


@pytest.mark.clickhouse
def test_coordinates_land_as_the_very_doubles_gold_holds(
    spark: SparkSession, store: _Store, writer: StoreWriter
) -> None:
    # Both values the store read onto the neighbouring double on dev, as 51.986383000000004.
    changes = _RAW_DATA_CHANGES.replace("'e1' AS experiment_id", "'exact' AS experiment_id").replace(
        "52.1D AS latitude, 5.1D AS longitude", "51.986383D AS latitude, 5.6631109D AS longitude"
    )

    assert writer.write(MEASUREMENTS.lines(spark.sql(changes)), MEASUREMENTS.name) == Written(inserted=3)

    rows = store.rows(
        f"SELECT latitude, longitude, device_battery FROM {_DATABASE}.measurements FINAL "
        "WHERE experiment_id = 'exact'"
    )
    assert rows == [{"latitude": 51.986383, "longitude": 5.6631109, "device_battery": 87.5}] * 3


@pytest.mark.clickhouse
def test_measurements_the_writer_sends_reach_the_copy_ordered_by_device(
    spark: SparkSession, store: _Store, writer: StoreWriter
) -> None:
    changes = _RAW_DATA_CHANGES.replace("'e1' AS experiment_id", "'by_device' AS experiment_id")

    assert writer.write(MEASUREMENTS.lines(spark.sql(changes)), MEASUREMENTS.name) == Written(inserted=3)

    rows = store.rows(
        f"SELECT client_id, id, device_id FROM {_DATABASE}.measurements_by_device FINAL "
        "WHERE experiment_id = 'by_device' ORDER BY id"
    )
    assert [(row["client_id"], row["id"], row["device_id"]) for row in rows] == [
        ("c1", 1, "d1"),
        ("c1", 2, "d1"),
        ("c1", 3, "d1"),
    ]


def _measurement_lines(spark: SparkSession, experiment: str) -> list[str]:
    changes = _RAW_DATA_CHANGES.replace("'e1' AS experiment_id", f"'{experiment}' AS experiment_id")
    return [row.line for row in MEASUREMENTS.lines(spark.sql(changes)).collect()]


def _held(store: _Store, table: str, experiment: str) -> list[int]:
    rows = store.rows(
        f"SELECT DISTINCT id FROM {_DATABASE}.{table} WHERE experiment_id = '{experiment}' ORDER BY id"
    )
    return [row["id"] for row in rows]


@pytest.mark.clickhouse
def test_a_chunk_sent_again_after_a_reloads_delete_stays_out_of_the_device_copy(
    spark: SparkSession, store: _Store, writer: StoreWriter
) -> None:
    lines = _measurement_lines(spark, "resent")
    writer.insert(MEASUREMENTS.name, lines)
    for table in (MEASUREMENTS.name, *MEASUREMENTS.derived_tables):
        store.run(f"DELETE FROM {_DATABASE}.{table} WHERE _commit_version < 8 AND experiment_id = 'resent'")

    assert writer.insert(MEASUREMENTS.name, lines) == Written(inserted=3)

    assert _held(store, "measurements", "resent") == []
    assert _held(store, "measurements_by_device", "resent") == []


@pytest.mark.clickhouse
def test_a_chunk_the_device_copy_refused_reaches_it_when_sent_again(
    spark: SparkSession, store: _Store, writer: StoreWriter, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(writer_module, "EXECUTOR_RETRY_DELAYS", ())
    lines = _measurement_lines(spark, "retried")
    store.run(
        f"ALTER TABLE {_DATABASE}.measurements_by_device ADD CONSTRAINT refused CHECK experiment_id != 'retried'"
    )
    try:
        assert writer.insert(MEASUREMENTS.name, lines) == Written(unfinished=3)
    finally:
        store.run(f"ALTER TABLE {_DATABASE}.measurements_by_device DROP CONSTRAINT refused")

    assert writer.insert(MEASUREMENTS.name, lines) == Written(inserted=3)

    assert _held(store, "measurements", "retried") == [1, 2, 3]
    assert _held(store, "measurements_by_device", "retried") == [1, 2, 3]


@pytest.mark.clickhouse
def test_lifecycle_events_land_as_sent(spark: SparkSession, store: _Store, writer: StoreWriter) -> None:
    lines = DEVICE_EVENTS.lines(spark.sql(_LIFECYCLE_EVENT_CHANGES))
    columns = ("client_id", "event_type", "event_timestamp", "session_identifier", "disconnect_reason")

    assert writer.write(lines, DEVICE_EVENTS.name) == Written(inserted=3)

    stored = store.rows(
        f"SELECT {', '.join(columns)} FROM {_DATABASE}.device_events FINAL ORDER BY client_id, event_timestamp"
    )
    assert stored == [{column: row.get(column) for column in columns} for row in _events(lines)]


@pytest.mark.clickhouse
def test_sensor_readings_land_as_the_very_doubles_gold_holds(
    spark: SparkSession, store: _Store, writer: StoreWriter
) -> None:
    changes = _RAW_DATA_CHANGES.replace("'e1' AS experiment_id", "'readings' AS experiment_id").replace(
        """parse_json('[{"set": [{"temperature": 19.5}, {"temperature": 20}]}, {"data": {"par": 120}}]')""",
        """parse_json('[{"set": [{"par": 51.986383}, {"par": 5.6631109}, {"par": 1e-7}]}]')""",
    )

    assert writer.write(MEASUREMENTS.lines(spark.sql(changes)), MEASUREMENTS.name) == Written(inserted=3)

    rows = store.rows(
        f"SELECT par_readings, temperature_readings FROM {_DATABASE}.measurements FINAL "
        "WHERE experiment_id = 'readings'"
    )
    assert rows == [{"par_readings": [51.986383, 5.6631109, 1e-7], "temperature_readings": []}] * 3


@pytest.mark.clickhouse
def test_a_measurement_keeps_its_payloads_size_out_of_its_columns(
    spark: SparkSession, store: _Store, writer: StoreWriter
) -> None:
    changes = _RAW_DATA_CHANGES.replace("'e1' AS experiment_id", "'sizes' AS experiment_id")

    assert writer.write(MEASUREMENTS.lines(spark.sql(changes)), MEASUREMENTS.name) == Written(inserted=3)

    [row] = store.rows(
        f"SELECT DISTINCT data_bytes, length(data) AS length FROM {_DATABASE}.measurements FINAL "
        "WHERE experiment_id = 'sizes'"
    )
    [stored] = store.rows(
        f"SELECT * FROM {_DATABASE}.measurements FINAL WHERE experiment_id = 'sizes' LIMIT 1"
    )
    assert row["data_bytes"] == row["length"] > 0
    assert "data_bytes" not in stored
