import ast
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any, cast

import pandas as pd
import pytest
from openjii.json_scrub import scrub_non_finite_json_value
from pyspark.sql import functions as F

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
