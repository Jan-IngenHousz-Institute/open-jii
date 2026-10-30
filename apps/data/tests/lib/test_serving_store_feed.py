"""Which serving store sinks each pipeline defines, what a sink does with a batch, and how it waits
when the store cannot take one."""

from __future__ import annotations

import importlib.util
import json
import sys
import types
from collections.abc import Iterator
from pathlib import Path

import pytest
from openjii.serving_store import feed
from openjii.serving_store.writer import StoreUnavailable, StoreWriter, Written
from pyspark.sql import DataFrame, SparkSession

pytestmark = pytest.mark.spark

_PIPELINES = Path(__file__).parents[2] / "src/pipelines"

_START_VERSIONS = {
    "SERVING_STORE_FEED_START_MEASUREMENTS": "40",
    "SERVING_STORE_FEED_START_UPLOADS": "41",
    "SERVING_STORE_FEED_START_MACRO_RESULTS": "42",
}

_UPLOAD_CHANGES = """
    SELECT 'e1' AS experiment_id, 21L AS id, 't1' AS upload_table_id, 'Soil' AS upload_table_name,
      'up1' AS upload_id, 'u1' AS created_by, TIMESTAMP'2026-10-19 09:00:00' AS uploaded_at,
      parse_json('{"ph": 6.5}') AS uploaded_data, change AS _change_type, 3L AS _commit_version,
      TIMESTAMP'2026-10-19 09:00:01' AS _commit_timestamp
    FROM VALUES ('insert'), ('delete') AS t(change)
"""


class _Secrets:
    def __init__(self, failures: int = 0) -> None:
        self.read: list[tuple[str, str]] = []
        self.failures = failures

    def get(self, scope: str, key: str) -> str:
        if self.failures:
            self.failures -= 1
            raise RuntimeError(f"Secret does not exist with scope: {scope} and key: {key}")
        self.read.append((scope, key))
        return f"{key}-value"


class _ReadStream:
    """Records the options a flow reads its source with."""

    def __init__(self) -> None:
        self.options: dict[str, str] = {}
        self.table_name = ""

    def option(self, key: str, value: str) -> _ReadStream:
        self.options[key] = value
        return self

    def table(self, name: str) -> _ReadStream:
        self.table_name = name
        return self


class _Spark:
    """The session's configuration, with a stream reader that records instead of reading."""

    def __init__(self, spark: SparkSession) -> None:
        self.conf = spark.conf
        self.readStream = _ReadStream()


@pytest.fixture(autouse=True)
def runtimes(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("openjii.centrum.runtime", "openjii.macros.runtime"):
        runtime = types.ModuleType(name)
        runtime.ENVIRONMENT = "dev"  # type: ignore[attr-defined]
        monkeypatch.setitem(sys.modules, name, runtime)
    monkeypatch.setattr(feed, "DRIVER_RETRY_DELAYS", (0,))


@pytest.fixture(autouse=True)
def store_answers(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(StoreWriter, "check", lambda self: None)


@pytest.fixture
def start_versions(spark: SparkSession) -> Iterator[None]:
    for key, value in _START_VERSIONS.items():
        spark.conf.set(key, value)
    yield
    for key in _START_VERSIONS:
        spark.conf.unset(key)


def _load(notebook: str, spark: SparkSession | _Spark, secrets: _Secrets) -> None:
    spec = importlib.util.spec_from_file_location(f"feed_{notebook.replace('/', '_')}", _PIPELINES / notebook)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    module.spark = spark  # type: ignore[attr-defined]
    module.dbutils = types.SimpleNamespace(secrets=secrets)  # type: ignore[attr-defined]
    spec.loader.exec_module(module)


def test_each_pipeline_feeds_the_gold_tables_it_writes_without_reading_secrets_yet(
    spark: SparkSession, fake_dp: types.ModuleType, start_versions: None
) -> None:
    secrets = _Secrets()

    _load("centrum/serving_store_feed.py", spark, secrets)
    centrum = set(fake_dp.sinks)
    _load("macros/serving_store_feed.py", spark, secrets)

    assert centrum == {"serving_store_measurements", "serving_store_uploads"}
    assert set(fake_dp.sinks) - centrum == {"serving_store_macro_results"}
    assert {name: target for name, (target, _) in fake_dp.flows.items()} == {
        "serving_store_measurements_changes": "serving_store_measurements",
        "serving_store_uploads_changes": "serving_store_uploads",
        "serving_store_macro_results_changes": "serving_store_macro_results",
    }
    # A missing scope cannot fail the pipeline's graph, because nothing reads it before a batch.
    assert secrets.read == []


def test_a_flow_reads_its_gold_tables_change_feed_from_the_start_version(
    spark: SparkSession, fake_dp: types.ModuleType, start_versions: None
) -> None:
    session = _Spark(spark)
    _load("centrum/serving_store_feed.py", session, _Secrets())

    _, read = fake_dp.flows["serving_store_measurements_changes"]
    read()

    assert session.readStream.table_name == "LIVE.experiment_raw_data"
    assert session.readStream.options == {
        "readChangeFeed": "true",
        "startingVersion": "40",
        "maxBytesPerTrigger": "128m",
    }


def test_a_batch_goes_to_the_store_as_its_tables_lines_with_fresh_credentials(
    spark: SparkSession, fake_dp: types.ModuleType, start_versions: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[tuple[str, str, list[str]]] = []

    def write(self: StoreWriter, lines: DataFrame, table: str) -> Written:
        sent.append((self.key, table, [row.line for row in lines.collect()]))
        return Written(inserted=lines.count())

    monkeypatch.setattr(StoreWriter, "write", write)
    secrets = _Secrets()
    _load("centrum/serving_store_feed.py", spark, secrets)

    fake_dp.sinks["serving_store_uploads"](spark.sql(_UPLOAD_CHANGES), 0)

    [(key, table, lines)] = sent
    assert (key, table) == ("writer-password-value", "uploads")
    assert [json.loads(line)["id"] for line in lines] == [21]
    assert {scope for scope, _ in secrets.read} == {"serving-store-dev"}


def test_a_batch_the_store_could_not_take_is_written_again_from_the_driver(
    spark: SparkSession, fake_dp: types.ModuleType, start_versions: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    results = iter([Written(inserted=1, unfinished=1), Written(inserted=1)])
    attempts: list[str] = []

    def write(self: StoreWriter, lines: DataFrame, table: str) -> Written:
        attempts.append(table)
        return next(results)

    monkeypatch.setattr(StoreWriter, "write", write)
    # The first attempt finds no credentials at all, as before the scope exists.
    secrets = _Secrets(failures=1)
    _load("centrum/serving_store_feed.py", spark, secrets)

    fake_dp.sinks["serving_store_uploads"](spark.sql(_UPLOAD_CHANGES), 0)

    assert attempts == ["uploads", "uploads"]
    assert len(secrets.read) == 6


def test_a_store_that_does_not_answer_the_driver_gets_no_batch_until_it_does(
    spark: SparkSession, fake_dp: types.ModuleType, start_versions: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    answers = iter([StoreUnavailable("the store did not answer"), None])
    checks: list[str] = []
    attempts: list[str] = []

    def check(self: StoreWriter) -> None:
        checks.append(self.key)
        answer = next(answers)
        if answer is not None:
            raise answer

    def write(self: StoreWriter, lines: DataFrame, table: str) -> Written:
        attempts.append(table)
        return Written(inserted=1)

    monkeypatch.setattr(StoreWriter, "check", check)
    monkeypatch.setattr(StoreWriter, "write", write)
    _load("centrum/serving_store_feed.py", spark, _Secrets())

    fake_dp.sinks["serving_store_uploads"](spark.sql(_UPLOAD_CHANGES), 0)

    assert len(checks) == 2
    assert attempts == ["uploads"]
