"""Gold measurements carry the device and phone fields silver has. Rows from sources
without them, such as imports, read null."""

from __future__ import annotations

import importlib.util
import sys
import types
from datetime import datetime
from pathlib import Path

import pytest
from pyspark.sql import DataFrame, SparkSession

pytestmark = pytest.mark.spark

_NOTEBOOK = Path(__file__).parents[2] / "src/pipelines/centrum/gold/experiment_raw_data.py"

_DEVICE_FIELDS = (
    "device_family",
    "device_version",
    "device_firmware",
    "device_battery",
    "device_address",
    "client_model",
    "client_manufacturer",
    "client_os",
    "client_os_version",
    "client_app_version",
)

_SILVER_SCHEMA = """
    id BIGINT, experiment_id STRING, device_id STRING, client_id STRING, device_name STRING,
    device_family STRING, device_version STRING, device_firmware STRING, device_battery DOUBLE,
    device_address STRING, client_model STRING, client_manufacturer STRING, client_os STRING,
    client_os_version STRING, client_app_version STRING, timestamp TIMESTAMP, timezone STRING,
    macros ARRAY<STRUCT<id: STRING, name: STRING, filename: STRING>>,
    questions ARRAY<STRUCT<question_label: STRING, question_text: STRING, question_answer: STRING>>,
    annotations ARRAY<STRING>, user_id STRING, protocol_id STRING, workbook_run_id STRING,
    workbook_version_id STRING, macro_context STRING, latitude DOUBLE, longitude DOUBLE,
    sample STRING, output STRING, date DATE, processed_timestamp TIMESTAMP,
    arrival_timestamp TIMESTAMP, skip_macro_processing BOOLEAN
"""

_MEASURED = {
    "device_family": "multispeq",
    "device_version": "2",
    "device_firmware": "2.345",
    "device_battery": 87.5,
    "device_address": "AA:BB:CC:DD:EE:FF",
    "client_model": "Pixel 8",
    "client_manufacturer": "Google",
    "client_os": "android",
    "client_os_version": "15",
    "client_app_version": "1.42.0",
}


def _silver_row(row_id: int, **device_fields: object) -> dict:
    return {
        "id": row_id,
        "experiment_id": "e1",
        "device_id": "d1",
        "timestamp": datetime(2026, 10, 19, 10, 0),
        "sample": '{"phi2": 0.7}',
        "questions": [],
        "annotations": [],
        **dict.fromkeys(_DEVICE_FIELDS),
        **device_fields,
    }


@pytest.fixture
def gold(spark: SparkSession, fake_dlt: types.ModuleType, monkeypatch: pytest.MonkeyPatch) -> DataFrame:
    runtime = types.ModuleType("openjii.centrum.runtime")
    runtime.SILVER_TABLE = "clean_data"  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.centrum.runtime", runtime)
    silver = spark.createDataFrame([_silver_row(1, **_MEASURED), _silver_row(2)], _SILVER_SCHEMA)
    # A streaming read of a table gives the same rows as a batch read of it.
    monkeypatch.setattr(fake_dlt, "read_stream", lambda name: silver)

    spec = importlib.util.spec_from_file_location("gold_experiment_raw_data", _NOTEBOOK)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.experiment_raw_data()


def test_a_measurement_keeps_its_device_and_phone_fields(gold: DataFrame) -> None:
    rows = {row.id: row.asDict() for row in gold.select("id", *_DEVICE_FIELDS).collect()}

    assert rows[1] == {"id": 1, **_MEASURED}


def test_a_row_without_device_fields_reads_null(gold: DataFrame) -> None:
    rows = {row.id: row.asDict() for row in gold.select("id", *_DEVICE_FIELDS).collect()}

    assert rows[2] == {"id": 2, **dict.fromkeys(_DEVICE_FIELDS)}
