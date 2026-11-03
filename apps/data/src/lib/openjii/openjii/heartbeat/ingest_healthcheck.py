"""How long since the ingest health check last got through to bronze, and how long it took.

The age is measured at query time, as the idle time is, so it never reads negative beside a
message that landed after the run started. It looks at every message the table holds, not a
window: a stopped path must read as old as it is rather than as no data.

The topic takes any payload from any publisher, so the age runs on Kinesis's arrival time rather
than the sender's clock, and the latency ignores a sent_at outside the plausible range.
"""

from __future__ import annotations

LATENCY_WINDOW_HOURS = 1

# A sent_at after bronze's write, or more than this far before it, is not the publisher's clock.
LATENCY_MAX_SECONDS = 3600


def ingest_healthcheck_sql(table: str, hours: int = LATENCY_WINDOW_HOURS) -> str:
    """Minutes since the newest message reached Kinesis, and p95 seconds from sending to bronze's write
    over messages written in the last `hours` whose sending is plausible. Each is null when there is
    nothing to measure."""
    return f"""
        SELECT round((unix_millis(current_timestamp()) - unix_millis(max(kinesis_arrival_time))) / 60000, 1) AS age_minutes,
               percentile(unix_millis(ingestion_timestamp) - unix_millis(sent_at), 0.95)
                   FILTER (WHERE ingestion_timestamp >= current_timestamp() - INTERVAL {hours} HOURS
                             AND unix_millis(ingestion_timestamp) - unix_millis(sent_at)
                                 BETWEEN 0 AND {LATENCY_MAX_SECONDS * 1000}) / 1000 AS p95_seconds
        FROM {table}
    """
