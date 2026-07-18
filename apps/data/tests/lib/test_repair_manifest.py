"""Tests for data_repair.manifest (registration, severity, predicate filtering)."""

from __future__ import annotations

import pytest
from data_repair.manifest import (
    _INLINE_REPAIRS,
    apply_inline_repairs,
    inline_repair,
    list_repairs,
)


@pytest.fixture(autouse=True)
def isolate_registry():
    """Snapshot and restore the global registry around each test."""
    snapshot = list(_INLINE_REPAIRS)
    _INLINE_REPAIRS.clear()
    yield
    _INLINE_REPAIRS.clear()
    _INLINE_REPAIRS.extend(snapshot)


class TestRegistration:
    def test_decorator_registers_repair(self) -> None:
        @inline_repair(table="t", issue="X-1", description="d")
        def repair_fn(df):
            return df

        repairs = list_repairs()
        assert len(repairs) == 1
        assert repairs[0].name == "repair_fn"
        assert repairs[0].table == "t"
        assert repairs[0].severity == "apply"

    def test_advisory_severity(self) -> None:
        @inline_repair(table="t", issue="X-1", description="d", severity="advisory")
        def adv(df):
            return df

        assert list_repairs()[0].severity == "advisory"

    def test_decorator_returns_original_callable(self) -> None:
        @inline_repair(table="t", issue="X", description="d")
        def f(df):
            return df

        # Decorated function must remain directly callable.
        assert f.__name__ == "f"


@pytest.mark.spark
class TestApplyInlineRepairs:
    def test_applies_only_matching_table(self, spark) -> None:
        @inline_repair(table="target", issue="X", description="d")
        def double(df):
            return df.withColumn("v", df.v * 2)

        @inline_repair(table="other", issue="Y", description="d")
        def triple(df):
            return df.withColumn("v", df.v * 3)

        df = spark.createDataFrame([(1,), (2,), (3,)], ["v"])
        result = apply_inline_repairs(df, "target").collect()
        assert sorted(r.v for r in result) == [2, 4, 6]

    def test_advisory_does_not_mutate(self, spark) -> None:
        @inline_repair(table="t", issue="X", description="d", severity="advisory")
        def would_double(df):
            return df.withColumn("v", df.v * 2)

        df = spark.createDataFrame([(5,)], ["v"])
        result = apply_inline_repairs(df, "t").collect()
        assert result[0].v == 5

    def test_predicate_partitions_rows(self, spark) -> None:
        from pyspark.sql import functions as F

        @inline_repair(
            table="t",
            issue="X",
            description="d",
            predicate=lambda: F.col("flag"),
        )
        def negate(df):
            return df.withColumn("v", -df.v)

        df = spark.createDataFrame(
            [(1, True), (2, False), (3, True)],
            ["v", "flag"],
        )
        rows = sorted(apply_inline_repairs(df, "t").collect(), key=lambda r: abs(r.v))
        # Matching rows (flag=True) get negated, non-matching pass through.
        assert [(r.v, r.flag) for r in rows] == [(-1, True), (2, False), (-3, True)]

    def test_predicate_treats_null_as_false(self, spark) -> None:
        from pyspark.sql import functions as F
        from pyspark.sql.types import BooleanType, IntegerType, StructField, StructType

        @inline_repair(
            table="t",
            issue="X",
            description="d",
            predicate=lambda: F.col("flag"),
        )
        def negate(df):
            return df.withColumn("v", -df.v)

        schema = StructType(
            [
                StructField("v", IntegerType(), True),
                StructField("flag", BooleanType(), True),
            ]
        )
        df = spark.createDataFrame([(1, None), (2, True)], schema=schema)
        rows = sorted(apply_inline_repairs(df, "t").collect(), key=lambda r: abs(r.v))
        # NULL flag must NOT match (no silent corruption).
        assert [(r.v, r.flag) for r in rows] == [(1, None), (-2, True)]
