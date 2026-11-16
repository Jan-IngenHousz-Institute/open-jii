"""Device pages' reads on the store's device views give what the same reads give on silver today.

Each read runs twice on the same rows: in Spark over silver's columns, as the warehouse runs it, and on
a real store over the device views. Silver holds no copy of a capture here: the store keeps one row per
capture where silver counts each copy. The store tests skip without a store, as described in
test_serving_store_tables.py.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Iterator, Sequence
from datetime import datetime
from pathlib import Path

import pytest
import requests
from openjii.serving_store.tables import JSON_OPTIONS
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import TimestampType

pytestmark = [pytest.mark.spark, pytest.mark.clickhouse]

_DATABASE = "device_reads_test"
_LAST_ACTIVITY_VIEW = Path(__file__).parents[2] / "src/views/device_last_activity.sql"

_WINDOW = ("2026-10-19 00:00:00", "2026-10-19 23:59:59")

# Silver's clean_data, the columns device pages read. c1 rolls its firmware back at 13:00, reports no
# battery at 12:10, and has a row after the window; c2 has two sensors; a row without a client
# belongs to no device.
_CLEAN_DATA = """
    SELECT client_id, experiment_id, id, device_id, CAST(ts AS TIMESTAMP) AS timestamp, device_version,
      device_firmware, device_battery, protocol_id, workbook_version_id, workbook_run_id, latitude, longitude,
      transform(macro_ids, m -> named_struct('id', m, 'name', m, 'filename', m)) AS macros, sample
    FROM VALUES
      ('c1', 'e1', 1L, 'd1', '2026-10-19 10:05:00.250', '2.1', 'fw1', 80.0D, 'p1', 'wv1', 'wr1', 52.1D, 5.1D,
        array('m1'), '{"par": 120, "trace": [1, 2.5, -0.000001]}'),
      ('c1', 'e1', 2L, 'd1', '2026-10-19 12:10:00', '2.1', 'fw1', NULL, 'p1', 'wv1', 'wr1', NULL, NULL,
        array('m1', 'm2'), '[{"set": [{"temperature": 19.5}]}, {"note": null}]'),
      ('c1', 'e2', 3L, 'd1', '2026-10-19 11:10:00', '2.2', 'fw2', 70.0D, 'p2', NULL, NULL, 52.2D, 5.2D,
        CAST(array() AS ARRAY<STRING>), '{"par": 130}'),
      ('c1', 'e2', 4L, 'd1', '2026-10-19 13:00:00', '2.1', 'fw1', 60.5D, 'p2', NULL, NULL, NULL, NULL,
        array('m2'), '{"par": 140}'),
      ('c1', 'e2', 5L, 'd1', '2026-10-19 13:30:00', '2.1', 'fw1', 61.0D, 'p2', NULL, 'wr2', 52.3D, 5.3D,
        array('m2'), '{"par": 150}'),
      ('c1', 'e1', 6L, 'd1', '2026-10-20 09:00:00', '2.2', 'fw2', 55.0D, 'p1', NULL, NULL, NULL, NULL,
        CAST(array() AS ARRAY<STRING>), '{"par": 160}'),
      ('c2', 'e1', 7L, 'd2', '2026-10-19 10:30:00', '1.0', 'fw9', 90.0D, 'p1', NULL, NULL, NULL, NULL,
        array('m1'), '{"par": 170}'),
      ('c2', 'e3', 8L, 'd3', '2026-10-19 10:30:00', '1.1', 'fw9', 88.0D, 'p3', NULL, NULL, NULL, NULL,
        CAST(array() AS ARRAY<STRING>), '{"par": 180}'),
      (NULL, 'e1', 9L, 'd9', '2026-10-19 10:45:00', '1.0', 'fw9', 50.0D, 'p1', NULL, NULL, NULL, NULL,
        CAST(array() AS ARRAY<STRING>), '{"par": 190}')
    AS t(client_id, experiment_id, id, device_id, ts, device_version, device_firmware, device_battery,
      protocol_id, workbook_version_id, workbook_run_id, latitude, longitude, macro_ids, sample)
"""

# Silver's clean_device_lifecycle_events. c1's newest event comes after the window.
_CLEAN_EVENTS = """
    SELECT client_id, event_type, CAST(ts AS TIMESTAMP) AS event_timestamp, session_identifier,
      disconnect_reason
    FROM VALUES
      ('c1', 'connected', '2026-10-19 09:59:00.125', 's1', NULL),
      ('c1', 'disconnected', '2026-10-19 12:00:00', 's1', 'CONNECTION_LOST'),
      ('c1', 'connected', '2026-10-19 12:01:00', 's2', NULL),
      ('c1', 'disconnected', '2026-10-21 08:00:00', 's2', 'CLIENT_INITIATED_DISCONNECT'),
      ('c3', 'connected', '2026-10-19 07:00:00', NULL, NULL)
    AS t(client_id, event_type, ts, session_identifier, disconnect_reason)
"""

# What the feed sends for each silver row: gold's columns, its payload parsed and written out as
# Spark writes it, and a commit.
_STORE_LINES = {
    "measurements": """
        SELECT to_json(struct(client_id, experiment_id, id, device_id, timestamp, device_version,
          device_firmware, device_battery, protocol_id, workbook_version_id, workbook_run_id, latitude,
          longitude, macros, to_json(try_parse_json(sample)) AS data, 3L AS _commit_version,
          TIMESTAMP'2026-10-21 09:00:00' AS _commit_timestamp), map({options})) AS line
        FROM clean_data
    """,
    "device_events": """
        SELECT to_json(struct(*, 4L AS _commit_version, TIMESTAMP'2026-10-21 09:00:00' AS _commit_timestamp),
          map({options})) AS line
        FROM clean_device_lifecycle_events
    """,
}

_SILVER_WINDOW = f"timestamp BETWEEN '{_WINDOW[0]}' AND '{_WINDOW[1]}'"
_STORE_WINDOW = f"timestamp BETWEEN '{_WINDOW[0]}' AND '{_WINDOW[1]}'"
_EVENT_WINDOW = f"event_timestamp BETWEEN '{_WINDOW[0]}' AND '{_WINDOW[1]}'"


def _store_view(view: str, *devices: str) -> str:
    named = ", ".join(f"'{device}'" for device in devices)
    return f"{_DATABASE}.{view}(devices = [{named}])"


# Each read as silver answers it today and as the store answers it.
_READS = {
    "hourly counts per experiment": (
        "SELECT date_trunc('HOUR', timestamp), experiment_id, count(*) FROM clean_data "
        f"WHERE client_id = 'c1' AND {_SILVER_WINDOW} GROUP BY 1, 2",
        "SELECT toStartOfHour(timestamp), experiment_id, count() FROM "
        f"{_store_view('device_measurements', 'c1')} WHERE {_STORE_WINDOW} GROUP BY 1, 2",
    ),
    "hourly battery": (
        "SELECT date_trunc('HOUR', timestamp), avg(device_battery) FROM clean_data "
        f"WHERE client_id = 'c1' AND {_SILVER_WINDOW} GROUP BY 1",
        "SELECT toStartOfHour(timestamp), avg(device_battery) FROM "
        f"{_store_view('device_measurements', 'c1')} WHERE {_STORE_WINDOW} GROUP BY 1",
    ),
    "firmware history": (
        "SELECT date_trunc('HOUR', timestamp), device_version, min(timestamp), max(timestamp), count(*) "
        f"FROM clean_data WHERE client_id = 'c1' AND {_SILVER_WINDOW} GROUP BY 1, 2",
        "SELECT toStartOfHour(timestamp), device_version, min(timestamp), max(timestamp), count() FROM "
        f"{_store_view('device_measurements', 'c1')} WHERE {_STORE_WINDOW} GROUP BY 1, 2",
    ),
    "firmware versions of a group": (
        "SELECT client_id, device_version, max(timestamp) FROM clean_data "
        f"WHERE client_id IN ('c1', 'c2') AND {_SILVER_WINDOW} GROUP BY 1, 2",
        "SELECT client_id, device_version, max(timestamp) FROM "
        f"{_store_view('device_measurements', 'c1', 'c2')} WHERE {_STORE_WINDOW} GROUP BY 1, 2",
    ),
    "hourly counts of a group per device": (
        "SELECT date_trunc('HOUR', timestamp), client_id, count(*) FROM clean_data "
        f"WHERE client_id IN ('c1', 'c2') AND {_SILVER_WINDOW} GROUP BY 1, 2",
        "SELECT toStartOfHour(timestamp), client_id, count() FROM "
        f"{_store_view('device_measurements', 'c1', 'c2')} WHERE {_STORE_WINDOW} GROUP BY 1, 2",
    ),
    "hourly counts of a group per experiment": (
        "SELECT date_trunc('HOUR', timestamp), experiment_id, count(*) FROM clean_data "
        f"WHERE client_id IN ('c1', 'c2') AND {_SILVER_WINDOW} GROUP BY 1, 2",
        "SELECT toStartOfHour(timestamp), experiment_id, count() FROM "
        f"{_store_view('device_measurements', 'c1', 'c2')} WHERE {_STORE_WINDOW} GROUP BY 1, 2",
    ),
    "payload breakdown": (
        "SELECT device_version, protocol_id, workbook_version_id, workbook_run_id, count(*), count(latitude), "
        f"count(device_battery) FROM clean_data WHERE client_id = 'c1' AND {_SILVER_WINDOW} GROUP BY 1, 2, 3, 4",
        "SELECT device_version, protocol_id, workbook_version_id, workbook_run_id, count(), count(latitude), "
        f"count(device_battery) FROM {_store_view('device_measurements', 'c1')} WHERE {_STORE_WINDOW} "
        "GROUP BY 1, 2, 3, 4",
    ),
    "macro breakdown": (
        "SELECT macro.id, count(*) FROM (SELECT explode(macros) AS macro FROM clean_data "
        f"WHERE client_id = 'c1' AND {_SILVER_WINDOW}) GROUP BY 1",
        "SELECT tupleElement(macro, 'id'), count() FROM (SELECT arrayJoin(macros) AS macro FROM "
        f"{_store_view('device_measurements', 'c1')} WHERE {_STORE_WINDOW}) GROUP BY 1",
    ),
    "lifecycle events": (
        "SELECT event_type, event_timestamp, disconnect_reason, session_identifier "
        f"FROM clean_device_lifecycle_events WHERE client_id = 'c1' AND {_EVENT_WINDOW}",
        "SELECT event_type, event_timestamp, disconnect_reason, session_identifier FROM "
        f"{_store_view('device_lifecycle_events', 'c1')} WHERE {_EVENT_WINDOW}",
    ),
    "lifecycle events of a group": (
        "SELECT client_id, event_type, event_timestamp, disconnect_reason FROM clean_device_lifecycle_events "
        f"WHERE client_id IN ('c1', 'c3') AND {_EVENT_WINDOW}",
        "SELECT client_id, event_type, event_timestamp, disconnect_reason FROM "
        f"{_store_view('device_lifecycle_events', 'c1', 'c3')} WHERE {_EVENT_WINDOW}",
    ),
    "newest rows with their payload": (
        "SELECT timestamp, experiment_id, protocol_id, workbook_version_id, device_version, device_battery, "
        f"latitude, longitude, sample FROM clean_data WHERE client_id = 'c1' AND {_SILVER_WINDOW} "
        "ORDER BY timestamp DESC LIMIT 3",
        "SELECT timestamp, experiment_id, protocol_id, workbook_version_id, device_version, device_battery, "
        f"latitude, longitude, data FROM {_DATABASE}.device_newest_measurements(device = 'c1', "
        f"from = '{_WINDOW[0]}', to = '{_WINDOW[1]}', rows = 3)",
    ),
}

_TIME = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$")


def _value(value: object) -> object:
    """A value as both engines' answers compare: times as times, numbers as numbers, and a payload's
    JSON as what it holds, since the store keeps it as Spark writes gold's parsed copy out."""
    if isinstance(value, str) and _TIME.match(value):
        return datetime.fromisoformat(value)
    if isinstance(value, str) and value[:1] in ("{", "["):
        return json.loads(value)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return round(float(value), 9)
    return value


def _answer(rows: Sequence[Sequence[object]]) -> list[list]:
    return sorted(([_value(value) for value in row] for row in rows), key=repr)


def _silver_rows(frame: DataFrame) -> list[tuple]:
    """The frame's rows with its times written out in UTC, where collect would give local times."""
    frame = frame.toDF(*[f"c{position}" for position in range(len(frame.columns))])
    columns = [
        F.date_format(field.name, "yyyy-MM-dd HH:mm:ss.SSSSSS")
        if isinstance(field.dataType, TimestampType)
        else F.col(field.name)
        for field in frame.schema.fields
    ]
    return [tuple(row) for row in frame.select(*columns).collect()]


class _Store:
    def __init__(self, url: str, user: str, password: str):
        self.url = url
        self.headers = {"X-ClickHouse-User": user, "X-ClickHouse-Key": password}

    def run(self, sql: str, database: str | None = None) -> str:
        params = {"database": database} if database else {}
        response = requests.post(self.url, params=params, data=sql.encode(), headers=self.headers, timeout=60)
        assert response.ok, response.text
        return response.text

    def rows(self, sql: str) -> list[list]:
        text = self.run(
            f"{sql} FORMAT JSONCompactEachRow SETTINGS output_format_json_quote_64bit_integers = 0"
        )
        return [json.loads(line) for line in text.splitlines()]


@pytest.fixture(scope="module")
def silver(spark: SparkSession) -> Iterator[None]:
    spark.conf.set("spark.sql.session.timeZone", "UTC")
    spark.sql(_CLEAN_DATA).createOrReplaceTempView("clean_data")
    spark.sql(_CLEAN_EVENTS).createOrReplaceTempView("clean_device_lifecycle_events")
    yield
    spark.catalog.dropTempView("clean_data")
    spark.catalog.dropTempView("clean_device_lifecycle_events")
    spark.conf.unset("spark.sql.session.timeZone")


@pytest.fixture(scope="module")
def store(spark: SparkSession, silver: None, store_migrations: list[str]) -> Iterator[_Store]:
    url = os.environ.get("CLICKHOUSE_TEST_URL")
    if not url:
        pytest.skip("CLICKHOUSE_TEST_URL is not set")
    store = _Store(url, os.environ["CLICKHOUSE_TEST_USER"], os.environ["CLICKHOUSE_TEST_PASSWORD"])
    store.run(f"DROP DATABASE IF EXISTS {_DATABASE} SYNC")
    store.run(f"CREATE DATABASE {_DATABASE}")
    for statement in store_migrations:
        store.run(statement, database=_DATABASE)
    options = ", ".join(f"'{key}', '{value}'" for key, value in JSON_OPTIONS.items())
    for table, lines in _STORE_LINES.items():
        sent = [row.line for row in spark.sql(lines.format(options=options)).collect()]
        store.run(f"INSERT INTO {_DATABASE}.{table} FORMAT JSONEachRow\n" + "\n".join(sent))

    yield store

    store.run(f"DROP DATABASE {_DATABASE} SYNC")


@pytest.mark.parametrize("read", list(_READS))
def test_a_device_read_on_the_store_answers_as_silver_does(
    spark: SparkSession, store: _Store, read: str
) -> None:
    silver_sql, store_sql = _READS[read]

    silver_answer = _answer(_silver_rows(spark.sql(silver_sql)))
    store_answer = _answer(store.rows(store_sql))

    assert silver_answer
    assert store_answer == silver_answer


def test_last_activity_on_the_store_answers_as_silvers_view_does(spark: SparkSession, store: _Store) -> None:
    view = _LAST_ACTIVITY_VIEW.read_text().replace("${catalog}.centrum.", "")

    silver_answer = _answer(_silver_rows(spark.sql(view).where("client_id IN ('c1', 'c2', 'c3')")))
    store_answer = _answer(
        store.rows(f"SELECT * FROM {_store_view('device_last_activity', 'c1', 'c2', 'c3')}")
    )

    assert len(silver_answer) == 3
    assert store_answer == silver_answer
