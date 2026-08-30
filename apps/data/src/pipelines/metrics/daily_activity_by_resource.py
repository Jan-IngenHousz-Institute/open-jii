# Databricks notebook source
# DBTITLE 1,Metrics - Daily Activity by Resource
# Backend-only scope table: per-resource daily counts powering the activity
# strips on the platform's list pages. Resource-grain rows never leave the
# backend unaggregated; the public endpoint must not expose this table.

# COMMAND ----------
import dlt
from functools import reduce

from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_MACRO_DATA_TABLE
from openjii.metrics import (
    DAILY_ACTIVITY_BY_RESOURCE_TABLE,
    RESOURCE_TYPE_MACRO,
    RESOURCE_TYPE_PROTOCOL,
    RESOURCE_TYPE_WORKBOOK_VERSION,
    within_plausible_range,
)
from openjii.metrics.runtime import SILVER_TABLE, centrum_table

# COMMAND ----------


@dlt.table(
    name=DAILY_ACTIVITY_BY_RESOURCE_TABLE,
    comment="Backend-only: per-resource daily measurement counts for list-page activity.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    },
)
def daily_activity_by_resource():
    """One row per (date, resource type, resource) with a measurement count.

    Workbooks are keyed by version: the silver row records the version that
    produced it, and only the backend can resolve a version to its workbook.
    """
    now = F.current_timestamp()

    measurements = spark.table(centrum_table(SILVER_TABLE)).filter(
        within_plausible_range(F.col("timestamp"), now)
    )

    def by_column(column, resource_type):
        return (
            measurements.filter(F.col(column).isNotNull())
            .groupBy("date", F.col(column).alias("resource_id"))
            .agg(F.count("*").alias("measurements"))
            .withColumn("resource_type", F.lit(resource_type))
            .select("date", "resource_type", "resource_id", "measurements")
        )

    macros = (
        spark.table(centrum_table(EXPERIMENT_MACRO_DATA_TABLE))
        .filter(within_plausible_range(F.col("timestamp"), now))
        .filter(F.col("macro_id").isNotNull())
        .groupBy("date", F.col("macro_id").alias("resource_id"))
        .agg(F.count("*").alias("measurements"))
        .withColumn("resource_type", F.lit(RESOURCE_TYPE_MACRO))
        .select("date", "resource_type", "resource_id", "measurements")
    )

    frames = [
        by_column("protocol_id", RESOURCE_TYPE_PROTOCOL),
        by_column("workbook_version_id", RESOURCE_TYPE_WORKBOOK_VERSION),
        macros,
    ]

    return reduce(lambda a, b: a.unionByName(b), frames).withColumn("computed_at", now)
