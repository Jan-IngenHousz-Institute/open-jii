"""Compatibility checks for workbook provenance in centrum payload schemas."""

from __future__ import annotations

from openjii.centrum import large_iot_schema, sensor_schema


def test_workbook_attempt_id_is_nullable_in_ingest_schemas() -> None:
    for schema in (sensor_schema, large_iot_schema):
        field = schema["workbook_attempt_id"]
        assert field.nullable is True
        assert field.dataType.simpleString() == "string"
