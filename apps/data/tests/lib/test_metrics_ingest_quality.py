"""The ingest quality snapshot: each reason a row is dropped or kept damaged is
counted once, and device status messages are counted apart from bad rows."""

from __future__ import annotations

import importlib.util
import sys
import types
from collections.abc import Iterator
from pathlib import Path

import pytest
from pyspark.sql import SparkSession

pytestmark = pytest.mark.spark

_NOTEBOOK = Path(__file__).parents[2] / "src/pipelines/metrics/ops_ingest_quality.py"
_SCHEMA = "spark_catalog.metrics_ingest_quality"

_TOPIC = "experiment/data_ingest/v1/exp-1/multispeq/v1.0/dev-1/protocol-1"
_STATUS_TOPIC = "experiment/data_ingest/v1/exp-1/ambyte/v1/03:25:07:04/status"

_TABLES = {
    "raw_data": f"""
        SELECT
          IF(parsed, named_struct('topic', topic, 'timestamp', ts, 'device_id', device_id), NULL) AS parsed_data,
          experiment_id,
          current_timestamp() - age AS ingestion_timestamp
        FROM VALUES
          (true, '{_TOPIC}', current_timestamp(), 'dev-1', 'exp-1', INTERVAL 1 HOUR),
          (true, '{_STATUS_TOPIC}', NULL, '03:25:07:04', 'exp-1', INTERVAL 1 HOUR),
          (true, 'experiment/data_ingest/v1/exp-1', NULL, 'dev-2', 'exp-1', INTERVAL 1 HOUR),
          (true, '{_TOPIC}', current_timestamp(), NULL, 'exp-1', INTERVAL 1 HOUR),
          (false, NULL, NULL, NULL, '', INTERVAL 1 HOUR),
          (true, 'stray/topic', current_timestamp(), 'dev-1', '', INTERVAL 1 HOUR),
          (true, 'experiment/data_ingest/v1/exp-1', NULL, 'dev-2', 'exp-1', INTERVAL 2 DAYS)
        AS t(parsed, topic, ts, device_id, experiment_id, age)
    """,
    "clean_data": """
        SELECT
          sample,
          IF(has_macros, array(named_struct('id', 'm', 'name', 'm', 'filename', 'm')),
             CAST(array() AS ARRAY<STRUCT<id: STRING, name: STRING, filename: STRING>>)) AS macros,
          current_timestamp() - age AS processed_timestamp
        FROM VALUES
          ('[{"macros": ["m"]}]', true, INTERVAL 1 HOUR),
          ('{"co2": 412}', false, INTERVAL 1 HOUR),
          ('{"macros": ["m"], "co2": 412}', false, INTERVAL 1 HOUR),
          ('{"macros": ["m"]}', true, INTERVAL 1 HOUR),
          ('{"macros": ["m"]}', false, INTERVAL 2 DAYS)
        AS t(sample, has_macros, age)
    """,
}


@pytest.fixture
def tables(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[None]:
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_SCHEMA} LOCATION '{tmp_path_factory.mktemp('metrics')}'")
    for name, query in _TABLES.items():
        spark.sql(f"CREATE TABLE {_SCHEMA}.{name} USING parquet AS {query}")

    yield

    spark.sql(f"DROP DATABASE {_SCHEMA} CASCADE")


def test_each_reason_is_counted_and_status_messages_are_not_bad_rows(
    spark: SparkSession,
    fake_dlt: types.ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    tables: None,
) -> None:
    runtime = types.ModuleType("openjii.metrics.runtime")
    runtime.BRONZE_TABLE = "raw_data"  # type: ignore[attr-defined]
    runtime.SILVER_TABLE = "clean_data"  # type: ignore[attr-defined]
    runtime.centrum_table = lambda name: f"{_SCHEMA}.{name}"  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.metrics.runtime", runtime)

    spec = importlib.util.spec_from_file_location("metrics_ops_ingest_quality", _NOTEBOOK)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    module.spark = spark  # type: ignore[attr-defined]
    spec.loader.exec_module(module)

    snapshot = module.ops_ingest_quality().drop("computed_at").first().asDict()

    assert snapshot == {
        "ingested_rows": 6,
        "unparseable_rows": 1,
        "unroutable_rows": 2,
        "missing_timestamp_rows": 1,
        "missing_device_id_rows": 1,
        "status_message_rows": 1,
        "unread_macro_rows": 1,
        "bad_rows": 5,
        "bad_rate": 5 / 6,
    }
