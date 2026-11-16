"""Run the warehouse's generated chart SQL on Spark, whose results the serving store must match.

chart-queries.json is the backend's own SQL for each case in chart-parity.json, and
chart-results.json holds what Spark returns for it. The backend's store spec expects the same
results from the serving store. After a deliberate change to a case, regenerate the results with
WRITE_CHART_RESULTS=1 and review the diff.
"""

from __future__ import annotations

import json
import math
import os
from collections.abc import Iterator
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

pytestmark = pytest.mark.spark
_FIXTURES = Path(__file__).parents[1] / "fixtures"
_PARITY = json.loads((_FIXTURES / "chart-parity.json").read_text())
_QUERIES = json.loads((_FIXTURES / "chart-queries.json").read_text())
_RESULTS = _FIXTURES / "chart-results.json"
_TYPES = {"bigint": "BIGINT", "int": "INT", "double": "DOUBLE", "timestamp": "TIMESTAMP", "string": "STRING"}


@pytest.fixture(scope="module")
def chart_rows(spark: SparkSession) -> Iterator[None]:
    # A Databricks SQL warehouse runs in UTC.
    spark.conf.set("spark.sql.session.timeZone", "UTC")
    for view, key in (("chart_rows", "rows"), ("chart_matches", "matches")):
        rows = [
            (row["id"], row["timestamp"], row["device_name"], row["latitude"], row["output"])
            for row in _PARITY[key]
        ]
        frame = spark.createDataFrame(
            rows, "id BIGINT, timestamp_text STRING, device_name STRING, latitude DOUBLE, output STRING"
        )
        frame.select(
            F.lit("charts").alias("experiment_id"),
            "id",
            F.to_timestamp("timestamp_text").alias("timestamp"),
            F.to_date(F.to_timestamp("timestamp_text")).alias("date"),
            "device_name",
            "latitude",
            F.parse_json("output").alias("macro_output"),
        ).createOrReplaceTempView(view)
    yield
    spark.catalog.dropTempView("chart_rows")
    spark.catalog.dropTempView("chart_matches")
    spark.conf.unset("spark.sql.session.timeZone")


def _value(value: object) -> object:
    if isinstance(value, float):
        return "NaN" if math.isnan(value) else value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return f"{value:%Y-%m-%dT%H:%M:%S}.{value.microsecond // 1000:03d}Z"
    if isinstance(value, date):
        return value.isoformat()
    return value


def _result(spark: SparkSession, name: str) -> dict[str, object]:
    frame = spark.sql(_QUERIES[name])
    columns = _PARITY["cases"][name].get("compare", frame.columns)
    # A decimal is named as the warehouse names it, with its precision and scale.
    types = [
        _TYPES.get(kind, kind.upper())
        for kind in (frame.schema[column].dataType.simpleString() for column in columns)
    ]
    # Python reads a timestamp in the machine's zone, so Spark writes it in its session's, UTC.
    cells = [
        F.date_format(F.col(f"`{column}`"), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").alias(column)
        if kind == "TIMESTAMP"
        else F.col(f"`{column}`")
        for column, kind in zip(columns, types, strict=True)
    ]
    rows = [[_value(value) for value in row] for row in frame.select(cells).collect()]
    return {"columns": columns, "types": types, "rows": rows}


def test_every_case_has_its_generated_query() -> None:
    assert set(_QUERIES) == set(_PARITY["cases"])


def test_spark_returns_the_recorded_series_for_every_chart_case(
    spark: SparkSession, chart_rows: None
) -> None:
    results = {name: _result(spark, name) for name in sorted(_PARITY["cases"])}
    if os.environ.get("WRITE_CHART_RESULTS") == "1":
        _RESULTS.write_text(json.dumps(results, indent=2) + "\n")
    assert results == json.loads(_RESULTS.read_text())
