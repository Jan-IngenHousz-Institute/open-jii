"""Smoke tests for the spark-free openjii.centrum surface (constants + exports)."""

from __future__ import annotations

import re
from pathlib import Path

import openjii.centrum as centrum

_HEALTHCHECK_MODULE = (
    Path(__file__).parents[4] / "infrastructure/modules/monitoring/ingest-healthcheck/main.tf"
)


def test_upload_constants_exported() -> None:
    assert centrum.RAW_UPLOADED_DATA_TABLE == "raw_uploaded_data"
    assert centrum.EXPERIMENT_UPLOADED_DATA_TABLE == "experiment_uploaded_data"
    for name in (
        "RAW_UPLOADED_DATA_TABLE",
        "EXPERIMENT_UPLOADED_DATA_TABLE",
    ):
        assert name in centrum.__all__


def test_connectivity_constants_exported() -> None:
    assert centrum.RAW_DEVICE_LIFECYCLE_EVENTS_TABLE == "raw_device_lifecycle_events"
    assert centrum.CLEAN_DEVICE_LIFECYCLE_EVENTS_TABLE == "clean_device_lifecycle_events"
    assert centrum.DEVICE_LAST_ACTIVITY_TABLE == "device_last_activity"
    for name in (
        "RAW_DEVICE_LIFECYCLE_EVENTS_TABLE",
        "CLEAN_DEVICE_LIFECYCLE_EVENTS_TABLE",
        "DEVICE_LAST_ACTIVITY_TABLE",
        "device_lifecycle_event_schema",
    ):
        assert name in centrum.__all__


def test_ambyte_constants_removed() -> None:
    for name in ("RAW_AMBYTE_TABLE", "ENRICHED_RAW_AMBYTE_DATA_VIEW"):
        assert not hasattr(centrum, name)
        assert name not in centrum.__all__


def test_runtime_not_reexported() -> None:
    # runtime.py reads spark.conf eagerly; keeping it out of the package __init__
    # is what makes `import openjii.centrum` safe without an active Spark session.
    assert "runtime" not in centrum.__all__


def test_healthcheck_constants_exported() -> None:
    assert centrum.INGEST_HEALTHCHECKS_TABLE == "ingest_healthchecks"
    for name in (
        "INGEST_HEALTHCHECKS_TABLE",
        "INGEST_HEALTHCHECK_EXPERIMENT_ID",
        "INGEST_TOPIC_EXPERIMENT_PATTERN",
    ):
        assert name in centrum.__all__


def test_healthcheck_topic_carries_the_id_bronze_splits_on() -> None:
    # A mismatch is silent: the publisher's messages would reach raw_data as measurements, which
    # is non-resettable, while the health check table read nothing.
    declared = re.search(r'^\s*topic\s*=\s*"([^"]+)"', _HEALTHCHECK_MODULE.read_text(), re.MULTILINE)
    assert declared is not None
    topic = declared.group(1).replace("${var.environment}", "dev")

    extracted = re.search(centrum.INGEST_TOPIC_EXPERIMENT_PATTERN, topic)
    assert extracted is not None
    assert extracted.group(1) == centrum.INGEST_HEALTHCHECK_EXPERIMENT_ID

    # The lean ingest rule selects four segments after the version, and only a topic it selects
    # takes the real path to Kinesis.
    assert len(topic.removeprefix("experiment/data_ingest/v1/").split("/")) == 4
