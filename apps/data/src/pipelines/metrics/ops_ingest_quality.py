# Databricks notebook source
# DBTITLE 1,Metrics - Ops Ingest Quality
# Ops table: single-row snapshot of how much of the last day's ingest was
# unusable, and why. Read by the heartbeat export only; not for the public
# endpoint.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.metrics import INGEST_QUALITY_WINDOW_HOURS, OPS_INGEST_QUALITY_TABLE
from openjii.metrics.runtime import BRONZE_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=OPS_INGEST_QUALITY_TABLE,
    comment="Ops: one-row snapshot of unusable ingest in the last day, by reason.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def ops_ingest_quality():
    """Counts over bronze rows ingested in the window, one row per refresh.

    Reads bronze rather than silver's expectation metrics because a payload
    that fails to parse never reaches silver to be counted there. The reasons
    are the ones silver drops or cannot attribute: unparseable JSON, no
    experiment in the topic or partition key, and no payload timestamp.
    """
    now = F.current_timestamp()
    unparseable = F.col("parsed_data").isNull()
    # Bronze coalesces two regexp_extract calls, and a non-match yields an empty
    # string rather than null, so an unroutable row is empty, never null.
    unroutable = F.col("experiment_id").isNull() | (F.length("experiment_id") == 0)
    missing_timestamp = F.col("parsed_data.timestamp").isNull()

    return (
        spark.table(centrum_table(BRONZE_TABLE))
        .filter(
            F.col("ingestion_timestamp") >= now - F.expr(f"INTERVAL {INGEST_QUALITY_WINDOW_HOURS} HOURS")
        )
        .agg(
            F.count("*").alias("ingested_rows"),
            F.count_if(unparseable).alias("unparseable_rows"),
            F.count_if(unroutable).alias("unroutable_rows"),
            # Excludes unparseable rows, whose timestamp is null for a different reason.
            F.count_if(missing_timestamp & ~unparseable).alias("missing_timestamp_rows"),
            F.count_if(unparseable | unroutable | missing_timestamp).alias("bad_rows"),
        )
        .withColumn(
            "bad_rate",
            F.when(F.col("ingested_rows") > 0, F.col("bad_rows") / F.col("ingested_rows")).otherwise(
                F.lit(0.0)
            ),
        )
        .withColumn("computed_at", now)
    )
