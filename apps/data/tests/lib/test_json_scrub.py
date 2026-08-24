"""Tests for openjii.json_scrub."""

from __future__ import annotations

import json

from openjii.json_scrub import scrub_non_finite_json_value


def _strict_loads(payload: str | None):
    def reject(token: str):
        raise ValueError(f"non-standard token {token}")

    assert payload is not None
    return json.loads(payload, parse_constant=reject)


class TestRepairNonFiniteJsonValue:
    def test_none_passes_through(self) -> None:
        assert scrub_non_finite_json_value(None) is None

    def test_clean_payload_is_returned_unparsed(self) -> None:
        payload = json.dumps({"a": 1.5, "b": [1, 2], "c": {"d": "x"}})
        assert scrub_non_finite_json_value(payload) is payload

    def test_object_value(self) -> None:
        assert _strict_loads(scrub_non_finite_json_value('{"a": NaN}')) == {"a": None}

    def test_array_elements(self) -> None:
        scrubbed = scrub_non_finite_json_value('{"cal": [1.0, NaN, -Infinity, Infinity, 2]}')
        assert _strict_loads(scrubbed) == {"cal": [1.0, None, None, None, 2]}

    def test_nested_calibration_shape(self) -> None:
        payload = (
            '[{"protocol_id":"CALIBRATION","set":[{"device":{"temp_offset":NaN,'
            '"adpd_calibration":[0,NaN,0]},"par_slope":1.0}]}]'
        )
        parsed = _strict_loads(scrub_non_finite_json_value(payload))
        assert parsed[0]["set"][0]["device"]["temp_offset"] is None
        assert parsed[0]["set"][0]["device"]["adpd_calibration"] == [0, None, 0]
        assert parsed[0]["set"][0]["par_slope"] == 1.0

    def test_quoted_token_strings_survive(self) -> None:
        payload = '{"detail": "NaN", "name": "Infinity Ward", "temp": NaN}'
        assert _strict_loads(scrub_non_finite_json_value(payload)) == {
            "detail": "NaN",
            "name": "Infinity Ward",
            "temp": None,
        }

    def test_unicode_survives_scrub(self) -> None:
        payload = '{"note": "🌱 öß", "temp": NaN}'
        assert _strict_loads(scrub_non_finite_json_value(payload)) == {
            "note": "🌱 öß",
            "temp": None,
        }

    def test_unparseable_payload_passes_through(self) -> None:
        truncated = '{"detail": "NaN", "cal": [1.0,'
        assert scrub_non_finite_json_value(truncated) == truncated
