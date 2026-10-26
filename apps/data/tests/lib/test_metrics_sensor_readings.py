"""Tests for reading one sensor parameter out of a device payload."""

from __future__ import annotations

import pytest
from openjii.metrics.sensor_readings import sensor_readings


@pytest.mark.spark
def test_readings_come_from_both_payload_shapes_and_skip_what_is_not_a_number(spark):
    source = spark.createDataFrame(
        [
            ("ambit", '[{"data": {"temperature": 21.5}}, {"data": {"temperature": 22}}]'),
            ("multispeq", '[{"set": [{"temperature": 19.25}, {"temperature": 19.5}]}]'),
            ("both", '[{"data": {"temperature": 20}, "set": [{"temperature": 20.5}]}]'),
            ("not_numbers", '[{"data": {"temperature": "n/a"}}, {"set": [{"humidity": 61}]}]'),
            ("not_json", "not json"),
            ("missing", None),
        ],
        "id string, sample string",
    )

    readings = source.withColumn("temperature", sensor_readings("sample", "temperature"))
    rows = {row.id: row.temperature for row in readings.collect()}

    assert rows == {
        "ambit": [21.5, 22.0],
        "multispeq": [19.25, 19.5],
        "both": [20.0, 20.5],
        "not_numbers": [],
        "not_json": None,
        "missing": None,
    }
