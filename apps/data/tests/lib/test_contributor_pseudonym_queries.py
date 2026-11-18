"""Run the platform's generated contributor-pseudonym SQL against the pair the anonymizer pins."""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from pyspark.sql import SparkSession

pytestmark = pytest.mark.spark
_QUERIES = json.loads((Path(__file__).parents[1] / "fixtures/contributor-pseudonym-queries.json").read_text())
_USER_ID = "0b5c5c9e-5f7a-4d0e-9a51-6b0e3c3a1f01"
_PSEUDONYM = "Contributor-AC2F1B"


@pytest.fixture(scope="module")
def contributors(spark: SparkSession) -> Iterator[None]:
    spark.createDataFrame(
        [(1, (_USER_ID, "Ada", None)), (2, ("someone-else", "Ben", None)), (3, None)],
        "row INT, contributor STRUCT<id: STRING, name: STRING, avatar: STRING>",
    ).createOrReplaceTempView("pseudonym_contributors")
    yield
    spark.catalog.dropTempView("pseudonym_contributors")


def test_the_warehouse_gives_the_pinned_pair_the_anonymizers_pseudonym(
    spark: SparkSession, contributors: None
) -> None:
    [pinned, *_] = [row.pseudonym for row in spark.sql(_QUERIES["pseudonyms"]).collect()]

    assert pinned == _PSEUDONYM


def test_a_filter_on_a_pseudonym_finds_the_contributor_behind_it(
    spark: SparkSession, contributors: None
) -> None:
    assert [row.row for row in spark.sql(_QUERIES["filtered"]).collect()] == [1]
