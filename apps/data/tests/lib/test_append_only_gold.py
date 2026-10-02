"""The bridges and the device keys are distinct lists that only grow: one row per
pair or key, rows without an experiment left out."""

from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path

import pytest
from pyspark.sql import SparkSession

pytestmark = pytest.mark.spark

_GOLD = Path(__file__).parents[2] / "src/pipelines/centrum/gold"

_SOURCES = {
    "clean_data": """
        SELECT * FROM VALUES
          ('e1', 'c1', 'u1', 'd1', 'fw1'),
          ('e1', 'c1', 'u1', 'd1', 'fw1'),
          ('e1', 'c2', CAST(NULL AS STRING), 'd2', CAST(NULL AS STRING)),
          ('e1', 'c2', 'u2', 'd2', CAST(NULL AS STRING)),
          ('e2', CAST(NULL AS STRING), 'u1', 'd1', 'fw2'),
          (CAST(NULL AS STRING), 'c3', 'u3', 'd3', 'fw1')
        AS t(experiment_id, client_id, user_id, device_id, device_firmware)
    """,
    "experiment_uploaded_data": """
        SELECT * FROM VALUES
          ('e1', 'u1'), ('e1', 'u9'), ('e1', 'u9'), ('e3', CAST(NULL AS STRING))
        AS t(experiment_id, created_by)
    """,
}


@pytest.fixture
def gold(spark: SparkSession, fake_dlt: types.ModuleType, monkeypatch: pytest.MonkeyPatch):
    runtime = types.ModuleType("openjii.centrum.runtime")
    runtime.SILVER_TABLE = "clean_data"  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.centrum.runtime", runtime)
    # A streaming read of a table gives the same rows as a batch read of it.
    monkeypatch.setattr(fake_dlt, "read_stream", lambda name: spark.sql(_SOURCES[name]))

    def run(notebook: str) -> set[tuple]:
        spec = importlib.util.spec_from_file_location(f"gold_{notebook}", _GOLD / f"{notebook}.py")
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return {tuple(row) for row in getattr(module, notebook)().collect()}

    return run


def test_the_device_bridge_holds_each_experiment_and_client_pair_once(gold) -> None:
    assert gold("bridge_experiment_device") == {("e1", "c1"), ("e1", "c2")}


def test_the_contributor_bridge_holds_measuring_and_uploading_users_once(gold) -> None:
    assert gold("bridge_experiment_contributor") == {("e1", "u1"), ("e1", "u2"), ("e2", "u1"), ("e1", "u9")}


def test_the_device_keys_hold_each_device_and_firmware_once_per_experiment(gold) -> None:
    assert gold("experiment_device_keys") == {("e1", "d1", "fw1"), ("e1", "d2", None), ("e2", "d1", "fw2")}
