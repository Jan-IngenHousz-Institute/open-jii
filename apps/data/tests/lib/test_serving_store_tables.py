"""What the feed sends for each gold table: the rows gold holds now, in the shapes the store reads.

The tests marked ``clickhouse`` also send them through the writer into the migrations' tables on a
real store of the version the store runs, and skip without one:

    docker run -d --name feed-test-clickhouse -p 127.0.0.1:18123:8123 \\
      -e CLICKHOUSE_USER=admin -e CLICKHOUSE_PASSWORD=local -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \\
      clickhouse/clickhouse-server:25.8.33.6
    CLICKHOUSE_TEST_URL=http://127.0.0.1:18123/ CLICKHOUSE_TEST_USER=admin CLICKHOUSE_TEST_PASSWORD=local \\
      uv run pytest -m clickhouse
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path

import pytest
import requests
from openjii.serving_store.tables import MACRO_RESULTS, MEASUREMENTS, UPLOADS
from openjii.serving_store.writer import StoreWriter, Written
from pyspark.sql import DataFrame, SparkSession

pytestmark = pytest.mark.spark

_MIGRATIONS = Path(__file__).parents[4] / "packages/database/clickhouse/migrations"
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


@pytest.fixture(autouse=True)
def utc(spark: SparkSession) -> Iterator[None]:
    """Databricks sessions run in UTC, which the local time and the fixtures' timestamps assume."""
    spark.conf.set("spark.sql.session.timeZone", "UTC")
    yield
    spark.conf.unset("spark.sql.session.timeZone")


def _rows(lines: DataFrame) -> dict[int, dict]:
    rows = [json.loads(row.line) for row in lines.collect()]
    return {row["id"]: row for row in rows}


def test_a_measurement_carries_its_columns_readings_and_local_time(spark: SparkSession) -> None:
    row = _rows(MEASUREMENTS.lines(spark.sql(_RAW_DATA_CHANGES)))[1]

    assert row["timestamp"] == "2026-10-19 10:00:00.123456"
    assert row["measurement_time_local"] == "2026-10-19 12:00:00"
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
    assert row["sensor_temperature"] == [19.5, 20.0]
    assert row["sensor_par"] == [120.0]
    assert row["sensor_humidity"] == []
    assert row["_commit_version"] == 7
    assert row["_commit_timestamp"] == "2026-10-19 10:00:04.000000"
    assert "date" not in row


def test_only_rows_gold_holds_now_are_sent(spark: SparkSession) -> None:
    assert set(_rows(MEASUREMENTS.lines(spark.sql(_RAW_DATA_CHANGES)))) == {1, 2, 3}


def test_timestamps_outside_the_stores_range_are_clamped_whole(spark: SparkSession) -> None:
    rows = _rows(MEASUREMENTS.lines(spark.sql(_RAW_DATA_CHANGES)))

    assert rows[2]["timestamp"] == "2299-12-31 23:59:59.999999"
    assert rows[3]["timestamp"] == "1900-01-01 00:00:00.000000"


def test_macro_output_is_an_object_or_missing_and_null_keys_become_empty(spark: SparkSession) -> None:
    rows = _rows(MACRO_RESULTS.lines(spark.sql(_MACRO_DATA_CHANGES)))

    assert rows[11]["macro_output"] == {"phi2": 0.7, "Plot no.": "A1"}
    assert rows[12]["macro_output"] == {"_items": [0.7, 0.71]}
    assert rows[13]["macro_output"] == {"_value": 0.7}
    assert "macro_output" not in rows[14]
    assert "macro_output" not in rows[15]
    assert (rows[15]["macro_id"], rows[15]["macro_filename"]) == ("", "")
    assert rows[11]["raw_id"] == 1
    assert rows[11]["measurement_time_local"] == "2026-10-19 10:00:00"


def test_an_upload_row_wraps_its_data_and_has_a_table_id(spark: SparkSession) -> None:
    row = _rows(UPLOADS.lines(spark.sql(_UPLOADED_DATA_CHANGES)))[21]

    assert row["uploaded_data"] == {"_items": [{"ph": 6.5}]}
    assert row["upload_table_id"] == ""
    assert row["uploaded_at"] == "2026-10-19 09:00:00.000000"


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
def store() -> Iterator[_Store]:
    url = os.environ.get("CLICKHOUSE_TEST_URL")
    if not url:
        pytest.skip("CLICKHOUSE_TEST_URL is not set")
    store = _Store(url, os.environ["CLICKHOUSE_TEST_USER"], os.environ["CLICKHOUSE_TEST_PASSWORD"])
    store.run(f"DROP DATABASE IF EXISTS {_DATABASE} SYNC")
    store.run(f"DROP USER IF EXISTS {_WRITER}")
    store.run(f"CREATE DATABASE {_DATABASE}")
    for migration in sorted(_MIGRATIONS.glob("*.sql")):
        store.run(migration.read_text(), database=_DATABASE)
    # The store's default profile sets this for every user; a test server has its own profile.
    store.run(f"CREATE USER {_WRITER} IDENTIFIED BY 'feed-test' SETTINGS json_type_escape_dots_in_keys = 1")
    store.run(f"GRANT SELECT, INSERT ON {_DATABASE}.* TO {_WRITER}")

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
        "id, timestamp, measurement_time_local, questions_data, sensor_temperature",
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
    assert store.rows(f"SELECT source_table, commit_version, code, row FROM {_DATABASE}.feed_rejects") == [
        {"source_table": "uploads", "commit_version": 3, "code": 27, "row": unreadable}
    ]
