from collections.abc import Callable, Mapping
from dataclasses import dataclass
from re import fullmatch
from time import monotonic, sleep
from typing import Any

from .constants import ENRICHED_UPLOADED_DATA_VIEW, EXPERIMENT_TABLE_METADATA


@dataclass(frozen=True)
class UploadQueryability:
    upload_rows: int
    table_rows: int
    upload_schema: str | None
    metadata_rows: int | None
    metadata_schema: str | None

    @classmethod
    def from_row(cls, row: Mapping[str, Any]) -> "UploadQueryability":
        return cls(
            upload_rows=int(row["upload_rows"]),
            table_rows=int(row["table_rows"]),
            upload_schema=row["upload_schema"],
            metadata_rows=row["metadata_rows"],
            metadata_schema=row["metadata_schema"],
        )

    def counts_match(self, expected_upload_rows: int) -> bool:
        return (
            expected_upload_rows > 0
            and self.upload_rows == expected_upload_rows
            and self.metadata_rows == self.table_rows
        )

    def matches(self, expected_upload_rows: int) -> bool:
        return (
            self.counts_match(expected_upload_rows)
            and self.upload_schema is not None
            and self.upload_schema == self.metadata_schema
        )


def _quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def build_queryability_query(
    catalog: str,
    experiment_id: str,
    upload_table_id: str,
    upload_id: str,
    *,
    include_schema: bool = True,
) -> str:
    if fullmatch(r"[A-Za-z0-9_]+", catalog) is None:
        raise ValueError(f"Invalid catalog name: {catalog!r}")

    serving_schema = (
        "nullif(schema_of_variant_agg(uploaded_data), 'VOID')" if include_schema else "CAST(NULL AS STRING)"
    )
    metadata_schema = "max(upload_schema)" if include_schema else "CAST(NULL AS STRING)"

    return f"""
WITH serving AS (
  SELECT
    count_if(upload_id = {_quote(upload_id)}) AS upload_rows,
    count(*) AS table_rows,
    {serving_schema} AS upload_schema
  FROM {catalog}.centrum.{ENRICHED_UPLOADED_DATA_VIEW}
  WHERE experiment_id = {_quote(experiment_id)}
    AND upload_table_id = {_quote(upload_table_id)}
), metadata AS (
  SELECT
    max(row_count) AS metadata_rows,
    {metadata_schema} AS metadata_schema
  FROM {catalog}.centrum.{EXPERIMENT_TABLE_METADATA}
  WHERE experiment_id = {_quote(experiment_id)}
    AND table_type = 'upload'
    AND identifier = {_quote(upload_table_id)}
)
SELECT serving.*, metadata.*
FROM serving CROSS JOIN metadata
"""


def wait_until_queryable(
    observe: Callable[[], UploadQueryability],
    expected_upload_rows: int,
    timeout_seconds: int,
    poll_seconds: int,
    *,
    clock: Callable[[], float] = monotonic,
    pause: Callable[[float], None] = sleep,
) -> UploadQueryability:
    if expected_upload_rows <= 0:
        raise ValueError("Zero-row uploads are not supported")
    if timeout_seconds <= 0 or poll_seconds <= 0:
        raise ValueError("Queryability timeout and poll interval must be positive")

    deadline = clock() + timeout_seconds
    while True:
        observation = observe()
        if observation.matches(expected_upload_rows):
            return observation
        if clock() >= deadline:
            raise TimeoutError(
                f"Upload did not become queryable within {timeout_seconds}s: "
                f"expected_upload_rows={expected_upload_rows}, last_observation={observation}"
            )
        pause(poll_seconds)


def run_upload_lifecycle(
    process: Callable[[], dict[str, Any]],
    wait: Callable[[int], None],
    persist: Callable[[str, dict[str, Any] | None, str | None], None],
) -> tuple[dict[str, Any], str]:
    try:
        result = process()
        rows_written = int(result.get("rows_written", 0))
        if rows_written <= 0:
            raise ValueError("Zero-row uploads are not supported")
        wait(rows_written)

        status = "partial" if int(result.get("files_failed", 0)) > 0 else "completed"
        persist(status, result, None)
        return result, "partial" if status == "partial" else "success"
    except Exception as error:
        try:
            persist("failed", None, str(error))
        except Exception as persistence_error:
            raise error from persistence_error
        raise
