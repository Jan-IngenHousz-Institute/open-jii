"""Focused tests for custom metadata match-target SQL generation."""

import json
from datetime import datetime

import pytest
from enrich import custom_metadata
from enrich.custom_metadata import _MERGE_MAPS_SQL, _ORDERED_METADATA_SQL, _match_value_sql, _merge_sql
from pyspark.sql import functions as F


@pytest.mark.spark
def test_metadata_blobs_are_ordered_by_persisted_creation_order(spark, monkeypatch) -> None:
    # Apache Spark 3.5 lacks Databricks parse_json/VARIANT. Keep the ordering
    # expression intact and stub only that conversion boundary for local tests.
    local_sql = _ORDERED_METADATA_SQL.replace("parse_json(item.json)", "item.json")
    monkeypatch.setattr(custom_metadata, "_ORDERED_METADATA_SQL", local_sql)

    metadata = spark.createDataFrame(
        [
            ("experiment-1", datetime(2026, 1, 2), "a", {"value": "newest"}),
            ("experiment-1", datetime(2026, 1, 1), "b", {"value": "aaa-second"}),
            ("experiment-1", datetime(2026, 1, 1), "a", {"value": "zzz-first"}),
            ("experiment-2", datetime(2026, 1, 3), "a", {"value": "only"}),
        ],
        "experiment_id STRING, created_at TIMESTAMP, metadata_id STRING, metadata MAP<STRING, STRING>",
    )

    grouped = {
        row.experiment_id: [json.loads(item)["value"] for item in row._meta_records]
        for row in custom_metadata._group_metadata(metadata).collect()
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
    # The merge itself is standard Spark SQL; substitute STRING only for the
    # Databricks-only VARIANT value type used in production.
    local_merge_sql = _MERGE_MAPS_SQL.replace("VARIANT", "STRING")
    records = spark.createDataFrame(
        [
            (
                [
                    {"shared": "old", "first_only": "kept"},
                    {"shared": "new", "second_only": "kept"},
                ],
            )
        ],
        "records ARRAY<MAP<STRING, STRING>>",
    )

    merged = (
        records.select(
            F.expr(
                f"""
            aggregate(
                records,
                cast(map() AS MAP<STRING, STRING>),
                (acc, x) -> {local_merge_sql}
            )
            """
            ).alias("metadata")
        )
        .first()
        .metadata
    )

    assert merged == {
        "shared": "new",
        "first_only": "kept",
        "second_only": "kept",
    }


def test_merge_sql_uses_explicit_later_blob_precedence() -> None:
    sql = " ".join(_merge_sql(["questions_data"]).split())

    assert "map_filter( cast(acc AS MAP<STRING, VARIANT>)" in sql
    assert "map_keys(cast(x AS MAP<STRING, VARIANT>))" in sql
