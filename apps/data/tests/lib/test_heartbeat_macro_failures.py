"""Macro failures by cause and by protocol, from result rows shaped like the macro table's."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

import pytest
from openjii.heartbeat import failed_rows_by_cause_sql, protocol_failures_sql
from openjii.heartbeat.macro_failures import macro_cause_sql
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
        # Its other protocol saw only platform failures, which say nothing about the macro.
        ("zeta", "p1"): _results("zeta", "p1", 12, 12, MACRO_ERROR),
        ("zeta", "p2"): _results("zeta", "p2", 12, 12, PLATFORM_ERROR),
        # Its other protocol has too few results to call it working.
        ("iota", "p1"): _results("iota", "p1", 12, 12, MACRO_ERROR),
        ("iota", "p2"): _results("iota", "p2", 3, 0, MACRO_ERROR),
        # Fails on p1; the source ids repeat at another processing time under p2.
        ("eta", "p1"): _results("eta", "p1", 12, 12, MACRO_ERROR),
        ("eta", "p2"): _results("eta", "p2", 12, 0, MACRO_ERROR),
    }
    # Rows with no protocol, such as imports, count under `none`. They can fail on their own...
    epsilon_none = _results("epsilon", None, 12, 12, INPUT_ERROR)
    epsilon_working = _results("epsilon", "p1", 10, 0, MACRO_ERROR)
    # ...but are never the protocol a macro works on.
    theta_none = _results("theta", None, 12, 0, MACRO_ERROR)

    results = (
        [row for rows in by_protocol.values() for row in rows] + epsilon_none + epsilon_working + theta_none
    )
    results += _results("theta", "p1", 12, 12, MACRO_ERROR)
    raw = [row for (_, protocol), rows in by_protocol.items() for row in _raw_rows(rows, protocol)]
    raw += _raw_rows(epsilon_working, "p1")
    raw += _raw_rows(_results("theta", "p1", 12, 12, MACRO_ERROR), "p1")
    raw += [
        (raw_id, processed - timedelta(hours=2), "p2")
        for (_, _, _, raw_id, _, processed) in by_protocol[("eta", "p1")]
    ]

    spark.createDataFrame(results, RESULT_COLUMNS).createOrReplaceTempView("macro_results")
    spark.createDataFrame(raw, RAW_COLUMNS).createOrReplaceTempView("raw_rows")

    yield "macro_results", "raw_rows"

    spark.catalog.dropTempView("macro_results")
    spark.catalog.dropTempView("raw_rows")


# Every fixed message each layer writes, with the cause it should count as.
CAUSES = {
    "platform": [
        PLATFORM_ERROR,
        "Backend API error: Unexpected error in macro batch execution",
        "No result returned for item r1",
        "Unknown error",
        "Invalid Lambda response payload",
        "Lambda response did not match the requested items",
        "Handler error: KeyError",
        "Missing 'script' field",
        "Invalid base64 in 'script'",
        "Invalid base64 or encoding in 'script'",
        "'items' must be an array",
        "'items' must be an array, not an object",
        "Exceeds 1000 item limit",
        "No event file provided",
        "Failed to parse event: lexical error",
        "Execution failed: cannot open file",
        "Usage: python_wrapper.py <script_path> <input_json_path>",
        "Missing required arguments: expected <script_path> and <input_path>",
        "Failed to read input: [Errno 2]",
        "IO Error: ENOENT",
        "Input file not found",
        "Helper import failed: No module named 'numpy'",
        "Failed to load helpers: SyntaxError",
        "Helper setup failed: ReferenceError",
        "Helpers file not found at: /opt/helpers.R",
    ],
    "input": [
        INPUT_ERROR,
        "Invalid macro_id (null)",
        "Invalid macro_id (not UUID): abc",
        "NULL macro_id or data for row r1",
        "Macro not found: 3c7f",
        "Macro snapshot not found: 3c7f in workbook version 9",
    ],
    "macro": [
        MACRO_ERROR,
        "Script execution timed out",
        "Execution timed out",
        "Script exceeds 1MB limit",
        "Wrapper output exceeds 10MB limit",
        "Wrapper returned no output",
        "Wrapper returned invalid JSON",
        "Wrapper produced no output file",
        "Failed to compile script: invalid syntax",
        "Script compilation failed: Unexpected token",
        "Lambda function error: Unhandled",
        "Security: getNamespace() is disabled",
        "Macro output must be an object, not null",
        "TypeError: output cannot be sent as JSON: Object of type int64 is not JSON serializable",
        "Exceeds the expected range",
        "Unknown error in the trace",
    ],
}


@pytest.mark.spark
def test_names_what_failed_for_every_fixed_message(spark: SparkSession):
    messages = [(message, cause) for cause, listed in CAUSES.items() for message in listed]
    spark.createDataFrame(
        [*messages, (None, None)], "macro_error STRING, expected STRING"
    ).createOrReplaceTempView("messages")

    rows = spark.sql(f"SELECT macro_error, expected, {macro_cause_sql()} AS cause FROM messages").collect()

    assert [(row["macro_error"], row["cause"]) for row in rows if row["cause"] != row["expected"]] == []
    spark.catalog.dropTempView("messages")


@pytest.mark.spark
def test_counts_failed_results_by_what_failed(spark: SparkSession):
    errors = [None, MACRO_ERROR, INPUT_ERROR, PLATFORM_ERROR, "Missing 'script' field"]
    spark.createDataFrame([(error,) for error in errors], "macro_error STRING").createOrReplaceTempView(
        "errors"
    )

    rows = spark.sql(failed_rows_by_cause_sql("SELECT macro_error FROM errors")).collect()

    assert {row["cause"]: row["rows"] for row in rows} == {"macro": 1, "input": 1, "platform": 2}
    spark.catalog.dropTempView("errors")


@pytest.mark.spark
def test_lists_macros_failing_on_one_protocol_while_working_on_another(
    spark: SparkSession, macro_tables: tuple[str, str]
):
    results, raw = macro_tables

    rows = spark.sql(protocol_failures_sql(results, raw, "current_timestamp() - INTERVAL 24 HOURS")).collect()

    assert [(row["macro_id"], row["protocol_id"], row["attempts"], row["failures"]) for row in rows] == [
        ("epsilon", "none", 12, 12),
        ("eta", "p1", 12, 12),
        ("alpha", "p1", 12, 10),
    ]
    assert rows[2]["macro_name"] == "Alpha"
    assert rows[2]["experiments"] == 1
    assert rows[2]["sample_error"] == MACRO_ERROR
