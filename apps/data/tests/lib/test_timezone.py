"""Timezone normalization tests for enriched Centrum measurements."""

from __future__ import annotations

import pytest
from enrich.timezone import add_local_time_columns, canonical_timezone
from pyspark.sql import functions as F


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("AMT", "Europe/Amsterdam"),
        ("Europe/Amsterdam", "Europe/Amsterdam"),
        ("UTC", "UTC"),
        ("Z", "UTC"),
        ("+05:30", "+05:30"),
        ("-18", "-18"),
        (None, None),
        ("", None),
        ("Mars/Olympus", None),
        ("+18:00:01", None),
        ("+19", None),
    ],
)
def test_canonical_timezone(source, expected):
    assert canonical_timezone(source) == expected


@pytest.mark.spark
def test_add_local_time_columns_keeps_invalid_rows_and_preserves_source(spark):
    source = spark.createDataFrame(
        [
            ("amsterdam", "Europe/Amsterdam"),
            ("legacy", "AMT"),
            ("utc", "UTC"),
            ("offset", "+05:30"),
            ("invalid", "Mars/Olympus"),
            ("missing", None),
        ],
        "id string, timezone string",
    ).withColumn("measurement_time_utc", F.to_timestamp(F.lit("2026-08-06 12:00:00")))

    rows = {row.id: row.asDict() for row in add_local_time_columns(source).collect()}

    assert rows["amsterdam"]["timezone"] == "Europe/Amsterdam"
    assert rows["amsterdam"]["measurement_time_local"] == "2026-08-06 14:00:00"
    assert rows["legacy"]["timezone"] == "AMT"
    assert rows["legacy"]["measurement_time_local"] == "2026-08-06 14:00:00"
    assert rows["utc"]["measurement_time_local"] == "2026-08-06 12:00:00"
    assert rows["offset"]["measurement_time_local"] == "2026-08-06 17:30:00"
    assert rows["invalid"]["measurement_time_local"] is None
    assert rows["invalid"]["local_time"] is None
    assert rows["invalid"]["timezone_valid"] is False
    assert rows["missing"]["measurement_time_local"] is None
    assert rows["missing"]["timezone_valid"] is True
    assert len(rows) == 6
    assert "PythonUDF" not in add_local_time_columns(source)._jdf.queryExecution().executedPlan().toString()
