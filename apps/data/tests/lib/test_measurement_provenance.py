"""Execute production pipeline transforms with local frames at the stream boundary."""

import importlib.util
import json
import sys
import types
from pathlib import Path

import pytest
from openjii.centrum import large_iot_schema, sensor_schema
from openjii.centrum.measurement_provenance import is_guest_upload
from pyspark.sql import functions as F

pytestmark = pytest.mark.spark
ROOT = Path(__file__).parents[2] / "src/pipelines/centrum"
EXPERIMENT = "11111111-1111-4111-8111-111111111111"
UPLOAD = "22222222-2222-4222-8222-222222222222"


@pytest.fixture
def pipelines(fake_dlt, monkeypatch):
    runtime = types.ModuleType("openjii.centrum.runtime")
    for name, value in {
        "BRONZE_TABLE": "raw_data",
        "SILVER_TABLE": "clean_data",
        "LEGACY_MACRO_ID_MAP": {},
        "KINESIS_STREAM_NAME": "local",
        "SERVICE_CREDENTIAL_NAME": "local",
        "LARGE_IOT_S3_PATH": "local",
    }.items():
        setattr(runtime, name, value)
    monkeypatch.setitem(sys.modules, "openjii.centrum.runtime", runtime)

    def load(path):
        spec = importlib.util.spec_from_file_location(path.replace("/", "_"), ROOT / f"{path}.py")
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    return load


def payload(device_id, **extra):
    return {
        "device_id": device_id,
        "device_name": "Example sensor",
        "topic": f"experiment/data_ingest/v1/{EXPERIMENT}/mobile/1/phone",
        "timestamp": "2026-01-01T10:00:00Z",
        "sample": "[]",
        "macros": [],
        "questions": [],
        "annotations": [],
        "experiment_id": EXPERIMENT,
        "protocol_id": UPLOAD,
        **extra,
    }


def test_markers_survive_actual_bronze_silver_and_gold(pipelines, spark, fake_dlt, monkeypatch):
    records = [
        payload("legacy"),
        payload("real", simulated=False, is_guest=True),
        payload("flagged", simulated=True),
        payload("simulated:multispeq"),
        payload("string", simulated="true"),
        payload("numeric", simulated=1),
        payload("null", simulated=None),
    ]
    source = spark.createDataFrame([(json.dumps(row),) for row in records], "data string")
    source = (
        source.withColumn("sequenceNumber", F.lit("1"))
        .withColumn("shardId", F.lit("1"))
        .withColumn("approximateArrivalTimestamp", F.current_timestamp())
        .withColumn("partitionKey", F.lit("local"))
    )
    bronze = pipelines("bronze/raw_data").extract_raw_data(source)
    assert bronze.schema["parsed_data"].dataType.simpleString() == sensor_schema.simpleString()
    imported = spark.createDataFrame(
        [],
        """
        id string, device_id string, device_name string, device_version string,
        device_battery double, device_firmware string, sample string, output string,
        user_id string, experiment_id string, timestamp timestamp, macro_id string,
        macro_filename string, macro_name string, questions string, latitude double,
        longitude double
    """,
    )
    sources = {"raw_data": bronze, "raw_imported_data": imported}
    monkeypatch.setattr(fake_dlt, "read_stream", sources.__getitem__)
    silver = pipelines("silver/clean_data").clean_data()
    sources["clean_data"] = silver
    gold = pipelines("gold/experiment_raw_data").experiment_raw_data()
    assert {row.device_id: (row.is_simulated, row.is_guest) for row in gold.collect()} == {
        "legacy": (False, False),
        "real": (False, False),
        "flagged": (True, False),
        "simulated:multispeq": (True, False),
        "string": (False, False),
        "numeric": (False, False),
        "null": (False, False),
    }


def test_large_upload_markers_survive_silver_and_gold(pipelines, spark, fake_dlt, monkeypatch):
    rows = [
        (
            json.dumps(payload("guest-simulated", simulated=True)),
            f"large-iot/{EXPERIMENT}/guest/{UPLOAD}.json",
        ),
        (json.dumps(payload("guest-real")), f"large-iot/{EXPERIMENT}/guest/{UPLOAD}.json"),
        (json.dumps(payload("real", is_guest=True)), f"large-iot/{EXPERIMENT}/{UPLOAD}.json"),
        (json.dumps(payload("simulated:multispeq")), f"large-iot/{EXPERIMENT}/{UPLOAD}.json"),
    ]
    source = (
        spark.createDataFrame(rows, "body string, path string")
        .select(
            F.from_json("body", large_iot_schema).alias("parsed"),
            F.struct(F.concat(F.lit("s3://bucket/"), F.col("path")).alias("file_path")).alias("_metadata"),
        )
        .select("parsed.*", "_metadata")
    )
    bronze = pipelines("bronze/raw_large_data").extract_large_data(source)
    sources = {"raw_large_data": bronze}
    monkeypatch.setattr(fake_dlt, "read_stream", sources.__getitem__)
    sources["clean_data"] = pipelines("silver/clean_data").clean_data_large_iot()
    gold = pipelines("gold/experiment_raw_data").experiment_raw_data()
    assert {row.device_id: (row.is_simulated, row.is_guest) for row in gold.collect()} == {
        "guest-simulated": (True, True),
        "guest-real": (False, True),
        "real": (False, False),
        "simulated:multispeq": (True, False),
    }


def test_guest_key_requires_exact_server_shape(spark):
    valid = f"large-iot/{EXPERIMENT}/guest/{UPLOAD}.json"
    paths = [
        valid,
        "s3://bucket/" + valid,
        None,
        f"large-iot/{EXPERIMENT}/guest.json",
        f"large-iot/guest/{EXPERIMENT}/{UPLOAD}.json",
        valid + "/extra",
        "prefix/" + valid,
        valid.replace("/guest/", "/%67uest/"),
        valid.replace("/guest/", "/Guest/"),
        valid.replace("/guest/", "/GUEST/"),
        valid.replace(UPLOAD, "file"),
    ]
    result = (
        spark.createDataFrame(list(enumerate(paths)), "position int, path string")
        .select("position", is_guest_upload(F.col("path")).alias("is_guest"))
        .orderBy("position")
        .collect()
    )
    assert [row.is_guest for row in result] == [True, True] + [False] * (len(paths) - 2)
