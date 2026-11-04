import importlib.util
import json
import sys
import types
from pathlib import Path

import pytest
from openjii.centrum.schemas import legacy_question_schema, question_schema
from pyspark.sql.types import ArrayType, StringType, StructField, StructType

_PIPELINE_PATH = Path(__file__).parents[2] / "src/pipelines/centrum/silver/clean_data.py"


@pytest.mark.spark
def test_question_json_preserves_kind_and_falls_back_to_legacy_payload(spark, fake_dlt, monkeypatch):
    runtime = types.ModuleType("openjii.centrum.runtime")
    runtime.__dict__.update(BRONZE_TABLE="bronze", SILVER_TABLE="silver", LEGACY_MACRO_ID_MAP={})
    monkeypatch.setitem(sys.modules, "openjii.centrum.runtime", runtime)
    spec = importlib.util.spec_from_file_location("clean_data_questions_regression", _PIPELINE_PATH)
    assert spec is not None and spec.loader is not None
    pipeline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pipeline)

    legacy = {"question_label": "Plot", "question_text": "Which?", "question_answer": "007"}
    number = {**legacy, "question_answer": "12.50", "question_kind": "number"}
    schema = StructType(
        [
            StructField("case", StringType()),
            StructField("questions_json", StringType()),
            StructField(
                "parsed_data", StructType([StructField("questions", ArrayType(legacy_question_schema))])
            ),
        ]
    )
    frame = spark.createDataFrame(
        [
            ("old", None, {"questions": [legacy]}),
            ("new", json.dumps([number]), {"questions": [legacy]}),
            ("malformed", "not-json", {"questions": [legacy]}),
            ("empty", "[]", {"questions": [legacy]}),
            ("missing", None, {"questions": None}),
        ],
        schema,
    ).select("case", pipeline._questions().alias("questions"))

    assert frame.schema["questions"].dataType == ArrayType(question_schema)
    rows = {row.case: row.questions for row in frame.collect()}
    for case in ("old", "malformed"):
        assert rows[case][0].asDict() == {**legacy, "question_kind": None}
    assert rows["new"][0].asDict() == number
    assert rows["empty"] == []
    assert rows["missing"] is None
