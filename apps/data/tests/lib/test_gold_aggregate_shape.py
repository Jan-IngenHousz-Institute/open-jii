"""This pipeline is continuous and not serverless, so every materialized view in
it is fully recomputed on every trigger. Three gold tables used to sit in a shape
that could not convert: a registry or profile lookup above a distinct, and a join
above a groupBy. Each was split so the aggregate stood alone.

The two bridges then converted, and are now streaming tables whose distinct set is
maintained by AUTO CDC. The aggregate could not follow, because AUTO CDC upserts
by key without summing, so it stays a materialized view on its own interval.

These pin both halves. Re-adding anything above an aggregate, or swapping a
streaming read for a batch one, is a one-line change that silently restores a full
scan of silver.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

_GOLD = Path(__file__).parents[2] / "src/pipelines/centrum/gold"

_SPLIT_TABLES = [
    "bridge_experiment_contributor.py",
    "bridge_experiment_device.py",
    "agg_experiment_device.py",
]

_BRIDGES = {
    "bridge_experiment_contributor.py": ["experiment_id", "user_id"],
    "bridge_experiment_device.py": ["experiment_id", "client_id"],
}


def _module(filename: str) -> ast.Module:
    return ast.parse((_GOLD / filename).read_text())


def _call(filename: str, attr: str) -> ast.Call:
    """The file's single call to ``dlt.<attr>``."""
    calls = [
        node
        for node in ast.walk(_module(filename))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == attr
    ]

    assert len(calls) == 1, f"{filename} should have one dlt.{attr} call"
    return calls[0]


def _kwargs(call: ast.Call) -> dict[str, ast.expr]:
    return {kw.arg: kw.value for kw in call.keywords if kw.arg is not None}


def _returned_expression(filename: str) -> ast.expr:
    """The expression the file's dlt dataset function returns."""
    returns = [node for node in ast.walk(_module(filename)) if isinstance(node, ast.Return)]

    assert len(returns) == 1, f"{filename} should have one return"
    assert returns[0].value is not None

    return returns[0].value


@pytest.mark.parametrize(("filename", "keys"), sorted(_BRIDGES.items()))
def test_each_bridge_is_a_streaming_table_deduplicated_by_auto_cdc(filename: str, keys: list[str]) -> None:
    """A distinct over a stream cannot append, so the deduplicating upsert comes
    from AUTO CDC keyed on the pair rather than from a materialized view."""
    _call(filename, "create_streaming_table")
    flow = _kwargs(_call(filename, "create_auto_cdc_flow"))

    assert isinstance(flow["keys"], ast.List)
    assert [ast.literal_eval(key) for key in flow["keys"].elts] == keys
    assert ast.literal_eval(flow["stored_as_scd_type"]) == 1


@pytest.mark.parametrize("filename", sorted(_BRIDGES))
def test_each_bridge_keeps_its_two_column_shape(filename: str) -> None:
    """sequence_by needs a column the table itself never had, so it is excluded
    rather than widening a shape the backend already selects from."""
    flow = _kwargs(_call(filename, "create_auto_cdc_flow"))
    sequence_by = flow["sequence_by"]

    assert isinstance(sequence_by, ast.Call), "sequence_by should be F.col(...)"
    sequence_column = ast.literal_eval(sequence_by.args[0])

    assert isinstance(flow["except_column_list"], ast.List)
    assert [ast.literal_eval(name) for name in flow["except_column_list"].elts] == [sequence_column]


@pytest.mark.parametrize("filename", sorted(_BRIDGES))
def test_each_bridge_source_reads_silver_as_a_stream(filename: str) -> None:
    """dlt.read here would hand AUTO CDC the whole table every trigger, which is
    the full scan the conversion exists to remove."""
    source = (_GOLD / filename).read_text()

    assert "dlt.read_stream(" in source
    assert "dlt.read(" not in source


def test_the_aggregate_is_the_top_node() -> None:
    """The one table that stays a materialized view still has to be splittable,
    so nothing may sit above its groupBy."""
    returned = _returned_expression("agg_experiment_device.py")

    assert isinstance(returned, ast.Call)
    assert isinstance(returned.func, ast.Attribute)
    assert returned.func.attr == "agg"


def test_the_aggregate_declares_its_own_trigger_interval() -> None:
    """It cannot convert, so the only lever left on its full scans is cadence.
    Falling back to the pipeline-wide interval silently restores 720 a day."""
    table = _kwargs(_call("agg_experiment_device.py", "table"))
    spark_conf = table["spark_conf"]

    assert isinstance(spark_conf, ast.Dict)
    assert [ast.literal_eval(key) for key in spark_conf.keys if key is not None] == [
        "pipelines.trigger.interval"
    ]


@pytest.mark.parametrize("filename", sorted(_SPLIT_TABLES))
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
    """Reading silver here would put the full scan back, on the side that stays a
    materialized view."""
    source = (_GOLD / filename).read_text()

    assert reads in source
    assert "SILVER_TABLE" not in source
