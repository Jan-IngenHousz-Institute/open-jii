"""The enriched views join gold with the backend's tables when they are read.
These run each view's SQL over small tables and check what a reader gets back."""

from __future__ import annotations

import ast
import gzip
import hashlib
import json
import shutil
import sys
import types
from collections.abc import Callable, Iterator
from pathlib import Path
from types import SimpleNamespace
from typing import IO, Any
from urllib.parse import urlparse

import pandas as pd
import pytest
from openjii.helpers import load_experiment_table
from pyspark.sql import DataFrame, SparkSession
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
    "experiment_table_metadata": """
        SELECT * FROM VALUES
          ('e1', 'raw_data', 'static', CAST(NULL AS STRING), 'STRUCT<plot: STRING>',
           CAST(NULL AS STRING), CAST(NULL AS STRING)),
          ('e1', 'mac-1', 'macro', 'STRUCT<phi2: DOUBLE>', 'STRUCT<plot: STRING>',
           CAST(NULL AS STRING), CAST(NULL AS STRING))
        AS t(experiment_id, identifier, table_type, macro_schema, questions_schema, custom_metadata_schema,
             upload_schema)
    """,
    "experiment_raw_data": f"""
        SELECT * FROM VALUES
          ('e1', 1L, 'd1', 'MultispeQ', TIMESTAMP'2026-09-01 08:00:00', 'Europe/Amsterdam', DATE'2026-09-01',
           array(named_struct('id', 'm1', 'name', 'Fluo', 'filename', 'fluo.py')),
           parse_json('{{"plot": "A1"}}'), array({_PAYLOAD_ANNOTATION}),
           'u1', 'c1', 'p1', 'w1', 'v1', 52.0D, 5.1D, parse_json('[{{"x": 1}}]'),
           TIMESTAMP'2026-09-23 10:00:00'),
          ('e1', 2L, 'd2', 'Ambit', TIMESTAMP'2026-09-02 09:30:00', CAST(NULL AS STRING), DATE'2026-09-02',
           CAST(array() AS ARRAY<STRUCT<id: STRING, name: STRING, filename: STRING>>),
           parse_json('{{"plot": "B2"}}'), CAST(array() AS ARRAY<{_ANNOTATION}>),
           'u2', 'c9', 'p1', 'w1', CAST(NULL AS STRING), 52.1D, 5.2D, parse_json('[{{"x": 2}}]'),
           TIMESTAMP'2026-09-23 10:01:00'),
          ('e2', 3L, 'd1', 'MultispeQ', TIMESTAMP'2026-09-03 10:00:00', CAST(NULL AS STRING), DATE'2026-09-03',
           CAST(NULL AS ARRAY<STRUCT<id: STRING, name: STRING, filename: STRING>>),
           CAST(NULL AS VARIANT), CAST(NULL AS ARRAY<{_ANNOTATION}>),
           'u1', 'c1', CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS DOUBLE),
           CAST(NULL AS DOUBLE), parse_json('[]'), TIMESTAMP'2026-09-23 10:02:00')
        AS t(experiment_id, id, device_id, device_name, timestamp, timezone, date, macros, questions_data,
             annotations, user_id, client_id, protocol_id, workbook_run_id, workbook_version_id, latitude,
             longitude, data, processed_timestamp)
    """,
    "experiment_macro_data": f"""
        SELECT * FROM VALUES
          ('e1', 101, 1L, 'd1', 'c1', 'MultispeQ', TIMESTAMP'2026-09-01 08:00:00', 'Europe/Amsterdam', 'u1',
           52.0D, 5.1D, 'mac-1', 'Fluo', 'fluo.py', 'w1', 'v1', parse_json('{{"phi2": 0.7}}'),
           CAST(NULL AS STRING), TIMESTAMP'2026-09-23 10:05:00', DATE'2026-09-01',
           parse_json('{{"plot": "A1"}}'), array({_PAYLOAD_ANNOTATION})),
          ('e1', 102, 2L, 'd2', 'c9', 'Ambit', TIMESTAMP'2026-09-02 09:30:00', CAST(NULL AS STRING), 'u2',
           52.1D, 5.2D, 'mac-1', 'Fluo', 'fluo.py', 'w1', CAST(NULL AS STRING), CAST(NULL AS VARIANT),
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
    """Create the enriched views' source tables and export metadata in a local catalog."""
    location = tmp_path_factory.mktemp("centrum")
    spark.sql(f"CREATE DATABASE IF NOT EXISTS {_CATALOG}.centrum LOCATION '{location}'")
    for name, query in _TABLES.items():
        spark.sql(f"CREATE TABLE {_CATALOG}.centrum.{name} USING parquet AS {query}")
    for name in ("enriched_experiment_raw_data", "enriched_experiment_macro_data"):
        query = (_VIEWS / f"{name}.sql").read_text().replace("${catalog}", _CATALOG)
        spark.sql(f"CREATE VIEW {_CATALOG}.centrum.{name} AS {query}")

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
          CAST(NULL AS STRING), CAST(NULL AS STRING), CAST(NULL AS DOUBLE), CAST(NULL AS DOUBLE),
          parse_json('[]'), TIMESTAMP'2026-09-23 10:03:00'
        FROM timezones
        """
    )

    yield f"{_CATALOG}.centrum"

    spark.sql(f"DROP DATABASE {_CATALOG}.centrum CASCADE")


def _readable(frame: DataFrame) -> DataFrame:
    """The frame with its VARIANT columns as JSON text."""
    return frame.select(
        *[
            F.to_json(F.col(field.name)).alias(field.name)
            if field.dataType.typeName() == "variant"
            else F.col(field.name)
            for field in frame.schema.fields
        ]
    )


def _rows(spark: SparkSession, name: str) -> dict[int, dict[str, Any]]:
    """The view's rows by id, with VARIANT columns read back as JSON values."""
    frame = spark.sql((_VIEWS / f"{name}.sql").read_text().replace("${catalog}", _CATALOG))
    variants = {field.name for field in frame.schema.fields if field.dataType.typeName() == "variant"}

    rows = {}
    for row in _readable(frame).collect():
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
    assert rows[2]["contributor"] is None
    assert rows[2]["device"] is None


def test_annotations_from_the_device_come_before_those_added_in_the_app(
    spark: SparkSession, centrum: str
) -> None:
    rows = _rows(spark, "enriched_experiment_raw_data")

    assert _annotation_ids(rows[1]) == ["payload-1", "a1", "a2"]
    # a3 has row id 1 too, but in e2.
    assert _annotation_ids(rows[3]) == ["a4"]
    assert rows[2]["annotations"] == []


@pytest.mark.parametrize(
    ("view", "row_id"), [("enriched_experiment_raw_data", 1), ("enriched_experiment_macro_data", 101)]
)
def test_the_phones_annotations_also_read_alone(
    spark: SparkSession, centrum: str, view: str, row_id: int
) -> None:
    rows = _rows(spark, view)

    assert [annotation["id"] for annotation in rows[row_id]["payload_annotations"]] == ["payload-1"]
    assert all(row["payload_annotations"] == [] for id_, row in rows.items() if id_ != row_id)


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


def test_measurements_and_macro_results_name_the_workbook_version_that_produced_them(
    spark: SparkSession, centrum: str
) -> None:
    """Both views retain the stored version ID, including rows without one."""
    raw = _rows(spark, "enriched_experiment_raw_data")
    macro = _rows(spark, "enriched_experiment_macro_data")

    assert raw[1]["workbook_version_id"] == "v1"
    # A measurement taken without a workbook keeps an empty version.
    assert raw[3]["workbook_version_id"] is None
    assert macro[101]["workbook_version_id"] == "v1"
    assert macro[102]["workbook_version_id"] is None


class _Files:
    def create_directory(self, path: str) -> None:
        Path(path).mkdir(parents=True, exist_ok=True)

    def upload(self, path: str, contents: IO[bytes], overwrite: bool) -> None:
        Path(path).write_bytes(contents.read())


class _WorkspaceClient:
    files = _Files()


class _Fs:
    def ls(self, directory: str) -> list[SimpleNamespace]:
        return [
            SimpleNamespace(name=path.name, size=path.stat().st_size) for path in Path(directory).iterdir()
        ]

    def rm(self, path: str, recurse: bool) -> None:
        shutil.rmtree(path, ignore_errors=True)


class _DbUtils:
    """The Databricks utilities the export task calls, over a local folder."""

    def __init__(self) -> None:
        self.fs = _Fs()
        self.exits: list[str] = []
        self.notebook = SimpleNamespace(exit=self.exits.append)


_TASK = _VIEWS.parent / "tasks/data_export_task.py"
_TASK_SETTINGS = {
    "EXPORT_ID",
    "EXPERIMENT_ID",
    "TABLE_NAME",
    "CATALOG_NAME",
    "FORMAT",
    "spark",
    "dbutils",
    "OUTPUT_PATH",
    "SNAPSHOT_PATH",
    "SNAPSHOT_AT",
}
_SPARK_FORMATS = ("csv", "ndjson", "parquet")
_FORMATS = (*_SPARK_FORMATS, "json-array", "xlsx")


def _runs_locally(node: ast.stmt) -> bool:
    """Everything in the task but its widget settings, its Databricks-only import and its calls."""
    if isinstance(node, (ast.Expr, ast.Try)):
        return False
    if isinstance(node, ast.ImportFrom):
        return node.module != "pyspark.dbutils"
    if isinstance(node, ast.Assign):
        return not any(
            isinstance(target, ast.Name) and target.id in _TASK_SETTINGS for target in node.targets
        )
    return True


@pytest.fixture
def export_task(
    spark: SparkSession, centrum: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Callable[..., dict[str, Any]]:
    """The export task loaded for one export into a local folder, ready for its ``main``."""
    sdk = types.ModuleType("databricks.sdk")
    sdk.WorkspaceClient = _WorkspaceClient  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "databricks", types.ModuleType("databricks"))
    monkeypatch.setitem(sys.modules, "databricks.sdk", sdk)
    body = [node for node in ast.parse(_TASK.read_text()).body if _runs_locally(node)]

    def load(table_name: str, export_format: str, experiment_id: str = "e1", anonymize: bool = False):
        output = tmp_path / table_name / export_format
        namespace: dict[str, Any] = {
            "EXPORT_ID": "export-1",
            "EXPERIMENT_ID": experiment_id,
            "TABLE_NAME": table_name,
            "CATALOG_NAME": _CATALOG,
            "FORMAT": export_format,
            "ANONYMIZE_CONTRIBUTORS": anonymize,
            "OUTPUT_PATH": str(output),
            "SNAPSHOT_PATH": f"{output}-snapshot",
            "SNAPSHOT_AT": "2026-11-16T08:00:00+00:00",
            "spark": spark,
            "dbutils": _DbUtils(),
        }
        exec(compile(ast.Module(body=body, type_ignores=[]), _TASK, "exec"), namespace)
        return namespace

    return load


def _run(task: dict[str, Any]) -> dict[str, Any]:
    """Run the export and return its manifest."""
    task["main"]()
    return json.loads(task["dbutils"].exits[-1])


def _records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {name: None if pd.isna(value) else value for name, value in row.items()}
        for row in frame.to_dict("records")
    ]


def _part_rows(spark: SparkSession, export_format: str, path: Path) -> list[dict[str, Any]]:
    """One part's rows as a reader of that format gets them."""
    if export_format == "csv":
        return _records(pd.read_csv(path, compression="gzip", dtype=str))
    if export_format == "ndjson":
        with gzip.open(path, "rt") as lines:
            return [json.loads(line) for line in lines]
    if export_format == "parquet":
        return [row.asDict(recursive=True) for row in _readable(spark.read.parquet(str(path))).collect()]
    if export_format == "json-array":
        return json.loads(path.read_text())
    return _records(pd.read_excel(path, dtype=str))


def _exported_rows(
    spark: SparkSession, task: dict[str, Any], manifest: dict[str, Any]
) -> list[dict[str, Any]]:
    output = Path(task["OUTPUT_PATH"])
    return [
        row
        for part in manifest["parts"]
        for row in _part_rows(spark, manifest["format"], output / part["name"])
    ]


def _json(value: Any) -> Any:
    """A nested value a flat format holds as JSON text."""
    return json.loads(value) if isinstance(value, str) else value


@pytest.mark.parametrize(
    ("table_name", "ids", "annotations"),
    [
        ("raw_data", [1, 2], [["payload-1", "a1", "a2"], []]),
        ("mac-1", [101, 102], [["payload-1", "a5"], []]),
    ],
)
@pytest.mark.parametrize("export_format", _FORMATS)
def test_an_export_writes_each_row_in_order_with_its_annotations_and_custom_metadata(
    spark: SparkSession,
    export_task: Callable[..., dict[str, Any]],
    table_name: str,
    ids: list[int],
    annotations: list[list[str]],
    export_format: str,
) -> None:
    task = export_task(table_name, export_format)
    task["ROWS_PER_PART"] = 1

    manifest = _run(task)
    rows = _exported_rows(spark, task, manifest)

    assert manifest["rowCount"] == len(rows) == 2
    assert len(manifest["parts"]) == (2 if export_format in _SPARK_FORMATS else 1)
    # A writer may leave out a null field, so the columns are those any row has.
    assert set().union(*rows) == set(load_experiment_table("e1", table_name, _CATALOG).columns)
    assert [int(row["id"]) for row in rows] == ids
    assert [[annotation["id"] for annotation in _json(row["annotations"])] for row in rows] == annotations
    assert [_json(row["custom_metadata"]) for row in rows] == [
        {"soil": "clay", "color": "blue"},
        {"soil": "sand"},
    ]
    assert [row.get("workbook_version_id") for row in rows] == ["v1", None]


def test_an_anonymized_export_shows_each_contributor_by_their_pseudonym(
    spark: SparkSession, export_task: Callable[..., dict[str, Any]]
) -> None:
    task = export_task("raw_data", "csv", anonymize=True)

    rows = _exported_rows(spark, task, _run(task))

    pseudonym = f"Contributor-{hashlib.sha256(b'e1:u1').hexdigest()[:6].upper()}"
    [contributor, without_contributor] = [_json(row["contributor"]) for row in rows]
    assert (contributor["id"], contributor["name"], contributor.get("avatar")) == (pseudonym, pseudonym, None)
    assert without_contributor is None


def test_an_anonymized_exports_snapshot_holds_only_pseudonyms(
    export_task: Callable[..., dict[str, Any]],
) -> None:
    task = export_task("raw_data", "csv", anonymize=True)
    take_snapshot = task["take_snapshot"]
    held: dict[int, Any] = {}

    def snapshot_recording_its_contributors(table: Any) -> DataFrame:
        snapshot = take_snapshot(table)
        held.update({row.id: row.contributor for row in snapshot.select("id", "contributor").collect()})
        return snapshot

    task["take_snapshot"] = snapshot_recording_its_contributors
    _run(task)

    pseudonym = f"Contributor-{hashlib.sha256(b'e1:u1').hexdigest()[:6].upper()}"
    assert held[1].asDict() == {"id": pseudonym, "name": pseudonym, "avatar": None}
    assert held[2] is None


def test_an_export_writes_its_parts_from_its_snapshot_not_from_the_views(
    export_task: Callable[..., dict[str, Any]],
) -> None:
    task = export_task("raw_data", "parquet")
    write_parts = task["write_parts"]
    read: list[str] = []

    def write_recording_what_it_reads(frame: DataFrame) -> None:
        read.extend(frame.inputFiles())
        write_parts(frame)

    task["write_parts"] = write_recording_what_it_reads
    _run(task)

    assert read
    assert {Path(urlparse(path).path).parent.name for path in read} == {
        f"{Path(task['OUTPUT_PATH']).name}-snapshot"
    }


@pytest.mark.parametrize("table_name", ["raw_data", "mac-1"])
def test_a_parquet_export_keeps_the_columns_and_types_the_table_has(
    export_task: Callable[..., dict[str, Any]], table_name: str
) -> None:
    task = export_task(table_name, "parquet")
    write_parts = task["write_parts"]
    written: list[DataFrame] = []

    def write_recording_the_frame(frame: DataFrame) -> None:
        written.append(frame)
        write_parts(frame)

    task["write_parts"] = write_recording_the_frame
    _run(task)

    # A file read makes every field nullable, so only names and types can match the source's.
    [frame] = written
    expected = load_experiment_table("e1", table_name, _CATALOG)
    assert [(f.name, f.dataType.simpleString()) for f in frame.schema.fields] == [
        (f.name, f.dataType.simpleString()) for f in expected.schema.fields
    ]


@pytest.mark.parametrize("export_format", _FORMATS)
def test_an_export_removes_its_snapshot_when_it_is_done(
    export_task: Callable[..., dict[str, Any]], export_format: str
) -> None:
    task = export_task("raw_data", export_format)

    _run(task)

    assert not Path(task["SNAPSHOT_PATH"]).exists()


def test_a_refused_export_removes_its_snapshot_and_writes_no_part(
    export_task: Callable[..., dict[str, Any]],
) -> None:
    task = export_task("raw_data", "xlsx")
    task["DRIVER_FORMAT_MAX_ROWS"] = 1

    with pytest.raises(task["ExportError"], match=r"too_many_rows_for_format"):
        _run(task)

    assert not Path(task["SNAPSHOT_PATH"]).exists()
    assert not Path(task["OUTPUT_PATH"]).exists()


def test_an_experiment_without_rows_exports_an_empty_manifest(
    spark: SparkSession, export_task: Callable[..., dict[str, Any]]
) -> None:
    spark.sql(
        f"""
        INSERT INTO {_CATALOG}.centrum.experiment_table_metadata
        SELECT 'e-empty', identifier, table_type, macro_schema, questions_schema, custom_metadata_schema,
          upload_schema
        FROM {_CATALOG}.centrum.experiment_table_metadata
        WHERE experiment_id = 'e1' AND identifier = 'raw_data'
        """
    )
    task = export_task("raw_data", "csv", experiment_id="e-empty")

    manifest = _run(task)

    assert (manifest["rowCount"], manifest["parts"]) == (0, [])


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


@pytest.mark.parametrize(
    ("view", "row_id"),
    [("enriched_experiment_raw_data", 2), ("enriched_experiment_macro_data", 102)],
)
def test_views_expose_the_client_id_without_synthesizing_registry_data(
    spark: SparkSession, centrum: str, view: str, row_id: int
) -> None:
    row = _rows(spark, view)[row_id]
    assert row["client_id"] == "c9"
    assert row["device"] is None
