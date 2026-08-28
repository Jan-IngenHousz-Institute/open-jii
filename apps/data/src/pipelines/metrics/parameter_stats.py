# Databricks notebook source
# DBTITLE 1,Metrics - Parameter Stats
# Public metrics: 30-day counts and medians for allowlisted physical
# parameters. Only vetted parameter names may surface publicly; medians (not
# means) so junk values and mixed conditions cannot skew the figure.

# COMMAND ----------
import dlt
from functools import reduce

from pyspark.sql import functions as F

from openjii.metrics import (
    ACTIVITY_WINDOW_DAYS,
    PARAMETER_ALLOWLIST,
    PARAMETER_STATS_TABLE,
    within_plausible_range,
)
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=PARAMETER_STATS_TABLE,
    comment="Public metrics: 30-day counts and medians per allowlisted parameter.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def parameter_stats():
    """One row per allowlisted parameter observed in the window.

    Values come from the payload's macro output JSON; a parameter that never
    parses simply yields no row and the frontend hides the line.
    """
    now = F.current_timestamp()

    recent = (
        spark.table(centrum_table(SILVER_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .filter(F.col("timestamp") >= now - F.expr(f"INTERVAL {ACTIVITY_WINDOW_DAYS} DAYS"))
        .select("output")
    )

    def parameter_frame(name):
        value = F.get_json_object(F.col("output"), f"$.{name}").cast("double")
        return (
            recent.select(value.alias("value"))
            .filter(F.col("value").isNotNull())
            .agg(
                F.lit(name).alias("parameter"),
                F.count("*").alias("count_30d"),
                F.percentile_approx("value", 0.5).alias("median_value"),
            )
        )

    frames = [parameter_frame(name) for name in PARAMETER_ALLOWLIST]
    combined = reduce(lambda a, b: a.unionByName(b), frames)

    return combined.filter(F.col("count_30d") > 0).withColumn("computed_at", now)
