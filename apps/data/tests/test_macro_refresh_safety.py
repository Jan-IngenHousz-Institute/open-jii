"""Regression tests for tables that must never be full-refreshed."""

from __future__ import annotations

import ast
import os
import re
import subprocess
import textwrap
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MACRO_TABLE = REPO_ROOT / "apps/data/src/pipelines/centrum/gold/experiment_macro_data.py"
FULL_REFRESH_WORKFLOW = REPO_ROOT / ".github/workflows/dlt-full-refresh.yml"


def _macro_table_properties() -> dict[str, str]:
    module = ast.parse(MACRO_TABLE.read_text(encoding="utf-8"))
    table_function = next(
        node
        for node in module.body
        if isinstance(node, ast.FunctionDef) and node.name == "experiment_macro_data"
    )
    table_decorator = next(
        decorator
        for decorator in table_function.decorator_list
        if isinstance(decorator, ast.Call)
        and isinstance(decorator.func, ast.Attribute)
        and decorator.func.attr == "table"
    )
    properties_node = next(
        keyword.value for keyword in table_decorator.keywords if keyword.arg == "table_properties"
    )
    properties = ast.literal_eval(properties_node)
    assert isinstance(properties, dict)
    return properties


def _validation_script() -> str:
    workflow = FULL_REFRESH_WORKFLOW.read_text(encoding="utf-8")
    match = re.search(
        r"^      - name: Validate table selection\n"
        r"        run: \|\n"
        r"(?P<script>(?:^          .*\n)+)",
        workflow,
        flags=re.MULTILINE,
    )
    assert match is not None
    return textwrap.dedent(match.group("script"))


def _validate_tables(tables: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", "-c", "set -euo pipefail\n" + _validation_script()],
        check=False,
        capture_output=True,
        env={**os.environ, "TABLES": tables},
        text=True,
    )


def test_macro_table_disallows_pipeline_reset() -> None:
    assert _macro_table_properties()["pipelines.reset.allowed"] == "false"


def test_full_refresh_workflow_rejects_protected_tables() -> None:
    for tables in ("experiment_macro_data", " experiment_macro_data ", "experiment_status,raw_data"):
        result = _validate_tables(tables)
        assert result.returncode != 0
        assert "is forbidden from full-refresh" in result.stdout


def test_full_refresh_workflow_example_is_safe() -> None:
    workflow = FULL_REFRESH_WORKFLOW.read_text(encoding="utf-8")
    assert 'e.g. "experiment_status,experiment_table_metadata"' in workflow
    assert _validate_tables("experiment_status,experiment_table_metadata").returncode == 0
