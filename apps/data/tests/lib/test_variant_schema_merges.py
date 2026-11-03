"""The cases the backend's merge of payload schemas is tested against, checked against Spark, so
both sides read one set.

The serving store keeps each feed batch's payload schema, and the backend merges a table's schemas
into the one gold's listing has. Each case holds batches of payloads, the schema of each batch and
the schema of all its rows at once, as gold works them out. To add a case, add its batches to the
file and run this test with ``SCHEMA_MERGES_WRITE=1``, which writes Spark's answers into it.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from openjii.variant_schema import merged_variant_schema
from pyspark.sql import SparkSession

pytestmark = pytest.mark.spark

_CASES = Path(__file__).parents[1] / "fixtures/variant_schema_merges.json"


def _spark_schemas(spark: SparkSession, cases: list[dict]) -> tuple[dict, dict]:
    """Each batch's schema, keyed by case and batch, and each case's schema over all its rows."""
    rows = [
        (case_index, batch_index, payload)
        for case_index, case in enumerate(cases)
        for batch_index, batch in enumerate(case["batches"])
        for payload in batch
    ]
    payloads = spark.createDataFrame(rows, "case int, batch int, payload string").selectExpr(
        "case", "batch", "parse_json(payload) AS v"
    )
    batches = {
        (row["case"], row["batch"]): row["s"]
        for row in payloads.groupBy("case", "batch").agg(merged_variant_schema("v").alias("s")).collect()
    }
    merged = {
        row["case"]: row["s"]
        for row in payloads.groupBy("case").agg(merged_variant_schema("v").alias("s")).collect()
    }
    return batches, merged


def test_spark_works_out_every_case_as_the_file_records_it(spark: SparkSession) -> None:
    cases = json.loads(_CASES.read_text())
    batches, merged = _spark_schemas(spark, cases)
    worked_out = [
        {
            **case,
            "batch_schemas": [batches[(index, batch)] for batch in range(len(case["batches"]))],
            "merged": merged[index],
        }
        for index, case in enumerate(cases)
    ]

    if os.environ.get("SCHEMA_MERGES_WRITE") == "1":
        _CASES.write_text(json.dumps(worked_out, indent=2, ensure_ascii=False) + "\n")

    assert worked_out == cases
