# Databricks notebook source
# DBTITLE 1,Macros - Experiment Macro Data
# Per-macro execution results via the backend sandbox UDF, with VARIANT output
# column and inline-repair application.
#
# This runs in its own pipeline. The sandbox call is sequential HTTP from a Spark
# task, and while it shared the centrum pipeline one task held a slot for
# 12,954 seconds using 22 seconds of CPU, starving the Kinesis reader of the slot
# its prefetch job needs. Separate pipelines mean separate slots.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from data_repair import apply_inline_repairs
from enrich.macro_execution import make_execute_macro_udf
from openjii.centrum import MACRO_ID_UUID_PATTERN
from openjii.macros import (
    EXPERIMENT_RAW_DATA_TABLE,
    FACT_MACRO_RESULT_TABLE,
    LEGACY_MACRO_DATA_TABLE,
    MACRO_RESULT_BACKFILL_FLOW,
    MACRO_RESULT_LIVE_FLOW,
)
from openjii.macros.runtime import ENVIRONMENT, MACRO_BACKFILL_CUTOVER, centrum_table

# COMMAND ----------

# Declared as a streaming table with two append flows rather than a @dlt.table so
# the history can arrive from the centrum-owned table without re-running every
# macro through the sandbox. Silver uses the same shape for the same reason.
dlt.create_streaming_table(
    name=FACT_MACRO_RESULT_TABLE,
    comment="Macro processing with VARIANT column for flexible schema",
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

# COMMAND ----------

# The shape both flows must produce. The live flow spells it out in its final
# select because two of the columns are renames; the backfill projects this list
# so a divergence between them fails at deploy rather than writing a mixed table.
MACRO_COLUMNS = [
    "experiment_id",
    "id",
    "raw_id",
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
]


@dlt.append_flow(target=FACT_MACRO_RESULT_TABLE, name=MACRO_RESULT_LIVE_FLOW)
def experiment_macro_data_live():
    """Execute macros for measurements as they arrive."""

    sandbox_macro_udf = make_execute_macro_udf(ENVIRONMENT, dbutils)

    base_df = (
        spark.readStream.option("startingTimestamp", MACRO_BACKFILL_CUTOVER)
        .table(centrum_table(EXPERIMENT_RAW_DATA_TABLE))
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
        .transform(lambda df: apply_inline_repairs(df, FACT_MACRO_RESULT_TABLE))
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
        # Every input is carried on the source row, so the id a measurement gets
        # here is the id it had in the centrum-owned table. That is what lets the
        # backfill below and this flow write into the same table.
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


@dlt.append_flow(target=FACT_MACRO_RESULT_TABLE, name=MACRO_RESULT_BACKFILL_FLOW)
def experiment_macro_data_backfill():
    """Drain the centrum-owned table this pipeline replaces.

    Its rows already carry executed macro output, so this copies them rather than
    re-running the sandbox. The source stops being written once the centrum
    pipeline drops the notebook, so the flow drains once and then idles.
    """
    return spark.readStream.table(centrum_table(LEGACY_MACRO_DATA_TABLE)).select(*MACRO_COLUMNS)
