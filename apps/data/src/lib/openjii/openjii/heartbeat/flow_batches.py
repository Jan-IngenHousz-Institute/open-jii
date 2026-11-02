"""How close a pipeline's flows run to falling behind, read from its driver's streaming progress records.

The driver logs a progress record for each micro-batch that carried rows, to log4j files the
pipeline-logs volume holds as `<pipeline>/<cluster id>/driver/log4j-<YYYY-MM-DD-HH>.log.gz`, one per
hour, each arriving about an hour after its hour closes. A flow whose batches fill the hour runs them
back to back, its batches having caught up with its trigger interval, so from there more load means
longer waits. A flow that restarts, by a retry or on a new cluster, starts a new run.
"""

from __future__ import annotations

import contextlib
import gzip
import json
import math
import os
import re
from collections.abc import Collection, Iterable, Iterator
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from .driver_heap import newest_driver

_PROGRESS = "Streaming query made progress: "
# Centrum's flows are named like __materialization_mat_raw_data_1. The macro pipeline's carry the
# catalog, schema and pipeline id: open_jii_dev.centrum.__materialization_mat_46fe9925_6954_48bd_8e88_c9ca10f6b164_experiment_macro_data_1
_FLOW = re.compile(
    r"(?:^|\.)__materialization_mat_(?:[0-9a-f]{8}(?:_[0-9a-f]{4}){3}_[0-9a-f]{12}_)?(.+)_\d+$"
)
_HOURLY_LOG = re.compile(r"^log4j-(\d{4}-\d{2}-\d{2}-\d{2})\.log\.gz$")
# 1030-173330-96v7f5e4 was created at 17:33:30 UTC on 30 October.
_CLUSTER = re.compile(r"^(\d{2})(\d{2})-(\d{2})\d{4}-")

_HOUR = timedelta(hours=1)


@dataclass(frozen=True)
class FlowHour:
    flow: str
    batches: int
    p95_seconds: float | None
    busy_percent: float
    restarts: int


@dataclass(frozen=True)
class PipelineHour:
    hour: datetime
    flows: list[FlowHour]


def progress_records(lines: Iterable[str]) -> Iterator[dict]:
    """The streaming progress records in a driver log, each a JSON object spread over many lines."""
    block: list[str] | None = None
    depth = 0

    for line in lines:
        if block is None:
            at = line.find(_PROGRESS)
            if at < 0:
                continue
            line = line[at + len(_PROGRESS) :]
            block, depth = [], 0

        block.append(line)
        depth += line.count("{") - line.count("}")
        if depth <= 0:
            # A brace inside a string can close a record early; the rest of it is skipped.
            with contextlib.suppress(json.JSONDecodeError):
                yield json.loads("".join(block))
            block = None


def cluster_starts(clusters: Iterable[str], hour: datetime) -> int:
    """How many of a pipeline's clusters were created within the hour, read from their ids."""
    starts = 0
    for cluster in clusters:
        created = _CLUSTER.match(cluster)
        if created is not None and tuple(int(part) for part in created.groups()) == (
            hour.month,
            hour.day,
            hour.hour,
        ):
            starts += 1

    return starts


def _p95_seconds(durations: list[int]) -> float | None:
    if not durations:
        return None
    ranked = sorted(durations)
    return round(ranked[math.ceil(0.95 * len(ranked)) - 1] / 1000, 1)


def flow_hours(records: Iterable[dict], flows: Collection[str], new_clusters: int) -> list[FlowHour]:
    """Each watched flow's hour: its batches, their p95, the share of the hour they took, and how many
    times it restarted. A flow that ran no batch reads as idle rather than missing."""
    durations: dict[str, list[int]] = {flow: [] for flow in flows}
    runs: dict[str, set[str]] = {flow: set() for flow in flows}

    for record in records:
        named = _FLOW.search(record.get("name") or "")
        if named is None or named[1] not in durations:
            continue
        durations[named[1]].append(record["batchDuration"])
        runs[named[1]].add(record["runId"])

    return [
        FlowHour(
            flow,
            len(durations[flow]),
            _p95_seconds(durations[flow]),
            round(100 * sum(durations[flow]) / (_HOUR.total_seconds() * 1000), 1),
            max(len(runs[flow]) - 1, 0) + new_clusters,
        )
        for flow in flows
    ]


def latest_pipeline_hour(pipeline_dir: str, flows: Collection[str]) -> PipelineHour | None:
    """The newest driver's latest logged hour, per watched flow."""
    driver = newest_driver(pipeline_dir)
    if driver is None:
        return None

    hours = sorted(logged[1] for logged in map(_HOURLY_LOG.match, os.listdir(driver)) if logged is not None)
    if not hours:
        return None

    hour = datetime.strptime(hours[-1], "%Y-%m-%d-%H").replace(tzinfo=timezone.utc)
    with gzip.open(
        os.path.join(driver, f"log4j-{hours[-1]}.log.gz"), "rt", encoding="utf-8", errors="replace"
    ) as log:
        summaries = flow_hours(progress_records(log), flows, cluster_starts(os.listdir(pipeline_dir), hour))

    return PipelineHour(hour, summaries)
