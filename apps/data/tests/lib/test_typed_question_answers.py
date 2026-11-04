import json

import pytest
from openjii.number_answers import typed_question_answers
from pyspark.sql import functions as F


@pytest.mark.spark
def test_approved_variant_numbers_preserve_text_nulls_and_nested_values(spark):
    inputs = [
        {"height": "12.50", "plot": "007", "blank": " \t\n", "optional": None, "nested": {"text": "007"}},
        {"height": "NaN", "plot": "12.50"},
        {"height": "1e309"},
        {"height": "1.2.3"},
        {"height": 12.5},
    ]
    frame = (
        spark.createDataFrame([(json.dumps(value),) for value in inputs], ["json"])
        .select(
            F.parse_json("json").alias("questions_data"),
            F.array(F.lit("height")).alias("keys"),
        )
        .withColumn("typed", typed_question_answers("questions_data", "keys"))
    )
    rows = frame.select(
        F.to_json("typed").alias("json"), F.schema_of_variant("typed").alias("schema")
    ).collect()
    assert json.loads(rows[0].json) == {**inputs[0], "height": 12.5, "blank": None}
    assert "height: DOUBLE" in rows[0].schema
    assert "plot: STRING" in rows[0].schema
    for row in rows[1:4]:
        assert json.loads(row.json)["height"] is None
    assert json.loads(rows[4].json)["height"] == 12.5
    rerun = frame.withColumn("again", typed_question_answers("typed", "keys"))
    assert rerun.filter(~F.to_json("typed").eqNullSafe(F.to_json("again"))).count() == 0


@pytest.mark.spark
def test_unapproved_and_missing_question_data_stay_untyped(spark):
    frame = (
        spark.createDataFrame([('{"height":"12.50"}',), (None,), ("null",)], ["json"])
        .select(
            F.parse_json("json").alias("questions_data"),
            F.array().cast("array<string>").alias("keys"),
        )
        .select(typed_question_answers("questions_data", "keys").alias("typed"))
    )
    rows = frame.select(F.to_json("typed").alias("json")).collect()
    assert json.loads(rows[0].json) == {"height": "12.50"}
    assert rows[1].json is None
    assert rows[2].json is None


@pytest.mark.spark
def test_invalid_live_answers_are_counted_before_becoming_null(spark):
    from openjii.number_answers import invalid_question_answer_count_expression

    frame = spark.createDataFrame(
        [
            ('{"height":"12,5","plot":"not a number"}',),
            ('{"height":null}',),
            ('{"height":"  "}',),
            ('{"height":"12.5"}',),
        ],
        ["json"],
    ).select(F.parse_json("json").alias("questions_data"), F.array(F.lit("height")).alias("keys"))
    frame = frame.withColumn("typed", typed_question_answers("questions_data", "keys"))
    counts = frame.select(
        F.expr(invalid_question_answer_count_expression("questions_data", "typed", "keys")).alias("invalid")
    ).collect()
    assert [row.invalid for row in counts] == [1, 0, 0, 0]
