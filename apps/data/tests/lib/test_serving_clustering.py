"""Liquid clustering on the per-experiment serving tables.

The backend filters every read by experiment_id, so these four tables carry a
clustering key on it. Parsed rather than imported, like the gold shape tests:
the pipeline files call into a runtime that reads spark.conf at import.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

_PIPELINES = Path(__file__).parents[2] / "src/pipelines"

_SERVING_TABLE_FILES = [
    "centrum/enriched/enriched_experiment_raw_data.py",
    "macros/enriched_experiment_macro_data.py",
    "centrum/enriched/enriched_experiment_uploaded_data.py",
    "centrum/gold/experiment_device_data.py",
]


def _table_kwargs(relative_path: str) -> dict[str, ast.expr]:
    """The keyword arguments of the file's single ``dlt.table`` call."""
    module = ast.parse((_PIPELINES / relative_path).read_text())
    # Qualified, because these bodies also call spark.table.
    calls = [
        node
        for node in ast.walk(module)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "table"
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "dlt"
    ]

    assert len(calls) == 1, f"{relative_path} should have one dlt.table call"
    return {kw.arg: kw.value for kw in calls[0].keywords if kw.arg is not None}


@pytest.mark.parametrize("relative_path", _SERVING_TABLE_FILES)
def test_each_serving_table_clusters_by_experiment_id(relative_path: str) -> None:
    cluster_by = _table_kwargs(relative_path)["cluster_by"]

    assert isinstance(cluster_by, ast.List)
    assert [ast.literal_eval(key) for key in cluster_by.elts] == ["experiment_id"]
