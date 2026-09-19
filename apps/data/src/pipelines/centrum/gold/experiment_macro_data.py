# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Macro Data
# Gold: per-macro execution results via the backend sandbox UDF, with VARIANT
# output column and inline-repair application.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from data_repair import apply_inline_repairs
from enrich.macro_execution import distribute_macro_execution_rows, make_execute_macro_udf
from openjii.centrum import (
    EXPERIMENT_MACRO_DATA_TABLE,
    EXPERIMENT_RAW_DATA_TABLE,
    MACRO_ID_UUID_PATTERN,
)
from openjii.centrum.runtime import ENVIRONMENT

# COMMAND ----------

# The incident workload put 184,358 rows into two HTTP-bound tasks, including a
# 118,825-row straggler. A 128-way round-robin shuffle makes that measured batch
# roughly 1,441 rows per task on an even distribution. This is not a fixed
# bound: task size still grows with the micro-batch. Backend requests remain
# sequential within each active Spark task.
MACRO_EXECUTION_PARTITIONS = 128

# This is a conditional request-start bound, not a distributed rate limiter.
# It is load-bearing on production remaining capped at four workers and on the
# observed runtime having no more than eight simultaneous macro task attempts.
# Charging every attempt before its first and subsequent POSTs yields at most
# 8 * (floor(300 / 6) + 1) = 408 macro POST starts in any rolling five minutes.
# Raising the worker-policy ceiling invalidates that bound and requires review.
MACRO_REQUEST_DELAY_SECONDS = 6

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_MACRO_DATA_TABLE,
    comment="Gold layer: Unified macro processing with VARIANT column for flexible schema",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
        "delta.feature.variantType-preview": "supported"
    }
)
def experiment_macro_data():
    """Process macros with VARIANT output column."""

    sandbox_macro_udf = make_execute_macro_udf(
        ENVIRONMENT,
        dbutils,
        request_delay_seconds=MACRO_REQUEST_DELAY_SECONDS,
    )

    base_df = (
        dlt.read_stream(EXPERIMENT_RAW_DATA_TABLE)
        .filter("macros IS NOT NULL")
        .filter("size(macros) > 0")
        .select(
            "id",
            "experiment_id",
            "device_id",
            "client_id",
            "device_name",
            "timestamp",
            "timezone",
            "user_id",
            "latitude",
            "longitude",
            "data",
            "output_data",
            "date",
            "processed_timestamp",
            "questions_data",
            "annotations",
            "skip_macro_processing",
            "workbook_run_id",
            "workbook_version_id",
            "macro_context",
            F.explode("macros").alias("macro")
        )
        .select(
            "id",
            "experiment_id",
            "device_id",
            "client_id",
            "device_name",
            "timestamp",
            "timezone",
            "user_id",
            "latitude",
            "longitude",
            "data",
            "output_data",
            "date",
            "processed_timestamp",
            "questions_data",
            "annotations",
            "skip_macro_processing",
            "workbook_run_id",
            "workbook_version_id",
            "macro_context",
            F.col("macro.id").alias("macro_id"),
            F.col("macro.name").alias("macro_name"),
            F.col("macro.filename").alias("macro_filename")
        )
    )

    return (
        base_df
        .transform(lambda df: apply_inline_repairs(df, EXPERIMENT_MACRO_DATA_TABLE))
        .transform(
            lambda df: distribute_macro_execution_rows(
                df,
                MACRO_EXECUTION_PARTITIONS,
            )
        )
        # NULL.rlike(...) returns NULL (treated as false in F.when), so the
        # explicit isNotNull() guard is required, otherwise null macro_ids
        # would silently land with no output and no error.
        .withColumn(
            "sandbox_result",
            F.when(
                F.col("macro_id").isNotNull()
                & F.col("macro_id").rlike(MACRO_ID_UUID_PATTERN)
                & ~F.coalesce(F.col("skip_macro_processing"), F.lit(False)),
                sandbox_macro_udf(
                    F.struct(
                        "id",
                        "macro_id",
                        F.col("data"),
                        "workbook_version_id",
                        "macro_context",
                    )
                ),
            )
        )
        # For imported rows, use pre-computed output_data; otherwise use UDF result
        .withColumn(
            "macro_output",
            F.when(
                F.col("skip_macro_processing") == True,
                F.col("output_data")
            ).otherwise(
                F.when(
                    F.col("sandbox_result.result").isNotNull(),
                    F.expr("parse_json(sandbox_result.result)"),
                )
            ),
        )
        .withColumn(
            "macro_error",
            F.when(
                F.col("skip_macro_processing") == True,
                F.lit(None).cast("string")
            ).when(
                F.col("macro_id").isNull(),
                F.lit("Invalid macro_id (null)")
            ).when(
                ~F.col("macro_id").rlike(MACRO_ID_UUID_PATTERN),
                F.concat(F.lit("Invalid macro_id (not UUID): "), F.col("macro_id"))
            ).otherwise(F.col("sandbox_result.error"))
        )
        .withColumn(
            "macro_row_id",
            F.abs(
                F.hash(
                    F.col("id"),
                    F.col("macro_filename"),
                    F.col("processed_timestamp"),
                )
            ),
        )
        .select(
            "experiment_id",
            F.col("macro_row_id").alias("id"),
            F.col("id").alias("raw_id"),
            "device_id",
            "client_id",
            "device_name",
            "timestamp",
            "timezone",
            "user_id",
            "latitude",
            "longitude",
            "macro_id",
            "macro_name",
            "macro_filename",
            "workbook_run_id",
            "workbook_version_id",
            "macro_output",
            "macro_error",
            "processed_timestamp",
            "date",
            "questions_data",
            "annotations",
        )
    )
