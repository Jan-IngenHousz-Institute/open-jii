# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Raw Data
# Gold: per-experiment raw sample data with VARIANT support, sanitized question
# labels, and inline-repair application.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from data_repair import apply_inline_repairs
from openjii import scrub_non_finite_json
from openjii.centrum import EXPERIMENT_RAW_DATA_TABLE
from openjii.centrum.questions import sanitized_questions
from openjii.centrum.measurement_provenance import with_provenance_defaults
from openjii.centrum.runtime import SILVER_TABLE
from openjii.timezones import usable_timezone

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_RAW_DATA_TABLE,
    # Reads take one experiment, newest rows first and often within a time window, so files
    # cluster by experiment and then by time.
    cluster_by=["experiment_id", "timestamp"],
    comment="Gold layer: Per-experiment raw sample data clustered by experiment_id and timestamp with VARIANT sample",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "false",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
        "delta.feature.variantType-preview": "supported",
        # Stores common payload fields as columns of their own, so reading one field skips the rest.
        "delta.enableVariantShredding": "true",
    }
)
def experiment_raw_data():
    """Per-experiment raw sample data with VARIANT support."""

    return (
        with_provenance_defaults(dlt.read_stream(SILVER_TABLE))
        .filter("experiment_id IS NOT NULL")
        # Firmware serializes floats permissively, so calibration samples can
        # carry bare NaN/Infinity tokens that strict parse_json rejects,
        # poisoning the stream. The scrub UDF rewrites them to null and is a
        # cheap passthrough for clean payloads.
        .withColumn("sample_scrubbed", scrub_non_finite_json(F.col("sample")))
        .withColumn("data", F.expr("try_parse_json(sample_scrubbed)"))
        .withColumn("output_data", F.expr("try_parse_json(output)"))
        .withColumn(
            "questions_sanitized",
            F.when(
                F.col("questions").isNotNull() & (F.size("questions") > 0),
                sanitized_questions(F.col("questions"))
            )
        )
        .withColumn(
            "questions_data",
            F.when(
                F.col("questions_sanitized").isNotNull() & (F.size("questions_sanitized") > 0),
                F.expr("""
                    parse_json(
                        to_json(
                            map_from_arrays(
                                transform(questions_sanitized, q -> q.question_label),
                                transform(questions_sanitized, q -> q.question_answer)
                            )
                        )
                    )
                """)
            )
        )
        .select(
            "id",
            "experiment_id",
            "device_id",
            "is_simulated",
            "is_guest",
            "client_id",
            "device_name",
            "device_family",
            "device_version",
            "device_firmware",
            "device_battery",
            "device_address",
            "client_model",
            "client_manufacturer",
            "client_os",
            "client_os_version",
            "client_app_version",
            "timestamp",
            usable_timezone(F.col("timezone")).alias("timezone"),
            "macros",
            "questions_data",
            "annotations",
            "user_id",
            "protocol_id",
            "workbook_run_id",
            "workbook_version_id",
            "macro_context",
            "latitude",
            "longitude",
            "data",
            "output_data",
            "date",
            "processed_timestamp",
            "arrival_timestamp",
            "skip_macro_processing"
        )
        .transform(lambda df: apply_inline_repairs(df, EXPERIMENT_RAW_DATA_TABLE))
    )
