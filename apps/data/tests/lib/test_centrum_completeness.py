"""Workbook completeness is recomputed from manifests and received rows."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from openjii.centrum.completeness import derive_workbook_run_completeness
from pyspark.sql.types import (
    ArrayType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)

EXPECTED_ENTRY = StructType(
    [
        StructField("producer_cell_id", StringType(), True),
        StructField("container_cell_id", StringType(), True),
        StructField("lane_id", StringType(), True),
        StructField("container_attempt_id", StringType(), True),
        StructField("device_ids", ArrayType(StringType()), True),
    ]
)
MANIFEST_SCHEMA = StructType(
    [
        StructField("experiment_id", StringType(), True),
        StructField("workbook_attempt_id", StringType(), True),
        StructField("workbook_version_id", StringType(), True),
        StructField("terminal_status", StringType(), True),
        StructField("expected", ArrayType(EXPECTED_ENTRY), True),
        StructField("ingestion_timestamp", TimestampType(), True),
        StructField("kinesis_sequence_number", StringType(), True),
    ]
)
MEASUREMENT_SCHEMA = StructType(
    [
        StructField("experiment_id", StringType(), True),
        StructField("workbook_attempt_id", StringType(), True),
        StructField("workbook_version_id", StringType(), True),
        StructField("producer_cell_id", StringType(), True),
        StructField("container_cell_id", StringType(), True),
        StructField("lane_id", StringType(), True),
        StructField("container_attempt_id", StringType(), True),
        StructField("device_id", StringType(), True),
        StructField("processed_timestamp", TimestampType(), True),
    ]
)


def _manifest_rows(spark):
    now = datetime(2026, 8, 5, tzinfo=timezone.utc)
    return spark.createDataFrame(
        [
            (
                "experiment-1",
                "attempt-1",
                "version-1",
                "partial",
                [
                    {
                        "producer_cell_id": "producer-1",
                        "container_cell_id": None,
                        "lane_id": None,
                        "container_attempt_id": None,
                        "device_ids": ["device-1", "device-2"],
                    }
                ],
                now,
                "1",
            )
        ],
        MANIFEST_SCHEMA,
    )


def _measurement_rows(spark, pairs):
    now = datetime(2026, 8, 5, tzinfo=timezone.utc)
    return spark.createDataFrame(
        [
            (
                "experiment-1",
                "attempt-1",
                "version-1",
                producer,
                None,
                None,
                None,
                device,
                now,
            )
            for producer, device in pairs
        ],
        MEASUREMENT_SCHEMA,
    )


@pytest.mark.spark
def test_late_row_moves_attempt_from_partial_to_complete(spark) -> None:
    manifests = _manifest_rows(spark)

    partial = derive_workbook_run_completeness(
        manifests, _measurement_rows(spark, [("producer-1", "device-1")])
    ).collect()[0]
    assert partial.completeness == "partial"
    assert partial.expected_count == 2
    assert partial.received_count == 1
    assert partial.missing_pairs[0].device_id == "device-2"

    complete = derive_workbook_run_completeness(
        manifests,
        _measurement_rows(
            spark,
            [("producer-1", "device-1"), ("producer-1", "device-2")],
        ),
    ).collect()[0]
    assert complete.completeness == "complete"
    assert complete.received_count == 2
    assert complete.missing_pairs == []


@pytest.mark.spark
def test_rows_without_manifest_are_unknown(spark) -> None:
    manifests = spark.createDataFrame([], MANIFEST_SCHEMA)
    measurements = _measurement_rows(
        spark,
        [("producer-1", "device-1"), ("producer-1", "device-2")],
    )
    result = derive_workbook_run_completeness(
        manifests,
        measurements,
    ).collect()[0]

    assert result.completeness == "unknown"
    assert result.expected_count is None
    assert result.received_count is None

    after_manifest = derive_workbook_run_completeness(_manifest_rows(spark), measurements).collect()[0]
    assert after_manifest.completeness == "complete"


@pytest.mark.spark
def test_manifest_without_expected_membership_is_unknown(spark) -> None:
    now = datetime(2026, 8, 5, tzinfo=timezone.utc)
    manifests = spark.createDataFrame(
        [("experiment-1", "attempt-empty", "version-1", "unknown", [], now, "1")],
        MANIFEST_SCHEMA,
    )
    measurements = spark.createDataFrame([], MEASUREMENT_SCHEMA)

    result = derive_workbook_run_completeness(manifests, measurements).collect()[0]

    assert result.completeness == "unknown"
    assert result.expected_count == 0
    assert result.received_count == 0


@pytest.mark.spark
def test_lane_with_no_rows_keeps_container_attempt_partial(spark) -> None:
    now = datetime(2026, 8, 5, tzinfo=timezone.utc)
    manifests = spark.createDataFrame(
        [
            (
                "experiment-1",
                "attempt-1",
                "version-1",
                "partial",
                [
                    {
                        "producer_cell_id": None,
                        "container_cell_id": "parallel-1",
                        "lane_id": "failed-lane",
                        "container_attempt_id": "parallel-1:1",
                        "device_ids": ["device-failed"],
                    },
                    {
                        "producer_cell_id": None,
                        "container_cell_id": "parallel-1",
                        "lane_id": "ok-lane",
                        "container_attempt_id": "parallel-1:1",
                        "device_ids": ["device-ok"],
                    },
                ],
                now,
                "1",
            )
        ],
        MANIFEST_SCHEMA,
    )
    measurements = spark.createDataFrame(
        [
            (
                "experiment-1",
                "attempt-1",
                "version-1",
                "producer-ok",
                "parallel-1",
                "ok-lane",
                "parallel-1:1",
                "device-ok",
                now,
            )
        ],
        MEASUREMENT_SCHEMA,
    )

    result = derive_workbook_run_completeness(manifests, measurements).collect()[0]

    assert result.completeness == "partial"
    assert result.expected_count == 2
    assert result.received_count == 1
    assert result.missing_pairs[0].lane_id == "failed-lane"
    assert result.missing_pairs[0].device_id == "device-failed"
