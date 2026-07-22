"""PySpark StructType schemas used by the centrum DLT pipeline.

Pure data: defining a StructType does not require an active Spark session.
"""

from __future__ import annotations

from pyspark.sql.types import (
    ArrayType,
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
        # GPS fix at measurement time; absent on older payloads and when the
        # app had no location permission or fix.
        StructField("latitude", DoubleType(), True),
        StructField("longitude", DoubleType(), True),
    ]
)
