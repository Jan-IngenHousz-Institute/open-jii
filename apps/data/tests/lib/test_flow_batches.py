"""Tests for reading how busy a pipeline's flows are, and how often they restart, from its drivers' logs."""

from __future__ import annotations

import gzip
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from openjii.heartbeat.flow_batches import (
    FlowHour,
    PipelineHour,
    cluster_starts,
    flow_hours,
    latest_pipeline_hour,
)

RUN = "f173d620-e16d-46df-af37-bdc1efdeb77c"
CENTRUM = ("raw_data", "clean_data", "experiment_raw_data")
HOUR = datetime(2026, 10, 31, 15, tzinfo=timezone.utc)
MACRO = (
    "open_jii_dev.centrum.__materialization_mat_46fe9925_6954_48bd_8e88_c9ca10f6b164_experiment_macro_data_1"
)


def progress(name: str | None, duration: int, batch: int = 1, sink: str = "ForeachBatchSink") -> str:
    """One record as dev Centrum's driver logged it on 31 Oct 2026, trimmed, with a line either side."""
    return f"""\
26/10/31 15:00:18 INFO TaskSetManager: [queryId = 4a949] Finished task 0.0 in stage 212894.0
26/10/31 15:00:18 INFO ProgressReporter: [queryId = 405ab] [batchId = {batch}] Streaming query made progress: {{
  "id" : "405ab362-c877-49cb-9d56-7a387ef13f18",
  "runId" : "{RUN}",
  "name" : {json.dumps(name)},
  "timestamp" : "2026-10-31T15:00:17.532Z",
  "batchId" : {batch},
  "batchDuration" : {duration},
  "numInputRows" : 18,
  "durationMs" : {{
    "addBatch" : 489,
    "triggerExecution" : {duration}
  }},
  "stateOperators" : [ ],
  "sink" : {{
    "description" : {json.dumps(sink)},
    "numOutputRows" : -1
  }}
}}
26/10/31 15:00:18 INFO LastExecutionSingleton: [queryId = 405ab] [batchId = {batch}] Purging executed plan
"""


def start(name: str) -> str:
    """A flow's run starting, as dev Centrum's driver logged it on 30 Oct 2026, trimmed."""
    return (
        f"26/10/30 17:42:31 INFO MicroBatchExecution: Starting {name} [id = e6fe32b4-9472-4859-8189-5f4d9731e856, "
        f"runId = 73b3bd21-749e-4d50-9d19-03b6062fc603]. Use s3://bucket/checkpoints to store the query checkpoint.\n"
    )


def lines(*entries: str) -> list[str]:
    return "".join(entries).splitlines(keepends=True)


def test_summarises_a_flows_batches_over_its_hour():
    clean = [
        progress("__materialization_mat_clean_data_1", seconds * 1000, batch=seconds)
        for seconds in range(1, 21)
    ]

    # 210 seconds in batches out of 3,600; the 19th of 20 batches is the p95.
    assert flow_hours(lines(*clean), ["clean_data"]) == [FlowHour("clean_data", 20, 19.0, 5.8, 0)]


def test_reads_the_macro_pipelines_flow_names_with_their_catalog_and_pipeline_id():
    summary = flow_hours(lines(start(MACRO), progress(MACRO, 1959)), ["experiment_macro_data"])

    assert summary == [FlowHour("experiment_macro_data", 1, 2.0, 0.1, 1)]


def test_gives_a_pipeline_id_prefixed_flow_to_the_longest_watched_table_it_ends_with():
    prefixed = "open_jii_dev.centrum.__materialization_mat_46fe9925_6954_48bd_8e88_c9ca10f6b164_experiment_raw_data_1"

    summary = flow_hours(lines(progress(prefixed, 1000)), CENTRUM)

    assert [(flow.flow, flow.batches) for flow in summary] == [
        ("raw_data", 0),
        ("clean_data", 0),
        ("experiment_raw_data", 1),
    ]


def test_leaves_out_flows_whose_names_only_start_like_a_watched_one():
    others = lines(
        start("__materialization_mat_raw_uploaded_data_1"),
        progress("__materialization_mat_raw_uploaded_data_1", 32763),
        progress("__materialization_mat_experiment_raw_data_schemas_1", 1284),
        progress("serving_store_measurements_changes", 2045),
        progress(None, 688),
    )

    assert all(flow.batches == 0 and flow.restarts == 0 for flow in flow_hours(others, CENTRUM))


def test_a_watched_flow_without_batches_reads_idle_rather_than_missing():
    summary = flow_hours(lines(progress("__materialization_mat_raw_data_1", 919)), CENTRUM)

    assert summary == [
        FlowHour("raw_data", 1, 0.9, 0.0, 0),
        FlowHour("clean_data", 0, None, 0.0, 0),
        FlowHour("experiment_raw_data", 0, None, 0.0, 0),
    ]


def test_counts_every_run_that_starts_even_one_that_fails_before_its_first_batch():
    retried = lines(
        start("__materialization_mat_clean_data_1"),
        start("__materialization_mat_clean_data_1"),
        start("__materialization_mat_clean_data_1"),
        progress("__materialization_mat_clean_data_1", 1572),
    )

    assert flow_hours(retried, ["clean_data"]) == [FlowHour("clean_data", 1, 1.6, 0.0, 3)]


def test_a_brace_inside_a_string_costs_no_other_record():
    stray = progress("__materialization_mat_clean_data_1", 1000, sink="DeltaSink[{]")
    after = progress("__materialization_mat_clean_data_1", 2000, batch=2)

    assert flow_hours(lines(stray, after), ["clean_data"])[0].batches == 2


def test_counts_the_clusters_whose_ids_say_they_were_created_within_the_hour(tmp_path: Path):
    for cluster in (
        "1031-142959-aaaaaaaa",
        "1031-150000-bbbbbbbb",
        "1031-155959-cccccccc",
        "1031-160000-dddddddd",
        "logs",
    ):
        (tmp_path / cluster).mkdir()

    assert cluster_starts(str(tmp_path), HOUR) == 2


def test_leaves_out_a_cluster_from_the_same_hour_of_an_earlier_year(tmp_path: Path):
    write_driver(tmp_path, "1031-150000-thisyear", written=HOUR.timestamp() + 600, hours={})
    write_driver(tmp_path, "1031-151500-lastyear", written=(HOUR - timedelta(days=365)).timestamp(), hours={})
    (tmp_path / "1031-153000-neverran").mkdir()

    assert cluster_starts(str(tmp_path), HOUR) == 2


def write_driver(pipeline_dir: Path, cluster: str, written: float, hours: dict[str, str]) -> Path:
    driver = pipeline_dir / cluster / "driver"
    driver.mkdir(parents=True)
    (driver / "stdout").write_text("")
    os.utime(driver / "stdout", (written, written))
    for hour, content in hours.items():
        with gzip.open(driver / f"log4j-{hour}.log.gz", "wt", encoding="utf-8") as log:
            log.write(content)
    return driver


def test_reads_the_latest_logged_hour_from_every_driver_that_logged_it(tmp_path: Path):
    write_driver(
        tmp_path,
        "1031-142000-aaaaaaaa",
        written=2_000,
        hours={
            "2026-10-31-14": progress("__materialization_mat_raw_data_1", 99_000),
            "2026-10-31-15": progress("__materialization_mat_raw_data_1", 900),
        },
    )
    current = write_driver(
        tmp_path,
        "1031-152030-96v7f5e4",
        written=3_000,
        hours={
            "2026-10-31-15": start("__materialization_mat_raw_data_1")
            + progress("__materialization_mat_raw_data_1", 900)
        },
    )
    (current / "log4j-active.log").write_text(progress("__materialization_mat_raw_data_1", 99_000))

    assert latest_pipeline_hour(str(tmp_path), ["raw_data"], since=1_000) == PipelineHour(
        HOUR, [FlowHour("raw_data", 2, 0.9, 0.1, 1)]
    )


def test_falls_back_to_an_older_driver_while_the_newest_has_no_hour_yet(tmp_path: Path):
    write_driver(
        tmp_path,
        "1031-142000-aaaaaaaa",
        written=2_000,
        hours={"2026-10-31-15": start("__materialization_mat_raw_data_1")},
    )
    write_driver(tmp_path, "1031-160500-bbbbbbbb", written=3_000, hours={})

    assert latest_pipeline_hour(str(tmp_path), ["raw_data"], since=1_000) == PipelineHour(
        HOUR, [FlowHour("raw_data", 0, None, 0.0, 1)]
    )


def test_ignores_a_log_file_whose_name_is_not_an_hour(tmp_path: Path):
    driver = write_driver(
        tmp_path,
        "1031-142000-aaaaaaaa",
        written=2_000,
        hours={"2026-10-31-15": start("__materialization_mat_raw_data_1")},
    )
    with gzip.open(driver / "log4j-custom.log.gz", "wt", encoding="utf-8") as log:
        log.write("")

    assert latest_pipeline_hour(str(tmp_path), ["raw_data"], since=1_000) == PipelineHour(
        HOUR, [FlowHour("raw_data", 0, None, 0.0, 1)]
    )


def test_leaves_out_drivers_that_stopped_writing_before_the_cutoff(tmp_path: Path):
    write_driver(
        tmp_path,
        "1031-142000-aaaaaaaa",
        written=500,
        hours={"2026-10-31-15": start("__materialization_mat_raw_data_1")},
    )
    (tmp_path / "1031-150000-neverran" / "driver").mkdir(parents=True)

    assert latest_pipeline_hour(str(tmp_path), ["raw_data"], since=1_000) is None
