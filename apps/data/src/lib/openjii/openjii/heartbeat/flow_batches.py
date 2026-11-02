"""How close a pipeline's flows run to falling behind and how often they restart, read from its drivers' logs.

A driver logs a progress record for each micro-batch that carried rows, and a line each time a flow's
streaming query starts, to log4j files the pipeline-logs volume holds as
`<pipeline>/<cluster id>/driver/log4j-<YYYY-MM-DD-HH>.log.gz`, one per hour, each arriving about an hour
after its hour closes. A flow whose batches fill the hour runs them back to back, its batches having caught
up with its trigger interval, so from there more load means longer waits. A cluster that stops within an
hour never rotates that hour, so a pipeline that keeps replacing its cluster shows only in its cluster ids.
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
from datetime import datetime, timezone

_PROGRESS = "Streaming query made progress: "
# 26/10/30 17:42:31 INFO MicroBatchExecution: Starting __materialization_mat_clean_data_1 [id = e6fe32b4-..., runId = ...]
_RUN_START = re.compile(r"MicroBatchExecution: Starting (\S+) \[id = ")
# Every log4j line opens with its time, so a progress record's JSON runs until the next one.
_LOG_LINE = re.compile(r"^\d{2}/\d{2}/\d{2} \d{2}:\d{2}:\d{2} ")
# Centrum's flows are named like __materialization_mat_raw_data_1. The macro pipeline's carry the
# catalog, schema and pipeline id: open_jii_dev.centrum.__materialization_mat_46fe9925_6954_48bd_8e88_c9ca10f6b164_experiment_macro_data_1
_FLOW = re.compile(
    r"(?:^|\.)__materialization_mat_(?:[0-9a-f]{8}(?:_[0-9a-f]{4}){3}_[0-9a-f]{12}_)?(.+)_\d+$"
)
_HOURLY_LOG = re.compile(r"^log4j-(\d{4}-\d{2}-\d{2}-\d{2})\.log\.gz$")
# 1030-173330-96v7f5e4 was created at 17:33:30 UTC on 30 October.
_CLUSTER = re.compile(r"^(\d{2})(\d{2})-(\d{2})\d{4}-")

_HOUR_MS = 3_600_000


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


def _entries(lines: Iterable[str]) -> Iterator[str | dict]:
    """A driver log's flow run starts, as the starting query's name, and its progress records, parsed."""
    block: list[str] | None = None

    for line in lines:
        if block is not None:
            if not _LOG_LINE.match(line):
                block.append(line)
                continue
            with contextlib.suppress(json.JSONDecodeError):
                yield json.loads("".join(block))
            block = None

        started = _RUN_START.search(line)
        if started is not None:
            yield started[1]
            continue
        at = line.find(_PROGRESS)
        if at >= 0:
            block = [line[at + len(_PROGRESS) :]]

    if block is not None:
        with contextlib.suppress(json.JSONDecodeError):
            yield json.loads("".join(block))


def _watched(name: str | None, flows: Collection[str]) -> str | None:
    named = _FLOW.search(name or "")
    return named[1] if named is not None and named[1] in flows else None


def _p95_seconds(durations: list[int]) -> float | None:
    if not durations:
        return None
    ranked = sorted(durations)
    return round(ranked[math.ceil(0.95 * len(ranked)) - 1] / 1000, 1)


def flow_hours(lines: Iterable[str], flows: Collection[str]) -> list[FlowHour]:
    """Each watched flow's hour: its batches, their p95, the share of the hour they took, and how many runs
    started. A run that fails before its first batch still logs its start. A flow that ran no batch reads as
    idle rather than missing."""
    durations: dict[str, list[int]] = {flow: [] for flow in flows}
    starts = dict.fromkeys(flows, 0)

    for entry in _entries(lines):
        if isinstance(entry, str):
            flow = _watched(entry, flows)
            if flow is not None:
                starts[flow] += 1
        else:
            flow = _watched(entry.get("name"), flows)
            if flow is not None:
                durations[flow].append(entry["batchDuration"])

    return [
        FlowHour(
            flow,
            len(taken),
            _p95_seconds(taken),
            round(100 * sum(taken) / _HOUR_MS, 1),
            starts[flow],
        )
        for flow, taken in durations.items()
    ]


def recent_drivers(pipeline_dir: str, since: float) -> list[str]:
    """The driver log folders under a pipeline's log folder whose stdout was written after `since`, a POSIX
    time. A cluster that never started has no driver log."""
    drivers = [os.path.join(pipeline_dir, cluster, "driver") for cluster in os.listdir(pipeline_dir)]
    return [
        driver
        for driver in drivers
        if os.path.isfile(os.path.join(driver, "stdout"))
        and os.path.getmtime(os.path.join(driver, "stdout")) > since
    ]


def _lines(paths: list[str]) -> Iterator[str]:
    for path in paths:
        with gzip.open(path, "rt", encoding="utf-8", errors="replace") as log:
            yield from log


def latest_pipeline_hour(pipeline_dir: str, flows: Collection[str], since: float) -> PipelineHour | None:
    """The latest hour any driver written since `since` has logged, per watched flow, read from every driver
    that logged it. A cluster too new to have rotated an hour leaves the one before it to read."""
    logs: dict[str, list[str]] = {}
    for driver in recent_drivers(pipeline_dir, since):
        for name in os.listdir(driver):
            logged = _HOURLY_LOG.match(name)
            if logged is not None:
                logs.setdefault(logged[1], []).append(os.path.join(driver, name))
    if not logs:
        return None

    latest = max(logs)
    hour = datetime.strptime(latest, "%Y-%m-%d-%H").replace(tzinfo=timezone.utc)
    return PipelineHour(hour, flow_hours(_lines(sorted(logs[latest])), flows))


def cluster_starts(clusters: Iterable[str], hour: datetime) -> int:
    """How many of a pipeline's clusters were created within the hour, read from their ids."""
    return sum(
        1
        for created in map(_CLUSTER.match, clusters)
        if created is not None
        and tuple(int(part) for part in created.groups()) == (hour.month, hour.day, hour.hour)
    )
