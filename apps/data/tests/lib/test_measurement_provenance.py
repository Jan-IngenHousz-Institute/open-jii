"""Execute production pipeline transforms with local frames at the stream boundary."""

import importlib.util
import json
import sys
import types
from pathlib import Path

import pytest
from openjii.centrum import large_iot_schema, sensor_schema
from openjii.centrum.measurement_provenance import parse_large_iot_key
from pyspark.sql import functions as F

pytestmark = pytest.mark.spark
ROOT = Path(__file__).parents[2] / "src/pipelines/centrum"
EXPERIMENT = "abcdef01-1111-4111-8111-111111111111"
UPLOAD = "abcdef02-2222-4222-8222-222222222222"
UPLOADER = "abcdef03-3333-4333-8333-333333333333"
FORGED_USER = "abcdef04-4444-4444-8444-444444444444"


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
            f"large-iot/{EXPERIMENT}/guest/{UPLOADER}/{UPLOAD}.json",
        ),
        (json.dumps(payload("guest-real")), f"large-iot/{EXPERIMENT}/guest/{UPLOADER}/{UPLOAD}.json"),
        (json.dumps(payload("real", is_guest=True)), f"large-iot/{EXPERIMENT}/{UPLOADER}/{UPLOAD}.json"),
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
        .select("position", parse_large_iot_key(F.col("path"))["is_guest"].alias("is_guest"))
        .orderBy("position")
        .collect()
    )
    assert [row.is_guest for row in result] == [True, True] + [False] * (len(paths) - 2)


def test_upload_key_parser_accepts_current_and_legacy_keys(spark):
    cases = []
    for prefix in ("", "s3://bucket/", "s3a://bucket/"):
        for guest in (False, True):
            for uploader in (None, UPLOADER):
                for uppercase in (False, True):
                    experiment = EXPERIMENT.upper() if uppercase else EXPERIMENT
                    user = UPLOADER.upper() if uppercase else UPLOADER
                    upload = UPLOAD.upper() if uppercase else UPLOAD
                    path = f"{prefix}large-iot/{experiment}/"
                    path += "guest/" if guest else ""
                    path += f"{user}/" if uploader else ""
                    path += f"{upload}.json"
                    cases.append((path, EXPERIMENT, uploader, guest))
    cases.extend(
        (path, None, None, False)
        for path in (
            None,
            "",
            f"large-iot/{EXPERIMENT}/file.json",
            f"prefix/large-iot/{EXPERIMENT}/{UPLOADER}/{UPLOAD}.json",
            f"large-iot/{EXPERIMENT}/guest/not-a-user/{UPLOAD}.json",
            f"large-iot/{EXPERIMENT}/{UPLOADER}/{UPLOAD}.json/extra",
        )
    )
    source = spark.createDataFrame(
        [(i, case[0]) for i, case in enumerate(cases)], "position int, path string"
    )
    result = (
        source.select("position", parse_large_iot_key(F.col("path")).alias("key"))
        .orderBy("position")
        .collect()
    )
    assert [(row.key.experiment_id, row.key.uploader_id, row.key.is_guest) for row in result] == [
        case[1:] for case in cases
    ]


def test_large_upload_authors_follow_the_signed_key_through_gold(pipelines, spark, fake_dlt, monkeypatch):
    annotations = [
        {
            "id": UPLOAD,
            "type": "comment",
            "content": {"text": "Field note"},
            "createdBy": FORGED_USER,
            "createdByName": "Forged researcher",
            "createdAt": "2026-01-01T10:00:00Z",
        },
        {"type": "flag", "content": {"flagType": "interesting"}},
    ]
    cases = [
        ("researcher", f"{UPLOADER}/{UPLOAD}", UPLOADER, False),
        ("guest", f"guest/{UPLOADER}/{UPLOAD}", UPLOADER, True),
        ("uppercase-researcher", f"{UPLOADER.upper()}/{UPLOAD.upper()}", UPLOADER, False),
        ("uppercase-guest", f"guest/{UPLOADER.upper()}/{UPLOAD.upper()}", UPLOADER, True),
        ("legacy-researcher", UPLOAD, FORGED_USER, False),
        ("legacy-guest", f"guest/{UPLOAD}", None, True),
    ]
    rows = [
        (
            json.dumps(
                payload(
                    device,
                    user_id=FORGED_USER,
                    experiment_id=FORGED_USER,
                    annotations=annotations,
                )
            ),
            f"s3://bucket/large-iot/{EXPERIMENT.upper()}/{suffix}.json",
        )
        for device, suffix, _, _ in cases
    ]
    for device, value in (("empty-annotations", []), ("null-annotations", None)):
        rows.append(
            (
                json.dumps(payload(device, user_id=FORGED_USER, annotations=value)),
                f"large-iot/{EXPERIMENT}/guest/{UPLOADER}/{UPLOAD}.json",
            )
        )
    source = (
        spark.createDataFrame(rows, "body string, path string")
        .select(
            F.from_json("body", large_iot_schema).alias("parsed"),
            F.struct(F.col("path").alias("file_path")).alias("_metadata"),
        )
        .select("parsed.*", "_metadata")
    )
    created_at = source.select("annotations").first().annotations[0].createdAt
    bronze = pipelines("bronze/raw_large_data").extract_large_data(source)
    bronze_rows = {row.device_id: row for row in bronze.collect()}
    assert bronze_rows["empty-annotations"].annotations == []
    assert bronze_rows["null-annotations"].annotations is None
    sources = {"raw_large_data": bronze}
    monkeypatch.setattr(fake_dlt, "read_stream", sources.__getitem__)
    sources["clean_data"] = pipelines("silver/clean_data").clean_data_large_iot()
    gold = pipelines("gold/experiment_raw_data").experiment_raw_data()
    gold_rows = {row.device_id: row for row in gold.collect()}
    for result in (bronze_rows, gold_rows):
        for device, _, expected_user, guest in cases:
            row = result[device]
            assert (row.experiment_id, row.user_id, row.is_guest) == (EXPERIMENT, expected_user, guest)
            assert len(row.annotations) == 2
            assert row.annotations[0].id == UPLOAD
            assert row.annotations[0].content.text == "Field note"
            assert row.annotations[0].createdAt == created_at
            assert row.annotations[1].content.flagType == "interesting"
            expected_authors = (
                [(FORGED_USER, "Forged researcher"), (None, None)]
                if device.startswith("legacy-")
                else [(UPLOADER, None), (UPLOADER, None)]
            )
            assert [(a.createdBy, a.createdByName) for a in row.annotations] == expected_authors
