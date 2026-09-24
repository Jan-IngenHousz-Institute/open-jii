import json
import math
from collections import Counter
from uuid import uuid4

import pandas as pd
from enrich import macro_execution
from enrich.macro_execution import (
    _add_workbook_metadata,
    _serialize_macro_data,
    distribute_macro_execution_rows,
    make_execute_macro_udf,
)
from pytest import MonkeyPatch, raises


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


def test_distribute_macro_execution_rows_executes_in_streaming_query(spark, tmp_path) -> None:
    input_path = tmp_path / "macro-input"
    checkpoint_path = tmp_path / "checkpoint"
    schema = "id string, macro_id string, workbook_version_id string"
    rows = [
        (f"row-{index:03d}", f"macro-{index % 3}", None if index % 2 else "version-1") for index in range(96)
    ]
    spark.createDataFrame(rows, schema).write.mode("overwrite").parquet(str(input_path))

    source = spark.readStream.schema(schema).parquet(str(input_path))
    distributed = distribute_macro_execution_rows(source, 16)
    query_name = f"macro_range_stream_{uuid4().hex}"

    assert source.isStreaming
    assert distributed.isStreaming

    query = (
        distributed.writeStream.format("memory")
        .queryName(query_name)
        .outputMode("append")
        .option("checkpointLocation", str(checkpoint_path))
        .trigger(availableNow=True)
        .start()
    )
    try:
        assert query.awaitTermination(30)
        output = spark.table(query_name)
        assert output.count() == len(rows)
        assert {(row.id, row.macro_id, row.workbook_version_id) for row in output.collect()} == set(rows)
    finally:
        query.stop()
        spark.catalog.dropTempView(query_name)


def test_range_shuffle_resumes_existing_stream_checkpoint_without_reprocessing(spark, tmp_path) -> None:
    input_path = str(tmp_path / "input")
    output_path = str(tmp_path / "output")
    checkpoint_path = str(tmp_path / "checkpoint")
    schema = "id string, macro_id string, workbook_version_id string"
    before = [("before", "macro", None)]
    after = [("after", "macro", "version-1")]
    spark.createDataFrame(before, schema).write.mode("append").parquet(input_path)

    def run_update(with_shuffle):
        source = spark.readStream.schema(schema).parquet(input_path)
        if with_shuffle:
            source = distribute_macro_execution_rows(source, 16)
        query = (
            source.writeStream.format("parquet")
            .option("path", output_path)
            .option("checkpointLocation", checkpoint_path)
            .trigger(availableNow=True)
            .start()
        )
        try:
            assert query.awaitTermination(30)
            progress = query.lastProgress
            assert progress is not None
            return progress["batchId"]
        finally:
            query.stop()

    original_batch = run_update(False)
    spark.createDataFrame(after, schema).write.mode("append").parquet(input_path)
    assert run_update(True) == original_batch + 1
    assert Counter(tuple(row) for row in spark.read.parquet(output_path).collect()) == Counter(before + after)


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
    )

    result = execute_macro(
        pd.DataFrame(
            [
                {"id": "first", "macro_id": "macro", "data": {"value": 1}, "should_execute": True},
                {"id": "second", "macro_id": "macro", "data": {"value": 2}, "should_execute": True},
            ]
        )
    )

    assert captured["timeout"] == 30
    assert captured["max_batch_size"] == 25
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
                    "should_execute": True,
                    "data": {"value": 1},
                },
                {
                    "id": "same-row",
                    "macro_id": "same-macro",
                    "workbook_version_id": "same-version",
                    "should_execute": True,
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


def test_ineligible_macro_rows_do_not_serialize_or_create_a_client(monkeypatch: MonkeyPatch) -> None:
    from types import SimpleNamespace

    monkeypatch.setattr(macro_execution.F, "pandas_udf", lambda returnType: lambda function: function)

    def unexpected_work(*args, **kwargs):
        raise AssertionError("ineligible rows must not prepare or send requests")

    monkeypatch.setattr(macro_execution, "_serialize_macro_data", unexpected_work)
    monkeypatch.setattr(macro_execution, "BackendClient", unexpected_work)
    dbutils = SimpleNamespace(secrets=SimpleNamespace(get=lambda **kwargs: "unused"))
    execute = make_execute_macro_udf("dev", dbutils)
    result = execute(
        pd.DataFrame(
            [
                {"id": "skip", "macro_id": "macro", "data": object(), "should_execute": False},
                {"id": "null", "macro_id": "macro", "data": object(), "should_execute": None},
                {"id": "na", "macro_id": "macro", "data": object(), "should_execute": pd.NA},
            ]
        )
    )
    assert result.to_dict("list") == {"result": [None] * 3, "error": [None] * 3}
    with raises(ValueError, match="requires should_execute"):
        execute(pd.DataFrame([{"id": "missing-eligibility", "macro_id": "macro", "data": object()}]))


def test_sixteen_range_partitions_limit_small_batch_posts_and_spread_skew(spark) -> None:
    from pyspark.sql import functions as F

    for row_count, post_limit in [(200, 16), (500, 32), (184358, 7400)]:
        source = spark.range(row_count).select(
            F.format_string("row-%09d", F.col("id")).alias("id"),
            F.when(F.col("id") % 10 < 8, F.lit("macro-a")).otherwise(F.lit("macro-b")).alias("macro_id"),
            F.lit(None).cast("string").alias("workbook_version_id"),
        )
        summaries = _partition_summaries(distribute_macro_execution_rows(source, 16))
        assert sum(count for _, count, _ in summaries) == row_count
        assert len(summaries) == 16
        assert max(count for _, count, _ in summaries) < row_count / 8
        # A partition crossing the group boundary may need one extra POST.
        assert _post_count(summaries) <= post_limit + 1


def test_macro_notebook_posts_only_eligible_rows_on_real_spark(spark, fake_dlt, monkeypatch) -> None:
    import runpy
    import sys
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from pathlib import Path
    from types import ModuleType, SimpleNamespace

    from pyspark.sql import functions as F

    macro_id = "11111111-1111-4111-8111-111111111111"
    source = spark.createDataFrame(
        [
            ("valid", macro_id, False, '{"value":1}'),
            ("legacy", macro_id, None, '{"value":2}'),
            ("imported", macro_id, True, '{"value":3}'),
            ("invalid", "not-a-uuid", False, '{"value":4}'),
            ("null-id", None, False, '{"value":5}'),
            ("null-data", macro_id, False, None),
        ],
        "id string, macro_id string, skip_macro_processing boolean, data string",
    )
    source = source.withColumn(
        "macros",
        F.array(
            F.struct(
                F.col("macro_id").alias("id"),
                F.lit("macro").alias("name"),
                F.lit("macro.py").alias("filename"),
            )
        ),
    ).withColumn("output_data", F.parse_json(F.lit('{"imported":true}')))
    for name in [
        "experiment_id",
        "device_id",
        "client_id",
        "device_name",
        "timestamp",
        "timezone",
        "user_id",
        "latitude",
        "longitude",
        "date",
        "processed_timestamp",
        "questions_data",
        "annotations",
        "workbook_run_id",
        "workbook_version_id",
        "macro_context",
    ]:
        source = source.withColumn(name, F.lit(None).cast("string"))

    posted = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            posted.extend(body["items"])
            response = json.dumps(
                {
                    "success": True,
                    "results": [
                        {
                            "id": item["id"],
                            "macro_id": item["macro_id"],
                            "success": True,
                            "output": {"id": item["id"]},
                        }
                        for item in body["items"]
                    ],
                }
            ).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    runtime = ModuleType("openjii.macros.runtime")
    runtime.__dict__.update(
        ENVIRONMENT="dev",
        centrum_table=lambda name: f"test.centrum.{name}",
        MACRO_MAX_FILES_PER_TRIGGER=16,
        MACRO_MAX_BYTES_PER_TRIGGER=16777216,
        MACRO_EXECUTION_PARTITIONS=16,
    )
    monkeypatch.setitem(sys.modules, "openjii.macros.runtime", runtime)
    secrets = {
        "webhook_base_url": f"http://127.0.0.1:{server.server_port}",
        "webhook_api_key_id": "test",
        "webhook_secret": "test",
    }
    dbutils = SimpleNamespace(secrets=SimpleNamespace(get=lambda scope, key: secrets[key]))
    try:
        notebook = runpy.run_path(
            str(Path(__file__).parents[2] / "src/pipelines/macros/experiment_macro_data.py")
        )
        execute = notebook["experiment_macro_data"]
        # Exercise the real notebook projections and pandas UDF. Only the table
        # read and inline-repair hook are replaced for this local check.
        reader = SimpleNamespace(table=lambda name: source)
        reader.option = lambda key, value: reader
        execute.__globals__.update(
            spark=SimpleNamespace(readStream=reader),
            dbutils=dbutils,
            apply_inline_repairs=lambda frame, table: frame,
        )
        rows = {row.raw_id: row for row in execute().collect()}
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)

    assert sorted(item["id"] for item in posted) == ["legacy", "valid"]
    assert len(rows) == 6
    for row_id in ["valid", "legacy"]:
        assert json.loads(rows[row_id].macro_output.toJson()) == {"id": row_id}
        assert rows[row_id].macro_error is None
    assert json.loads(rows["imported"].macro_output.toJson()) == {"imported": True}
    assert rows["imported"].macro_error is None
    assert rows["invalid"].macro_error == "Invalid macro_id (not UUID): not-a-uuid"
    assert rows["null-id"].macro_error == "Invalid macro_id (null)"
    assert rows["null-data"].macro_error == "NULL macro_id or data for row null-data"
    assert all(rows[row_id].macro_output is None for row_id in ["invalid", "null-id", "null-data"])
