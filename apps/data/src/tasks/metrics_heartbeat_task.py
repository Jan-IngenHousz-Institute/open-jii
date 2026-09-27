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
from datetime import datetime, timedelta, timezone

from openjii.heartbeat import (
    ACTIVE_CONTRIBUTORS_7D_METRIC,
    ACTIVE_DEVICES_7D_METRIC,
    ACTIVE_DEVICES_30D_METRIC,
    ACTIVE_EXPERIMENTS_7D_METRIC,
    BROKER_TO_API_LATENCY_METRIC,
    COLLECTOR_HEARTBEAT_METRIC,
    DATA_NAMESPACE,
    EXPERIMENT_LATENCY_METRIC,
    EXPERIMENT_ROWS_METRIC,
    GOLD_AGE_METRIC,
    INGEST_BAD_PAYLOAD_RATE_METRIC,
    INGEST_IDLE_METRIC,
    INGEST_LATENCY_METRIC,
    INGESTED_ROWS_METRIC,
    MACRO_BACKLOG_METRIC,
    MACRO_IDLE_METRIC,
    MACRO_LATENCY_METRIC,
    MACRO_RESULT_ROWS_METRIC,
    MAX_DETAIL_ROWS,
    MEASUREMENTS_7D_METRIC,
    MEASUREMENTS_24H_METRIC,
    METRICS_AGE_METRIC,
    PATH_BUCKET_MINUTES,
    PATH_MACRO_LOOKBACK_MINUTES,
    SILENT_DEVICES_DETAIL,
    SILENT_DEVICES_METRIC,
    STALE_EXPERIMENTS_DETAIL,
    STALE_EXPERIMENTS_METRIC,
    USAGE_NAMESPACE,
    detail,
    heartbeat_key,
    hop,
    minutes_since,
    observation,
    previous_bucket,
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
RAW_DATA = f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.raw_data"
EXPERIMENT_RAW_DATA = f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.experiment_raw_data"
EXPERIMENT_MACRO_DATA = f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.experiment_macro_data"

# Enough history to cover the macro lookback at one commit a minute, and still
# find the last commit after a quiet spell.
HISTORY_DEPTH = 1000

# A row processed this recently is in flight to its macros, not waiting.
MACRO_IN_FLIGHT_MINUTES = 15


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
    """Public-table freshness and the usage gauges, from one row.

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
    records.append(usage_point(MEASUREMENTS_7D_METRIC, row["measurements_7d"], now))
    records.append(usage_point(ACTIVE_DEVICES_7D_METRIC, row["devices_7d"], now))
    records.append(usage_point(ACTIVE_EXPERIMENTS_7D_METRIC, row["experiments_7d"], now))
    records.append(usage_point(ACTIVE_CONTRIBUTORS_7D_METRIC, row["contributors_7d"], now))

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


def sql_time(value: datetime) -> str:
    return f"timestamp'{value.astimezone(timezone.utc):%Y-%m-%d %H:%M:%S}+00:00'"


def commit_versions(table: str, start: datetime, end: datetime) -> tuple[int, int] | None:
    """The streaming commits in [start, end) as a version range, or None when
    there were none. table_changes() refuses a time window with no commits, so
    the window is turned into versions first."""
    row = spark.sql(f"""
        SELECT min(version) AS lo, max(version) AS hi
        FROM (DESCRIBE HISTORY {table} LIMIT {HISTORY_DEPTH})
        WHERE operation = 'STREAMING UPDATE'
          AND timestamp >= {sql_time(start)} AND timestamp < {sql_time(end)}
    """).first()
    if row is None or row["lo"] is None:
        return None
    return row["lo"], row["hi"]


def last_write(table: str) -> datetime | None:
    """When the stage last committed rows. A streaming table only commits when
    rows arrive, so this reads as a stall only beside data still arriving."""
    row = spark.sql(f"""
        SELECT max(timestamp) AS at
        FROM (DESCRIBE HISTORY {table} LIMIT {HISTORY_DEPTH})
        WHERE operation = 'STREAMING UPDATE'
    """).first()
    return None if row is None else row["at"]


def collect_data_path(now: datetime) -> list[dict]:
    """Rows through each stage and each hop's p95 for the last closed half
    hour, the macro backlog, and how long since each end of the path wrote.

    Arrival to bronze is per row. Bronze to gold is measured from the batch's
    processing time to its commit, and gold to macro from the gold commit to
    the macro commit, matched by row id.
    """
    start, end = previous_bucket(now, PATH_BUCKET_MINUTES)
    records = []

    bronze = spark.sql(f"""
        SELECT count(*) AS rows,
               percentile(unix_millis(ingestion_timestamp) - unix_millis(kinesis_arrival_time), 0.95) / 1000 AS p95
        FROM {RAW_DATA}
        WHERE ingest_date BETWEEN date'{start:%Y-%m-%d}' AND date'{end:%Y-%m-%d}'
          AND ingestion_timestamp >= {sql_time(start)} AND ingestion_timestamp < {sql_time(end)}
    """).first()
    records += hop(INGESTED_ROWS_METRIC, INGEST_LATENCY_METRIC, bronze["rows"], bronze["p95"], start, DATA_NAMESPACE, ENVIRONMENT)

    gold_versions = commit_versions(EXPERIMENT_RAW_DATA, start, end)
    gold = {"rows": 0, "p95": None, "broker_to_api_p95": None}
    if gold_versions is not None:
        gold = spark.sql(f"""
            SELECT count(*) AS rows,
                   percentile(unix_millis(_commit_timestamp) - unix_millis(processed_timestamp), 0.95) / 1000 AS p95,
                   percentile(unix_millis(_commit_timestamp) - unix_millis(arrival_timestamp), 0.95)
                       FILTER (WHERE arrival_timestamp IS NOT NULL) / 1000 AS broker_to_api_p95
            FROM table_changes('{EXPERIMENT_RAW_DATA}', {gold_versions[0]}, {gold_versions[1]})
            WHERE _change_type = 'insert'
        """).first()
    records += hop(EXPERIMENT_ROWS_METRIC, EXPERIMENT_LATENCY_METRIC, gold["rows"], gold["p95"], start, DATA_NAMESPACE, ENVIRONMENT)
    # The whole trip in one number: the broker receiving a message to its row committing in the
    # experiment table the API reads.
    if gold["broker_to_api_p95"] is not None:
        records.append(
            observation(BROKER_TO_API_LATENCY_METRIC, round(gold["broker_to_api_p95"], 1), DATA_NAMESPACE, start, ENVIRONMENT, "Seconds")
        )

    macro_versions = commit_versions(EXPERIMENT_MACRO_DATA, start, end)
    lookback_versions = commit_versions(EXPERIMENT_RAW_DATA, start - timedelta(minutes=PATH_MACRO_LOOKBACK_MINUTES), end)
    macro = {"rows": 0, "p95": None}
    if macro_versions is not None:
        gold_source = (
            f"SELECT id, _commit_timestamp AS at FROM table_changes('{EXPERIMENT_RAW_DATA}', "
            f"{lookback_versions[0]}, {lookback_versions[1]}) WHERE _change_type = 'insert'"
            if lookback_versions is not None
            else "SELECT CAST(NULL AS BIGINT) AS id, CAST(NULL AS TIMESTAMP) AS at WHERE false"
        )
        macro = spark.sql(f"""
            WITH macro AS (
                SELECT raw_id, _commit_timestamp AS at
                FROM table_changes('{EXPERIMENT_MACRO_DATA}', {macro_versions[0]}, {macro_versions[1]})
                WHERE _change_type = 'insert'
            ),
            gold AS ({gold_source})
            SELECT count(*) AS rows,
                   percentile(unix_millis(macro.at) - unix_millis(gold.at), 0.95) / 1000 AS p95
            FROM macro LEFT JOIN gold ON gold.id = macro.raw_id
        """).first()
    records += hop(MACRO_RESULT_ROWS_METRIC, MACRO_LATENCY_METRIC, macro["rows"], macro["p95"], start, DATA_NAMESPACE, ENVIRONMENT)

    backlog = spark.sql(f"""
        SELECT count(*) AS rows
        FROM {EXPERIMENT_RAW_DATA} r
        WHERE r.processed_timestamp >= current_timestamp() - INTERVAL 12 HOURS
          AND r.processed_timestamp < current_timestamp() - INTERVAL {MACRO_IN_FLIGHT_MINUTES} MINUTES
          AND size(r.macros) > 0
          AND NOT coalesce(r.skip_macro_processing, false)
          AND NOT EXISTS (
              SELECT 1 FROM {EXPERIMENT_MACRO_DATA} m
              WHERE m.raw_id = r.id AND m.processed_timestamp >= current_timestamp() - INTERVAL 12 HOURS
          )
    """).first()
    records.append(data_point(MACRO_BACKLOG_METRIC, backlog["rows"], now))

    for metric, table in ((INGEST_IDLE_METRIC, RAW_DATA), (MACRO_IDLE_METRIC, EXPERIMENT_MACRO_DATA)):
        idle = minutes_since(last_write(table), now)
        if idle is not None:
            records.append(data_point(metric, idle, now, "None"))

    return records


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
    ("data_path", collect_data_path),
]

# A collector that raises (a table not built yet, a schema change, a transient
# read failure) forfeits its own lines. The file still lands, so the dead-man
# stays quiet and the missing series read No data on the daily report.
for collector_name, collector in collectors:
    try:
        records.extend(collector(now))
    except Exception as error:  # noqa: BLE001
        log(f"{collector_name} failed: {error}", "WARN")

target = f"{HEARTBEAT_LOCATION.rstrip('/')}/{heartbeat_key(now)}"
dbutils.fs.put(target, to_ndjson(records), overwrite=True)

log(f"wrote {len(records)} records to {target}")
dbutils.notebook.exit(json.dumps({"status": "ok", "records": len(records), "path": target}))
