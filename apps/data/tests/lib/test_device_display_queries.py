"""Run the platform's generated device-display SQL without changing warehouse rows."""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

pytestmark = pytest.mark.spark
_QUERIES = json.loads((Path(__file__).parents[1] / "fixtures/device-display-queries.json").read_text())
_DEVICE_TYPE = "struct<id:string,serial_number:string,owner:string,status:string,device_type:string>"


@pytest.fixture(scope="module")
def display_measurements(spark: SparkSession) -> Iterator[None]:
    rows = [
        (1, "e1", "c1", "d1", "MultispeQ", "registered", " SN1 "),
        (2, "e1", "c9", "d2", "Ambit", None, None),
        (3, "e1", "c9", "d3", "Ambit", None, None),
        (4, "e1", "phone-1", "d4", " ", None, None),
        (5, "e1", None, "imported-1", None, None, None),
        (6, "e1", "phone-1", None, "Probe", None, None),
        (7, "e1", " ", " ", " ", None, None),
        (8, "e1", None, None, " Bench ", None, None),
        (9, "e1", "blank-phone", "blank", "Probe", "registered-blank", " "),
        (10, "e1", "phone-only", None, None, None, None),
        (11, "e1", "c1", "other-sensor", "MultispeQ", "registered", " SN1 "),
        (12, "e2", "c9", "d2", "Other experiment", None, None),
    ]
    frame = spark.createDataFrame(
        rows,
        "id INT, experiment_id STRING, client_id STRING, device_id STRING, device_name STRING, registry_id STRING, serial STRING",
    ).withColumn(
        "device",
        F.when(
            F.col("registry_id").isNotNull(),
            F.struct(
                F.col("registry_id").alias("id"),
                F.col("serial").alias("serial_number"),
                F.lit("org-1").alias("owner"),
                F.lit("onboarded").alias("status"),
                F.lit("multispeq").alias("device_type"),
            ),
        ),
    )
    frame.drop("registry_id", "serial").withColumn("signal", F.col("id").cast("double")).withColumn(
        "payload", F.parse_json(F.lit('{"device":"user-defined","client_id":"user-client"}'))
    ).createOrReplaceTempView("display_measurements")
    spark.table("display_measurements").drop("client_id").createOrReplaceTempView("legacy_measurements")
    yield
    spark.catalog.dropTempView("display_measurements")
    spark.catalog.dropTempView("legacy_measurements")


def test_platform_reads_keep_the_device_type_and_registry_fields(
    spark: SparkSession, display_measurements: None
) -> None:
    frame = spark.sql(_QUERIES["projected"])
    assert frame.schema["device"].dataType.simpleString() == _DEVICE_TYPE
    assert all(field.nullable for field in frame.schema["device"].dataType.fields)
    rows = {row.id: row.device for row in frame.collect()}
    assert [rows[i].serial_number for i in range(1, 12)] == [
        " SN1 ",
        "Ambit (d2)",
        "Ambit (d3)",
        "phone-1 (d4)",
        "imported-1",
        "Probe (phone-1)",
        None,
        "Bench",
        "Probe (blank)",
        "phone-only",
        " SN1 ",
    ]
    assert rows[1].id == "registered"
    assert rows[9].id == "registered-blank"
    assert rows[9].owner == "org-1"
    assert rows[9].status == "onboarded"
    assert rows[9].device_type == "multispeq"
    assert all(value is None for value in rows[7])
    assert rows[2].id is None


def test_plain_warehouse_reads_still_find_unregistered_devices_by_null(
    spark: SparkSession, display_measurements: None
) -> None:
    assert (
        spark.sql("SELECT id FROM display_measurements WHERE device IS NULL AND experiment_id = 'e1'").count()
        == 8
    )
    serial = spark.sql("SELECT device.serial_number FROM display_measurements WHERE id = 9").first()
    assert serial is not None
    assert serial[0] == " "


def test_filters_and_groups_use_the_same_labels_as_rows(
    spark: SparkSession, display_measurements: None
) -> None:
    selected = spark.sql(_QUERIES["filtered"]).collect()
    assert len(selected) == 1
    assert selected[0].id == 2
    groups = {row.device.serial_number: row.rows for row in spark.sql(_QUERIES["grouped"]).collect()}
    assert groups["Ambit (d2)"] == 1
    assert groups["Ambit (d3)"] == 1
    assert groups[" SN1 "] == 2
    assert sum(groups.values()) == 11


def test_distinct_options_and_sorting_resolve_against_the_display_struct(
    spark: SparkSession, display_measurements: None
) -> None:
    labels = [row.serial_number for row in spark.sql(_QUERIES["distinct"]).collect()]
    assert labels == [
        " SN1 ",
        "Ambit (d2)",
        "Ambit (d3)",
        "Bench",
        "imported-1",
        "phone-1 (d4)",
        "phone-only",
        "Probe (blank)",
        "Probe (phone-1)",
    ]
    sorted_labels = [row.device.serial_number for row in spark.sql(_QUERIES["sorted"]).collect()]
    assert sorted_labels[0] is None
    assert sorted_labels[1:3] == [" SN1 ", " SN1 "]


def test_star_and_variant_reads_keep_user_device_fields_separate(
    spark: SparkSession, display_measurements: None
) -> None:
    plain = spark.sql(_QUERIES["all"])
    assert plain.schema["device"].dataType.simpleString() == _DEVICE_TYPE
    assert plain.count() == 11
    variant = spark.sql(_QUERIES["variant"]).collect()
    assert all(row.device_output == "user-defined" for row in variant)
    assert {row.device.serial_number for row in variant} >= {"Ambit (d2)", "Ambit (d3)"}


def test_reads_before_the_view_update_do_not_reference_client_id(
    spark: SparkSession, display_measurements: None
) -> None:
    rows = {row.id: row.device.serial_number for row in spark.sql(_QUERIES["legacyView"]).collect()}
    assert rows[2] == "Ambit (d2)"
    assert rows[4] == "d4"
    assert rows[10] is None


def test_cached_columns_hide_new_client_ids_and_preserve_user_fields(
    spark: SparkSession, display_measurements: None
) -> None:
    stale = spark.sql(_QUERIES["staleColumns"])
    assert "client_id" not in stale.columns
    row = stale.where("id = 2").first()
    assert row is not None
    assert row.device.serial_number == "Ambit (d2)"
    hidden = spark.sql(_QUERIES["hiddenClient"])
    assert hidden.columns.count("client_id") == 1
    assert all(row.client_id == "user-client" for row in hidden.collect())
