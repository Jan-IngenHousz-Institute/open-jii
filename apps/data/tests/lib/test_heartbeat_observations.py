"""Tests for the heartbeat NDJSON contract consumed by the metrics forwarder."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from openjii.heartbeat import (
    DATA_NAMESPACE,
    MAX_DETAIL_ROWS,
    detail,
    heartbeat_key,
    minutes_since,
    observation,
    to_ndjson,
)

NOW = datetime(2026, 8, 16, 6, 15, 0, tzinfo=timezone.utc)


def test_observation_carries_environment_dimension_and_zulu_timestamp():
    record = observation("HeartbeatAgeMinutes", 12.5, DATA_NAMESPACE, NOW, "dev")

    assert record["namespace"] == DATA_NAMESPACE
    assert record["metric"] == "HeartbeatAgeMinutes"
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
