"""How much memory a classic pipeline's driver keeps, read from its JVM's GC log.

The pipelines deliver each driver's stdout, which carries the GC log, to the pipeline-logs
volume as `<pipeline>/<cluster id>/driver/stdout`, rotating it into a file per hour. The
drivers run the parallel collector, whose old generation only a full collection empties, so
what is left after one is memory the driver holds. Once that nears the whole old generation,
the driver collects continuously and every flow stalls.
"""

from __future__ import annotations

import os
import re
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime

# GC(1679) ParOldGen: 7611953K(8388608K)->2376074K(8388608K)
_OLD_GENERATION = re.compile(r"GC\((\d+)\) ParOldGen: \d+K\(\d+K\)->(\d+)K\((\d+)K\)")
# [2026-10-01T01:47:30.438+0000][18037.861s][info ][gc ] GC(1679) Pause Full (System.gc()) 7438M->2320M(12166M) 7987.687ms
_FULL_COLLECTION = re.compile(r"^\[([^\]]+)\].* GC\((\d+)\) Pause Full ")

# The live file plus the hour rotated out before it always span the last hour.
_LOG_FILES_READ = 2


@dataclass(frozen=True)
class FullCollection:
    at: datetime
    old_gen_percent: float


def last_full_collection(lines: Iterable[str]) -> FullCollection | None:
    """The last full collection in a GC log, with how full it left the old generation."""
    old_generation: tuple[str, float] | None = None
    last: FullCollection | None = None

    for line in lines:
        if "ParOldGen" in line:
            old = _OLD_GENERATION.search(line)
            if old is not None:
                old_generation = (old[1], 100 * int(old[2]) / int(old[3]))
            continue

        if "Pause Full" not in line:
            continue
        full = _FULL_COLLECTION.search(line)
        if full is not None and old_generation is not None and old_generation[0] == full[2]:
            at = datetime.strptime(full[1], "%Y-%m-%dT%H:%M:%S.%f%z")
            last = FullCollection(at, round(old_generation[1], 1))

    return last


def driver_logs(pipeline_dir: str) -> list[str]:
    """The newest driver's stdout files under a pipeline's log folder, newest first."""
    drivers = [os.path.join(pipeline_dir, cluster, "driver") for cluster in os.listdir(pipeline_dir)]
    # A cluster that never started has no driver log.
    started = [driver for driver in drivers if os.path.isfile(os.path.join(driver, "stdout"))]
    if not started:
        return []

    newest = max(started, key=lambda driver: os.path.getmtime(os.path.join(driver, "stdout")))
    rotated = sorted((name for name in os.listdir(newest) if name.startswith("stdout--")), reverse=True)
    return [os.path.join(newest, name) for name in ["stdout", *rotated]]


def latest_full_collection(pipeline_dir: str) -> FullCollection | None:
    """The newest driver's latest full collection, from its live log or the hour before."""
    for path in driver_logs(pipeline_dir)[:_LOG_FILES_READ]:
        with open(path, encoding="utf-8", errors="replace") as log:
            collection = last_full_collection(log)
        if collection is not None:
            return collection

    return None
