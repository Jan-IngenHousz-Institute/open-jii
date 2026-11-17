"""The platform metrics the store counts, against the metrics pipeline's own tables on the same rows:
local Spark runs each table's code, and the rows go through the feed to a real store, as
test_serving_store_tables.py describes. Every figure is equal but for these tolerances:

- A row silver holds twice, or a macro result gold recomputed, counts once in the store.
- Volume is the bytes of each payload's JSON as gold writes it out, not as the device sent it.
- A bare NaN or Infinity token, which gold reads as null, is no reading in the store.
- Medians are exact, where percentile_approx may pick a neighbouring value beyond 10,000 values.
- Zones are gold's, so a zone Spark rejects counts as none, where the pipeline counts it.
- Family totals are per client, and the backend names each client's family from the registry.
"""

from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
import time
import types
from collections.abc import Iterator
from itertools import pairwise
from pathlib import Path

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
_METRICS_USER = "metrics_test_reader"
_PASSWORD = "metrics-test"
_SCHEMA = "spark_catalog.metrics_store_parity"

_NOTEBOOKS = Path(__file__).parents[2] / "src/pipelines/metrics"
_MODULE = Path(__file__).parents[4] / "infrastructure/modules/serving-store"
_MIGRATIONS = Path(__file__).parents[4] / "packages/database/clickhouse/migrations"

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


def _local_list(name: str) -> list[str]:
    """A list of names from the serving store module's locals."""
    listing = re.search(rf"\n  {name} = \[(.*?)\]", (_MODULE / "main.tf").read_text(), re.DOTALL)
    assert listing is not None
    return re.findall(r'"(\w+)"', listing[1])


def _role_grants(role: str) -> list[str]:
    """A store user's grants as the serving store module writes them into users.xml, in order."""
    users = re.search(rf"\n    {role} = \{{(.*?)\n    \}}", (_MODULE / "main.tf").read_text(), re.DOTALL)
    assert users is not None
    grants = []
    for match in re.finditer(
        r'\[for (\w+) in local\.(\w+) : "([^"]+)"\]|"((?:GRANT|REVOKE) [^"]+)"', users[1]
    ):
        name, listing, template, plain = match.groups()
        grants += (
            [plain] if plain else [template.replace(f"${{{name}}}", value) for value in _local_list(listing)]
        )
    return grants


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
def admin(store_migrations: list[str]) -> Iterator[_Store]:
    """A database holding the migrations, whose views have all refreshed once, empty."""
    url = os.environ.get("CLICKHOUSE_TEST_URL")
    if not url:
        pytest.skip("CLICKHOUSE_TEST_URL is not set")
    admin = _Store(url, os.environ["CLICKHOUSE_TEST_USER"], os.environ["CLICKHOUSE_TEST_PASSWORD"])
    users = [_METRICS_USER, *(f"{_DATABASE}_{role}" for role in ("writer", "reloader"))]
    for user in users:
        admin.ok(f"DROP USER IF EXISTS {user}")
    admin.ok(f"DROP DATABASE IF EXISTS {_DATABASE} SYNC")
    admin.ok(f"CREATE DATABASE {_DATABASE}")
    for statement in store_migrations:
        admin.ok(statement, database=_DATABASE)

    views = _local_list("metrics_views")
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
        "ORDER BY query_start_time_microseconds"
    )


def _send(writer: StoreWriter, table: StoreTable, changes: DataFrame) -> None:
    written = writer.write(table.lines(changes), table.name)
    assert not written.rejected and not written.unfinished


@pytest.fixture(scope="module")
def store(spark: SparkSession, tables: None, admin: _Store, first_refreshes: list[dict]) -> _Store:
    """The same rows sent through the feed after older copies of two of them, left unmerged, every
    view refreshed, and the metrics user granted the views as the store's users.xml grants them."""
    for table in ("measurements", "macro_results", "uploads"):
        admin.ok(f"SYSTEM STOP MERGES {_DATABASE}.{table}")

    writer = StoreWriter(admin.url, admin.user, admin.password, database=_DATABASE)
    golds = {MEASUREMENTS: _GOLD_MEASUREMENTS, MACRO_RESULTS: _GOLD_MACRO_RESULTS, UPLOADS: _GOLD_UPLOADS}
    for table, (row, columns) in _REPLAYED.items():
        older = {"_commit_version": F.lit(1), **{column: F.expr(value) for column, value in columns.items()}}
        _send(writer, table, spark.sql(golds[table]).where(row).withColumns(older))
    for table, gold in golds.items():
        _send(writer, table, spark.sql(gold))

    admin.ok(f"CREATE USER {_METRICS_USER} IDENTIFIED BY '{_PASSWORD}'")
    for view in _local_list("metrics_views"):
        admin.ok(f"SYSTEM REFRESH VIEW {_DATABASE}.{view}")
        admin.ok(f"SYSTEM WAIT VIEW {_DATABASE}.{view}")
        admin.ok(f"GRANT SELECT ON {_DATABASE}.{view} TO {_METRICS_USER}")

    return _Store(admin.url, _METRICS_USER, _PASSWORD)


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


def test_the_metrics_user_is_granted_every_view_the_migrations_make() -> None:
    made = {
        name
        for migration in _MIGRATIONS.glob("*.sql")
        for name in re.findall(r"CREATE MATERIALIZED VIEW IF NOT EXISTS (metrics_\w+)", migration.read_text())
    }

    assert sorted(_local_list("metrics_views")) == sorted(made)


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


def test_the_views_refresh_one_after_another(admin: _Store, first_refreshes: list[dict]) -> None:
    views = _local_list("metrics_views")
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


@pytest.mark.parametrize("role", ["writer", "reloader"])
def test_neither_feed_user_can_write_a_figure(admin: _Store, role: str) -> None:
    user = f"{_DATABASE}_{role}"
    admin.ok(f"CREATE USER {user} IDENTIFIED BY '{_PASSWORD}'")
    for grant in _role_grants(role):
        target = "TO" if grant.startswith("GRANT") else "FROM"
        admin.ok(f"{grant.replace(' ON store.', f' ON {_DATABASE}.')} {target} {user}")
    as_user = _Store(admin.url, user, _PASSWORD)

    as_user.ok(
        f"INSERT INTO {_DATABASE}.feed_rejects (source_table, code, message, row) VALUES ('{role}', 0, '', '')"
    )
    for view in _local_list("metrics_views"):
        refused = as_user.run(f"INSERT INTO {_DATABASE}.{view} SELECT * FROM {_DATABASE}.{view}")
        assert refused.headers.get("X-ClickHouse-Exception-Code") == "497", view


def test_the_metrics_user_reads_no_rows(store: _Store) -> None:
    for statement in (
        f"SELECT count() FROM {_DATABASE}.measurements",
        f"SELECT count() FROM {_DATABASE}.experiment_measurements(experiment = 'e1')",
    ):
        assert store.run(statement).headers.get("X-ClickHouse-Exception-Code") == "497"


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
    admin.ok(f"SYSTEM WAIT VIEW {database}.metrics_fine")
    admin.ok(f"CREATE USER {monitor} IDENTIFIED BY '{_PASSWORD}'")
    users_xml = (_MODULE / "templates/users.xml.tftpl").read_text()
    for grant in re.findall(r"<query>(GRANT [^<]+)</query>", users_xml.split("<openjii_monitor>")[1]):
        admin.ok(f"{grant.replace(' ON store.', f' ON {database}.')} TO {monitor}")
    statement = query[1].replace("'store'", f"'{database}'")

    [age, failing] = _Store(admin.url, monitor, _PASSWORD).ok(f"{statement} FORMAT TSV").split()
    [since_start] = admin.ok("SELECT intDiv(uptime(), 60) FORMAT TSV").split()
    admin.ok(f"DROP USER {monitor}")
    admin.ok(f"DROP DATABASE {database} SYNC")

    # A view that never refreshed is as old as the server's run.
    assert int(age) in (int(since_start) - 1, int(since_start))
    assert failing == "1"


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
    assert _sorted(_view(store, "metrics_parameter_stats"), "parameter") == _sorted(
        pipeline("parameter_stats"), "parameter"
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
