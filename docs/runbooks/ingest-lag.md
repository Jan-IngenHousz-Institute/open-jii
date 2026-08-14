# ingest-lag

Kinesis GetRecords iterator age is climbing: producers write, but the Databricks consumer is behind or not running. Nothing is lost while age < stream retention (24h), but gold tables and experiment freshness fall behind.

Likely causes: centrum DLT pipeline stalled/failed (check dlt-heartbeat too); cluster capacity failure (spot); Unity Catalog credential for Kinesis broken; pipeline paused by a human.

First moves: DLT pipeline UI last update state; if update failures, read the event log error; a plain retry with on-demand compute clears capacity issues. Age drains on its own once consumption resumes.
