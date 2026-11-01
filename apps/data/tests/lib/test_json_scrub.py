"""Tests for openjii.json_scrub."""

from __future__ import annotations

import json

import pytest
from openjii.json_scrub import scrub_non_finite_json, scrub_non_finite_json_value
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

_PAYLOADS = [
    None,
    "",
    '{"a": 1.5, "b": [1, 2]}',
    '{"a": NaN}',
    '{"cal": [1.0, NaN, -Infinity, Infinity, 2]}',
    "[NaN,NaN,-Infinity]",
    '{"detail": "NaN", "name": "Infinity Ward", "temp": NaN}',
    '{"only": "NaN in a string"}',
    '{"note": "🌱 öß", "temp": NaN}',
    '{"detail": "NaN", "cal": [1.0,',
    '{"detail": "say \\"NaN\\" now", "t": NaN}',
    '{"path": "C:\\\\temp\\\\", "t": NaN}',
    '{"a": "unterminated NaN, "b": NaN}',
    '"lone quote then NaN',
    'outside \\ a backslash NaN "and a string"',
    '{"x": -NaN, "y": NaNx}',
    '{"a":\n NaN\n}',
    '{"a": 0.12345678901234567890123456789012345, "b": 123456789012345678901234567890, "t": NaN}',
    '{"long": "' + "x" * 200_000 + '", "t": NaN}',
    '{"open": "' + "y" * 200_000 + " NaN",
    # Every escaped quote here once made the scan retry the literal to the end: quadratic time.
    '{"t": NaN, "open": "' + '\\"' * 200_000,
    '{"t": NaN, "trailing": "\\',
    '{"t": NaN} "',
    '{"t": NaN, "s": "line\\\nbreak"}',
]


def _strict_loads(payload: str | None):
    def reject(token: str):
        raise ValueError(f"non-standard token {token}")

    assert payload is not None
    return json.loads(payload, parse_constant=reject)


class TestScrubNonFiniteJsonValue:
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

    def test_high_precision_numbers_preserved_exactly(self) -> None:
        payload = (
            '{"a": 0.12345678901234567890123456789012345, "b": 123456789012345678901234567890, "t": NaN}'
        )
        assert scrub_non_finite_json_value(payload) == (
            '{"a": 0.12345678901234567890123456789012345, "b": 123456789012345678901234567890, "t": null}'
        )

    def test_escaped_quotes_keep_string_state(self) -> None:
        payload = '{"detail": "say \\"NaN\\" now", "t": NaN}'
        assert scrub_non_finite_json_value(payload) == '{"detail": "say \\"NaN\\" now", "t": null}'


@pytest.mark.spark
def test_the_spark_scrub_gives_what_the_python_one_does(spark: SparkSession) -> None:
    frame = spark.createDataFrame([(payload,) for payload in _PAYLOADS], "payload string")

    scrubbed = [
        row.scrubbed
        for row in frame.select(scrub_non_finite_json(F.col("payload")).alias("scrubbed")).collect()
    ]

    assert scrubbed == [scrub_non_finite_json_value(payload) for payload in _PAYLOADS]


@pytest.mark.spark
def test_the_spark_scrub_runs_no_python(spark: SparkSession, capsys: pytest.CaptureFixture[str]) -> None:
    frame = spark.createDataFrame([('{"a": NaN}',)], "payload string")

    frame.select(scrub_non_finite_json(F.col("payload"))).explain()

    assert "Python" not in capsys.readouterr().out
