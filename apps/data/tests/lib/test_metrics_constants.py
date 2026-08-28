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
        "PARAMETER_ALLOWLIST",
        "ACTIVITY_WINDOW_DAYS",
        "within_plausible_range",
    ):
        assert name in metrics.__all__


def test_parameter_allowlist_is_json_path_safe() -> None:
    # Names are interpolated into get_json_object paths; anything beyond
    # identifier characters would silently break the extraction.
    for name in metrics.PARAMETER_ALLOWLIST:
        assert name.replace("_", "").isalnum(), name


def test_runtime_not_reexported() -> None:
    # runtime.py reads spark.conf eagerly; keeping it out of the package __init__
    # is what makes `import openjii.metrics` safe without an active Spark session.
    assert "runtime" not in metrics.__all__
