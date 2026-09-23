"""The macro pipeline writes one table from two flows, so the boundary between
them has to be explicit.

A Delta stream with no starting bound processes the table's whole existing
snapshot first. Without one here, the live flow would re-run every historical
macro through the sandbox and append a second copy of everything the backfill
already moved across.
"""

from __future__ import annotations

import ast
from pathlib import Path

_SRC = Path(__file__).parents[2] / "src"
_MACRO_PIPELINE = _SRC / "pipelines/macros/experiment_macro_data.py"
_MACRO_RUNTIME = _SRC / "lib/openjii/openjii/macros/runtime.py"


def test_the_live_flow_reads_from_an_explicit_starting_bound() -> None:
    options = [
        node
        for node in ast.walk(ast.parse(_MACRO_PIPELINE.read_text()))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "option"
    ]
    starts = [
        ast.literal_eval(call.args[0])
        for call in options
        if call.args and isinstance(call.args[0], ast.Constant)
    ]

    assert "startingTimestamp" in starts or "startingVersion" in starts


def test_the_cutover_is_required_rather_than_defaulted() -> None:
    """A default would let a misconfigured pipeline replay silently, which is
    the failure this guards. _required raises instead."""
    source = _MACRO_RUNTIME.read_text()

    assert 'MACRO_BACKFILL_CUTOVER: str = _required("MACRO_BACKFILL_CUTOVER")' in source
