"""The status views read when someone asks: a device's newest measurement and
connectivity event, and whether each experiment received data within the hour."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime
from pathlib import Path

import pytest
from pyspark.sql import SparkSession

pytestmark = pytest.mark.spark

_VIEWS = Path(__file__).parents[2] / "src/views"
_CATALOG = "spark_catalog"
_SCHEMA = f"{_CATALOG}.centrum"

_TABLES = {
    "clean_data": """
        SELECT * FROM VALUES
          ('c1', TIMESTAMP'2026-09-23 10:00:00'),
          ('c1', TIMESTAMP'2026-09-23 11:00:00'),
          ('c2', TIMESTAMP'2026-09-23 09:00:00'),
          (CAST(NULL AS STRING), TIMESTAMP'2026-09-23 23:00:00')
        AS t(client_id, timestamp)
    """,
    "clean_device_lifecycle_events": """
        SELECT * FROM VALUES
          ('c1', 'connected', TIMESTAMP'2026-09-23 08:00:00'),
          ('c1', 'disconnected', TIMESTAMP'2026-09-23 12:00:00'),
          ('c1', 'connected', CAST(NULL AS TIMESTAMP)),
          ('c3', 'connected', TIMESTAMP'2026-09-23 07:00:00')
        AS t(client_id, event_type, event_timestamp)
    """,
    "experiment_raw_data": """
        SELECT 'e1' AS experiment_id, current_timestamp() - INTERVAL 10 MINUTES AS processed_timestamp
        UNION ALL SELECT 'e1', current_timestamp() - INTERVAL 2 DAYS
        UNION ALL SELECT 'e2', current_timestamp() - INTERVAL 3 HOURS
    """,
}


@pytest.fixture(scope="module")
def centrum(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_SCHEMA} LOCATION '{tmp_path_factory.mktemp('centrum')}'")
    for name, query in _TABLES.items():
        spark.sql(f"CREATE TABLE {_SCHEMA}.{name} USING parquet AS {query}")

    yield _SCHEMA

    spark.sql(f"DROP DATABASE {_SCHEMA} CASCADE")


def _view(spark: SparkSession, name: str):
    return spark.sql((_VIEWS / f"{name}.sql").read_text().replace("${catalog}", _CATALOG))


def test_a_device_has_its_newest_measurement_and_its_newest_event(spark: SparkSession, centrum: str) -> None:
    rows = {row.client_id: row.asDict() for row in _view(spark, "device_last_activity").collect()}

    assert rows == {
        "c1": {
            "client_id": "c1",
            "last_data_at": datetime(2026, 9, 23, 11, 0),
            "last_event_type": "disconnected",
            "last_event_at": datetime(2026, 9, 23, 12, 0),
        },
        "c2": {
            "client_id": "c2",
            "last_data_at": datetime(2026, 9, 23, 9, 0),
            "last_event_type": None,
            "last_event_at": None,
        },
        "c3": {
            "client_id": "c3",
            "last_data_at": None,
            "last_event_type": "connected",
            "last_event_at": datetime(2026, 9, 23, 7, 0),
        },
    }


def test_a_filter_on_one_device_gives_that_device_alone(spark: SparkSession, centrum: str) -> None:
    rows = _view(spark, "device_last_activity").filter("client_id = 'c1'").collect()

    assert [row.last_data_at for row in rows] == [datetime(2026, 9, 23, 11, 0)]


def test_an_experiment_is_fresh_within_an_hour_of_its_newest_row(spark: SparkSession, centrum: str) -> None:
    rows = {row.experiment_id: row for row in _view(spark, "experiment_status").collect()}
    newest = {
        row.experiment_id: row.newest
        for row in spark.sql(
            f"SELECT experiment_id, max(processed_timestamp) AS newest FROM {centrum}.experiment_raw_data GROUP BY 1"
        ).collect()
    }

    assert {experiment: row.status for experiment, row in rows.items()} == {"e1": "fresh", "e2": "stale"}
    assert {experiment: row.latest_processed_timestamp for experiment, row in rows.items()} == newest
    assert all(row.status_updated_at is not None for row in rows.values())
