import json
from pathlib import Path

import pytest
from openjii.number_answers import number_answer
from pyspark.sql import functions as F

pytestmark = pytest.mark.spark
_VECTORS = json.loads((Path(__file__).parents[4] / "packages/api/fixtures/number-answers.json").read_text())


def test_cast_preserves_finite_double_range_and_rejects_junk(spark):
    # IEEE-754 underflow to zero is intentional, as in the platform's DOUBLE columns.
    rows = spark.createDataFrame([(v["input"],) for v in _VECTORS], "answer STRING")
    got = rows.select(number_answer(F.col("answer")).alias("number")).collect()
    assert [r.number for r in got] == [v["value"] for v in _VECTORS]


def test_invalid_and_missing_answers_do_not_poison_an_average(spark):
    rows = spark.createDataFrame([("12.5",), ("7.5",), (None,), ("NaN",), ("",)], "answer STRING")
    converted = rows.select(number_answer(F.col("answer")).alias("height"))
    assert converted.schema["height"].dataType.simpleString() == "double"
    assert converted.agg(F.avg("height")).first()[0] == 10.0
