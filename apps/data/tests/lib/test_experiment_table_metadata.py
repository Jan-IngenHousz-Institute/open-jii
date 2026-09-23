import ast
from pathlib import Path

import pytest

_PIPELINE_PATH = Path(__file__).parents[2] / "src/pipelines/centrum/gold/experiment_table_metadata.py"


def _assigned(module: ast.Module, name: str) -> ast.expr:
    return next(
        node.value
        for node in ast.walk(module)
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == name for target in node.targets)
    )


@pytest.mark.parametrize(
    ("metadata_name", "expected_receiver"),
    [
        # Published by the macro pipeline, so read by qualified name.
        ("macro_metadata", "spark.read.table(macro_view)"),
        ("raw_data_metadata", "dlt.read(ENRICHED_RAW_DATA_VIEW)"),
        ("device_metadata", "dlt.read(EXPERIMENT_DEVICE_DATA_TABLE)"),
        ("upload_metadata", "dlt.read(ENRICHED_UPLOADED_DATA_VIEW)"),
    ],
)
def test_table_metadata_reads_the_api_serving_relation(
    metadata_name: str,
    expected_receiver: str,
) -> None:
    module = ast.parse(_PIPELINE_PATH.read_text())
    group_by_receiver = next(
        node.func.value
        for node in ast.walk(_assigned(module, metadata_name))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "groupBy"
    )

    assert ast.unparse(group_by_receiver) == expected_receiver


def test_the_macro_view_read_is_the_enriched_serving_relation() -> None:
    macro_view = ast.unparse(_assigned(ast.parse(_PIPELINE_PATH.read_text()), "macro_view"))

    assert "ENRICHED_MACRO_DATA_VIEW" in macro_view
