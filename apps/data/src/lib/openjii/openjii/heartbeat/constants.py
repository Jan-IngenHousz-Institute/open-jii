"""Names and namespaces shared by the heartbeat task and its tests."""

from __future__ import annotations

DATA_NAMESPACE = "OpenJII/Data"

# Emitted on every run purely so its absence can alarm; carries no threshold
COLLECTOR_HEARTBEAT_METRIC = "CollectorHeartbeat"

# Minutes since gold last materialized. Deviation-based rather than fixed
# threshold: the centrum pipeline runs on different schedules per environment
GOLD_AGE_METRIC = "GoldMaterializationAgeMinutes"

STALE_EXPERIMENTS_METRIC = "StaleExperimentsCount"

STALE_EXPERIMENTS_DETAIL = "stale_experiments"

# Key prefix the metrics-forwarder Lambda subscribes to
HEARTBEAT_KEY_PREFIX = "heartbeat"

# Rosters ride along in the same file for the digest composer; cap them so a
# fleet-wide outage cannot write an unbounded object
MAX_DETAIL_ROWS = 50
