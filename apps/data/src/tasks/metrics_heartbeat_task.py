# Databricks notebook source
# DBTITLE 1,Platform Heartbeat Metrics
# Publishes lakehouse observability signals for the platform heartbeat.
#
# Writes one NDJSON object per run to the heartbeat S3 location, where an S3
# event triggers the metrics-forwarder Lambda that turns "metric" lines into
# CloudWatch datapoints. Rosters stay in the file for the digest composer.
#
# The absence of a file is itself the alarm: the HeartbeatAgeMinutes datapoint
# stops arriving and the CloudWatch rule treats missing data as breaching.

# COMMAND ----------

# DBTITLE 1,Imports and configuration
from datetime import datetime, timezone

from openjii.heartbeat import (
    COLLECTOR_HEARTBEAT_METRIC,
    DATA_NAMESPACE,
    GOLD_AGE_METRIC,
    MAX_DETAIL_ROWS,
    STALE_EXPERIMENTS_DETAIL,
    STALE_EXPERIMENTS_METRIC,
    detail,
    heartbeat_key,
    minutes_since,
    observation,
    to_ndjson,
)
from pyspark.sql import SparkSession

spark = SparkSession.builder.getOrCreate()

CATALOG_NAME = dbutils.widgets.get("CATALOG_NAME")
CENTRAL_SCHEMA = dbutils.widgets.get("CENTRAL_SCHEMA")
ENVIRONMENT = dbutils.widgets.get("ENVIRONMENT")
HEARTBEAT_LOCATION = dbutils.widgets.get("HEARTBEAT_LOCATION")

EXPERIMENT_STATUS_TABLE = f"{CATALOG_NAME}.{CENTRAL_SCHEMA}.experiment_status"


# Databricks captures driver stdout; the logging module is often swallowed in jobs
def log(msg: str, level: str = "INFO"):
    print(f"[{level}] {msg}", flush=True)


# COMMAND ----------

# DBTITLE 1,Collect experiment freshness
def collect_experiment_status(now: datetime) -> list[dict]:
    """Gold materialization age and the stale-experiment roster.

    experiment_status only recomputes when the centrum pipeline runs, so the
    newest status_updated_at doubles as "when gold last materialized".
    """
    totals = spark.sql(f"""
        SELECT
            COUNT(*) AS experiments,
            COUNT_IF(status = 'stale') AS stale,
            MAX(status_updated_at) AS last_materialized
        FROM {EXPERIMENT_STATUS_TABLE}
    """).first()

    records = []

    if totals["experiments"] == 0:
        log("experiment_status is empty; emitting no freshness metrics", "WARN")
        return records

    age = minutes_since(totals["last_materialized"], now)
    records.append(observation(GOLD_AGE_METRIC, age, DATA_NAMESPACE, now, ENVIRONMENT, "Count"))
    records.append(
        observation(STALE_EXPERIMENTS_METRIC, totals["stale"], DATA_NAMESPACE, now, ENVIRONMENT, "Count")
    )

    roster = spark.sql(f"""
        SELECT experiment_id, latest_processed_timestamp
        FROM {EXPERIMENT_STATUS_TABLE}
        WHERE status = 'stale'
        ORDER BY latest_processed_timestamp ASC
        LIMIT {MAX_DETAIL_ROWS}
    """).collect()

    records.append(
        detail(
            STALE_EXPERIMENTS_DETAIL,
            [row.asDict() for row in roster],
            total=totals["stale"],
        )
    )

    return records


# COMMAND ----------

# DBTITLE 1,Write the heartbeat file
now = datetime.now(timezone.utc)

# Emitted first and unconditionally: this datapoint is the liveness proof whose
# absence the dead-man rule alarms on, so it must survive an empty lakehouse
records = [observation(COLLECTOR_HEARTBEAT_METRIC, 1, DATA_NAMESPACE, now, ENVIRONMENT, "Count")]
records.extend(collect_experiment_status(now))

target = f"{HEARTBEAT_LOCATION.rstrip('/')}/{heartbeat_key(now)}"
dbutils.fs.put(target, to_ndjson(records), overwrite=True)

log(f"wrote {len(records)} records to {target}")
dbutils.notebook.exit({"status": "ok", "records": len(records), "path": target})
