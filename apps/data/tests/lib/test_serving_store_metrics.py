"""The platform metrics the store counts, against the metrics pipeline's own tables on the same rows:
local Spark runs each table's code, and the rows go through the feed to the test store
``pnpm test`` starts. Every figure is equal but for these tolerances:

- A row silver holds twice, or a macro result gold recomputed, counts once in the store.
- Volume is each payload's length as gold holds it, where the pipeline counts silver's sample. On
  dev they matched byte for byte over a day of Ambyte rows and to 0.02% per row over a week of rows
  from other devices.
- A bare NaN or Infinity token, which gold reads as null, is no reading in the store.
- Up to 5,000 readings of a parameter, both medians are its lower middle value. Past that, each
  side's Greenwald-Khanna sketch at accuracy 10,000 picks a value within n/10,000 ranks of it for n
  readings, rounded up, from its own split of the readings, so the two may differ by twice that.
- The store ranks every NaN reading above every number. Spark does so within a partition, but
  compares with < when it merges partitions, which can rank a NaN among the numbers.
- Spark reads a macro's text such as 0x1.0p-1, 0.4D or 1.5f as a number, and an integer past 2^53
  as its nearest double. The store reads neither, so those values count in the pipeline alone.
- Gold's strict parse holds no payload for a sample whose object repeats a key, such as
  {"flag":1,"flag":2}, so that sample's readings and size count in the pipeline alone.
- A zone Spark rejects counts as none, where the pipeline counts it.
- Family totals are per client, and the backend names each client's family from the registry.
"""

from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
import sys
import time
import types
from collections.abc import Iterator
from itertools import pairwise
from pathlib import Path
from xml.etree import ElementTree

import pytest
import requests
from openjii import scrub_non_finite_json
from openjii.metrics.constants import (
    DERIVED_PARAMETER_ALLOWLIST,
    PARAMETER_LABELS,
    SENSOR_PARAMETER_ALLOWLIST,
)
from openjii.serving_store.tables import MACRO_RESULTS, MEASUREMENTS, UPLOADS, StoreTable
from openjii.serving_store.writer import StoreWriter
from openjii.timezones import usable_timezone
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import DateType, TimestampType

pytestmark = [pytest.mark.spark, pytest.mark.clickhouse]

_DATABASE = "metrics_test"
_READER = "metrics_test_reader"
_PASSWORD = "metrics-test"
_SCHEMA = "spark_catalog.metrics_store_parity"

_NOTEBOOKS = Path(__file__).parents[2] / "src/pipelines/metrics"
_MODULE = Path(__file__).parents[4] / "infrastructure/modules/serving-store"
_MIGRATIONS = Path(__file__).parents[4] / "packages/database/clickhouse/migrations"
_RELOAD_RUNBOOK = Path(__file__).parents[4] / "docs/runbooks/procedures/serving-store-reload.md"

# How the store timer's template writes the module's metrics views into its SQL.
_TIMER_VIEWS = """${join(", ", formatlist("'%s'", metrics_views))}"""

# Silver's measurements and gold's macro results, uploaded rows and device registry, each written
# once, so the pipeline and the feed read the very same times. Rows sit just inside and just outside
# each window.
_TABLES = {
    "clean_data": """
        SELECT *, to_date(timestamp) AS date FROM VALUES
          ('e1', 1L, 'd1', 'c1', 'u1', current_timestamp() - INTERVAL 1 HOUR, 'Europe/Amsterdam', 'p1', 'r1', 'v1',
           NULL, '[{"data":{"temperature":21.5}},{"data":{"temperature":22}}]'),
          ('e1', 2L, 'd1', 'c1', 'u1', current_timestamp() - INTERVAL 2 HOURS, 'Europe/Amsterdam', 'p1', 'r1', 'v1',
           false, '[{"set":[{"par":150,"temperature":19.25},{"par":160}]}]'),
          ('e1', 13L, 'd1', 'c1', 'u1', current_timestamp() - INTERVAL 23 HOURS, '+02:00', 'p1', NULL, NULL, NULL,
           '[{"set":[{"par":"NaN"},{"par":"nan"}]}]'),
          ('e1', 3L, 'd1', 'c1', 'u1', current_timestamp() - INTERVAL 25 HOURS, 'Europe/Amsterdam', 'p1', 'r1', 'v1',
           NULL, '[{"data":{"humidity":55.5,"pressure":1013.25}}]'),
          ('e1', 4L, 'd1', 'c1', 'u2', current_timestamp() - INTERVAL 2 DAYS, 'America/Los_Angeles', 'p2', 'r2', 'v1',
           NULL, '[{"data":{"thickness":0.42},"set":[{"light_intensity":800}]}]'),
          ('e1', 5L, 'd2', 'c2', 'u2', current_timestamp() - INTERVAL 5 DAYS, NULL, NULL, 'r2', NULL, true,
           '[{"data":{"par":"95"}}]'),
          ('e4', 14L, 'd5', 'c5', 'u4', current_timestamp() - INTERVAL 6 DAYS, 'PST', NULL, NULL, NULL, NULL, '[]'),
          ('e5', 15L, 'd6', 'c6', 'u5', current_timestamp() - INTERVAL 8 DAYS, 'UTC', NULL, NULL, NULL, NULL, '[]'),
          ('e1', 6L, 'd2', 'c2', NULL, current_timestamp() - INTERVAL 10 DAYS, 'UTC', 'p2', NULL, NULL, true,
           '{"no":"samples"}'),
          ('e3', 20L, 'd4', NULL, 'u1', current_timestamp() - INTERVAL 15 DAYS, 'Mars/Olympus', NULL, NULL, NULL,
           NULL, '[]'),
          ('e6', 16L, 'd7', 'c7', 'u6', current_timestamp() - INTERVAL 29 DAYS, 'UTC', NULL, NULL, NULL, NULL, '[]'),
          ('e7', 17L, 'd8', 'c8', 'u7', current_timestamp() - INTERVAL 31 DAYS, 'UTC', NULL, NULL, NULL, NULL, '[]'),
          ('e2', 7L, 'd3', 'c3', 'u3', current_timestamp() - INTERVAL 40 DAYS, 'America/Los_Angeles', 'p1', NULL,
           NULL, NULL, '[{"data":{"temperature":30}}]'),
          ('e2', 18L, 'd3', 'c3', 'u3', current_timestamp() - INTERVAL 89 DAYS, 'UTC', NULL, NULL, NULL, NULL,
           '[{"data":{"temperature":50}}]'),
          ('e2', 19L, 'd3', 'c3', 'u3', current_timestamp() - INTERVAL 91 DAYS, 'UTC', NULL, NULL, NULL, NULL,
           '[{"data":{"temperature":60}}]'),
          ('e2', 8L, 'd3', 'c3', 'u3', current_timestamp() - INTERVAL 100 DAYS, 'Asia/Kolkata', NULL, NULL, NULL,
           NULL, '[{"data":{"temperature":99}}]'),
          -- A logger, which names no contributor, and a device without a client, in the same minute.
          ('e2', 9L, 'd1', 'c1', NULL, current_timestamp() - INTERVAL 3 HOURS, 'Asia/Kolkata', NULL, NULL, NULL,
           NULL, '[]'),
          ('e3', 10L, 'd4', NULL, 'u1', current_timestamp() - INTERVAL 3 HOURS, 'Europe/Amsterdam', NULL, NULL,
           NULL, NULL, '[{"data":{"par":"dim"}}]'),
          -- An unset clock and one in the future, which no figure counts.
          ('e1', 11L, 'd1', 'c1', 'u1', TIMESTAMP'1970-01-02 00:00:00', 'UTC', 'p1', 'r1', 'v1', NULL,
           '[{"data":{"par":1}}]'),
          ('e1', 12L, 'd2', 'c2', 'u2', current_timestamp() + INTERVAL 2 DAYS, 'UTC', 'p1', NULL, NULL, NULL,
           '[{"data":{"par":2}}]')
        AS t(experiment_id, id, device_id, client_id, user_id, timestamp, timezone, protocol_id, workbook_run_id,
             workbook_version_id, skip_macro_processing, sample)
    """,
    "experiment_macro_data": r"""
        SELECT experiment_id, id, raw_id, macro_id, timestamp, to_date(timestamp) AS date,
               parse_json(output) AS macro_output
        FROM VALUES
          ('e1', 21L, 1L, 'm1', current_timestamp() - INTERVAL 1 HOUR, '{"Phi2":0.7,"SPAD":41.2}'),
          ('e1', 22L, 2L, 'm1', current_timestamp() - INTERVAL 2 HOURS, '{"Phi2":0.65}'),
          ('e1', 23L, 3L, 'm1', current_timestamp() - INTERVAL 1 DAY, '{"Phi2":"0.6"}'),
          ('e1', 24L, 4L, 'm2', current_timestamp() - INTERVAL 2 DAYS, '{"LEF":"abc","Phi2":true}'),
          ('e1', 25L, 5L, 'm2', current_timestamp() - INTERVAL 3 DAYS, '{"Phi2":" 0.55 "}'),
          ('e1', 32L, 14L, 'm2', current_timestamp() - INTERVAL 4 DAYS, '{"Phi2":"\\t0.62\\n"}'),
          ('e2', 26L, 7L, 'm2', current_timestamp() - INTERVAL 40 DAYS, '[0.7]'),
          ('e2', 27L, 8L, NULL, current_timestamp() - INTERVAL 50 DAYS, '{"LEF":120}'),
          ('e1', 30L, 12L, 'm1', current_timestamp() - INTERVAL 89 DAYS, '{"Phi2":0.3}'),
          ('e1', 31L, 13L, 'm1', current_timestamp() - INTERVAL 91 DAYS, '{"Phi2":0.2}'),
          ('e2', 28L, 8L, 'm1', current_timestamp() - INTERVAL 100 DAYS, '{"Phi2":0.1}'),
          ('e1', 29L, 11L, 'm1', TIMESTAMP'1970-01-02 00:00:00', '{"Phi2":0.9}'),
          -- Values Spark reads as numbers and the store does not.
          ('e1', 33L, 15L, 'm2', current_timestamp() - INTERVAL 6 DAYS, '{"qL":"0x1.0p-1"}'),
          ('e1', 34L, 16L, 'm2', current_timestamp() - INTERVAL 6 DAYS, '{"qL":"0.4D"}'),
          ('e1', 35L, 17L, 'm2', current_timestamp() - INTERVAL 6 DAYS, '{"qL":"1.5f"}'),
          ('e1', 36L, 18L, 'm2', current_timestamp() - INTERVAL 6 DAYS, '{"qL":9007199254740993}'),
          -- Text the store's default parser reads one step from Spark's double.
          ('e1', 37L, 19L, 'm2', current_timestamp() - INTERVAL 6 DAYS, '{"tilt_angle_deg":"51.986383"}')
        AS t(experiment_id, id, raw_id, macro_id, timestamp, output)
    """,
    # Gold may lack an upload's time.
    "experiment_uploaded_data": """
        SELECT * FROM VALUES
          ('e1', 41L, 't1', current_timestamp() - INTERVAL 1 DAY),
          ('e1', 42L, 't1', current_timestamp() - INTERVAL 1 DAY),
          ('e2', 43L, 't2', current_timestamp() - INTERVAL 6 DAYS),
          ('e2', 44L, 't2', CAST(NULL AS TIMESTAMP))
        AS t(experiment_id, id, upload_table_id, uploaded_at)
    """,
    "experiment_devices": """
        SELECT client_id, named_struct('device_type', device_type) AS device
        FROM VALUES ('c1', 'multispeq'), ('c2', 'ambit'), ('c3', CAST(NULL AS STRING)) AS t(client_id, device_type)
    """,
}

# Each client's family in the device registry, as experiment_devices holds it.
_REGISTRY = {"c1": "multispeq", "c2": "ambit"}

_GOLD_MEASUREMENTS = """
    SELECT
      experiment_id, id, device_id, client_id, CAST(NULL AS STRING) AS device_name,
      CAST(NULL AS STRING) AS device_family, CAST(NULL AS STRING) AS device_version,
      CAST(NULL AS STRING) AS device_firmware, CAST(NULL AS DOUBLE) AS device_battery,
      CAST(NULL AS STRING) AS device_address, CAST(NULL AS STRING) AS client_model,
      CAST(NULL AS STRING) AS client_manufacturer, CAST(NULL AS STRING) AS client_os,
      CAST(NULL AS STRING) AS client_os_version, CAST(NULL AS STRING) AS client_app_version,
      timestamp, timezone, CAST(NULL AS ARRAY<STRUCT<id: STRING, name: STRING, filename: STRING>>) AS macros,
      CAST(NULL AS VARIANT) AS questions_data, CAST(NULL AS ARRAY<STRUCT<id: STRING>>) AS annotations,
      user_id, protocol_id, workbook_run_id, workbook_version_id, CAST(NULL AS STRING) AS macro_context,
      CAST(NULL AS DOUBLE) AS latitude, CAST(NULL AS DOUBLE) AS longitude,
      try_parse_json(sample_scrubbed) AS data, CAST(NULL AS VARIANT) AS output_data,
      timestamp AS processed_timestamp, CAST(NULL AS TIMESTAMP) AS arrival_timestamp, skip_macro_processing,
      'insert' AS _change_type, 2L AS _commit_version, current_timestamp() AS _commit_timestamp
    FROM gold_measurements
"""

_GOLD_MACRO_RESULTS = f"""
    SELECT
      experiment_id, id, raw_id, 'd1' AS device_id, 'c1' AS client_id, CAST(NULL AS STRING) AS device_name,
      timestamp, CAST(NULL AS STRING) AS timezone, CAST(NULL AS STRING) AS user_id,
      CAST(NULL AS DOUBLE) AS latitude, CAST(NULL AS DOUBLE) AS longitude, macro_id,
      CAST(NULL AS STRING) AS macro_name, 'macro.js' AS macro_filename, CAST(NULL AS STRING) AS workbook_run_id,
      CAST(NULL AS STRING) AS workbook_version_id, macro_output, CAST(NULL AS STRING) AS macro_error,
      timestamp AS processed_timestamp, CAST(NULL AS VARIANT) AS questions_data,
      CAST(NULL AS ARRAY<STRUCT<id: STRING>>) AS annotations, date,
      'insert' AS _change_type, 2L AS _commit_version, current_timestamp() AS _commit_timestamp
    FROM {_SCHEMA}.experiment_macro_data
"""

_GOLD_UPLOADS = f"""
    SELECT
      experiment_id, id, upload_table_id, 'Soil' AS upload_table_name, 'up1' AS upload_id,
      'u1' AS created_by, uploaded_at, parse_json('{{"ph":6.5}}') AS uploaded_data,
      'insert' AS _change_type, 2L AS _commit_version, current_timestamp() AS _commit_timestamp
    FROM {_SCHEMA}.experiment_uploaded_data
"""

# Older copies of a measurement and a macro result, which every figure leaves out for the newer.
_REPLAYED = {
    MEASUREMENTS: (
        "id = 1",
        {
            "timezone": "'Asia/Tokyo'",
            "data": """parse_json('[{"data":{"note":"older","temperature":99.5}}]')""",
        },
    ),
    MACRO_RESULTS: ("id = 21", {"macro_output": """parse_json('{"Phi2":0.01,"SPAD":1}')"""}),
}


class _Store:
    """One user's view of a real store."""

    def __init__(self, url: str, user: str, password: str):
        self.url = url
        self.user = user
        self.password = password
        self.headers = {"X-ClickHouse-User": user, "X-ClickHouse-Key": password}

    def run(self, sql: str, database: str | None = None) -> requests.Response:
        params = {"database": database} if database else {}
        return requests.post(self.url, params=params, data=sql.encode(), headers=self.headers, timeout=120)

    def ok(self, sql: str, database: str | None = None) -> str:
        response = self.run(sql, database)
        assert response.ok, response.text
        return response.text

    def rows(self, sql: str) -> list[dict]:
        text = self.ok(f"{sql} SETTINGS output_format_json_quote_64bit_integers = 0 FORMAT JSONEachRow")
        return [json.loads(line) for line in text.splitlines()]


@pytest.fixture(scope="module")
def tables(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[None]:
    """Silver's and gold's rows, in a session that runs in UTC as Databricks sessions do."""
    spark.conf.set("spark.sql.session.timeZone", "UTC")
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_SCHEMA} LOCATION '{tmp_path_factory.mktemp('parity')}'")
    for name, query in _TABLES.items():
        spark.sql(f"CREATE TABLE {_SCHEMA}.{name} USING parquet AS {query}")

    silver = spark.table(f"{_SCHEMA}.clean_data")
    # The pipeline's hourly profile fails on a zone Spark rejects, so it runs without those rows.
    silver.where(
        F.col("timezone").isNull() | usable_timezone(F.col("timezone")).isNotNull()
    ).write.saveAsTable(f"{_SCHEMA}.clean_data_usable_zones")
    silver.withColumns(
        {
            "timezone": usable_timezone(F.col("timezone")),
            "sample_scrubbed": scrub_non_finite_json(F.col("sample")),
        }
    ).createOrReplaceTempView("gold_measurements")

    yield

    spark.catalog.dropTempView("gold_measurements")
    spark.sql(f"DROP DATABASE {_SCHEMA} CASCADE")
    spark.conf.unset("spark.sql.session.timeZone")


@pytest.fixture(scope="module")
def admin(store_admin: tuple[str, str, str], store_migrations: list[str], store_module) -> Iterator[_Store]:
    """A database holding the migrations, whose views have all refreshed once, empty."""
    admin = _Store(*store_admin)
    users = [_READER, *(f"{_DATABASE}_{role}" for role in ("writer", "reloader"))]
    for user in users:
        admin.ok(f"DROP USER IF EXISTS {user}")
    admin.ok(f"DROP DATABASE IF EXISTS {_DATABASE} SYNC")
    admin.ok(f"CREATE DATABASE {_DATABASE}")
    for statement in store_migrations:
        admin.ok(statement, database=_DATABASE)

    views = store_module.local_list("metrics_views")
    for _ in range(120):
        [state] = admin.rows(
            "SELECT countIf(last_success_time IS NOT NULL) AS refreshed FROM system.view_refreshes "
            f"WHERE database = '{_DATABASE}'"
        )
        if state["refreshed"] == len(views):
            break
        time.sleep(0.5)

    yield admin

    for user in users:
        admin.ok(f"DROP USER IF EXISTS {user}")
    admin.ok(f"DROP DATABASE {_DATABASE} SYNC")


@pytest.fixture(scope="module")
def first_refreshes(admin: _Store) -> list[dict]:
    """Each view's refresh when the migrations made it, from the query log, earliest first."""
    admin.ok("SYSTEM FLUSH LOGS")
    return admin.rows(
        f"SELECT arrayFirst(name -> startsWith(name, '{_DATABASE}.metrics_'), tables) AS view, "
        "toString(query_start_time_microseconds) AS started, toString(event_time_microseconds) AS ended "
        "FROM system.query_log "
        f"WHERE type = 'QueryFinish' AND query_kind = 'Insert' AND user = '' AND has(databases, '{_DATABASE}') "
        f"AND event_time >= (SELECT min(metadata_modification_time) FROM system.tables WHERE database = '{_DATABASE}') "
        # A refresh that ran again on the hour is not when the migrations made the view.
        "ORDER BY query_start_time_microseconds LIMIT 1 BY view"
    )


def _send(writer: StoreWriter, table: StoreTable, changes: DataFrame) -> None:
    written = writer.write(table.lines(changes), table.name)
    assert not written.rejected and not written.unfinished


def _refresh(admin: _Store, database: str, views: list[str]) -> None:
    for view in views:
        admin.ok(f"SYSTEM REFRESH VIEW {database}.{view}")
        admin.ok(f"SYSTEM WAIT VIEW {database}.{view}")


@pytest.fixture(scope="module")
def store(
    spark: SparkSession, tables: None, admin: _Store, first_refreshes: list[dict], store_module
) -> _Store:
    """The same rows sent through the feed after older copies of two of them, left unmerged, every
    view refreshed, and a reader granted what the store's users.xml grants the backend's reader."""
    for table in ("measurements", "macro_results", "uploads"):
        admin.ok(f"SYSTEM STOP MERGES {_DATABASE}.{table}")

    writer = StoreWriter(admin.url, admin.user, admin.password, database=_DATABASE)
    golds = {MEASUREMENTS: _GOLD_MEASUREMENTS, MACRO_RESULTS: _GOLD_MACRO_RESULTS, UPLOADS: _GOLD_UPLOADS}
    for table, (row, columns) in _REPLAYED.items():
        older = {"_commit_version": F.lit(1), **{column: F.expr(value) for column, value in columns.items()}}
        _send(writer, table, spark.sql(golds[table]).where(row).withColumns(older))
    for table, gold in golds.items():
        _send(writer, table, spark.sql(gold))

    _refresh(admin, _DATABASE, store_module.local_list("metrics_views"))

    admin.ok(f"CREATE USER {_READER} IDENTIFIED BY '{_PASSWORD}'")
    for grant in store_module.grants("reader"):
        admin.ok(f"{grant.replace(' ON store.', f' ON {_DATABASE}.')} TO {_READER}")

    return _Store(admin.url, _READER, _PASSWORD)


@pytest.fixture
def pipeline(spark: SparkSession, tables: None, fake_dlt: types.ModuleType, monkeypatch: pytest.MonkeyPatch):
    """Runs one metrics pipeline table's own code over the fixture's tables."""
    runtime = types.ModuleType("openjii.metrics.runtime")
    runtime.centrum_table = lambda name: f"{_SCHEMA}.{name}"  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.metrics.runtime", runtime)

    def run(table: str, silver: str = "clean_data") -> list[dict]:
        runtime.SILVER_TABLE = silver  # type: ignore[attr-defined]
        spec = importlib.util.spec_from_file_location(f"metrics_{table}", _NOTEBOOKS / f"{table}.py")
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        module.spark = spark  # type: ignore[attr-defined]
        spec.loader.exec_module(module)
        return _as_stored(getattr(module, table)())

    return run


def _as_stored(frame: DataFrame) -> list[dict]:
    """The table's rows with times and dates written as the store writes them, without the time it
    was computed at."""
    columns = []
    for field in frame.schema.fields:
        if field.name == "computed_at":
            continue
        if isinstance(field.dataType, TimestampType):
            columns.append(F.date_format(field.name, "yyyy-MM-dd HH:mm:ss.SSSSSS").alias(field.name))
        elif isinstance(field.dataType, DateType):
            columns.append(F.col(field.name).cast("string"))
        else:
            columns.append(F.col(field.name))
    return [row.asDict() for row in frame.select(*columns).collect()]


def _view(store: _Store, view: str) -> list[dict]:
    return store.rows(f"SELECT * EXCEPT computed_at FROM {_DATABASE}.{view}")


def _sorted(rows: list[dict], *key: str) -> list[dict]:
    return sorted(rows, key=lambda row: tuple(str(row[column]) for column in key))


def test_the_reader_is_granted_every_metrics_view_the_migrations_make(store_module) -> None:
    made = {
        name
        for migration in _MIGRATIONS.glob("*.sql")
        for name in re.findall(r"CREATE MATERIALIZED VIEW IF NOT EXISTS (metrics_\w+)", migration.read_text())
    }

    assert sorted(store_module.local_list("metrics_views")) == sorted(made)
    assert {f"GRANT SELECT ON store.{view}" for view in made} <= set(store_module.grants("reader"))


def test_every_vetted_parameter_is_counted_under_its_label_from_its_own_field() -> None:
    migration = (_MIGRATIONS / "0010_platform_metrics.sql").read_text()

    counted = {
        name: (label, source)
        for name, label, source in re.findall(r"\('(\w+)', '([^']+)', ([\w.]+)\)", migration)
    }

    assert counted == {
        **{name: (PARAMETER_LABELS[name], f"macro_output.{name}") for name in DERIVED_PARAMETER_ALLOWLIST},
        **{name: (PARAMETER_LABELS[name], f"{name}_readings") for name in SENSOR_PARAMETER_ALLOWLIST},
    }


def test_the_views_refresh_one_after_another(
    admin: _Store, first_refreshes: list[dict], store_module
) -> None:
    views = store_module.local_list("metrics_views")
    made = admin.rows(
        f"SELECT name, create_table_query FROM system.tables WHERE database = '{_DATABASE}' "
        "AND startsWith(name, 'metrics_')"
    )
    depends = {
        row["name"]: (re.findall(rf"DEPENDS ON {_DATABASE}\.(\w+)", row["create_table_query"]) or [None])[0]
        for row in made
    }

    assert depends == dict(zip(views, [None, *views[:-1]], strict=True))
    assert [refresh["view"] for refresh in first_refreshes] == [f"{_DATABASE}.{view}" for view in views]
    assert all(later["started"] >= earlier["ended"] for earlier, later in pairwise(first_refreshes))


def test_no_two_refreshes_run_at_once_even_when_nothing_orders_them(admin: _Store) -> None:
    made = admin.rows(
        f"SELECT create_table_query FROM system.tables WHERE database = '{_DATABASE}' "
        "AND startsWith(name, 'metrics_')"
    )
    database = f"{_DATABASE}_workload"
    admin.ok(f"DROP DATABASE IF EXISTS {database} SYNC")
    admin.ok(f"CREATE DATABASE {database}")
    since = admin.ok("SELECT now64(6) FORMAT TSV").strip()
    # Two refreshes of a second each, as the next hour's first view and the last hour's last one.
    views = ["first", "second"]
    for view in views:
        admin.ok(
            f"CREATE MATERIALIZED VIEW {database}.{view} REFRESH EVERY 1 HOUR ENGINE = Memory AS "
            "SELECT sleepEachRow(0.5) AS x FROM numbers(2) "
            "SETTINGS max_block_size = 1, workload = 'metrics_refreshes'"
        )
    for view in views:
        admin.ok(f"SYSTEM WAIT VIEW {database}.{view}")
    admin.ok("SYSTEM FLUSH LOGS")
    ended = admin.rows(
        "SELECT toUnixTimestamp64Micro(event_time_microseconds) / 1e6 AS ended FROM system.query_log "
        f"WHERE type = 'QueryFinish' AND query_kind = 'Insert' AND user = '' AND has(databases, '{database}') "
        f"AND event_time_microseconds >= '{since}' ORDER BY ended"
    )
    admin.ok(f"DROP DATABASE {database} SYNC")

    assert made and all("workload = 'metrics_refreshes'" in row["create_table_query"] for row in made)
    [first, second] = [row["ended"] for row in ended]
    assert second - first >= 1


@pytest.mark.parametrize("role", ["writer", "reloader"])
def test_neither_feed_user_can_write_a_figure(admin: _Store, store_module, role: str) -> None:
    user = f"{_DATABASE}_{role}"
    admin.ok(f"CREATE USER {user} IDENTIFIED BY '{_PASSWORD}'")
    for grant in store_module.grants(role):
        admin.ok(f"{grant.replace(' ON store.', f' ON {_DATABASE}.')} TO {user}")
    as_user = _Store(admin.url, user, _PASSWORD)

    views = store_module.local_list("metrics_views")
    # A view without TO keeps its rows in a table named after its uuid.
    inner_tables = [
        row["name"]
        for row in admin.rows(
            f"SELECT name FROM system.tables WHERE database = '{_DATABASE}' AND name IN ("
            "SELECT concat('.inner_id.', toString(uuid)) FROM system.tables "
            f"WHERE database = '{_DATABASE}' AND startsWith(name, 'metrics_'))"
        )
    ]

    as_user.ok(
        f"INSERT INTO {_DATABASE}.feed_rejects (source_table, code, message, row) VALUES ('{role}', 0, '', '')"
    )
    assert len(inner_tables) == len(views)
    for table in [*views, *inner_tables]:
        refused = as_user.run(f"INSERT INTO {_DATABASE}.`{table}` SELECT * FROM {_DATABASE}.`{table}`")
        assert refused.headers.get("X-ClickHouse-Exception-Code") == "497", table


def test_the_reader_reads_a_table_the_views_count_only_under_its_row_filter(store_module) -> None:
    granted = set(store_module.grants("reader"))
    row_filtered = set(store_module.local_list("reader_tables"))
    for table in ("measurements", "macro_results", "uploads"):
        if f"GRANT SELECT ON store.{table}" in granted:
            assert table in row_filtered, table


def test_the_store_timer_reads_how_old_the_views_are_and_which_failed(admin: _Store) -> None:
    script = (_MODULE / "templates/feed-metrics.sh.tftpl").read_text()
    query = re.search(r'refresh_query="(.*?)"\n', script, re.DOTALL)
    assert query is not None
    database, monitor = f"{_DATABASE}_timer", f"{_DATABASE}_monitor"
    admin.ok(f"DROP DATABASE IF EXISTS {database} SYNC")
    admin.ok(f"DROP USER IF EXISTS {monitor}")
    admin.ok(f"CREATE DATABASE {database}")
    admin.ok(
        f"CREATE MATERIALIZED VIEW {database}.metrics_fine REFRESH EVERY 1 HOUR ENGINE = Memory AS SELECT 1 AS x"
    )
    admin.ok(
        f"CREATE MATERIALIZED VIEW {database}.metrics_failing REFRESH EVERY 1 HOUR SETTINGS refresh_retries = 0 "
        "ENGINE = Memory AS SELECT throwIf(1) AS x"
    )
    admin.ok(
        f"CREATE MATERIALIZED VIEW {database}.metrics_waiting REFRESH EVERY 1 HOUR "
        f"DEPENDS ON {database}.metrics_failing ENGINE = Memory AS SELECT 1 AS x"
    )
    # Made without its first refresh, as a view stands whose refresh at the server's start never ran.
    admin.ok(
        f"CREATE MATERIALIZED VIEW {database}.metrics_unrefreshed REFRESH EVERY 1 HOUR ENGINE = Memory EMPTY "
        "AS SELECT 1 AS x"
    )
    admin.ok(f"SYSTEM WAIT VIEW {database}.metrics_fine")
    admin.run(f"SYSTEM WAIT VIEW {database}.metrics_failing")
    admin.ok(f"CREATE USER {monitor} IDENTIFIED BY '{_PASSWORD}'")
    users_xml = (_MODULE / "templates/users.xml.tftpl").read_text()
    end = users_xml.index("</openjii_monitor>") + len("</openjii_monitor>")
    monitor_xml = ElementTree.fromstring(users_xml[users_xml.index("<openjii_monitor>") : end])
    for grant in monitor_xml.iterfind("grants/query"):
        admin.ok(f"{(grant.text or '').replace(' ON store.', f' ON {database}.')} TO {monitor}")
    expected = [
        "metrics_fine",
        "metrics_failing",
        "metrics_waiting",
        "metrics_unrefreshed",
        "metrics_missing",
    ]
    statement = (
        query[1]
        .replace("'store'", f"'{database}'")
        .replace(_TIMER_VIEWS, ", ".join(f"'{view}'" for view in expected))
    )

    [age, failing] = _Store(admin.url, monitor, _PASSWORD).ok(f"{statement} FORMAT TSV").split()
    [since_start] = admin.ok("SELECT intDiv(uptime(), 60) FORMAT TSV").split()
    admin.ok(f"DROP USER {monitor}")
    admin.ok(f"DROP DATABASE {database} SYNC")

    # A view that never refreshed is as old as the server's run. The failed view, the one never
    # refreshed and the missing one count; the one waiting behind the failed view does not.
    assert int(age) in (int(since_start) - 1, int(since_start))
    assert failing == "3"


@pytest.mark.parametrize(("ledger", "sent"), [("1", True), ("0", False)])
def test_the_store_timer_counts_every_view_failing_when_it_cannot_read_their_state(
    tmp_path: Path, store_module, ledger: str, sent: bool
) -> None:
    views = store_module.local_list("metrics_views")
    script = (
        (_MODULE / "templates/feed-metrics.sh.tftpl")
        .read_text()
        .replace(_TIMER_VIEWS, ", ".join(f"'{view}'" for view in views))
        .replace("${length(metrics_views)}", str(len(views)))
        .replace("${environment}", "test")
        .replace("${region}", "eu-central-1")
        .replace("${namespace}", "Test")
        .replace("$${", "${")
    )
    fakes = tmp_path / "bin"
    fakes.mkdir()
    # A store that answers everything but the view refreshes, as when the timer lost its grant.
    (fakes / "clickhouse-client").write_text(
        f"""#!/bin/bash
case "$*" in
  *view_refreshes*) echo "Code: 497. Not enough privileges" >&2; exit 1 ;;
  *_migrations*) echo {ledger} ;;
  *query_log*) printf '0\\t0\\tnan\\n' ;;
  *metadata_rows*) printf 'metadata_rows\\t0\\tnan\\t0\\n' ;;
  *) printf 'measurements\\t0\\tnan\\t0\\nmacro_results\\t0\\tnan\\t0\\nuploads\\t0\\tnan\\t0\\n' ;;
esac
"""
    )
    (fakes / "aws").write_text(f'#!/bin/bash\nprintf "%s" "${{@: -1}}" > "{tmp_path / "sent.json"}"\n')
    for fake in fakes.iterdir():
        fake.chmod(0o755)

    run = subprocess.run(
        ["bash", "-c", script],
        env={**os.environ, "PATH": f"{fakes}:{os.environ['PATH']}"},
        capture_output=True,
        text=True,
        check=False,
    )
    sent_metrics = json.loads((tmp_path / "sent.json").read_text())
    values = {metric["MetricName"]: metric["Value"] for metric in sent_metrics}

    assert run.returncode == 0, run.stderr
    assert "FeedInsertedRows" in values
    assert "MetricsRefreshAgeMinutes" not in values
    assert values.get("MetricsRefreshFailures") == (len(views) if sent else None)


def _reload_runbook_sql(marker: str) -> str:
    """The reload runbook's SQL block after ``marker``, on the test database."""
    after_marker = _RELOAD_RUNBOOK.read_text().split(f"<!-- {marker} -->", 1)[1]
    sql = after_marker.split("```sql\n", 1)[1].split("\n```", 1)[0]
    return sql.replace("store.", f"{_DATABASE}.").replace("'store'", f"'{_DATABASE}'")


@pytest.mark.usefixtures("store")
def test_the_reload_runbook_refreshes_every_view_in_chain_order_and_lists_any_it_did_not(
    admin: _Store, store_module
) -> None:
    views = store_module.local_list("metrics_views")
    refresh = _reload_runbook_sql("serving-store-reload-refresh")
    statements = [statement.strip() for statement in refresh.split(";") if statement.strip()]
    # last_success_time holds whole seconds, so this puts every earlier refresh before the noted time.
    time.sleep(1)
    noted = admin.ok("SELECT now() FORMAT TSV").strip()
    check = _reload_runbook_sql("serving-store-reload-refresh-check")
    unrefreshed = check.replace("<the time you noted>", noted).rstrip(";")

    before = {row["view"] for row in admin.rows(unrefreshed)}
    for statement in statements:
        admin.ok(statement)
    after = admin.rows(unrefreshed)

    assert statements == [
        f"SYSTEM {verb} VIEW {_DATABASE}.{view}" for view in views for verb in ("REFRESH", "WAIT")
    ]
    assert before == set(views)
    assert after == []


def _e1_figures(admin: _Store, database: str, views: list[str]) -> tuple[int, int, list[str]]:
    """After a refresh, the platform's measurement total, e1's measurements over its daily rows and
    e1's contributors in the window."""
    _refresh(admin, database, views)
    [totals] = admin.rows(f"SELECT total_measurements FROM {database}.metrics_platform_totals")
    [days] = admin.rows(
        f"SELECT sum(measurements) AS measurements FROM {database}.metrics_daily_activity_by_experiment "
        "WHERE experiment_id = 'e1'"
    )
    contributors = admin.rows(
        f"SELECT user_id FROM {database}.metrics_experiment_contributors_window "
        "WHERE experiment_id = 'e1' ORDER BY user_id"
    )
    return totals["total_measurements"], days["measurements"], [row["user_id"] for row in contributors]


def test_rows_a_reload_deletes_leave_the_figures_at_the_next_refresh(
    spark: SparkSession, tables: None, admin: _Store, store_migrations: list[str], store_module
) -> None:
    database = f"{_DATABASE}_reload"
    views = store_module.local_list("metrics_views")
    admin.ok(f"DROP DATABASE IF EXISTS {database} SYNC")
    admin.ok(f"CREATE DATABASE {database}")
    for statement in store_migrations:
        admin.ok(statement, database=database)
    writer = StoreWriter(admin.url, admin.user, admin.password, database=database)
    gold = spark.sql(_GOLD_MEASUREMENTS)
    _send(writer, MEASUREMENTS, gold)
    # A reload of e1 at version 7, when gold holds only its measurements 1 and 2.
    kept = gold.where("experiment_id = 'e1' AND id IN (1, 2)").withColumn("_commit_version", F.lit(7))
    _send(writer, MEASUREMENTS, kept)

    before = _e1_figures(admin, database, views)
    admin.ok(f"DELETE FROM {database}.measurements WHERE _commit_version < 7 AND experiment_id = 'e1'")
    after = _e1_figures(admin, database, views)
    admin.ok(f"DROP DATABASE {database} SYNC")

    # The delete takes e1's measurements 3 to 6 and 13, among them u2's only two in the window.
    assert before[1:] == (7, ["u1", "u2"])
    assert after == (before[0] - 5, 2, ["u1"])


def test_a_zone_spark_rejects_counts_in_no_zone_figure_though_older_gold_kept_it(
    spark: SparkSession, tables: None, admin: _Store, store_migrations: list[str], store_module
) -> None:
    database = f"{_DATABASE}_zones"
    admin.ok(f"DROP DATABASE IF EXISTS {database} SYNC")
    admin.ok(f"CREATE DATABASE {database}")
    for statement in store_migrations:
        admin.ok(statement, database=database)
    # Gold's rows from before it checked zones, one of them beside a zone Spark knows on its day.
    spark.sql(
        """
        SELECT
          experiment_id, id, 'd1' AS device_id, 'c1' AS client_id, 'u1' AS user_id, timestamp, timezone,
          CAST(NULL AS STRING) AS protocol_id, CAST(NULL AS STRING) AS workbook_run_id,
          CAST(NULL AS STRING) AS workbook_version_id, CAST(NULL AS BOOLEAN) AS skip_macro_processing,
          '[]' AS sample_scrubbed
        FROM VALUES
          ('e1', 1L, TIMESTAMP'2026-11-01 10:00:00', 'Europe/Amsterdam'),
          ('e1', 2L, TIMESTAMP'2026-11-01 11:00:00', 'AMT'),
          ('e1', 3L, TIMESTAMP'2026-11-02 10:00:00', 'Mars/Olympus')
        AS t(experiment_id, id, timestamp, timezone)
        """
    ).createOrReplaceTempView("older_gold_measurements")
    gold = spark.sql(_GOLD_MEASUREMENTS.replace("FROM gold_measurements", "FROM older_gold_measurements"))
    writer = StoreWriter(admin.url, admin.user, admin.password, database=database)

    # Over inline rows Spark checks the zone while planning, where one it rejects throws instead of
    # giving null, so the rows are shuffled first.
    _send(writer, MEASUREMENTS, gold.repartition(1))
    _refresh(admin, database, store_module.local_list("metrics_views"))
    stored = admin.rows(f"SELECT timezone, hour_local FROM {database}.measurements ORDER BY id")
    [zones] = admin.rows(f"SELECT timezones_all_time, timezones_peak_day FROM {database}.metrics_pool_facts")
    spark.catalog.dropTempView("older_gold_measurements")
    admin.ok(f"DROP DATABASE {database} SYNC")

    assert stored == [
        {"timezone": "Europe/Amsterdam", "hour_local": 11},
        {"timezone": "AMT", "hour_local": None},
        {"timezone": "Mars/Olympus", "hour_local": None},
    ]
    assert zones == {"timezones_all_time": 1, "timezones_peak_day": 1}


def test_a_sample_that_repeats_a_key_counts_in_the_pipeline_alone(
    spark: SparkSession, tables: None, pipeline, admin: _Store, store_migrations: list[str], store_module
) -> None:
    database = f"{_DATABASE}_repeated_key"
    admin.ok(f"DROP DATABASE IF EXISTS {database} SYNC")
    admin.ok(f"CREATE DATABASE {database}")
    for statement in store_migrations:
        admin.ok(statement, database=database)
    sample = '[{"data":{"temperature":21,"flag":1,"flag":2}}]'
    silver = spark.table(f"{_SCHEMA}.clean_data").where("id = 1").withColumn("sample", F.lit(sample))
    silver.write.saveAsTable(f"{_SCHEMA}.clean_data_repeated_key")
    silver.withColumn("sample_scrubbed", scrub_non_finite_json(F.col("sample"))).createOrReplaceTempView(
        "repeated_key_gold"
    )
    gold = spark.sql(_GOLD_MEASUREMENTS.replace("FROM gold_measurements", "FROM repeated_key_gold"))
    writer = StoreWriter(admin.url, admin.user, admin.password, database=database)

    _send(writer, MEASUREMENTS, gold)
    _refresh(admin, database, store_module.local_list("metrics_views"))
    stored = admin.rows(
        f"SELECT total_measurements, total_volume_bytes, (SELECT countIf(parameter != '') FROM {database}.metrics_parameter_stats) AS parameters "
        f"FROM {database}.metrics_platform_totals"
    )
    [totals] = pipeline("platform_totals", silver="clean_data_repeated_key")
    counted = pipeline("parameter_stats", silver="clean_data_repeated_key")
    spark.catalog.dropTempView("repeated_key_gold")
    spark.sql(f"DROP TABLE {_SCHEMA}.clean_data_repeated_key")
    admin.ok(f"DROP DATABASE {database} SYNC")

    readings = [row for row in counted if row["category"] == "sensor"]

    assert [(row["parameter"], row["observations"], row["median_value"]) for row in readings] == [
        ("temperature", 1, 21.0)
    ]
    assert totals["total_volume_bytes"] == len(sample)
    # The row is counted, so the refresh read it, though its payload is not.
    assert stored == [{"total_measurements": 1, "total_volume_bytes": 0, "parameters": 0}]


def test_platform_totals(pipeline, store: _Store) -> None:
    assert _view(store, "metrics_platform_totals") == pipeline("platform_totals")


def test_daily_activity(pipeline, store: _Store) -> None:
    assert _sorted(_view(store, "metrics_daily_activity"), "date") == _sorted(
        pipeline("daily_activity"), "date"
    )


def test_client_totals_add_up_to_the_family_totals(pipeline, store: _Store) -> None:
    families: dict[str, dict] = {}
    for client in _view(store, "metrics_client_totals"):
        family = _REGISTRY.get(client["client_id"]) or "unattributed"
        totals = families.setdefault(family, {"total_measurements": 0, "last_measurement_at": ""})
        totals["total_measurements"] += client["total_measurements"]
        totals["last_measurement_at"] = max(totals["last_measurement_at"], client["last_measurement_at"])

    assert families == {
        row["family"]: {
            "total_measurements": row["total_measurements"],
            "last_measurement_at": row["last_measurement_at"],
        }
        for row in pipeline("family_totals")
    }


def test_hourly_activity(pipeline, store: _Store) -> None:
    assert _sorted(_view(store, "metrics_hourly_activity"), "hour_local") == _sorted(
        pipeline("hourly_activity", silver="clean_data_usable_zones"), "hour_local"
    )


def test_activity_windows(pipeline, store: _Store) -> None:
    assert _view(store, "metrics_activity_windows") == pipeline("activity_windows")


def test_parameter_stats(pipeline, store: _Store) -> None:
    counted = pipeline("parameter_stats")
    [ql] = [row for row in counted if row["parameter"] == "qL"]
    view = _view(store, "metrics_parameter_stats")

    # qL's values are all ones the store does not read, so it has no row for qL. The store also gives
    # each category a row without a parameter, which tells its readers the view has refreshed.
    assert ql["observations"] == 4
    assert sorted(row["category"] for row in view if row["parameter"] == "") == ["derived", "sensor"]
    assert _sorted([row for row in view if row["parameter"] != ""], "parameter") == _sorted(
        [row for row in counted if row["parameter"] != "qL"], "parameter"
    )


def test_pool_facts(pipeline, store: _Store) -> None:
    [counted] = pipeline("pool_facts")

    # The zone Spark rejects counts in the pipeline alone.
    assert _view(store, "metrics_pool_facts") == [
        {**counted, "timezones_all_time": counted["timezones_all_time"] - 1}
    ]


def test_daily_activity_by_experiment(pipeline, store: _Store) -> None:
    key = ("date", "experiment_id")

    assert _sorted(_view(store, "metrics_daily_activity_by_experiment"), *key) == _sorted(
        pipeline("daily_activity_by_experiment"), *key
    )


def test_daily_activity_by_resource(pipeline, store: _Store) -> None:
    key = ("date", "resource_type", "resource_id")

    assert _sorted(_view(store, "metrics_daily_activity_by_resource"), *key) == _sorted(
        pipeline("daily_activity_by_resource"), *key
    )


def test_experiment_contributors_window(pipeline, store: _Store) -> None:
    key = ("experiment_id", "user_id")

    assert _sorted(_view(store, "metrics_experiment_contributors_window"), *key) == _sorted(
        pipeline("experiment_contributors_window"), *key
    )


def test_experiment_devices_window(pipeline, store: _Store) -> None:
    key = ("experiment_id", "client_id")

    assert _sorted(_view(store, "metrics_experiment_devices_window"), *key) == _sorted(
        pipeline("experiment_devices_window"), *key
    )
