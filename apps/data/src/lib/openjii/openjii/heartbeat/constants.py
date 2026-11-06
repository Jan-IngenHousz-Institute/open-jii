"""Names and namespaces shared by the heartbeat task and its tests."""

from __future__ import annotations

# The forwarder's IAM condition admits exactly these namespaces; a datapoint
# published under any other is dropped without an error.
DATA_NAMESPACE = "OpenJII/Data"
USAGE_NAMESPACE = "OpenJII/Usage"

# Emitted on every run purely so its absence can alarm; carries no threshold
COLLECTOR_HEARTBEAT_METRIC = "CollectorHeartbeat"

# How many collectors raised this run. Their series read No data either way, and this tells a
# broken collector from a quiet one; the roster names each with its error.
COLLECTOR_FAILURES_METRIC = "CollectorFailures"
FAILED_COLLECTORS_DETAIL = "failed_collectors"

# Minutes since gold last materialized. Deviation-based rather than fixed
# threshold: the centrum pipeline runs on different schedules per environment
GOLD_AGE_METRIC = "GoldMaterializationAgeMinutes"

# Minutes since the public metrics tables were last computed. A fixed
# threshold works here: the scheduler runs hourly everywhere.
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
RESEARCHERS_STARTED_7D_METRIC = "ResearchersStarted7d"
LOGGERS_STARTED_7D_METRIC = "LoggersStarted7d"
# Databricks spend at list price, per platform component for a day and an ISO week, and in total
# for the month. Calendar windows rather than rolling ones, so they line up with what AWS bills
# beside them, each stamped when its window closed.
DATABRICKS_DAILY_COST_METRIC = "DatabricksDailyCostUsd"
DATABRICKS_WEEKLY_COST_METRIC = "DatabricksWeeklyCostUsd"
DATABRICKS_MONTH_TO_DATE_COST_METRIC = "DatabricksMonthToDateCostUsd"
DATABRICKS_PREVIOUS_MONTH_TO_DATE_COST_METRIC = "DatabricksPreviousMonthToDateCostUsd"
DATABRICKS_PREVIOUS_MONTH_COST_METRIC = "DatabricksPreviousMonthCostUsd"
DATABRICKS_MONTH_PROJECTED_COST_METRIC = "DatabricksMonthProjectedCostUsd"
# Yesterday's spend per component as a share of its limit, in percent; past 100 the rule fires.
DATABRICKS_DAILY_COST_PERCENT_OF_LIMIT_METRIC = "DatabricksDailyCostPercentOfLimit"
# Measurements taken in the ISO week the weekly spend covers, which it is divided over.
WEEKLY_MEASUREMENTS_METRIC = "WeeklyMeasurements"

# The data path, one half hour at a time: rows through each stage, how long
# each hop took at p95, what is waiting for macros, and how long since each
# stage last wrote. Rows are counted per half hour, so they add up over a day.
INGESTED_ROWS_METRIC = "IngestedRows"
EXPERIMENT_ROWS_METRIC = "ExperimentRows"
# Rows into the experiment table that repeat a capture it already held, such as a phone re-publish.
MEASUREMENT_COPIES_METRIC = "MeasurementCopies"
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
# Macro results that carry an error instead of output, per half hour and per Cause, and how many
# macros fail on one protocol while working on another over the last day.
MACRO_FAILED_ROWS_METRIC = "MacroFailedRows"
MACRO_PROTOCOL_FAILURES_METRIC = "MacroProtocolFailures"

# The ingest health check, a synthetic message sent through the real ingest rule every minute: minutes
# since the newest one reached Kinesis, and p95 seconds from a message's sending to bronze's write over
# the last hour. The age is unbounded, so a path stopped for a day reads a day.
HEALTHCHECK_AGE_METRIC = "HealthcheckAgeMinutes"
HEALTHCHECK_LATENCY_METRIC = "HealthcheckLatencyP95Seconds"

PATH_BUCKET_MINUTES = 30

# How full a classic pipeline driver's old generation is right after a full collection, per
# pipeline. What a full collection cannot free is memory the driver still holds.
DRIVER_OLD_GEN_METRIC = "DriverOldGenAfterFullGcPercent"

# How much of its latest logged hour a flow spent in batches, in percent, and how many of its runs
# started in it, per Pipeline and Flow. Near 100 a flow runs its batches back to back.
FLOW_BUSY_METRIC = "FlowBusyPercent"
FLOW_RESTARTS_METRIC = "FlowRestarts"
# Clusters a pipeline created in the last closed hour, per Pipeline. A pipeline that keeps replacing
# its cluster rotates no hourly log to read, so its cluster ids are all that show it.
PIPELINE_CLUSTER_STARTS_METRIC = "PipelineClusterStarts"

# The flows a streamed measurement waits on, under each pipeline's pipeline-logs folder.
WATCHED_FLOWS = {
    "centrum": ("raw_data", "clean_data", "experiment_raw_data"),
    "macro": ("experiment_macro_data",),
}

STALE_EXPERIMENTS_DETAIL = "stale_experiments"
SILENT_DEVICES_DETAIL = "silent_devices"
MACRO_PROTOCOL_FAILURES_DETAIL = "macro_protocol_failures"
FLOW_BATCHES_DETAIL = "flow_batches"

# Key prefix the metrics-forwarder Lambda subscribes to
HEARTBEAT_KEY_PREFIX = "heartbeat"

# Rosters ride along in the same file for whoever is triaging; cap them so a
# fleet-wide outage cannot write an unbounded object
MAX_DETAIL_ROWS = 50

# A Spark error runs to pages; its opening names the table and the cause.
MAX_ERROR_CHARS = 500
