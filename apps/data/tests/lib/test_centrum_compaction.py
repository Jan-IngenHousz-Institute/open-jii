"""Centrum's tables leave compaction to predictive optimization.

Auto compaction runs after writes, at 200 partitions whatever the pipeline sets, on a driver that
runs for days. A table that turns it back on works without failing anything, so only this check
notices.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

_CENTRUM = Path(__file__).parents[2] / "src/pipelines/centrum"
_DECLARATIONS = ("table", "create_streaming_table", "materialized_view")


def _declarations(notebook: Path) -> list[ast.Call]:
    """Every call in the notebook that declares a published table."""
    return [
        node
        for node in ast.walk(ast.parse(notebook.read_text()))
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id in ("dlt", "dp")
        and node.func.attr in _DECLARATIONS
    ]


_NOTEBOOKS = sorted(path for path in _CENTRUM.rglob("*.py") if _declarations(path))


@pytest.mark.parametrize("notebook", _NOTEBOOKS, ids=lambda path: str(path.relative_to(_CENTRUM)))
def test_turns_auto_compaction_off(notebook: Path) -> None:
    for declaration in _declarations(notebook):
        properties = next(
            (
                ast.literal_eval(keyword.value)
                for keyword in declaration.keywords
                if keyword.arg == "table_properties"
            ),
            {},
        )
        assert properties.get("delta.autoOptimize.autoCompact") == "false"
