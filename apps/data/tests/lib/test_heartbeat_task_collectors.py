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
    ingest_healthcheck_sql,
    observation,
)
from pyspark.sql import DataFrame, SparkSession

pytestmark = pytest.mark.spark

_TASK_PATH = Path(__file__).parents[2] / "src/tasks/metrics_heartbeat_task.py"
_NAMES = {"HISTORY_DEPTH", "log", "data_point", "idle_minutes", "collect_ingest_healthcheck"}
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


def _idle(spark: SparkSession, *wrote_rows: bool) -> float | None:
    return cast(Callable[..., float | None], _task(spark)["idle_minutes"])("table", *wrote_rows)


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


def test_idle_can_count_only_the_commits_that_wrote_rows(spark: SparkSession) -> None:
    _commits_with_an_empty_batch_last(spark)

    assert _idle(spark, True) == pytest.approx(40, abs=0.2)


def test_idle_that_counts_rows_is_none_when_no_commit_wrote_any(spark: SparkSession) -> None:
    _history(spark, (3, "STREAMING UPDATE", {"numOutputRows": "0"}))

    assert _idle(spark, True) is None


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
