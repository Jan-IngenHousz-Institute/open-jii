# Databricks notebook source
# DBTITLE 1,Metrics - Daily Activity
# Public metrics: per-day activity rollup bucketed by measurement timestamp,
# so bulk imports land on their historical dates instead of the import day.

# COMMAND ----------
import dlt
from pyspark.sql import Window
from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_MACRO_DATA_TABLE, EXPERIMENT_UPLOADED_DATA_TABLE
from openjii.metrics import DAILY_ACTIVITY_TABLE, within_plausible_range
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=DAILY_ACTIVITY_TABLE,
    comment="Public metrics: daily measurement activity, bucketed by measurement date.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def daily_activity():
    """One row per date with measurement, device, experiment, macro, and
    upload activity, plus a cumulative measurement count for the growth curve."""
    now = F.current_timestamp()

    # Imported rows are the only ones flagged to skip macro processing.
    is_imported = F.coalesce(F.col("skip_macro_processing"), F.lit(False))

    measurements = (
        spark.table(centrum_table(SILVER_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .groupBy("date")
        .agg(
            F.count("*").alias("measurements"),
            F.count(F.when(~is_imported, True)).alias("live_measurements"),
            F.count(F.when(is_imported, True)).alias("imported_measurements"),
            F.countDistinct("device_id").alias("active_devices"),
            F.countDistinct("experiment_id").alias("active_experiments"),
        )
    )

    macro_executions = (
        spark.table(centrum_table(EXPERIMENT_MACRO_DATA_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .groupBy("date")
        .agg(F.count("*").alias("macro_executions"))
    )

    # Uploads are bucketed by upload time; they have no measurement timestamp.
    # uploaded_at is nullable upstream and a null bucket would reach the public
    # chart as an undated point.
    uploaded_rows = (
        spark.table(centrum_table(EXPERIMENT_UPLOADED_DATA_TABLE))
        .filter(F.col("uploaded_at").isNotNull())
        .groupBy(F.to_date("uploaded_at").alias("date"))
        .agg(F.count("*").alias("uploaded_rows"))
    )

    count_columns = [
        "measurements",
        "live_measurements",
        "imported_measurements",
        "active_devices",
        "active_experiments",
        "macro_executions",
        "uploaded_rows",
    ]

    daily = (
        measurements.join(macro_executions, on="date", how="full_outer")
        .join(uploaded_rows, on="date", how="full_outer")
        .fillna(0, subset=count_columns)
    )

    cumulative_window = Window.orderBy("date").rowsBetween(Window.unboundedPreceding, 0)

    return daily.withColumn(
        "cumulative_measurements", F.sum("measurements").over(cumulative_window)
    ).withColumn("computed_at", now)
