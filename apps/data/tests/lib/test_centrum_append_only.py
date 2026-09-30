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


@pytest.mark.parametrize(
    "notebook", sorted(_CENTRUM.rglob("*.py")), ids=lambda path: str(path.relative_to(_CENTRUM))
)
def test_declares_no_merging_flow(notebook: Path) -> None:
    calls = {
        node.func.attr
        for node in ast.walk(ast.parse(notebook.read_text()))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
    }
    assert not calls & _MERGING_CALLS
