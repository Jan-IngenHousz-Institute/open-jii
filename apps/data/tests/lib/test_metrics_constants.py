"""Smoke tests for the spark-free openjii.metrics surface."""

from __future__ import annotations

import openjii.metrics as metrics


def test_table_constants_exported() -> None:
    assert metrics.PLATFORM_TOTALS_TABLE == "platform_totals"
    assert metrics.DAILY_ACTIVITY_TABLE == "daily_activity"
    assert metrics.FAMILY_TOTALS_TABLE == "family_totals"
    for name in (
        "PLATFORM_TOTALS_TABLE",
        "DAILY_ACTIVITY_TABLE",
        "FAMILY_TOTALS_TABLE",
        "HOURLY_ACTIVITY_TABLE",
        "ACTIVITY_WINDOWS_TABLE",
        "PARAMETER_STATS_TABLE",
        "POOL_FACTS_TABLE",
        "DAILY_ACTIVITY_BY_EXPERIMENT_TABLE",
        "EXPERIMENT_CONTRIBUTORS_WINDOW_TABLE",
        "UNATTRIBUTED_FAMILY",
        "MEASUREMENT_TIMESTAMP_FLOOR",
        "DERIVED_PARAMETER_ALLOWLIST",
        "SENSOR_PARAMETER_ALLOWLIST",
        "PARAMETER_CATEGORY_DERIVED",
        "PARAMETER_CATEGORY_SENSOR",
        "ACTIVITY_WINDOW_DAYS",
        "OPS_DEVICE_SILENCE_TABLE",
        "OPS_INGEST_QUALITY_TABLE",
        "DEVICE_SILENCE_CADENCE_MULTIPLIER",
        "DEVICE_SILENCE_FLOOR_MINUTES",
        "INGEST_QUALITY_WINDOW_HOURS",
        "within_plausible_range",
    ):
        assert name in metrics.__all__


def test_ops_tables_share_a_prefix_no_public_table_uses() -> None:
    # The prefix is what keeps device-grain rows out of the public endpoint;
    # a public table named ops_* would defeat an allowlist keyed on it.
    ops_tables = (metrics.OPS_DEVICE_SILENCE_TABLE, metrics.OPS_INGEST_QUALITY_TABLE)
    public_tables = (
        metrics.PLATFORM_TOTALS_TABLE,
        metrics.DAILY_ACTIVITY_TABLE,
        metrics.FAMILY_TOTALS_TABLE,
        metrics.HOURLY_ACTIVITY_TABLE,
        metrics.ACTIVITY_WINDOWS_TABLE,
        metrics.PARAMETER_STATS_TABLE,
        metrics.POOL_FACTS_TABLE,
    )
    assert all(name.startswith("ops_") for name in ops_tables)
    assert not any(name.startswith("ops_") for name in public_tables)


def test_silence_rule_cannot_flag_a_single_dropped_packet() -> None:
    # The multiplier makes the rule relative to each device's own cadence; the
    # floor keeps a fast publisher from being flagged by one missed interval.
    assert metrics.DEVICE_SILENCE_CADENCE_MULTIPLIER > 1
    assert metrics.DEVICE_SILENCE_FLOOR_MINUTES >= 15
    assert metrics.INGEST_QUALITY_WINDOW_HOURS == 24


def test_parameter_allowlists_are_variant_path_safe() -> None:
    # Names are interpolated into try_variant_get paths; anything beyond
    # identifier characters would silently break the extraction.
    for name in metrics.DERIVED_PARAMETER_ALLOWLIST + metrics.SENSOR_PARAMETER_ALLOWLIST:
        assert name.replace("_", "").isalnum(), name


def test_parameter_allowlists_are_disjoint() -> None:
    assert not set(metrics.DERIVED_PARAMETER_ALLOWLIST) & set(metrics.SENSOR_PARAMETER_ALLOWLIST)


def test_runtime_not_reexported() -> None:
    # runtime.py reads spark.conf eagerly; keeping it out of the package __init__
    # is what makes `import openjii.metrics` safe without an active Spark session.
    assert "runtime" not in metrics.__all__
