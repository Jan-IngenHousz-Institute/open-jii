"""Tests for reading how busy a pipeline's flows are from its driver's streaming progress records."""

from __future__ import annotations

import gzip
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from openjii.heartbeat.flow_batches import (
    FlowHour,
    PipelineHour,
    cluster_starts,
    flow_hours,
    latest_pipeline_hour,
    progress_records,
)

RUN = "f173d620-e16d-46df-af37-bdc1efdeb77c"
CENTRUM = ("raw_data", "clean_data", "experiment_raw_data")
HOUR = datetime(2026, 10, 31, 15, tzinfo=timezone.utc)


def progress(name: str | None, duration: int, run: str = RUN, batch: int = 1) -> str:
    """One record as dev Centrum's driver logged it on 31 Oct 2026, trimmed, with a line either side."""
    return f"""\
26/10/31 15:00:18 INFO TaskSetManager: [queryId = 4a949] Finished task 0.0 in stage 212894.0
26/10/31 15:00:18 INFO ProgressReporter: [queryId = 405ab] [batchId = {batch}] Streaming query made progress: {{
  "id" : "405ab362-c877-49cb-9d56-7a387ef13f18",
  "runId" : "{run}",
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
  "sources" : [ {{
    "description" : "DeltaSource[s3://open-jii-databricks-uc-eu-central-1-metastore/external/dev/__unitystorage]",
    "numInputRows" : 18
  }} ],
  "sink" : {{
    "description" : "ForeachBatchSink",
    "numOutputRows" : -1
  }}
}}
26/10/31 15:00:18 INFO LastExecutionSingleton: [queryId = 405ab] [batchId = {batch}] Purging executed plan
"""


def lines(*records: str) -> list[str]:
    return "".join(records).splitlines(keepends=True)


def test_reads_each_record_from_among_the_other_log_lines():
    records = list(
        progress_records(lines(progress("__materialization_mat_clean_data_1", 1054), progress(None, 688)))
    )

    assert [(r["name"], r["batchDuration"]) for r in records] == [
        ("__materialization_mat_clean_data_1", 1054),
        (None, 688),
    ]


def test_summarises_a_flows_batches_over_its_hour():
    clean = [
        progress("__materialization_mat_clean_data_1", seconds * 1000, batch=seconds)
        for seconds in range(1, 21)
    ]

    summary = flow_hours(progress_records(lines(*clean)), ["clean_data"], new_clusters=0)

    # 210 seconds in batches out of 3,600; the 19th of 20 batches is the p95.
    assert summary == [FlowHour("clean_data", 20, 19.0, 5.8, 0)]


def test_reads_the_macro_pipelines_flow_names_with_their_catalog_and_pipeline_id():
    name = "open_jii_dev.centrum.__materialization_mat_46fe9925_6954_48bd_8e88_c9ca10f6b164_experiment_macro_data_1"

    summary = flow_hours(
        progress_records(lines(progress(name, 1959))), ["experiment_macro_data"], new_clusters=0
    )

    assert summary == [FlowHour("experiment_macro_data", 1, 2.0, 0.1, 0)]


def test_leaves_out_flows_whose_names_only_start_like_a_watched_one():
    others = lines(
        progress("__materialization_mat_raw_uploaded_data_1", 32763),
        progress("__materialization_mat_experiment_raw_data_schemas_1", 1284),
        progress("serving_store_measurements_changes", 2045),
    )

    summary = flow_hours(progress_records(others), CENTRUM, new_clusters=0)

    assert all(flow.batches == 0 for flow in summary)


def test_a_watched_flow_without_batches_reads_idle_rather_than_missing():
    summary = flow_hours(
        progress_records(lines(progress("__materialization_mat_raw_data_1", 919))), CENTRUM, 0
    )

    assert summary == [
        FlowHour("raw_data", 1, 0.9, 0.0, 0),
        FlowHour("clean_data", 0, None, 0.0, 0),
        FlowHour("experiment_raw_data", 0, None, 0.0, 0),
    ]


def test_counts_each_further_run_of_a_flow_as_a_restart():
    retried = lines(
        progress("__materialization_mat_clean_data_1", 1572, run=RUN),
        progress("__materialization_mat_clean_data_1", 1572, run="0d1b7c2e-0000-4000-8000-000000000001"),
        progress("__materialization_mat_clean_data_1", 1572, run="0d1b7c2e-0000-4000-8000-000000000002"),
    )

    assert flow_hours(progress_records(retried), ["clean_data"], new_clusters=0)[0].restarts == 2


def test_adds_a_cluster_created_within_the_hour_to_every_flows_restarts():
    summary = flow_hours(
        progress_records(lines(progress("__materialization_mat_raw_data_1", 919))), CENTRUM, 1
    )

    assert [flow.restarts for flow in summary] == [1, 1, 1]


def test_counts_the_clusters_whose_ids_say_they_were_created_within_the_hour():
    clusters = [
        "1031-142959-aaaaaaaa",
        "1031-150000-bbbbbbbb",
        "1031-155959-cccccccc",
        "1031-160000-dddddddd",
        "logs",
    ]

    assert cluster_starts(clusters, HOUR) == 2


def write_hour(driver: Path, hour: str, *records: str) -> None:
    with gzip.open(driver / f"log4j-{hour}.log.gz", "wt", encoding="utf-8") as log:
        log.write("".join(records))


def test_reads_the_latest_logged_hour_of_the_newest_driver(tmp_path: Path):
    old = tmp_path / "1030-171008-4wtd5li4" / "driver"
    old.mkdir(parents=True)
    (old / "stdout").write_text("")
    os.utime(old / "stdout", (1_000, 1_000))
    write_hour(old, "2026-10-30-17", progress("__materialization_mat_raw_data_1", 99_000))

    current = tmp_path / "1031-152030-96v7f5e4" / "driver"
    current.mkdir(parents=True)
    (current / "stdout").write_text("")
    os.utime(current / "stdout", (2_000, 2_000))
    write_hour(current, "2026-10-31-14", progress("__materialization_mat_raw_data_1", 99_000))
    write_hour(current, "2026-10-31-15", progress("__materialization_mat_raw_data_1", 919))
    (current / "log4j-active.log").write_text(progress("__materialization_mat_raw_data_1", 99_000))

    assert latest_pipeline_hour(str(tmp_path), ["raw_data"]) == PipelineHour(
        HOUR, [FlowHour("raw_data", 1, 0.9, 0.0, 1)]
    )


def test_a_driver_without_a_logged_hour_reports_nothing(tmp_path: Path):
    driver = tmp_path / "1031-152030-96v7f5e4" / "driver"
    driver.mkdir(parents=True)
    (driver / "stdout").write_text("")
    (driver / "log4j-active.log").write_text(progress("__materialization_mat_raw_data_1", 919))

    assert latest_pipeline_hour(str(tmp_path), ["raw_data"]) is None
