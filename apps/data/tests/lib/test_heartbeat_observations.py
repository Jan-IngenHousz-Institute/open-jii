"""Tests for the heartbeat NDJSON contract consumed by the metrics forwarder."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import openjii.heartbeat as heartbeat
from openjii.heartbeat import (
    DATA_NAMESPACE,
    MAX_DETAIL_ROWS,
    USAGE_NAMESPACE,
    detail,
    heartbeat_key,
    minutes_since,
    observation,
    to_ndjson,
)

NOW = datetime(2026, 8, 16, 6, 15, 0, tzinfo=timezone.utc)


def test_namespaces_are_the_ones_the_forwarder_may_publish_to():
    # The metrics-forwarder's IAM policy conditions PutMetricData on exactly
    # these namespaces. A typo here is a datapoint dropped without an error.
    assert {DATA_NAMESPACE, USAGE_NAMESPACE} == {"OpenJII/Data", "OpenJII/Usage"}


def test_metric_names_are_the_literals_the_catalog_binds():
    # Each is hard-coded independently in docs/monitoring/metrics-catalog.yaml. A rename
    # here leaves every Python test green while the series the rules watch goes dark.
    assert heartbeat.COLLECTOR_HEARTBEAT_METRIC == "CollectorHeartbeat"
    assert heartbeat.GOLD_AGE_METRIC == "GoldMaterializationAgeMinutes"
    assert heartbeat.METRICS_AGE_METRIC == "MetricsPipelineAgeMinutes"
    assert heartbeat.STALE_EXPERIMENTS_METRIC == "StaleExperimentsCount"
    assert heartbeat.SILENT_DEVICES_METRIC == "SilentDevicesCount"
    assert heartbeat.INGEST_BAD_PAYLOAD_RATE_METRIC == "IngestBadPayloadRate"
    assert heartbeat.MEASUREMENTS_24H_METRIC == "Measurements24h"
    assert heartbeat.ACTIVE_DEVICES_30D_METRIC == "ActiveDevices30d"


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
        "GOLD_AGE_METRIC",
        "METRICS_AGE_METRIC",
        "STALE_EXPERIMENTS_METRIC",
        "SILENT_DEVICES_METRIC",
        "INGEST_BAD_PAYLOAD_RATE_METRIC",
        "MEASUREMENTS_24H_METRIC",
        "ACTIVE_DEVICES_30D_METRIC",
        "STALE_EXPERIMENTS_DETAIL",
        "SILENT_DEVICES_DETAIL",
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
