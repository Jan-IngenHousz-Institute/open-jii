# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Macro Data
# Gold: per-macro execution results via the backend sandbox UDF, with VARIANT
# output column and inline-repair application.
#
# Runs in its own pipeline because Spark tasks wait on sandbox HTTP requests.
# Sharing the ingest pipeline's compute let those tasks hold the slots the Kinesis
# reader needs. The table was moved here from the Centrum
# pipeline rather than recreated. Preserve its qualified source, table identity,
# and checkpoint; the range shuffle below changes only stateless distribution.

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
from openjii.macros.runtime import (
    ENVIRONMENT,
    MACRO_EXECUTION_PARTITIONS,
    MACRO_MAX_BYTES_PER_TRIGGER,
    MACRO_MAX_FILES_PER_TRIGGER,
    centrum_table,
)

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_MACRO_DATA_TABLE,
    cluster_by=["experiment_id"],
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

    sandbox_macro_udf = make_execute_macro_udf(ENVIRONMENT, dbutils)

    base_df = (
        spark.readStream
        .option("maxFilesPerTrigger", MACRO_MAX_FILES_PER_TRIGGER)
        .option("maxBytesPerTrigger", MACRO_MAX_BYTES_PER_TRIGGER)
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

    should_execute = (
        F.col("macro_id").isNotNull()
        & F.col("macro_id").rlike(MACRO_ID_UUID_PATTERN)
        & ~F.coalesce(F.col("skip_macro_processing"), F.lit(False))
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
        # The UDF checks eligibility itself because Spark eagerly evaluates it
        # outside F.when. Keep the outer guard for null sandbox-result semantics.
        .withColumn(
            "sandbox_result",
            F.when(
                should_execute,
                sandbox_macro_udf(
                    F.struct(
                        "id",
                        "macro_id",
                        F.col("data"),
                        "workbook_version_id",
                        "macro_context",
                        should_execute.alias("should_execute"),
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
