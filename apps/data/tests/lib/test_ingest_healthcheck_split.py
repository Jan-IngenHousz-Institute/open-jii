"""The ingest health check's messages and the measurements share one Kinesis stream. Bronze keeps
each in its own table: raw_data never holds a health check, and ingest_healthchecks holds nothing else."""

from __future__ import annotations

import importlib.util
import json
import sys
import types
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from pyspark.sql import DataFrame, SparkSession

pytestmark = pytest.mark.spark

_BRONZE = Path(__file__).parents[2] / "src/pipelines/centrum/bronze"

_KINESIS_SCHEMA = """
    data BINARY, partitionKey STRING, sequenceNumber STRING, shardId STRING,
    approximateArrivalTimestamp TIMESTAMP
"""

_SENT_AT_MS = 1_793_700_000_000
_ARRIVED = datetime(2026, 11, 3, 10, 0, 1)

_HEALTHCHECK_TOPIC = "experiment/data_ingest/v1/healthcheck/healthcheck/1/dev"
_MEASUREMENT_TOPIC = "experiment/data_ingest/v1/0b2f6f0e-0000-4000-8000-000000000001/multispeq/1/dev-1"
_LOOKALIKE_TOPIC = "experiment/data_ingest/v1/healthcheck-2/multispeq/1/dev-1"


def _record(sequence: str, payload: str, partition_key: str | None = "key") -> dict:
    return {
        "data": bytearray(payload.encode()),
        "partitionKey": partition_key,
        "sequenceNumber": sequence,
        "shardId": "shardId-000000000000",
        "approximateArrivalTimestamp": _ARRIVED,
    }


_RECORDS = [
    _record(
        "healthcheck",
        json.dumps(
            {
                "topic": _HEALTHCHECK_TOPIC,
                "client_id": "n/a",
                "healthcheck": True,
                "sent_at": _SENT_AT_MS,
                "environment": "dev",
            }
        ),
    ),
    _record("unflagged", json.dumps({"topic": _HEALTHCHECK_TOPIC, "device_id": "dev-1"})),
    _record("flagged-false", json.dumps({"topic": _HEALTHCHECK_TOPIC, "healthcheck": False, "sent_at": 1})),
    _record("measurement", json.dumps({"topic": _MEASUREMENT_TOPIC, "device_id": "dev-1"})),
    _record("lookalike", json.dumps({"topic": _LOOKALIKE_TOPIC, "device_id": "dev-1"})),
    _record("no-topic", json.dumps({"device_id": "dev-1"})),
    _record("not-json", "not json"),
    _record("no-experiment", json.dumps({"device_id": "dev-1"}), partition_key=None),
]

_UNFLAGGED_ON_THE_HEALTHCHECK_TOPIC = 2


def _load(name: str, monkeypatch: pytest.MonkeyPatch, kinesis: DataFrame) -> types.ModuleType:
    runtime = types.ModuleType("openjii.centrum.runtime")
    runtime.BRONZE_TABLE = "raw_data"  # type: ignore[attr-defined]
    runtime.KINESIS_STREAM_NAME = "stream"  # type: ignore[attr-defined]
    runtime.SERVICE_CREDENTIAL_NAME = "credential"  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.centrum.runtime", runtime)

    spec = importlib.util.spec_from_file_location(f"bronze_{name}", _BRONZE / f"{name}.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    reader = MagicMock(name="kinesis_reader")
    for operation in ("format", "option"):
        getattr(reader, operation).return_value = reader
    reader.load.return_value = kinesis
    monkeypatch.setattr(module, "spark", MagicMock(readStream=reader), raising=False)

    return module


@pytest.fixture
def kinesis(spark: SparkSession, fake_dlt: types.ModuleType) -> DataFrame:
    return spark.createDataFrame(_RECORDS, _KINESIS_SCHEMA)


def test_raw_data_drops_only_the_health_check(kinesis: DataFrame, monkeypatch: pytest.MonkeyPatch) -> None:
    raw_data = _load("raw_data", monkeypatch, kinesis).raw_data()

    kept = {row.kinesis_sequence_number: row.experiment_id for row in raw_data.collect()}

    # A null id is kept too, and a different experiment that merely starts with the same word.
    # The experiment id is reserved, so unflagged messages on its topic are dropped here as well.
    assert kept == {
        "measurement": "0b2f6f0e-0000-4000-8000-000000000001",
        "lookalike": "healthcheck-2",
        "no-topic": "",
        "not-json": "",
        "no-experiment": None,
    }


def test_ingest_healthchecks_keeps_only_the_flagged_health_check(
    kinesis: DataFrame, monkeypatch: pytest.MonkeyPatch
) -> None:
    healthchecks = _load("ingest_healthchecks", monkeypatch, kinesis).ingest_healthchecks()

    rows = healthchecks.collect()

    assert healthchecks.columns == ["sent_at", "environment", "kinesis_arrival_time", "ingestion_timestamp"]
    assert len(rows) == 1
    assert rows[0].environment == "dev"
    assert rows[0].kinesis_arrival_time == _ARRIVED
    assert int(rows[0].sent_at.timestamp() * 1000) == _SENT_AT_MS
    assert rows[0].ingestion_timestamp is not None


def _reader_options(module: types.ModuleType) -> dict[str, str]:
    calls = module.spark.readStream.option.call_args_list
    return {call.args[0]: call.args[1] for call in calls}


def test_the_health_check_reader_polls_gently_from_the_tip_and_raw_data_reads_as_before(
    kinesis: DataFrame, monkeypatch: pytest.MonkeyPatch
) -> None:
    healthchecks = _load("ingest_healthchecks", monkeypatch, kinesis)
    healthchecks.ingest_healthchecks()
    raw_data = _load("raw_data", monkeypatch, kinesis)
    raw_data.raw_data()

    healthcheck_options = _reader_options(healthchecks)
    raw_data_options = _reader_options(raw_data)

    assert healthcheck_options["initialPosition"] == "latest"
    assert healthcheck_options["minFetchPeriod"] == "2s"
    assert raw_data_options["initialPosition"] == "TRIM_HORIZON"
    assert "minFetchPeriod" not in raw_data_options


def test_every_record_lands_in_one_table_unless_it_only_borrows_the_health_check_topic(
    kinesis: DataFrame, monkeypatch: pytest.MonkeyPatch
) -> None:
    raw_data = {
        row.kinesis_sequence_number for row in _load("raw_data", monkeypatch, kinesis).raw_data().collect()
    }
    healthchecks = _load("ingest_healthchecks", monkeypatch, kinesis).ingest_healthchecks().count()

    assert "healthcheck" not in raw_data
    assert len(raw_data) + healthchecks == len(_RECORDS) - _UNFLAGGED_ON_THE_HEALTHCHECK_TOPIC


_FORGED_SENT_AT = ["not a time", 1.5e30, 9_000_000_000_000_000_000, {"a": 1}]


def test_a_forged_send_time_reads_as_null_rather_than_failing_the_flow(
    spark: SparkSession, fake_dlt: types.ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    forged = [
        _record(
            f"forged-{index}",
            json.dumps({"topic": _HEALTHCHECK_TOPIC, "healthcheck": True, "sent_at": value}),
        )
        for index, value in enumerate(_FORGED_SENT_AT)
    ]
    kinesis = spark.createDataFrame([_RECORDS[0], *forged], _KINESIS_SCHEMA)

    rows = _load("ingest_healthchecks", monkeypatch, kinesis).ingest_healthchecks().collect()

    sent_at = sorted((row.sent_at for row in rows), key=lambda value: value is not None)
    assert sent_at[: len(_FORGED_SENT_AT)] == [None] * len(_FORGED_SENT_AT)
    assert sent_at[-1] is not None and int(sent_at[-1].timestamp() * 1000) == _SENT_AT_MS
