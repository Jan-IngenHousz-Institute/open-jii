"""Centrum never merges into its tables.

Every MERGE is followed by an auto compaction on the pipeline's driver that cannot
be turned off, and on a driver that runs for days those runs were followed by the
heap filling within about 32 hours. A flow that merges again works without failing
anything, so only this check notices.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

_CENTRUM = Path(__file__).parents[2] / "src/pipelines/centrum"
_MERGING_CALLS = {
    "apply_changes",
    "apply_changes_from_snapshot",
    "create_auto_cdc_flow",
    "create_auto_cdc_from_snapshot_flow",
    "merge",
}


def _called_name(call: ast.Call) -> str | None:
    if isinstance(call.func, ast.Attribute):
        return call.func.attr
    if isinstance(call.func, ast.Name):
        return call.func.id
    return None


def _runs_merge_statement(call: ast.Call) -> bool:
    if _called_name(call) != "sql" or not call.args:
        return False

    statement = call.args[0]
    if isinstance(statement, ast.JoinedStr) and statement.values:
        statement = statement.values[0]

    return (
        isinstance(statement, ast.Constant)
        and isinstance(statement.value, str)
        and statement.value.lstrip().upper().startswith("MERGE INTO")
    )


def _merging_calls(source: str) -> set[str]:
    found = set()

    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.Call):
            continue

        name = _called_name(node)
        if name in _MERGING_CALLS:
            found.add(name)
        elif _runs_merge_statement(node):
            found.add("sql(MERGE INTO)")

    return found


@pytest.mark.parametrize(
    ("source", "found"),
    [
        ("dlt.create_auto_cdc_flow(target='t')", {"create_auto_cdc_flow"}),
        ("create_auto_cdc_flow(target='t')", {"create_auto_cdc_flow"}),
        ("spark.sql('  merge into t USING s ON t.id = s.id')", {"sql(MERGE INTO)"}),
        ("spark.sql(f'MERGE INTO {table} USING s ON true')", {"sql(MERGE INTO)"}),
        ("spark.sql('SELECT 1')", set()),
        ("'''MERGE INTO t and apply_changes()'''  # dlt.merge()", set()),
    ],
)
def test_finds_merging_calls(source: str, found: set[str]) -> None:
    assert _merging_calls(source) == found


@pytest.mark.parametrize(
    "notebook", sorted(_CENTRUM.rglob("*.py")), ids=lambda path: str(path.relative_to(_CENTRUM))
)
def test_declares_no_merging_flow(notebook: Path) -> None:
    assert _merging_calls(notebook.read_text()) == set()
