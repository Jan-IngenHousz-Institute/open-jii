"""Databricks spend per component and window, priced from billing tables shaped like Databricks' own."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date, datetime, timezone

import pytest
from openjii.heartbeat import cost_components, cost_windows, cost_windows_sql, weekly_measurements_sql
from pyspark.sql import SparkSession

CENTRUM = "7462573d-253f-4231-bfde-e97cbf3b2c61"
WAREHOUSE = "6d376c659d26eb41"
NAMED = {"centrum": {"dlt_pipeline_id": CENTRUM}, "warehouse": {"warehouse_id": WAREHOUSE}}

# A Tuesday: yesterday is the 26th, the latest complete week 19 to 25 October.
RUN = datetime(2026, 10, 27, 6, 0, tzinfo=timezone.utc)

# This workspace (w1) runs the named components; w2 is another environment in the same account.
_USAGE = f"""
    SELECT workspace_id, 'SKU' AS sku_name, 'AWS' AS cloud, 'DBU' AS usage_unit,
           CAST(usage_date AS TIMESTAMP) + INTERVAL 1 HOUR AS usage_end_time,
           usage_date, usage_quantity,
           named_struct('dlt_pipeline_id', pipeline, 'warehouse_id', warehouse, 'job_id', job) AS usage_metadata,
           product AS billing_origin_product
    FROM VALUES
      ('w1', DATE'2026-10-26', 10.0D, '{CENTRUM}', NULL, NULL, 'DLT'),
      ('w1', DATE'2026-10-20', 4.0D, '{CENTRUM}', NULL, NULL, 'DLT'),
      ('w1', DATE'2026-10-03', 2.0D, NULL, '{WAREHOUSE}', NULL, 'SQL'),
      ('w1', DATE'2026-09-15', 6.0D, NULL, NULL, '1071040272133451', 'JOBS'),
      ('w1', DATE'2026-09-28', 8.0D, NULL, NULL, NULL, 'PREDICTIVE_OPTIMIZATION'),
      ('w1', DATE'2026-10-27', 100.0D, '{CENTRUM}', NULL, NULL, 'DLT'),
      ('w1', DATE'2026-08-31', 100.0D, '{CENTRUM}', NULL, NULL, 'DLT'),
      ('w2', DATE'2026-10-26', 100.0D, 'another-pipeline', NULL, NULL, 'DLT'),
      ('w2', DATE'2026-10-26', 100.0D, NULL, NULL, '42', 'JOBS')
    AS t(workspace_id, usage_date, usage_quantity, pipeline, warehouse, job, product)
"""

# The price changed in 2020, so only the newer one applies inside every window.
_PRICES = """
    SELECT 'SKU' AS sku_name, 'AWS' AS cloud, 'DBU' AS usage_unit, price_start_time, price_end_time,
           named_struct('effective_list', named_struct('default', price)) AS pricing
    FROM VALUES
      (TIMESTAMP'2019-01-01 00:00:00', TIMESTAMP'2020-06-01 00:00:00', 9.0D),
      (TIMESTAMP'2020-06-01 00:00:00', CAST(NULL AS TIMESTAMP), 0.5D)
    AS t(price_start_time, price_end_time, price)
"""

_MEASUREMENTS = """
    SELECT timestamp FROM VALUES
      (TIMESTAMP'2026-10-18T23:59:59Z'),
      (TIMESTAMP'2026-10-19T00:00:00Z'),
      (TIMESTAMP'2026-10-22T12:00:00Z'),
      (TIMESTAMP'2026-10-25T23:59:59Z'),
      (TIMESTAMP'2026-10-26T00:00:00Z')
    AS t(timestamp)
"""


@pytest.fixture(scope="module")
def billing(spark: SparkSession) -> Iterator[tuple[str, str]]:
    spark.sql(_USAGE).createOrReplaceTempView("usage")
    spark.sql(_PRICES).createOrReplaceTempView("list_prices")

    yield "usage", "list_prices"

    spark.catalog.dropTempView("usage")
    spark.catalog.dropTempView("list_prices")


@pytest.mark.spark
def test_prices_this_workspaces_spend_per_component_in_every_window(
    spark: SparkSession, billing: tuple[str, str]
):
    usage, prices = billing

    rows = spark.sql(cost_windows_sql(NAMED, cost_windows(RUN), usage, prices)).collect()

    # Today and August are outside every window; w2 is another workspace's spend.
    assert {row["component"]: row.asDict() for row in rows} == {
        "centrum": {
            "component": "centrum",
            "day_usd": 5.0,
            "week_usd": 2.0,
            "month_to_date_usd": 7.0,
            "previous_month_to_date_usd": 0.0,
            "previous_month_usd": 0.0,
        },
        "warehouse": {
            "component": "warehouse",
            "day_usd": 0.0,
            "week_usd": 0.0,
            "month_to_date_usd": 1.0,
            "previous_month_to_date_usd": 0.0,
            "previous_month_usd": 0.0,
        },
        "jobs": {
            "component": "jobs",
            "day_usd": 0.0,
            "week_usd": 0.0,
            "month_to_date_usd": 0.0,
            "previous_month_to_date_usd": 3.0,
            "previous_month_usd": 3.0,
        },
        # The 28th of September is past the same point of the month, so it counts only in full.
        "other": {
            "component": "other",
            "day_usd": 0.0,
            "week_usd": 0.0,
            "month_to_date_usd": 0.0,
            "previous_month_to_date_usd": 0.0,
            "previous_month_usd": 4.0,
        },
    }


@pytest.mark.spark
def test_counts_the_measurements_taken_in_the_latest_complete_week(spark: SparkSession):
    spark.sql(_MEASUREMENTS).createOrReplaceTempView("clean_data")

    try:
        row = spark.sql(weekly_measurements_sql("clean_data", cost_windows(RUN))).first()
    finally:
        spark.catalog.dropTempView("clean_data")

    assert row is not None
    assert row["measurements"] == 3


def test_reports_yesterday_the_latest_complete_week_and_the_month_of_yesterday():
    windows = cost_windows(RUN)

    assert windows.yesterday == date(2026, 10, 26)
    assert (windows.week_start, windows.week_end) == (date(2026, 10, 19), date(2026, 10, 26))
    assert (windows.month_start, windows.next_month_start) == (date(2026, 10, 1), date(2026, 11, 1))
    assert (windows.previous_month_start, windows.previous_month_to_date_end) == (
        date(2026, 9, 1),
        date(2026, 9, 27),
    )


def test_stamps_each_window_when_it_closed():
    windows = cost_windows(RUN)

    assert windows.day_closed_at == datetime(2026, 10, 27, tzinfo=timezone.utc)
    assert windows.week_closed_at == datetime(2026, 10, 26, tzinfo=timezone.utc)


def test_closes_the_week_on_the_monday_itself():
    windows = cost_windows(datetime(2026, 10, 26, 0, 30, tzinfo=timezone.utc))

    assert (windows.week_start, windows.week_end) == (date(2026, 10, 19), date(2026, 10, 26))


def test_reports_the_month_just_ended_on_the_first_against_the_whole_month_before():
    windows = cost_windows(datetime(2026, 11, 1, 6, 0, tzinfo=timezone.utc))

    assert (windows.month_start, windows.next_month_start) == (date(2026, 10, 1), date(2026, 11, 1))
    assert windows.previous_month_to_date_end == date(2026, 10, 1)


def test_stops_the_month_before_at_its_own_end_when_it_is_shorter():
    windows = cost_windows(datetime(2027, 3, 31, 6, 0, tzinfo=timezone.utc))

    assert (windows.previous_month_start, windows.previous_month_to_date_end) == (
        date(2027, 2, 1),
        date(2027, 3, 1),
    )


def test_projects_the_month_at_the_pace_of_its_complete_days():
    # 26 days of October at 10 a day, over 31.
    assert cost_windows(RUN).projected(260.0) == 310.0
    # On the 1st the month is complete, and its projection is what it cost.
    assert cost_windows(datetime(2026, 11, 1, 6, 0, tzinfo=timezone.utc)).projected(310.0) == 310.0


def test_splits_spend_into_the_named_components_then_jobs_and_the_rest():
    assert cost_components(NAMED) == ["centrum", "warehouse", "jobs", "other"]
