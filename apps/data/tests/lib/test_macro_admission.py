"""Local Spark recovery semantics; production Delta/DLT still needs a dev canary."""

import json
import runpy
from pathlib import Path
from types import SimpleNamespace

import pytest
from enrich.macro_execution import distribute_macro_execution_rows
from pyspark.sql import SparkSession


@pytest.mark.parametrize("value", ["0", "-1", "wrong", "1.5"])
def test_macro_runtime_rejects_invalid_admission_values(monkeypatch, value):
    conf = {"CATALOG_NAME": "test", "MACRO_MAX_FILES_PER_TRIGGER": value}
    session = SimpleNamespace(conf=SimpleNamespace(get=lambda key, default: conf.get(key, default)))
    monkeypatch.setattr(SparkSession, "getActiveSession", lambda: session)
    path = Path(__file__).parents[2] / "src/lib/openjii/openjii/macros/runtime.py"
    with pytest.raises(ValueError, match="MACRO_MAX_FILES_PER_TRIGGER must be a positive integer"):
        runpy.run_path(str(path))


def test_new_admission_limit_and_range_shuffle_preserve_pending_checkpoint(spark, tmp_path):
    source, checkpoint = str(tmp_path / "source"), tmp_path / "checkpoint"
    schema = "id long, macro_id string, workbook_version_id string"
    spark.createDataFrame([(i, "m", None) for i in range(24)], schema).repartition(4).write.parquet(source)
    attempted, committed = [], []

    def update(file_limit, fail=False, shuffle=False):
        frame = spark.readStream.schema(schema).option("maxFilesPerTrigger", file_limit).parquet(source)
        if shuffle:
            frame = distribute_macro_execution_rows(frame, 16)

        def sink(batch, batch_id):
            ids = sorted(r.id for r in batch.collect())
            attempted.append((batch_id, ids))
            if fail:
                raise RuntimeError("INJECTED_UNCOMMITTED_BATCH")
            committed.extend(ids)

        query = (
            frame.writeStream.foreachBatch(sink)
            .option("checkpointLocation", str(checkpoint))
            .trigger(availableNow=True)
            .start()
        )
        try:
            if fail:
                with pytest.raises(Exception, match="INJECTED_UNCOMMITTED_BATCH"):
                    query.awaitTermination(60)
            else:
                assert query.awaitTermination(60)
            return str(query.id)
        finally:
            query.stop()

    query_id = update(4, fail=True)
    assert (checkpoint / "offsets/0").exists()
    assert not (checkpoint / "commits/0").exists()
    assert update(1, shuffle=True) == query_id
    assert attempted[:2] == [(0, list(range(24))), (0, list(range(24)))]
    spark.createDataFrame([(i, "m", None) for i in range(24, 48)], schema).repartition(4).write.mode(
        "append"
    ).parquet(source)
    assert update(1, shuffle=True) == query_id
    assert [len(ids) for _, ids in attempted[2:]] == [6, 6, 6, 6]
    assert sorted(committed) == list(range(48))
    assert json.loads((checkpoint / "metadata").read_text())["id"] == query_id
