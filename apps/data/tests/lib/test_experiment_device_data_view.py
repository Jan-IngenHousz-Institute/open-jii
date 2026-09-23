"""The device data view counts each device's measurements per experiment and
firmware when it is read, next to what the device data notebook keeps."""

from __future__ import annotations

import importlib.util
import types
from collections.abc import Iterator
from pathlib import Path

import pytest
from pyspark.sql import SparkSession

pytestmark = pytest.mark.spark

_DATA = Path(__file__).parents[2]
_NOTEBOOK = _DATA / "src/pipelines/centrum/gold/experiment_device_data.py"
_VIEW = _DATA / "src/views/experiment_device_data.sql"
_CATALOG = "spark_catalog"
_SCHEMA = f"{_CATALOG}.centrum"

_TABLES = {
    "latest_experiment_device": """
        SELECT * FROM VALUES
          ('e1', 'd1', 'fw1', 'MultispeQ', 'v2', 80.0D, 'c1', TIMESTAMP'2026-09-23 10:00:00'),
          ('e1', 'd1', 'fw2', 'MultispeQ', 'v2', 70.0D, 'c1', TIMESTAMP'2026-09-23 11:00:00'),
          ('e1', 'd2', CAST(NULL AS STRING), 'Ambit', 'v1', CAST(NULL AS DOUBLE), 'c2',
           TIMESTAMP'2026-09-23 12:00:00'),
          ('e2', 'd1', 'fw2', 'MultispeQ', 'v2', 60.0D, 'c1', TIMESTAMP'2026-09-23 13:00:00')
        AS t(experiment_id, device_id, device_firmware, device_name, device_version, device_battery, client_id,
             processed_timestamp)
    """,
    "experiment_devices": """
        SELECT * FROM VALUES
          ('e1', 'c1', named_struct('id', 'dev-1', 'serial_number', 'SN1', 'owner', 'org-1',
                                    'status', 'onboarded', 'device_type', 'multispeq'))
        AS t(experiment_id, client_id, device)
    """,
    "clean_data": """
        SELECT * FROM VALUES
          ('e1', 'd1', 'fw1'), ('e1', 'd1', 'fw1'), ('e1', 'd1', 'fw2'),
          ('e1', 'd2', CAST(NULL AS STRING)), ('e1', 'd2', CAST(NULL AS STRING)), ('e1', 'd2', CAST(NULL AS STRING)),
          ('e2', 'd1', 'fw2'),
          (CAST(NULL AS STRING), 'd1', 'fw1')
        AS t(experiment_id, device_id, device_firmware)
    """,
}


@pytest.fixture(scope="module")
def centrum(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_SCHEMA} LOCATION '{tmp_path_factory.mktemp('centrum')}'")
    for name, query in _TABLES.items():
        spark.sql(f"CREATE TABLE {_SCHEMA}.{name} USING parquet AS {query}")

    yield _SCHEMA

    spark.sql(f"DROP DATABASE {_SCHEMA} CASCADE")


def test_each_device_row_carries_its_measurement_count(
    spark: SparkSession,
    fake_dlt: types.ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    centrum: str,
) -> None:
    monkeypatch.setattr(fake_dlt, "read", lambda name: spark.table(f"{centrum}.{name}"))
    spec = importlib.util.spec_from_file_location("device_data_under_test", _NOTEBOOK)
    assert spec is not None and spec.loader is not None
    notebook = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(notebook)
    notebook.experiment_device_data().write.saveAsTable(f"{centrum}.experiment_device_data")

    view = spark.sql(_VIEW.read_text().replace("${catalog}", _CATALOG))
    counts = {
        (row.experiment_id, row.device_id, row.device_firmware): row.total_measurements
        for row in view.collect()
    }

    assert counts == {
        ("e1", "d1", "fw1"): 2,
        ("e1", "d1", "fw2"): 1,
        ("e1", "d2", None): 3,
        ("e2", "d1", "fw2"): 1,
    }
