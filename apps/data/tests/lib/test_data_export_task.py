import ast
import math
from pathlib import Path
from typing import Any

import pytest

_TASK_PATH = Path(__file__).parents[2] / "src/tasks/data_export_task.py"
_NAMES = {
    "ROWS_PER_PART",
    "DRIVER_FORMAT_MAX_ROWS",
    "EXCEL_MAX_COLUMNS",
    "MANIFEST_NAME",
    "ExportError",
    "part_count",
    "check_driver_format_limits",
    "build_manifest",
    "is_part_file",
}


def _defined_name(node: ast.stmt) -> str | None:
    if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
        return node.name
    if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
        return node.targets[0].id
    return None


@pytest.fixture(scope="module")
def task() -> dict[str, Any]:
    module = ast.parse(_TASK_PATH.read_text())
    body = [node for node in module.body if _defined_name(node) in _NAMES]
    namespace: dict[str, Any] = {"math": math}
    exec(compile(ast.Module(body=body, type_ignores=[]), _TASK_PATH, "exec"), namespace)
    return namespace


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
