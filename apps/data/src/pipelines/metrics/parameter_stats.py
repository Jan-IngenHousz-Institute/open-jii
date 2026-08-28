# Databricks notebook source
# DBTITLE 1,Metrics - Parameter Stats
# Public metrics: 30-day counts and medians for allowlisted physical
# parameters, read from the macro output variant. Only vetted parameter names
# may surface publicly; medians (not means) so junk values and mixed
# conditions cannot skew the figure.

# COMMAND ----------
import dlt
from functools import reduce

from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_MACRO_DATA_TABLE
from openjii.metrics import (
    ACTIVITY_WINDOW_DAYS,
    PARAMETER_ALLOWLIST,
    PARAMETER_STATS_TABLE,
    within_plausible_range,
)
from openjii.metrics.runtime import centrum_table

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

    A parameter that never parses out of macro_output simply yields no row
    and the frontend hides the line.
    """
    now = F.current_timestamp()

    recent = (
        spark.table(centrum_table(EXPERIMENT_MACRO_DATA_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .filter(F.col("timestamp") >= now - F.expr(f"INTERVAL {ACTIVITY_WINDOW_DAYS} DAYS"))
        .filter(F.col("macro_output").isNotNull())
        .select("macro_output")
    )

    def parameter_frame(name):
        value = F.expr(f"try_variant_get(macro_output, '$.{name}', 'double')")
        return (
            recent.select(value.alias("value"))
            .filter(F.col("value").isNotNull())
            .agg(
                F.count("*").alias("count_30d"),
                F.percentile_approx("value", 0.5).alias("median_value"),
            )
            .withColumn("parameter", F.lit(name))
            .select("parameter", "count_30d", "median_value")
        )

    frames = [parameter_frame(name) for name in PARAMETER_ALLOWLIST]
    combined = reduce(lambda a, b: a.unionByName(b), frames)

    return combined.filter(F.col("count_30d") > 0).withColumn("computed_at", now)
