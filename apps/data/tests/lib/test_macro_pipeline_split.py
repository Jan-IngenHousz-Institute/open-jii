"""The macro pipeline is a separate deployment, and these pin the two things
that quietly break if it stops being one.

Macro execution calls the backend sandbox over HTTP from a Spark task. While it
shared the centrum pipeline, one task held a slot for 12,954 seconds using 22
seconds of CPU, and the Kinesis reader's prefetch job could not get the slot it
needs. Ingestion stalled for days behind it.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

_SRC = Path(__file__).parents[2] / "src"
_MACRO_PIPELINE = _SRC / "pipelines/macros/experiment_macro_data.py"
_ENRICHED_MACRO = _SRC / "pipelines/centrum/enriched/enriched_experiment_macro_data.py"


def _module(path: Path) -> ast.Module:
    return ast.parse(path.read_text())


def _calls(tree: ast.AST, attr: str) -> list[ast.Call]:
    return [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == attr
    ]


def test_the_macro_flow_left_the_centrum_pipeline() -> None:
    assert not (_SRC / "pipelines/centrum/gold/experiment_macro_data.py").exists()
    assert _MACRO_PIPELINE.exists()


def test_it_reads_raw_data_across_the_pipeline_boundary() -> None:
    """dlt.read_stream only resolves datasets inside one pipeline, so a leftover
    call would fail at deploy rather than here. The point of asserting it is the
    opposite direction: nobody should quietly move the notebook back."""
    tree = _module(_MACRO_PIPELINE)

    assert _calls(tree, "read_stream") == []
    assert len(_calls(tree, "table")) >= 1


def test_history_arrives_by_backfill_rather_than_re_execution() -> None:
    """Two append flows into one streaming table. Without the backfill the new
    table would have to be rebuilt from raw, re-running every historical macro
    through the sandbox: the single most expensive thing in the system."""
    tree = _module(_MACRO_PIPELINE)

    flows = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef)
        and any(
            isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute) and d.func.attr == "append_flow"
            for d in node.decorator_list
        )
    ]

    assert len(flows) == 2
    assert len(_calls(tree, "create_streaming_table")) == 1


@pytest.mark.parametrize("column", ["id", "raw_id", "macro_output", "macro_error"])
def test_the_backfill_projects_the_columns_the_live_flow_produces(column: str) -> None:
    """Both flows write one table, so a column present in one and absent from the
    other is a schema mismatch at deploy."""
    source = _MACRO_PIPELINE.read_text()
    macro_columns = next(
        node.value
        for node in ast.walk(ast.parse(source))
        if isinstance(node, ast.Assign)
        and any(isinstance(t, ast.Name) and t.id == "MACRO_COLUMNS" for t in node.targets)
    )

    assert column in [ast.literal_eval(element) for element in macro_columns.elts]


def test_the_enriched_table_reads_the_fact_by_qualified_name() -> None:
    """It used to be a dlt.read of a dataset in the same pipeline. Now the fact
    belongs to another one, so only a fully qualified read resolves it."""
    tree = _module(_ENRICHED_MACRO)
    reads = [
        ast.unparse(call)
        for call in _calls(tree, "table")
        if ast.unparse(call).startswith("spark.read.table")
    ]

    assert len(reads) == 1
    assert "FACT_MACRO_RESULT_TABLE" in reads[0]
