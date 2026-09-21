"""A materialized view whose aggregate is not the top node of its query cannot
refresh incrementally, so it rescans its whole source every trigger.

Three gold tables used to sit in that shape: a registry or profile lookup above a
distinct, and a join above a groupBy. Each is now split, with the aggregate alone
in its own table. These pin the split, because re-adding anything above the
aggregate is a one-line change that silently restores a full scan of silver.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

_GOLD = Path(__file__).parents[2] / "src/pipelines/centrum/gold"

_AGGREGATING = {
    "bridge_experiment_contributor.py": "distinct",
    "bridge_experiment_device.py": "distinct",
    "agg_experiment_device.py": "agg",
}


def _returned_expression(path: Path) -> ast.expr:
    """The expression the file's dlt table function returns."""
    module = ast.parse(path.read_text())
    returns = [node for node in ast.walk(module) if isinstance(node, ast.Return)]

    assert len(returns) == 1, f"{path.name} should have one return"
    assert returns[0].value is not None

    return returns[0].value


@pytest.mark.parametrize(("filename", "aggregate"), sorted(_AGGREGATING.items()))
def test_the_aggregate_is_the_top_node(filename: str, aggregate: str) -> None:
    returned = _returned_expression(_GOLD / filename)

    assert isinstance(returned, ast.Call)
    assert isinstance(returned.func, ast.Attribute)
    assert returned.func.attr == aggregate


@pytest.mark.parametrize("filename", sorted(_AGGREGATING))
def test_the_aggregating_tables_call_no_enrichment_udf(filename: str) -> None:
    """The profile and registry lookups are non-deterministic pandas UDFs, which
    block incrementalisation wherever they sit. They belong downstream."""
    source = (_GOLD / filename).read_text()

    assert "add_user_column" not in source
    assert "add_device_registry" not in source


@pytest.mark.parametrize(
    ("filename", "reads"),
    [
        ("experiment_contributors.py", "BRIDGE_EXPERIMENT_CONTRIBUTOR_TABLE"),
        ("experiment_devices.py", "BRIDGE_EXPERIMENT_DEVICE_TABLE"),
        ("experiment_device_data.py", "AGG_EXPERIMENT_DEVICE_TABLE"),
    ],
)
def test_the_enriching_tables_read_the_split_table_not_silver(filename: str, reads: str) -> None:
    """Reading silver here would put the full scan back, on the side that still
    recomputes in full."""
    source = (_GOLD / filename).read_text()

    assert reads in source
    assert "SILVER_TABLE" not in source
