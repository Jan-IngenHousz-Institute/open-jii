"""Collectors of the heartbeat task, run against local Spark with the table reads they make."""

from __future__ import annotations

import ast
import re
from collections.abc import Callable, Iterator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, cast

import pytest
from openjii.heartbeat import (
    DATA_NAMESPACE,
    HEALTHCHECK_AGE_METRIC,
    HEALTHCHECK_LATENCY_METRIC,
    INGEST_IDLE_METRIC,
    MACRO_IDLE_METRIC,
    bronze_idle_sql,
    ingest_healthcheck_sql,
    observation,
)
from pyspark.sql import DataFrame, SparkSession

pytestmark = pytest.mark.spark

_TASK_PATH = Path(__file__).parents[2] / "src/tasks/metrics_heartbeat_task.py"
_NAMES = {
    "HISTORY_DEPTH",
    "log",
    "data_point",
    "idle_minutes",
    "collect_ingest_healthcheck",
    "collect_path_idle",
}
_NOW = datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc)

_HEALTHCHECK_SCHEMA = "sent_at TIMESTAMP, kinesis_arrival_time TIMESTAMP, ingestion_timestamp TIMESTAMP"


def _defined_name(node: ast.stmt) -> str | None:
    if isinstance(node, ast.FunctionDef):
        return node.name
    if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
        return node.targets[0].id
    return None


class _Lakehouse:
    """The session, with DESCRIBE HISTORY (a Delta command) answered from a `history` view."""

    def __init__(self, session: SparkSession) -> None:
        self.catalog = session.catalog
        self._session = session

    def sql(self, query: str) -> DataFrame:
        return self._session.sql(re.sub(r"\(DESCRIBE HISTORY \S+ LIMIT \d+\)", "history", query))


def _task(session: SparkSession) -> dict[str, Any]:
    module = ast.parse(_TASK_PATH.read_text())
    body = [node for node in module.body if _defined_name(node) in _NAMES]
    namespace: dict[str, Any] = {
        "spark": _Lakehouse(session),
        "ENVIRONMENT": "dev",
        "INGEST_HEALTHCHECKS": "ingest_healthchecks",
        "RAW_DATA": "raw_data",
        "EXPERIMENT_MACRO_DATA": "experiment_macro_data",
        "INGEST_IDLE_METRIC": INGEST_IDLE_METRIC,
        "MACRO_IDLE_METRIC": MACRO_IDLE_METRIC,
        "bronze_idle_sql": bronze_idle_sql,
        "DATA_NAMESPACE": DATA_NAMESPACE,
        "HEALTHCHECK_AGE_METRIC": HEALTHCHECK_AGE_METRIC,
        "HEALTHCHECK_LATENCY_METRIC": HEALTHCHECK_LATENCY_METRIC,
        "ingest_healthcheck_sql": ingest_healthcheck_sql,
        "observation": observation,
    }
    exec(compile(ast.Module(body=body, type_ignores=[]), _TASK_PATH, "exec"), namespace)
    return namespace


@pytest.fixture(autouse=True)
def drop_views(spark: SparkSession) -> Iterator[None]:
    yield

    spark.catalog.dropTempView("history")
    spark.catalog.dropTempView("ingest_healthchecks")
    spark.catalog.dropTempView("raw_data")


def _history(spark: SparkSession, *commits: tuple[int, str, dict[str, str]]) -> None:
    rows = [(version, operation, metrics, ago) for version, (ago, operation, metrics) in enumerate(commits)]
    spark.createDataFrame(
        rows, "version BIGINT, operation STRING, operationMetrics MAP<STRING, STRING>, ago INT"
    ).selectExpr(
        "version",
        "current_timestamp() - make_interval(0, 0, 0, 0, 0, ago, 0) AS timestamp",
        "operation",
        "operationMetrics",
    ).createOrReplaceTempView("history")


def _idle(spark: SparkSession) -> float | None:
    return cast(Callable[[str], float | None], _task(spark)["idle_minutes"])("table")


def _commits_with_an_empty_batch_last(spark: SparkSession) -> None:
    _history(
        spark,
        (3, "STREAMING UPDATE", {"numOutputRows": "0"}),
        (40, "STREAMING UPDATE", {"numOutputRows": "120"}),
        (60, "STREAMING UPDATE", {"numOutputRows": "7"}),
        (1, "OPTIMIZE", {"numOutputRows": "999"}),
    )


def test_idle_counts_every_streaming_commit_by_default(spark: SparkSession) -> None:
    _commits_with_an_empty_batch_last(spark)

    assert _idle(spark) == pytest.approx(3, abs=0.2)


def test_bronze_idle_reads_its_newest_row_so_empty_commits_cannot_hide_a_stall(spark: SparkSession) -> None:
    _commits_with_an_empty_batch_last(spark)
    spark.sql(
        "SELECT current_timestamp() - INTERVAL 25 MINUTES AS ingestion_timestamp, "
        "to_date(current_timestamp() - INTERVAL 25 MINUTES) AS ingest_date"
    ).createOrReplaceTempView("raw_data")

    records = cast(Callable[[datetime], list[dict]], _task(spark)["collect_path_idle"])(_NOW)

    idle = {record["metric"]: record["value"] for record in records}
    assert idle[INGEST_IDLE_METRIC] == pytest.approx(25, abs=0.2)
    assert idle[MACRO_IDLE_METRIC] == pytest.approx(3, abs=0.2)


def _collect(spark: SparkSession) -> list[dict]:
    return cast(Callable[[datetime], list[dict]], _task(spark)["collect_ingest_healthcheck"])(_NOW)


def test_a_health_check_table_that_does_not_exist_yet_emits_nothing(spark: SparkSession) -> None:
    assert _collect(spark) == []


def test_an_empty_health_check_table_emits_nothing(spark: SparkSession) -> None:
    spark.createDataFrame([], _HEALTHCHECK_SCHEMA).createOrReplaceTempView("ingest_healthchecks")

    assert _collect(spark) == []


def test_a_health_check_table_with_a_message_emits_its_age_and_latency(spark: SparkSession) -> None:
    spark.sql(
        "SELECT current_timestamp() - INTERVAL 5 MINUTES AS sent_at, "
        "current_timestamp() - INTERVAL 5 MINUTES AS kinesis_arrival_time, "
        "current_timestamp() - INTERVAL 5 MINUTES + INTERVAL 3 SECONDS AS ingestion_timestamp"
    ).createOrReplaceTempView("ingest_healthchecks")

    records = _collect(spark)

    assert {record["metric"] for record in records} == {HEALTHCHECK_AGE_METRIC, HEALTHCHECK_LATENCY_METRIC}
