"""The payload tables keep the layout the backend's reads depend on.

Reads take one experiment, newest rows first, and a page picks its rows over typed columns before
it reads any payload. Clustering by time lets a time window skip files, and shredding lets a read
of one payload field skip the rest. Losing either slows every read without failing any.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

_PIPELINES = Path(__file__).parents[2] / "src/pipelines"

_LAYOUT = {
    "centrum/gold/experiment_raw_data.py": ["experiment_id", "timestamp"],
    "centrum/gold/experiment_uploaded_data.py": ["experiment_id", "upload_table_id", "uploaded_at"],
    "macros/experiment_macro_data.py": ["experiment_id", "macro_id", "timestamp"],
}


def _table_decorator(notebook: str) -> ast.Call:
    """The ``@dlt.table(...)`` call the notebook's table is declared with."""
    module = ast.parse((_PIPELINES / notebook).read_text())
    decorators = [
        decorator
        for node in ast.walk(module)
        if isinstance(node, ast.FunctionDef)
        for decorator in node.decorator_list
        if isinstance(decorator, ast.Call)
        and isinstance(decorator.func, ast.Attribute)
        and decorator.func.attr == "table"
    ]
    assert len(decorators) == 1, f"{notebook} declares {len(decorators)} tables"
    return decorators[0]


def _keyword(call: ast.Call, name: str) -> object:
    return next(ast.literal_eval(keyword.value) for keyword in call.keywords if keyword.arg == name)


@pytest.mark.parametrize(("notebook", "keys"), sorted(_LAYOUT.items()))
def test_clusters_by_experiment_then_the_order_reads_take(notebook: str, keys: list[str]) -> None:
    assert _keyword(_table_decorator(notebook), "cluster_by") == keys


@pytest.mark.parametrize("notebook", sorted(_LAYOUT))
def test_shreds_the_payload(notebook: str) -> None:
    properties = _keyword(_table_decorator(notebook), "table_properties")
    assert isinstance(properties, dict)
    assert properties.get("delta.enableVariantShredding") == "true"
