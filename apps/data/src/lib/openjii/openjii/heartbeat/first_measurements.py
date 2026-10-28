"""Who took their first measurement inside the window: researchers, and loggers on their own.

Both are counted by measurement time and only inside the plausible range, as the active
counts are. A logger is a publisher with no person behind its rows, counted by its broker
identity: a calibration rig sends readings for many sensors under one identity, so counting
sensors would count every sensor it calibrates.
"""

from __future__ import annotations

from openjii.metrics.constants import MEASUREMENT_TIMESTAMP_FLOOR

FIRST_MEASUREMENT_WINDOW_DAYS = 7


def _first_measured_sql(silver_table: str, key: str, rows: str, days: int) -> str:
    return f"""
        SELECT count(*) AS started
        FROM (
          SELECT {key}, min(timestamp) AS first_at
          FROM {silver_table}
          WHERE {rows}
            AND timestamp >= TIMESTAMP'{MEASUREMENT_TIMESTAMP_FLOOR}'
            AND timestamp <= current_timestamp()
          GROUP BY {key}
        )
        WHERE first_at >= current_timestamp() - INTERVAL {days} DAYS
    """


def researchers_started_sql(silver_table: str, days: int = FIRST_MEASUREMENT_WINDOW_DAYS) -> str:
    """People whose first plausible measurement falls in the last `days` days."""
    return _first_measured_sql(silver_table, "user_id", "user_id IS NOT NULL", days)


def loggers_started_sql(silver_table: str, days: int = FIRST_MEASUREMENT_WINDOW_DAYS) -> str:
    """Publishers with no person whose first plausible measurement falls in the last `days` days."""
    return _first_measured_sql(silver_table, "client_id", "user_id IS NULL AND client_id IS NOT NULL", days)
