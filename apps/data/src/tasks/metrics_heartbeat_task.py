# Databricks notebook source
# DBTITLE 1,Platform Heartbeat Export
# Exports lakehouse observability and usage signals for the platform heartbeat.
#
# Writes one NDJSON object per run to the heartbeat S3 location. An S3 event
# invokes the metrics-forwarder Lambda, which turns "metric" lines into
# CloudWatch datapoints; "detail" roster lines stay in the file for the
# openjii-triage skill and whoever is holding an incident.
#
# The file's absence is itself the alarm: CollectorHeartbeat stops arriving and
# the dead-man rule fires. Every other reading is best effort, so a table that
# is missing or failing costs its own lines and nothing else.

# COMMAND ----------

# DBTITLE 1,Imports and configuration
import json
from collections.abc import Callable
from datetime import datetime, timezone

from openjii.heartbeat import (
    ACTIVE_DEVICES_30D_METRIC,
    COLLECTOR_HEARTBEAT_METRIC,
    DATA_NAMESPACE,
    GOLD_AGE_METRIC,
    INGEST_BAD_PAYLOAD_RATE_METRIC,
    MAX_DETAIL_ROWS,
    MEASUREMENTS_24H_METRIC,
    METRICS_AGE_METRIC,
    SILENT_DEVICES_DETAIL,
    SILENT_DEVICES_METRIC,
    STALE_EXPERIMENTS_DETAIL,
    STALE_EXPERIMENTS_METRIC,
    USAGE_NAMESPACE,
    detail,
    heartbeat_key,
    minutes_since,
    observation,
    to_ndjson,
)
from openjii.metrics import (
    ACTIVITY_WINDOW_DAYS,
    ACTIVITY_WINDOWS_TABLE,
    OPS_DEVICE_SILENCE_TABLE,
    OPS_INGEST_QUALITY_TABLE,
)
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

spark = SparkSession.builder.getOrCreate()

# Registered before they are read so a hand run in the workspace shows them.
# An empty value fails loudly: a defaulted environment would label datapoints
# with the wrong one, which is worse than no datapoints.
WIDGETS = ("CATALOG_NAME", "CENTRAL_SCHEMA", "METRICS_SCHEMA", "ENVIRONMENT", "HEARTBEAT_LOCATION")
for name in WIDGETS:
    dbutils.widgets.text(name, "")


def required_widget(name: str) -> str:
    value = dbutils.widgets.get(name).strip()
    if not value:
        raise ValueError(f"widget {name} is required and empty")
    return value


CATALOG_NAME = required_widget("CATALOG_NAME")
CENTRAL_SCHEMA = required_widget("CENTRAL_SCHEMA")
METRICS_SCHEMA = required_widget("METRICS_SCHEMA")
ENVIRONMENT = required_widget("ENVIRONMENT")
HEARTBEAT_LOCATION = required_widget("HEARTBEAT_LOCATION")

EXPERIMENT_STATUS = f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.experiment_status"
ACTIVITY_WINDOWS = f"{CATALOG_NAME}.{METRICS_SCHEMA}.{ACTIVITY_WINDOWS_TABLE}"
DEVICE_SILENCE = f"{CATALOG_NAME}.{METRICS_SCHEMA}.{OPS_DEVICE_SILENCE_TABLE}"
INGEST_QUALITY = f"{CATALOG_NAME}.{METRICS_SCHEMA}.{OPS_INGEST_QUALITY_TABLE}"


# Databricks captures driver stdout; the logging module is often swallowed in jobs
def log(msg: str, level: str = "INFO"):
    print(f"[{level}] {msg}", flush=True)


def data_point(metric: str, value: float, now: datetime, unit: str = "Count") -> dict:
    return observation(metric, value, DATA_NAMESPACE, now, ENVIRONMENT, unit)


def usage_point(metric: str, value: float, now: datetime) -> dict:
    return observation(metric, value, USAGE_NAMESPACE, now, ENVIRONMENT, "Count")


# COMMAND ----------

# DBTITLE 1,Collectors
def collect_experiment_status(now: datetime) -> list[dict]:
    """Gold materialization age and the stale-experiment roster.

    experiment_status only recomputes when the centrum pipeline runs, so the
    newest status_updated_at doubles as "when gold last materialized".

    experiment_status marks every experiment that ever finished as stale, so
    the count and roster are limited to experiments that received data inside
    the activity window: those are the ones that stopped, not the ones that
    ended. Newest to go quiet first, since that is the one someone can act on.
    """
    in_window = f"latest_processed_timestamp >= current_timestamp() - INTERVAL {ACTIVITY_WINDOW_DAYS} DAYS"

    totals = spark.sql(f"""
        SELECT
            COUNT(*) AS experiments,
            COUNT_IF(status = 'stale' AND {in_window}) AS stale,
            MAX(status_updated_at) AS last_materialized
        FROM {EXPERIMENT_STATUS}
    """).first()

    if totals is None or totals["experiments"] == 0:
        log("experiment_status is empty; emitting no freshness metrics", "WARN")
        return []

    records = []

    age = minutes_since(totals["last_materialized"], now)
    if age is not None:
        records.append(data_point(GOLD_AGE_METRIC, age, now, "None"))

    records.append(data_point(STALE_EXPERIMENTS_METRIC, totals["stale"], now))

    roster = spark.sql(f"""
        SELECT experiment_id, latest_processed_timestamp
        FROM {EXPERIMENT_STATUS}
        WHERE status = 'stale' AND {in_window}
        ORDER BY latest_processed_timestamp DESC
        LIMIT {MAX_DETAIL_ROWS}
    """).collect()
    records.append(
        detail(STALE_EXPERIMENTS_DETAIL, [row.asDict() for row in roster], total=totals["stale"])
    )

    return records


def collect_metrics_tables(now: datetime) -> list[dict]:
    """Public-table freshness and the two usage gauges, from one row.

    activity_windows is rewritten on every metrics refresh, so its computed_at
    is when the public page's numbers were last true.
    """
    row = spark.table(ACTIVITY_WINDOWS).first()
    if row is None:
        log("activity_windows is empty; emitting no metrics-table signals", "WARN")
        return []

    records = []

    age = minutes_since(row["computed_at"], now)
    if age is not None:
        records.append(data_point(METRICS_AGE_METRIC, age, now, "None"))

    records.append(usage_point(MEASUREMENTS_24H_METRIC, row["measurements_24h"], now))
    records.append(usage_point(ACTIVE_DEVICES_30D_METRIC, row["devices_30d"], now))

    return records


def collect_device_silence(now: datetime) -> list[dict]:
    """Silent-device count plus the roster, longest quiet first."""
    silent = spark.table(DEVICE_SILENCE)
    total = silent.count()

    roster = silent.orderBy(F.col("silent_for_minutes").desc()).limit(MAX_DETAIL_ROWS).collect()

    return [
        data_point(SILENT_DEVICES_METRIC, total, now),
        detail(SILENT_DEVICES_DETAIL, [row.asDict() for row in roster], total=total),
    ]


def collect_ingest_quality(now: datetime) -> list[dict]:
    """Bad-payload share of the last day's ingest, as a percentage."""
    row = spark.table(INGEST_QUALITY).first()
    if row is None:
        log("ops_ingest_quality is empty; emitting no quality signal", "WARN")
        return []

    return [data_point(INGEST_BAD_PAYLOAD_RATE_METRIC, round(row["bad_rate"] * 100, 2), now, "Percent")]


# COMMAND ----------

# DBTITLE 1,Write the heartbeat file
now = datetime.now(timezone.utc)

# Emitted first and unconditionally: this datapoint is the liveness proof whose
# absence the dead-man rule alarms on, so it must survive an empty lakehouse.
records = [data_point(COLLECTOR_HEARTBEAT_METRIC, 1, now)]

collectors: list[tuple[str, Callable[[datetime], list[dict]]]] = [
    ("experiment_status", collect_experiment_status),
    ("metrics_tables", collect_metrics_tables),
    ("device_silence", collect_device_silence),
    ("ingest_quality", collect_ingest_quality),
]

# A collector that raises (a table not built yet, a schema change, a transient
# read failure) forfeits its own lines. The file still lands, so the dead-man
# stays quiet and the digest reports the missing series by name.
for collector_name, collector in collectors:
    try:
        records.extend(collector(now))
    except Exception as error:  # noqa: BLE001
        log(f"{collector_name} failed: {error}", "WARN")

target = f"{HEARTBEAT_LOCATION.rstrip('/')}/{heartbeat_key(now)}"
dbutils.fs.put(target, to_ndjson(records), overwrite=True)

log(f"wrote {len(records)} records to {target}")
dbutils.notebook.exit(json.dumps({"status": "ok", "records": len(records), "path": target}))
