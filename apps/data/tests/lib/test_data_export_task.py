import ast
from pathlib import Path
from typing import Any

import pytest
from openjii.helpers import TableMetadataNotFound
from pyspark.sql import SparkSession

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
    "anonymize_contributors",
    "open_table",
}

# Pinned in the backend's specs too, so every implementation of the pseudonym answers this pair alike.
_EXPERIMENT_ID = "5f3c1b9e-2a47-4d6b-9e1f-7a8c0d2b4e61"
_USER_ID = "0b5c5c9e-5f7a-4d0e-9a51-6b0e3c3a1f01"
_PSEUDONYM = "Contributor-AC2F1B"

_CONTRIBUTOR = "STRUCT<id: STRING, name: STRING, avatar: STRING>"


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
