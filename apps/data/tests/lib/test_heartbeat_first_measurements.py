"""Researchers and loggers taking their first measurement, from silver rows shaped like the real table."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from openjii.heartbeat import loggers_started_sql, researchers_started_sql
from pyspark.sql import SparkSession

_SILVER = """
    SELECT user_id, client_id, device_id,
           CAST(current_timestamp() - make_interval(0, 0, 0, days_ago) AS TIMESTAMP) AS timestamp
    FROM VALUES
      ('new', 'mobile_a', 'sensor-1', 3),
      ('new', 'mobile_a', 'sensor-1', 1),
      ('returning', 'mobile_b', 'sensor-2', 20),
      ('returning', 'mobile_b', 'sensor-2', 1),
      ('wrong-clock', 'mobile_c', 'sensor-3', 20000),
      ('wrong-clock', 'mobile_c', 'sensor-3', 2),
      ('future-only', 'mobile_d', 'sensor-4', -5),
      (CAST(NULL AS STRING), 'logger_new', 'logger-new', 2),
      (CAST(NULL AS STRING), 'logger_old', 'logger-old', 30),
      (CAST(NULL AS STRING), 'logger_old', 'logger-old', 1),
      (CAST(NULL AS STRING), 'calibration_rig', 'ambit-1', 40),
      (CAST(NULL AS STRING), 'calibration_rig', 'ambit-2', 1),
      (CAST(NULL AS STRING), 'calibration_rig', 'ambit-3', 1)
    AS t(user_id, client_id, device_id, days_ago)
"""


@pytest.fixture(scope="module")
def silver(spark: SparkSession) -> Iterator[str]:
    spark.sql(_SILVER).createOrReplaceTempView("clean_data")

    yield "clean_data"

    spark.catalog.dropTempView("clean_data")


@pytest.mark.spark
def test_counts_people_whose_first_plausible_measurement_is_in_the_week(spark: SparkSession, silver: str):
    row = spark.sql(researchers_started_sql(silver)).first()
    assert row is not None

    # "returning" measured before the week; "wrong-clock" counts by its first plausible reading;
    # a future reading counts for nobody, and a logger's rows have no person.
    assert row["started"] == 2


@pytest.mark.spark
def test_counts_loggers_by_broker_identity_so_a_calibration_rig_counts_once(spark: SparkSession, silver: str):
    row = spark.sql(loggers_started_sql(silver)).first()
    assert row is not None

    # Only logger_new is new: logger_old started a month ago, and the rig's new sensors this
    # week arrive under an identity that has published for forty days.
    assert row["started"] == 1
