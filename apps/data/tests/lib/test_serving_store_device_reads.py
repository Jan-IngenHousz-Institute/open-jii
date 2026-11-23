"""Device pages' reads on the store's device views give what the same reads give on silver today.

Silver's rows reach the store as they do in production: gold's experiment_raw_data() over them, the
feed's lines and the writer. Each read then runs on Spark over silver, as the warehouse runs it, and
on the test store ``pnpm test`` starts, over the device views. Where gold shows a row differently,
the difference is pinned as the store's expected answer.
"""

from __future__ import annotations

import importlib.util
import json
import re
import sys
import types
from collections.abc import Iterator, Sequence
from datetime import datetime
from pathlib import Path

import pytest
import requests
from openjii.serving_store.tables import DEVICE_EVENTS, MEASUREMENTS
from openjii.serving_store.writer import StoreWriter, Written
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import TimestampType

pytestmark = [pytest.mark.spark, pytest.mark.clickhouse]

_DATABASE = "device_reads_test"
_WRITER = "device_reads_test_writer"
_GOLD_NOTEBOOK = Path(__file__).parents[2] / "src/pipelines/centrum/gold/experiment_raw_data.py"
_LAST_ACTIVITY_VIEW = Path(__file__).parents[2] / "src/views/device_last_activity.sql"

_WINDOW = ("2026-10-19 00:00:00", "2026-10-19 23:59:59")

# Silver's clean_data. c1 rolls its firmware back at 13:00, reports no battery at 12:10, sends a
# sample with a repeated key and one with a bare NaN, and has a row after the window; c2 has two
# sensors; a row without a client belongs to no device, and c4's row has no experiment.
_CLEAN_DATA = """
    SELECT id, experiment_id, device_id, client_id, CAST(NULL AS STRING) AS device_name,
      CAST(NULL AS STRING) AS device_family, device_version, device_firmware, device_battery,
      CAST(NULL AS STRING) AS device_address, CAST(NULL AS STRING) AS client_model,
      CAST(NULL AS STRING) AS client_manufacturer, CAST(NULL AS STRING) AS client_os,
      CAST(NULL AS STRING) AS client_os_version, CAST(NULL AS STRING) AS client_app_version,
      CAST(ts AS TIMESTAMP) AS timestamp, CAST(NULL AS STRING) AS timezone,
      transform(macro_ids, m -> named_struct('id', m, 'name', m, 'filename', m)) AS macros,
      CAST(array() AS ARRAY<STRUCT<question_label: STRING, question_text: STRING, question_answer: STRING>>)
        AS questions,
      CAST(array() AS ARRAY<STRING>) AS annotations, CAST(NULL AS STRING) AS user_id, protocol_id,
      workbook_run_id, workbook_version_id, CAST(NULL AS STRING) AS macro_context, latitude, longitude,
      sample, CAST(NULL AS STRING) AS output, to_date(ts) AS date,
      TIMESTAMP'2026-10-21 08:00:00' AS processed_timestamp, CAST(NULL AS TIMESTAMP) AS arrival_timestamp,
      CAST(NULL AS BOOLEAN) AS skip_macro_processing
    FROM VALUES
      ('c1', 'e1', 1L, 'd1', '2026-10-19 10:05:00.250', '2.1', 'fw1', 80.0D, 'p1', 'wv1', 'wr1', 52.1D, 5.1D,
        array('m1'), '{"time": 1, "protocol_id": 7, "PAR": 120.50}'),
      ('c1', 'e1', 2L, 'd1', '2026-10-19 12:10:00', '2.1', 'fw1', NULL, 'p1', 'wv1', 'wr1', NULL, NULL,
        array('m1', 'm2'), '[{"set": [{"temperature": 19.5}]}, {"note": null}]'),
      ('c1', 'e2', 3L, 'd1', '2026-10-19 11:10:00', '2.2', 'fw2', 70.0D, 'p2', NULL, NULL, 52.2D, 5.2D,
        CAST(array() AS ARRAY<STRING>), '{"par": 130, "trace": [1, 2.5, -0.000001]}'),
      ('c1', 'e2', 4L, 'd1', '2026-10-19 13:00:00', '2.1', 'fw1', 60.5D, 'p2', NULL, NULL, NULL, NULL,
        array('m2'), '{"par": 140, "par": 141}'),
      ('c1', 'e2', 5L, 'd1', '2026-10-19 13:30:00', '2.1', 'fw1', 61.0D, 'p2', NULL, 'wr2', 52.3D, 5.3D,
        array('m2'), '{"phi2": NaN, "par": 150}'),
      ('c1', 'e1', 6L, 'd1', '2026-10-20 09:00:00', '2.2', 'fw2', 55.0D, 'p1', NULL, NULL, NULL, NULL,
        CAST(array() AS ARRAY<STRING>), '{"par": 160}'),
      ('c2', 'e1', 7L, 'd2', '2026-10-19 10:30:00', '1.0', 'fw9', 90.0D, 'p1', NULL, NULL, NULL, NULL,
        array('m1'), '{"par": 170}'),
      ('c2', 'e3', 8L, 'd3', '2026-10-19 10:30:00', '1.1', 'fw9', 88.0D, 'p3', NULL, NULL, NULL, NULL,
        CAST(array() AS ARRAY<STRING>), '{"par": 180}'),
      (NULL, 'e1', 9L, 'd9', '2026-10-19 10:45:00', '1.0', 'fw9', 50.0D, 'p1', NULL, NULL, NULL, NULL,
        CAST(array() AS ARRAY<STRING>), '{"par": 190}'),
      ('c4', NULL, 10L, 'd4', '2026-10-19 10:50:00', '1.0', 'fw9', 50.0D, 'p1', NULL, NULL, NULL, NULL,
        CAST(array() AS ARRAY<STRING>), '{"par": 200}')
    AS t(client_id, experiment_id, id, device_id, ts, device_version, device_firmware, device_battery,
      protocol_id, workbook_version_id, workbook_run_id, latitude, longitude, macro_ids, sample)
"""

# Silver's clean_device_lifecycle_events. c1's newest event comes after the window.
_CLEAN_EVENTS = """
    SELECT client_id, event_type, CAST(ts AS TIMESTAMP) AS event_timestamp, session_identifier,
      disconnect_reason, TIMESTAMP'2026-10-21 08:00:00' AS ingestion_timestamp
    FROM VALUES
      ('c1', 'connected', '2026-10-19 09:59:00.125', 's1', NULL),
      ('c1', 'disconnected', '2026-10-19 12:00:00', 's1', 'CONNECTION_LOST'),
      ('c1', 'connected', '2026-10-19 12:01:00', 's2', NULL),
      ('c1', 'disconnected', '2026-10-21 08:00:00', 's2', 'CLIENT_INITIATED_DISCONNECT'),
      ('c3', 'connected', '2026-10-19 07:00:00', NULL, NULL)
    AS t(client_id, event_type, ts, session_identifier, disconnect_reason)
"""

# Each c1 row in the window as a device page shows its payload from the store: gold's parsed copy as
# Spark writes it out, keys in alphabetical order, a repeated key's sample unreadable, NaN as null.
_STORE_PAYLOADS = {
    1: '{"PAR":120.5,"protocol_id":7,"time":1}',
    2: '[{"set":[{"temperature":19.5}]},{"note":null}]',
    3: '{"par":130,"trace":[1,2.5,-0.000001]}',
    4: None,
    5: '{"par":150,"phi2":null}',
}

_SILVER_WINDOW = f"timestamp BETWEEN '{_WINDOW[0]}' AND '{_WINDOW[1]}'"
_EVENT_WINDOW = f"event_timestamp BETWEEN '{_WINDOW[0]}' AND '{_WINDOW[1]}'"


def _store_view(view: str, *devices: str) -> str:
    named = ", ".join(f"'{device}'" for device in devices)
    return f"{_DATABASE}.{view}(devices = [{named}])"


def _device_rows(*devices: str, database: str = _DATABASE) -> str:
    named = ", ".join(f"'{device}'" for device in devices)
    return f"{database}.device_measurements(devices = [{named}], from = '{_WINDOW[0]}', to = '{_WINDOW[1]}')"


def _newest_rows(columns: str, rows: int, device: str = "c1", database: str = _DATABASE) -> str:
    return (
        f"SELECT {columns} FROM {database}.device_newest_measurements(device = '{device}', "
        f"experiments = ['e1', 'e2'], from = '{_WINDOW[0]}', to = '{_WINDOW[1]}', rows = {rows})"
    )


# Each read as silver answers it today and as the store answers it.
_READS = {
    "hourly counts per experiment": (
        "SELECT date_trunc('HOUR', timestamp), experiment_id, count(*) FROM clean_data "
        f"WHERE client_id = 'c1' AND {_SILVER_WINDOW} GROUP BY 1, 2",
        "SELECT toStartOfHour(timestamp), experiment_id, count() FROM "
        f"{_device_rows('c1')} WHERE {_SILVER_WINDOW} GROUP BY 1, 2",
    ),
    "hourly battery": (
        "SELECT date_trunc('HOUR', timestamp), avg(device_battery) FROM clean_data "
        f"WHERE client_id = 'c1' AND {_SILVER_WINDOW} GROUP BY 1",
        "SELECT toStartOfHour(timestamp), avg(device_battery) FROM "
        f"{_device_rows('c1')} WHERE {_SILVER_WINDOW} GROUP BY 1",
    ),
    "firmware history": (
        "SELECT date_trunc('HOUR', timestamp), device_version, min(timestamp), max(timestamp), count(*) "
        f"FROM clean_data WHERE client_id = 'c1' AND {_SILVER_WINDOW} GROUP BY 1, 2",
        "SELECT toStartOfHour(timestamp), device_version, min(timestamp), max(timestamp), count() FROM "
        f"{_device_rows('c1')} WHERE {_SILVER_WINDOW} GROUP BY 1, 2",
    ),
    "payload breakdown": (
        "SELECT device_version, protocol_id, workbook_version_id, workbook_run_id, count(*), count(latitude), "
        f"count(device_battery) FROM clean_data WHERE client_id = 'c1' AND {_SILVER_WINDOW} GROUP BY 1, 2, 3, 4",
        "SELECT device_version, protocol_id, workbook_version_id, workbook_run_id, count(), count(latitude), "
        f"count(device_battery) FROM {_device_rows('c1')} WHERE {_SILVER_WINDOW} "
        "GROUP BY 1, 2, 3, 4",
    ),
    "macro breakdown": (
        "SELECT macro.id, count(*) FROM (SELECT explode(macros) AS macro FROM clean_data "
        f"WHERE client_id = 'c1' AND {_SILVER_WINDOW}) GROUP BY 1",
        "SELECT tupleElement(macro, 'id'), count() FROM (SELECT arrayJoin(macros) AS macro FROM "
        f"{_device_rows('c1')} WHERE {_SILVER_WINDOW}) GROUP BY 1",
    ),
    "lifecycle events": (
        "SELECT event_type, event_timestamp, disconnect_reason, session_identifier "
        f"FROM clean_device_lifecycle_events WHERE client_id = 'c1' AND {_EVENT_WINDOW}",
        "SELECT event_type, event_timestamp, disconnect_reason, session_identifier FROM "
        f"{_store_view('device_lifecycle_events', 'c1')} WHERE {_EVENT_WINDOW}",
    ),
    "newest rows": (
        "SELECT timestamp, experiment_id, protocol_id, workbook_version_id, device_version, device_battery, "
        f"latitude, longitude FROM clean_data WHERE client_id = 'c1' AND {_SILVER_WINDOW} "
        "ORDER BY timestamp DESC LIMIT 3",
        _newest_rows(
            "timestamp, experiment_id, protocol_id, workbook_version_id, device_version, device_battery, "
            "latitude, longitude",
            3,
        ),
    ),
}

_TIME = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$")


def _value(value: object) -> object:
    """A value as both engines' answers compare: times as times and numbers as numbers."""
    if isinstance(value, str) and _TIME.match(value):
        return datetime.fromisoformat(value)
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


def _changes(frame: DataFrame, version: int) -> DataFrame:
    return frame.withColumns(
        {
            "_change_type": F.lit("insert"),
            "_commit_version": F.lit(version).cast("long"),
            "_commit_timestamp": F.lit("2026-10-21 09:00:00").cast("timestamp"),
        }
    )


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
def store(silver: None, store_admin: tuple[str, str, str], store_migrations: list[str]) -> Iterator[_Store]:
    store = _Store(*store_admin)
    store.run(f"DROP DATABASE IF EXISTS {_DATABASE} SYNC")
    store.run(f"DROP USER IF EXISTS {_WRITER}")
    store.run(f"CREATE DATABASE {_DATABASE}")
    for statement in store_migrations:
        store.run(statement, database=_DATABASE)
    # The store's default profile sets these for every user; a test server has its own profile.
    store.run(
        f"CREATE USER {_WRITER} IDENTIFIED BY 'device-reads' SETTINGS json_type_escape_dots_in_keys = 1, "
        "input_format_try_infer_dates = 0, input_format_try_infer_datetimes = 0"
    )
    store.run(f"GRANT SELECT, INSERT ON {_DATABASE}.* TO {_WRITER}")

    yield store

    store.run(f"DROP USER {_WRITER}")
    store.run(f"DROP DATABASE {_DATABASE} SYNC")


@pytest.fixture
def fed(
    spark: SparkSession, store: _Store, fake_dlt: types.ModuleType, monkeypatch: pytest.MonkeyPatch
) -> _Store:
    """The store once the feed has sent it gold's rows for silver's and silver's events, which the
    first test to ask does."""
    [[stored]] = store.rows(f"SELECT count() FROM {_DATABASE}.measurements")
    if stored:
        return store

    _feed(_DATABASE, _gold_rows(spark, fake_dlt, monkeypatch), spark, store)
    return store


def _gold_rows(spark: SparkSession, fake_dlt: types.ModuleType, monkeypatch: pytest.MonkeyPatch) -> DataFrame:
    """Gold's experiment_raw_data() over silver's clean_data."""
    runtime = types.ModuleType("openjii.centrum.runtime")
    runtime.SILVER_TABLE = "clean_data"  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.centrum.runtime", runtime)
    monkeypatch.setattr(fake_dlt, "read_stream", spark.table)
    spec = importlib.util.spec_from_file_location("gold_experiment_raw_data", _GOLD_NOTEBOOK)
    assert spec is not None and spec.loader is not None
    gold = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gold)
    return gold.experiment_raw_data()


def _feed(database: str, gold: DataFrame, spark: SparkSession, store: _Store) -> StoreWriter:
    """Sends ``database`` gold's rows and silver's events through the feed's lines and the writer."""
    writer = StoreWriter(store.url, _WRITER, "device-reads", database=database)
    measurements = MEASUREMENTS.lines(_changes(gold, 3))
    events = DEVICE_EVENTS.lines(_changes(spark.table("clean_device_lifecycle_events"), 4))
    assert writer.write(measurements, MEASUREMENTS.name) == Written(inserted=9)
    assert writer.write(events, DEVICE_EVENTS.name) == Written(inserted=5)
    return writer


_RESENT_DATABASE = "device_reads_resent_test"


@pytest.fixture
def resent(
    spark: SparkSession,
    store: _Store,
    store_migrations: list[str],
    fake_dlt: types.ModuleType,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[_Store]:
    """A store fed as ``fed`` is, in a database of its own, to which a phone then sent c1's captures 5
    and 6 again through c2: c1's newest in the window and its newest of all."""
    store.run(f"DROP DATABASE IF EXISTS {_RESENT_DATABASE} SYNC")
    store.run(f"CREATE DATABASE {_RESENT_DATABASE}")
    for statement in store_migrations:
        store.run(statement, database=_RESENT_DATABASE)
    store.run(f"GRANT SELECT, INSERT ON {_RESENT_DATABASE}.* TO {_WRITER}")

    gold = _gold_rows(spark, fake_dlt, monkeypatch)
    writer = _feed(_RESENT_DATABASE, gold, spark, store)
    again = gold.filter(F.col("id").isin(5, 6)).withColumn("client_id", F.lit("c2"))
    assert writer.write(MEASUREMENTS.lines(_changes(again, 5)), MEASUREMENTS.name) == Written(inserted=2)

    yield store

    store.run(f"DROP DATABASE {_RESENT_DATABASE} SYNC")


@pytest.mark.parametrize("read", list(_READS))
def test_a_device_read_on_the_store_answers_as_silver_does(
    spark: SparkSession, fed: _Store, read: str
) -> None:
    silver_sql, store_sql = _READS[read]

    silver_answer = _answer(_silver_rows(spark.sql(silver_sql)))
    store_answer = _answer(fed.rows(store_sql))

    assert silver_answer
    assert store_answer == silver_answer


def test_last_activity_on_the_store_answers_as_silvers_view_does(spark: SparkSession, fed: _Store) -> None:
    view = _LAST_ACTIVITY_VIEW.read_text().replace("${catalog}.centrum.", "")

    silver_answer = _answer(_silver_rows(spark.sql(view).where("client_id IN ('c1', 'c2', 'c3')")))
    store_answer = _answer(
        fed.rows(
            f"SELECT * FROM {_DATABASE}.device_last_activity(devices = ['c1', 'c2', 'c3'], "
            "experiments = ['e1', 'e2', 'e3'])"
        )
    )

    assert len(silver_answer) == 3
    assert store_answer == silver_answer


def test_a_devices_newest_rows_show_each_payload_in_golds_form(spark: SparkSession, fed: _Store) -> None:
    samples = {
        row.id: row.sample
        for row in spark.sql(
            f"SELECT id, sample FROM clean_data WHERE client_id = 'c1' AND {_SILVER_WINDOW}"
        ).collect()
    }

    payloads = {row_id: data for row_id, data in fed.rows(_newest_rows("id, data", 5))}

    assert set(payloads) == set(samples)
    assert payloads == _STORE_PAYLOADS


def test_a_row_silver_holds_without_an_experiment_reaches_no_device_read(
    spark: SparkSession, fed: _Store
) -> None:
    [[silver_rows]] = _silver_rows(spark.sql("SELECT count(*) FROM clean_data WHERE client_id = 'c4'"))

    [[store_rows]] = fed.rows(f"SELECT count() FROM {_device_rows('c4')}")

    assert (silver_rows, store_rows) == (1, 0)


def _hourly_counts(store: _Store, device: str) -> list[list]:
    return store.rows(
        "SELECT toHour(timestamp) AS hour, experiment_id, count() FROM "
        f"{_device_rows(device, database=_RESENT_DATABASE)} GROUP BY hour, experiment_id "
        "ORDER BY hour, experiment_id"
    )


def _last_data(store: _Store, device: str) -> str:
    [[last_data_at]] = store.rows(
        f"SELECT last_data_at FROM {_RESENT_DATABASE}.device_last_activity(devices = ['{device}'], "
        "experiments = ['e1', 'e2', 'e3'])"
    )
    return last_data_at


def _newest_ids(store: _Store, device: str, rows: int) -> list[int]:
    newest = store.rows(f"{_newest_rows('id', rows, device, _RESENT_DATABASE)} ORDER BY timestamp DESC")
    return [row_id for [row_id] in newest]


def test_a_capture_sent_again_through_another_client_reads_only_for_that_client(resent: _Store) -> None:
    assert _hourly_counts(resent, "c1") == [[10, "e1", 1], [11, "e2", 1], [12, "e1", 1], [13, "e2", 1]]
    assert _hourly_counts(resent, "c2") == [[10, "e1", 1], [10, "e3", 1], [13, "e2", 1]]
    assert (_last_data(resent, "c1"), _last_data(resent, "c2")) == (
        "2026-10-19 13:00:00.000000",
        "2026-10-20 09:00:00.000000",
    )
    assert (_newest_ids(resent, "c1", 1), _newest_ids(resent, "c1", 3)) == ([4], [4, 2, 3])
    assert _newest_ids(resent, "c2", 1) == [5]
