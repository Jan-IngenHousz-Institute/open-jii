"""Tests for the heartbeat NDJSON contract consumed by the metrics forwarder."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from itertools import pairwise

import openjii.heartbeat as heartbeat
from openjii.heartbeat import (
    DATA_NAMESPACE,
    MAX_DETAIL_ROWS,
    USAGE_NAMESPACE,
    detail,
    heartbeat_key,
    hop,
    minutes_since,
    observation,
    previous_bucket,
    run_collectors,
    to_ndjson,
)
from openjii.heartbeat.constants import MAX_ERROR_CHARS

NOW = datetime(2026, 8, 16, 6, 15, 0, tzinfo=timezone.utc)


def test_namespaces_are_the_ones_the_forwarder_may_publish_to():
    # The metrics-forwarder's IAM policy conditions PutMetricData on exactly
    # these namespaces. A typo here is a datapoint dropped without an error.
    assert {DATA_NAMESPACE, USAGE_NAMESPACE} == {"OpenJII/Data", "OpenJII/Usage"}


def test_metric_names_are_the_literals_the_catalog_binds():
    # Each is hard-coded independently in docs/monitoring/metrics-catalog.yaml. A rename
    # here leaves every Python test green while the series the rules watch goes dark.
    assert heartbeat.COLLECTOR_HEARTBEAT_METRIC == "CollectorHeartbeat"
    assert heartbeat.COLLECTOR_FAILURES_METRIC == "CollectorFailures"
    assert heartbeat.GOLD_AGE_METRIC == "GoldMaterializationAgeMinutes"
    assert heartbeat.METRICS_AGE_METRIC == "MetricsPipelineAgeMinutes"
    assert heartbeat.STALE_EXPERIMENTS_METRIC == "StaleExperimentsCount"
    assert heartbeat.SILENT_DEVICES_METRIC == "SilentDevicesCount"
    assert heartbeat.INGEST_BAD_PAYLOAD_RATE_METRIC == "IngestBadPayloadRate"
    assert heartbeat.MEASUREMENTS_24H_METRIC == "Measurements24h"
    assert heartbeat.ACTIVE_DEVICES_30D_METRIC == "ActiveDevices30d"
    assert heartbeat.MEASUREMENTS_7D_METRIC == "Measurements7d"
    assert heartbeat.ACTIVE_DEVICES_7D_METRIC == "ActiveDevices7d"
    assert heartbeat.ACTIVE_EXPERIMENTS_7D_METRIC == "ActiveExperiments7d"
    assert heartbeat.ACTIVE_CONTRIBUTORS_7D_METRIC == "ActiveContributors7d"
    assert heartbeat.INGESTED_ROWS_METRIC == "IngestedRows"
    assert heartbeat.EXPERIMENT_ROWS_METRIC == "ExperimentRows"
    assert heartbeat.MACRO_RESULT_ROWS_METRIC == "MacroResultRows"
    assert heartbeat.INGEST_LATENCY_METRIC == "IngestLatencyP95Seconds"
    assert heartbeat.EXPERIMENT_LATENCY_METRIC == "ExperimentLatencyP95Seconds"
    assert heartbeat.MACRO_LATENCY_METRIC == "MacroLatencyP95Seconds"
    assert heartbeat.BROKER_TO_API_LATENCY_METRIC == "BrokerToApiP95Seconds"
    assert heartbeat.MACRO_BACKLOG_METRIC == "MacroBacklogRows"
    assert heartbeat.INGEST_IDLE_METRIC == "IngestIdleMinutes"
    assert heartbeat.MACRO_IDLE_METRIC == "MacroIdleMinutes"
    assert heartbeat.DRIVER_OLD_GEN_METRIC == "DriverOldGenAfterFullGcPercent"
    assert heartbeat.DATABRICKS_COST_7D_METRIC == "DatabricksCost7dUsd"


def test_to_ndjson_serializes_the_datetimes_a_roster_row_carries():
    # Spark rows carry datetimes. Without default=str the write raises outside every
    # collector's guard, no file lands, and the dead-man reports the collector gone.
    roster = detail("silent_devices", [{"client_id": "a", "last_data_at": NOW.replace(tzinfo=None)}])

    row = json.loads(to_ndjson([roster]))["rows"][0]

    assert row["last_data_at"] == "2026-08-16 06:15:00"


def test_minutes_since_accepts_the_naive_datetimes_spark_returns():
    # Both production call sites feed naive values; tz-aware inputs alone would let
    # the _as_utc normalisation be deleted with every test still green.
    naive_earlier = (NOW - timedelta(minutes=30)).replace(tzinfo=None)

    assert minutes_since(naive_earlier, NOW) == 30.0


def test_every_metric_and_detail_name_is_exported():
    for name in (
        "COLLECTOR_HEARTBEAT_METRIC",
        "COLLECTOR_FAILURES_METRIC",
        "GOLD_AGE_METRIC",
        "METRICS_AGE_METRIC",
        "STALE_EXPERIMENTS_METRIC",
        "SILENT_DEVICES_METRIC",
        "INGEST_BAD_PAYLOAD_RATE_METRIC",
        "MEASUREMENTS_24H_METRIC",
        "ACTIVE_DEVICES_30D_METRIC",
        "MEASUREMENTS_7D_METRIC",
        "ACTIVE_DEVICES_7D_METRIC",
        "ACTIVE_EXPERIMENTS_7D_METRIC",
        "ACTIVE_CONTRIBUTORS_7D_METRIC",
        "INGESTED_ROWS_METRIC",
        "EXPERIMENT_ROWS_METRIC",
        "MACRO_RESULT_ROWS_METRIC",
        "INGEST_LATENCY_METRIC",
        "EXPERIMENT_LATENCY_METRIC",
        "MACRO_LATENCY_METRIC",
        "BROKER_TO_API_LATENCY_METRIC",
        "MACRO_BACKLOG_METRIC",
        "INGEST_IDLE_METRIC",
        "MACRO_IDLE_METRIC",
        "DRIVER_OLD_GEN_METRIC",
        "DATABRICKS_COST_7D_METRIC",
        "STALE_EXPERIMENTS_DETAIL",
        "SILENT_DEVICES_DETAIL",
        "FAILED_COLLECTORS_DETAIL",
    ):
        assert name in heartbeat.__all__


def test_observation_carries_environment_dimension_and_zulu_timestamp():
    record = observation("GoldMaterializationAgeMinutes", 12.5, DATA_NAMESPACE, NOW, "dev")

    assert record["namespace"] == DATA_NAMESPACE
    assert record["metric"] == "GoldMaterializationAgeMinutes"
    assert record["value"] == 12.5
    assert record["unit"] == "None"
    # dev and prod must never share a datapoint series
    assert record["dimensions"] == {"Environment": "dev"}
    assert record["timestamp"] == "2026-08-16T06:15:00Z"


def test_observation_adds_its_own_dimensions_to_the_environment():
    record = observation("M", 1, DATA_NAMESPACE, NOW, "dev", "Percent", {"Pipeline": "centrum"})

    assert record["dimensions"] == {"Environment": "dev", "Pipeline": "centrum"}


def test_observation_treats_naive_timestamps_as_utc():
    naive = observation("M", 1, DATA_NAMESPACE, NOW.replace(tzinfo=None), "dev")
    offset = observation("M", 1, DATA_NAMESPACE, NOW.astimezone(timezone(timedelta(hours=2))), "dev")

    assert naive["timestamp"] == "2026-08-16T06:15:00Z"
    assert offset["timestamp"] == "2026-08-16T06:15:00Z"


def test_detail_truncates_and_reports_the_full_count():
    rows = [{"experiment_id": str(index)} for index in range(MAX_DETAIL_ROWS + 10)]

    roster = detail("stale_experiments", rows)

    assert len(roster["rows"]) == MAX_DETAIL_ROWS
    assert roster["truncated"] is True
    assert roster["total"] == MAX_DETAIL_ROWS + 10
    # roster lines must not look like datapoints to the forwarder
    assert "metric" not in roster


def test_detail_reports_the_queried_total_when_sql_already_limited():
    fetched = [{"experiment_id": str(index)} for index in range(MAX_DETAIL_ROWS)]

    roster = detail("stale_experiments", fetched, total=312)

    assert roster["total"] == 312
    assert roster["truncated"] is True
    assert len(roster["rows"]) == MAX_DETAIL_ROWS


def test_detail_below_the_cap_is_not_marked_truncated():
    roster = detail("stale_experiments", [{"experiment_id": "a"}])

    assert roster["rows"] == [{"experiment_id": "a"}]
    assert roster["truncated"] is False
    assert roster["total"] == 1


def test_to_ndjson_emits_one_parseable_object_per_line():
    records = [
        observation("A", 1, DATA_NAMESPACE, NOW, "dev"),
        detail("stale_experiments", [{"experiment_id": "a"}]),
    ]

    lines = to_ndjson(records).split("\n")

    assert len(lines) == 2
    assert json.loads(lines[0])["metric"] == "A"
    assert json.loads(lines[1])["detail"] == "stale_experiments"


def test_heartbeat_key_is_date_partitioned_in_utc():
    key = heartbeat_key(NOW.astimezone(timezone(timedelta(hours=5))))

    assert key == "heartbeat/2026/08/16/061500.json"


def test_minutes_since_rounds_and_passes_through_missing_source():
    assert minutes_since(NOW - timedelta(minutes=90), NOW) == 90.0
    assert minutes_since(NOW - timedelta(seconds=90), NOW) == 1.5
    assert minutes_since(NOW - timedelta(seconds=30), NOW) == 0.5
    assert minutes_since(None, NOW) is None


def test_previous_bucket_is_the_last_closed_half_hour():
    start, end = previous_bucket(datetime(2026, 9, 26, 17, 31, 42, tzinfo=timezone.utc), 30)

    assert (start, end) == (
        datetime(2026, 9, 26, 17, 0, tzinfo=timezone.utc),
        datetime(2026, 9, 26, 17, 30, tzinfo=timezone.utc),
    )


def test_previous_bucket_on_the_boundary_is_the_half_hour_just_closed():
    start, end = previous_bucket(datetime(2026, 9, 26, 18, 0, 0, tzinfo=timezone.utc), 30)

    assert (start, end) == (
        datetime(2026, 9, 26, 17, 30, tzinfo=timezone.utc),
        datetime(2026, 9, 26, 18, 0, tzinfo=timezone.utc),
    )


def test_consecutive_runs_count_adjacent_buckets_without_overlap():
    # Runs every half hour, a minute or two late, must tile the day exactly once.
    runs = [datetime(2026, 9, 26, 0, 1, tzinfo=timezone.utc) + timedelta(minutes=30 * i) for i in range(48)]
    buckets = [previous_bucket(run, 30) for run in runs]

    assert all(earlier[1] == later[0] for earlier, later in pairwise(buckets))


def test_hop_reports_rows_and_latency_at_the_bucket_start():
    start = datetime(2026, 9, 26, 17, 0, tzinfo=timezone.utc)
    points = hop("IngestedRows", "IngestLatencyP95Seconds", 86, 3.76575, start, DATA_NAMESPACE, "dev")

    assert [(p["metric"], p["value"], p["unit"], p["timestamp"]) for p in points] == [
        ("IngestedRows", 86, "Count", "2026-09-26T17:00:00Z"),
        ("IngestLatencyP95Seconds", 3.8, "Seconds", "2026-09-26T17:00:00Z"),
    ]


def test_hop_in_a_quiet_bucket_reports_zero_rows_and_no_latency():
    start = datetime(2026, 9, 26, 17, 0, tzinfo=timezone.utc)
    points = hop("IngestedRows", "IngestLatencyP95Seconds", 0, None, start, DATA_NAMESPACE, "dev")

    assert [(p["metric"], p["value"]) for p in points] == [("IngestedRows", 0)]


def test_a_failing_collector_costs_only_its_own_lines_and_is_counted_and_named():
    def ingest(now: datetime) -> list[dict]:
        return [observation("IngestedRows", 86, DATA_NAMESPACE, now, "dev", "Count")]

    def experiment_rows(now: datetime) -> list[dict]:
        raise RuntimeError("[UNRESOLVED_COLUMN] arrival_timestamp cannot be resolved")

    def macro_results(now: datetime) -> list[dict]:
        return [observation("MacroResultRows", 80, DATA_NAMESPACE, now, "dev", "Count")]

    logged = []
    records = run_collectors(
        [("ingest", ingest), ("experiment_rows", experiment_rows), ("macro_results", macro_results)],
        NOW,
        "dev",
        lambda message, level: logged.append((level, message)),
    )

    assert [(r["metric"], r["value"]) for r in records if "metric" in r] == [
        ("IngestedRows", 86),
        ("MacroResultRows", 80),
        ("CollectorFailures", 1),
    ]
    roster = records[-1]
    assert roster["detail"] == "failed_collectors"
    assert roster["rows"] == [
        {
            "collector": "experiment_rows",
            "error": "RuntimeError: [UNRESOLVED_COLUMN] arrival_timestamp cannot be resolved",
        }
    ]
    assert logged == [
        ("WARN", "experiment_rows failed: [UNRESOLVED_COLUMN] arrival_timestamp cannot be resolved")
    ]


def test_a_clean_run_reports_zero_failures_so_the_series_never_goes_quiet():
    records = run_collectors([("quiet", lambda now: [])], NOW, "dev", lambda message, level: None)

    assert records[0]["metric"] == "CollectorFailures"
    assert records[0]["value"] == 0
    assert records[0]["namespace"] == DATA_NAMESPACE
    assert records[1]["rows"] == []


def test_a_failure_keeps_only_the_opening_of_a_long_spark_error():
    def failing(now: datetime) -> list[dict]:
        raise RuntimeError("x" * 5000)

    records = run_collectors([("failing", failing)], NOW, "dev", lambda message, level: None)

    assert len(records[-1]["rows"][0]["error"]) == MAX_ERROR_CHARS
