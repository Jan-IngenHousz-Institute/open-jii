"""A measurement keeps one row id however often its capture arrives, different captures get their own,
a row from before bronze kept `_client_id` keeps the id it had, and a macro result keeps one id however
often its macro runs."""

from __future__ import annotations

from datetime import datetime

import pytest
from openjii.centrum.row_ids import macro_result_id, measurement_id
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import LongType

pytestmark = pytest.mark.spark

_SCHEMA = """
    name STRING, experiment_id STRING, _client_id STRING, device_id STRING, timestamp TIMESTAMP,
    sample STRING, user_id STRING, earlier INT,
    questions ARRAY<STRUCT<question_label: STRING, question_text: STRING, question_answer: STRING>>
"""

_AT = datetime(2026, 10, 27, 9, 30)


def _row(name: str, **fields: object) -> dict:
    """A row bronze wrote since it kept `_client_id`, which is empty when the payload had none."""
    return {
        "name": name,
        "experiment_id": "e1",
        "_client_id": "",
        "device_id": "d1",
        "timestamp": _AT,
        "sample": '[{"phi2": 0.7}]',
        "user_id": "u1",
        "earlier": 7,
        "questions": [{"question_label": "plot", "question_text": None, "question_answer": "3"}],
        **fields,
    }


def _ids(spark: SparkSession, rows: list[dict]) -> dict[str, int]:
    keyed = spark.createDataFrame(rows, _SCHEMA).select("name", measurement_id(F.col("earlier")).alias("id"))
    return {row["name"]: row["id"] for row in keyed.collect()}


def test_a_record_the_phone_sends_again_keeps_its_id(spark: SparkSession) -> None:
    ids = _ids(
        spark,
        [
            _row("sent", _client_id="r1"),
            _row("sent again", _client_id="r1", sample='[{"phi2": 0.7}] '),
            _row("another record", _client_id="r2"),
            _row("same record in another experiment", _client_id="r1", experiment_id="e2"),
        ],
    )

    assert ids["sent"] == ids["sent again"]
    assert ids["another record"] != ids["sent"]
    assert ids["same record in another experiment"] != ids["sent"]


def test_a_capture_without_a_record_id_is_known_by_what_it_holds(spark: SparkSession) -> None:
    ids = _ids(
        spark,
        [
            _row("sent"),
            _row("sent again", earlier=8),
            _row("other sample", sample='[{"phi2": 0.6}]'),
            _row(
                "other answer",
                questions=[{"question_label": "plot", "question_text": None, "question_answer": "4"}],
            ),
            _row("other device", device_id="d2"),
            _row("other moment", timestamp=datetime(2026, 10, 27, 9, 31)),
        ],
    )

    assert ids["sent"] == ids["sent again"]
    others = [ids[name] for name in ("other sample", "other answer", "other device", "other moment")]
    assert len({ids["sent"], *others}) == 5


def test_a_row_from_before_bronze_kept_the_record_id_keeps_its_earlier_id(spark: SparkSession) -> None:
    ids = _ids(spark, [_row("older", _client_id=None, earlier=7), _row("newer", earlier=7)])

    assert ids["older"] == 7
    assert ids["newer"] != 7


def test_ids_are_whole_and_never_negative(spark: SparkSession) -> None:
    keyed = spark.createDataFrame(
        [_row("sent"), _row("recorded", _client_id="r1"), _row("older", _client_id=None)], _SCHEMA
    ).select(measurement_id(F.col("earlier")).alias("id"))

    assert keyed.schema["id"].dataType == LongType()
    assert all(row["id"] >= 0 for row in keyed.collect())


def test_an_experiment_of_two_hundred_thousand_records_has_no_shared_ids(spark: SparkSession) -> None:
    records: DataFrame = (
        spark.range(200_000)
        .select(
            F.lit("e1").alias("experiment_id"),
            F.concat(F.lit("record-"), F.col("id").cast("string")).alias("_client_id"),
            F.lit(None).cast("string").alias("device_id"),
            F.lit(_AT).alias("timestamp"),
            F.lit(None).cast("string").alias("sample"),
            F.lit(None).cast("string").alias("user_id"),
            F.lit(None)
            .cast("array<struct<question_label:string,question_text:string,question_answer:string>>")
            .alias("questions"),
        )
        .select(measurement_id(F.lit(0)).alias("id"))
    )

    assert records.distinct().count() == 200_000
    assert records.filter("id < 0").count() == 0


_MACRO_SCHEMA = (
    "name STRING, experiment_id STRING, id BIGINT, macro_filename STRING, processed_timestamp TIMESTAMP"
)


# A measurement id from the 63-bit formula, and one from before it, which fits 31 bits.
_MEASUREMENT = 5_381_207_993_110_446_011
_OLDER_MEASUREMENT = 41


def _macro_ids(spark: SparkSession, rows: list[tuple]) -> tuple[DataFrame, dict[str, int]]:
    keyed = spark.createDataFrame(rows, _MACRO_SCHEMA).select("name", macro_result_id().alias("result_id"))
    return keyed, {row["name"]: row["result_id"] for row in keyed.collect()}


def test_a_macro_result_keeps_its_id_each_time_that_macro_runs_on_its_measurement(
    spark: SparkSession,
) -> None:
    keyed, ids = _macro_ids(
        spark,
        [
            ("run", "e1", _MEASUREMENT, "phi2.py", _AT),
            ("run again later", "e1", _MEASUREMENT, "phi2.py", datetime(2026, 10, 28, 9, 30)),
            ("other macro", "e1", _MEASUREMENT, "npq.py", _AT),
            ("other measurement", "e1", _MEASUREMENT + 1, "phi2.py", _AT),
            ("other experiment", "e2", _MEASUREMENT, "phi2.py", _AT),
        ],
    )

    assert keyed.schema["result_id"].dataType == LongType()
    assert ids["run"] == ids["run again later"]
    assert len({ids["run"], ids["other macro"], ids["other measurement"], ids["other experiment"]}) == 4
    assert all(value >= 0 for value in ids.values())


def test_a_result_of_a_measurement_from_before_keeps_the_id_it_was_given(spark: SparkSession) -> None:
    _, ids = _macro_ids(spark, [("older", "e1", _OLDER_MEASUREMENT, "phi2.py", _AT)])
    earlier = (
        spark.createDataFrame(
            [(_OLDER_MEASUREMENT, "phi2.py", _AT)],
            "id BIGINT, macro_filename STRING, processed_timestamp TIMESTAMP",
        )
        .select(F.abs(F.hash("id", "macro_filename", "processed_timestamp")).alias("earlier"))
        .first()
    )

    assert earlier is not None
    assert ids["older"] == earlier["earlier"]
