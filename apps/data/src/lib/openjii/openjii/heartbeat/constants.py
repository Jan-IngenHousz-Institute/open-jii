"""Names and namespaces shared by the heartbeat task and its tests."""

from __future__ import annotations

# The forwarder's IAM condition admits exactly these namespaces; a datapoint
# published under any other is dropped without an error.
DATA_NAMESPACE = "OpenJII/Data"
USAGE_NAMESPACE = "OpenJII/Usage"

# Emitted on every run purely so its absence can alarm; carries no threshold
COLLECTOR_HEARTBEAT_METRIC = "CollectorHeartbeat"

# Minutes since gold last materialized. Deviation-based rather than fixed
# threshold: the centrum pipeline runs on different schedules per environment
GOLD_AGE_METRIC = "GoldMaterializationAgeMinutes"

# Minutes since the public metrics tables were last computed. A fixed
# threshold works here: the scheduler runs every fifteen minutes everywhere.
METRICS_AGE_METRIC = "MetricsPipelineAgeMinutes"

STALE_EXPERIMENTS_METRIC = "StaleExperimentsCount"
SILENT_DEVICES_METRIC = "SilentDevicesCount"
INGEST_BAD_PAYLOAD_RATE_METRIC = "IngestBadPayloadRate"

MEASUREMENTS_24H_METRIC = "Measurements24h"
ACTIVE_DEVICES_30D_METRIC = "ActiveDevices30d"

# Rolling 7-day counters for the weekly report. Rolling rather than calendar
# weeks, so the value a week ago is last week's figure and the change between
# the two is the week-over-week change.
MEASUREMENTS_7D_METRIC = "Measurements7d"
ACTIVE_DEVICES_7D_METRIC = "ActiveDevices7d"
ACTIVE_EXPERIMENTS_7D_METRIC = "ActiveExperiments7d"
ACTIVE_CONTRIBUTORS_7D_METRIC = "ActiveContributors7d"

# The data path, one half hour at a time: rows through each stage, how long
# each hop took at p95, what is waiting for macros, and how long since each
# stage last wrote. Rows are counted per half hour, so they add up over a day.
INGESTED_ROWS_METRIC = "IngestedRows"
EXPERIMENT_ROWS_METRIC = "ExperimentRows"
MACRO_RESULT_ROWS_METRIC = "MacroResultRows"
INGEST_LATENCY_METRIC = "IngestLatencyP95Seconds"
EXPERIMENT_LATENCY_METRIC = "ExperimentLatencyP95Seconds"
MACRO_LATENCY_METRIC = "MacroLatencyP95Seconds"
# From the IoT broker receiving a message to its row being readable through the API, for rows that
# came through the broker; imports and large payloads never pass it.
BROKER_TO_API_LATENCY_METRIC = "BrokerToApiP95Seconds"
MACRO_BACKLOG_METRIC = "MacroBacklogRows"
INGEST_IDLE_METRIC = "IngestIdleMinutes"
MACRO_IDLE_METRIC = "MacroIdleMinutes"

# How long a half-hour bucket is, and how long before it a gold row may have
# committed and still be matched to a macro result committed inside it.
PATH_BUCKET_MINUTES = 30
PATH_MACRO_LOOKBACK_MINUTES = 120

STALE_EXPERIMENTS_DETAIL = "stale_experiments"
SILENT_DEVICES_DETAIL = "silent_devices"

# Key prefix the metrics-forwarder Lambda subscribes to
HEARTBEAT_KEY_PREFIX = "heartbeat"

# Rosters ride along in the same file for whoever is triaging; cap them so a
# fleet-wide outage cannot write an unbounded object
MAX_DETAIL_ROWS = 50
