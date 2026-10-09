"""Tests for reading a pipeline driver's retained memory from its GC log."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from openjii.heartbeat.driver_heap import (
    FullCollection,
    driver_logs,
    last_full_collection,
    latest_full_collection,
)

# Lines from dev Centrum's driver on 1 Oct 2026, a young collection either side of a full one
# whose class histogram (tens of thousands of lines) sits between its heap line and its pause.
YOUNG_BEFORE = """\
[2026-10-01T01:47:22.450+0000][18029.873s][info ][gc,heap      ] GC(1678) PSYoungGen: 819577K(4070912K)->5199K(4069888K) Eden: 770115K(3949568K)->0K(3952640K) From: 49462K(121344K)->5199K(117248K)
[2026-10-01T01:47:22.450+0000][18029.873s][info ][gc,heap      ] GC(1678) ParOldGen: 7584706K(8388608K)->7611953K(8388608K)
[2026-10-01T01:47:22.450+0000][18029.874s][info ][gc           ] GC(1678) Pause Young (System.gc()) 8207M->7438M(12166M) 31.295ms
"""
FULL = """\
[2026-10-01T01:47:29.027+0000][18036.451s][info ][gc,heap      ] GC(1679) PSYoungGen: 5199K(4069888K)->0K(4069888K) Eden: 0K(3952640K)->0K(3952640K) From: 5199K(117248K)->0K(117248K)
[2026-10-01T01:47:29.027+0000][18036.451s][info ][gc,heap      ] GC(1679) ParOldGen: 7611953K(8388608K)->2376074K(8388608K)
[2026-10-01T01:47:30.133+0000][18037.556s][trace][gc,classhisto] GC(1679)    1:       4791234      788504608  [B (java.base@17.0.20)
[2026-10-01T01:47:30.438+0000][18037.861s][trace][gc,classhisto] GC(1679) Class Histogram (after full gc) 1410.628ms
[2026-10-01T01:47:30.438+0000][18037.861s][info ][gc           ] GC(1679) Pause Full (System.gc()) 7438M->2320M(12166M) 7987.687ms
"""
YOUNG_AFTER = """\
[2026-10-01T01:47:37.677+0000][18045.101s][info ][gc,heap      ] GC(1680) ParOldGen: 2376074K(8388608K)->2376074K(8388608K)
[2026-10-01T01:47:37.677+0000][18045.101s][info ][gc           ] GC(1680) Pause Young (Allocation Failure) 6180M->2368M(12170M) 36.264ms
"""
# The macro driver, on a 5 GB heap, writes its levels unpadded.
MACRO_FULL = """\
[2026-10-01T01:50:00.889+0000][18037.040s][info][gc,heap     ] GC(464) ParOldGen: 2043651K(3495424K)->1272302K(3495424K)
[2026-10-01T01:50:00.889+0000][18037.040s][info][gc          ] GC(464) Pause Full (System.gc()) 2011M->1242M(5074M) 1093.453ms
"""

FULL_AT = datetime(2026, 10, 1, 1, 47, 30, 438000, tzinfo=timezone.utc)


def lines(*chunks: str) -> list[str]:
    return "".join(chunks).splitlines(keepends=True)


def test_reads_the_old_generation_a_full_collection_left_behind():
    collection = last_full_collection(lines(YOUNG_BEFORE, FULL, YOUNG_AFTER))

    # 2376074K of 8388608K
    assert collection == FullCollection(FULL_AT, 28.3)


def test_reads_the_macro_drivers_unpadded_lines():
    collection = last_full_collection(lines(MACRO_FULL))

    assert collection == FullCollection(datetime(2026, 10, 1, 1, 50, 0, 889000, tzinfo=timezone.utc), 36.4)


def test_takes_the_last_of_several_full_collections():
    later = FULL.replace("GC(1679)", "GC(1700)").replace("01:47:30.438", "02:17:30.438")
    later = later.replace("->2376074K", "->4194304K")

    collection = last_full_collection(lines(FULL, YOUNG_AFTER, later))

    assert collection is not None
    assert collection.old_gen_percent == 50.0
    assert collection.at == datetime(2026, 10, 1, 2, 17, 30, 438000, tzinfo=timezone.utc)


def test_young_collections_alone_report_nothing():
    # A young collection's old generation still holds whatever garbage it has promoted.
    assert last_full_collection(lines(YOUNG_BEFORE, YOUNG_AFTER)) is None


def test_a_pause_without_its_own_heap_line_is_not_paired_with_another_collections():
    pause_only = FULL.splitlines(keepends=True)[-1]

    assert last_full_collection(lines(YOUNG_BEFORE, pause_only)) is None


def write_driver(pipeline_dir: Path, cluster: str, files: dict[str, str], modified: float) -> Path:
    driver = pipeline_dir / cluster / "driver"
    driver.mkdir(parents=True)
    for name, content in files.items():
        (driver / name).write_text(content)
    os.utime(driver / "stdout", (modified, modified))
    return driver


def test_lists_the_newest_drivers_live_file_then_its_rotated_hours(tmp_path: Path):
    write_driver(tmp_path, "0930-204143-83q122vg", {"stdout": ""}, modified=1_000)
    current = write_driver(
        tmp_path,
        "1001-031500-abcdefgh",
        {"stdout": "", "stdout--2026-10-01--02-00": "", "stdout--2026-10-01--03-00": ""},
        modified=2_000,
    )
    (tmp_path / "1001-040000-neverran" / "driver").mkdir(parents=True)

    assert driver_logs(str(tmp_path)) == [
        str(current / "stdout"),
        str(current / "stdout--2026-10-01--03-00"),
        str(current / "stdout--2026-10-01--02-00"),
    ]


def test_falls_back_to_the_hour_rotated_out_before_the_live_file(tmp_path: Path):
    write_driver(
        tmp_path,
        "1001-031500-abcdefgh",
        {"stdout": YOUNG_AFTER, "stdout--2026-10-01--02-00": FULL},
        modified=2_000,
    )

    assert latest_full_collection(str(tmp_path)) == FullCollection(FULL_AT, 28.3)


def test_reads_no_further_back_than_the_hour_before_the_live_file(tmp_path: Path):
    write_driver(
        tmp_path,
        "1001-031500-abcdefgh",
        {"stdout": YOUNG_AFTER, "stdout--2026-10-01--03-00": YOUNG_AFTER, "stdout--2026-10-01--02-00": FULL},
        modified=2_000,
    )

    assert latest_full_collection(str(tmp_path)) is None
