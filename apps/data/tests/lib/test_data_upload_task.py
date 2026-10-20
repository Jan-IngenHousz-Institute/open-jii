import ast
import json
import os
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from ambyte import ambyte_parsing, find_byte_folders
from openjii.json_scrub import scrub_non_finite_json_value
from openjii.variant_schema import merged_variant_schema, variant_schema_key
from pyspark.sql import Column, DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (
    ArrayType,
    DataType,
    DoubleType,
    FloatType,
    LongType,
    MapType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)

_TASK_PATH = Path(__file__).parents[2] / "src/tasks/data_upload_task.py"
_OUTCOMES_PATH = Path(__file__).parents[1] / "fixtures/upload_outcomes.json"


def _serialize_dataframe_rows(frame: pd.DataFrame) -> list[str]:
    module = ast.parse(_TASK_PATH.read_text())
    function = next(
        node
        for node in module.body
        if isinstance(node, ast.FunctionDef) and node.name == "_serialize_dataframe_rows"
    )
    namespace: dict[str, Any] = {
        "json": json,
        "pd": pd,
        "scrub_non_finite_json_value": scrub_non_finite_json_value,
    }
    exec(compile(ast.Module(body=[function], type_ignores=[]), _TASK_PATH, "exec"), namespace)
    serializer = cast(Callable[[pd.DataFrame], list[str]], namespace["_serialize_dataframe_rows"])
    return serializer(frame)


def _serialize_parquet_rows(frame: DataFrame) -> DataFrame:
    module = ast.parse(_TASK_PATH.read_text())
    function = next(
        node
        for node in module.body
        if isinstance(node, ast.FunctionDef) and node.name == "_serialize_parquet_rows"
    )
    namespace: dict[str, Any] = {
        "Column": Column,
        "DataFrame": DataFrame,
        "DataType": DataType,
        "ArrayType": ArrayType,
        "MapType": MapType,
        "StructType": StructType,
        "F": F,
        "DoubleType": DoubleType,
        "FloatType": FloatType,
    }
    exec(compile(ast.Module(body=[function], type_ignores=[]), _TASK_PATH, "exec"), namespace)
    serializer = cast(Callable[[DataFrame], DataFrame], namespace["_serialize_parquet_rows"])
    return serializer(frame)


def _strict_loads(payload: str) -> dict:
    def reject(token: str) -> None:
        raise ValueError(f"non-standard token {token}")

    return json.loads(payload, parse_constant=reject)


def test_dataframe_rows_encode_missing_numeric_values_as_json_null() -> None:
    frame = pd.DataFrame(
        {
            "measurement": [1.25, float("nan")],
            "label": ["leaf", "NaN"],
        }
    )

    payloads = _serialize_dataframe_rows(frame)

    assert [_strict_loads(payload) for payload in payloads] == [
        {"measurement": 1.25, "label": "leaf"},
        {"measurement": None, "label": "NaN"},
    ]


def test_dataframe_rows_encode_nested_non_finite_values_as_json_null() -> None:
    frame = pd.DataFrame(
        {
            "measurement": [float("inf"), float("-inf")],
            "nested": [[1.0, float("nan")], {"value": float("inf")}],
        }
    )

    payloads = _serialize_dataframe_rows(frame)

    assert [_strict_loads(payload) for payload in payloads] == [
        {"measurement": None, "nested": [1.0, None]},
        {"measurement": None, "nested": {"value": None}},
    ]


@pytest.mark.spark
def test_dataframe_rows_survive_spark_variant_parsing(spark) -> None:
    payloads = _serialize_dataframe_rows(pd.DataFrame({"measurement": [1.25, float("nan"), float("inf")]}))

    parsed = spark.createDataFrame([(payload,) for payload in payloads], "payload string").select(
        F.expr("try_parse_json(payload)").alias("payload")
    )

    assert parsed.filter(F.col("payload").isNull()).count() == 0


def test_pandas_upload_paths_use_the_shared_serializer() -> None:
    module = ast.parse(_TASK_PATH.read_text())
    callers = {
        function.name
        for function in module.body
        if isinstance(function, ast.FunctionDef)
        and any(
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "_serialize_dataframe_rows"
            for node in ast.walk(function)
        )
    }

    assert callers == {"_parse_tabular_files", "process_ambyte_upload"}


@pytest.mark.spark
@pytest.mark.parametrize("numeric_type", ["float", "double"])
def test_csv_and_parquet_non_finite_values_match(spark, tmp_path, numeric_type) -> None:
    values = [1.25, float("nan"), float("inf"), float("-inf"), None]
    labels = ["leaf", "missing numeric", "Infinity", "-Infinity", "missing"]
    frame = spark.createDataFrame(
        list(zip(range(5), values, values, labels, strict=True)),
        f"id int, `Fm'.value` {numeric_type}, `a``b` {numeric_type}, label string",
    )
    path = str(tmp_path / "upload.parquet")
    frame.write.parquet(path)

    parquet_rows = [
        _strict_loads(row.uploaded_data)
        for row in _serialize_parquet_rows(spark.read.parquet(path)).collect()
    ]
    csv_frame = pd.DataFrame({"id": range(5), "Fm'.value": values, "a`b": values, "label": labels})
    csv_path = tmp_path / "upload.csv"
    csv_frame.to_csv(csv_path, index=False)
    csv_rows = [_strict_loads(payload) for payload in _serialize_dataframe_rows(pd.read_csv(csv_path))]

    expected = [
        {"id": i, "Fm'.value": 1.25 if i == 0 else None, "a`b": 1.25 if i == 0 else None, "label": label}
        for i, label in enumerate(labels)
    ]
    assert csv_rows == expected
    assert sorted(parquet_rows, key=lambda row: row["id"]) == expected


@pytest.mark.spark
@pytest.mark.parametrize("numeric_type", ["float", "double"])
def test_nested_parquet_non_finite_values_become_null(spark, tmp_path, numeric_type) -> None:
    schema = (
        "id int, "
        f"nested struct<`Fm'.value`:{numeric_type},`a``b`:array<{numeric_type}>,label:string>, "
        f"arrays array<map<string,struct<value:{numeric_type}>>>, "
        f"maps map<string,array<{numeric_type}>>"
    )
    frame = spark.createDataFrame(
        [
            (
                0,
                (float("nan"), [1.25, float("inf"), float("-inf"), None], "NaN"),
                [{"reading": (float("inf"),), "null struct": None}, None, {}],
                {"Infinity": [float("nan"), -2.5], "empty": [], "null array": None},
            ),
            (1, None, None, None),
            (2, (1.25, [], "Infinity"), [], {}),
        ],
        schema,
    )
    path = str(tmp_path / "nested.parquet")
    frame.write.parquet(path)

    serialized = _serialize_parquet_rows(spark.read.parquet(path))
    rows = [_strict_loads(row.uploaded_data) for row in serialized.collect()]

    assert sorted(rows, key=lambda row: row["id"]) == [
        {
            "id": 0,
            "nested": {"Fm'.value": None, "a`b": [1.25, None, None, None], "label": "NaN"},
            "arrays": [{"reading": {"value": None}, "null struct": None}, None, {}],
            "maps": {"Infinity": [None, -2.5], "empty": [], "null array": None},
        },
        {"id": 1, "nested": None, "arrays": None, "maps": None},
        {"id": 2, "nested": {"Fm'.value": 1.25, "a`b": [], "label": "Infinity"}, "arrays": [], "maps": {}},
    ]
    assert serialized.filter(F.expr("try_parse_json(uploaded_data) IS NULL")).count() == 0


def _task_function(name: str, namespace: dict[str, Any]) -> Callable[..., Any]:
    module = ast.parse(_TASK_PATH.read_text())
    function = next(node for node in module.body if isinstance(node, ast.FunctionDef) and node.name == name)
    exec(compile(ast.Module(body=[function], type_ignores=[]), _TASK_PATH, "exec"), namespace)
    return cast(Callable[..., Any], namespace[name])


class _QuietLogger:
    def info(self, _message: str) -> None:
        pass

    def warning(self, _message: str) -> None:
        pass

    def error(self, _message: str) -> None:
        pass


class _Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.now += seconds


def _uploaded_rows(spark: SparkSession, payloads: list[str], upload_id: str = "upload-1") -> DataFrame:
    return spark.createDataFrame([(payload,) for payload in payloads], "payload string").select(
        F.lit("exp-1").alias("experiment_id"),
        F.lit("table-1").alias("upload_table_id"),
        F.lit(upload_id).alias("upload_id"),
        F.expr("parse_json(payload)").alias("uploaded_data"),
    )


def _samples(rows: DataFrame) -> DataFrame:
    # One sample per schema, as the pipeline keeps them.
    return rows.select(
        "experiment_id",
        "upload_table_id",
        variant_schema_key("uploaded_data").alias("schema_key"),
        F.col("uploaded_data").alias("sample"),
    ).dropDuplicates(["experiment_id", "upload_table_id", "schema_key"])


def _table_list(spark: SparkSession, samples: DataFrame | None) -> DataFrame:
    """The table list as the pipeline last refreshed it: from these samples, or without the table."""
    if samples is None:
        return spark.createDataFrame(
            [], "experiment_id string, identifier string, table_type string, upload_schema string"
        )
    return samples.groupBy("experiment_id", "upload_table_id").agg(
        F.col("upload_table_id").alias("identifier"),
        F.lit("upload").alias("table_type"),
        merged_variant_schema("sample").alias("upload_schema"),
    )


def _queryable_checks(
    spark: SparkSession, rows: DataFrame, samples: DataFrame, table_list: DataFrame
) -> dict[str, Any]:
    rows.createOrReplaceTempView("uploaded_data")
    samples.createOrReplaceTempView("uploaded_data_schemas")
    table_list.createOrReplaceTempView("table_metadata")
    namespace: dict[str, Any] = {
        "spark": spark,
        "F": F,
        "DataFrame": DataFrame,
        "merged_variant_schema": merged_variant_schema,
        "variant_schema_key": variant_schema_key,
        "EXPERIMENT_ID": "exp-1",
        "UPLOAD_TABLE_ID": "table-1",
        "UPLOAD_ID": "upload-1",
        "UPLOADED_DATA_TABLE": "uploaded_data",
        "UPLOADED_DATA_SCHEMAS_TABLE": "uploaded_data_schemas",
        "TABLE_METADATA": "table_metadata",
    }
    for helper in ("_upload_table_rows", "upload_schema_keys", "table_list_shows"):
        _task_function(helper, namespace)
    return namespace


def test_upload_schema_keys_waits_for_every_row(spark) -> None:
    rows = _uploaded_rows(spark, ['{"plot": "A1", "height": 1}', '{"plot": "A2", "height": 2.5}'])
    checks = _queryable_checks(spark, rows, _samples(rows), _table_list(spark, None))

    assert checks["upload_schema_keys"](3) is None
    assert len(checks["upload_schema_keys"](2)) == 2


def test_table_list_shows_an_upload_once_refreshed_with_its_schemas(spark) -> None:
    rows = _uploaded_rows(spark, ['{"plot": "A1", "height": 1}', '{"` plot `": "B"}'])
    samples = _samples(rows)
    checks = _queryable_checks(spark, rows, samples, _table_list(spark, samples))

    assert checks["table_list_shows"](checks["upload_schema_keys"](2)) is True


def test_table_list_does_not_show_an_upload_before_its_table_is_listed(spark) -> None:
    rows = _uploaded_rows(spark, ['{"plot": "A1"}'])
    samples = _samples(rows)
    checks = _queryable_checks(spark, rows, samples, _table_list(spark, None))

    assert checks["table_list_shows"](checks["upload_schema_keys"](1)) is False


def test_table_list_does_not_show_an_upload_whose_schemas_are_not_sampled_yet(spark) -> None:
    earlier = _uploaded_rows(spark, ['{"plot": "A1"}'], upload_id="upload-0")
    rows = earlier.unionByName(_uploaded_rows(spark, ['{"plot": "A2", "leaf_area": 3.1}']))
    checks = _queryable_checks(spark, rows, _samples(earlier), _table_list(spark, _samples(earlier)))

    assert checks["table_list_shows"](checks["upload_schema_keys"](1)) is False


def test_table_list_does_not_show_an_upload_until_refreshed_after_its_schemas(spark) -> None:
    earlier = _uploaded_rows(spark, ['{"plot": "A1"}'], upload_id="upload-0")
    rows = earlier.unionByName(_uploaded_rows(spark, ['{"plot": "A2", "leaf_area": 3.1}']))
    checks = _queryable_checks(spark, rows, _samples(rows), _table_list(spark, _samples(earlier)))

    assert checks["table_list_shows"](checks["upload_schema_keys"](1)) is False


def test_table_list_shows_an_upload_without_fields_once_listed(spark) -> None:
    rows = _uploaded_rows(spark, ["{}"])
    samples = _samples(rows)

    unlisted = _queryable_checks(spark, rows, samples, _table_list(spark, None))
    assert unlisted["table_list_shows"](unlisted["upload_schema_keys"](1)) is False

    listed = _queryable_checks(spark, rows, samples, _table_list(spark, samples))
    assert listed["table_list_shows"](listed["upload_schema_keys"](1)) is True


def _wait_until_queryable(keys: list[list[str] | None | Exception], shows: list[bool], clock: _Clock):
    def upload_schema_keys(_expected_rows: int) -> list[str] | None:
        result = keys.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    namespace: dict[str, Any] = {
        "time": clock,
        "logger": _QuietLogger(),
        "upload_schema_keys": upload_schema_keys,
        "table_list_shows": lambda _keys: shows.pop(0),
        "TABLE_WAIT_SECONDS": 60,
        "TABLE_POLL_SECONDS": 15,
    }
    return _task_function("wait_until_queryable", namespace)


def test_waits_for_the_rows_and_then_the_table_list() -> None:
    clock = _Clock()

    assert _wait_until_queryable([None, ["k"]], [False, True], clock)(2) is True
    assert clock.now == 30


def test_gives_up_when_the_table_list_never_shows_the_upload() -> None:
    clock = _Clock()

    assert _wait_until_queryable([["k"]], [False] * 4, clock)(2) is False
    assert clock.now == 60


def test_keeps_waiting_when_a_check_fails() -> None:
    clock = _Clock()

    assert _wait_until_queryable([RuntimeError("hiccup"), ["k"]], [True], clock)(2) is True


def _outcome_helpers() -> dict[str, Any]:
    namespace: dict[str, Any] = {"os": os}
    for helper in ("has_committed_output", "rejected_file", "build_outcome"):
        _task_function(helper, namespace)
    return namespace


def test_outcomes_match_the_contract_the_backend_parses() -> None:
    build_outcome = _outcome_helpers()["build_outcome"]
    upload_id = "8c1f6a0e-4c35-4d7e-9a43-3f0b2a5d1e77"
    built = {
        "completed_with_rejected_file": build_outcome(
            upload_id, 42, [{"name": "broken.csv", "reason": "unparseable"}], True
        ),
        "no_files": build_outcome(upload_id, 0, [], False),
        "no_rows": build_outcome(upload_id, 0, [{"name": "header_only.csv", "reason": "no_rows"}], False),
        "not_queryable": build_outcome(upload_id, 42, [], False),
    }

    contract = json.loads(_OUTCOMES_PATH.read_text())

    assert [{"case": case, "outcome": outcome} for case, outcome in built.items()] == contract


@pytest.mark.spark
def test_only_a_committed_write_counts_as_written(spark, tmp_path) -> None:
    has_committed_output = _outcome_helpers()["has_committed_output"]
    committed = tmp_path / "upload_1"
    spark.createDataFrame([("A1",)], "plot string").write.parquet(str(committed))
    crashed = tmp_path / "upload_2"
    crashed.mkdir()
    (crashed / "part-00000.snappy.parquet").write_bytes(b"")

    assert has_committed_output(str(committed)) is True
    assert has_committed_output(str(crashed)) is False
    assert has_committed_output(str(tmp_path / "upload_3")) is False


def _parse_tabular_files(
    paths: list[str], parser: Callable[[str], pd.DataFrame]
) -> tuple[list[str], list[dict]]:
    namespace: dict[str, Any] = {
        "os": os,
        "json": json,
        "pd": pd,
        "scrub_non_finite_json_value": scrub_non_finite_json_value,
        "logger": _QuietLogger(),
    }
    for helper in ("rejected_file", "_serialize_dataframe_rows", "_parse_tabular_files"):
        _task_function(helper, namespace)
    return namespace["_parse_tabular_files"](paths, parser)


def test_tabular_files_that_yield_no_rows_are_rejected_with_a_reason(tmp_path) -> None:
    (tmp_path / "plots.csv").write_text("plot,height\nA1,1.5\nA2,2.5\n")
    (tmp_path / "header_only.csv").write_text("plot,height\n")
    (tmp_path / "empty.csv").write_text("")
    paths = [f"dbfs:{tmp_path / name}" for name in ("plots.csv", "header_only.csv", "empty.csv")]

    payloads, rejected = _parse_tabular_files(paths, pd.read_csv)

    assert [_strict_loads(payload) for payload in payloads] == [
        {"plot": "A1", "height": 1.5},
        {"plot": "A2", "height": 2.5},
    ]
    assert rejected == [
        {"name": "header_only.csv", "reason": "no_rows"},
        {"name": "empty.csv", "reason": "unparseable"},
    ]


def _read_parquet_files(spark: SparkSession, paths: list[str]) -> tuple[DataFrame | None, list[dict]]:
    namespace: dict[str, Any] = {
        "spark": spark,
        "os": os,
        "logger": _QuietLogger(),
        "Column": Column,
        "DataFrame": DataFrame,
        "DataType": DataType,
        "ArrayType": ArrayType,
        "MapType": MapType,
        "StructType": StructType,
        "F": F,
        "DoubleType": DoubleType,
        "FloatType": FloatType,
    }
    for helper in ("rejected_file", "_serialize_parquet_rows", "_read_parquet_files"):
        _task_function(helper, namespace)
    return namespace["_read_parquet_files"](paths)


@pytest.mark.spark
def test_parquet_files_that_yield_no_rows_are_rejected_with_a_reason(spark, tmp_path) -> None:
    pd.DataFrame({"plot": ["A1"], "height": [1.5]}).to_parquet(tmp_path / "plots.parquet")
    pd.DataFrame({"plot": pd.Series([], dtype=str)}).to_parquet(tmp_path / "empty.parquet")
    (tmp_path / "broken.parquet").write_text("plot,height\nA1,1.5\n")
    paths = [f"dbfs:{tmp_path / name}" for name in ("plots.parquet", "empty.parquet", "broken.parquet")]

    combined, rejected = _read_parquet_files(spark, paths)

    assert combined is not None
    assert [_strict_loads(row.uploaded_data) for row in combined.collect()] == [{"plot": "A1", "height": 1.5}]
    assert rejected == [
        {"name": "empty.parquet", "reason": "no_rows"},
        {"name": "broken.parquet", "reason": "unparseable"},
    ]


def _corrupt_second_row_group(path: Path) -> None:
    column = pq.ParquetFile(path).metadata.row_group(1).column(0)
    with path.open("r+b") as file:
        file.seek(column.dictionary_page_offset or column.data_page_offset)
        file.write(b"\xff" * 64)


@pytest.mark.spark
def test_a_parquet_file_corrupt_past_its_first_row_is_rejected_and_the_rest_are_written(
    spark, tmp_path
) -> None:
    pd.DataFrame({"plot": ["A1"], "height": [1.5]}).to_parquet(tmp_path / "plots.parquet")
    corrupt = tmp_path / "corrupt.parquet"
    pq.write_table(pa.table({"plot": [f"B{i}" for i in range(1000)]}), str(corrupt), row_group_size=500)
    _corrupt_second_row_group(corrupt)
    assert not spark.read.parquet(str(corrupt)).isEmpty()
    paths = [f"dbfs:{tmp_path / name}" for name in ("plots.parquet", "corrupt.parquet")]

    combined, rejected = _read_parquet_files(spark, paths)
    assert combined is not None
    combined.write.parquet(str(tmp_path / "output"))
    written = spark.read.parquet(str(tmp_path / "output")).collect()

    assert rejected == [{"name": "corrupt.parquet", "reason": "unparseable"}]
    assert [_strict_loads(row.uploaded_data) for row in written] == [{"plot": "A1", "height": 1.5}]


def _parse_ambyte_folders(
    folders: list[str], frames: dict[str, pd.DataFrame | Exception | None]
) -> tuple[list[pd.DataFrame], list[dict]]:
    def load_files_per_byte(folder: str, year_prefix: tuple[str, ...]) -> tuple[list[list[list]], str]:
        return [[["trace"]], [], [], []], folder

    def process_trace_files(folder_name: str, _files_per_byte: list[list[list]]) -> pd.DataFrame | None:
        frame = frames[folder_name]
        if isinstance(frame, Exception):
            raise frame
        return frame

    namespace: dict[str, Any] = {
        "os": os,
        "pd": pd,
        "logger": _QuietLogger(),
        "load_files_per_byte": load_files_per_byte,
        "process_trace_files": process_trace_files,
    }
    for helper in ("rejected_file", "_parse_ambyte_folders"):
        _task_function(helper, namespace)
    return namespace["_parse_ambyte_folders"](folders, ("2026", "2025"))


def test_ambyte_folders_that_yield_no_rows_are_rejected_with_a_reason() -> None:
    frames, rejected = _parse_ambyte_folders(
        [
            "dbfs:/uploads/Ambyte_1/",
            "dbfs:/uploads/Ambyte_2",
            "dbfs:/uploads/Ambyte_3",
            "dbfs:/uploads/Ambyte_4",
        ],
        {
            "Ambyte_1": pd.DataFrame({"PAR": [1.0, 2.0]}),
            "Ambyte_2": None,
            "Ambyte_3": pd.DataFrame({"PAR": []}),
            "Ambyte_4": ValueError("truncated trace"),
        },
    )

    assert [len(frame) for frame in frames] == [2]
    assert rejected == [
        {"name": "Ambyte_2", "reason": "no_rows"},
        {"name": "Ambyte_3", "reason": "no_rows"},
        {"name": "Ambyte_4", "reason": "unparseable"},
    ]


class _FileInfo:
    def __init__(self, path: str, is_dir: bool) -> None:
        self.path = path
        self.is_dir = is_dir

    def isDir(self) -> bool:
        return self.is_dir


class _Volumes:
    """Serves ``dbutils.fs`` for /Volumes paths from a local directory, listing as ``dbfs:`` paths."""

    def __init__(self, root: Path) -> None:
        self.root = root

    def ls(self, path: str) -> list[_FileInfo]:
        local = self.root / path.removeprefix("dbfs:").lstrip("/")
        return [
            _FileInfo(f"dbfs:/{child.relative_to(self.root)}{'/' if child.is_dir() else ''}", child.is_dir())
            for child in sorted(local.iterdir())
        ]

    def mkdirs(self, _path: str) -> None:
        pass


def _process_ambyte_upload(
    spark: SparkSession, monkeypatch: pytest.MonkeyPatch, root: Path, traces: list[str]
) -> tuple[dict, list[str]]:
    upload = root / "Volumes/catalog/centrum/data-imports/exp-1/uploads/upload_1"
    for trace in traces:
        (upload / trace).parent.mkdir(parents=True, exist_ok=True)
        (upload / trace).write_text("")

    dbutils = SimpleNamespace(fs=_Volumes(root))
    monkeypatch.setattr(ambyte_parsing, "dbutils", dbutils)
    parsed: list[str] = []

    def parse_ambyte_folders(folders: list[str], _year_prefixes: tuple[str, ...]):
        parsed.extend(os.path.basename(folder) for folder in folders)
        return [pd.DataFrame({"PAR": [1.0]}) for _ in folders], []

    namespace: dict[str, Any] = {
        "os": os,
        "json": json,
        "pd": pd,
        "spark": spark,
        "dbutils": dbutils,
        "logger": _QuietLogger(),
        "datetime": datetime,
        "timezone": timezone,
        "LongType": LongType,
        "StringType": StringType,
        "StructField": StructField,
        "StructType": StructType,
        "TimestampType": TimestampType,
        "find_byte_folders": find_byte_folders,
        "scrub_non_finite_json_value": scrub_non_finite_json_value,
        "_parse_ambyte_folders": parse_ambyte_folders,
        "YEAR_PREFIX": "2026",
        "UPLOAD_TABLE_NAME": "traces",
        "UPLOAD_TABLE_ID": "table-1",
        "CATALOG_NAME": "catalog",
        "EXPERIMENT_ID": "exp-1",
        "UPLOAD_DIRECTORY": "upload_1",
        "UPLOAD_ID": "upload-1",
        "USER_ID": "user-1",
        "PROCESSED_UPLOADS_PATH": str(root / "processed-uploads"),
        "OUTPUT_PATH": str(root / "processed-uploads/upload_upload-1"),
    }
    for helper in (
        "rejected_file",
        "_serialize_dataframe_rows",
        "_find_ambyte_folders",
        "process_ambyte_upload",
    ):
        _task_function(helper, namespace)
    return namespace["process_ambyte_upload"](), parsed


@pytest.mark.spark
def test_ambyte_folders_discovery_does_not_find_are_rejected_next_to_the_rows(
    spark, monkeypatch, tmp_path
) -> None:
    result, parsed = _process_ambyte_upload(
        spark,
        monkeypatch,
        tmp_path,
        [
            *(f"Ambyte_1/{ambit}/20260101-120000_.txt" for ambit in "1234"),
            "Ambyte_2/20260101-120000_.txt",
            "Ambyte_3/1/20260101-120000_.txt",
            "unknown_ambyte/unknown_ambit/20260101-120000_.txt",
        ],
    )

    assert parsed == ["Ambyte_1", "unknown_ambyte"]
    assert result == {
        "rows_written": 2,
        "rejected_files": [
            {"name": "Ambyte_2", "reason": "unparseable"},
            {"name": "Ambyte_3", "reason": "unparseable"},
        ],
    }


@pytest.mark.spark
def test_an_ambyte_upload_without_a_discoverable_folder_names_every_folder(
    spark, monkeypatch, tmp_path
) -> None:
    result, parsed = _process_ambyte_upload(
        spark, monkeypatch, tmp_path, ["Ambyte_2/20260101-120000_.txt", "unknown_ambyte/notes.txt"]
    )

    assert parsed == []
    assert result == {
        "rows_written": 0,
        "rejected_files": [
            {"name": "Ambyte_2", "reason": "unparseable"},
            {"name": "unknown_ambyte", "reason": "unparseable"},
        ],
    }


class _Notebook:
    def __init__(self) -> None:
        self.exit_value = ""

    def exit(self, value: str) -> None:
        self.exit_value = value


class _DbUtils:
    def __init__(self) -> None:
        self.notebook = _Notebook()


class _WrittenOutput:
    """Stands in for ``spark`` where the task counts what an earlier attempt wrote."""

    def __init__(self, rows: int) -> None:
        self.read = self
        self.rows = rows

    def parquet(self, _path: str) -> "_WrittenOutput":
        return self

    def count(self) -> int:
        return self.rows


def _run_main(
    committed: bool, written_rows: int = 0, processed: dict | None = None, queryable: bool = True
) -> tuple[dict, int, list[int]]:
    process_calls: list[None] = []
    waited_for: list[int] = []
    dbutils = _DbUtils()

    def process_upload() -> dict | None:
        process_calls.append(None)
        return processed

    def wait_until_queryable(expected_rows: int) -> bool:
        waited_for.append(expected_rows)
        return queryable

    namespace: dict[str, Any] = {
        "os": os,
        "json": json,
        "logger": _QuietLogger(),
        "dbutils": dbutils,
        "spark": _WrittenOutput(written_rows),
        "has_committed_output": lambda _path: committed,
        "process_upload": process_upload,
        "wait_until_queryable": wait_until_queryable,
        "OUTPUT_PATH": "/Volumes/catalog/centrum/data-imports/exp-1/processed-uploads/upload_upload-1",
        "UPLOAD_ID": "upload-1",
        "TABLE_WAIT_SECONDS": 3600,
    }
    _task_function("build_outcome", namespace)
    _task_function("main", namespace)()
    return json.loads(dbutils.notebook.exit_value), len(process_calls), waited_for


def test_a_retry_after_a_committed_write_waits_for_those_rows_instead_of_writing_them_again() -> None:
    outcome, process_calls, waited_for = _run_main(committed=True, written_rows=42)

    assert process_calls == 0
    assert waited_for == [42]
    assert outcome == {
        "uploadId": "upload-1",
        "outcome": "completed",
        "rowCount": 42,
        "rejectedFiles": [],
        "errorCode": None,
    }


def test_an_upload_exits_with_the_files_it_rejected() -> None:
    rejected = [{"name": "broken.csv", "reason": "unparseable"}]

    outcome, process_calls, waited_for = _run_main(
        committed=False, processed={"rows_written": 7, "rejected_files": rejected}
    )

    assert process_calls == 1
    assert waited_for == [7]
    assert (outcome["outcome"], outcome["rowCount"], outcome["rejectedFiles"]) == ("completed", 7, rejected)


def test_an_upload_without_rows_fails_without_waiting() -> None:
    rejected = [{"name": "header_only.csv", "reason": "no_rows"}]

    outcome, _, waited_for = _run_main(
        committed=False, processed={"rows_written": 0, "rejected_files": rejected}
    )

    assert waited_for == []
    assert (outcome["outcome"], outcome["errorCode"]) == ("failed", "no_rows")


def test_an_upload_whose_table_never_lists_it_fails() -> None:
    outcome, _, _ = _run_main(
        committed=False, processed={"rows_written": 7, "rejected_files": []}, queryable=False
    )

    assert (outcome["outcome"], outcome["errorCode"]) == ("failed", "not_queryable")


def test_the_outcome_leaves_the_task_only_as_its_exit_value() -> None:
    module = ast.parse(_TASK_PATH.read_text())
    imported = {node.module or "" for node in ast.walk(module) if isinstance(node, ast.ImportFrom)}
    imported |= {
        alias.name for node in ast.walk(module) if isinstance(node, ast.Import) for alias in node.names
    }
    attributes = {node.attr for node in ast.walk(module) if isinstance(node, ast.Attribute)}

    assert not [name for name in imported if name.startswith(("enrich", "requests"))]
    assert "secrets" not in attributes
    assert "sql" not in attributes
