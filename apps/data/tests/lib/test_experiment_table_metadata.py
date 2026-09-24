"""Table metadata from gold to what the backend reads: the sample notebooks keep a
sample per schema, the metadata notebook merges them, and the view adds each
table's row count, when its newest row arrived and an upload's newest name."""

from __future__ import annotations

import importlib.util
import sys
import types
from collections.abc import Iterator
from datetime import datetime
from pathlib import Path

import pytest
from pyspark.sql import DataFrame, SparkSession

pytestmark = pytest.mark.spark

_DATA = Path(__file__).parents[2]
_PIPELINES = _DATA / "src/pipelines"
_VIEW = _DATA / "src/views/experiment_table_metadata.sql"
_CATALOG = "spark_catalog"
_SCHEMA = f"{_CATALOG}.centrum"

_GOLD = {
    "experiment_raw_data": """
        SELECT * FROM VALUES
          ('e1', parse_json('{"plot": "A1"}'), TIMESTAMP'2026-09-22 10:00:00'),
          ('e1', parse_json('{"plot": "B2", "note": "dry"}'), TIMESTAMP'2026-09-22 10:05:00'),
          ('e2', CAST(NULL AS VARIANT), TIMESTAMP'2026-09-22 11:00:00')
        AS t(experiment_id, questions_data, processed_timestamp)
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
          ('e1', 'mac-1', parse_json('{"phi2": 0.7}'), parse_json('{"plot": "A1"}'),
           TIMESTAMP'2026-09-22 10:00:00'),
          ('e1', 'mac-1', parse_json('{"phi2": 0.653}'), parse_json('{"plot": "B2"}'),
           TIMESTAMP'2026-09-22 10:05:00')
        AS t(experiment_id, macro_id, macro_output, questions_data, processed_timestamp)
    """,
    "experiment_metadata_source": """
        SELECT * FROM VALUES
          ('e1', parse_json('{"identifierColumnId": "plot", "rows": [{"_id": "a", "plot": "A1", "soil": "clay"}]}'))
        AS t(experiment_id, metadata)
    """,
}

_SAMPLE_NOTEBOOKS = {
    "experiment_raw_data_schemas": "centrum/gold/experiment_raw_data_schemas.py",
    "experiment_uploaded_data_schemas": "centrum/gold/experiment_uploaded_data_schemas.py",
    "experiment_macro_data_schemas": "macros/experiment_macro_data_schemas.py",
}


@pytest.fixture(scope="module")
def centrum(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_SCHEMA} LOCATION '{tmp_path_factory.mktemp('centrum')}'")
    for name, query in _GOLD.items():
        spark.sql(f"CREATE TABLE {_SCHEMA}.{name} USING parquet AS {query}")

    yield _SCHEMA

    spark.sql(f"DROP DATABASE {_SCHEMA} CASCADE")


def _notebook(notebook: str, function: str, spark: SparkSession) -> DataFrame:
    spec = importlib.util.spec_from_file_location(f"metadata_{function}", _PIPELINES / notebook)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.spark = spark  # type: ignore[attr-defined]
    return getattr(module, function)()


def test_the_view_reports_each_table_with_its_schemas_count_newest_row_and_name(
    spark: SparkSession,
    fake_dlt: types.ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    centrum: str,
) -> None:
    runtime = types.ModuleType("openjii.centrum.runtime")
    runtime.CATALOG_NAME = _CATALOG  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.centrum.runtime", runtime)
    # A streaming read of a table gives the same rows as a batch read of it.
    monkeypatch.setattr(fake_dlt, "read_stream", lambda name: spark.table(f"{centrum}.{name}"))
    monkeypatch.setattr(fake_dlt, "read", lambda name: spark.table(f"{centrum}.{name}"))

    for table, notebook in _SAMPLE_NOTEBOOKS.items():
        _notebook(notebook, table, spark).write.saveAsTable(f"{centrum}.{table}")
    metadata = _notebook("centrum/gold/experiment_table_metadata.py", "experiment_table_metadata", spark)
    metadata.write.saveAsTable(f"{centrum}.experiment_table_metadata")

    view = spark.sql(_VIEW.read_text().replace("${catalog}", _CATALOG))
    rows = {(row.experiment_id, row.identifier): row.asDict() for row in view.collect()}
    revisions = {key: row.pop("schema_revision") for key, row in rows.items()}

    assert rows == {
        ("e1", "raw_data"): {
            "experiment_id": "e1",
            "identifier": "raw_data",
            "table_type": "static",
            "display_name": None,
            "row_count": 2,
            "latest_row_at": datetime(2026, 9, 22, 10, 5),
            "macro_schema": None,
            "questions_schema": "OBJECT<note: STRING, plot: STRING>",
            "custom_metadata_schema": "OBJECT<soil: STRING>",
            "upload_schema": None,
        },
        ("e2", "raw_data"): {
            "experiment_id": "e2",
            "identifier": "raw_data",
            "table_type": "static",
            "display_name": None,
            "row_count": 1,
            "latest_row_at": datetime(2026, 9, 22, 11, 0),
            "macro_schema": None,
            "questions_schema": None,
            "custom_metadata_schema": None,
            "upload_schema": None,
        },
        ("e1", "device"): {
            "experiment_id": "e1",
            "identifier": "device",
            "table_type": "static",
            "display_name": None,
            "row_count": 2,
            "latest_row_at": None,
            "macro_schema": None,
            "questions_schema": None,
            "custom_metadata_schema": None,
            "upload_schema": None,
        },
        ("e1", "t1"): {
            "experiment_id": "e1",
            "identifier": "t1",
            "table_type": "upload",
            "display_name": "Soil v2",
            "row_count": 2,
            "latest_row_at": datetime(2026, 9, 21, 9, 0),
            "macro_schema": None,
            "questions_schema": None,
            "custom_metadata_schema": None,
            "upload_schema": "OBJECT<n: BIGINT, ph: DOUBLE>",
        },
        ("e1", "mac-1"): {
            "experiment_id": "e1",
            "identifier": "mac-1",
            "table_type": "macro",
            "display_name": None,
            "row_count": 2,
            "latest_row_at": datetime(2026, 9, 22, 10, 5),
            "macro_schema": "OBJECT<phi2: DOUBLE>",
            "questions_schema": "OBJECT<plot: STRING>",
            "custom_metadata_schema": "OBJECT<soil: STRING>",
            "upload_schema": None,
        },
    }

    # Tables with the same schemas share a revision; any schema difference changes it.
    assert revisions[("e2", "raw_data")] == revisions[("e1", "device")]
    distinct = [("e1", "raw_data"), ("e2", "raw_data"), ("e1", "t1"), ("e1", "mac-1")]
    assert len({revisions[key] for key in distinct}) == len(distinct)
