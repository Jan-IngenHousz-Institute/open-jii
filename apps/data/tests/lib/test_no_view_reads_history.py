"""No table in the pipelines may read the measurement rows in full on a trigger.

The pipelines run on classic compute, where a batch read inside a dataset is a
materialized view recomputed from scratch on every refresh. Over silver or a
payload table that is a scan of every measurement ever taken. Streaming reads
and reads of the rollups are fine. A deliberate full refresh is not affected.

The allowlist names what still does it; it only ever shrinks.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

_PIPELINES = Path(__file__).parents[2] / "src/pipelines"

_MEASUREMENT_TABLES = {
    "SILVER_TABLE",
    "EXPERIMENT_RAW_DATA_TABLE",
    "EXPERIMENT_UPLOADED_DATA_TABLE",
    "EXPERIMENT_MACRO_DATA_TABLE",
    "ENRICHED_RAW_DATA_VIEW",
    "ENRICHED_UPLOADED_DATA_VIEW",
    "ENRICHED_MACRO_DATA_VIEW",
}

_ALLOWED = {
    "centrum/enriched/enriched_experiment_raw_data.py",
    "centrum/enriched/enriched_experiment_uploaded_data.py",
    "macros/enriched_experiment_macro_data.py",
}

_NOTEBOOKS = sorted(
    path.relative_to(_PIPELINES).as_posix()
    for folder in ("centrum", "macros")
    for path in (_PIPELINES / folder).rglob("*.py")
    if "__pycache__" not in path.parts
)


def _names(node: ast.AST) -> set[str]:
    return {child.id for child in ast.walk(node) if isinstance(child, ast.Name)}


def _is_batch_read(call: ast.Call) -> bool:
    """``dlt.read(...)``, ``spark.table(...)`` or ``spark.read.table(...)``."""
    function = call.func
    if not isinstance(function, ast.Attribute):
        return False

    owner = function.value
    is_dlt_read = function.attr == "read" and isinstance(owner, ast.Name) and owner.id == "dlt"
    is_spark_table = function.attr == "table" and isinstance(owner, ast.Name) and owner.id == "spark"
    is_spark_read_table = (
        function.attr == "table"
        and isinstance(owner, ast.Attribute)
        and owner.attr == "read"
        and isinstance(owner.value, ast.Name)
        and owner.value.id == "spark"
    )
    return is_dlt_read or is_spark_table or is_spark_read_table


def _measurement_batch_reads(notebook: str) -> set[str]:
    module = ast.parse((_PIPELINES / notebook).read_text())
    calls = [node for node in ast.walk(module) if isinstance(node, ast.Call) and _is_batch_read(node)]

    return {
        name for call in calls for argument in call.args for name in _names(argument) & _MEASUREMENT_TABLES
    }


@pytest.mark.parametrize("notebook", _NOTEBOOKS)
def test_no_notebook_reads_measurements_in_full(notebook: str) -> None:
    if notebook in _ALLOWED:
        pytest.skip("allowlisted until its incremental replacement lands")

    assert _measurement_batch_reads(notebook) == set()
