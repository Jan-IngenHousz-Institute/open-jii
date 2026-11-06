"""How long since bronze last wrote a measurement.

Bronze drops the ingest health check's messages, yet each one still commits an empty micro-batch,
so its commit history fills with commits that wrote nothing. The newest row says when it last
wrote. With no row inside the look-back it has been idle for at least that long, which is past
every environment's threshold.
"""

from __future__ import annotations

IDLE_LOOKBACK_DAYS = 2


def bronze_idle_sql(table: str, days: int = IDLE_LOOKBACK_DAYS) -> str:
    """Minutes since the newest row was written, measured at query time, or the look-back in
    minutes when no row falls inside it."""
    return f"""
        SELECT coalesce(
                   round((unix_millis(current_timestamp()) - unix_millis(max(ingestion_timestamp))) / 60000, 1),
                   {days * 24 * 60}
               ) AS idle
        FROM {table}
        WHERE ingest_date >= date_sub(current_date(), {days})
    """
