"""PySpark StructType schemas used by the centrum DLT pipeline.

Pure data: defining a StructType does not require an active Spark session.
"""

from __future__ import annotations

from pyspark.sql.types import (
    ArrayType,
    BooleanType,
    DoubleType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)

# Schema for a single sanitized question/answer entry inside a payload.
question_schema = StructType(
    [
        StructField("question_label", StringType(), True),
        StructField("question_text", StringType(), True),
        StructField("question_answer", StringType(), True),
    ]
)

# Macro reference attached to a measurement (id + display info).
macro_schema = StructType(
    [
        StructField("id", StringType(), True),
        StructField("name", StringType(), True),
        StructField("filename", StringType(), True),
    ]
)

# Annotation content: a union of "comment" (text) and "flag" (flagType) shapes.
# Both fields are stored side-by-side; only one is populated per row.
annotation_content_schema = StructType(
    [
        StructField("text", StringType(), True),
        StructField("flagType", StringType(), True),
    ]
)

annotation_schema = StructType(
    [
        StructField("id", StringType(), True),
        StructField("rowId", StringType(), True),
        StructField("type", StringType(), True),
        StructField("content", annotation_content_schema, True),
        StructField("createdBy", StringType(), True),
        StructField("createdByName", StringType(), True),
        StructField("createdAt", TimestampType(), True),
        StructField("updatedAt", TimestampType(), True),
    ]
)

workbook_run_expected_schema = StructType(
    [
        # Producer expectations and lane-assignment expectations share the
        # existing array. Exactly one identity shape is populated per entry.
        StructField("producer_cell_id", StringType(), True),
        StructField("container_cell_id", StringType(), True),
        StructField("lane_id", StringType(), True),
        StructField("container_attempt_id", StringType(), True),
        StructField("device_ids", ArrayType(StringType()), False),
    ]
)

workbook_run_realized_schema = StructType(
    [
        # Measurement outcomes and terminal lane summaries share the existing
        # record kind and ingest path.
        StructField("producer_cell_id", StringType(), True),
        StructField("device_id", StringType(), True),
        StructField("outcome", StringType(), True),
        StructField("container_cell_id", StringType(), True),
        StructField("lane_id", StringType(), True),
        StructField("container_attempt_id", StringType(), True),
        StructField("status", StringType(), True),
        StructField("abandoned", BooleanType(), True),
    ]
)

# Terminal control record published through the same Kinesis stream as sensor
# rows. It is parsed only after bronze routing has removed it from measurement
# ingestion.
workbook_run_control_schema = StructType(
    [
        StructField("topic", StringType(), True),
        StructField("record_kind", StringType(), False),
        StructField("workbook_attempt_id", StringType(), False),
        StructField("workbook_version_id", StringType(), True),
        StructField("terminal_status", StringType(), False),
        StructField("expected", ArrayType(workbook_run_expected_schema), False),
        StructField("realized", ArrayType(workbook_run_realized_schema), False),
        StructField("_client_id", StringType(), True),
    ]
)

# Top-level schema for the JSON payload published by devices over Kinesis.
sensor_schema = StructType(
    [
        StructField("topic", StringType(), False),
        StructField("device_name", StringType(), True),
        StructField("device_version", StringType(), True),
        StructField("device_id", StringType(), True),
        StructField("device_battery", DoubleType(), True),
        StructField("device_firmware", StringType(), True),
        StructField("sample", StringType(), True),
        StructField("_sample_encoding", StringType(), True),
        StructField("timestamp", TimestampType(), False),
        StructField("output", StringType(), True),
        StructField("questions", ArrayType(question_schema), True),
        StructField("user_id", StringType(), True),
        StructField("timezone", StringType(), True),
        StructField("macros", ArrayType(macro_schema), True),
        StructField("annotations", ArrayType(annotation_schema), True),
        # One uuid per multi-device workbook run; the round's rows share it.
        # Nullable: absent on single-device uploads and all older payloads.
        StructField("workbook_run_id", StringType(), True),
        # Stable execution-attempt identity. Nullable for older payloads.
        StructField("workbook_attempt_id", StringType(), True),
        # Producer cell provenance used with device_id for attempt completeness.
        StructField("producer_cell_id", StringType(), True),
        StructField("container_cell_id", StringType(), True),
        StructField("lane_id", StringType(), True),
        StructField("container_attempt_id", StringType(), True),
        # GPS fix at measurement time; absent on older payloads and when the
        # app had no location permission or fix.
        StructField("latitude", DoubleType(), True),
        StructField("longitude", DoubleType(), True),
    ]
)

# Schema for large IoT payloads (>128 KB) uploaded directly to S3 via
# pre-signed URL. Same shape as the MQTT/Kinesis path but without the MQTT
# topic field, and experiment_id is extracted from the S3 key rather than the
# message envelope.
large_iot_schema = StructType(
    [
        StructField("device_name", StringType(), True),
        StructField("device_version", StringType(), True),
        StructField("device_id", StringType(), True),
        StructField("device_battery", DoubleType(), True),
        StructField("device_firmware", StringType(), True),
        StructField("sample", StringType(), True),
        StructField("_sample_encoding", StringType(), True),
        StructField("timestamp", TimestampType(), True),
        StructField("output", StringType(), True),
        StructField("questions", ArrayType(question_schema), True),
        StructField("user_id", StringType(), True),
        StructField("timezone", StringType(), True),
        StructField("macros", ArrayType(macro_schema), True),
        StructField("annotations", ArrayType(annotation_schema), True),
        StructField("experiment_id", StringType(), True),
        # Workbook execution metadata; absent on single-device uploads.
        # macro_context stays a JSON string because its keys are dynamic.
        StructField("workbook_run_id", StringType(), True),
        StructField("workbook_attempt_id", StringType(), True),
        StructField("producer_cell_id", StringType(), True),
        StructField("container_cell_id", StringType(), True),
        StructField("lane_id", StringType(), True),
        StructField("container_attempt_id", StringType(), True),
        StructField("workbook_version_id", StringType(), True),
        StructField("macro_context", StringType(), True),
        # GPS fix at measurement time; absent without permission or fix.
        StructField("latitude", DoubleType(), True),
        StructField("longitude", DoubleType(), True),
    ]
)
