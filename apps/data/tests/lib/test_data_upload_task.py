import ast
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any, cast

import numpy as np
import pandas as pd
import pytest
from openjii.json_scrub import scrub_non_finite_json_value
from pyspark.sql import DataFrame
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, FloatType

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
        "np": np,
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
        "DataFrame": DataFrame,
        "F": F,
        "DoubleType": DoubleType,
        "FloatType": FloatType,
    }
    exec(compile(ast.Module(body=[function], type_ignores=[]), _TASK_PATH, "exec"), namespace)
    serializer = cast(Callable[[DataFrame], DataFrame], namespace["_serialize_parquet_rows"])
    return serializer(frame)


def _quote_spark_sql_string(value: str | None) -> str:
    module = ast.parse(_TASK_PATH.read_text())
    function = next(
        node
        for node in module.body
        if isinstance(node, ast.FunctionDef) and node.name == "_quote_spark_sql_string"
    )
    namespace: dict[str, Any] = {}
    exec(compile(ast.Module(body=[function], type_ignores=[]), _TASK_PATH, "exec"), namespace)
    quote = cast(Callable[[str | None], str], namespace["_quote_spark_sql_string"])
    return quote(value)


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


def test_upload_metadata_uses_spark_sql_string_escaping() -> None:
    assert _quote_spark_sql_string(None) == "NULL"
    assert _quote_spark_sql_string("O'Brien") == r"'O\'Brien'"
    assert _quote_spark_sql_string(r"a\' OR 1=1 -- ") == r"'a\\\' OR 1=1 -- '"


@pytest.mark.parametrize("scalar_type", [np.float16, np.float32, np.float64, np.longdouble])
def test_nested_numpy_non_finite_values_become_null(scalar_type) -> None:
    frame = pd.DataFrame(
        {
            "nested": [
                {
                    "values": [scalar_type("nan"), scalar_type("inf"), scalar_type("-inf")],
                    "finite": scalar_type(1.25),
                    "strings": ["nan", "NaN", "Infinity", "-Infinity"],
                }
            ]
        }
    )

    [payload] = _serialize_dataframe_rows(frame)

    assert _strict_loads(payload) == {
        "nested": {
            "values": [None, None, None],
            "finite": 1.25 if scalar_type is np.float64 else "1.25",
            "strings": ["nan", "NaN", "Infinity", "-Infinity"],
        }
    }


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
