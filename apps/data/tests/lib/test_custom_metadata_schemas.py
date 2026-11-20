"""The cases the custom metadata schema is tested against, worked out by gold's own table metadata
notebook. Each case is one sheet's rows as JSON text, without the _id and identifier this test adds:
``schema`` is gold's for the sheet, which the store feed must send for it too, and ``rowSchemas``
gold's for each row as a sheet of its own, which the backend's merge must join into ``schema``. To
add one, add its rows to the file and run this test with ``CUSTOM_METADATA_SCHEMAS_WRITE=1``, which
writes gold's answers into it.
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import types
from collections.abc import Iterator
from pathlib import Path

import pytest
from openjii.serving_store.tables import METADATA_ROWS
from pyspark.sql import SparkSession

pytestmark = pytest.mark.spark

_CASES = Path(__file__).parents[1] / "fixtures/custom_metadata_schemas.json"
_NOTEBOOK = Path(__file__).parents[2] / "src/pipelines/centrum/gold/experiment_table_metadata.py"
_CATALOG = "spark_catalog"
_SCHEMA = f"{_CATALOG}.centrum"

# Every table the notebook reads; only the sheets and one raw data sample per case hold rows.
_EMPTY_TABLES = {
    "experiment_device_keys": "experiment_id string",
    "experiment_uploaded_data_schemas": "experiment_id string, upload_table_id string, sample string",
    "experiment_macro_data_schemas": "experiment_id string, macro_id string, column_name string, sample string",
}


def _with_ids(row: str, position: int) -> str:
    """The row as a sheet holds it, with the _id and identifier gold leaves out."""
    assert isinstance(json.loads(row), dict), f"{row} is no JSON object"
    rest = row.strip()[1:].strip()
    ids = f'"_id": "r{position}", "plot": "P{position}"'
    return "{" + ids + ("}" if rest == "}" else ", " + rest)


def _sheet(rows: list[str]) -> str:
    """The sheet's document as text, so each number reaches Spark as the case writes it."""
    with_ids = [_with_ids(row, position) for position, row in enumerate(rows)]
    return '{"identifierColumnId": "plot", "rows": [' + ", ".join(with_ids) + "]}"


@pytest.fixture
def centrum(spark: SparkSession, tmp_path: Path) -> Iterator[str]:
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_SCHEMA} LOCATION '{tmp_path}'")
    yield _SCHEMA
    spark.sql(f"DROP DATABASE {_SCHEMA} CASCADE")


def _sheets(cases: list[dict]) -> list[tuple[str, str]]:
    """Each case's rows in one sheet, and each of its rows in a sheet of its own, by experiment."""
    whole = [(f"case-{index}", _sheet(case["rows"])) for index, case in enumerate(cases)]
    rows = [
        (f"case-{index}-row-{position}", _sheet([row]))
        for index, case in enumerate(cases)
        for position, row in enumerate(case["rows"])
    ]
    return whole + rows


def _gold_schemas(spark: SparkSession, centrum: str, cases: list[dict]) -> dict[str, str | None]:
    sheets = _sheets(cases)
    experiments = [experiment for experiment, _ in sheets]
    spark.createDataFrame(sheets, "experiment_id string, doc string").selectExpr(
        "experiment_id", "parse_json(doc) AS metadata"
    ).write.saveAsTable(f"{centrum}.experiment_metadata_source")
    spark.createDataFrame([(experiment,) for experiment in experiments], "experiment_id string").selectExpr(
        "experiment_id", "parse_json('{}') AS sample"
    ).write.saveAsTable(f"{centrum}.experiment_raw_data_schemas")
    for name, columns in _EMPTY_TABLES.items():
        empty = spark.createDataFrame([], columns)
        typed = ["parse_json(sample) AS sample" if column == "sample" else column for column in empty.columns]
        empty.selectExpr(*typed).write.saveAsTable(f"{centrum}.{name}")

    spec = importlib.util.spec_from_file_location("custom_metadata_gold", _NOTEBOOK)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.spark = spark  # type: ignore[attr-defined]
    metadata = module.experiment_table_metadata().where("identifier = 'raw_data'")
    return {row["experiment_id"]: row["custom_metadata_schema"] for row in metadata.collect()}


def test_gold_works_out_every_case_as_the_file_records_it(
    spark: SparkSession,
    fake_dlt: types.ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    centrum: str,
) -> None:
    runtime = types.ModuleType("openjii.centrum.runtime")
    runtime.CATALOG_NAME = _CATALOG  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "openjii.centrum.runtime", runtime)
    monkeypatch.setattr(fake_dlt, "read", lambda name: spark.table(f"{centrum}.{name}"))

    cases = json.loads(_CASES.read_text())
    schemas = _gold_schemas(spark, centrum, cases)
    worked_out = [
        {
            **case,
            "schema": schemas[f"case-{index}"],
            "rowSchemas": [
                schemas.get(f"case-{index}-row-{position}") for position in range(len(case["rows"]))
            ],
        }
        for index, case in enumerate(cases)
    ]

    if os.environ.get("CUSTOM_METADATA_SCHEMAS_WRITE") == "1":
        _CASES.write_text(json.dumps(worked_out, indent=2, ensure_ascii=False) + "\n")

    assert worked_out == cases


def test_the_store_feed_sends_each_case_with_the_schema_gold_gives_it(spark: SparkSession) -> None:
    cases = json.loads(_CASES.read_text())
    changes = spark.createDataFrame(
        [(f"s{index}", _sheet(case["rows"])) for index, case in enumerate(cases)],
        "metadata_id string, doc string",
    ).selectExpr(
        "'e1' AS experiment_id",
        "metadata_id",
        "parse_json(doc) AS metadata",
        "TIMESTAMP'2026-09-01 08:00:00' AS created_at",
        "'insert' AS _change_type",
        "1L AS _commit_version",
    )

    lines = [json.loads(row.line) for row in METADATA_ROWS.schema_lines(changes).collect()]

    sent = {line["sheet_id"]: line.get("schema") for line in lines}
    assert sent == {f"s{index}": case["schema"] for index, case in enumerate(cases)}
