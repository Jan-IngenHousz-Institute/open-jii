"""Gold names an experiment's contributors and devices from the copies the backend keeps
in the lakehouse, with the rows and shapes the backend's lookups gave for the same data."""

from __future__ import annotations

import importlib.util
import sys
import types
from collections.abc import Iterator
from pathlib import Path

import pytest
from pyspark.sql import DataFrame, SparkSession

pytestmark = pytest.mark.spark

_GOLD = Path(__file__).parents[2] / "src/pipelines/centrum/gold"
_CATALOG = "spark_catalog"
_SCHEMA = f"{_CATALOG}.centrum"

_ADA = "11111111-1111-1111-1111-111111111111"
_MASKED = "22222222-2222-2222-2222-222222222222"
_NO_PROFILE = "33333333-3333-3333-3333-333333333333"
_MULTISPEQ = "d0000000-0000-0000-0000-000000000001"
_AMBYTE = "d0000000-0000-0000-0000-000000000002"

_COPIES = {
    "contributor_profiles": f"""
        SELECT * FROM VALUES
          ('{_ADA}', 'Ada', 'Lovelace', 'ada.png'),
          ('{_MASKED}', 'Unknown', 'User', CAST(NULL AS STRING))
        AS t(user_id, first_name, last_name, avatar_url)
    """,
    "device_registry": f"""
        SELECT * FROM VALUES
          ('{_MULTISPEQ}', 'multispeq_SN1', 'SN1', '{_ADA}', 'active', 'multispeq'),
          ('{_AMBYTE}', 'ambyte_SN2', 'SN2', '{_MASKED}', 'retired', 'ambyte')
        AS t(id, thing_name, serial_number, created_by, status, device_type)
    """,
}

_CONTRIBUTOR_PAIRS = [("e1", _ADA), ("e1", _MASKED), ("e2", _ADA), ("e2", _NO_PROFILE), ("e2", "not-a-uuid")]
_DEVICE_PAIRS = [
    ("e1", "multispeq_SN1"),
    ("e1", "ambyte_SN2"),
    ("e2", "multispeq_SN1"),
    ("e2", "us-east-1:cognito-identity"),
]


@pytest.fixture(scope="module")
def centrum(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_SCHEMA} LOCATION '{tmp_path_factory.mktemp('centrum')}'")
    for name, query in _COPIES.items():
        spark.sql(f"CREATE TABLE {_SCHEMA}.{name} USING parquet AS {query}")

    yield _SCHEMA

    spark.sql(f"DROP DATABASE {_SCHEMA} CASCADE")


@pytest.fixture
def gold(spark: SparkSession, fake_dlt: types.ModuleType, monkeypatch: pytest.MonkeyPatch, centrum: str):
    runtime = types.ModuleType("openjii.centrum.runtime")
    runtime.CATALOG_NAME = _CATALOG  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.centrum.runtime", runtime)
    bridges = {
        "bridge_experiment_contributor": spark.createDataFrame(
            _CONTRIBUTOR_PAIRS, "experiment_id STRING, user_id STRING"
        ),
        "bridge_experiment_device": spark.createDataFrame(
            _DEVICE_PAIRS, "experiment_id STRING, client_id STRING"
        ),
    }
    monkeypatch.setattr(fake_dlt, "read", lambda name: bridges[name])

    def run(notebook: str) -> DataFrame:
        spec = importlib.util.spec_from_file_location(f"gold_{notebook}", _GOLD / f"{notebook}.py")
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.spark = spark  # type: ignore[attr-defined]
        return getattr(module, notebook)()

    return run


def _rows(table: DataFrame, key: str) -> list[dict]:
    rows = [row.asDict(recursive=True) for row in table.collect()]
    return sorted(rows, key=lambda row: (row["experiment_id"], row[key]))


def test_contributors_keep_their_columns(gold) -> None:
    assert (
        gold("experiment_contributors").schema.simpleString()
        == "struct<experiment_id:string,user_id:string,user:struct<id:string,name:string,avatar:string>>"
    )


def test_each_contributor_pair_gets_the_name_pages_show(gold) -> None:
    assert _rows(gold("experiment_contributors"), "user_id") == [
        {
            "experiment_id": "e1",
            "user_id": _ADA,
            "user": {"id": _ADA, "name": "Ada Lovelace", "avatar": "ada.png"},
        },
        {
            "experiment_id": "e1",
            "user_id": _MASKED,
            "user": {"id": _MASKED, "name": "Unknown User", "avatar": None},
        },
        {
            "experiment_id": "e2",
            "user_id": _ADA,
            "user": {"id": _ADA, "name": "Ada Lovelace", "avatar": "ada.png"},
        },
        {
            "experiment_id": "e2",
            "user_id": _NO_PROFILE,
            "user": {"id": _NO_PROFILE, "name": "", "avatar": None},
        },
        {
            "experiment_id": "e2",
            "user_id": "not-a-uuid",
            "user": {"id": "not-a-uuid", "name": "", "avatar": None},
        },
    ]


def test_devices_keep_their_columns(gold) -> None:
    assert gold("experiment_devices").schema.simpleString() == (
        "struct<experiment_id:string,client_id:string,"
        "device:struct<id:string,serial_number:string,owner:string,status:string,device_type:string>>"
    )


def test_each_device_pair_gets_its_registry_row_and_a_phone_gets_empty_fields(gold) -> None:
    multispeq = {
        "id": _MULTISPEQ,
        "serial_number": "SN1",
        "owner": _ADA,
        "status": "active",
        "device_type": "multispeq",
    }
    ambyte = {
        "id": _AMBYTE,
        "serial_number": "SN2",
        "owner": _MASKED,
        "status": "retired",
        "device_type": "ambyte",
    }

    assert _rows(gold("experiment_devices"), "client_id") == [
        {"experiment_id": "e1", "client_id": "ambyte_SN2", "device": ambyte},
        {"experiment_id": "e1", "client_id": "multispeq_SN1", "device": multispeq},
        {"experiment_id": "e2", "client_id": "multispeq_SN1", "device": multispeq},
        {
            "experiment_id": "e2",
            "client_id": "us-east-1:cognito-identity",
            "device": dict.fromkeys(multispeq),
        },
    ]
