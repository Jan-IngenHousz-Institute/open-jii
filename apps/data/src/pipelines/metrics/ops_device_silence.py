# Databricks notebook source
# DBTITLE 1,Metrics - Ops Device Silence
# Ops table: devices that were publishing in the activity window and have
# gone quiet for longer than their own cadence explains. Read by the heartbeat
# export only. Every row is a device id, so the public endpoint must not
# expose this table.

# COMMAND ----------
import dlt
from pyspark.sql import Window
from pyspark.sql import functions as F

from openjii.centrum import DEVICE_LAST_ACTIVITY_TABLE
from openjii.metrics import (
    ACTIVITY_WINDOW_DAYS,
    DEVICE_SILENCE_CADENCE_MULTIPLIER,
    DEVICE_SILENCE_FLOOR_MINUTES,
    OPS_DEVICE_SILENCE_TABLE,
    within_plausible_range,
)
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=OPS_DEVICE_SILENCE_TABLE,
    comment="Ops: devices quiet for longer than their own publish cadence explains.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def ops_device_silence():
    """One row per silent device.

    Cadence is the median gap between a device's consecutive arrivals in the
    activity window, so a daily logger and a ten-second logger are each judged
    against their own rhythm. A device with a single measurement has no cadence
    and is judged against the floor alone.

    Arrival time (processed_timestamp) rather than the payload's own clock: a
    device with a drifted RTC would otherwise read as permanently silent while
    publishing normally, which is what experiment_status already avoids.
    """
    now = F.current_timestamp()
    by_device = Window.partitionBy("client_id").orderBy("processed_timestamp")

    cadence = (
        spark.table(centrum_table(SILVER_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .filter(F.col("processed_timestamp") >= now - F.expr(f"INTERVAL {ACTIVITY_WINDOW_DAYS} DAYS"))
        .filter(F.col("client_id").isNotNull())
        .withColumn("previous_at", F.lag("processed_timestamp").over(by_device))
        .withColumn(
            "gap_seconds",
            F.unix_timestamp("processed_timestamp") - F.unix_timestamp("previous_at"),
        )
        .groupBy("client_id")
        .agg(
            F.percentile_approx("gap_seconds", 0.5).alias("median_interval_seconds"),
            F.max("processed_timestamp").alias("last_data_at"),
        )
    )

    connectivity = spark.table(centrum_table(DEVICE_LAST_ACTIVITY_TABLE)).select(
        "client_id", "last_event_type", "last_event_at"
    )

    floor_seconds = F.lit(DEVICE_SILENCE_FLOOR_MINUTES * 60)
    allowed_quiet_seconds = F.greatest(
        floor_seconds,
        F.coalesce(
            F.col("median_interval_seconds") * DEVICE_SILENCE_CADENCE_MULTIPLIER,
            floor_seconds,
        ),
    )
    quiet_seconds = F.unix_timestamp(now) - F.unix_timestamp("last_data_at")

    return (
        cadence.join(connectivity, on="client_id", how="left")
        .withColumn("quiet_seconds", quiet_seconds)
        .filter(F.col("quiet_seconds") > allowed_quiet_seconds)
        .select(
            "client_id",
            "last_data_at",
            "median_interval_seconds",
            (F.col("quiet_seconds") / 60).cast("long").alias("silent_for_minutes"),
            # Devices with no lifecycle event (Cognito publishers) are unknown, not
            # disconnected; false keeps the roster boolean rather than tri-state.
            F.coalesce(F.col("last_event_type") == "connected", F.lit(False)).alias(
                "silent_while_connected"
            ),
            "last_event_at",
        )
        .withColumn("computed_at", now)
    )
