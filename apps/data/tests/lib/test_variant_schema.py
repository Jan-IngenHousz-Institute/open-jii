"""One sample per normalised schema merges to the same schema as every row does,
with decimals reported as DOUBLE."""

from __future__ import annotations

import pytest
from openjii.variant_schema import merged_variant_schema, variant_schema_key
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

pytestmark = pytest.mark.spark

# Precisions differ row to row; 2.0 is typed DECIMAL(1,0) and 1e-5 DOUBLE.
_PAYLOADS = [
    '{"phi2": 0.7, "n": 3, "trace": [1.25, 2]}',
    '{"phi2": 0.653, "n": 4, "trace": [3]}',
    '{"phi2": 2.0, "n": 5}',
    '{"phi2": 0.61, "n": 6, "trace": [1.5]}',
    '{"phi2": 1e-5, "note": "dry"}',
    '{"n": 12345678901234567890123}',
    "null",
    None,
]


def _rows(spark: SparkSession, payloads: list[str | None]) -> DataFrame:
    return spark.createDataFrame(list(enumerate(payloads)), "id INT, payload STRING").select(
        "id", F.expr("parse_json(payload)").alias("v")
    )


def _only_value(frame: DataFrame) -> str | None:
    row = frame.first()
    assert row is not None
    return row[0]


def _merged(frame: DataFrame) -> str | None:
    return _only_value(frame.agg(merged_variant_schema("v")))


def test_one_sample_per_key_merges_to_the_schema_of_every_row(spark: SparkSession) -> None:
    rows = _rows(spark, _PAYLOADS).withColumn("key", variant_schema_key("v"))
    first = rows.groupBy("key").agg(F.min_by("v", "id").alias("v"))
    last = rows.groupBy("key").agg(F.max_by("v", "id").alias("v"))

    assert first.count() < rows.count()
    assert _merged(first) == _merged(last) == _merged(rows)


def test_decimals_are_reported_as_double(spark: SparkSession) -> None:
    assert (
        _merged(_rows(spark, _PAYLOADS))
        == "OBJECT<n: DOUBLE, note: STRING, phi2: DOUBLE, trace: ARRAY<DOUBLE>>"
    )


def test_integers_stay_integers(spark: SparkSession) -> None:
    assert _merged(_rows(spark, ['{"points": 12}', '{"points": 40}'])) == "OBJECT<points: BIGINT>"


def test_a_field_named_like_a_type_keeps_its_name(spark: SparkSession) -> None:
    assert _merged(_rows(spark, ['{"DECIMAL(3,2)": 1.5}'])) == "OBJECT<`DECIMAL(3,2)`: DOUBLE>"


def test_values_without_a_type_have_no_schema_and_still_get_a_key(spark: SparkSession) -> None:
    rows = _rows(spark, ["null", None])

    assert _merged(rows) is None
    assert _only_value(rows.filter("v IS NULL").select(variant_schema_key("v"))) == ""
