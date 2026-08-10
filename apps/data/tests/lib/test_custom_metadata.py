"""Focused tests for custom metadata match and merge behavior."""

from datetime import datetime

import pytest
from enrich.custom_metadata import _group_metadata, _match_value_sql, _merge_sql
from pyspark.sql import functions as F


@pytest.mark.spark
def test_metadata_blobs_are_ordered_by_persisted_creation_order(spark) -> None:
    metadata = spark.createDataFrame(
        [
            ("experiment-1", datetime(2026, 1, 2), "a", '{"value":"newest"}'),
            ("experiment-1", datetime(2026, 1, 1), "b", '{"value":"aaa-second"}'),
            ("experiment-1", datetime(2026, 1, 1), "a", '{"value":"zzz-first"}'),
            ("experiment-2", datetime(2026, 1, 3), "a", '{"value":"only"}'),
        ],
        "experiment_id STRING, created_at TIMESTAMP, metadata_id STRING, metadata_json STRING",
    ).withColumn("metadata", F.parse_json("metadata_json"))

    grouped = {
        row.experiment_id: [item.toPython()["value"] for item in row._meta_records]
        for row in _group_metadata(metadata).collect()
    }

    assert grouped == {
        "experiment-1": ["zzz-first", "aaa-second", "newest"],
        "experiment-2": ["only"],
    }


def test_question_target_reads_questions_data() -> None:
    sql = _match_value_sql(["questions_data"])

    assert "variant_get(questions_data" in sql
    assert "CAST(`device_id` AS STRING)" not in sql


def test_device_target_reads_existing_measurement_column() -> None:
    sql = _match_value_sql(["questions_data", "device_id"])

    assert "= 'column:device_id' THEN CAST(`device_id` AS STRING)" in sql
    assert "variant_get(questions_data" in sql


def test_missing_question_namespace_resolves_question_targets_to_null() -> None:
    sql = _match_value_sql(["device_id"])

    assert "ELSE CAST(NULL AS STRING)" in sql


def test_unsupported_column_target_does_not_fall_back_to_question_data() -> None:
    sql = _match_value_sql(["questions_data"])

    prefix_guard = "LIKE 'column:%' THEN CAST(NULL AS STRING)"
    assert prefix_guard in sql
    assert sql.index(prefix_guard) < sql.index("ELSE variant_get(questions_data")


def test_merge_uses_ansi_safe_first_match() -> None:
    sql = _merge_sql(["questions_data", "device_id"])

    assert "try_element_at(" in sql
    assert "filter(" in sql
    assert "column:device_id" in sql


@pytest.mark.spark
def test_later_blob_explicitly_replaces_repeated_keys(spark) -> None:
    records = spark.createDataFrame(
        [
            (
                '{"q1":"sample-1"}',
                [
                    """{"identifierColumnId":"sample","experimentQuestionId":"q1","rows":[{"sample":"sample-1","shared":"old","first_only":"kept"}]}""",
                    """{"identifierColumnId":"sample","experimentQuestionId":"q1","rows":[{"sample":"sample-1","shared":"new","second_only":"kept"}]}""",
                ],
            )
        ],
        "questions_json STRING, metadata_json ARRAY<STRING>",
    ).select(
        F.parse_json("questions_json").alias("questions_data"),
        F.expr("transform(metadata_json, item -> parse_json(item))").alias("_meta_records"),
    )

    merged = records.select(F.expr(_merge_sql(records.columns)).alias("metadata")).first().metadata

    assert merged.toPython() == {
        "shared": "new",
        "first_only": "kept",
        "second_only": "kept",
    }
