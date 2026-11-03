"""The serving store reload: gold's rows at its latest version go in as inserts at that version, the
store's older rows go after them, and the store's rows are counted against gold's.

The tests marked ``clickhouse`` run the reload against a real store, as described in
test_serving_store_tables.py, and skip without one.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterable, Iterator
from datetime import datetime, timezone

import pytest
import requests
from openjii.serving_store import reload as reload_module
from openjii.serving_store.reload import Reloaded, RemovalOverLimit, StoreAheadOfGold, StoreReload
from openjii.serving_store.tables import UPLOADS, StoreTable
from openjii.serving_store.writer import StoreUnavailable, StoreWriter, Written
from pyspark.sql import DataFrame, SparkSession

pytestmark = pytest.mark.spark

_DATABASE = "reload_test"
_RELOADER = "reload_test_reloader"

_COMMITTED_AT = datetime(2026, 11, 3, 9, 0, 1, tzinfo=timezone.utc)

# Gold's uploads at version 7: e1's row 21 changed, 22 held twice, 23 gone and 24 new; e2 unchanged.
# Each row carries the commit that added it.
_GOLD = """
    SELECT experiment_id, id, 't1' AS upload_table_id, 'Soil' AS upload_table_name, 'up1' AS upload_id,
      'u1' AS created_by, TIMESTAMP'2026-10-19 09:00:00' AS uploaded_at, parse_json(data) AS uploaded_data,
      added AS _row_commit_version
    FROM VALUES
      ('e1', 21L, '{"ph": 7.0}', 6L), ('e1', 22L, '{"ph": 6.1}', 2L), ('e1', 22L, '{"ph": 6.1}', 5L),
      ('e1', 24L, '{"ph": 5.9}', 7L), ('e2', 31L, '{"ph": 6.8}', 1L)
      AS t(experiment_id, id, data, added)
"""

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


class _GoldAt(StoreReload):
    """A reload whose gold is a fixture at one version."""

    def __init__(self, spark: SparkSession, writer: StoreWriter, gold: str, version: int = 7):
        super().__init__(spark, writer, "gold")
        self.gold = gold
        self.version = version

    def latest_version(self, table: StoreTable) -> tuple[int, datetime]:
        return self.version, _COMMITTED_AT

    def gold_rows(self, table: StoreTable, version: int) -> DataFrame:
        assert version == self.version
        return self.spark.sql(self.gold)


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
        if statement.startswith("SELECT max"):
            return [{"newest": str(self.newest)}]
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

    _GoldAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    [sent] = writer.lines
    assert sorted(line["id"] for line in sent) == [21, 22, 24]
    assert {line["_commit_version"] for line in sent} == {7}
    assert {(line["_commit_timestamp"], line["inserted_at"]) for line in sent} == {
        ("2026-11-03 09:00:01.000000", "2026-11-03 09:00:01.000000")
    }


def test_a_key_gold_holds_twice_goes_in_as_its_newest_copy(spark: SparkSession) -> None:
    writer = _Writer()
    recomputed = _GOLD.replace("""('e1', 22L, '{"ph": 6.1}', 5L)""", """('e1', 22L, '{"ph": 6.4}', 5L)""")

    _GoldAt(spark, writer, recomputed).reload(UPLOADS, "e1")

    [sent] = writer.lines
    assert [line["uploaded_data"] for line in sent if line["id"] == 22] == [{"ph": 6.4}]


def test_the_delete_takes_the_experiments_rows_from_before_the_version_after_the_insert(
    spark: SparkSession,
) -> None:
    writer = _Writer()

    _GoldAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    deletes = [(sql, params) for sql, params in writer.statements if sql.startswith("DELETE")]
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


def test_the_loads_payload_schemas_go_in_at_the_version(spark: SparkSession) -> None:
    writer = _Writer()

    _GoldAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

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

    _GoldAt(spark, writer, _GOLD).reload(UPLOADS)

    deletes = [(sql, params) for sql, params in writer.statements if sql.startswith("DELETE")]
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

    with pytest.raises(StoreAheadOfGold, match="holds version 9"):
        _GoldAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    assert writer.lines == []
    assert [sql for sql, _ in writer.statements if not sql.startswith("SELECT max")] == []


def test_a_load_the_store_could_not_take_is_written_again(spark: SparkSession) -> None:
    writer = _Writer(written=[Written(inserted=2, unfinished=2), Written(inserted=4)])

    reloaded = _GoldAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    assert len(writer.lines) == 2
    assert reloaded.written == Written(inserted=4)


def test_a_load_still_unfinished_after_the_last_attempt_fails_before_deleting(spark: SparkSession) -> None:
    writer = _Writer(written=[Written(unfinished=4)] * 3)

    with pytest.raises(StoreUnavailable, match="4 rows of uploads not sent after 3 attempts"):
        _GoldAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    assert [sql for sql, _ in writer.statements if sql.startswith("DELETE")] == []


def test_a_load_the_store_refused_rows_of_deletes_nothing(spark: SparkSession) -> None:
    writer = _Writer(written=[Written(inserted=3, rejected=1)])

    reloaded = _GoldAt(spark, writer, _GOLD).reload(UPLOADS, "e1")

    assert reloaded.written.rejected == 1
    assert [sql for sql, _ in writer.statements if sql.startswith("DELETE")] == []


def test_missing_counts_the_experiments_short_of_gold() -> None:
    reloaded = Reloaded(
        "uploads",
        7,
        Written(inserted=9),
        gold={"e1": 5, "e2": 4},
        store={"e1": 3, "e2": 6},
        newer={"e2": 2},
        older={},
    )

    assert (reloaded.short, reloaded.missing) == ({"e1": 2}, 2)


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
def store(store_migrations: list[str]) -> Iterator[_Admin]:
    url = os.environ.get("CLICKHOUSE_TEST_URL")
    if not url:
        pytest.skip("CLICKHOUSE_TEST_URL is not set")
    store = _Admin(url, os.environ["CLICKHOUSE_TEST_USER"], os.environ["CLICKHOUSE_TEST_PASSWORD"])
    store.run(f"DROP DATABASE IF EXISTS {_DATABASE} SYNC")
    store.run(f"DROP USER IF EXISTS {_RELOADER}")
    store.run(f"CREATE DATABASE {_DATABASE}")
    for statement in store_migrations:
        store.run(statement, database=_DATABASE)
    # The migration runner's ledger, in no particular shape.
    store.run(f"CREATE TABLE {_DATABASE}._migrations (version String) ENGINE = MergeTree ORDER BY version")
    # The reloader's grants in infrastructure/modules/serving-store/main.tf.
    store.run(
        f"CREATE USER {_RELOADER} IDENTIFIED BY 'reload-test' SETTINGS json_type_escape_dots_in_keys = 1"
    )
    store.run(f"GRANT SELECT, INSERT ON {_DATABASE}.* TO {_RELOADER}")
    for table in ("measurements", "macro_results", "uploads", "payload_schemas"):
        store.run(f"GRANT ALTER DELETE, ALTER UPDATE(_row_exists) ON {_DATABASE}.{table} TO {_RELOADER}")
    store.run(f"REVOKE INSERT ON {_DATABASE}._migrations FROM {_RELOADER}")

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

    reloaded = _GoldAt(spark, reloader, _GOLD).reload(UPLOADS, "e1")

    assert _uploads(store) == [
        ("e1", 21, 7.0, 7),
        ("e1", 22, 6.1, 7),
        ("e1", 24, 5.9, 7),
        ("e2", 31, 6.8, 3),
    ]
    # Gold's copy of 22 is one row in the store, so gold's rows are counted once per key.
    assert (reloaded.gold, reloaded.store, reloaded.missing) == ({"e1": 3}, {"e1": 3}, 0)
    assert (reloaded.newer, reloaded.older) == ({}, {})
    assert store.rows(f"SELECT count() AS older FROM {_DATABASE}.uploads WHERE _commit_version < 7")[0] == {
        "older": 1
    }


class _FeedCatchingUp(_GoldAt):
    """A reload during which the feed, still behind, sends a commit from before the version."""

    def __init__(self, spark: SparkSession, writer: StoreWriter, gold: str, late: str):
        super().__init__(spark, writer, gold)
        self.late = late

    def _delete_older(
        self, store_table: str, version: int, experiment_id: str | None, **matches: str
    ) -> None:
        super()._delete_older(store_table, version, experiment_id, **matches)
        if store_table == UPLOADS.name:
            self.writer.write(UPLOADS.lines(self.spark.sql(self.late)), UPLOADS.name)


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

    assert (reloaded.gold, reloaded.store, reloaded.newer) == ({"e1": 3}, {"e1": 4}, {"e1": 1})
    assert (reloaded.missing, reloaded.older) == (0, {})


@pytest.mark.clickhouse
def test_reloading_an_experiment_gold_no_longer_holds_removes_it(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    reloader.write(UPLOADS.lines(spark.sql(_FED)), "uploads")
    gold_without_e2 = f"SELECT * FROM ({_GOLD}) WHERE experiment_id != 'e2'"

    reloaded = _GoldAt(spark, reloader, gold_without_e2).reload(UPLOADS, "e2")

    assert [row for row in _uploads(store) if row[0] == "e2"] == []
    assert [row[1] for row in _uploads(store)] == [21, 22, 23]
    assert (reloaded.gold, reloaded.store) == ({}, {})


@pytest.mark.clickhouse
def test_a_delete_past_the_removal_limit_stops_before_deleting(
    spark: SparkSession, store: _Admin, reloader: StoreWriter, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(reload_module, "REMOVAL_LIMIT", 0)
    reloader.write(UPLOADS.lines(spark.sql(_FED)), "uploads")
    before = [row for row in _uploads(store) if row[0] == "e2"]
    gold_without_e2 = f"SELECT * FROM ({_GOLD}) WHERE experiment_id != 'e2'"

    with pytest.raises(RemovalOverLimit, match=r"e2 \(\d+\)"):
        _GoldAt(spark, reloader, gold_without_e2).reload(UPLOADS, "e2")

    assert before
    assert [row for row in _uploads(store) if row[0] == "e2"] == before


@pytest.mark.clickhouse
def test_a_delete_past_the_removal_limit_goes_ahead_when_allowed(
    spark: SparkSession, store: _Admin, reloader: StoreWriter, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(reload_module, "REMOVAL_LIMIT", 0)
    reloader.write(UPLOADS.lines(spark.sql(_FED)), "uploads")
    gold_without_e2 = f"SELECT * FROM ({_GOLD}) WHERE experiment_id != 'e2'"

    _GoldAt(spark, reloader, gold_without_e2).reload(UPLOADS, "e2", allow_removal=True)

    assert [row for row in _uploads(store) if row[0] == "e2"] == []


@pytest.mark.clickhouse
def test_rows_gold_sends_again_do_not_count_against_the_removal_limit(
    spark: SparkSession, store: _Admin, reloader: StoreWriter, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(reload_module, "REMOVAL_LIMIT", 0)
    reloader.write(UPLOADS.lines(spark.sql(_FED)), "uploads")

    reloaded = _GoldAt(spark, reloader, _GOLD).reload(UPLOADS, "e2")

    assert reloaded.store == reloaded.gold


@pytest.mark.clickhouse
def test_a_new_store_takes_every_experiment_and_a_second_run_changes_nothing(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    first = _GoldAt(spark, reloader, _GOLD).reload(UPLOADS)
    second = _GoldAt(spark, reloader, _GOLD).reload(UPLOADS)

    assert first.gold == first.store == second.store == {"e1": 3, "e2": 1}
    assert store.rows(f"SELECT count() AS rows FROM {_DATABASE}.uploads") == [{"rows": 4}]
    assert [row[1] for row in _uploads(store)] == [21, 22, 24, 31]


@pytest.mark.clickhouse
def test_reloaded_rows_stay_out_of_the_feeds_delivery_window(
    spark: SparkSession, store: _Admin, reloader: StoreWriter
) -> None:
    _GoldAt(spark, reloader, _GOLD).reload(UPLOADS)

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
        f"DELETE FROM {_DATABASE}._migrations WHERE 1",
        f"INSERT INTO {_DATABASE}._migrations VALUES ('9999')",
    ):
        with pytest.raises(StoreUnavailable, match="code 497"):
            reloader.query(statement)
