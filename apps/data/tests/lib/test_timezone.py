"""Timezone safety tests for enriched Centrum measurements."""

import importlib.util
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from enrich.timezone import drop_invalid_timezone
from pyspark.sql import functions as F

_ENRICHED_PIPELINE_DIR = Path(__file__).parents[2] / "src/pipelines/centrum/enriched"
_HOSTILE_TIMEZONES = (
    "ROC",
    "Factory",
    "Mars/Olympus",
    " Europe/Amsterdam ",
    "europe/amsterdam",
    "Europe/Amsterdam\x00",
    "') from x --",
)


@pytest.mark.spark
def test_invalid_timezone_is_dropped_without_dropping_measurement(spark):
    source = spark.createDataFrame(
        [("valid", "Europe/Amsterdam"), ("missing", None)]
        + [(f"invalid-{index}", timezone) for index, timezone in enumerate(_HOSTILE_TIMEZONES)],
        "id string, timezone string",
    ).withColumn("measurement_time_utc", F.to_timestamp(F.lit("2026-08-06 12:00:00")))

    projected = (
        source.withColumn("timezone", drop_invalid_timezone(F.col("timezone")))
        .withColumn(
            "measurement_time_local",
            F.date_format(
                F.from_utc_timestamp(F.col("measurement_time_utc"), F.col("timezone")),
                "yyyy-MM-dd HH:mm:ss",
            ),
        )
        .withColumn(
            "local_time",
            F.date_format(F.from_utc_timestamp(F.col("measurement_time_utc"), F.col("timezone")), "HH:mm"),
        )
    )
    rows = {row.id: row.asDict() for row in projected.collect()}

    assert len(rows) == len(_HOSTILE_TIMEZONES) + 2
    assert rows["valid"]["timezone"] == "Europe/Amsterdam"
    assert rows["valid"]["measurement_time_local"] == "2026-08-06 14:00:00"
    assert rows["valid"]["local_time"] == "14:00"
    for row_id, row in rows.items():
        assert row["measurement_time_utc"] is not None
        if row_id != "valid":
            assert row["timezone"] is None
            assert row["measurement_time_local"] is None
            assert row["local_time"] is None


@pytest.mark.spark
@pytest.mark.parametrize(
    ("pipeline_file", "view_function", "source_table_constant", "source_kind"),
    [
        (
            "enriched_experiment_raw_data.py",
            "enriched_experiment_raw_data",
            "EXPERIMENT_RAW_DATA_TABLE",
            "raw",
        ),
        (
            "enriched_experiment_macro_data.py",
            "enriched_experiment_macro_data",
            "EXPERIMENT_MACRO_DATA_TABLE",
            "macro",
        ),
    ],
)
def test_enriched_views_guard_timezone(
    spark,
    fake_dlt,
    monkeypatch,
    pipeline_file,
    view_function,
    source_table_constant,
    source_kind,
):
    spec = importlib.util.spec_from_file_location(
        f"timezone_regression_{source_kind}", _ENRICHED_PIPELINE_DIR / pipeline_file
    )
    assert spec is not None and spec.loader is not None
    pipeline = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pipeline)

    source = MagicMock(name=f"{source_kind}_source")
    source_table = getattr(pipeline, source_table_constant)
    monkeypatch.setattr(
        fake_dlt, "read", lambda name: source if name == source_table else MagicMock(name=name)
    )
    monkeypatch.setattr(pipeline, "add_annotation_column", lambda frame, _source: frame)
    monkeypatch.setattr(pipeline, "add_custom_metadata_column", lambda frame, _source: frame)
    guard = MagicMock(name="drop_invalid_timezone")
    monkeypatch.setattr(pipeline, "drop_invalid_timezone", guard)

    getattr(pipeline, view_function)()

    guard.assert_called_once()
    assert guard.call_args.args[0] is source.timezone
