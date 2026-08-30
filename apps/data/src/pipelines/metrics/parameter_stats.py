# Databricks notebook source
# DBTITLE 1,Metrics - Parameter Stats
# Public metrics: 30-day counts and medians for allowlisted parameters read
# from the macro output variant, split into macro-derived values and raw
# sensor readings. Only vetted parameter names may surface publicly; medians
# (not means) so junk values and mixed conditions cannot skew the figure.

# COMMAND ----------
import dlt
from functools import reduce

from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_MACRO_DATA_TABLE
from openjii.metrics import (
    PARAMETER_WINDOW_DAYS,
    DERIVED_PARAMETER_ALLOWLIST,
    PARAMETER_CATEGORY_DERIVED,
    PARAMETER_CATEGORY_SENSOR,
    PARAMETER_STATS_TABLE,
    SENSOR_PARAMETER_ALLOWLIST,
    within_plausible_range,
)
from openjii.metrics.runtime import centrum_table

# COMMAND ----------


@dlt.table(
    name=PARAMETER_STATS_TABLE,
    comment="Public metrics: 30-day counts and medians per allowlisted parameter, split by derived vs sensor category.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def parameter_stats():
    """One row per allowlisted parameter observed in the window.

    The category column separates macro-derived values from raw sensor
    readings so each can headline its own public line.

    A parameter that never parses out of macro_output simply yields no row
    and the frontend hides the line.
    """
    now = F.current_timestamp()

    recent = (
        spark.table(centrum_table(EXPERIMENT_MACRO_DATA_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .filter(F.col("timestamp") >= now - F.expr(f"INTERVAL {PARAMETER_WINDOW_DAYS} DAYS"))
        .filter(F.col("macro_output").isNotNull())
        .select("macro_output")
    )

    def parameter_frame(name, category):
        value = F.expr(f"try_variant_get(macro_output, '$.{name}', 'double')")
        return (
            recent.select(value.alias("value"))
            .filter(F.col("value").isNotNull())
            .agg(
                F.count("*").alias("observations"),
                F.percentile_approx("value", 0.5).alias("median_value"),
            )
            .withColumn("parameter", F.lit(name))
            .withColumn("category", F.lit(category))
            .select("parameter", "category", "observations", "median_value")
        )

    frames = [
        parameter_frame(name, PARAMETER_CATEGORY_DERIVED) for name in DERIVED_PARAMETER_ALLOWLIST
    ] + [parameter_frame(name, PARAMETER_CATEGORY_SENSOR) for name in SENSOR_PARAMETER_ALLOWLIST]
    combined = reduce(lambda a, b: a.unionByName(b), frames)

    return combined.filter(F.col("observations") > 0).withColumn("computed_at", now)
