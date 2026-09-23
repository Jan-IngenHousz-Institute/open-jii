"""The enriched views become plain SQL views. Each must return exactly what the
materialized view it replaces computes, column for column and row for row, so
both run here over the same small tables."""

from __future__ import annotations

import importlib.util
import sys
import types
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

pytestmark = pytest.mark.spark

_DATA = Path(__file__).parents[2]
_VIEWS = _DATA / "src/views"
_PIPELINES = _DATA / "src/pipelines"
_CATALOG = "spark_catalog"

_ANNOTATION = (
    "STRUCT<id: STRING, rowId: STRING, type: STRING, content: STRUCT<text: STRING, flagType: STRING>, "
    "createdBy: STRING, createdByName: STRING, createdAt: TIMESTAMP, updatedAt: TIMESTAMP>"
)
_PAYLOAD_ANNOTATION = (
    "named_struct('id', 'payload-1', 'rowId', '1', 'type', 'comment', "
    "'content', named_struct('text', 'from the device', 'flagType', CAST(NULL AS STRING)), "
    "'createdBy', 'u1', 'createdByName', 'Ann', "
    "'createdAt', TIMESTAMP'2026-09-01 08:00:00', 'updatedAt', TIMESTAMP'2026-09-01 08:00:00')"
)

_TABLES = {
    "experiment_raw_data": f"""
        SELECT * FROM VALUES
          ('e1', 1L, 'd1', 'MultispeQ', TIMESTAMP'2026-09-01 08:00:00', 'Europe/Amsterdam', DATE'2026-09-01',
           array(named_struct('id', 'm1', 'name', 'Fluo', 'filename', 'fluo.py')),
           parse_json('{{"plot": "A1"}}'), array({_PAYLOAD_ANNOTATION}),
           'u1', 'c1', 'p1', 'w1', 52.0D, 5.1D, parse_json('[{{"x": 1}}]'), TIMESTAMP'2026-09-23 10:00:00'),
          ('e1', 2L, 'd2', 'Ambit', TIMESTAMP'2026-09-02 09:30:00', 'Not/AZone', DATE'2026-09-02',
           CAST(array() AS ARRAY<STRUCT<id: STRING, name: STRING, filename: STRING>>),
           parse_json('{{"plot": "B2"}}'), CAST(array() AS ARRAY<{_ANNOTATION}>),
           'u2', 'c9', 'p1', 'w1', 52.1D, 5.2D, parse_json('[{{"x": 2}}]'), TIMESTAMP'2026-09-23 10:01:00'),
          ('e2', 3L, 'd1', 'MultispeQ', TIMESTAMP'2026-09-03 10:00:00', CAST(NULL AS STRING), DATE'2026-09-03',
           CAST(NULL AS ARRAY<STRUCT<id: STRING, name: STRING, filename: STRING>>),
           CAST(NULL AS VARIANT), CAST(NULL AS ARRAY<{_ANNOTATION}>),
           'u1', 'c1', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS DOUBLE), CAST(NULL AS DOUBLE),
           parse_json('[]'), TIMESTAMP'2026-09-23 10:02:00')
        AS t(experiment_id, id, device_id, device_name, timestamp, timezone, date, macros, questions_data,
             annotations, user_id, client_id, protocol_id, workbook_run_id, latitude, longitude, data,
             processed_timestamp)
    """,
    "experiment_macro_data": f"""
        SELECT * FROM VALUES
          ('e1', 101, 1L, 'd1', 'c1', 'MultispeQ', TIMESTAMP'2026-09-01 08:00:00', 'Europe/Amsterdam', 'u1',
           52.0D, 5.1D, 'mac-1', 'Fluo', 'fluo.py', 'w1', 'v1', parse_json('{{"phi2": 0.7}}'),
           CAST(NULL AS STRING), TIMESTAMP'2026-09-23 10:05:00', DATE'2026-09-01',
           parse_json('{{"plot": "A1"}}'), array({_PAYLOAD_ANNOTATION})),
          ('e1', 102, 2L, 'd2', 'c9', 'Ambit', TIMESTAMP'2026-09-02 09:30:00', 'Not/AZone', 'u2',
           52.1D, 5.2D, 'mac-1', 'Fluo', 'fluo.py', 'w1', 'v1', CAST(NULL AS VARIANT),
           'Macro failed', TIMESTAMP'2026-09-23 10:06:00', DATE'2026-09-02',
           parse_json('{{"plot": "B2"}}'), CAST(NULL AS ARRAY<{_ANNOTATION}>))
        AS t(experiment_id, id, raw_id, device_id, client_id, device_name, timestamp, timezone, user_id,
             latitude, longitude, macro_id, macro_name, macro_filename, workbook_run_id, workbook_version_id,
             macro_output, macro_error, processed_timestamp, date, questions_data, annotations)
    """,
    "experiment_uploaded_data": """
        SELECT * FROM VALUES
          (1001L, 'e1', 't1', 'Soil samples', 'up-1', 'u1', TIMESTAMP'2026-09-04 12:00:00',
           parse_json('{"ph": 6.5}')),
          (1002L, 'e1', 't1', 'Soil samples', 'up-1', 'u3', TIMESTAMP'2026-09-04 12:00:00',
           parse_json('{"ph": 7.1}'))
        AS t(id, experiment_id, upload_table_id, upload_table_name, upload_id, created_by, uploaded_at,
             uploaded_data)
    """,
    "experiment_contributors": """
        SELECT * FROM VALUES
          ('e1', 'u1', named_struct('id', 'u1', 'name', 'Ann', 'avatar', CAST(NULL AS STRING))),
          ('e2', 'u1', named_struct('id', 'u1', 'name', 'Ann', 'avatar', 'ann.png'))
        AS t(experiment_id, user_id, user)
    """,
    "experiment_devices": """
        SELECT * FROM VALUES
          ('e1', 'c1', named_struct('id', 'dev-1', 'serial_number', 'SN1', 'owner', 'org-1',
                                    'status', 'onboarded', 'device_type', 'multispeq'))
        AS t(experiment_id, client_id, device)
    """,
    "experiment_annotations": """
        SELECT * FROM VALUES
          ('a2', 'e1', 'u2', 'Bob', 'raw', '1', 'flag', 'recheck', 'outlier',
           TIMESTAMP'2026-09-05 10:00:00', TIMESTAMP'2026-09-05 10:00:00'),
          ('a1', 'e1', 'u1', 'Ann', 'raw', '1', 'comment', 'looks off', CAST(NULL AS STRING),
           TIMESTAMP'2026-09-05 09:00:00', TIMESTAMP'2026-09-05 09:30:00'),
          ('a3', 'e2', 'u1', 'Ann', 'raw', '1', 'comment', 'same row id, other experiment', CAST(NULL AS STRING),
           TIMESTAMP'2026-09-05 11:00:00', TIMESTAMP'2026-09-05 11:00:00'),
          ('a4', 'e2', 'u1', 'Ann', 'raw', '3', 'comment', 'third', CAST(NULL AS STRING),
           TIMESTAMP'2026-09-05 12:00:00', TIMESTAMP'2026-09-05 12:00:00'),
          ('a5', 'e1', 'u1', 'Ann', 'macro', '101', 'comment', 'macro note', CAST(NULL AS STRING),
           TIMESTAMP'2026-09-05 13:00:00', TIMESTAMP'2026-09-05 13:00:00'),
          ('a6', 'e1', 'u1', 'Ann', 'upload', '1001', 'comment', 'upload note', CAST(NULL AS STRING),
           TIMESTAMP'2026-09-05 14:00:00', TIMESTAMP'2026-09-05 14:00:00')
        AS t(id, experiment_id, user_id, user_name, table_name, row_id, type, content_text, flag_type,
             created_at, updated_at)
    """,
    "experiment_custom_metadata": """
        SELECT * FROM VALUES
          ('md-1', 'e1',
           parse_json('{"identifierColumnId": "plot", "experimentQuestionId": "plot", "rows": [
             {"_id": "a", "plot": "A1", "soil": "clay", "color": "red"},
             {"_id": "b", "plot": "B2", "soil": "sand"}]}'),
           'u1', TIMESTAMP'2026-09-01 00:00:00', TIMESTAMP'2026-09-01 00:00:00'),
          ('md-2', 'e1',
           parse_json('{"identifierColumnId": "device", "experimentQuestionId": "column:device_id", "rows": [
             {"_id": "c", "device": "d1", "color": "blue"}]}'),
           'u1', TIMESTAMP'2026-09-02 00:00:00', TIMESTAMP'2026-09-02 00:00:00')
        AS t(metadata_id, experiment_id, metadata, created_by, created_at, updated_at)
    """,
}

# The pipeline reads the backend's tables through these mirrors; the views read
# the backend's tables directly.
_MIRRORS = {
    "experiment_annotations_source": "experiment_annotations",
    "experiment_metadata_source": "experiment_custom_metadata",
}


@pytest.fixture(scope="module")
def centrum(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    location = tmp_path_factory.mktemp("centrum")
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_CATALOG}.centrum LOCATION '{location}'")
    for name, query in _TABLES.items():
        spark.sql(f"CREATE TABLE {_CATALOG}.centrum.{name} USING parquet AS {query}")
    for mirror, source in _MIRRORS.items():
        spark.sql(
            f"CREATE TABLE {_CATALOG}.centrum.{mirror} USING parquet AS SELECT * FROM {_CATALOG}.centrum.{source}"
        )

    yield f"{_CATALOG}.centrum"

    spark.sql(f"DROP DATABASE {_CATALOG}.centrum CASCADE")


def _materialized_view(
    spark: SparkSession,
    fake_dlt: types.ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    schema: str,
    notebook: str,
    function: str,
) -> DataFrame:
    """What the pipeline's materialized view computes, from the notebook itself."""
    runtime = types.ModuleType("openjii.macros.runtime")
    runtime.centrum_table = lambda name: f"{schema}.{name}"  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.macros.runtime", runtime)
    monkeypatch.setattr(fake_dlt, "read", lambda name: spark.table(f"{schema}.{name}"))

    spec = importlib.util.spec_from_file_location(f"enriched_parity_{function}", _PIPELINES / notebook)
    assert spec is not None and spec.loader is not None
    pipeline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pipeline)
    monkeypatch.setattr(pipeline, "spark", spark, raising=False)

    return getattr(pipeline, function)()


def _view(spark: SparkSession, name: str) -> DataFrame:
    return spark.sql((_VIEWS / f"{name}.sql").read_text().replace("${catalog}", _CATALOG))


def _comparable(frame: DataFrame) -> tuple[list[tuple[str, str]], list[dict[str, Any]]]:
    schema = [(field.name, field.dataType.simpleString()) for field in frame.schema.fields]
    readable = [
        F.to_json(F.col(field.name)).alias(field.name)
        if field.dataType.typeName() == "variant"
        else F.col(field.name)
        for field in frame.schema.fields
    ]
    rows = [row.asDict(recursive=True) for row in frame.select(*readable).orderBy("id").collect()]
    return schema, rows


@pytest.mark.parametrize(
    ("name", "notebook"),
    [
        ("enriched_experiment_raw_data", "centrum/enriched/enriched_experiment_raw_data.py"),
        ("enriched_experiment_macro_data", "macros/enriched_experiment_macro_data.py"),
        ("enriched_experiment_uploaded_data", "centrum/enriched/enriched_experiment_uploaded_data.py"),
    ],
)
def test_the_view_returns_what_the_materialized_view_computes(
    spark: SparkSession,
    fake_dlt: types.ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    centrum: str,
    name: str,
    notebook: str,
) -> None:
    expected = _materialized_view(spark, fake_dlt, monkeypatch, centrum, notebook, name)

    assert _comparable(_view(spark, name)) == _comparable(expected)
