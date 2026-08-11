"""The notebook-side ``to_timeseries`` helper."""

from __future__ import annotations

import pytest
from openjii.trace import fixtures, to_timeseries

TRACES = fixtures.load(fixtures.TRACES)


@pytest.mark.spark
class TestToTimeseries:
    def test_matches_the_sql_function_signature(self, spark) -> None:
        fixture = fixtures.by_name(TRACES, "v3_regular")
        df = to_timeseries(fixture["sample"], spark=spark)
        assert df.columns == ["series", "t", "value", "unit"]
        assert [f.dataType.simpleString() for f in df.schema.fields] == [
            "string",
            "timestamp",
            "double",
            "string",
        ]

    def test_row_count_and_a_known_timestamp(self, spark) -> None:
        fixture = fixtures.by_name(TRACES, "v3_regular")
        df = to_timeseries(fixture["sample"], spark=spark)
        assert df.count() == fixture["expect"]["point_count"]

        expected = next(
            p for p in fixture["expect"]["points"] if p["series"] == "fluo_630_signal" and p["index"] == 10
        )
        rows = df.filter("series = 'fluo_630_signal'").orderBy("t").collect()
        assert round(rows[10]["t"].timestamp() * 1000) == expected["t_ms"]
        assert rows[10]["value"] == pytest.approx(expected["value"])

    def test_v2_row_needs_no_dual_read_branch_from_the_caller(self, spark) -> None:
        fixture = fixtures.by_name(TRACES, "v2_regular_t_est")
        df = to_timeseries(fixture["sample"], spark=spark)
        assert df.count() == fixture["expect"]["point_count"]
        assert sorted(r["series"] for r in df.select("series").distinct().collect()) == [
            "ambient_leaf_ir",
            "ambient_sun_vis",
            "fluo_630_ref",
            "fluo_630_signal",
            "leaf_temp",
        ]

    def test_non_trace_row_is_empty_not_an_error(self, spark) -> None:
        fixture = fixtures.by_name(TRACES, "not_a_trace_multispeq")
        assert to_timeseries(fixture["sample"], spark=spark).count() == 0
