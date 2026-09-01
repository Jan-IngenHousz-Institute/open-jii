from __future__ import annotations

import re

import pytest
from pyspark.sql import functions as F


def test_live_schema_and_double_leaves_preserve_later_scientific_values(spark):
    early = spark.createDataFrame(
        [('{"cycle_offset":1,"genotype":"Col-0","par":1.2,"quantum_yield":0.1,"raw_trace":[0]}',)],
        "payload string",
    ).select(F.expr("parse_json(payload)").alias("uploaded_data"))
    later = spark.createDataFrame(
        [
            (
                '{"cycle_offset":1.25,"genotype":"Ler-0","par":1475.9,"quantum_yield":0.00123456,'
                '"raw_trace":[1.4],"treatment":"heat"}',
            )
        ],
        "payload string",
    ).select(F.expr("parse_json(payload)").alias("uploaded_data"))

    stale_schema = (
        early.agg(F.expr("schema_of_variant_agg(uploaded_data)").alias("upload_schema")).first().upload_schema
    )
    stale_from_json = stale_schema.replace("OBJECT<", "STRUCT<")
    stale_row = (
        later.select(F.from_json(F.col("uploaded_data").cast("string"), stale_from_json).alias("parsed"))
        .first()
        .parsed
    )

    assert "treatment" not in stale_schema
    assert stale_row.genotype == "Ler-0"
    assert stale_row.cycle_offset is None
    assert stale_row.par is None
    assert float(stale_row.quantum_yield) == 0.0
    assert stale_row.raw_trace is None

    widened_stale_schema = re.sub(
        r"DECIMAL\(\d+,\d+\)|\b(?:TINYINT|SMALLINT|INT|BIGINT|FLOAT)\b",
        "DOUBLE",
        stale_from_json,
    )
    widened_stale_row = (
        later.select(F.from_json(F.col("uploaded_data").cast("string"), widened_stale_schema).alias("parsed"))
        .first()
        .parsed
    )

    assert widened_stale_row.cycle_offset == pytest.approx(1.25)
    assert widened_stale_row.par == pytest.approx(1475.9)
    assert widened_stale_row.quantum_yield == pytest.approx(0.00123456)
    assert widened_stale_row.raw_trace == pytest.approx([1.4])

    complete = early.unionByName(later)
    live_schema = (
        complete.agg(F.expr("schema_of_variant_agg(uploaded_data)").alias("upload_schema"))
        .first()
        .upload_schema
    )
    live_from_json = re.sub(
        r"DECIMAL\(\d+,\d+\)|\b(?:TINYINT|SMALLINT|INT|BIGINT|FLOAT)\b",
        "DOUBLE",
        live_schema.replace("OBJECT<", "STRUCT<"),
    )
    live_row = (
        later.select(F.from_json(F.col("uploaded_data").cast("string"), live_from_json).alias("parsed"))
        .first()
        .parsed
    )

    assert live_row.cycle_offset == pytest.approx(1.25)
    assert live_row.treatment == "heat"
    assert live_row.par == pytest.approx(1475.9)
    assert live_row.quantum_yield == pytest.approx(0.00123456)
    assert live_row.raw_trace == pytest.approx([1.4])
