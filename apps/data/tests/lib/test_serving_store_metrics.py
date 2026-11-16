"""The platform metrics the store counts, against the metrics pipeline's own tables on the same rows.

Local Spark runs each pipeline table's code over silver and gold rows; the same rows go through the
feed into a real store, as test_serving_store_tables.py describes, and each view is refreshed and
read as the metrics user reads it. The tests skip without a store. Every figure is equal, and the
fixture leaves out what the tolerances below cover, which real data has:

- The store counts gold's rows, each at its newest commit; the pipeline counts silver's. Dev's hold
  the same rows, but a row silver holds twice, or a macro result gold recomputed after silver
  reprocessed its measurement, counts once in the store and twice in the pipeline.
- Volume is the bytes of each payload's JSON as the store holds it, which Spark writes out from
  gold's parsed payload: compact, keys in order, numbers reprinted. That is about the raw size and
  rarely equal to it; the fixture's payloads are written that way already. A payload that is not
  JSON counts no bytes.
- A NaN or Infinity reading, which gold holds as null, is no observation in the store; the pipeline
  counts it, and sorts NaN above every number.
- Medians are exact, of the lower middle value. Spark's percentile_approx picks that value up to
  10,000 values; beyond them it may pick one up to a 10,000th of the count away.
- A zone the store does not know, such as PST or +02:00, gives its rows no local hour.
- Family totals are per client: the backend names each client's family from the registry in
  Postgres, as test_client_totals_add_up_to_the_family_totals does here with the fixture's registry.
  The pipeline's distinct devices per family are not kept, since the backend never reads them and
  distinct devices cannot be added up across clients.
"""

from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
import types
from collections.abc import Iterator
from pathlib import Path

import pytest
import requests
from openjii.metrics.constants import (
    DERIVED_PARAMETER_ALLOWLIST,
    PARAMETER_LABELS,
    SENSOR_PARAMETER_ALLOWLIST,
)
from openjii.serving_store.tables import MACRO_RESULTS, MEASUREMENTS, UPLOADS
from openjii.serving_store.writer import StoreWriter
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import DateType, TimestampType

pytestmark = [pytest.mark.spark, pytest.mark.clickhouse]

_DATABASE = "metrics_test"
_METRICS_USER = "metrics_test_reader"
_SCHEMA = "spark_catalog.metrics_store_parity"

_NOTEBOOKS = Path(__file__).parents[2] / "src/pipelines/metrics"
_MAIN_TF = Path(__file__).parents[4] / "infrastructure/modules/serving-store/main.tf"
_MIGRATIONS = Path(__file__).parents[4] / "packages/database/clickhouse/migrations"

# Silver's measurements and gold's macro results, uploaded rows and device registry, each written
# once, so the pipeline and the feed read the very same times.
_TABLES = {
    "clean_data": """
        SELECT *, to_date(timestamp) AS date FROM VALUES
          ('e1', 1L, 'd1', 'c1', 'u1', current_timestamp() - INTERVAL 1 HOUR, 'Europe/Amsterdam', 'p1', 'r1', 'v1', NULL,
           '[{"data":{"temperature":21.5}},{"data":{"temperature":22}}]'),
          ('e1', 2L, 'd1', 'c1', 'u1', current_timestamp() - INTERVAL 2 HOURS, 'Europe/Amsterdam', 'p1', 'r1', 'v1', false,
           '[{"set":[{"par":150,"temperature":19.25},{"par":160}]}]'),
          ('e1', 3L, 'd1', 'c1', 'u1', current_timestamp() - INTERVAL 25 HOURS, 'Europe/Amsterdam', 'p1', 'r1', 'v1', NULL,
           '[{"data":{"humidity":55.5,"pressure":1013.25}}]'),
          ('e1', 4L, 'd1', 'c1', 'u2', current_timestamp() - INTERVAL 2 DAYS, 'America/Los_Angeles', 'p2', 'r2', 'v1', NULL,
           '[{"data":{"thickness":0.42},"set":[{"light_intensity":800}]}]'),
          ('e1', 5L, 'd2', 'c2', 'u2', current_timestamp() - INTERVAL 5 DAYS, NULL, NULL, 'r2', NULL, true,
           '[{"data":{"par":"95"}}]'),
          ('e1', 6L, 'd2', 'c2', NULL, current_timestamp() - INTERVAL 10 DAYS, 'UTC', 'p2', NULL, NULL, true,
           '{"no":"samples"}'),
          ('e2', 7L, 'd3', 'c3', 'u3', current_timestamp() - INTERVAL 40 DAYS, 'America/Los_Angeles', 'p1', NULL, NULL, NULL,
           '[{"data":{"temperature":30}}]'),
          ('e2', 8L, 'd3', 'c3', 'u3', current_timestamp() - INTERVAL 100 DAYS, 'Asia/Kolkata', NULL, NULL, NULL, NULL,
           '[{"data":{"temperature":99}}]'),
          -- A logger, which names no contributor, and a device without a client, in the same minute.
          ('e2', 9L, 'd1', 'c1', NULL, current_timestamp() - INTERVAL 3 HOURS, 'Asia/Kolkata', NULL, NULL, NULL, NULL, '[]'),
          ('e3', 10L, 'd4', NULL, 'u1', current_timestamp() - INTERVAL 3 HOURS, 'Europe/Amsterdam', NULL, NULL, NULL, NULL,
           '[{"data":{"par":"dim"}}]'),
          -- An unset clock and one in the future, which no figure counts.
          ('e1', 11L, 'd1', 'c1', 'u1', TIMESTAMP'1970-01-02 00:00:00', 'UTC', 'p1', 'r1', 'v1', NULL,
           '[{"data":{"par":1}}]'),
          ('e1', 12L, 'd2', 'c2', 'u2', current_timestamp() + INTERVAL 2 DAYS, 'UTC', 'p1', NULL, NULL, NULL,
           '[{"data":{"par":2}}]')
        AS t(experiment_id, id, device_id, client_id, user_id, timestamp, timezone, protocol_id, workbook_run_id,
             workbook_version_id, skip_macro_processing, sample)
    """,
    "experiment_macro_data": """
        SELECT experiment_id, id, raw_id, macro_id, timestamp, to_date(timestamp) AS date,
               parse_json(output) AS macro_output
        FROM VALUES
          ('e1', 21L, 1L, 'm1', current_timestamp() - INTERVAL 1 HOUR, '{"Phi2":0.7,"SPAD":41.2}'),
          ('e1', 22L, 2L, 'm1', current_timestamp() - INTERVAL 2 HOURS, '{"Phi2":0.65}'),
          ('e1', 23L, 3L, 'm1', current_timestamp() - INTERVAL 1 DAY, '{"Phi2":"0.6"}'),
          ('e1', 24L, 4L, 'm2', current_timestamp() - INTERVAL 2 DAYS, '{"LEF":"abc","Phi2":true}'),
          ('e1', 25L, 5L, 'm2', current_timestamp() - INTERVAL 3 DAYS, '{"Phi2":" 0.55 "}'),
          ('e2', 26L, 7L, 'm2', current_timestamp() - INTERVAL 40 DAYS, '[0.7]'),
          ('e2', 27L, 8L, NULL, current_timestamp() - INTERVAL 50 DAYS, '{"LEF":120}'),
          ('e2', 28L, 8L, 'm1', current_timestamp() - INTERVAL 100 DAYS, '{"Phi2":0.1}'),
          ('e1', 29L, 11L, 'm1', TIMESTAMP'1970-01-02 00:00:00', '{"Phi2":0.9}')
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

# The registry the backend will read the families from, as experiment_devices holds it.
_REGISTRY = {"c1": "multispeq", "c2": "ambit"}

_COMMIT = "'insert' AS _change_type, 1L AS _commit_version, current_timestamp() AS _commit_timestamp"

_GOLD_MEASUREMENTS = f"""
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
      try_parse_json(sample) AS data, CAST(NULL AS VARIANT) AS output_data,
      timestamp AS processed_timestamp, CAST(NULL AS TIMESTAMP) AS arrival_timestamp, skip_macro_processing,
      {_COMMIT}
    FROM {_SCHEMA}.clean_data
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
      {_COMMIT}
    FROM {_SCHEMA}.experiment_macro_data
"""

_GOLD_UPLOADS = f"""
    SELECT
      experiment_id, id, upload_table_id, 'Soil' AS upload_table_name, 'up1' AS upload_id,
      'u1' AS created_by, uploaded_at, parse_json('{{"ph":6.5}}') AS uploaded_data,
      {_COMMIT}
    FROM {_SCHEMA}.experiment_uploaded_data
"""


class _Store:
    """One user's view of a real store."""

    def __init__(self, url: str, user: str, password: str):
        self.url = url
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


def _granted_views() -> list[str]:
    """The metrics user's views as infrastructure/modules/serving-store/main.tf grants them."""
    listing = re.search(r"metrics_views = \[(.*?)\]", _MAIN_TF.read_text(), re.DOTALL)
    assert listing is not None
    return re.findall(r'"(\w+)"', listing[1])


@pytest.fixture(scope="module")
def tables(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[None]:
    """Silver's and gold's rows, in a session that runs in UTC as Databricks sessions do."""
    spark.conf.set("spark.sql.session.timeZone", "UTC")
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_SCHEMA} LOCATION '{tmp_path_factory.mktemp('parity')}'")
    for name, query in _TABLES.items():
        spark.sql(f"CREATE TABLE {_SCHEMA}.{name} USING parquet AS {query}")

    yield

    spark.sql(f"DROP DATABASE {_SCHEMA} CASCADE")
    spark.conf.unset("spark.sql.session.timeZone")


@pytest.fixture(scope="module")
def store(spark: SparkSession, tables: None, store_migrations: list[str]) -> Iterator[_Store]:
    """The same rows sent through the feed, every view refreshed, and the metrics user granted the
    views as the store's users.xml grants them."""
    url = os.environ.get("CLICKHOUSE_TEST_URL")
    if not url:
        pytest.skip("CLICKHOUSE_TEST_URL is not set")
    user, password = os.environ["CLICKHOUSE_TEST_USER"], os.environ["CLICKHOUSE_TEST_PASSWORD"]
    admin = _Store(url, user, password)
    admin.ok(f"DROP DATABASE IF EXISTS {_DATABASE} SYNC")
    admin.ok(f"DROP USER IF EXISTS {_METRICS_USER}")
    admin.ok(f"CREATE DATABASE {_DATABASE}")
    for statement in store_migrations:
        admin.ok(statement, database=_DATABASE)

    writer = StoreWriter(url, user, password, database=_DATABASE)
    for table, gold in (
        (MEASUREMENTS, _GOLD_MEASUREMENTS),
        (MACRO_RESULTS, _GOLD_MACRO_RESULTS),
        (UPLOADS, _GOLD_UPLOADS),
    ):
        written = writer.write(table.lines(spark.sql(gold)), table.name)
        assert not written.rejected and not written.unfinished

    admin.ok(f"CREATE USER {_METRICS_USER} IDENTIFIED BY 'metrics-test'")
    for view in _granted_views():
        admin.ok(f"SYSTEM REFRESH VIEW {_DATABASE}.{view}")
        admin.ok(f"SYSTEM WAIT VIEW {_DATABASE}.{view}")
        admin.ok(f"GRANT SELECT ON {_DATABASE}.{view} TO {_METRICS_USER}")

    yield _Store(url, _METRICS_USER, "metrics-test")

    admin.ok(f"DROP USER {_METRICS_USER}")
    admin.ok(f"DROP DATABASE {_DATABASE} SYNC")


@pytest.fixture
def pipeline(spark: SparkSession, tables: None, fake_dlt: types.ModuleType, monkeypatch: pytest.MonkeyPatch):
    """Runs one metrics pipeline table's own code over the fixture's tables."""
    runtime = types.ModuleType("openjii.metrics.runtime")
    runtime.SILVER_TABLE = "clean_data"  # type: ignore[attr-defined]
    runtime.centrum_table = lambda name: f"{_SCHEMA}.{name}"  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.metrics.runtime", runtime)

    def run(table: str) -> list[dict]:
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


def test_the_metrics_user_is_granted_every_view_the_migrations_make() -> None:
    made = {
        name
        for migration in _MIGRATIONS.glob("*.sql")
        for name in re.findall(r"CREATE MATERIALIZED VIEW IF NOT EXISTS (metrics_\w+)", migration.read_text())
    }

    assert sorted(_granted_views()) == sorted(made)


def test_every_vetted_parameter_is_counted_under_its_label_from_its_own_field() -> None:
    migration = (_MIGRATIONS / "0011_platform_metrics.sql").read_text()

    counted = {
        name: (label, source)
        for name, label, source in re.findall(r"\('(\w+)', '([^']+)', ([\w.]+)\)", migration)
    }

    assert counted == {
        **{name: (PARAMETER_LABELS[name], f"macro_output.{name}") for name in DERIVED_PARAMETER_ALLOWLIST},
        **{name: (PARAMETER_LABELS[name], f"{name}_readings") for name in SENSOR_PARAMETER_ALLOWLIST},
    }


def test_the_metrics_user_reads_no_rows(store: _Store) -> None:
    for statement in (
        f"SELECT count() FROM {_DATABASE}.measurements",
        f"SELECT count() FROM {_DATABASE}.experiment_measurements(experiment = 'e1')",
    ):
        assert store.run(statement).headers.get("X-ClickHouse-Exception-Code") == "497"


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
        pipeline("hourly_activity"), "hour_local"
    )


def test_activity_windows(pipeline, store: _Store) -> None:
    assert _view(store, "metrics_activity_windows") == pipeline("activity_windows")


def test_parameter_stats(pipeline, store: _Store) -> None:
    assert _sorted(_view(store, "metrics_parameter_stats"), "parameter") == _sorted(
        pipeline("parameter_stats"), "parameter"
    )


def test_pool_facts(pipeline, store: _Store) -> None:
    assert _view(store, "metrics_pool_facts") == pipeline("pool_facts")


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
