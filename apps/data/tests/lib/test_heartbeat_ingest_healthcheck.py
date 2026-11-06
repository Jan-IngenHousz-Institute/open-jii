"""The ingest health check's age and latency, from rows shaped like the real table."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from openjii.heartbeat import ingest_healthcheck_sql
from pyspark.sql import SparkSession

pytestmark = pytest.mark.spark

_SCHEMA = "sent_at TIMESTAMP, kinesis_arrival_time TIMESTAMP, ingestion_timestamp TIMESTAMP"


def _view(spark: SparkSession, *rows: tuple[str, str, str]) -> str:
    values = ", ".join(f"({sent_at}, {arrival}, {ingested})" for sent_at, arrival, ingested in rows)
    spark.sql(
        f"SELECT * FROM VALUES {values} AS t(sent_at, kinesis_arrival_time, ingestion_timestamp)"
    ).createOrReplaceTempView("ingest_healthchecks")
    return "ingest_healthchecks"


def _ago(minutes: int, seconds: int = 0) -> str:
    return f"current_timestamp() - INTERVAL {minutes} MINUTES + INTERVAL {seconds} SECONDS"


def _rows(spark: SparkSession, *minutes_ago_and_latency_seconds: tuple[int, int]) -> str:
    return _view(
        spark,
        *((_ago(ago), _ago(ago, 1), _ago(ago, latency)) for ago, latency in minutes_ago_and_latency_seconds),
    )


@pytest.fixture(autouse=True)
def drop_view(spark: SparkSession) -> Iterator[None]:
    yield

    spark.catalog.dropTempView("ingest_healthchecks")


def _first(spark: SparkSession, table: str):
    row = spark.sql(ingest_healthcheck_sql(table)).first()
    assert row is not None
    return row


def test_age_is_minutes_since_the_newest_message_reached_kinesis(spark: SparkSession) -> None:
    table = _rows(spark, (30, 2), (10, 2), (20, 2))

    assert _first(spark, table)["age_minutes"] == pytest.approx(10, abs=0.2)


def test_age_reads_the_whole_table_so_a_stopped_path_is_as_old_as_it_is(spark: SparkSession) -> None:
    table = _rows(spark, (600, 2), (300, 2))

    row = _first(spark, table)

    assert row["age_minutes"] == pytest.approx(300, abs=0.2)
    assert row["p95_seconds"] is None


def test_age_ignores_a_sent_at_in_the_future(spark: SparkSession) -> None:
    table = _view(
        spark,
        (_ago(0, 60 * 60 * 24), _ago(10), _ago(10, 2)),
        (_ago(30), _ago(30), _ago(30, 2)),
    )

    assert _first(spark, table)["age_minutes"] == pytest.approx(10, abs=0.2)


def test_age_ignores_a_negative_sent_at(spark: SparkSession) -> None:
    table = _view(
        spark,
        ("timestamp'1969-12-31 23:00:00'", _ago(10), _ago(10, 2)),
    )

    assert _first(spark, table)["age_minutes"] == pytest.approx(10, abs=0.2)


def test_latency_counts_only_messages_written_in_the_last_hour(spark: SparkSession) -> None:
    # A message from three hours ago took ten minutes, and must not lift the hour's p95.
    table = _rows(spark, (180, 600), (50, 2), (40, 2), (30, 2), (20, 4), (10, 2))

    p95 = _first(spark, table)["p95_seconds"]

    assert p95 is not None
    assert 2 <= p95 <= 4


def test_latency_skips_a_sent_at_after_the_write(spark: SparkSession) -> None:
    table = _view(
        spark,
        (_ago(10, 60 * 60 * 24), _ago(10), _ago(10)),
        (_ago(20), _ago(20, 1), _ago(20, 3)),
    )

    assert _first(spark, table)["p95_seconds"] == pytest.approx(3)


def test_latency_skips_a_negative_sent_at(spark: SparkSession) -> None:
    table = _view(
        spark,
        ("timestamp'1969-12-31 23:00:00'", _ago(10), _ago(10)),
        (_ago(20), _ago(20, 1), _ago(20, 3)),
    )

    assert _first(spark, table)["p95_seconds"] == pytest.approx(3)


def test_latency_skips_a_sent_at_more_than_an_hour_before_the_write(spark: SparkSession) -> None:
    table = _view(
        spark,
        (_ago(10, -3601), _ago(10), _ago(10)),
        (_ago(20, -3600), _ago(20), _ago(20)),
    )

    assert _first(spark, table)["p95_seconds"] == pytest.approx(3600)


def test_an_empty_table_measures_nothing(spark: SparkSession) -> None:
    spark.createDataFrame([], _SCHEMA).createOrReplaceTempView("ingest_healthchecks")

    row = _first(spark, "ingest_healthchecks")

    assert row["age_minutes"] is None
    assert row["p95_seconds"] is None
