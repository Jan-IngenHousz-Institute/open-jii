"""Tests for openjii.helpers.load_experiment_table, which every data export reads through."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from openjii.helpers import load_experiment_table
from pyspark.sql import SparkSession

_CATALOG = "spark_catalog"
_SCHEMA = "export_loader"

_TABLES = {
    "experiment_table_metadata": """
        SELECT * FROM VALUES
          ('e1', 'raw_data', 'static', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS STRING),
           CAST(NULL AS STRING)),
          ('e1', 'macro-1', 'macro', 'STRUCT<phi2: DOUBLE>', CAST(NULL AS STRING), CAST(NULL AS STRING),
           CAST(NULL AS STRING)),
          ('e1', 'upload-1', 'upload', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS STRING),
           'OBJECT<plot: STRING, yield: DOUBLE>'),
          ('e1', 'mystery', 'static', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS STRING),
           CAST(NULL AS STRING))
        AS t(experiment_id, identifier, table_type, macro_schema, questions_schema, custom_metadata_schema,
             upload_schema)
    """,
    "enriched_experiment_uploaded_data": """
        SELECT * FROM VALUES
          (1L, 'e1', 'upload-1', 'Field trial', 'up-a', TIMESTAMP'2026-10-01 10:00:00',
           parse_json('{"plot": "A1", "yield": 2.5}')),
          (2L, 'e1', 'upload-2', 'Greenhouse', 'up-b', TIMESTAMP'2026-10-01 11:00:00',
           parse_json('{"plot": "B1", "yield": 1.0}')),
          (3L, 'e1', 'upload-1', 'Field trial', 'up-a', TIMESTAMP'2026-10-01 09:00:00',
           parse_json('{"plot": "C1", "yield": 3.0}'))
        AS t(id, experiment_id, upload_table_id, upload_table_name, upload_id, uploaded_at, uploaded_data)
    """,
    # A macro whose id equals an upload table's, so a loader that reads upload tables as macros
    # returns this row instead of the uploaded ones.
    "enriched_experiment_macro_data": """
        SELECT * FROM VALUES
          ('e1', 'macro-1', TIMESTAMP'2026-10-01 10:00:00', parse_json('{"phi2": 0.7}')),
          ('e1', 'upload-1', TIMESTAMP'2026-10-01 10:00:00', parse_json('{"phi2": 0.1}'))
        AS t(experiment_id, macro_id, timestamp, macro_output)
    """,
}


@pytest.fixture(scope="module")
def schema(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    location = tmp_path_factory.mktemp(_SCHEMA)
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_CATALOG}.{_SCHEMA} LOCATION '{location}'")
    for name, query in _TABLES.items():
        spark.sql(f"CREATE TABLE {_CATALOG}.{_SCHEMA}.{name} USING parquet AS {query}")

    yield _SCHEMA

    spark.sql(f"DROP DATABASE {_CATALOG}.{_SCHEMA} CASCADE")


def _load(table_name: str, schema: str):
    return load_experiment_table("e1", table_name, _CATALOG, schema_name=schema)


def test_upload_table_reads_its_own_uploaded_rows_ordered_by_upload_time(schema: str) -> None:
    rows = _load("upload-1", schema).collect()

    assert [(row.plot, row["yield"]) for row in rows] == [("C1", 3.0), ("A1", 2.5)]


def test_parts_split_the_rows_into_that_many_partitions_in_row_order(schema: str) -> None:
    table = load_experiment_table("e1", "upload-1", _CATALOG, schema_name=schema, parts=2)

    assert table.rdd.getNumPartitions() == 2
    assert [row.plot for row in table.collect()] == ["C1", "A1"]


def test_upload_table_drops_its_bookkeeping_and_raw_payload_columns(schema: str) -> None:
    columns = _load("upload-1", schema).columns

    assert columns == ["id", "uploaded_at", "plot", "yield"]


def test_macro_table_still_reads_its_macro_rows(schema: str) -> None:
    rows = _load("macro-1", schema).collect()

    assert [row.phi2 for row in rows] == [0.7]


def test_static_identifier_without_a_source_is_refused(schema: str) -> None:
    with pytest.raises(ValueError, match="Unknown table type"):
        _load("mystery", schema)
