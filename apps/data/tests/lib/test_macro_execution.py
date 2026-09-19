import json
import math

import pandas as pd
from enrich import macro_execution
from enrich.macro_execution import (
    _add_workbook_metadata,
    _serialize_macro_data,
    distribute_macro_execution_rows,
    make_execute_macro_udf,
)
from pytest import MonkeyPatch


def test_serialize_macro_data_wraps_native_legacy_root_array() -> None:
    data = [{"phi2": 0.7}, {"phi2": 0.8}]

    assert json.loads(_serialize_macro_data(data)) == {"sample": data}


def test_serialize_macro_data_wraps_serialized_legacy_root_array() -> None:
    data = [{"phi2": 0.7}]

    assert json.loads(_serialize_macro_data(json.dumps(data))) == {"sample": data}


def test_serialize_macro_data_wraps_empty_legacy_root_array() -> None:
    assert json.loads(_serialize_macro_data([])) == {"sample": []}


def test_serialize_macro_data_keeps_direct_object_shape() -> None:
    data = {"phi2": 0.7}

    assert json.loads(_serialize_macro_data(data)) == data


def test_serialize_macro_data_keeps_native_and_serialized_scalar_shape() -> None:
    assert _serialize_macro_data(42) == "42"
    assert _serialize_macro_data("42") == "42"


def test_serialize_macro_data_wraps_variant_root_array(monkeypatch: MonkeyPatch) -> None:
    class FakeVariantVal:
        def toJson(self) -> str:
            return '[{"phi2":0.7}]'

    monkeypatch.setattr(macro_execution, "_VariantVal", FakeVariantVal)

    assert json.loads(_serialize_macro_data(FakeVariantVal())) == {"sample": [{"phi2": 0.7}]}


def test_add_workbook_metadata_carries_snapshot_and_context() -> None:
    item: dict = {"id": "row-1", "macro_id": "macro-1", "data": "{}"}

    _add_workbook_metadata(
        item,
        {
            "workbook_version_id": "version-1",
            "macro_context": '{"baseline":{"value":3}}',
        },
    )

    assert item["workbook_version_id"] == "version-1"
    assert item["context"] == '{"baseline":{"value":3}}'


def test_add_workbook_metadata_omits_null_legacy_fields() -> None:
    item: dict = {"id": "row-1", "macro_id": "macro-1", "data": "{}"}

    _add_workbook_metadata(
        item,
        {"workbook_version_id": None, "macro_context": pd.NA},
    )

    assert "workbook_version_id" not in item
    assert "context" not in item


def test_distribute_macro_execution_rows_reduces_observed_task_size(spark) -> None:
    observed_batch_rows = 184_358
    partition_count = 128
    source = spark.range(observed_batch_rows, numPartitions=2)

    distributed = distribute_macro_execution_rows(source, partition_count)
    row_counts = distributed.rdd.mapPartitions(lambda rows: [sum(1 for _ in rows)]).collect()

    assert len(row_counts) == partition_count
    assert sum(row_counts) == observed_batch_rows
    assert min(row_counts) > 0
    assert max(row_counts) <= math.ceil(observed_batch_rows / partition_count) + 2
    assert min(row_counts) >= math.floor(observed_batch_rows / partition_count) - 2


def test_macro_udf_forwards_http_limits_and_preserves_row_order(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(
        macro_execution.F,
        "pandas_udf",
        lambda returnType: lambda function: function,
    )

    class FakeSecrets:
        def get(self, scope: str, key: str) -> str:
            return key

    class FakeDbutils:
        secrets = FakeSecrets()

    captured: dict = {}

    class FakeBackendClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        def execute_macro_batch(self, **kwargs):
            captured.update(kwargs)
            return {
                "results": [
                    {
                        "id": item["id"],
                        "macro_id": item["macro_id"],
                        "success": True,
                        "output": {"row": item["id"]},
                    }
                    for item in reversed(kwargs["items"])
                ]
            }

    monkeypatch.setattr(macro_execution, "BackendClient", FakeBackendClient)
    execute_macro = make_execute_macro_udf(
        "prod",
        FakeDbutils(),
        timeout=30,
        max_batch_size=25,
        max_concurrency=2,
    )

    result = execute_macro(
        pd.DataFrame(
            [
                {"id": "first", "macro_id": "macro", "data": {"value": 1}},
                {"id": "second", "macro_id": "macro", "data": {"value": 2}},
            ]
        )
    )

    assert captured["timeout"] == 30
    assert captured["max_batch_size"] == 25
    assert captured["max_concurrency"] == 2
    assert [json.loads(value) for value in result["result"]] == [
        {"row": "first"},
        {"row": "second"},
    ]
    assert result["error"].tolist() == [None, None]
