import ast
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

_TASK_PATH = Path(__file__).parents[2] / "src/tasks/export_carry_over_task.py"
_NAMES = {
    "ROWS_PER_PART",
    "MANIFEST_NAME",
    "TABLE_NAME_PATTERN",
    "PART_NAME_PATTERN",
    "MAX_PARTS",
    "is_acceptable",
    "parse_legacy_output",
    "iso_utc",
    "part_count",
    "is_part_file",
    "carried_record",
    "batches",
}


def _defined_name(node: ast.stmt) -> str | None:
    if isinstance(node, ast.FunctionDef):
        return node.name
    if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
        return node.targets[0].id
    return None


@pytest.fixture(scope="module")
def task() -> dict[str, Any]:
    module = ast.parse(_TASK_PATH.read_text())
    body = [node for node in module.body if _defined_name(node) in _NAMES]
    namespace: dict[str, Any] = {
        "ast": ast,
        "math": math,
        "re": re,
        "datetime": datetime,
        "timezone": timezone,
    }
    exec(compile(ast.Module(body=body, type_ignores=[]), _TASK_PATH, "exec"), namespace)
    return namespace


# The exit value the old export task left on a run, as the jobs API returns it.
_LEGACY_OUTPUT = (
    "{'status': 'success', 'row_count': 32117212, 'experiment_id': 'e1', 'table_name': 't1', "
    "'format': 'parquet', 'export_id': '00847416-2ed1-4fcc-8861-09fca144906b', "
    "'write_time': '20261019_131917', 'file_path': '/Volumes/c/centrum/data-exports/e1/t1/parquet/x/part.parquet'}"
)


def test_reads_the_old_tasks_exit_value(task) -> None:
    output = task["parse_legacy_output"](_LEGACY_OUTPUT)

    assert output["export_id"] == "00847416-2ed1-4fcc-8861-09fca144906b"
    assert output["row_count"] == 32117212


@pytest.mark.parametrize(
    "result",
    [None, "", "not a dict", "{'status': 'no_data', 'row_count': 0}", "{'status': 'success'}"],
)
def test_skips_runs_that_wrote_no_export(task, result) -> None:
    assert task["parse_legacy_output"](result) is None


def test_timestamps_are_utc_with_milliseconds_and_a_z(task) -> None:
    assert task["iso_utc"](1792415930982) == "2026-10-19T13:18:50.982Z"


def test_record_carries_what_the_backend_needs(task) -> None:
    params = {
        "EXPERIMENT_ID": "e1",
        "TABLE_NAME": "t1",
        "FORMAT": "parquet",
        "USER_ID": "u1",
        "ANONYMIZE_CONTRIBUTORS": "true",
    }
    output = task["parse_legacy_output"](_LEGACY_OUTPUT)
    parts = [{"name": "part-00000.snappy.parquet", "sizeBytes": 10}]

    record = task["carried_record"](params, output, 200436574855526, 1792415930982, 1792417121696, parts)

    assert record == {
        "exportId": "00847416-2ed1-4fcc-8861-09fca144906b",
        "experimentId": "e1",
        "tableName": "t1",
        "format": "parquet",
        "anonymizeContributors": True,
        "jobRunId": 200436574855526,
        "rowCount": 32117212,
        "parts": parts,
        "createdBy": "u1",
        "createdAt": "2026-10-19T13:18:50.982Z",
        "completedAt": "2026-10-19T13:38:41.696Z",
    }


def test_runs_from_before_the_anonymisation_setting_are_not_anonymised(task) -> None:
    params = {"EXPERIMENT_ID": "e1", "TABLE_NAME": "t1", "FORMAT": "csv", "USER_ID": "u1"}
    output = task["parse_legacy_output"](_LEGACY_OUTPUT)

    record = task["carried_record"](params, output, 1, 0, 0, [])

    assert record["anonymizeContributors"] is False


def test_a_large_parquet_export_is_cut_like_a_new_one(task) -> None:
    assert task["part_count"](32117212) == 33
    assert task["part_count"](10) == 1


def test_batches_cover_every_record_once(task) -> None:
    assert list(task["batches"](list(range(7)), 3)) == [[0, 1, 2], [3, 4, 5], [6]]


def _record(**overrides: Any) -> dict:
    return {
        "exportId": "x1",
        "tableName": "182c8c4c-41d1-4eba-a0af-34635f7773d7",
        "rowCount": 10,
        "parts": [{"name": "part-00000-tid-1-c000.snappy.parquet", "sizeBytes": 1}],
        **overrides,
    }


def test_accepts_what_the_backend_accepts(task) -> None:
    assert task["is_acceptable"](_record())
    assert task["is_acceptable"](
        _record(tableName="raw_data", parts=[{"name": "raw_data.xlsx", "sizeBytes": 1}])
    )


@pytest.mark.parametrize(
    "overrides",
    [
        {"tableName": "raw data"},
        {"rowCount": 0},
        {"parts": []},
        {"parts": [{"name": "..", "sizeBytes": 1}]},
        {"parts": [{"name": "a/b.csv", "sizeBytes": 1}]},
    ],
)
def test_refuses_what_the_backend_would_refuse(task, overrides) -> None:
    assert not task["is_acceptable"](_record(**overrides))
