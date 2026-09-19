import json
import math
from collections import Counter

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


def _partition_summaries(df) -> list[tuple[int, int, list[int]]]:
    def summarize(partition_id, rows):
        group_counts: Counter = Counter()
        row_count = 0
        for row in rows:
            row_count += 1
            group_counts[(row.macro_id, row.workbook_version_id)] += 1
        if row_count:
            yield partition_id, row_count, list(group_counts.values())

    return df.rdd.mapPartitionsWithIndex(summarize).collect()


def _post_count(summaries: list[tuple[int, int, list[int]]]) -> int:
    return sum(math.ceil(group_count / 25) for _, _, groups in summaries for group_count in groups)


def test_distribute_macro_execution_rows_reduces_fragments_and_task_size(spark) -> None:
    observed_batch_rows = 2_023
    partition_count = 128
    source = spark.createDataFrame(
        [
            (
                f"row-{index:05d}",
                f"macro-{index % 3}",
                None if index % 3 == 0 else "version-1",
            )
            for index in range(observed_batch_rows)
        ],
        "id string, macro_id string, workbook_version_id string",
    )

    round_robin = _partition_summaries(source.repartition(partition_count))
    range_runs = [
        _partition_summaries(distribute_macro_execution_rows(source, partition_count)) for _ in range(2)
    ]

    assert sum(row_count for _, row_count, _ in round_robin) == observed_batch_rows
    assert sum(len(groups) for _, _, groups in round_robin) >= 300
    for summaries in range_runs:
        row_counts = [row_count for _, row_count, _ in summaries]
        fragment_count = sum(len(groups) for _, _, groups in summaries)
        assert sum(row_counts) == observed_batch_rows
        # Range boundaries are sampled, so tolerate variation rather than
        # promising 128 non-empty, perfectly balanced partitions at runtime.
        assert len(row_counts) >= 120
        assert max(row_counts) <= 24
        assert fragment_count <= 150
        assert _post_count(summaries) <= 150


def test_distribute_macro_execution_rows_spreads_null_versions_by_distinct_id(spark) -> None:
    source = spark.createDataFrame(
        [(f"row-{index:04d}", "macro", None) for index in range(512)],
        "id string, macro_id string, workbook_version_id string",
    )

    summaries = _partition_summaries(distribute_macro_execution_rows(source, 128))
    row_counts = [row_count for _, row_count, _ in summaries]

    assert sum(row_counts) == 512
    assert len(row_counts) >= 100
    assert max(row_counts) <= 10


def test_distribute_macro_execution_rows_documents_equal_key_skew_limit(spark) -> None:
    source = spark.createDataFrame(
        [("same-id", "macro", None) for _ in range(512)],
        "id string, macro_id string, workbook_version_id string",
    )

    summaries = _partition_summaries(distribute_macro_execution_rows(source, 128))

    assert sum(row_count for _, row_count, _ in summaries) == 512
    assert len(summaries) == 1
    assert summaries[0][1] == 512


def test_distribute_macro_execution_rows_preserves_small_batch_without_nonempty_promise(spark) -> None:
    source = spark.createDataFrame(
        [(f"row-{index:02d}", "macro", None) for index in range(31)],
        "id string, macro_id string, workbook_version_id string",
    )

    summaries = _partition_summaries(distribute_macro_execution_rows(source, 128))

    assert sum(row_count for _, row_count, _ in summaries) == 31
    assert 1 <= len(summaries) <= 31


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
        request_delay_seconds=6,
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
    assert captured["request_delay_seconds"] == 6
    assert [json.loads(value) for value in result["result"]] == [
        {"row": "first"},
        {"row": "second"},
    ]
    assert result["error"].tolist() == [None, None]


def test_macro_udf_preserves_duplicate_macro_multiplicity(monkeypatch: MonkeyPatch) -> None:
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

    class FakeBackendClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        def execute_macro_batch(self, **kwargs):
            item = kwargs["items"][0]
            return {
                "results": [
                    {
                        "id": item["id"],
                        "macro_id": item["macro_id"],
                        "success": True,
                        "output": {"occurrence": occurrence},
                    }
                    for occurrence in (1, 2)
                ]
            }

    monkeypatch.setattr(macro_execution, "BackendClient", FakeBackendClient)
    execute_macro = make_execute_macro_udf("prod", FakeDbutils())

    result = execute_macro(
        pd.DataFrame(
            [
                {
                    "id": "same-row",
                    "macro_id": "same-macro",
                    "workbook_version_id": "same-version",
                    "data": {"value": 1},
                },
                {
                    "id": "same-row",
                    "macro_id": "same-macro",
                    "workbook_version_id": "same-version",
                    "data": {"value": 1},
                },
            ]
        )
    )

    assert [json.loads(value) for value in result["result"]] == [
        {"occurrence": 1},
        {"occurrence": 2},
    ]
    assert result["error"].tolist() == [None, None]
