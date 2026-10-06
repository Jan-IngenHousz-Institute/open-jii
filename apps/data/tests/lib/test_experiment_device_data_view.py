"""The device data view builds each device row per experiment and firmware from
silver when it is read: the newest attributes, the measurement count and the
registry-resolved device."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime
from pathlib import Path

import pytest
from pyspark.sql import SparkSession

pytestmark = pytest.mark.spark

_VIEW = Path(__file__).parents[2] / "src/views/experiment_device_data.sql"
_CATALOG = "spark_catalog"
_SCHEMA = f"{_CATALOG}.centrum"

_TABLES = {
    "clean_data": """
        SELECT * FROM VALUES
          ('e1', 'd1', 'fw1', 'MultispeQ', 'v1', 80.0D, 'c1',
           TIMESTAMP'2026-09-23 10:00:00', TIMESTAMP'2026-09-23 09:59:00', 1),
          ('e1', 'd1', 'fw1', 'MultispeQ', 'v2', 75.0D, 'c1',
           TIMESTAMP'2026-09-23 10:05:00', TIMESTAMP'2026-09-23 10:04:00', 2),
          ('e1', 'd1', 'fw2', 'MultispeQ', 'v2', 70.0D, 'c1',
           TIMESTAMP'2026-09-23 11:00:00', TIMESTAMP'2026-09-23 10:59:00', 3),
          ('e1', 'd2', CAST(NULL AS STRING), 'Ambit', 'v1', 50.0D, 'c2',
           TIMESTAMP'2026-09-23 12:00:00', TIMESTAMP'2026-09-23 11:50:00', 7),
          ('e1', 'd2', CAST(NULL AS STRING), 'Ambit', 'v1', 54.0D, 'c2',
           TIMESTAMP'2026-09-23 12:00:00', TIMESTAMP'2026-09-23 11:55:00', 8),
          ('e1', 'd2', CAST(NULL AS STRING), 'Ambit', 'v1', 56.0D, 'c2',
           TIMESTAMP'2026-09-23 12:00:00', TIMESTAMP'2026-09-23 11:55:00', 9),
          ('e2', 'd1', 'fw2', 'MultispeQ', 'v2', 60.0D, 'c1',
           TIMESTAMP'2026-09-23 13:00:00', TIMESTAMP'2026-09-23 12:59:00', 4),
          (CAST(NULL AS STRING), 'd1', 'fw1', 'MultispeQ', 'v9', 10.0D, 'c1',
           TIMESTAMP'2026-09-23 14:00:00', TIMESTAMP'2026-09-23 13:59:00', 5)
        AS t(experiment_id, device_id, device_firmware, device_name, device_version, device_battery, client_id,
             processed_timestamp, timestamp, id)
    """,
    "experiment_devices": """
        SELECT * FROM VALUES
          ('e1', 'c1', named_struct('id', 'dev-1', 'serial_number', 'SN1', 'owner', 'org-1',
                                    'status', 'onboarded', 'device_type', 'multispeq'))
        AS t(experiment_id, client_id, device)
    """,
}


@pytest.fixture(scope="module")
def centrum(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_SCHEMA} LOCATION '{tmp_path_factory.mktemp('centrum')}'")
    for name, query in _TABLES.items():
        spark.sql(f"CREATE TABLE {_SCHEMA}.{name} USING parquet AS {query}")

    yield _SCHEMA

    spark.sql(f"DROP DATABASE {_SCHEMA} CASCADE")


def _rows(spark: SparkSession) -> dict[tuple, dict]:
    view = spark.sql(_VIEW.read_text().replace("${catalog}", _CATALOG))
    return {(row.experiment_id, row.device_id, row.device_firmware): row.asDict() for row in view.collect()}


def test_each_device_row_carries_its_newest_attributes_and_count(spark: SparkSession, centrum: str) -> None:
    rows = _rows(spark)

    assert set(rows) == {("e1", "d1", "fw1"), ("e1", "d1", "fw2"), ("e1", "d2", None), ("e2", "d1", "fw2")}
    assert rows[("e1", "d1", "fw1")]["total_measurements"] == 2
    assert rows[("e1", "d1", "fw1")]["device_version"] == "v2"
    assert rows[("e1", "d1", "fw1")]["device_battery"] == 75.0
    assert rows[("e1", "d1", "fw1")]["processed_timestamp"] == datetime(2026, 9, 23, 10, 5)
    assert rows[("e1", "d2", None)]["total_measurements"] == 3


def test_a_tie_on_processing_and_measurement_time_goes_to_the_higher_id(
    spark: SparkSession, centrum: str
) -> None:
    assert _rows(spark)[("e1", "d2", None)]["device_battery"] == 56.0


def test_the_registry_device_is_attached_through_the_client_id(spark: SparkSession, centrum: str) -> None:
    rows = _rows(spark)

    assert rows[("e1", "d1", "fw1")]["device"]["serial_number"] == "SN1"
    assert rows[("e1", "d2", None)]["device"] is None
    assert rows[("e2", "d1", "fw2")]["device"] is None


def test_the_row_id_hashes_experiment_device_and_firmware(spark: SparkSession, centrum: str) -> None:
    expected = spark.sql("SELECT abs(hash('e1', 'd1', 'fw1')) AS id").first()
    assert expected is not None

    assert _rows(spark)[("e1", "d1", "fw1")]["id"] == expected.id
