"""Builders for the heartbeat file the metrics-forwarder Lambda consumes.

The file is NDJSON. Lines carrying a "metric" key become CloudWatch datapoints;
lines carrying a "detail" key stay in S3, which is what keeps per-experiment
cardinality out of CloudWatch. The openjii-triage skill and whoever is holding an
incident read them there.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import datetime, timedelta, timezone

from .constants import (
    COLLECTOR_FAILURES_METRIC,
    DATA_NAMESPACE,
    FAILED_COLLECTORS_DETAIL,
    HEARTBEAT_KEY_PREFIX,
    MAX_DETAIL_ROWS,
    MAX_ERROR_CHARS,
)


def observation(
    metric: str,
    value: float,
    namespace: str,
    observed_at: datetime,
    environment: str,
    unit: str = "None",
    dimensions: dict[str, str] | None = None,
) -> dict:
    """Build one CloudWatch datapoint line."""
    return {
        "namespace": namespace,
        "metric": metric,
        "value": value,
        "unit": unit,
        "timestamp": _isoformat(observed_at),
        "dimensions": {"Environment": environment, **(dimensions or {})},
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


def previous_bucket(now: datetime, minutes: int) -> tuple[datetime, datetime]:
    """The last complete bucket of `minutes` before `now`, as [start, end).

    Counting a closed bucket per run, rather than a trailing window, means the
    counts add up over a day without overlap as long as each bucket is counted
    once.
    """
    stamp = _as_utc(now).replace(second=0, microsecond=0)
    end = stamp - timedelta(minutes=stamp.minute % minutes)
    return end - timedelta(minutes=minutes), end


def hop(
    rows_metric: str,
    latency_metric: str,
    rows: int,
    p95_seconds: float | None,
    bucket_start: datetime,
    namespace: str,
    environment: str,
) -> list[dict]:
    """One stage of the data path for one bucket: how many rows passed and, when
    any did, how long the slowest twentieth took.

    Both are stamped at the bucket's start, so a chart lines the stages up. A
    quiet bucket reports zero rows and no latency rather than a latency of zero.
    """
    points = [observation(rows_metric, rows, namespace, bucket_start, environment, "Count")]
    if rows > 0 and p95_seconds is not None:
        points.append(
            observation(
                latency_metric, round(p95_seconds, 1), namespace, bucket_start, environment, "Seconds"
            )
        )
    return points


def minutes_since(earlier: datetime | None, now: datetime) -> float | None:
    """Age in minutes to one decimal, or None when the source timestamp is missing."""
    if earlier is None:
        return None
    return round((now - _as_utc(earlier)).total_seconds() / 60, 1)


def run_collectors(
    collectors: list[tuple[str, Callable[[datetime], list[dict]]]],
    now: datetime,
    environment: str,
    log: Callable[[str, str], None],
) -> list[dict]:
    """Every collector's lines, then how many collectors raised and which.

    A collector that raises (a table not built yet, a schema change, a transient
    read failure) forfeits its own lines and nothing else, so the file still
    lands and the dead-man stays quiet.
    """
    records: list[dict] = []
    failures: list[dict] = []

    for name, collector in collectors:
        try:
            records.extend(collector(now))
        except Exception as error:
            log(f"{name} failed: {error}", "WARN")
            failures.append(
                {"collector": name, "error": f"{type(error).__name__}: {error}"[:MAX_ERROR_CHARS]}
            )

    records.append(
        observation(COLLECTOR_FAILURES_METRIC, len(failures), DATA_NAMESPACE, now, environment, "Count")
    )
    records.append(detail(FAILED_COLLECTORS_DETAIL, failures))

    return records


def _isoformat(value: datetime) -> str:
    return _as_utc(value).strftime("%Y-%m-%dT%H:%M:%SZ")


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
