"""Macro failures, split by what failed and by protocol.

A failed macro still writes its result row, with the reason in `macro_error` and no output, so
the backlog stays at zero and the sandbox's own error count sees only crashes. The reason is free
text written by the macro itself or by the layer that failed on its way: the pipeline, the backend
or the sandbox. Those layers write fixed messages, matched here by prefix; anything else is the
macro's own error.
"""

from __future__ import annotations

MACRO_CAUSE = "macro"
INPUT_CAUSE = "input"
PLATFORM_CAUSE = "platform"
MACRO_CAUSES = (MACRO_CAUSE, INPUT_CAUSE, PLATFORM_CAUSE)

# Nothing to run: no measurement in the payload, or no macro by that id.
INPUT_ERROR_PREFIXES = (
    "empty-envelope:",
    "Invalid macro_id",
    "NULL macro_id or data",
    "Macro not found:",
    "Macro snapshot not found:",
)

# The call never reached the macro, or its result never came back intact. A raw AWS error from
# invoking the sandbox, such as a throttle, has no fixed text and counts as the macro's.
PLATFORM_ERROR_PREFIXES = (
    # The pipeline's call to the backend, a rejected one included
    "Chunk failed:",
    "Backend API error:",
    "No result returned for item",
    "Unknown error",
    # The backend's call to the sandbox
    "Invalid Lambda response payload",
    "Lambda response did not match the requested items",
    "Lambda execution failed",
    "Lambda function error:",
    # The sandbox's own handler
    "Handler error:",
    "Wrapper returned no output",
    "Wrapper returned invalid JSON",
    "Missing 'script' field",
    "Invalid base64 in 'script'",
    "'items' must be an array",
)

# A macro and protocol pair needs this many results before its failure share means anything.
MIN_PROTOCOL_ATTEMPTS = 10
PROTOCOL_FAILURE_SHARE = 0.5
PROTOCOL_WINDOW_HOURS = 24

NO_PROTOCOL = "none"


def macro_cause_sql(error_column: str = "macro_error") -> str:
    """A SQL expression naming what failed for one result row, NULL when it succeeded."""

    def matches(prefixes: tuple[str, ...]) -> str:
        return " OR ".join(f"startswith({error_column}, {_literal(prefix)})" for prefix in prefixes)

    return f"""
        CASE WHEN {error_column} IS NULL THEN NULL
             WHEN {matches(PLATFORM_ERROR_PREFIXES)} THEN '{PLATFORM_CAUSE}'
             WHEN {matches(INPUT_ERROR_PREFIXES)} THEN '{INPUT_CAUSE}'
             ELSE '{MACRO_CAUSE}'
        END
    """


def failed_rows_by_cause_sql(results: str) -> str:
    """Failed result rows per cause, from `results`, a query returning `macro_error`.

    A cause with no failures is absent.
    """
    return f"""
        SELECT cause, count(*) AS rows
        FROM (SELECT {macro_cause_sql()} AS cause FROM ({results}))
        WHERE cause IS NOT NULL
        GROUP BY cause
    """


def protocol_failures_sql(macro_table: str, raw_table: str, since: str) -> str:
    """Macro and protocol pairs that fail while the same macro works on another protocol.

    Covers results processed since `since`, a SQL timestamp. A pair fails when at least
    PROTOCOL_FAILURE_SHARE of at least MIN_PROTOCOL_ATTEMPTS results failed in the macro or its
    input. Platform failures are left out, since they fail every protocol alike and alert on
    their own. The protocol comes from the result's source row, matched by id and processing
    time, as row ids repeat across the table's history; a row without one counts as `none`.
    """
    failed = f"cause IN ('{MACRO_CAUSE}', '{INPUT_CAUSE}')"

    return f"""
        WITH results AS (
          SELECT m.macro_id, m.macro_name, m.experiment_id, m.macro_error,
                 coalesce(CAST(r.protocol_id AS STRING), '{NO_PROTOCOL}') AS protocol_id,
                 {macro_cause_sql("m.macro_error")} AS cause
          FROM {macro_table} m
          LEFT JOIN {raw_table} r ON r.id = m.raw_id AND r.processed_timestamp = m.processed_timestamp
          WHERE m.processed_timestamp >= {since}
        ),
        pairs AS (
          SELECT macro_id, protocol_id,
                 max(macro_name) AS macro_name,
                 count(*) AS attempts,
                 count_if({failed}) AS failures,
                 count(DISTINCT experiment_id) AS experiments,
                 min(CASE WHEN {failed} THEN macro_error END) AS sample_error
          FROM results
          WHERE cause IS NULL OR cause <> '{PLATFORM_CAUSE}'
          GROUP BY macro_id, protocol_id
        ),
        judged AS (
          SELECT *, failures >= attempts * {PROTOCOL_FAILURE_SHARE} AS mostly_failing
          FROM pairs
        )
        SELECT failing.macro_id, failing.macro_name, failing.protocol_id, failing.attempts,
               failing.failures, failing.experiments, failing.sample_error
        FROM judged failing
        WHERE failing.mostly_failing
          AND failing.attempts >= {MIN_PROTOCOL_ATTEMPTS}
          AND EXISTS (
            SELECT 1 FROM judged working
            WHERE working.macro_id = failing.macro_id
              AND working.protocol_id <> failing.protocol_id
              AND NOT working.mostly_failing
          )
        ORDER BY failing.failures DESC, failing.macro_id, failing.protocol_id
    """


def _literal(value: str) -> str:
    """A Spark SQL string literal. Spark joins adjacent literals, so a quote is escaped with a
    backslash rather than doubled."""
    escaped = value.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"
