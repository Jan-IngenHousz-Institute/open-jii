"""Tests for how exports name the fields of flattened payloads."""

from __future__ import annotations

import pytest
from openjii.helpers import flatten_parsed_payloads, flattened_field_names


class TestFlattenedFieldNames:
    def test_keeps_a_free_name(self) -> None:
        names = flattened_field_names(["id"], [("m", ["phi2"], "output")])
        assert names == [("m", "phi2", "phi2")]

    def test_renames_a_field_a_kept_column_holds_ignoring_case(self) -> None:
        names = flattened_field_names(["id", "device"], [("m", ["Device", "ID"], "output")])
        assert names == [("m", "Device", "Device_output"), ("m", "ID", "ID_output")]

    def test_renames_a_field_an_earlier_payload_holds(self) -> None:
        names = flattened_field_names([], [("m", ["time"], "output"), ("q", ["time"], "answer")])
        assert names == [("m", "time", "time"), ("q", "time", "time_answer")]

    def test_never_takes_the_name_of_a_field_that_did_not_clash(self) -> None:
        names = flattened_field_names(["device"], [("m", ["device", "device_output"], "output")])
        assert names == [("m", "device", "device_output_2"), ("m", "device_output", "device_output")]


@pytest.mark.spark
class TestFlattenParsedPayloads:
    def test_exports_a_payload_field_named_like_a_view_column_beside_it(self, spark) -> None:
        from pyspark.sql.functions import col, from_json, to_json

        df = spark.createDataFrame(
            [("e-1", 1, ("28:37",), '{"device": "AmbitV003", "phi2": 0.5}')],
            "experiment_id string, id long, device struct<serial: string>, macro_output string",
        ).withColumn("parsed_macro_output", from_json(col("macro_output"), "device STRING, phi2 DOUBLE"))

        flat = flatten_parsed_payloads(
            df,
            [("parsed_macro_output", "output")],
            ["experiment_id", "macro_output", "parsed_macro_output"],
        )

        assert flat.columns == ["id", "device", "device_output", "phi2"]
        row = flat.select(to_json(col("device")).alias("device"), "device_output").first()
        assert row.device == '{"serial":"28:37"}'
        assert row.device_output == "AmbitV003"
