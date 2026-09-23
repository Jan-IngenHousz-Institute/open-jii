"""Pipeline notebooks run behind a Py4J allowlist that local Spark does not have,
so a blocked call passes every test here and fails only on the cluster.
spark.catalog.tableExists is one."""

from __future__ import annotations

from pathlib import Path

import pytest

_PIPELINES = Path(__file__).parents[2] / "src/pipelines"

_NOTEBOOKS = sorted(
    path.relative_to(_PIPELINES).as_posix()
    for path in _PIPELINES.rglob("*.py")
    if "__pycache__" not in path.parts
)


@pytest.mark.parametrize("notebook", _NOTEBOOKS)
def test_no_notebook_calls_table_exists(notebook: str) -> None:
    assert "tableExists(" not in (_PIPELINES / notebook).read_text()
