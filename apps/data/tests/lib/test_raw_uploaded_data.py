import importlib.util
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock, call

_PIPELINE_PATH = Path(__file__).parents[2] / "src/pipelines/centrum/bronze/raw_uploaded_data.py"


def test_uploaded_json_is_scrubbed_before_variant_parsing(fake_dlt, monkeypatch) -> None:
    runtime = types.ModuleType("openjii.centrum.runtime")
    runtime.__dict__["CATALOG_NAME"] = "open_jii_test"
    monkeypatch.setitem(sys.modules, "openjii.centrum.runtime", runtime)

    spec = importlib.util.spec_from_file_location("raw_uploaded_data_regression", _PIPELINE_PATH)
    assert spec is not None and spec.loader is not None
    pipeline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pipeline)

    frame = MagicMock(name="uploaded_rows")
    for operation in ("format", "option", "schema", "load", "withColumn", "drop"):
        getattr(frame, operation).return_value = frame
    monkeypatch.setattr(pipeline, "spark", MagicMock(readStream=frame), raising=False)

    raw_column = object()
    scrubbed_column = object()
    parsed_column = object()
    monkeypatch.setattr(pipeline.F, "col", MagicMock(return_value=raw_column))
    monkeypatch.setattr(pipeline.F, "expr", MagicMock(return_value=parsed_column))
    monkeypatch.setattr(
        pipeline,
        "scrub_non_finite_json",
        MagicMock(return_value=scrubbed_column),
    )

    result = pipeline.raw_uploaded_data()

    assert result is frame
    pipeline.scrub_non_finite_json.assert_called_once_with(raw_column)
    assert frame.withColumn.call_args_list == [
        call("uploaded_data_scrubbed", scrubbed_column),
        call("uploaded_data", parsed_column),
    ]
    pipeline.F.expr.assert_called_once_with("try_parse_json(uploaded_data_scrubbed)")
    frame.drop.assert_called_once_with("uploaded_data_scrubbed")
