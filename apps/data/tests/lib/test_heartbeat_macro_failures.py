"""Macro failures by cause and by protocol, from result rows shaped like the macro table's."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from openjii.heartbeat import failed_rows_by_cause_sql, protocol_failures_sql
from pyspark.sql import SparkSession

NOW = datetime.now(timezone.utc)
RECENT = NOW - timedelta(hours=1)
STALE = NOW - timedelta(days=2)

MACRO_ERROR = "KeyError: 'phi2'"
INPUT_ERROR = "empty-envelope: recognized sample contained no measurement; macro not invoked"
PLATFORM_ERROR = "Chunk failed: Request failed: 401 Client Error: Unauthorized | Response status: 401"

RESULT_COLUMNS = "macro_id STRING, macro_name STRING, experiment_id STRING, raw_id STRING, macro_error STRING, processed_timestamp TIMESTAMP"
RAW_COLUMNS = "id STRING, processed_timestamp TIMESTAMP, protocol_id STRING"


def _results(
    macro: str,
    protocol: str | None,
    attempts: int,
    failed: int,
    error: str,
    processed: datetime = RECENT,
) -> list[tuple]:
    return [
        (
            macro,
            macro.title(),
            "experiment-1",
            f"{macro}-{protocol}-{n}",
            error if n < failed else None,
            processed,
        )
        for n in range(attempts)
    ]


def _raw_rows(results: list[tuple], protocol: str) -> list[tuple]:
    return [(raw_id, processed, protocol) for (_, _, _, raw_id, _, processed) in results]


@pytest.fixture(scope="module")
def macro_tables(spark: SparkSession) -> Iterator[tuple[str, str]]:
    by_protocol = {
        # Fails on one protocol and works on another: the case this exists for.
        ("alpha", "p1"): _results("alpha", "p1", 12, 10, MACRO_ERROR),
        ("alpha", "p2"): _results("alpha", "p2", 10, 0, MACRO_ERROR),
        # Platform failures fail every protocol alike, so they never make a pair fail.
        ("alpha", "p3"): _results("alpha", "p3", 12, 12, PLATFORM_ERROR),
        # Fails everywhere: a broken macro, not a protocol it cannot read.
        ("beta", "p1"): _results("beta", "p1", 12, 12, MACRO_ERROR),
        ("beta", "p2"): _results("beta", "p2", 12, 12, INPUT_ERROR),
        # Too few results to judge.
        ("gamma", "p1"): _results("gamma", "p1", 5, 5, MACRO_ERROR),
        ("gamma", "p2"): _results("gamma", "p2", 10, 0, MACRO_ERROR),
        # Outside the window.
        ("delta", "p1"): _results("delta", "p1", 12, 12, MACRO_ERROR, STALE),
        ("delta", "p2"): _results("delta", "p2", 12, 0, MACRO_ERROR, STALE),
    }
    # A row with no source row, such as an import, counts under protocol `none`.
    no_source = _results("epsilon", None, 12, 12, INPUT_ERROR)
    working = _results("epsilon", "p1", 10, 0, MACRO_ERROR)

    results = [row for rows in by_protocol.values() for row in rows] + no_source + working
    raw = [row for (_, protocol), rows in by_protocol.items() for row in _raw_rows(rows, protocol)]
    raw += _raw_rows(working, "p1")

    spark.createDataFrame(results, RESULT_COLUMNS).createOrReplaceTempView("macro_results")
    spark.createDataFrame(raw, RAW_COLUMNS).createOrReplaceTempView("raw_rows")

    yield "macro_results", "raw_rows"

    spark.catalog.dropTempView("macro_results")
    spark.catalog.dropTempView("raw_rows")


@pytest.mark.spark
def test_counts_failed_results_by_what_failed(spark: SparkSession):
    errors = [
        None,
        MACRO_ERROR,
        "Script execution timed out",
        INPUT_ERROR,
        "Macro not found: 3c7f",
        PLATFORM_ERROR,
        "Missing 'script' field",
        "Lambda function error: Unhandled",
    ]
    spark.createDataFrame([(error,) for error in errors], "macro_error STRING").createOrReplaceTempView(
        "errors"
    )

    rows = spark.sql(failed_rows_by_cause_sql("SELECT macro_error FROM errors")).collect()

    assert {row["cause"]: row["rows"] for row in rows} == {"macro": 2, "input": 2, "platform": 3}
    spark.catalog.dropTempView("errors")


@pytest.mark.spark
def test_lists_macros_failing_on_one_protocol_while_working_on_another(
    spark: SparkSession, macro_tables: tuple[str, str]
):
    results, raw = macro_tables

    rows = spark.sql(protocol_failures_sql(results, raw, "current_timestamp() - INTERVAL 24 HOURS")).collect()

    assert [(row["macro_id"], row["protocol_id"], row["attempts"], row["failures"]) for row in rows] == [
        ("epsilon", "none", 12, 12),
        ("alpha", "p1", 12, 10),
    ]
    assert rows[1]["macro_name"] == "Alpha"
    assert rows[1]["experiments"] == 1
    assert rows[1]["sample_error"] == MACRO_ERROR
