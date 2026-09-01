import ast
from pathlib import Path

_PIPELINE_PATH = Path(__file__).parents[2] / "src/pipelines/centrum/gold/experiment_table_metadata.py"


def test_upload_metadata_reads_the_api_serving_relation() -> None:
    module = ast.parse(_PIPELINE_PATH.read_text())
    upload_metadata = next(
        node.value
        for node in ast.walk(module)
        if isinstance(node, ast.Assign)
        and any(isinstance(target, ast.Name) and target.id == "upload_metadata" for target in node.targets)
    )
    group_by_receiver = next(
        node.func.value
        for node in ast.walk(upload_metadata)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "groupBy"
    )

    assert ast.unparse(group_by_receiver) == "dlt.read(ENRICHED_UPLOADED_DATA_VIEW)"
