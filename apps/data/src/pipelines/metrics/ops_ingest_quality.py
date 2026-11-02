# Databricks notebook source
# DBTITLE 1,Metrics - Ops Ingest Quality
# Ops table: single-row snapshot of how much of the last day's ingest was
# unusable, and why. Read by the heartbeat export only; not for the public
# endpoint.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.metrics import INGEST_QUALITY_WINDOW_HOURS, OPS_INGEST_QUALITY_TABLE
from openjii.metrics.runtime import BRONZE_TABLE, SILVER_TABLE, centrum_table

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
    """Counts over rows ingested in the window, one row per refresh.

    Reads bronze rather than silver's expectation metrics because a payload
    that fails to parse never reaches silver to be counted there. The reasons
    are the ones silver drops, cannot attribute or keeps damaged: unparseable
    JSON, no experiment in the topic or partition key, no payload timestamp,
    no device id, and a sample whose macros silver cannot read. Device status
    messages carry no timestamp by design, so they are counted apart.
    """
    now = F.current_timestamp()
    window_start = now - F.expr(f"INTERVAL {INGEST_QUALITY_WINDOW_HOURS} HOURS")

    unparseable = F.col("parsed_data").isNull()
    # Bronze coalesces two regexp_extract calls, and a non-match yields an empty
    # string rather than null, so an unroutable row is empty, never null.
    unroutable = F.col("experiment_id").isNull() | (F.length("experiment_id") == 0)
    # Ambytes publish their status with "status" where the legacy 8-segment
    # topic carries a protocol id.
    status_message = F.coalesce(F.col("parsed_data.topic").rlike(r"^(?:[^/]+/){7}status$"), F.lit(False))
    # Both exclude unparseable rows, whose fields are null for a different reason.
    missing_timestamp = F.col("parsed_data.timestamp").isNull() & ~unparseable & ~status_message
    missing_device_id = F.col("parsed_data.device_id").isNull() & ~unparseable

    bronze_counts = (
        spark.table(centrum_table(BRONZE_TABLE))
        .filter(F.col("ingestion_timestamp") >= window_start)
        .agg(
            F.count("*").alias("ingested_rows"),
            F.count_if(unparseable).alias("unparseable_rows"),
            F.count_if(unroutable).alias("unroutable_rows"),
            F.count_if(missing_timestamp).alias("missing_timestamp_rows"),
            F.count_if(missing_device_id).alias("missing_device_id_rows"),
            F.count_if(status_message).alias("status_message_rows"),
            F.count_if(unparseable | unroutable | missing_timestamp | missing_device_id).alias(
                "bronze_bad_rows"
            ),
        )
    )

    # Silver reads macros out of an array sample, so any other shape leaves the
    # list empty. Counted on silver because bronze still holds compressed samples.
    unread_macros = (
        ~F.ltrim("sample").startswith("[")
        & F.get_json_object("sample", "$.macros").isNotNull()
        & (F.size("macros") == 0)
    )
    silver_counts = (
        spark.table(centrum_table(SILVER_TABLE))
        .filter(F.col("processed_timestamp") >= window_start)
        .agg(F.count_if(unread_macros).alias("unread_macro_rows"))
    )

    return (
        bronze_counts.crossJoin(silver_counts)
        .withColumn("bad_rows", F.col("bronze_bad_rows") + F.col("unread_macro_rows"))
        .drop("bronze_bad_rows")
        .withColumn(
            "bad_rate",
            F.when(F.col("ingested_rows") > 0, F.col("bad_rows") / F.col("ingested_rows")).otherwise(
                F.lit(0.0)
            ),
        )
        .withColumn("computed_at", now)
    )
