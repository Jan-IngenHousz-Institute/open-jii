# Databricks notebook source
# DBTITLE 1,Metrics - Parameter Stats
# Public metrics: counts and medians per allowlisted parameter over the
# parameter window. Provenance decides the category: a macro wrote everything
# in macro_output, while a sensor reading comes from the device's own payload.
# Only vetted names may surface publicly; medians (not means) so junk values
# and mixed conditions cannot skew the figure.

# COMMAND ----------
import dlt
from functools import reduce

from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_MACRO_DATA_TABLE
from openjii.metrics import (
    DERIVED_PARAMETER_ALLOWLIST,
    PARAMETER_CATEGORY_DERIVED,
    PARAMETER_CATEGORY_SENSOR,
    PARAMETER_LABELS,
    PARAMETER_STATS_TABLE,
    PARAMETER_WINDOW_DAYS,
    SENSOR_PARAMETER_ALLOWLIST,
    within_plausible_range,
)
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=PARAMETER_STATS_TABLE,
    comment="Public metrics: observation counts and medians per allowlisted parameter.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def parameter_stats():
    """One row per allowlisted parameter observed in the window.

    A parameter that never parses out of its source simply yields no row and
    the frontend hides the line.
    """
    now = F.current_timestamp()
    window = F.col("timestamp") >= now - F.expr(f"INTERVAL {PARAMETER_WINDOW_DAYS} DAYS")

    macro_outputs = (
        spark.table(centrum_table(EXPERIMENT_MACRO_DATA_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .filter(window)
        .filter(F.col("macro_output").isNotNull())
        .select("macro_output")
    )

    payloads = (
        spark.table(centrum_table(SILVER_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .filter(window)
        .filter(F.col("sample").isNotNull())
        .select("sample")
    )

    def stats_frame(name, category, values):
        return (
            values.filter(F.col("value").isNotNull())
            .agg(
                F.count("*").alias("observations"),
                F.percentile_approx("value", 0.5).alias("median_value"),
            )
            .withColumn("parameter", F.lit(name))
            .withColumn("label", F.lit(PARAMETER_LABELS.get(name, name)))
            .withColumn("category", F.lit(category))
            .select("parameter", "label", "category", "observations", "median_value")
        )

    def sensor_values(name):
        """Every reading of one parameter in a payload, whatever its shape.

        A payload is an array of samples. Ambit-family samples carry their
        scalars in a `data` object; MultispeQ, MiniPAR and PhotosynQ samples
        carry them in a nested `set` array, one entry per reading. Reading only
        one of those shapes drops the other instrument's readings entirely, and
        reading only the first entry would sample rather than aggregate.
        """
        return payloads.select(
            F.explode(
                F.expr(
                    f"""
                    filter(
                      flatten(
                        transform(
                          from_json(sample, 'array<string>'),
                          x -> concat(
                            array(try_cast(get_json_object(x, '$.data.{name}') as double)),
                            transform(
                              from_json(coalesce(get_json_object(x, '$.set'), '[]'), 'array<string>'),
                              s -> try_cast(get_json_object(s, '$.{name}') as double)
                            )
                          )
                        )
                      ),
                      v -> v is not null
                    )
                    """
                )
            ).alias("value")
        )

    frames = [
        stats_frame(
            name,
            PARAMETER_CATEGORY_DERIVED,
            macro_outputs.select(
                F.expr(f"try_variant_get(macro_output, '$.{name}', 'double')").alias("value")
            ),
        )
        for name in DERIVED_PARAMETER_ALLOWLIST
    ] + [
        stats_frame(name, PARAMETER_CATEGORY_SENSOR, sensor_values(name))
        for name in SENSOR_PARAMETER_ALLOWLIST
    ]

    combined = reduce(lambda a, b: a.unionByName(b), frames)

    return combined.filter(F.col("observations") > 0).withColumn("computed_at", now)
