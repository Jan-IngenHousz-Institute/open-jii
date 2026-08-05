"""Compatibility checks for workbook provenance in centrum payload schemas."""

from __future__ import annotations

from openjii.centrum import large_iot_schema, sensor_schema, workbook_run_control_schema


def test_workbook_attempt_id_is_nullable_in_ingest_schemas() -> None:
    for schema in (sensor_schema, large_iot_schema):
        field = schema["workbook_attempt_id"]
        assert field.nullable is True
        assert field.dataType.simpleString() == "string"


def test_producer_cell_id_is_nullable_in_ingest_schemas() -> None:
    for schema in (sensor_schema, large_iot_schema):
        field = schema["producer_cell_id"]
        assert field.nullable is True
        assert field.dataType.simpleString() == "string"


def test_terminal_control_schema_preserves_expected_membership() -> None:
    assert workbook_run_control_schema["record_kind"].dataType.simpleString() == "string"
    assert (
        workbook_run_control_schema["expected"].dataType.simpleString()
        == "array<struct<producer_cell_id:string,device_ids:array<string>>>"
    )
