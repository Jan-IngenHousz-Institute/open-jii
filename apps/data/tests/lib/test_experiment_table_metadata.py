import ast
from pathlib import Path

import pytest

_PIPELINE_PATH = Path(__file__).parents[2] / "src/pipelines/centrum/gold/experiment_table_metadata.py"


@pytest.mark.parametrize(
    ("metadata_name", "serving_relation"),
    [
        ("macro_metadata", "ENRICHED_MACRO_DATA_VIEW"),
        ("raw_data_metadata", "ENRICHED_RAW_DATA_VIEW"),
        ("device_metadata", "EXPERIMENT_DEVICE_DATA_TABLE"),
        ("upload_metadata", "ENRICHED_UPLOADED_DATA_VIEW"),
    ],
)
def test_table_metadata_reads_the_api_serving_relation(
    metadata_name: str,
    serving_relation: str,
) -> None:
    module = ast.parse(_PIPELINE_PATH.read_text())
    metadata = next(
        node.value
        for node in ast.walk(module)
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == metadata_name for target in node.targets)
    )
    group_by_receiver = next(
        node.func.value
        for node in ast.walk(metadata)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "groupBy"
    )

    assert ast.unparse(group_by_receiver) == f"dlt.read({serving_relation})"
