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
from collections.abc import Collection, Iterable, Iterator
from dataclasses import dataclass
from datetime import datetime, timezone

# 26/10/31 15:00:18 INFO ProgressReporter: [queryId = 405ab] [batchId = 2533] Streaming query made progress: {
_PROGRESS = "Streaming query made progress: "
# 26/10/30 17:42:31 INFO MicroBatchExecution: Starting __materialization_mat_clean_data_1 [id = e6fe32b4-...
_RUN_START = "MicroBatchExecution: Starting "
# A flow's name is the table it writes and a version, after this: __materialization_mat_raw_data_1. The
# macro pipeline's also carry the catalog and schema before it and the pipeline's id after it:
# open_jii_dev.centrum.__materialization_mat_46fe9925_6954_48bd_8e88_c9ca10f6b164_experiment_macro_data_1
_MATERIALIZATION = "__materialization_mat_"
_HOURLY_LOG_PREFIX = "log4j-"
_HOURLY_LOG_SUFFIX = ".log.gz"

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
    """A driver log's flow run starts, as the starting query's name, and its progress records, parsed. A
    record is pretty-printed, so its closing brace stands alone on its last line."""
    block: list[str] | None = None

    for line in lines:
        if block is not None:
            block.append(line)
            if line.rstrip() == "}":
                with contextlib.suppress(json.JSONDecodeError):
                    yield json.loads("".join(block))
                block = None
            continue

        _, started, name = line.partition(_RUN_START)
        if started:
            yield name.partition(" ")[0]
            continue

        _, progress, record = line.partition(_PROGRESS)
        if progress:
            block = [record]


def _watched_table(name: str | None, flows: Collection[str]) -> str | None:
    """The watched table a flow writes, or None. Where a pipeline id comes first, the longest watched
    table the name ends with is the one, so raw_data never claims experiment_raw_data's flow."""
    _, found, rest = (name or "").partition(_MATERIALIZATION)
    table = rest.rpartition("_")[0]
    if not found or not table:
        return None
    if table in flows:
        return table

    return max((flow for flow in flows if table.endswith(f"_{flow}")), key=len, default=None)


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
            flow = _watched_table(entry, flows)
            if flow is not None:
                starts[flow] += 1
        else:
            flow = _watched_table(entry.get("name"), flows)
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


def _logged_hour(name: str) -> datetime | None:
    """The hour a rotated log4j file holds, or None for any other file."""
    if not (name.startswith(_HOURLY_LOG_PREFIX) and name.endswith(_HOURLY_LOG_SUFFIX)):
        return None
    hour = name.removeprefix(_HOURLY_LOG_PREFIX).removesuffix(_HOURLY_LOG_SUFFIX)
    with contextlib.suppress(ValueError):
        return datetime.strptime(hour, "%Y-%m-%d-%H").replace(tzinfo=timezone.utc)
    return None


def _lines(paths: list[str]) -> Iterator[str]:
    for path in paths:
        with gzip.open(path, "rt", encoding="utf-8", errors="replace") as log:
            yield from log


def latest_pipeline_hour(pipeline_dir: str, flows: Collection[str], since: float) -> PipelineHour | None:
    """The latest hour any driver written since `since` has logged, per watched flow, read from every driver
    that logged it. A cluster too new to have rotated an hour leaves the one before it to read."""
    logs: dict[datetime, list[str]] = {}
    for driver in recent_drivers(pipeline_dir, since):
        for name in os.listdir(driver):
            logged = _logged_hour(name)
            if logged is not None:
                logs.setdefault(logged, []).append(os.path.join(driver, name))
    if not logs:
        return None

    latest = max(logs)
    return PipelineHour(latest, flow_hours(_lines(sorted(logs[latest])), flows))


def cluster_starts(pipeline_dir: str, hour: datetime) -> int:
    """How many of a pipeline's clusters were created within the hour. A cluster id opens with the month,
    day and time it was created (1030-173330-96v7f5e4 at 17:33:30 UTC on 30 October) but not the year, and
    the volume keeps every year's, so a cluster whose driver last wrote before the hour is an older one."""
    created = f"{hour:%m%d-%H}"

    def wrote_before(cluster: str) -> bool:
        stdout = os.path.join(pipeline_dir, cluster, "driver", "stdout")
        return os.path.isfile(stdout) and os.path.getmtime(stdout) < hour.timestamp()

    return sum(
        1
        for cluster in os.listdir(pipeline_dir)
        if cluster[: len(created)] == created and not wrote_before(cluster)
    )
