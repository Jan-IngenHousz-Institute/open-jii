"""The zones gold keeps, so readers can convert with them without a check."""

from __future__ import annotations

import pytest
from openjii.timezones import usable_timezone
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

pytestmark = pytest.mark.spark

# Zones devices have reported or could, which Spark cannot use, next to one it can.
_ZONES = (
    "Europe/Amsterdam",
    "ROC",
    "Factory",
    "Mars/Olympus",
    " Europe/Amsterdam ",
    "europe/amsterdam",
    "Europe/Amsterdam\x00",
    "') from x --",
    None,
)


def test_only_a_zone_spark_accepts_is_kept(spark: SparkSession) -> None:
    rows = spark.createDataFrame([(zone,) for zone in _ZONES], "timezone string")

    kept = rows.select(F.col("timezone"), usable_timezone(F.col("timezone")).alias("kept")).collect()

    assert {row["timezone"]: row["kept"] for row in kept} == {
        zone: ("Europe/Amsterdam" if zone == "Europe/Amsterdam" else None) for zone in _ZONES
    }


def test_a_kept_zone_converts(spark: SparkSession) -> None:
    rows = spark.createDataFrame(
        [("2026-09-06 12:00:00", "Mars/Olympus"), ("2026-09-06 12:00:00", "Europe/Amsterdam")],
        "utc string, timezone string",
    )

    local = rows.select(
        F.from_utc_timestamp(F.to_timestamp("utc"), usable_timezone(F.col("timezone")))
        .cast("string")
        .alias("local")
    ).collect()

    assert [row["local"] for row in local] == [None, "2026-09-06 14:00:00"]
