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

STALE_EXPERIMENTS_DETAIL = "stale_experiments"
SILENT_DEVICES_DETAIL = "silent_devices"

# Key prefix the metrics-forwarder Lambda subscribes to
HEARTBEAT_KEY_PREFIX = "heartbeat"

# Rosters ride along in the same file for whoever is triaging; cap them so a
# fleet-wide outage cannot write an unbounded object
MAX_DETAIL_ROWS = 50
