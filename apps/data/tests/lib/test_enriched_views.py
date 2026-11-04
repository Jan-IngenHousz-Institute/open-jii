"""The enriched views join gold with the backend's tables when they are read.
These run each view's SQL over small tables and check what a reader gets back."""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import ArrayType

pytestmark = pytest.mark.spark

_VIEWS = Path(__file__).parents[2] / "src/views"
_CATALOG = "spark_catalog"

# What gold stores: a zone Spark accepts, or null for one it rejected.
_TIMEZONES = ("Europe/Amsterdam", None)

_ANNOTATION = (
    "STRUCT<id: STRING, rowId: STRING, type: STRING, content: STRUCT<text: STRING, flagType: STRING>, "
    "createdBy: STRING, createdByName: STRING, createdAt: TIMESTAMP, updatedAt: TIMESTAMP>"
)
_PAYLOAD_ANNOTATION = (
    "named_struct('id', 'payload-1', 'rowId', '1', 'type', 'comment', "
    "'content', named_struct('text', 'from the device', 'flagType', CAST(NULL AS STRING)), "
    "'createdBy', 'u1', 'createdByName', 'Ann', "
    "'createdAt', TIMESTAMP'2026-09-01 08:00:00', 'updatedAt', TIMESTAMP'2026-09-01 08:00:00')"
)

_TABLES = {
    "experiment_raw_data": f"""
        SELECT * FROM VALUES
          ('e1', 1L, 'd1', 'MultispeQ', TIMESTAMP'2026-09-01 08:00:00', 'Europe/Amsterdam', DATE'2026-09-01',
           array(named_struct('id', 'm1', 'name', 'Fluo', 'filename', 'fluo.py')),
           parse_json('{{"plot": "A1"}}'), array({_PAYLOAD_ANNOTATION}),
           'u1', 'c1', 'p1', 'w1', 52.0D, 5.1D, parse_json('[{{"x": 1}}]'), TIMESTAMP'2026-09-23 10:00:00'),
          ('e1', 2L, 'd2', 'Ambit', TIMESTAMP'2026-09-02 09:30:00', CAST(NULL AS STRING), DATE'2026-09-02',
           CAST(array() AS ARRAY<STRUCT<id: STRING, name: STRING, filename: STRING>>),
           parse_json('{{"plot": "B2"}}'), CAST(array() AS ARRAY<{_ANNOTATION}>),
           'u2', 'c9', 'p1', 'w1', 52.1D, 5.2D, parse_json('[{{"x": 2}}]'), TIMESTAMP'2026-09-23 10:01:00'),
          ('e2', 3L, 'd1', 'MultispeQ', TIMESTAMP'2026-09-03 10:00:00', CAST(NULL AS STRING), DATE'2026-09-03',
           CAST(NULL AS ARRAY<STRUCT<id: STRING, name: STRING, filename: STRING>>),
           CAST(NULL AS VARIANT), CAST(NULL AS ARRAY<{_ANNOTATION}>),
           'u1', 'c1', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS DOUBLE), CAST(NULL AS DOUBLE),
           parse_json('[]'), TIMESTAMP'2026-09-23 10:02:00')
        AS t(experiment_id, id, device_id, device_name, timestamp, timezone, date, macros, questions_data,
             annotations, user_id, client_id, protocol_id, workbook_run_id, latitude, longitude, data,
             processed_timestamp)
    """,
    "experiment_macro_data": f"""
        SELECT * FROM VALUES
          ('e1', 101, 1L, 'd1', 'c1', 'MultispeQ', TIMESTAMP'2026-09-01 08:00:00', 'Europe/Amsterdam', 'u1',
           52.0D, 5.1D, 'mac-1', 'Fluo', 'fluo.py', 'w1', 'v1', parse_json('{{"phi2": 0.7}}'),
           CAST(NULL AS STRING), TIMESTAMP'2026-09-23 10:05:00', DATE'2026-09-01',
           parse_json('{{"plot": "A1"}}'), array({_PAYLOAD_ANNOTATION})),
          ('e1', 102, 2L, 'd2', 'c9', 'Ambit', TIMESTAMP'2026-09-02 09:30:00', CAST(NULL AS STRING), 'u2',
           52.1D, 5.2D, 'mac-1', 'Fluo', 'fluo.py', 'w1', 'v1', CAST(NULL AS VARIANT),
           'Macro failed', TIMESTAMP'2026-09-23 10:06:00', DATE'2026-09-02',
           parse_json('{{"plot": "B2"}}'), CAST(NULL AS ARRAY<{_ANNOTATION}>))
        AS t(experiment_id, id, raw_id, device_id, client_id, device_name, timestamp, timezone, user_id,
             latitude, longitude, macro_id, macro_name, macro_filename, workbook_run_id, workbook_version_id,
             macro_output, macro_error, processed_timestamp, date, questions_data, annotations)
    """,
    "experiment_uploaded_data": """
        SELECT * FROM VALUES
          (1001L, 'e1', 't1', 'Soil samples', 'up-1', 'u1', TIMESTAMP'2026-09-04 12:00:00',
           parse_json('{"ph": 6.5}')),
          (1002L, 'e1', 't1', 'Soil samples', 'up-1', 'u3', TIMESTAMP'2026-09-04 12:00:00',
           parse_json('{"ph": 7.1}'))
        AS t(id, experiment_id, upload_table_id, upload_table_name, upload_id, created_by, uploaded_at,
             uploaded_data)
    """,
    "experiment_contributors": """
        SELECT * FROM VALUES
          ('e1', 'u1', named_struct('id', 'u1', 'name', 'Ann', 'avatar', CAST(NULL AS STRING))),
          ('e2', 'u1', named_struct('id', 'u1', 'name', 'Ann', 'avatar', 'ann.png'))
        AS t(experiment_id, user_id, user)
    """,
    "experiment_devices": """
        SELECT * FROM VALUES
          ('e1', 'c1', named_struct('id', 'dev-1', 'serial_number', 'SN1', 'owner', 'org-1',
                                    'status', 'onboarded', 'device_type', 'multispeq'))
        AS t(experiment_id, client_id, device)
    """,
    "experiment_annotations": """
        SELECT * FROM VALUES
          ('a2', 'e1', 'u2', 'Bob', 'raw', '1', 'flag', 'recheck', 'outlier',
           TIMESTAMP'2026-09-05 10:00:00', TIMESTAMP'2026-09-05 10:00:00'),
          ('a1', 'e1', 'u1', 'Ann', 'raw', '1', 'comment', 'looks off', CAST(NULL AS STRING),
           TIMESTAMP'2026-09-05 09:00:00', TIMESTAMP'2026-09-05 09:30:00'),
          ('a3', 'e2', 'u1', 'Ann', 'raw', '1', 'comment', 'same row id, other experiment', CAST(NULL AS STRING),
           TIMESTAMP'2026-09-05 11:00:00', TIMESTAMP'2026-09-05 11:00:00'),
          ('a4', 'e2', 'u1', 'Ann', 'raw', '3', 'comment', 'third', CAST(NULL AS STRING),
           TIMESTAMP'2026-09-05 12:00:00', TIMESTAMP'2026-09-05 12:00:00'),
          ('a5', 'e1', 'u1', 'Ann', 'macro', '101', 'comment', 'macro note', CAST(NULL AS STRING),
           TIMESTAMP'2026-09-05 13:00:00', TIMESTAMP'2026-09-05 13:00:00'),
          ('a6', 'e1', 'u1', 'Ann', 'upload', '1001', 'comment', 'upload note', CAST(NULL AS STRING),
           TIMESTAMP'2026-09-05 14:00:00', TIMESTAMP'2026-09-05 14:00:00')
        AS t(id, experiment_id, user_id, user_name, table_name, row_id, type, content_text, flag_type,
             created_at, updated_at)
    """,
    "experiment_custom_metadata": """
        SELECT * FROM VALUES
          ('md-1', 'e1',
           parse_json('{"identifierColumnId": "plot", "experimentQuestionId": "plot", "rows": [
             {"_id": "a", "plot": "A1", "soil": "clay", "color": "red"},
             {"_id": "b", "plot": "B2", "soil": "sand"},
             {"_id": "a2", "plot": "A1", "soil": "loam"}]}'),
           'u1', TIMESTAMP'2026-09-01 00:00:00', TIMESTAMP'2026-09-01 00:00:00'),
          ('md-2', 'e1',
           parse_json('{"identifierColumnId": "device", "experimentQuestionId": "column:device_id", "rows": [
             {"_id": "c", "device": "d1", "color": "blue"}]}'),
           'u1', TIMESTAMP'2026-09-02 00:00:00', TIMESTAMP'2026-09-02 00:00:00')
        AS t(metadata_id, experiment_id, metadata, created_by, created_at, updated_at)
    """,
}


@pytest.fixture(scope="module")
def centrum(spark: SparkSession, tmp_path_factory: pytest.TempPathFactory) -> Iterator[str]:
    location = tmp_path_factory.mktemp("centrum")
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_CATALOG}.centrum LOCATION '{location}'")
    for name, query in _TABLES.items():
        spark.sql(f"CREATE TABLE {_CATALOG}.centrum.{name} USING parquet AS {query}")

    # One measurement per timezone in experiment e3, ids from 10 up.
    spark.createDataFrame(
        list(enumerate(_TIMEZONES)), "position int, timezone string"
    ).createOrReplaceTempView("timezones")
    spark.sql(
        f"""
        INSERT INTO {_CATALOG}.centrum.experiment_raw_data
        SELECT 'e3', 10L + position, 'd9', 'MultispeQ', TIMESTAMP'2026-09-06 12:00:00', timezone,
          DATE'2026-09-06', CAST(NULL AS ARRAY<STRUCT<id: STRING, name: STRING, filename: STRING>>),
          CAST(NULL AS VARIANT), CAST(NULL AS ARRAY<{_ANNOTATION}>), 'u9', 'c9', CAST(NULL AS STRING),
          CAST(NULL AS STRING), CAST(NULL AS DOUBLE), CAST(NULL AS DOUBLE), parse_json('[]'),
          TIMESTAMP'2026-09-23 10:03:00'
        FROM timezones
        """
    )

    yield f"{_CATALOG}.centrum"

    spark.sql(f"DROP DATABASE {_CATALOG}.centrum CASCADE")


def _rows(spark: SparkSession, name: str) -> dict[int, dict[str, Any]]:
    """The view's rows by id, with VARIANT columns read back as JSON values."""
    frame = spark.sql((_VIEWS / f"{name}.sql").read_text().replace("${catalog}", _CATALOG))
    readable = [
        F.to_json(F.col(field.name)).alias(field.name)
        if field.dataType.typeName() == "variant"
        else F.col(field.name)
        for field in frame.schema.fields
    ]
    variants = {field.name for field in frame.schema.fields if field.dataType.typeName() == "variant"}

    rows = {}
    for row in frame.select(*readable).collect():
        values = row.asDict(recursive=True)
        for column in variants:
            values[column] = json.loads(values[column]) if values[column] is not None else None
        rows[values["id"]] = values
    return rows


def _annotation_ids(row: dict[str, Any]) -> list[str]:
    return [annotation["id"] for annotation in row["annotations"]]


def test_each_measurement_gets_its_contributor_and_device_in_its_own_experiment(
    spark: SparkSession, centrum: str
) -> None:
    rows = _rows(spark, "enriched_experiment_raw_data")

    assert rows[1]["contributor"] == {"id": "u1", "name": "Ann", "avatar": None}
    assert rows[1]["device"]["id"] == "dev-1"
    # u1 has another profile row in e2, and c1 is registered in e1 only.
    assert rows[3]["contributor"]["avatar"] == "ann.png"
    assert rows[3]["device"] is None
    assert rows[3]["device_label"] == "MultispeQ (d1)"
    assert rows[2]["contributor"] is None
    assert rows[2]["device"] is None
    assert rows[2]["device_label"] == "Ambit (d2)"


def test_annotations_from_the_device_come_before_those_added_in_the_app(
    spark: SparkSession, centrum: str
) -> None:
    rows = _rows(spark, "enriched_experiment_raw_data")

    assert _annotation_ids(rows[1]) == ["payload-1", "a1", "a2"]
    # a3 has row id 1 too, but in e2.
    assert _annotation_ids(rows[3]) == ["a4"]
    assert rows[2]["annotations"] == []


def test_custom_metadata_matches_by_question_or_device_and_later_uploads_win(
    spark: SparkSession, centrum: str
) -> None:
    rows = _rows(spark, "enriched_experiment_raw_data")

    # Plot A1 matches soil and colour by question, from the first of its two rows;
    # device d1 matches a later colour.
    assert rows[1]["custom_metadata"] == {"soil": "clay", "color": "blue"}
    assert rows[2]["custom_metadata"] == {"soil": "sand"}
    assert rows[3]["custom_metadata"] is None


def test_local_time_follows_the_stored_zone_and_a_measurement_without_one_is_kept(
    spark: SparkSession, centrum: str
) -> None:
    rows = _rows(spark, "enriched_experiment_raw_data")
    by_timezone = {_TIMEZONES[row["id"] - 10]: row for row in rows.values() if row["experiment_id"] == "e3"}

    assert len(by_timezone) == len(_TIMEZONES)
    valid = by_timezone.pop("Europe/Amsterdam")
    assert valid["timezone"] == "Europe/Amsterdam"
    assert valid["measurement_time_local"] == "2026-09-06 14:00:00"
    assert valid["local_time"] == "14:00"
    for row in by_timezone.values():
        assert row["measurement_time_utc"] is not None
        assert row["timezone"] is None
        assert row["measurement_time_local"] is None
        assert row["local_time"] is None


def test_macro_results_keep_their_error_and_get_the_same_enrichment(
    spark: SparkSession, centrum: str
) -> None:
    rows = _rows(spark, "enriched_experiment_macro_data")

    assert set(rows) == {101, 102}
    assert rows[101]["contributor"]["name"] == "Ann"
    assert rows[101]["device"]["id"] == "dev-1"
    assert rows[101]["macro_output"] == {"phi2": 0.7}
    assert rows[101]["local_time"] == "10:00"
    assert _annotation_ids(rows[101]) == ["payload-1", "a5"]
    assert rows[101]["custom_metadata"] == {"soil": "clay", "color": "blue"}
    assert rows[102]["macro_error"] == "Macro failed"
    assert rows[102]["timezone"] is None
    assert rows[102]["annotations"] == []


def test_uploaded_rows_credit_their_uploader_and_carry_their_annotations(
    spark: SparkSession, centrum: str
) -> None:
    rows = _rows(spark, "enriched_experiment_uploaded_data")

    assert set(rows) == {1001, 1002}
    assert rows[1001]["contributor"]["name"] == "Ann"
    assert _annotation_ids(rows[1001]) == ["a6"]
    assert rows[1001]["uploaded_data"] == {"ph": 6.5}
    # u3 is not a contributor of e1.
    assert rows[1002]["contributor"] is None
    assert rows[1002]["annotations"] == []


@pytest.mark.parametrize(
    "view",
    ["enriched_experiment_raw_data", "enriched_experiment_macro_data", "enriched_experiment_uploaded_data"],
)
def test_annotations_read_as_the_type_the_app_renders_as_annotations(
    spark: SparkSession, centrum: str, view: str
) -> None:
    # The app matches the type's text, in which a field that cannot be null reads NOT NULL.
    frame = spark.sql((_VIEWS / f"{view}.sql").read_text().replace("${catalog}", _CATALOG))
    actual = frame.schema["annotations"].dataType
    expected = spark.sql(f"SELECT CAST(NULL AS ARRAY<{_ANNOTATION}>) AS a").schema["a"].dataType

    assert isinstance(actual, ArrayType) and isinstance(expected, ArrayType)
    assert actual.elementType == expected.elementType


@pytest.mark.parametrize("view", ["enriched_experiment_raw_data", "enriched_experiment_macro_data"])
def test_unregistered_device_falls_back_to_reported_name_then_client_id(
    spark: SparkSession, centrum: str, view: str
) -> None:
    source = "experiment_raw_data" if "raw" in view else "experiment_macro_data"
    query = (_VIEWS / f"{view}.sql").read_text().replace("${catalog}", _CATALOG)
    # Override only the source table, keeping the actual view and joins.
    original = spark.table(f"{centrum}.{source}")
    for name, expected in [(" Bench probe ", "Bench probe (d2)"), ("  ", "c9 (d2)"), (None, "c9 (d2)")]:
        original.withColumn(
            "device_name", F.when(F.col("client_id") == "c9", F.lit(name)).otherwise(F.col("device_name"))
        ).createOrReplaceTempView("device_fallback_source")
        rows = spark.sql(query.replace(f"{centrum}.{source}", "device_fallback_source"))
        row = (
            rows.where("experiment_id = 'e1'")
            .where("device_id = 'd2'")
            .select("device", "device_label")
            .first()
        )
        assert row is not None
        assert row.device is None
        assert row.device_label == expected
    registered_row = (
        spark.sql(query).where("experiment_id = 'e1'").where("device_id = 'd1'").select("device").first()
    )
    assert registered_row is not None
    registered = registered_row[0]
    assert registered["id"] == "dev-1"
    assert registered["serial_number"] == "SN1"


@pytest.mark.parametrize("view", ["enriched_experiment_raw_data", "enriched_experiment_macro_data"])
def test_sensors_sharing_a_name_and_phone_keep_distinct_labels(
    spark: SparkSession, centrum: str, view: str
) -> None:
    source = "experiment_raw_data" if "raw" in view else "experiment_macro_data"
    original = spark.table(f"{centrum}.{source}")
    first = original.where("experiment_id = 'e1' AND device_id = 'd2'")
    second = first.withColumn("device_id", F.lit("d3")).withColumn("id", F.col("id") + 1000)
    original.unionByName(second).createOrReplaceTempView("distinct_sensors")
    query = (_VIEWS / f"{view}.sql").read_text().replace("${catalog}", _CATALOG)
    rows = spark.sql(query.replace(f"{centrum}.{source}", "distinct_sensors"))
    devices = (
        rows.where("experiment_id = 'e1' AND device_id IN ('d2', 'd3')")
        .select("device", "device_label")
        .collect()
    )
    assert {row.device_label for row in devices} == {"Ambit (d2)", "Ambit (d3)"}
    assert all(row.device is None for row in devices)
    assert rows.where("device IS NULL AND experiment_id = 'e1'").count() == 2
    selected = rows.where("device_label = 'Ambit (d2)'").select("device_id").first()
    assert selected is not None
    assert selected[0] == "d2"


@pytest.mark.parametrize("view", ["enriched_experiment_raw_data", "enriched_experiment_macro_data"])
@pytest.mark.parametrize(
    ("device_name", "client_id", "device_id", "expected"),
    [
        (None, None, "imported-1", "imported-1"),
        ("Probe", "phone-1", None, "Probe (phone-1)"),
        (None, "phone-1", None, "phone-1"),
        (" ", " ", " ", "Unknown device"),
    ],
)
def test_missing_identifiers_have_an_explicit_fallback(
    spark: SparkSession,
    centrum: str,
    view: str,
    device_name: str | None,
    client_id: str | None,
    device_id: str | None,
    expected: str,
) -> None:
    source = "experiment_raw_data" if "raw" in view else "experiment_macro_data"
    original = spark.table(f"{centrum}.{source}").where("experiment_id = 'e1' AND device_id = 'd2'")
    for column, value in [("device_name", device_name), ("client_id", client_id), ("device_id", device_id)]:
        original = original.withColumn(column, F.lit(value).cast("string"))
    original.createOrReplaceTempView("missing_identifiers")
    query = (_VIEWS / f"{view}.sql").read_text().replace("${catalog}", _CATALOG)
    row = (
        spark.sql(query.replace(f"{centrum}.{source}", "missing_identifiers"))
        .select("device", "device_label")
        .first()
    )
    assert row is not None
    assert row.device_label == expected
    assert row.device is None


@pytest.mark.parametrize("view", ["enriched_experiment_raw_data", "enriched_experiment_macro_data"])
def test_registry_without_a_serial_keeps_its_other_fields(
    spark: SparkSession, centrum: str, view: str
) -> None:
    registry = spark.table(f"{centrum}.experiment_devices")
    registry.withColumn(
        "device", F.col("device").withField("serial_number", F.lit(" "))
    ).createOrReplaceTempView("blank_serial_registry")
    query = (_VIEWS / f"{view}.sql").read_text().replace("${catalog}", _CATALOG)
    row = (
        spark.sql(query.replace(f"{centrum}.experiment_devices", "blank_serial_registry"))
        .where("experiment_id = 'e1' AND device_id = 'd1'")
        .select("device", "device_label")
        .first()
    )
    assert row is not None
    device = row.device
    assert row.device_label == "MultispeQ (d1)"
    assert device.serial_number == " "
    assert device.id == "dev-1"
    assert device.owner == "org-1"
    assert device.status == "onboarded"
    assert device.device_type == "multispeq"


def test_device_options_sort_without_case_sensitivity_with_a_stable_tie_break(spark: SparkSession) -> None:
    rows = spark.sql("""
        SELECT DISTINCT device_label
        FROM VALUES ('Zed'), ('ambit'), ('Ambit'), ('SN1'), (NULL), ('') AS device_names(device_label)
        WHERE device_label IS NOT NULL AND trim(device_label) <> ''
        ORDER BY lower(device_label) ASC, device_label ASC
    """).collect()
    assert [row.device_label for row in rows] == ["Ambit", "ambit", "SN1", "Zed"]


def test_registry_serial_options_sort_by_the_projected_alias(spark: SparkSession) -> None:
    rows = spark.sql("""
        SELECT DISTINCT serial_number
        FROM (
          SELECT device.serial_number
          FROM VALUES (named_struct('serial_number', 'SN2')),
                      (named_struct('serial_number', 'SN1')),
                      (named_struct('serial_number', 'SN1')),
                      (named_struct('serial_number', ' ')),
                      (named_struct('serial_number', CAST(NULL AS STRING))) AS registry(device)
        ) AS device_names
        WHERE serial_number IS NOT NULL AND trim(serial_number) <> ''
        ORDER BY serial_number ASC
        LIMIT 4
    """).collect()
    assert [row.serial_number for row in rows] == ["SN1", "SN2"]
