"""Tests for openjii.helpers.load_experiment_table, which every data export reads through."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from openjii.helpers import load_experiment_table
from pyspark.sql import SparkSession
from pyspark.sql.types import StringType

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
          ('e2', 'upload-1', 'upload', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS STRING),
           'OBJECT<plot: STRING, yield: DOUBLE, block: STRING>'),
          ('e1', 'upload-big', 'upload', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS STRING),
           'OBJECT<plot: STRING, yield: DOUBLE>'),
          ('e1', 'upload-nested', 'upload', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS STRING),
           'OBJECT<id: BIGINT, counts: ARRAY<DOUBLE>, note: VOID>'),
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
           parse_json('{"plot": "C1", "yield": 3.0}')),
          (4L, 'e2', 'upload-1', 'Other experiment', 'up-d', TIMESTAMP'2026-10-01 08:00:00',
           parse_json('{"plot": "D1", "yield": 99.0, "block": "north"}')),
          (5L, 'e1', 'upload-nested', 'Nested trial', 'up-e', TIMESTAMP'2026-10-03 08:00:00',
           parse_json('{"id": 200, "counts": null, "note": null}')),
          (6L, 'e1', 'upload-nested', 'Nested trial', 'up-e', TIMESTAMP'2026-10-02 08:00:00',
           parse_json('{"id": 100, "counts": [1.0, 2.0], "note": null}'))
        AS t(id, experiment_id, upload_table_id, upload_table_name, upload_id, uploaded_at, uploaded_data)
        UNION ALL
        -- One upload of 300 rows, which all share its upload time.
        SELECT 100L + id, 'e1', 'upload-big', 'Big trial', 'up-c', TIMESTAMP'2026-10-02 08:00:00',
          parse_json(concat('{"plot": "P', CAST(id AS STRING), '", "yield": 1.0}'))
        FROM range(300)
    """,
    # A macro whose id equals an upload table's, so a loader that reads upload tables as macros
    # returns this row instead of the uploaded ones. Result 1 was computed again on a copy of its
    # measurement.
    "enriched_experiment_macro_data": """
        SELECT * FROM VALUES
          (1L, 'e1', 'macro-1', 10L, 'device-a', TIMESTAMP'2026-10-01 10:00:00', parse_json('{"phi2": 0.7}'),
           TIMESTAMP'2026-10-01 10:01:00', array('from the phone', 'from the platform'), array('from the phone')),
          (2L, 'e1', 'upload-1', 10L, 'device-a', TIMESTAMP'2026-10-01 10:00:00', parse_json('{"phi2": 0.1}'),
           TIMESTAMP'2026-10-01 10:01:00', array('from the phone'), array('from the phone')),
          (1L, 'e1', 'macro-1', 10L, 'device-a', TIMESTAMP'2026-10-01 10:00:00', parse_json('{"phi2": 0.7}'),
           TIMESTAMP'2026-10-01 10:31:00', array('from the phone', 'from the platform'), array('from the phone'))
        AS t(id, experiment_id, macro_id, raw_id, device_id, timestamp, macro_output, processed_timestamp,
             annotations, payload_annotations)
    """,
    # Capture 10 arrived twice, so it is stored twice under one id; the later copy carries a comment
    # added before the phone sent it again. Id 12 is an old 32-bit id two different captures share.
    "enriched_experiment_raw_data": """
        SELECT * FROM VALUES
          (10L, 'e1', TIMESTAMP'2026-10-01 10:00:00', 'device-a', TIMESTAMP'2026-10-01 10:01:00', 0),
          (11L, 'e1', TIMESTAMP'2026-10-01 11:00:00', 'device-a', TIMESTAMP'2026-10-01 11:01:00', 0),
          (10L, 'e1', TIMESTAMP'2026-10-01 10:00:00', 'device-a', TIMESTAMP'2026-10-01 10:31:00', 1),
          (12L, 'e1', TIMESTAMP'2026-10-01 12:00:00', 'device-a', TIMESTAMP'2026-10-01 12:01:00', 0),
          (12L, 'e1', TIMESTAMP'2026-10-01 12:00:00', 'device-b', TIMESTAMP'2026-10-01 12:01:00', 0)
        AS t(id, experiment_id, timestamp, device_id, processed_timestamp, comments)
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


def test_upload_table_reads_only_its_experiments_rows_and_schema(schema: str) -> None:
    table = load_experiment_table("e2", "upload-1", _CATALOG, schema_name=schema)

    assert table.columns == ["id", "uploaded_at", "plot", "yield", "block"]
    assert [(row.plot, row.block) for row in table.collect()] == [("D1", "north")]


def test_upload_payload_preserves_arrays_and_nulls_without_shadowing_row_ids(schema: str) -> None:
    table = _load("upload-nested", schema)

    assert table.columns == ["id", "uploaded_at", "id_upload", "counts", "note"]
    assert table.schema["note"].dataType == StringType()
    assert [(row.id, row.id_upload, row.counts, row.note) for row in table.collect()] == [
        (6, 100, [1.0, 2.0], None),
        (5, 200, None, None),
    ]


def test_parts_split_the_rows_into_that_many_partitions_in_row_order(schema: str) -> None:
    table = load_experiment_table("e1", "upload-1", _CATALOG, schema_name=schema, parts=2)

    assert table.rdd.getNumPartitions() == 2
    assert [row.plot for row in table.collect()] == ["C1", "A1"]


def test_parts_split_rows_that_share_their_upload_time(schema: str) -> None:
    table = load_experiment_table("e1", "upload-big", _CATALOG, schema_name=schema, parts=3)

    sizes = table.rdd.glom().map(len).collect()
    assert len(sizes) == 3
    assert all(size > 0 for size in sizes)
    assert [row.id for row in table.collect()] == list(range(100, 400))


def test_upload_table_drops_its_bookkeeping_and_raw_payload_columns(schema: str) -> None:
    columns = _load("upload-1", schema).columns

    assert columns == ["id", "uploaded_at", "plot", "yield"]


def test_macro_table_still_reads_its_macro_rows(schema: str) -> None:
    rows = _load("macro-1", schema).collect()

    assert [row.phi2 for row in rows] == [0.7]


def test_a_capture_stored_twice_exports_once(schema: str) -> None:
    rows = _load("raw_data", schema).collect()

    assert [row.id for row in rows][:2] == [10, 11]


def test_a_capture_stored_twice_exports_the_copy_processed_last(schema: str) -> None:
    [capture] = [row for row in _load("raw_data", schema).collect() if row.id == 10]

    assert capture.comments == 1


def test_different_captures_that_share_an_old_id_both_export(schema: str) -> None:
    rows = _load("raw_data", schema).collect()

    assert sorted(row.device_id for row in rows if row.id == 12) == ["device-a", "device-b"]


def test_exports_keep_every_annotation_and_leave_the_phones_share_out(schema: str) -> None:
    table = _load("macro-1", schema)

    assert "payload_annotations" not in table.columns
    assert [row.annotations for row in table.collect()] == [["from the phone", "from the platform"]]


def test_static_identifier_without_a_source_is_refused(schema: str) -> None:
    with pytest.raises(ValueError, match="Unknown table type"):
        _load("mystery", schema)
