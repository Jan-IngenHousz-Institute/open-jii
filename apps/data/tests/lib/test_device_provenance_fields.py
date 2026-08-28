"""Device and publisher provenance fields carried from the mobile payload."""

from __future__ import annotations

import openjii.centrum as centrum

# Written by the mobile app: device_family is the sensor's canonical driver
# family, client_* describes the phone that published.
PROVENANCE_FIELDS = (
    "device_family",
    "device_address",
    "client_model",
    "client_manufacturer",
    "client_os",
    "client_os_version",
    "client_app_version",
)


def test_large_iot_schema_parses_provenance_fields() -> None:
    names = {field.name for field in centrum.large_iot_schema.fields}
    missing = [field for field in PROVENANCE_FIELDS if field not in names]
    assert not missing, f"large_iot_schema would drop {missing} at parse time"


def test_large_iot_provenance_fields_are_nullable_strings() -> None:
    fields = {field.name: field for field in centrum.large_iot_schema.fields}
    for name in PROVENANCE_FIELDS:
        assert fields[name].dataType.typeName() == "string"
        # Older payloads predate these keys and must still parse.
        assert fields[name].nullable


def test_sensor_schema_does_not_gain_provenance_fields() -> None:
    # The MQTT path reads these with get_json_object instead: adding them here
    # would evolve the non-resettable bronze parsed_data struct.
    names = {field.name for field in centrum.sensor_schema.fields}
    for name in PROVENANCE_FIELDS:
        assert name not in names
