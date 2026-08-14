# Databricks notebook source
# DBTITLE 1,Metrics - Platform Totals
# Public metrics: single-row snapshot of platform-wide counters. Every column
# is pre-aggregated and anonymized; the table is safe to expose byte-for-byte
# through the public endpoint.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_MACRO_DATA_TABLE, EXPERIMENT_UPLOADED_DATA_TABLE
from openjii.metrics import PLATFORM_TOTALS_TABLE, within_plausible_range
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=PLATFORM_TOTALS_TABLE,
    comment="Public metrics: single-row snapshot of platform-wide counters.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def platform_totals():
    """All-time counters plus first/last measurement, one row per refresh.

    Every measurement-time-derived stat here and in daily_activity uses the
    plausible-clock subset, so the counters and the cumulative curve agree.
    """
    now = F.current_timestamp()

    measurement_totals = (
        spark.table(centrum_table(SILVER_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .agg(
            F.count("*").alias("total_measurements"),
            F.countDistinct("device_id").alias("devices_all_time"),
            F.countDistinct("experiment_id").alias("experiments_with_data"),
            F.min("timestamp").alias("first_measurement_at"),
            F.max("timestamp").alias("last_measurement_at"),
        )
    )

    macro_totals = (
        spark.table(centrum_table(EXPERIMENT_MACRO_DATA_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .agg(F.count("*").alias("total_macro_executions"))
    )

    upload_totals = spark.table(centrum_table(EXPERIMENT_UPLOADED_DATA_TABLE)).agg(
        F.count("*").alias("total_uploaded_rows")
    )

    return (
        measurement_totals.crossJoin(macro_totals)
        .crossJoin(upload_totals)
        .withColumn("computed_at", now)
    )
