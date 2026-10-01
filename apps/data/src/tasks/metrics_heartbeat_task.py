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
import os
from datetime import datetime, timedelta, timezone

from openjii.heartbeat import (
    ACTIVE_CONTRIBUTORS_7D_METRIC,
    ACTIVE_DEVICES_7D_METRIC,
    ACTIVE_DEVICES_30D_METRIC,
    ACTIVE_EXPERIMENTS_7D_METRIC,
    BROKER_TO_API_LATENCY_METRIC,
    COLLECTOR_HEARTBEAT_METRIC,
    DATA_NAMESPACE,
    DRIVER_OLD_GEN_METRIC,
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
    SILENT_DEVICES_DETAIL,
    SILENT_DEVICES_METRIC,
    STALE_EXPERIMENTS_DETAIL,
    STALE_EXPERIMENTS_METRIC,
    USAGE_NAMESPACE,
    detail,
    heartbeat_key,
    hop,
    latest_full_collection,
    minutes_since,
    observation,
    previous_bucket,
    run_collectors,
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
WIDGETS = ("CATALOG_NAME", "CENTRAL_SCHEMA", "METRICS_SCHEMA", "ENVIRONMENT", "HEARTBEAT_LOCATION", "PIPELINE_LOGS_PATH")
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
PIPELINE_LOGS_PATH = required_widget("PIPELINE_LOGS_PATH")

EXPERIMENT_STATUS = f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.experiment_status"
ACTIVITY_WINDOWS = f"{CATALOG_NAME}.{METRICS_SCHEMA}.{ACTIVITY_WINDOWS_TABLE}"
DEVICE_SILENCE = f"{CATALOG_NAME}.{METRICS_SCHEMA}.{OPS_DEVICE_SILENCE_TABLE}"
INGEST_QUALITY = f"{CATALOG_NAME}.{METRICS_SCHEMA}.{OPS_INGEST_QUALITY_TABLE}"
RAW_DATA = f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.raw_data"
EXPERIMENT_RAW_DATA = f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.experiment_raw_data"
EXPERIMENT_MACRO_DATA = f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.experiment_macro_data"

# A bucket starts at most an hour back. The pipelines commit every few seconds,
# so this reaches about ninety minutes in prod, and commit_versions raises
# rather than undercount when it falls short.
HISTORY_DEPTH = 1000

# A row processed this recently is in flight to its macros, not waiting.
MACRO_IN_FLIGHT_MINUTES = 15

# A driver with no full collection this recent is under no memory pressure, or has stopped.
# CloudWatch also refuses datapoints older than two weeks, which a stopped pipeline's log would be.
DRIVER_GC_MAX_AGE = timedelta(hours=1)


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

    experiment_status is a view over gold, so its newest latest_processed_timestamp
    is when gold last received a row.

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
            MAX(latest_processed_timestamp) AS last_materialized
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
    in_window = (
        f"operation = 'STREAMING UPDATE' AND timestamp >= {sql_time(start)} AND timestamp < {sql_time(end)}"
    )
    row = spark.sql(f"""
        SELECT min(version) FILTER (WHERE {in_window}) AS lo,
               max(version) FILTER (WHERE {in_window}) AS hi,
               count(*) = {HISTORY_DEPTH} AND min(timestamp) > {sql_time(start)} AS falls_short
        FROM (DESCRIBE HISTORY {table} LIMIT {HISTORY_DEPTH})
    """).first()
    if row["falls_short"]:
        raise RuntimeError(f"the last {HISTORY_DEPTH} commits of {table} do not reach back to {start}")
    if row["lo"] is None:
        return None
    return row["lo"], row["hi"]


def idle_minutes(table: str) -> float | None:
    """Minutes since the stage last committed rows, measured at query time: the
    pipelines commit every few seconds, so against the run's start this would
    read negative. A streaming table only commits when rows arrive, so this
    reads as a stall only beside data still arriving."""
    row = spark.sql(f"""
        SELECT round((unix_millis(current_timestamp()) - unix_millis(max(timestamp))) / 60000, 1) AS idle
        FROM (DESCRIBE HISTORY {table} LIMIT {HISTORY_DEPTH})
        WHERE operation = 'STREAMING UPDATE'
    """).first()
    return row["idle"]


# The data path runs as one collector per stage, so a stage that fails costs
# its own series and the others still report.
def collect_ingest(now: datetime) -> list[dict]:
    """Rows into bronze in the last closed half hour, and p95 from each row's
    Kinesis arrival to its ingestion."""
    start, end = previous_bucket(now, PATH_BUCKET_MINUTES)

    bronze = spark.sql(f"""
        SELECT count(*) AS rows,
               percentile(unix_millis(ingestion_timestamp) - unix_millis(kinesis_arrival_time), 0.95) / 1000 AS p95
        FROM {RAW_DATA}
        WHERE ingest_date BETWEEN date'{start:%Y-%m-%d}' AND date'{end:%Y-%m-%d}'
          AND ingestion_timestamp >= {sql_time(start)} AND ingestion_timestamp < {sql_time(end)}
    """).first()

    return hop(INGESTED_ROWS_METRIC, INGEST_LATENCY_METRIC, bronze["rows"], bronze["p95"], start, DATA_NAMESPACE, ENVIRONMENT)


def collect_experiment_rows(now: datetime) -> list[dict]:
    """Rows committed to the experiment table in the last closed half hour, and
    p95 from each batch's processing to its commit."""
    start, end = previous_bucket(now, PATH_BUCKET_MINUTES)

    versions = commit_versions(EXPERIMENT_RAW_DATA, start, end)
    if versions is None:
        return hop(EXPERIMENT_ROWS_METRIC, EXPERIMENT_LATENCY_METRIC, 0, None, start, DATA_NAMESPACE, ENVIRONMENT)

    gold = spark.sql(f"""
        SELECT count(*) AS rows,
               percentile(unix_millis(_commit_timestamp) - unix_millis(processed_timestamp), 0.95) / 1000 AS p95
        FROM table_changes('{EXPERIMENT_RAW_DATA}', {versions[0]}, {versions[1]})
        WHERE _change_type = 'insert'
    """).first()

    return hop(EXPERIMENT_ROWS_METRIC, EXPERIMENT_LATENCY_METRIC, gold["rows"], gold["p95"], start, DATA_NAMESPACE, ENVIRONMENT)


def collect_broker_to_api(now: datetime) -> list[dict]:
    """The whole trip in one number: p95 from the IoT broker receiving a message
    to its row committing in the experiment table the API reads, for rows
    committed in the last closed half hour."""
    start, end = previous_bucket(now, PATH_BUCKET_MINUTES)

    versions = commit_versions(EXPERIMENT_RAW_DATA, start, end)
    if versions is None:
        return []

    trip = spark.sql(f"""
        SELECT percentile(unix_millis(_commit_timestamp) - unix_millis(arrival_timestamp), 0.95) / 1000 AS p95
        FROM table_changes('{EXPERIMENT_RAW_DATA}', {versions[0]}, {versions[1]})
        WHERE _change_type = 'insert' AND arrival_timestamp IS NOT NULL
    """).first()
    if trip["p95"] is None:
        return []

    return [observation(BROKER_TO_API_LATENCY_METRIC, round(trip["p95"], 1), DATA_NAMESPACE, start, ENVIRONMENT, "Seconds")]


def collect_macro_results(now: datetime) -> list[dict]:
    """Macro results committed in the last closed half hour, and p95 from each
    source row's commit to its result's.

    After an outage a result's source row can be any age, so the source commits
    are found by row tracking's commit version rather than a fixed lookback. Row
    ids can repeat across the table's history, so a result is matched to its
    source by id and processing time together.
    """
    start, end = previous_bucket(now, PATH_BUCKET_MINUTES)

    versions = commit_versions(EXPERIMENT_MACRO_DATA, start, end)
    if versions is None:
        return hop(MACRO_RESULT_ROWS_METRIC, MACRO_LATENCY_METRIC, 0, None, start, DATA_NAMESPACE, ENVIRONMENT)

    results = f"""
        SELECT raw_id, processed_timestamp, _commit_timestamp AS at
        FROM table_changes('{EXPERIMENT_MACRO_DATA}', {versions[0]}, {versions[1]})
        WHERE _change_type = 'insert'
    """
    sources = spark.sql(f"""
        WITH macro AS ({results})
        SELECT count(*) AS rows,
               min(gold._metadata.row_commit_version) AS lo,
               max(gold._metadata.row_commit_version) AS hi
        FROM macro LEFT JOIN {EXPERIMENT_RAW_DATA} gold
          ON gold.id = macro.raw_id AND gold.processed_timestamp = macro.processed_timestamp
    """).first()

    p95 = None
    if sources["lo"] is not None:
        p95 = spark.sql(f"""
            WITH macro AS ({results}),
            gold AS (
                SELECT id, processed_timestamp, _commit_timestamp AS at
                FROM table_changes('{EXPERIMENT_RAW_DATA}', {sources["lo"]}, {sources["hi"]})
                WHERE _change_type = 'insert'
            )
            SELECT percentile(unix_millis(macro.at) - unix_millis(gold.at), 0.95) / 1000 AS p95
            FROM macro JOIN gold ON gold.id = macro.raw_id AND gold.processed_timestamp = macro.processed_timestamp
        """).first()["p95"]

    return hop(MACRO_RESULT_ROWS_METRIC, MACRO_LATENCY_METRIC, sources["rows"], p95, start, DATA_NAMESPACE, ENVIRONMENT)


def collect_macro_backlog(now: datetime) -> list[dict]:
    """Rows that need macros and have waited past the in-flight window without
    any result, however long ago they arrived. A failed macro still writes a
    result row, so this is zero in steady state."""
    backlog = spark.sql(f"""
        SELECT count(*) AS rows
        FROM {EXPERIMENT_RAW_DATA} r
        WHERE r.processed_timestamp < current_timestamp() - INTERVAL {MACRO_IN_FLIGHT_MINUTES} MINUTES
          AND size(r.macros) > 0
          AND NOT coalesce(r.skip_macro_processing, false)
          AND NOT EXISTS (SELECT 1 FROM {EXPERIMENT_MACRO_DATA} m WHERE m.raw_id = r.id)
    """).first()

    return [data_point(MACRO_BACKLOG_METRIC, backlog["rows"], now)]


def collect_path_idle(now: datetime) -> list[dict]:
    """Minutes since bronze and the macro results last wrote."""
    records = []
    for metric, table in ((INGEST_IDLE_METRIC, RAW_DATA), (MACRO_IDLE_METRIC, EXPERIMENT_MACRO_DATA)):
        idle = idle_minutes(table)
        if idle is not None:
            records.append(data_point(metric, idle, now, "None"))

    return records


def collect_driver_heap(now: datetime) -> list[dict]:
    """How full each classic pipeline's driver left its old generation at its
    latest full collection, stamped when that collection ran."""
    records = []
    for pipeline in sorted(os.listdir(PIPELINE_LOGS_PATH)):
        collection = latest_full_collection(os.path.join(PIPELINE_LOGS_PATH, pipeline))
        if collection is None or now - collection.at > DRIVER_GC_MAX_AGE:
            continue
        records.append(
            observation(
                DRIVER_OLD_GEN_METRIC,
                collection.old_gen_percent,
                DATA_NAMESPACE,
                collection.at,
                ENVIRONMENT,
                "Percent",
                {"Pipeline": pipeline},
            )
        )

    return records


# COMMAND ----------

# DBTITLE 1,Write the heartbeat file
now = datetime.now(timezone.utc)

# Emitted first and unconditionally: this datapoint is the liveness proof whose
# absence the dead-man rule alarms on, so it must survive an empty lakehouse.
records = [data_point(COLLECTOR_HEARTBEAT_METRIC, 1, now)]

collectors = [
    ("experiment_status", collect_experiment_status),
    ("metrics_tables", collect_metrics_tables),
    ("device_silence", collect_device_silence),
    ("ingest_quality", collect_ingest_quality),
    ("ingest", collect_ingest),
    ("experiment_rows", collect_experiment_rows),
    ("broker_to_api", collect_broker_to_api),
    ("macro_results", collect_macro_results),
    ("macro_backlog", collect_macro_backlog),
    ("path_idle", collect_path_idle),
    ("driver_heap", collect_driver_heap),
]
records.extend(run_collectors(collectors, now, ENVIRONMENT, log))

target = f"{HEARTBEAT_LOCATION.rstrip('/')}/{heartbeat_key(now)}"
dbutils.fs.put(target, to_ndjson(records), overwrite=True)

log(f"wrote {len(records)} records to {target}")
dbutils.notebook.exit(json.dumps({"status": "ok", "records": len(records), "path": target}))
