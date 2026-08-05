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
                [{"producer_cell_id": "producer-1", "device_ids": ["device-1", "device-2"]}],
                now,
                "1",
            )
        ],
        MANIFEST_SCHEMA,
    )


def _measurement_rows(spark, pairs):
    now = datetime(2026, 8, 5, tzinfo=timezone.utc)
    return spark.createDataFrame(
        [("experiment-1", "attempt-1", "version-1", producer, device, now) for producer, device in pairs],
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
