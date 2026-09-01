from collections.abc import Callable

import pytest
from openjii.centrum.upload_queryability import (
    UploadQueryability,
    build_queryability_query,
    run_upload_lifecycle,
    wait_until_queryable,
)

SCHEMA = "OBJECT<genotype: STRING, par: DECIMAL(5,1)>"


def observation(
    *,
    upload_rows: int = 2,
    table_rows: int = 5,
    upload_schema: str | None = SCHEMA,
    metadata_rows: int | None = 5,
    metadata_schema: str | None = SCHEMA,
) -> UploadQueryability:
    return UploadQueryability(
        upload_rows=upload_rows,
        table_rows=table_rows,
        upload_schema=upload_schema,
        metadata_rows=metadata_rows,
        metadata_schema=metadata_schema,
    )


def staged_observer(values: list[UploadQueryability]) -> Callable[[], UploadQueryability]:
    iterator = iter(values)
    return lambda: next(iterator)


def test_query_targets_serving_table_and_metadata_in_one_statement() -> None:
    query = build_queryability_query("open_jii_dev", "experiment'1", "table-1", "upload-1")

    assert "enriched_experiment_uploaded_data" in query
    assert "experiment_table_metadata" in query
    assert "experiment''1" in query
    assert "schema_of_variant_agg(uploaded_data)" in query

    count_query = build_queryability_query(
        "open_jii_dev", "experiment-1", "table-1", "upload-1", include_schema=False
    )
    assert "schema_of_variant_agg" not in count_query


def test_waits_for_counts_and_schema_from_same_logical_table() -> None:
    result = wait_until_queryable(
        staged_observer(
            [
                observation(upload_rows=1, table_rows=4, metadata_rows=4),
                observation(metadata_rows=4),
                observation(metadata_schema="OBJECT<genotype: STRING>"),
                observation(),
            ]
        ),
        expected_upload_rows=2,
        timeout_seconds=10,
        poll_seconds=1,
        clock=lambda: 0,
        pause=lambda _: None,
    )

    assert result == observation()


def test_same_table_concurrency_does_not_require_upload_count_to_equal_table_count() -> None:
    assert observation(upload_rows=2, table_rows=9, metadata_rows=9).matches(2)


def test_schema_mismatch_is_not_queryable() -> None:
    assert not observation(metadata_schema="OBJECT<genotype: STRING>").matches(2)


def test_timeout_reports_last_observation() -> None:
    now = 0.0

    def clock() -> float:
        return now

    def pause(seconds: float) -> None:
        nonlocal now
        now += seconds

    with pytest.raises(TimeoutError, match="expected_upload_rows=2"):
        wait_until_queryable(
            lambda: observation(upload_rows=1),
            expected_upload_rows=2,
            timeout_seconds=2,
            poll_seconds=1,
            clock=clock,
            pause=pause,
        )


def test_lifecycle_persists_success_only_after_queryability() -> None:
    events: list[str] = []

    result, status = run_upload_lifecycle(
        lambda: events.append("process") or {"rows_written": 2, "files_failed": 0},
        lambda rows: events.append(f"wait:{rows}"),
        lambda terminal, _result, _error: events.append(f"persist:{terminal}"),
    )

    assert events == ["process", "wait:2", "persist:completed"]
    assert result["rows_written"] == 2
    assert status == "success"


@pytest.mark.parametrize("failure", [TimeoutError("not queryable"), ValueError("bad input")])
def test_lifecycle_persists_failure_and_reraises(failure: Exception) -> None:
    events: list[str] = []

    with pytest.raises(type(failure), match=str(failure)):
        run_upload_lifecycle(
            lambda: events.append("process") or {"rows_written": 2},
            lambda _rows: events.append("wait") or (_ for _ in ()).throw(failure),
            lambda terminal, _result, _error: events.append(f"persist:{terminal}"),
        )

    assert events == ["process", "wait", "persist:failed"]


def test_lifecycle_preserves_original_error_when_failed_status_cannot_be_persisted() -> None:
    original = RuntimeError("completion metadata failed")
    persistence_error = RuntimeError("failed metadata failed")

    def persist(status: str, _result: dict | None, _error: str | None) -> None:
        raise original if status == "completed" else persistence_error

    with pytest.raises(RuntimeError, match=str(original)) as caught:
        run_upload_lifecycle(
            lambda: {"rows_written": 2},
            lambda _rows: None,
            persist,
        )

    assert caught.value is original
    assert caught.value.__cause__ is persistence_error


def test_zero_row_upload_fails_before_wait() -> None:
    events: list[str] = []

    with pytest.raises(ValueError, match="Zero-row uploads"):
        run_upload_lifecycle(
            lambda: events.append("process") or {"rows_written": 0},
            lambda _rows: events.append("wait"),
            lambda terminal, _result, _error: events.append(f"persist:{terminal}"),
        )

    assert events == ["process", "persist:failed"]
