import ast
import csv
import gzip
import json
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from openjii.helpers import TableMetadataNotFound
from openpyxl import load_workbook
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col

_TASK_PATH = Path(__file__).parents[2] / "src/tasks/data_export_task.py"
_NAMES = {
    "log",
    "ROWS_PER_PART",
    "DRIVER_FORMAT_MAX_ROWS",
    "EXCEL_MAX_COLUMNS",
    "MANIFEST_NAME",
    "ExportError",
    "part_count",
    "check_driver_format_limits",
    "build_manifest",
    "is_part_file",
    "CONTRIBUTOR_STRUCT_FIELDS",
    "_is_contributor_field",
    "_contributor_pseudonym",
    "_anonymize_annotation",
    "anonymize_contributors",
    "flatten_complex_columns",
    "write_parts",
    "take_snapshot",
    "open_table",
}

# Pinned in the backend's specs too, so every implementation of the pseudonym answers this pair alike.
_EXPERIMENT_ID = "5f3c1b9e-2a47-4d6b-9e1f-7a8c0d2b4e61"
_USER_ID = "0b5c5c9e-5f7a-4d0e-9a51-6b0e3c3a1f01"
_PSEUDONYM = "Contributor-AC2F1B"

_CONTRIBUTOR = "STRUCT<id: STRING, name: STRING, avatar: STRING>"
_ANNOTATIONS = """ARRAY<STRUCT<id: STRING, rowId: STRING, type: STRING,
    content: STRUCT<text: STRING, flagType: STRING>, createdBy: STRING, createdByName: STRING,
    createdAt: TIMESTAMP, updatedAt: TIMESTAMP>>"""
_ROW_ID = 3676402656019468888
_WIDE_INTEGER = Decimal("-12345678901234567890")


def _defined_name(node: ast.stmt) -> str | None:
    if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
        return node.name
    if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
        return node.targets[0].id
    return None


def _is_local_import(node: ast.stmt) -> bool:
    """An import that resolves off Databricks too."""
    if isinstance(node, ast.ImportFrom):
        return node.module != "pyspark.dbutils"
    return isinstance(node, ast.Import)


@pytest.fixture(scope="module")
def task() -> dict[str, Any]:
    module = ast.parse(_TASK_PATH.read_text())
    body = [node for node in module.body if _is_local_import(node) or _defined_name(node) in _NAMES]
    namespace: dict[str, Any] = {}
    exec(compile(ast.Module(body=body, type_ignores=[]), _TASK_PATH, "exec"), namespace)
    return namespace


def _contributors(spark: SparkSession):
    return spark.createDataFrame(
        [(1, (_USER_ID, "Ada", "ada.png")), (2, None)],
        f"row INT, contributor {_CONTRIBUTOR}",
    )


def test_an_export_names_a_contributor_by_the_pseudonym_the_platform_shows(task, spark: SparkSession) -> None:
    rows = task["anonymize_contributors"](_contributors(spark), _EXPERIMENT_ID).collect()

    assert [row.contributor.asDict() if row.contributor else None for row in rows] == [
        {"id": _PSEUDONYM, "name": _PSEUDONYM, "avatar": None},
        None,
    ]


def test_an_experiment_id_reaches_the_pseudonym_as_a_value_not_as_sql(task, spark: SparkSession) -> None:
    [row, _] = task["anonymize_contributors"](_contributors(spark), "e'1").collect()

    assert row.contributor.id == "Contributor-57AC94"


@pytest.fixture
def export_rows(spark: SparkSession) -> DataFrame:
    created = datetime(2026, 11, 21, 12)
    edited = datetime(2026, 11, 21, 13)
    notes = [
        ("web-comment", str(_ROW_ID), "comment", ("Review this row", None), _USER_ID, "Ada", created, edited),
        ("mobile-note", str(_ROW_ID), "comment", ("From the field", None), None, None, created, created),
    ]
    return spark.createDataFrame(
        [(_ROW_ID, _WIDE_INTEGER, 7, 0.5, notes), (None, None, 8, 0.25, [])],
        f"id BIGINT, `whole.number` DECIMAL(20, 0), sample_count INT, reading DOUBLE, annotations {_ANNOTATIONS}",
    ).coalesce(1)


@pytest.mark.parametrize("anonymize", [True, False])
def test_snapshot_applies_the_export_setting_to_both_annotation_columns_without_a_contributor_column(
    task, spark: SparkSession, export_rows: DataFrame, anonymize: bool, tmp_path: Path, monkeypatch
) -> None:
    source = export_rows.withColumn("payload_annotations", col("annotations"))
    monkeypatch.setitem(task, "spark", spark)
    monkeypatch.setitem(task, "EXPERIMENT_ID", _EXPERIMENT_ID)
    monkeypatch.setitem(task, "ANONYMIZE_CONTRIBUTORS", anonymize)
    monkeypatch.setitem(task, "SNAPSHOT_PATH", str(tmp_path / "snapshot"))
    monkeypatch.setitem(task, "WRITES_IN_PARTS", True)

    snapshot = task["take_snapshot"](SimpleNamespace(rows=lambda: source))

    expected = [row.asDict(recursive=True) for row in source.orderBy("sample_count").collect()]
    if anonymize:
        for name in ("annotations", "payload_annotations"):
            expected[0][name][0].update(createdBy=_PSEUDONYM, createdByName=_PSEUDONYM)
    assert [row.asDict(recursive=True) for row in snapshot.orderBy("sample_count").collect()] == expected


def _read_export(spark: SparkSession, export_format: str, output: Path) -> list[dict[str, Any]]:
    if export_format == "parquet":
        return [row.asDict(recursive=True) for row in spark.read.parquet(str(output)).collect()]
    [part] = output.glob("part-*")
    if export_format == "xlsx":
        workbook = load_workbook(part, read_only=True)
        try:
            headers, *values = workbook["Sheet1"].values
            names = [str(header) for header in headers]
            return [dict(zip(names, row, strict=True)) for row in values]
        finally:
            workbook.close()
    if export_format == "json-array":
        return json.loads(part.read_text())
    with gzip.open(part, "rt", encoding="utf-8") as file:
        if export_format == "csv":
            return list(csv.DictReader(file))
        return [json.loads(line) for line in file]


@pytest.mark.parametrize("export_format", ["csv", "ndjson", "json-array", "parquet", "xlsx"])
def test_export_files_keep_integer_values_and_use_the_same_comment_pseudonyms(
    task, spark: SparkSession, export_rows: DataFrame, export_format: str, tmp_path: Path, monkeypatch
) -> None:
    output = tmp_path / "export"
    mock_files = SimpleNamespace(
        create_directory=lambda path: Path(path).mkdir(parents=True, exist_ok=True),
        upload=lambda path, payload, overwrite: Path(path).write_bytes(payload.read()),
    )
    monkeypatch.setitem(
        sys.modules,
        "databricks.sdk",
        SimpleNamespace(WorkspaceClient=lambda: SimpleNamespace(files=mock_files)),
    )
    monkeypatch.setitem(task, "FORMAT", export_format)
    monkeypatch.setitem(task, "OUTPUT_PATH", str(output))

    task["write_parts"](task["anonymize_contributors"](export_rows, _EXPERIMENT_ID))

    rows = _read_export(spark, export_format, output)
    assert len(rows) == 2
    row, blank = sorted(rows, key=lambda value: int(value["sample_count"]))
    assert row["id"] == (str(_ROW_ID) if export_format in ("csv", "xlsx") else _ROW_ID)
    assert int(row["whole.number"]) == _WIDE_INTEGER
    assert blank.get("id") == ("" if export_format == "csv" else None)
    if export_format == "xlsx":
        assert row["whole.number"] == str(_WIDE_INTEGER)
        assert row["sample_count"] == 7
        assert row["reading"] == 0.5

    annotations = row["annotations"]
    if isinstance(annotations, str):
        annotations = json.loads(annotations)
    web_comment, mobile_note = annotations
    assert (web_comment["createdBy"], web_comment["createdByName"]) == (_PSEUDONYM, _PSEUDONYM)
    assert web_comment["content"]["text"] == "Review this row"
    assert mobile_note.get("createdBy") is None
    assert mobile_note.get("createdByName") is None
    assert mobile_note["content"]["text"] == "From the field"


@pytest.mark.parametrize(
    ("row_count", "parts"),
    [(1, 1), (1_000_000, 1), (1_000_001, 2), (32_117_212, 33)],
)
def test_part_count_keeps_each_part_to_a_million_rows(task, row_count: int, parts: int) -> None:
    assert task["part_count"](row_count) == parts


@pytest.mark.parametrize("export_format", ["csv", "ndjson", "parquet"])
def test_spark_formats_have_no_row_cap(task, export_format: str) -> None:
    task["check_driver_format_limits"](export_format, 50_000_000, 20_000)


@pytest.mark.parametrize("export_format", ["xlsx", "json-array"])
def test_driver_formats_take_rows_up_to_the_excel_sheet_limit(task, export_format: str) -> None:
    task["check_driver_format_limits"](export_format, 1_048_575, 10)

    with pytest.raises(task["ExportError"], match=r"^EXPORT_ERROR\[too_many_rows_for_format\] "):
        task["check_driver_format_limits"](export_format, 1_048_576, 10)


def test_excel_refuses_more_columns_than_a_sheet_holds(task) -> None:
    task["check_driver_format_limits"]("xlsx", 10, 16_384)

    with pytest.raises(task["ExportError"], match=r"^EXPORT_ERROR\[too_many_rows_for_format\] "):
        task["check_driver_format_limits"]("xlsx", 10, 16_385)


def test_manifest_names_the_parts_in_the_shape_the_backend_reads(task) -> None:
    parts = [{"name": "part-00000.csv.gz", "sizeBytes": 10}, {"name": "part-00001.csv.gz", "sizeBytes": 4}]

    manifest = task["build_manifest"]("export-1", "csv", 1_500_000, "2026-10-19T13:18:50+00:00", parts)

    assert manifest == {
        "exportId": "export-1",
        "format": "csv",
        "rowCount": 1_500_000,
        "snapshotAt": "2026-10-19T13:18:50+00:00",
        "parts": parts,
    }


@pytest.mark.parametrize(
    ("name", "is_part"),
    [
        ("part-00000-tid-1-c000.snappy.parquet", True),
        ("part-00000.xlsx", True),
        ("_SUCCESS", False),
        ("_committed_1943093495904537985", False),
        (".part-00000.crc", False),
        ("manifest.json", False),
    ],
)
def test_only_data_files_count_as_parts(task, name: str, is_part: bool) -> None:
    assert task["is_part_file"](name) is is_part


def test_a_table_that_never_held_a_row_opens_as_none(task, monkeypatch: pytest.MonkeyPatch) -> None:
    def no_metadata(*_args: object, **_kwargs: object) -> None:
        raise TableMetadataNotFound("No metadata found for experiment e1, identifier raw_data")

    monkeypatch.setitem(task, "ExperimentTable", no_metadata)
    for name, value in {
        "EXPERIMENT_ID": "e1",
        "TABLE_NAME": "raw_data",
        "CATALOG_NAME": "open_jii_dev",
    }.items():
        monkeypatch.setitem(task, name, value)

    assert task["open_table"]() is None
