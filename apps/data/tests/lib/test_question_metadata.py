"""Tests for enrich.question_metadata (sanitization + question column expansion)."""

from __future__ import annotations

import pytest
from enrich.question_metadata import _sanitize_column_name, add_question_columns


class TestSanitizeColumnName:
    @pytest.mark.parametrize(
        ("label", "expected"),
        [
            ("Plant Height (cm)", "plant_height_cm"),
            ("Leaf Color", "leaf_color"),
            ("CO2 ppm", "co2_ppm"),
            ("a;b,c{d}e(f)g=h", "a_b_c_d_e_f_g_h"),
            ("  whitespace\t\n  ", "whitespace"),
            ("multiple___underscores", "multiple_underscores"),
            ("ALREADY_OK", "already_ok"),
        ],
    )
    def test_sanitization_rules(self, label: str, expected: str) -> None:
        assert _sanitize_column_name(label) == expected

    def test_numeric_prefix_gets_question_prefix(self) -> None:
        assert _sanitize_column_name("3rd Measurement").startswith("question_")

    def test_empty_after_strip_gets_question_prefix(self) -> None:
        # Pure-punctuation labels collapse to '' and need a stable prefix.
        result = _sanitize_column_name("()")
        assert result.startswith("question_")


@pytest.mark.spark
class TestAddQuestionColumns:
    def test_extracts_answer_for_each_label(self, spark) -> None:
        rows = [
            {
                "id": "1",
                "questions": [
                    {"question_label": "Plant Height (cm)", "question_text": "?", "question_answer": "42"},
                    {"question_label": "Leaf Color", "question_text": "?", "question_answer": "green"},
                ],
            },
            {
                "id": "2",
                "questions": [
                    {"question_label": "Plant Height (cm)", "question_text": "?", "question_answer": "37"},
                ],
            },
        ]
        df = spark.createDataFrame(rows)
        result = add_question_columns(df, ["Plant Height (cm)", "Leaf Color"]).collect()
        by_id = {r.id: r.asDict() for r in result}

        assert by_id["1"]["plant_height_cm"] == "42"
        assert by_id["1"]["leaf_color"] == "green"
        assert by_id["2"]["plant_height_cm"] == "37"
        assert by_id["2"]["leaf_color"] is None

    def test_handles_empty_or_null_questions(self, spark) -> None:
        # Schema must be explicit since pure-None columns become VOID otherwise.
        from pyspark.sql.types import (
            ArrayType,
            StringType,
            StructField,
            StructType,
        )

        question_struct = StructType(
            [
                StructField("question_label", StringType(), True),
                StructField("question_text", StringType(), True),
                StructField("question_answer", StringType(), True),
            ]
        )
        schema = StructType(
            [
                StructField("id", StringType(), True),
                StructField("questions", ArrayType(question_struct), True),
            ]
        )
        df = spark.createDataFrame([("1", []), ("2", None)], schema=schema)
        result = add_question_columns(df, ["Anything"]).collect()
        assert all(r.anything is None for r in result)
