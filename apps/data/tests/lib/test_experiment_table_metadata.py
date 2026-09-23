"""experiment_table_metadata reads the gold tables: one row per experiment table
with its row count, display name and the VARIANT schemas the backend builds its
queries from."""

from __future__ import annotations

import importlib.util
import sys
import types
from collections.abc import Iterator
from pathlib import Path

import pytest
from pyspark.sql import SparkSession

pytestmark = pytest.mark.spark

_NOTEBOOK = Path(__file__).parents[2] / "src/pipelines/centrum/gold/experiment_table_metadata.py"
_SCHEMA = "spark_catalog.metadata_test"

_TABLES = {
    "experiment_raw_data": """
        SELECT * FROM VALUES
          ('e1', parse_json('{"plot": "A1"}')),
          ('e1', parse_json('{"plot": "B2", "note": "dry"}')),
          ('e2', CAST(NULL AS VARIANT))
        AS t(experiment_id, questions_data)
    """,
    "experiment_device_data": """
        SELECT * FROM VALUES
          ('e1', 'd1'),
          ('e1', 'd2')
        AS t(experiment_id, device_id)
    """,
    "experiment_uploaded_data": """
        SELECT * FROM VALUES
          ('e1', 't1', 'Soil v1', TIMESTAMP'2026-09-20 09:00:00', parse_json('{"ph": 6.5}')),
          ('e1', 't1', 'Soil v2', TIMESTAMP'2026-09-21 09:00:00', parse_json('{"ph": 7.0, "n": 3}'))
        AS t(experiment_id, upload_table_id, upload_table_name, uploaded_at, uploaded_data)
    """,
    "experiment_macro_data": """
        SELECT * FROM VALUES
          ('e1', 'mac-1', parse_json('{"phi2": 0.7}'), parse_json('{"plot": "A1"}')),
          ('e1', 'mac-1', parse_json('{"phi2": 0.6}'), parse_json('{"plot": "B2"}'))
        AS t(experiment_id, macro_id, macro_output, questions_data)
    """,
    "experiment_metadata_source": """
        SELECT * FROM VALUES
          ('e1', parse_json('{"identifierColumnId": "plot", "rows": [{"_id": "a", "plot": "A1", "soil": "clay"}]}'))
        AS t(experiment_id, metadata)
    """,
}


@pytest.fixture(scope="module")
def tables(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[None]:
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_SCHEMA} LOCATION '{tmp_path_factory.mktemp('metadata')}'")
    for name, query in _TABLES.items():
        spark.sql(f"CREATE TABLE {_SCHEMA}.{name} USING parquet AS {query}")

    yield

    spark.sql(f"DROP DATABASE {_SCHEMA} CASCADE")


def test_each_table_reports_its_rows_and_schemas(
    spark: SparkSession,
    fake_dlt: types.ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    tables: None,
) -> None:
    runtime = types.ModuleType("openjii.centrum.runtime")
    runtime.CATALOG_NAME = "spark_catalog"  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.centrum.runtime", runtime)
    monkeypatch.setattr(fake_dlt, "read", lambda name: spark.table(f"{_SCHEMA}.{name}"))
    # The macro table is read by its qualified catalog.centrum name.
    spark.sql(
        f"CREATE OR REPLACE TEMPORARY VIEW macro_source AS SELECT * FROM {_SCHEMA}.experiment_macro_data"
    )

    spec = importlib.util.spec_from_file_location("experiment_table_metadata_under_test", _NOTEBOOK)
    assert spec is not None and spec.loader is not None
    pipeline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pipeline)
    macro_reader = types.SimpleNamespace(
        read=types.SimpleNamespace(table=lambda _name: spark.table("macro_source"))
    )
    monkeypatch.setattr(pipeline, "spark", macro_reader, raising=False)

    rows = {
        (row.experiment_id, row.identifier): row for row in pipeline.experiment_table_metadata().collect()
    }

    assert set(rows) == {
        ("e1", "raw_data"),
        ("e2", "raw_data"),
        ("e1", "device"),
        ("e1", "t1"),
        ("e1", "mac-1"),
    }

    assert rows[("e1", "raw_data")].row_count == 2
    assert rows[("e2", "raw_data")].row_count == 1
    assert rows[("e1", "device")].row_count == 2
    assert (rows[("e1", "t1")].row_count, rows[("e1", "t1")].display_name) == (2, "Soil v2")
    assert rows[("e1", "mac-1")].row_count == 2

    assert "note" in rows[("e1", "raw_data")].questions_schema
    assert "phi2" in rows[("e1", "mac-1")].macro_schema
    assert "soil" in rows[("e1", "raw_data")].custom_metadata_schema
    assert "n" in rows[("e1", "t1")].upload_schema
