"""Bronze's idle time, from rows shaped like the real table."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from openjii.heartbeat import IDLE_LOOKBACK_DAYS, bronze_idle_sql
from pyspark.sql import SparkSession

pytestmark = pytest.mark.spark


def _rows(spark: SparkSession, *minutes_ago: int) -> str:
    spark.createDataFrame([(ago,) for ago in minutes_ago], "ago INT").selectExpr(
        "current_timestamp() - make_interval(0, 0, 0, 0, 0, ago, 0) AS ingestion_timestamp",
    ).selectExpr(
        "ingestion_timestamp", "to_date(ingestion_timestamp) AS ingest_date"
    ).createOrReplaceTempView("raw_data")
    return "raw_data"


@pytest.fixture(autouse=True)
def drop_view(spark: SparkSession) -> Iterator[None]:
    yield

    spark.catalog.dropTempView("raw_data")


def _idle(spark: SparkSession, table: str) -> float:
    row = spark.sql(bronze_idle_sql(table)).first()
    assert row is not None
    return row["idle"]


def test_idle_is_minutes_since_the_newest_row_was_written(spark: SparkSession) -> None:
    assert _idle(spark, _rows(spark, 30, 7, 15)) == pytest.approx(7, abs=0.2)


def test_a_table_with_no_row_inside_the_look_back_reads_the_look_back(spark: SparkSession) -> None:
    assert _idle(spark, _rows(spark, 4 * 24 * 60)) == IDLE_LOOKBACK_DAYS * 24 * 60


def test_an_empty_table_reads_the_look_back(spark: SparkSession) -> None:
    assert _idle(spark, _rows(spark)) == IDLE_LOOKBACK_DAYS * 24 * 60
