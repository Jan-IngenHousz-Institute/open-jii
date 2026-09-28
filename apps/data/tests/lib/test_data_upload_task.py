import ast
import json
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, cast

import pandas as pd
import pytest
from openjii.json_scrub import scrub_non_finite_json_value
from pyspark.sql import Column, DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import ArrayType, DataType, DoubleType, FloatType, MapType, StructType

_TASK_PATH = Path(__file__).parents[2] / "src/tasks/data_upload_task.py"


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


def _insert_upload_metadata(spark: SparkSession, table: str, record: dict) -> None:
    module = ast.parse(_TASK_PATH.read_text())
    function = next(
        node
        for node in module.body
        if isinstance(node, ast.FunctionDef) and node.name == "_insert_upload_metadata"
    )
    namespace: dict[str, Any] = {"SparkSession": SparkSession}
    exec(compile(ast.Module(body=[function], type_ignores=[]), _TASK_PATH, "exec"), namespace)
    insert = cast(Callable[[SparkSession, str, dict], None], namespace["_insert_upload_metadata"])
    insert(spark, table, record)


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

    assert callers == {"_process_tabular_upload", "process_ambyte_upload"}


@pytest.mark.spark
def test_upload_metadata_insert_binds_values_as_parameters(spark) -> None:
    completed_at = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)
    record = {
        "upload_id": "u-1",
        "experiment_id": "e-1",
        "upload_table_id": "",
        "upload_table_name": "O'Brien's table",
        "source_kind": "csv",
        "status": "failed",
        "file_count": 1,
        "row_count": 42,
        "created_by": "",
        "created_at": completed_at,
        "completed_at": completed_at,
        "error_message": r"a\' OR 1=1 -- ",
    }

    table = "upload_metadata_rows"
    spark.sql(f"DROP TABLE IF EXISTS {table}")
    spark.sql(
        f"""
        CREATE TABLE {table} (
          upload_id STRING, experiment_id STRING, upload_table_id STRING, upload_table_name STRING,
          source_kind STRING, status STRING, file_count INT, row_count INT, created_by STRING,
          created_at TIMESTAMP, completed_at TIMESTAMP, error_message STRING
        ) USING parquet
        """
    )
    _insert_upload_metadata(spark, table, record)
    _insert_upload_metadata(spark, table, {**record, "error_message": None})

    rows = spark.table(table).orderBy(F.col("error_message").asc_nulls_last()).collect()
    assert [(row.upload_table_name, row.row_count, row.error_message) for row in rows] == [
        ("O'Brien's table", 42, r"a\' OR 1=1 -- "),
        ("O'Brien's table", 42, None),
    ]
    spark.sql(f"DROP TABLE {table}")


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
