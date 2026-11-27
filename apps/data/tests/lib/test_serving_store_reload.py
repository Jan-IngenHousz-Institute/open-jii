"""The serving store reload: gold's rows at its latest version go in as inserts at that version, the
store's older rows go after them, and the store's rows are counted against gold's.

The tests marked ``clickhouse`` run the reload against the test store ``pnpm test`` starts.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterable, Iterator
from contextlib import suppress
from datetime import datetime, timezone

import pytest
import requests
from openjii.serving_store import reload as reload_module
from openjii.serving_store import writer as writer_module
from openjii.serving_store.reload import Reloaded, RemovalOverLimit, StoreAheadOfSource, StoreReload
from openjii.serving_store.tables import DEVICE_EVENTS, MEASUREMENTS, SETTLES, UPLOADS, StoreTable
from openjii.serving_store.writer import StoreUnavailable, StoreWriter, Written
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

pytestmark = pytest.mark.spark

_DATABASE = "reload_test"
_RELOADER = "reload_test_reloader"

_COMMITTED_AT = datetime(2026, 11, 3, 9, 0, 1, tzinfo=timezone.utc)

# Gold's uploads at version 7: e1's row 21 changed, 22 held twice, 23 gone and 24 new; e2 unchanged.
_GOLD = """
    SELECT experiment_id, id, 't1' AS upload_table_id, 'Soil' AS upload_table_name, 'up1' AS upload_id,
      'u1' AS created_by, TIMESTAMP'2026-10-19 09:00:00' AS uploaded_at, parse_json(data) AS uploaded_data
    FROM VALUES
      ('e1', 21L, '{"ph": 7.0}'), ('e1', 22L, '{"ph": 6.1}'), ('e1', 22L, '{"ph": 6.1}'),
      ('e1', 24L, '{"ph": 5.9}'), ('e2', 31L, '{"ph": 6.8}')
      AS t(experiment_id, id, data)
"""

# Gold's raw data at version 7: measurement 1 held twice, its macro output recomputed a day after
# it first arrived.
_GOLD_RAW_DATA = """
    SELECT
      'e1' AS experiment_id, 1L AS id, 'd1' AS device_id, 'c1' AS client_id, 'MultispeQ' AS device_name,
      'multispeq' AS device_family, '2' AS device_version, '2.345' AS device_firmware,
      87.5D AS device_battery, 'AA:BB:CC:DD:EE:FF' AS device_address, 'Pixel 8' AS client_model,
      'Google' AS client_manufacturer, 'android' AS client_os, '15' AS client_os_version,
      '1.42.0' AS client_app_version, TIMESTAMP'2026-10-19 10:00:00' AS timestamp,
      'Europe/Amsterdam' AS timezone,
      array(named_struct('id', 'm1', 'name', 'Phi2', 'filename', 'phi2.js')) AS macros,
      parse_json('{"plot": "A1"}') AS questions_data, CAST(NULL AS ARRAY<STRING>) AS annotations,
      'u1' AS user_id, 'p1' AS protocol_id, CAST(NULL AS STRING) AS workbook_run_id,
      CAST(NULL AS STRING) AS workbook_version_id, CAST(NULL AS STRING) AS macro_context,
      52.1D AS latitude, 5.1D AS longitude, parse_json('{"par": 120}') AS data,
      parse_json(output) AS output_data, processed AS processed_timestamp,
      CAST(NULL AS TIMESTAMP) AS arrival_timestamp, CAST(NULL AS BOOLEAN) AS skip_macro_processing
    FROM VALUES {copies}
    AS t(output, processed)
"""
_FIRST_COPY = """('{"phi2": 0.7}', TIMESTAMP'2026-10-19 10:00:03')"""
_RECOMPUTED_COPY = """('{"phi2": 0.8}', TIMESTAMP'2026-10-20 08:00:00')"""

# What the feed sent before, at version 3.
_FED = """
    SELECT experiment_id, id, 't1' AS upload_table_id, 'Soil' AS upload_table_name, 'up1' AS upload_id,
      'u1' AS created_by, TIMESTAMP'2026-10-19 09:00:00' AS uploaded_at, parse_json(data) AS uploaded_data,
      'insert' AS _change_type, 3L AS _commit_version, TIMESTAMP'2026-10-19 09:00:01' AS _commit_timestamp
    FROM VALUES
      ('e1', 21L, '{"ph": 6.5}'), ('e1', 22L, '{"ph": 6.1}'), ('e1', 23L, '{"ph": 6.0}'),
      ('e2', 31L, '{"ph": 6.8}')
      AS t(experiment_id, id, data)
"""


# Silver's firmware and battery, by capture and client.
_NO_SILVER = """
    SELECT * FROM VALUES
      ('e0', TIMESTAMP'2026-10-19 10:00:00', 0L, 'd0', 'c0', '0', 0.0D, TIMESTAMP'2026-10-19 10:00:01')
    AS t(experiment_id, timestamp, id, device_id, client_id, device_version, device_battery,
      processed_timestamp)
    WHERE false
"""


class _SourceAt(StoreReload):
    """A reload whose source table, and silver beside it, are fixtures at one version."""

    def __init__(
        self,
        spark: SparkSession,
        writer: StoreWriter,
        source: str,
        version: int = 7,
        silver: str = _NO_SILVER,
    ):
        super().__init__(spark, writer, "gold")
        self.source = source
        self.version = version
        self.silver = silver

    def latest_version(self, table: StoreTable) -> tuple[int, datetime]:
        return self.version, _COMMITTED_AT

    def source_rows(self, table: StoreTable, version: int) -> DataFrame:
        assert version == self.version
        return self.spark.sql(self.source)

    def beside_source(self, name: str) -> DataFrame:
        assert name == "clean_data"
        return self.spark.sql(self.silver)


class _Writer(StoreWriter):
    """Records what a reload sends and runs, answering with what it is given."""

    def __init__(self, newest: int = 0, written: list[Written] | None = None):
        super().__init__("http://store.test/", _RELOADER, "secret")
        self.newest = newest
        self.results = list(written or [])
        self.lines: list[list[dict]] = []
        self.inserts: list[tuple[str, list[dict]]] = []
        self.statements: list[tuple[str, dict]] = []

    def query(self, statement: str, **parameters: str | int) -> list[dict]:
        self.statements.append((statement, parameters))
        if "AS newest" in statement:
            return [{"newest": str(self.newest)}]
        if "AS stamp" in statement:
            return [{"stamp": "1"}]
        return []

    def write(self, lines: DataFrame, table: str) -> Written:
        sent = [json.loads(row.line) for row in lines.collect()]
        self.lines.append(sent)
        return self.results.pop(0) if self.results else Written(inserted=len(sent))

    def insert(self, table: str, lines: Iterable[str]) -> Written:
        sent = [json.loads(line) for line in lines]
        self.inserts.append((table, sent))
        return Written(inserted=len(sent))


@pytest.fixture(autouse=True)
def no_retry_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(reload_module, "WRITE_RETRY_DELAYS", (0, 0))


@pytest.fixture(autouse=True)
def utc(spark: SparkSession) -> Iterator[None]:
    """Databricks sessions run in UTC, which the fixtures' timestamps assume."""
    spark.conf.set("spark.sql.session.timeZone", "UTC")
    yield
    spark.conf.unset("spark.sql.session.timeZone")


def test_gold_rows_go_in_as_inserts_at_golds_latest_version(spark: SparkSession) -> None:
    writer = _Writer()

    _SourceAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    [sent] = writer.lines
    assert sorted(line["id"] for line in sent) == [21, 22, 24]
    assert {line["_commit_version"] for line in sent} == {7}
    assert {(line["_commit_timestamp"], line["inserted_at"]) for line in sent} == {
        ("2026-11-03 09:00:01.000000", "2026-11-03 09:00:01.000000")
    }


@pytest.mark.parametrize(
    "copies", [(_FIRST_COPY, _RECOMPUTED_COPY), (_RECOMPUTED_COPY, _FIRST_COPY)], ids=["after", "before"]
)
def test_a_key_gold_holds_twice_goes_in_as_the_copy_gold_processed_last(
    spark: SparkSession, copies: tuple[str, str]
) -> None:
    writer = _Writer()
    gold = _GOLD_RAW_DATA.replace("{copies}", ", ".join(copies))

    _SourceAt(spark, writer, gold).reload(MEASUREMENTS, "e1")

    [sent] = writer.lines
    assert [(line["id"], line["output_data"]) for line in sent] == [(1, '{"phi2":0.8}')]


# Silver holds c1's capture twice, c2's capture by another sensor under the same id, and another
# experiment's measurement under that id.
_SILVER_DEVICE_FIELDS = """
    SELECT experiment_id, TIMESTAMP'2026-10-19 10:00:00' AS timestamp, id, device_id, client_id,
      device_version, device_battery, processed AS processed_timestamp
    FROM VALUES
      ('e1', 1L, 'd1', 'c1', '2', 90.0D, TIMESTAMP'2026-10-19 10:00:02'),
      ('e1', 1L, 'd1', 'c1', '2', 90.0D, TIMESTAMP'2026-10-19 10:05:00'),
      ('e1', 1L, 'd2', 'c2', '3', 15.0D, TIMESTAMP'2026-10-19 10:00:02'),
      ('e2', 1L, 'd1', 'c1', '9', 1.0D, TIMESTAMP'2026-10-19 10:00:02')
    AS t(experiment_id, id, device_id, client_id, device_version, device_battery, processed)
"""


@pytest.mark.parametrize(
    ("gold_fields", "expected"),
    [
        (
            "CAST(NULL AS STRING) AS device_version, '2.345' AS device_firmware, CAST(NULL AS DOUBLE)",
            [("c1", "2", "2.345", 90.0), ("c2", "3", "2.345", 15.0)],
        ),
        (
            "'2' AS device_version, '2.345' AS device_firmware, 87.5D",
            [("c1", "2", "2.345", 87.5), ("c2", "2", "2.345", 87.5)],
        ),
    ],
    ids=["gold-has-none", "gold-has-its-own"],
)
def test_a_reload_takes_firmware_and_battery_from_silver_where_gold_has_none(
    spark: SparkSession, gold_fields: str, expected: list[tuple[str, str, str, float]]
) -> None:
    writer = _Writer()
    c1 = _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY).replace(
        "'2' AS device_version, '2.345' AS device_firmware,\n      87.5D", gold_fields
    )
    assert gold_fields in c1
    c2 = c1.replace("'d1' AS device_id, 'c1' AS client_id", "'d2' AS device_id, 'c2' AS client_id")
    assert c2 != c1

    _SourceAt(spark, writer, f"{c1} UNION ALL {c2}", silver=_SILVER_DEVICE_FIELDS).reload(MEASUREMENTS, "e1")

    [sent] = writer.lines
    fields = [
        (line["client_id"], line["device_version"], line["device_firmware"], line["device_battery"])
        for line in sent
    ]
    assert sorted(fields) == expected


# Silver holds c1's capture twice from one batch: one processing time, different fields.
_SILVER_TIED = """
    SELECT experiment_id, TIMESTAMP'2026-10-19 10:00:00' AS timestamp, id, device_id, client_id,
      device_version, device_battery, TIMESTAMP'2026-10-19 10:00:02' AS processed_timestamp
    FROM VALUES {rows} AS t(experiment_id, id, device_id, client_id, device_version, device_battery)
"""
_TIED_ROWS = ("('e1', 1L, 'd1', 'c1', 'one', 43.0D)", "('e1', 1L, 'd1', 'c1', 'two', 82.0D)")


@pytest.mark.parametrize("rows", [_TIED_ROWS, tuple(reversed(_TIED_ROWS))], ids=["in-order", "reversed"])
def test_silver_rows_that_tie_on_processing_time_fill_a_reload_alike_in_any_order(
    spark: SparkSession, rows: tuple[str, str]
) -> None:
    writer = _Writer()
    gold_has_none = "CAST(NULL AS STRING) AS device_version, '2.345' AS device_firmware, CAST(NULL AS DOUBLE)"
    gold = _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY).replace(
        "'2' AS device_version, '2.345' AS device_firmware,\n      87.5D", gold_has_none
    )
    assert gold_has_none in gold
    silver = _SILVER_TIED.replace("{rows}", ", ".join(rows))

    _SourceAt(spark, writer, gold, silver=silver).reload(MEASUREMENTS, "e1")

    [sent] = writer.lines
    assert [(line["device_version"], line["device_battery"]) for line in sent] == [_SILVER_TIE_KEPT]


# Which of the two tied silver rows the fill takes, by the hash of their fields.
_SILVER_TIE_KEPT = ("two", 82.0)


# The deletes of a reloaded table's rows and schemas, apart from the ids pruned after them.
_ROW_DELETES = ("DELETE FROM store.uploads", "DELETE FROM store.payload_schemas")


def test_the_delete_takes_the_experiments_rows_from_before_the_version_after_the_insert(
    spark: SparkSession,
) -> None:
    writer = _Writer()

    _SourceAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    deletes = [(sql, params) for sql, params in writer.statements if sql.startswith(_ROW_DELETES)]
    assert deletes == [
        (
            "DELETE FROM store.uploads WHERE _commit_version < {version:Int64} AND experiment_id = {experiment:String}",
            {"version": 7, "experiment": "e1"},
        ),
        (
            "DELETE FROM store.payload_schemas WHERE _commit_version < {version:Int64} "
            "AND experiment_id = {experiment:String} AND table_type = {table_type:String}",
            {"version": 7, "experiment": "e1", "table_type": "upload"},
        ),
    ]


def test_after_the_delete_ids_no_table_names_are_pruned_for_the_experiment(spark: SparkSession) -> None:
    writer = _Writer()

    _SourceAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    prunes = [(sql, params) for sql, params in writer.statements if sql.startswith("DELETE FROM store.c")]
    scope = " AND experiment_id = {experiment:String}"
    assert prunes == [
        (
            f"DELETE FROM store.contributor_ids WHERE 1{scope}"
            " AND (experiment_id, user_id) NOT IN (SELECT experiment_id, assumeNotNull(user_id)"
            f" FROM store.measurements WHERE user_id IS NOT NULL{scope})"
            " AND (experiment_id, user_id) NOT IN (SELECT experiment_id, assumeNotNull(user_id)"
            f" FROM store.macro_results WHERE user_id IS NOT NULL{scope})"
            " AND (experiment_id, user_id) NOT IN (SELECT experiment_id, assumeNotNull(created_by)"
            f" FROM store.uploads WHERE created_by IS NOT NULL{scope})",
            {"experiment": "e1"},
        ),
        (
            f"DELETE FROM store.client_ids WHERE 1{scope}"
            " AND (experiment_id, client_id) NOT IN (SELECT experiment_id, assumeNotNull(client_id)"
            f" FROM store.measurements WHERE client_id IS NOT NULL{scope})"
            " AND (experiment_id, client_id) NOT IN (SELECT experiment_id, assumeNotNull(client_id)"
            f" FROM store.macro_results WHERE client_id IS NOT NULL{scope})",
            {"experiment": "e1"},
        ),
    ]


def test_the_loads_payload_schemas_go_in_at_the_version(spark: SparkSession) -> None:
    writer = _Writer()

    _SourceAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    assert writer.inserts == [
        (
            "payload_schemas",
            [
                {
                    "experiment_id": "e1",
                    "table_type": "upload",
                    "identifier": "t1",
                    "payload": "uploaded_data",
                    "schema": "OBJECT<ph: DOUBLE>",
                    "_commit_version": 7,
                }
            ],
        )
    ]


def test_a_reload_of_every_experiment_deletes_across_the_table(spark: SparkSession) -> None:
    writer = _Writer()

    _SourceAt(spark, writer, _GOLD).reload(UPLOADS)

    deletes = [(sql, params) for sql, params in writer.statements if sql.startswith(_ROW_DELETES)]
    assert deletes == [
        ("DELETE FROM store.uploads WHERE _commit_version < {version:Int64}", {"version": 7}),
        (
            "DELETE FROM store.payload_schemas WHERE _commit_version < {version:Int64} AND table_type = {table_type:String}",
            {"version": 7, "table_type": "upload"},
        ),
    ]
    assert len(writer.lines[0]) == 4


def test_a_store_ahead_of_gold_is_refused_before_anything_is_written(spark: SparkSession) -> None:
    writer = _Writer(newest=9)

    with pytest.raises(
        StoreAheadOfSource, match=r"holds version 9 .*: empty store\.uploads, store\.payload_schemas first"
    ):
        _SourceAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    assert writer.lines == []
    assert [sql for sql, _ in writer.statements if "AS newest" not in sql] == []


def test_a_load_the_store_could_not_take_is_written_again(spark: SparkSession) -> None:
    writer = _Writer(written=[Written(inserted=2, unfinished=2), Written(inserted=4)])

    reloaded = _SourceAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    assert len(writer.lines) == 2
    assert reloaded.written == Written(inserted=4)


def test_a_load_still_unfinished_after_the_last_attempt_fails_before_deleting(spark: SparkSession) -> None:
    writer = _Writer(written=[Written(unfinished=4)] * 3)

    with pytest.raises(StoreUnavailable, match="4 rows of uploads not sent after 3 attempts"):
        _SourceAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    assert [sql for sql, _ in writer.statements if sql.startswith("DELETE")] == []


class _SchemasOnSecondTry(_Writer):
    """A store that cannot take the first schema insert."""

    def __init__(self) -> None:
        super().__init__()
        self.schema_attempts = 0

    def insert(self, table: str, lines: Iterable[str]) -> Written:
        self.schema_attempts += 1
        sent = list(lines)
        return Written(unfinished=len(sent)) if self.schema_attempts == 1 else super().insert(table, sent)


def test_schemas_the_store_could_not_take_are_sent_again_before_the_delete(spark: SparkSession) -> None:
    writer = _SchemasOnSecondTry()

    _SourceAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    assert writer.schema_attempts == 2
    assert [table for table, _ in writer.inserts] == ["payload_schemas"]
    assert len([sql for sql, _ in writer.statements if sql.startswith(_ROW_DELETES)]) == 2


def test_a_load_the_store_refused_rows_of_deletes_nothing(spark: SparkSession) -> None:
    writer = _Writer(written=[Written(inserted=3, rejected=1)])

    reloaded = _SourceAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    assert reloaded.written.rejected == 1
    assert [sql for sql, _ in writer.statements if sql.startswith("DELETE")] == []


class _SchemasRefused(_Writer):
    """A store that refuses every payload schema the reload sends."""

    def insert(self, table: str, lines: Iterable[str]) -> Written:
        sent = list(lines)
        super().insert(table, sent)
        return Written(rejected=len(sent))


def test_a_load_whose_schemas_the_store_refused_keeps_the_older_schemas(spark: SparkSession) -> None:
    writer = _SchemasRefused()

    reloaded = _SourceAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    assert reloaded.schemas.rejected == 1
    deletes = [sql for sql, _ in writer.statements if sql.startswith(_ROW_DELETES)]
    assert [sql.split(" WHERE")[0] for sql in deletes] == ["DELETE FROM store.uploads"]


def test_missing_counts_the_experiments_short_of_gold() -> None:
    reloaded = Reloaded(
        "uploads",
        7,
        Written(inserted=9),
        Written(inserted=1),
        source={"e1": 5, "e2": 4},
        store={"e1": 3, "e2": 6},
        newer={"e2": 2},
        older={},
    )

    assert (reloaded.short, reloaded.missing) == ({"e1": 2}, 2)


class _StoreHolding(_Writer):
    """A store that counts ``stored`` rows per experiment at the reload's version after its load."""

    def __init__(self, stored: dict[str, int], written: list[Written] | None = None):
        super().__init__(written=written)
        self.stored = stored

    def query(self, statement: str, **parameters: str | int) -> list[dict]:
        answer = super().query(statement, **parameters)
        if "AS current" in statement:
            return [
                {"experiment_id": scope, "current": str(rows), "newer": "0", "older": "0"}
                for scope, rows in self.stored.items()
            ]
        return answer


def _completions(writer: _Writer) -> list[dict]:
    return [parameters for statement, parameters in writer.statements if "completed_reloads" in statement]


def test_a_reload_of_every_experiment_that_passed_records_itself(spark: SparkSession) -> None:
    writer = _StoreHolding({"e1": 1})

    _SourceAt(spark, writer, _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY)).reload(MEASUREMENTS)

    assert _completions(writer) == [{"table": "measurements", "version": 7}]


@pytest.mark.parametrize(
    ("stored", "written", "experiment"),
    [
        ({"e1": 1}, [Written(rejected=1)], None),
        ({}, [], None),
        ({"e1": 1}, [Written(unfinished=1)] * 3, None),
        ({"e1": 1}, [], "e1"),
    ],
    ids=["refused", "short", "never-all-sent", "one-experiment"],
)
def test_a_reload_that_failed_its_checks_or_named_one_experiment_records_nothing(
    spark: SparkSession, stored: dict[str, int], written: list[Written], experiment: str | None
) -> None:
    writer = _StoreHolding(stored, written)

    with suppress(StoreUnavailable):
        _SourceAt(spark, writer, _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY)).reload(
            MEASUREMENTS, experiment
        )

    assert _completions(writer) == []


def test_a_reload_of_every_device_that_found_no_events_records_itself(spark: SparkSession) -> None:
    writer = _Writer()

    _SourceAt(spark, writer, f"{_SILVER_EVENTS} WHERE false").reload(DEVICE_EVENTS)

    assert writer.lines == [[]]
    assert _completions(writer) == [{"table": "device_events", "version": 7}]


class _Admin:
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
        text = self.run(f"{sql} FORMAT JSONEachRow")
        return [json.loads(line) for line in text.splitlines()]


@pytest.fixture
def store(store_admin: tuple[str, str, str], store_migrations: list[str], store_module) -> Iterator[_Admin]:
    store = _Admin(*store_admin)
    store.run(f"DROP DATABASE IF EXISTS {_DATABASE} SYNC")
    store.run(f"DROP USER IF EXISTS {_RELOADER}")
    store.run(f"CREATE DATABASE {_DATABASE}")
    for statement in store_migrations:
        store.run(statement, database=_DATABASE)
    # The migration runner's ledger, in no particular shape.
    store.run(f"CREATE TABLE {_DATABASE}._migrations (version String) ENGINE = MergeTree ORDER BY version")
    store.run(
        f"CREATE USER {_RELOADER} IDENTIFIED BY 'reload-test' SETTINGS json_type_escape_dots_in_keys = 1"
    )
    for grant in store_module.grants("reloader"):
        store.run(f"{grant.replace(' ON store.', f' ON {_DATABASE}.')} TO {_RELOADER}")

    yield store

    store.run(f"DROP USER {_RELOADER}")
    store.run(f"DROP DATABASE {_DATABASE} SYNC")


@pytest.fixture
def reloader(store: _Admin) -> StoreWriter:
    return StoreWriter(store.url, _RELOADER, "reload-test", database=_DATABASE)


def _uploads(store: _Admin) -> list[tuple[str, int, float, int]]:
    rows = store.rows(
        f"SELECT experiment_id, id, uploaded_data.ph AS ph, _commit_version FROM {_DATABASE}.uploads FINAL "
        "ORDER BY experiment_id, id"
    )
    return [
        (row["experiment_id"], int(row["id"]), float(row["ph"]), int(row["_commit_version"])) for row in rows
    ]


@pytest.mark.clickhouse
def test_reloading_an_experiment_leaves_its_rows_as_gold_holds_them(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    reloader.write(UPLOADS.lines(spark.sql(_FED)), "uploads")

    reloaded = _SourceAt(spark, reloader, _GOLD).reload(UPLOADS, "e1")

    assert _uploads(store) == [
        ("e1", 21, 7.0, 7),
        ("e1", 22, 6.1, 7),
        ("e1", 24, 5.9, 7),
        ("e2", 31, 6.8, 3),
    ]
    # Gold's copy of 22 is one row in the store, so gold's rows are counted once per key.
    assert (reloaded.source, reloaded.store, reloaded.missing) == ({"e1": 3}, {"e1": 3}, 0)
    assert (reloaded.newer, reloaded.older) == ({}, {})
    assert store.rows(f"SELECT count() AS older FROM {_DATABASE}.uploads WHERE _commit_version < 7")[0] == {
        "older": 1
    }
    # A reload writes each row's text as Spark writes gold's payload, which pages show: 7.0 parsed
    # as a decimal and written whole.
    assert store.rows(
        f"SELECT id, uploaded_data_text AS text FROM {_DATABASE}.uploads FINAL "
        "WHERE experiment_id = 'e1' ORDER BY id"
    ) == [{"id": 21, "text": '{"ph":7}'}, {"id": 22, "text": '{"ph":6.1}'}, {"id": 24, "text": '{"ph":5.9}'}]


class _FeedCatchingUp(_SourceAt):
    """A reload during which the feed, still behind, sends a commit from before the version."""

    def __init__(self, spark: SparkSession, writer: StoreWriter, source: str, late: str):
        super().__init__(spark, writer, source)
        self.late = late

    def _delete_older(
        self, store_table: str, version: int, experiment_id: str | None, **matches: str
    ) -> None:
        super()._delete_older(store_table, version, experiment_id, **matches)
        if store_table == UPLOADS.name:
            self.writer.write(UPLOADS.lines(self.spark.sql(self.late)), UPLOADS.name)


class _CopyChangedAfterRetirement(_SourceAt):
    """A reload during which ``late`` statements change the copy by device once its older rows are
    retired, as a settle its writer had given up on would when it lands."""

    def __init__(self, spark: SparkSession, writer: StoreWriter, source: str, late: list[str]):
        super().__init__(spark, writer, source)
        self.late = late

    def _delete_older(
        self, store_table: str, version: int, experiment_id: str | None, **matches: str
    ) -> None:
        super()._delete_older(store_table, version, experiment_id, **matches)
        if store_table == "measurements_by_device":
            for statement in self.late:
                self.writer.query(statement.format(database=self.writer.database))


# A settle row of d1's capture, stamped 1, long before any reload's stamp, as one that started
# before the reload.
_LATE_SETTLE = (
    "INSERT INTO {database}.measurements_by_device "
    "(client_id, timestamp, id, experiment_id, device_id, _commit_version, _settle_version) "
    "VALUES ('{client}', '2026-10-19 10:00:00', {id}, 'e1', 'd1', 3, 1)"
)


@pytest.mark.clickhouse
def test_a_late_settle_of_a_capture_the_reload_never_held_fails_the_reload(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    gold = _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY)
    late = [_LATE_SETTLE.replace("{client}", "c9").replace("{id}", "99")]

    passing = _SourceAt(spark, reloader, gold).reload(MEASUREMENTS, "e1")
    landed = _CopyChangedAfterRetirement(spark, reloader, gold, late).reload(MEASUREMENTS, "e1")

    assert (passing.unmatched_copies, passing.passed) == ({}, True)
    assert (landed.unmatched_copies, landed.passed) == ({"e1": 1}, False)


@pytest.mark.clickhouse
def test_a_late_settle_of_a_capture_the_reload_removed_stays_retired(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    fed = spark.sql(_GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY)).withColumns(
        {
            "_change_type": F.lit("insert"),
            "_commit_version": F.lit(3).cast("long"),
            "_commit_timestamp": F.lit(_COMMITTED_AT),
        }
    )
    gone = fed.withColumn("id", F.lit(2).cast("long"))
    reloader.write(MEASUREMENTS.lines(fed.unionByName(gone)), MEASUREMENTS.name)
    late = [_LATE_SETTLE.replace("{client}", "c1").replace("{id}", "2")]

    reloaded = _CopyChangedAfterRetirement(
        spark, reloader, _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY), late
    ).reload(MEASUREMENTS, "e1")

    device = store.rows(
        f"SELECT client_id, id FROM {_DATABASE}.measurements_by_device FINAL WHERE experiment_id = 'e1'"
    )
    assert device == [{"client_id": "c1", "id": 1}]
    assert (reloaded.unmatched_copies, reloaded.passed) == ({}, True)


@pytest.mark.clickhouse
def _fed_capture(spark: SparkSession, client: str, version: int) -> DataFrame:
    """Capture 2 of the gold fixture, through ``client`` at ``version``, as the feed reads it."""
    return spark.sql(_GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY)).withColumns(
        {
            "id": F.lit(2).cast("long"),
            "client_id": F.lit(client),
            "_change_type": F.lit("insert"),
            "_commit_version": F.lit(version).cast("long"),
            "_commit_timestamp": F.lit(_COMMITTED_AT),
        }
    )


@pytest.mark.clickhouse
def test_a_late_settle_of_an_owner_another_client_had_replaced_stays_retired(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    # c1 sent capture 2 at v3, then c2 sent it again at v4 and replaced c1's copy.
    reloader.write(MEASUREMENTS.lines(_fed_capture(spark, "c1", 3)), MEASUREMENTS.name)
    reloader.write(MEASUREMENTS.lines(_fed_capture(spark, "c2", 4)), MEASUREMENTS.name)
    # c1's settle from before c2's copy, which stalled, lands after the reload removed capture 2.
    late = [_LATE_SETTLE.replace("{client}", "c1").replace("{id}", "2")]

    reloaded = _CopyChangedAfterRetirement(
        spark, reloader, _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY), late
    ).reload(MEASUREMENTS, "e1")

    device = store.rows(
        f"SELECT client_id, id FROM {_DATABASE}.measurements_by_device FINAL WHERE experiment_id = 'e1'"
    )
    assert device == [{"client_id": "c1", "id": 1}]
    assert (reloaded.unmatched_copies, reloaded.passed) == ({}, True)


@pytest.mark.clickhouse
def test_an_earlier_reloads_mark_goes_with_the_next_reload_rather_than_being_marked_again(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    # A capture an earlier reload removed, at that reload's version 3, stamped long before any settle
    # still in flight.
    store.run(
        f"INSERT INTO {_DATABASE}.measurements_by_device "
        "(client_id, timestamp, id, experiment_id, device_id, _commit_version, is_replaced, _settle_version) "
        "VALUES ('c1', '2026-10-19 10:00:00', 5, 'e1', 'd1', 3, 1, 1)"
    )

    reloaded = _SourceAt(spark, reloader, _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY)).reload(
        MEASUREMENTS, "e1"
    )

    left = store.rows(
        f"SELECT id FROM {_DATABASE}.measurements_by_device WHERE experiment_id = 'e1' AND id = 5"
    )
    assert left == []
    assert reloaded.passed


class _FeedAddingAgainDuringRetirement(_SourceAt):
    """A reload during which the feed sends capture 2 again above the version: it reads its
    settle's stamp and its rows land before the reload retires the older rows, after ``merge`` runs,
    and its settle lands after."""

    def __init__(
        self,
        spark: SparkSession,
        writer: StoreWriter,
        source: str,
        again: DataFrame,
        merge: Callable[[], object],
    ):
        super().__init__(spark, writer, source)
        self.again = [row.line for row in MEASUREMENTS.lines(again).collect()]
        self.merge = merge

    def _retire_older(self, copy: str, version: int, experiment_id: str | None) -> None:
        [stamp] = self.writer.query("SELECT toUnixTimestamp64Nano(now64(9)) AS stamp FORMAT JSONEachRow")
        settles = writer_module.SETTLES
        writer_module.SETTLES = {}
        try:
            assert self.writer.insert(MEASUREMENTS.name, self.again).inserted == len(self.again)
        finally:
            writer_module.SETTLES = settles
        self.merge()
        super()._retire_older(copy, version, experiment_id)
        settle = SETTLES[MEASUREMENTS.name]
        self.writer._post(
            {
                "query": settle.statement.format(database=self.writer.database),
                "param_stamp": stamp["stamp"],
                "chunk_structure": settle.structure,
                "chunk_format": "JSONEachRow",
                "input_format_skip_unknown_fields": "1",
                "insert_deduplicate": "0",
            },
            timeout=writer_module.INSERT_TIMEOUT,
            files={"chunk": ("chunk", "\n".join(self.again).encode())},
        )


@pytest.mark.clickhouse
@pytest.mark.parametrize("merged", [False, True], ids=["unmerged", "merged-before-the-retirement"])
def test_a_capture_the_feed_adds_again_above_the_version_during_a_reload_stays_on_the_device_copy(
    spark: SparkSession, store: _Admin, reloader: StoreWriter, merged: bool
) -> None:
    reloader.write(MEASUREMENTS.lines(_fed_capture(spark, "c1", 3)), MEASUREMENTS.name)

    def merge() -> object:
        # A merge folds the capture's older settled row and the newly added one into one.
        return store.run(f"OPTIMIZE TABLE {_DATABASE}.measurements_by_device FINAL") if merged else None

    reloaded = _FeedAddingAgainDuringRetirement(
        spark,
        reloader,
        _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY),
        _fed_capture(spark, "c1", 8),
        merge,
    ).reload(MEASUREMENTS, "e1")

    kept = store.rows(
        f"SELECT client_id, id, _commit_version FROM {_DATABASE}.measurements FINAL "
        "WHERE experiment_id = 'e1' ORDER BY id"
    )
    device = store.rows(
        f"SELECT client_id, id, _commit_version FROM {_DATABASE}.measurements_by_device FINAL "
        "WHERE experiment_id = 'e1' ORDER BY id"
    )
    assert kept == [
        {"client_id": "c1", "id": 1, "_commit_version": 7},
        {"client_id": "c1", "id": 2, "_commit_version": 8},
    ]
    assert device == kept
    assert reloaded.passed


@pytest.mark.clickhouse
def test_a_device_copy_missing_one_capture_and_holding_another_fails_the_reload(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    late = [
        "DELETE FROM {database}.measurements_by_device WHERE experiment_id = 'e1' AND id = 1",
        _LATE_SETTLE.replace("{client}", "c9")
        .replace("{id}", "99")
        .replace(", 1)", ", 9223372036854775807)"),
    ]

    reloaded = _CopyChangedAfterRetirement(
        spark, reloader, _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY), late
    ).reload(MEASUREMENTS, "e1")

    # As many rows on both sides, but not the same captures.
    assert (reloaded.unmatched_copies, reloaded.passed) == ({"e1": 0}, False)


@pytest.mark.clickhouse
def test_a_row_the_feed_sends_from_before_the_version_after_the_delete_is_reported(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    removed = f"SELECT * FROM ({_FED}) WHERE id = 23"

    reloaded = _FeedCatchingUp(spark, reloader, _GOLD, late=removed).reload(UPLOADS, "e1")

    assert reloaded.older == {"e1": 1}
    assert reloaded.missing == 0


@pytest.mark.clickhouse
def test_feed_rows_written_since_the_version_are_counted_apart(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    arrived = """
        SELECT 'e1' AS experiment_id, 25L AS id, 't1' AS upload_table_id, 'Soil' AS upload_table_name,
          'up1' AS upload_id, 'u1' AS created_by, TIMESTAMP'2026-10-19 09:00:00' AS uploaded_at,
          parse_json('{"ph": 6.3}') AS uploaded_data, 'insert' AS _change_type, 9L AS _commit_version,
          TIMESTAMP'2026-11-03 09:10:00' AS _commit_timestamp
    """

    reloaded = _FeedCatchingUp(spark, reloader, _GOLD, late=arrived).reload(UPLOADS, "e1")

    assert (reloaded.source, reloaded.store, reloaded.newer) == ({"e1": 3}, {"e1": 4}, {"e1": 1})
    assert (reloaded.missing, reloaded.older) == (0, {})


@pytest.mark.clickhouse
def test_reloading_an_experiment_gold_no_longer_holds_removes_it(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    reloader.write(UPLOADS.lines(spark.sql(_FED)), "uploads")
    gold_without_e2 = f"SELECT * FROM ({_GOLD}) WHERE experiment_id != 'e2'"

    reloaded = _SourceAt(spark, reloader, gold_without_e2).reload(UPLOADS, "e2")

    assert [row for row in _uploads(store) if row[0] == "e2"] == []
    assert [row[1] for row in _uploads(store)] == [21, 22, 23]
    assert (reloaded.source, reloaded.store) == ({}, {})


@pytest.mark.clickhouse
def test_a_delete_past_the_removal_limit_stops_before_deleting(
    spark: SparkSession, store: _Admin, reloader: StoreWriter, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(reload_module, "REMOVAL_LIMIT", 0)
    reloader.write(UPLOADS.lines(spark.sql(_FED)), "uploads")
    before = [row for row in _uploads(store) if row[0] == "e2"]
    gold_without_e2 = f"SELECT * FROM ({_GOLD}) WHERE experiment_id != 'e2'"

    with pytest.raises(RemovalOverLimit, match=r"e2 \(\d+\)"):
        _SourceAt(spark, reloader, gold_without_e2).reload(UPLOADS, "e2")

    assert before
    assert [row for row in _uploads(store) if row[0] == "e2"] == before


@pytest.mark.clickhouse
def test_a_delete_past_the_removal_limit_goes_ahead_when_allowed(
    spark: SparkSession, store: _Admin, reloader: StoreWriter, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(reload_module, "REMOVAL_LIMIT", 0)
    reloader.write(UPLOADS.lines(spark.sql(_FED)), "uploads")
    gold_without_e2 = f"SELECT * FROM ({_GOLD}) WHERE experiment_id != 'e2'"

    _SourceAt(spark, reloader, gold_without_e2).reload(UPLOADS, "e2", allow_removal=True)

    assert [row for row in _uploads(store) if row[0] == "e2"] == []


@pytest.mark.clickhouse
def test_rows_gold_sends_again_do_not_count_against_the_removal_limit(
    spark: SparkSession, store: _Admin, reloader: StoreWriter, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(reload_module, "REMOVAL_LIMIT", 0)
    reloader.write(UPLOADS.lines(spark.sql(_FED)), "uploads")

    reloaded = _SourceAt(spark, reloader, _GOLD).reload(UPLOADS, "e2")

    assert reloaded.store == reloaded.source


@pytest.mark.clickhouse
def test_a_reload_removes_the_ids_no_row_names_any_longer(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    reloader.write(UPLOADS.lines(spark.sql(_FED)), "uploads")
    contributors = (
        f"SELECT experiment_id, user_id FROM {_DATABASE}.contributor_ids FINAL ORDER BY experiment_id"
    )
    assert [row["experiment_id"] for row in store.rows(contributors)] == ["e1", "e2"]
    gold_without_e2 = f"SELECT * FROM ({_GOLD}) WHERE experiment_id != 'e2'"

    _SourceAt(spark, reloader, gold_without_e2).reload(UPLOADS, "e2")

    assert store.rows(contributors) == [{"experiment_id": "e1", "user_id": "u1"}]


@pytest.mark.clickhouse
def test_a_new_store_takes_every_experiment_and_a_second_run_changes_nothing(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    first = _SourceAt(spark, reloader, _GOLD).reload(UPLOADS)
    second = _SourceAt(spark, reloader, _GOLD).reload(UPLOADS)

    assert first.source == first.store == second.store == {"e1": 3, "e2": 1}
    assert store.rows(f"SELECT count() AS rows FROM {_DATABASE}.uploads") == [{"rows": 4}]
    assert [row[1] for row in _uploads(store)] == [21, 22, 24, 31]


@pytest.mark.clickhouse
def test_reloaded_rows_stay_out_of_the_feeds_delivery_window(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    _SourceAt(spark, reloader, _GOLD).reload(UPLOADS)

    assert store.rows(
        f"SELECT countIf(inserted_at > now64(6) - INTERVAL 5 MINUTE) AS recent, "
        f"countIf(inserted_at = _commit_timestamp) AS at_commit FROM {_DATABASE}.uploads"
    ) == [{"recent": 0, "at_commit": 4}]


@pytest.mark.clickhouse
def test_the_reloader_deletes_only_from_the_tables_it_reloads_and_rewrites_no_values(
    reloader: StoreWriter,
) -> None:
    for statement in (
        f"TRUNCATE TABLE {_DATABASE}.uploads",
        f"ALTER TABLE {_DATABASE}.uploads UPDATE upload_table_name = 'x' WHERE 1",
        f"ALTER TABLE {_DATABASE}.feed_rejects DELETE WHERE 1",
        f"DELETE FROM {_DATABASE}.feed_rejects WHERE 1",
        f"DELETE FROM {_DATABASE}.completed_reloads WHERE 1",
        f"ALTER TABLE {_DATABASE}.completed_reloads DELETE WHERE 1",
        f"DELETE FROM {_DATABASE}._migrations WHERE 1",
        f"INSERT INTO {_DATABASE}._migrations VALUES ('9999')",
    ):
        with pytest.raises(StoreUnavailable, match="code 497"):
            reloader.query(statement)


@pytest.mark.clickhouse
def test_schemas_from_a_recreated_gold_table_stop_the_reload(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    store.run(
        f"INSERT INTO {_DATABASE}.payload_schemas "
        "VALUES ('e1', 'upload', 't1', 'uploaded_data', 'OBJECT<ph: DOUBLE>', 99)"
    )

    with pytest.raises(StoreAheadOfSource, match="holds version 99"):
        _SourceAt(spark, reloader, _GOLD).reload(UPLOADS, "e1")


# Silver's lifecycle events at version 7: c1's two events and c2's one.
_SILVER_EVENTS = """
    SELECT client_id, event_type, ts AS event_timestamp, session AS session_identifier,
      CAST(NULL AS STRING) AS disconnect_reason, TIMESTAMP'2026-10-19 12:00:00' AS ingestion_timestamp
    FROM VALUES
      ('c1', 'connected', TIMESTAMP'2026-10-19 09:00:00', 's1'),
      ('c1', 'disconnected', TIMESTAMP'2026-10-19 10:00:00', 's1'),
      ('c2', 'connected', TIMESTAMP'2026-10-19 11:00:00', CAST(NULL AS STRING))
      AS t(client_id, event_type, ts, session)
"""


def test_device_events_reload_whole_without_schemas_or_ids_and_count_by_device(spark: SparkSession) -> None:
    writer = _Writer()

    reloaded = _SourceAt(spark, writer, _SILVER_EVENTS).reload(DEVICE_EVENTS)

    [sent] = writer.lines
    assert sorted((line["client_id"], line["event_type"]) for line in sent) == [
        ("c1", "connected"),
        ("c1", "disconnected"),
        ("c2", "connected"),
    ]
    assert writer.inserts == []
    [newest] = [sql for sql, _ in writer.statements if "AS newest" in sql]
    assert newest == (
        "SELECT greatest((SELECT max(_commit_version) FROM store.device_events), 0) AS newest FORMAT JSONEachRow"
    )
    assert [(sql, params) for sql, params in writer.statements if sql.startswith("DELETE")] == [
        ("DELETE FROM store.device_events WHERE _commit_version < {version:Int64}", {"version": 7})
    ]
    assert reloaded.source == {"c1": 2, "c2": 1}


# Two of c2's connects that differ only in a null session and an empty one, which silver keeps apart.
_NULL_AND_EMPTY_SESSIONS = """
    SELECT 'c2' AS client_id, 'connected' AS event_type, TIMESTAMP'2026-10-19 11:00:00' AS event_timestamp,
      session AS session_identifier, CAST(NULL AS STRING) AS disconnect_reason,
      TIMESTAMP'2026-10-19 12:00:00' AS ingestion_timestamp
    FROM VALUES (CAST(NULL AS STRING)), ('') AS t(session)
"""


def test_device_events_apart_only_in_a_null_or_empty_session_reload_as_two(spark: SparkSession) -> None:
    writer = _Writer()

    reloaded = _SourceAt(spark, writer, _NULL_AND_EMPTY_SESSIONS).reload(DEVICE_EVENTS)

    [sent] = writer.lines
    assert len(sent) == 2
    assert {line.get("session_identifier") for line in sent} == {None, ""}
    assert reloaded.source == {"c2": 2}


@pytest.mark.clickhouse
def test_the_store_keeps_device_events_apart_only_in_a_null_or_empty_session(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    reloaded = _SourceAt(spark, reloader, _NULL_AND_EMPTY_SESSIONS).reload(DEVICE_EVENTS)

    assert (reloaded.source, reloaded.store, reloaded.missing) == ({"c2": 2}, {"c2": 2}, 0)


def test_device_events_ahead_of_silver_name_only_their_own_table_to_empty(spark: SparkSession) -> None:
    writer = _Writer(newest=9)

    with pytest.raises(StoreAheadOfSource) as refused:
        _SourceAt(spark, writer, _SILVER_EVENTS).reload(DEVICE_EVENTS)

    assert "empty store.device_events first" in str(refused.value)
    assert "payload" not in str(refused.value)


def test_a_measurements_reload_deletes_the_older_rows_of_its_copy_by_device_too(spark: SparkSession) -> None:
    writer = _Writer()

    _SourceAt(spark, writer, _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY)).reload(MEASUREMENTS, "e1")

    [newest] = [sql for sql, _ in writer.statements if "AS newest" in sql]
    assert "FROM store.measurements_by_device)" in newest
    deletes = [
        (sql, params) for sql, params in writer.statements if sql.startswith("DELETE FROM store.measurements")
    ]
    scope = "WHERE _commit_version < {version:Int64} AND experiment_id = {experiment:String}"
    assert deletes == [
        (f"DELETE FROM store.measurements {scope}", {"version": 7, "experiment": "e1"}),
        (f"DELETE FROM store.measurements_by_device {scope}", {"version": 7, "experiment": "e1"}),
    ]


@pytest.mark.clickhouse
def test_reloading_device_events_leaves_them_as_silver_holds_them(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    fed = spark.sql(
        f"SELECT * FROM ({_SILVER_EVENTS}) WHERE client_id = 'c1' "
        "UNION ALL SELECT 'c3', 'connected', TIMESTAMP'2026-10-19 08:00:00', 's3', NULL, NULL"
    ).withColumns(
        {
            "_change_type": F.lit("insert"),
            "_commit_version": F.lit(3).cast("long"),
            "_commit_timestamp": F.lit(_COMMITTED_AT),
        }
    )
    reloader.write(DEVICE_EVENTS.lines(fed), DEVICE_EVENTS.name)

    reloaded = _SourceAt(spark, reloader, _SILVER_EVENTS).reload(DEVICE_EVENTS)

    assert store.rows(
        f"SELECT client_id, event_type, _commit_version FROM {_DATABASE}.device_events "
        "ORDER BY client_id, event_timestamp"
    ) == [
        {"client_id": "c1", "event_type": "connected", "_commit_version": 7},
        {"client_id": "c1", "event_type": "disconnected", "_commit_version": 7},
        {"client_id": "c2", "event_type": "connected", "_commit_version": 7},
    ]
    assert (reloaded.source, reloaded.store, reloaded.missing) == ({"c1": 2, "c2": 1}, {"c1": 2, "c2": 1}, 0)


@pytest.mark.clickhouse
def test_reloading_measurements_leaves_their_copy_by_device_as_gold_holds_them(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    fed = spark.sql(_GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY)).withColumns(
        {
            "_change_type": F.lit("insert"),
            "_commit_version": F.lit(3).cast("long"),
            "_commit_timestamp": F.lit(_COMMITTED_AT),
        }
    )
    gone = fed.withColumn("id", F.lit(2).cast("long"))
    reloader.write(MEASUREMENTS.lines(fed.unionByName(gone)), MEASUREMENTS.name)

    _SourceAt(spark, reloader, _GOLD_RAW_DATA.replace("{copies}", _RECOMPUTED_COPY)).reload(
        MEASUREMENTS, "e1"
    )

    # Without FINAL, so the older copies show unless the delete took them. The capture gold no longer
    # holds keeps only the mark that retired it, at the version.
    assert store.rows(
        f"SELECT DISTINCT client_id, id, _commit_version, is_replaced FROM {_DATABASE}.measurements_by_device "
        "ORDER BY id"
    ) == [
        {"client_id": "c1", "id": 1, "_commit_version": 7, "is_replaced": 0},
        {"client_id": "c1", "id": 2, "_commit_version": 7, "is_replaced": 1},
    ]


def _device_reads_ready(store: _Admin) -> list[dict]:
    return store.rows(f"SELECT reloaded FROM {_DATABASE}.device_events_reloaded")


@pytest.mark.clickhouse
def test_device_reads_wait_for_both_reloads_and_a_replay_of_device_events_keeps_them_ready(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    _SourceAt(spark, reloader, f"{_SILVER_EVENTS} WHERE false").reload(DEVICE_EVENTS)
    waiting = _device_reads_ready(store)
    _SourceAt(spark, reloader, _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY)).reload(MEASUREMENTS)
    ready = _device_reads_ready(store)

    replayed = spark.sql(_SILVER_EVENTS).withColumns(
        {
            "_change_type": F.lit("insert"),
            "_commit_version": F.lit(9).cast("long"),
            "_commit_timestamp": F.lit(_COMMITTED_AT),
        }
    )
    reloader.write(DEVICE_EVENTS.lines(replayed), DEVICE_EVENTS.name)
    store.run(f"OPTIMIZE TABLE {_DATABASE}.device_events FINAL")

    assert (waiting, ready, _device_reads_ready(store)) == ([], [{"reloaded": 1}], [{"reloaded": 1}])


@pytest.mark.clickhouse
def test_device_reads_wait_after_a_measurements_reload_that_failed(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    store.run(
        f"INSERT INTO {_DATABASE}.measurements (experiment_id, id, timestamp, client_id, _commit_version, "
        "_commit_timestamp) SELECT 'gone', number, toDateTime64('2026-10-19 10:00:00', 6, 'UTC'), 'c1', 3, "
        "toDateTime64('2026-10-19 10:00:01', 6, 'UTC') FROM numbers(1001)"
    )

    with pytest.raises(RemovalOverLimit):
        _SourceAt(spark, reloader, _GOLD_RAW_DATA.replace("{copies}", _FIRST_COPY)).reload(MEASUREMENTS)
    _SourceAt(spark, reloader, _SILVER_EVENTS).reload(DEVICE_EVENTS)

    assert _device_reads_ready(store) == []
