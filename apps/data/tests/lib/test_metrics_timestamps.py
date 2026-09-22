"""Tests for the metrics timestamp plausibility predicate."""

from __future__ import annotations

import pytest
from openjii.metrics import within_plausible_range
from pyspark.sql import functions as F


@pytest.mark.spark
def test_epoch_and_future_timestamps_are_excluded(spark):
    now = "2026-08-14 12:00:00"

    source = spark.createDataFrame(
        [
            ("epoch", "1970-01-01 00:00:17"),
            ("pre-floor", "1999-12-31 23:59:59"),
            ("floor", "2000-01-01 00:00:00"),
            ("recent", "2026-08-14 11:59:00"),
            ("now", now),
            ("future", "2038-01-19 03:14:07"),
            ("missing", None),
        ],
        "id string, raw string",
    ).withColumn("timestamp", F.to_timestamp("raw"))

    flagged = source.withColumn(
        "plausible",
        within_plausible_range(F.col("timestamp"), F.to_timestamp(F.lit(now))),
    )
    rows = {row.id: row.plausible for row in flagged.collect()}

    assert rows["epoch"] is False
    assert rows["pre-floor"] is False
    assert rows["floor"] is True
    assert rows["recent"] is True
    assert rows["now"] is True
    assert rows["future"] is False
    assert rows["missing"] is None
