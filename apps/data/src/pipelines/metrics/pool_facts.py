# Databricks notebook source
# DBTITLE 1,Metrics - Pool Facts
# Public metrics: one row of scalar facts feeding the rotating caption pool.

# COMMAND ----------
import dlt
from pyspark.sql import Window
from pyspark.sql import functions as F

from openjii.metrics import ACTIVITY_WINDOW_DAYS, POOL_FACTS_TABLE, within_plausible_range
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=POOL_FACTS_TABLE,
    comment="Public metrics: scalar facts for the rotating caption pool.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def pool_facts():
    """One row: session size, endurance, simultaneity, zones, arrival gap."""
    now = F.current_timestamp()

    plausible = spark.table(centrum_table(SILVER_TABLE)).filter(
        within_plausible_range(F.col("timestamp"), now)
    )

    session_median = (
        plausible.filter(F.col("workbook_run_id").isNotNull())
        .groupBy("workbook_run_id")
        .agg(F.count("*").alias("session_size"))
        .agg(F.percentile_approx("session_size", 0.5).alias("session_median_measurements"))
    )

    # Longest unbroken run of consecutive days with data for a single device:
    # group consecutive dates via the date-minus-row-number trick.
    device_days = (
        plausible.filter(F.col("device_id").isNotNull())
        .select("device_id", "date")
        .distinct()
    )
    run_key = F.date_sub(
        F.col("date"), F.row_number().over(Window.partitionBy("device_id").orderBy("date")) - 1
    )
    endurance = (
        device_days.withColumn("run_key", run_key)
        .groupBy("device_id", "run_key")
        .agg(F.count("*").alias("run_days"))
        .agg(F.max("run_days").alias("device_endurance_days"))
    )

    in_window = F.col("timestamp") >= now - F.expr(f"INTERVAL {ACTIVITY_WINDOW_DAYS} DAYS")
    simultaneity = (
        plausible.filter(in_window)
        .filter(F.col("device_id").isNotNull())
        .groupBy(F.date_trunc("minute", F.col("timestamp")).alias("minute"))
        .agg(F.countDistinct("device_id").alias("devices_at_once"))
        .agg(F.max("devices_at_once").alias("simultaneity_peak_devices"))
    )

    # The interval between measurements across the span they actually cover.
    # A median gap reads as zero here: ingest arrives in bulk, so most
    # consecutive measurements share a millisecond. The span is measured from
    # the first and last measurement rather than assumed to be the window.
    arrival_gap = (
        plausible.filter(in_window)
        .agg(
            F.count("*").alias("arrivals"),
            F.min("timestamp").alias("first_arrival"),
            F.max("timestamp").alias("last_arrival"),
        )
        .select(
            F.when(
                F.col("arrivals") > 1,
                (
                    F.col("last_arrival").cast("double") - F.col("first_arrival").cast("double")
                )
                / F.col("arrivals"),
            ).alias("mean_arrival_gap_seconds")
        )
    )

    # Consecutive days with data counted back from the newest, by the same
    # date-minus-row-number grouping as device endurance.
    active_days = plausible.select("date").distinct()
    streak_key = F.date_sub(
        F.col("date"), F.row_number().over(Window.orderBy("date")) - 1
    )
    runs = (
        active_days.withColumn("run_key", streak_key)
        .groupBy("run_key")
        .agg(F.count("*").alias("run_days"), F.max("date").alias("run_end"))
    )
    # Runs are maximal, so at most one can end today or yesterday; a run
    # that ended earlier is a past streak, not a current one.
    current_streak = runs.agg(
        F.coalesce(
            F.max(
                F.when(F.datediff(F.to_date(now), F.col("run_end")) <= 1, F.col("run_days"))
            ),
            F.lit(0),
        ).alias("current_streak_days")
    )

    timezones = plausible.filter(F.col("timezone").isNotNull()).agg(
        F.countDistinct("timezone").alias("timezones_all_time")
    )
    timezones_peak = (
        plausible.filter(F.col("timezone").isNotNull())
        .groupBy("date")
        .agg(F.countDistinct("timezone").alias("zones"))
        .agg(F.max("zones").alias("timezones_peak_day"))
    )

    return (
        session_median.crossJoin(endurance)
        .crossJoin(simultaneity)
        .crossJoin(timezones)
        .crossJoin(timezones_peak)
        .crossJoin(arrival_gap)
        .crossJoin(current_streak)
        .withColumn("computed_at", now)
    )
