"""Builders for the heartbeat file the metrics-forwarder Lambda consumes.

The file is NDJSON. Lines carrying a "metric" key become CloudWatch datapoints;
lines carrying a "detail" key stay in S3 for the digest composer to read, which
is what keeps per-experiment cardinality out of CloudWatch.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from .constants import HEARTBEAT_KEY_PREFIX, MAX_DETAIL_ROWS


def observation(
    metric: str,
    value: float,
    namespace: str,
    observed_at: datetime,
    environment: str,
    unit: str = "None",
) -> dict:
    """Build one CloudWatch datapoint line."""
    return {
        "namespace": namespace,
        "metric": metric,
        "value": value,
        "unit": unit,
        "timestamp": _isoformat(observed_at),
        "dimensions": {"Environment": environment},
    }


def detail(name: str, rows: list[dict], total: int | None = None) -> dict:
    """Build one roster line, truncated to keep the object small.

    Pass `total` when the query already limited its result set, so the roster
    still reports how many rows exist rather than how many were fetched.
    """
    population = len(rows) if total is None else total
    return {
        "detail": name,
        "rows": rows[:MAX_DETAIL_ROWS],
        "truncated": population > MAX_DETAIL_ROWS,
        "total": population,
    }


def to_ndjson(records: list[dict]) -> str:
    """Serialize records one JSON object per line."""
    return "\n".join(json.dumps(record, default=str) for record in records)


def heartbeat_key(observed_at: datetime) -> str:
    """Date-partitioned object key; one object per run."""
    stamp = observed_at.astimezone(timezone.utc)
    return f"{HEARTBEAT_KEY_PREFIX}/{stamp:%Y/%m/%d}/{stamp:%H%M%S}.json"


def minutes_since(earlier: datetime | None, now: datetime) -> float | None:
    """Age in minutes to one decimal, or None when the source timestamp is missing."""
    if earlier is None:
        return None
    return round((now - _as_utc(earlier)).total_seconds() / 60, 1)


def _isoformat(value: datetime) -> str:
    return _as_utc(value).strftime("%Y-%m-%dT%H:%M:%SZ")


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
