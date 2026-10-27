"""The public parameter medians: a sensor's median counts every reading from both
payload shapes, and a macro parameter's comes from macro output."""

from __future__ import annotations

import importlib.util
import sys
import types
from collections.abc import Iterator
from pathlib import Path

import pytest
from pyspark.sql import SparkSession

pytestmark = pytest.mark.spark

_NOTEBOOK = Path(__file__).parents[2] / "src/pipelines/metrics/parameter_stats.py"
_SCHEMA = "spark_catalog.metrics_parameter_stats"

_TABLES = {
    "clean_data": """
        SELECT * FROM VALUES
          ('[{"data": {"temperature": 21.5}}, {"data": {"temperature": 22}}]', current_timestamp() - INTERVAL 1 DAY),
          ('[{"set": [{"temperature": 19.25}, {"temperature": 19.5}]}]', current_timestamp() - INTERVAL 2 DAYS),
          ('[{"data": {"temperature": 20}, "set": [{"temperature": 20.5}]}]', current_timestamp() - INTERVAL 3 DAYS),
          ('[{"data": {"temperature": 99}}]', current_timestamp() - INTERVAL 400 DAYS)
        AS t(sample, timestamp)
    """,
    "experiment_macro_data": """
        SELECT * FROM VALUES
          (parse_json('{"Phi2": 0.7}'), current_timestamp() - INTERVAL 1 DAY),
          (parse_json('{"Phi2": 0.65}'), current_timestamp() - INTERVAL 1 DAY),
          (parse_json('{"Phi2": 0.6}'), current_timestamp() - INTERVAL 1 DAY)
        AS t(macro_output, timestamp)
    """,
}


@pytest.fixture
def tables(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[None]:
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_SCHEMA} LOCATION '{tmp_path_factory.mktemp('metrics')}'")
    for name, query in _TABLES.items():
        spark.sql(f"CREATE TABLE {_SCHEMA}.{name} USING parquet AS {query}")

    yield

    spark.sql(f"DROP DATABASE {_SCHEMA} CASCADE")


def test_medians_count_every_sensor_reading_and_macro_output_in_the_window(
    spark: SparkSession,
    fake_dlt: types.ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    tables: None,
) -> None:
    runtime = types.ModuleType("openjii.metrics.runtime")
    runtime.SILVER_TABLE = "clean_data"  # type: ignore[attr-defined]
    runtime.centrum_table = lambda name: f"{_SCHEMA}.{name}"  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.metrics.runtime", runtime)

    spec = importlib.util.spec_from_file_location("metrics_parameter_stats", _NOTEBOOK)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    module.spark = spark  # type: ignore[attr-defined]
    spec.loader.exec_module(module)

    rows = {
        row.parameter: (row.category, row.observations, row.median_value)
        for row in module.parameter_stats().collect()
    }

    assert rows == {
        "temperature": ("sensor", 6, 20.0),
        "Phi2": ("derived", 3, 0.65),
    }
