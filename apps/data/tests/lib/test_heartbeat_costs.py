"""Databricks spend per component, priced from billing tables shaped like Databricks' own."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from openjii.heartbeat import cost_by_component_sql, cost_components
from pyspark.sql import SparkSession

CENTRUM = "7462573d-253f-4231-bfde-e97cbf3b2c61"
WAREHOUSE = "6d376c659d26eb41"
NAMED = {"centrum": {"dlt_pipeline_id": CENTRUM}, "warehouse": {"warehouse_id": WAREHOUSE}}

# This workspace (w1) runs the named components; w2 is another environment in the same account.
_USAGE = f"""
    SELECT workspace_id, 'SKU' AS sku_name, 'AWS' AS cloud, 'DBU' AS usage_unit,
           CAST(date_sub(current_date(), days_ago) AS TIMESTAMP) + INTERVAL 1 HOUR AS usage_end_time,
           date_sub(current_date(), days_ago) AS usage_date, usage_quantity,
           named_struct('dlt_pipeline_id', pipeline, 'warehouse_id', warehouse, 'job_id', job) AS usage_metadata,
           product AS billing_origin_product
    FROM VALUES
      ('w1', 1, 10.0D, '{CENTRUM}', NULL, NULL, 'DLT'),
      ('w1', 3, 4.0D, NULL, '{WAREHOUSE}', NULL, 'SQL'),
      ('w1', 2, 2.0D, NULL, NULL, '1071040272133451', 'JOBS'),
      ('w1', 7, 1.0D, NULL, NULL, NULL, 'PREDICTIVE_OPTIMIZATION'),
      ('w1', 8, 100.0D, '{CENTRUM}', NULL, NULL, 'DLT'),
      ('w1', 0, 100.0D, '{CENTRUM}', NULL, NULL, 'DLT'),
      ('w2', 1, 100.0D, 'another-pipeline', NULL, NULL, 'DLT'),
      ('w2', 1, 100.0D, NULL, NULL, '42', 'JOBS')
    AS t(workspace_id, days_ago, usage_quantity, pipeline, warehouse, job, product)
"""

# The price changed 30 days ago, so only the newer one applies inside the window.
_PRICES = """
    SELECT 'SKU' AS sku_name, 'AWS' AS cloud, 'DBU' AS usage_unit, price_start_time, price_end_time,
           named_struct('effective_list', named_struct('default', price)) AS pricing
    FROM VALUES
      (TIMESTAMP'2020-01-01 00:00:00', CAST(date_sub(current_date(), 30) AS TIMESTAMP), 9.0D),
      (CAST(date_sub(current_date(), 30) AS TIMESTAMP), CAST(NULL AS TIMESTAMP), 0.5D)
    AS t(price_start_time, price_end_time, price)
"""


@pytest.fixture(scope="module")
def billing(spark: SparkSession) -> Iterator[tuple[str, str]]:
    spark.sql(_USAGE).createOrReplaceTempView("usage")
    spark.sql(_PRICES).createOrReplaceTempView("list_prices")

    yield "usage", "list_prices"

    spark.catalog.dropTempView("usage")
    spark.catalog.dropTempView("list_prices")


@pytest.mark.spark
def test_prices_this_workspaces_last_seven_complete_days_per_component(
    spark: SparkSession, billing: tuple[str, str]
):
    usage, prices = billing

    rows = spark.sql(cost_by_component_sql(NAMED, usage, prices)).collect()

    # Eight days back and today are outside the window; w2 is another workspace's spend.
    assert {row["component"]: float(row["usd"]) for row in rows} == {
        "centrum": 5.0,
        "warehouse": 2.0,
        "jobs": 1.0,
        "other": 0.5,
    }


def test_splits_spend_into_the_named_components_then_jobs_and_the_rest():
    assert cost_components(NAMED) == ["centrum", "warehouse", "jobs", "other"]
