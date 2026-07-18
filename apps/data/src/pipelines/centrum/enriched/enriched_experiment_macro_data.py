# Databricks notebook source
# DBTITLE 1,Enriched Layer - Experiment Macro Data
# Enriched: experiment_macro_data joined with contributors, annotations, and
# custom metadata. Adds local-time columns derived from timezone.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from enrich.annotations_metadata import add_annotation_column
from enrich.custom_metadata import add_custom_metadata_column
from openjii.centrum import (
    ANNOTATIONS_SOURCE_TABLE,
    ENRICHED_MACRO_DATA_VIEW,
    EXPERIMENT_CONTRIBUTORS_TABLE,
    EXPERIMENT_DEVICES_TABLE,
    EXPERIMENT_MACRO_DATA_TABLE,
    METADATA_SOURCE_TABLE,
)

# COMMAND ----------

@dlt.table(
    name=ENRICHED_MACRO_DATA_VIEW,
    comment="Enriched materialized view: Macro data with expanded VARIANT, questions, user struct, and annotations. Qualified for incremental refresh.",
    table_properties={
        "quality": "gold",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
        "delta.enableDeletionVectors": "true",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.feature.variantType-preview": "supported",
    }
)
def enriched_experiment_macro_data():
    """Enriched macro data with user profiles, annotations, and user metadata."""
    macro_data = dlt.read(EXPERIMENT_MACRO_DATA_TABLE)
    contributors = dlt.read(EXPERIMENT_CONTRIBUTORS_TABLE)
    devices = dlt.read(EXPERIMENT_DEVICES_TABLE)
    annotations_source = dlt.read(ANNOTATIONS_SOURCE_TABLE)
    metadata_source = dlt.read(METADATA_SOURCE_TABLE)

    enriched = (
        macro_data
        .join(
            contributors,
            (macro_data.experiment_id == contributors.experiment_id) &
            (macro_data.user_id == contributors.user_id),
            "left"
        )
        .join(
            devices,
            (macro_data.experiment_id == devices.experiment_id) &
            (macro_data.client_id == devices.client_id),
            "left"
        )
        .select(
            macro_data.experiment_id,
            macro_data.id,
            macro_data.raw_id,
            macro_data.device_id,
            macro_data.device_name,
            macro_data.timestamp,  # kept for backwards compatibility (downstream consumers order by timestamp)
            macro_data.timestamp.alias("measurement_time_utc"),
            macro_data.timezone,
            macro_data.date,
            contributors.user.alias("contributor"),
            devices.device.alias("device"),
            macro_data.macro_id,
            macro_data.macro_name,
            macro_data.macro_filename,
            macro_data.macro_output,
            macro_data.macro_error,
            macro_data.processed_timestamp,
            macro_data.questions_data,
            macro_data.annotations
        )
        .withColumn(
            "measurement_time_local",
            F.when(
                F.col("timezone").isNotNull(),
                F.date_format(F.from_utc_timestamp(F.col("measurement_time_utc"), F.col("timezone")), "yyyy-MM-dd HH:mm:ss")
            )
        )
        .withColumn(
            "local_time",
            F.when(
                F.col("timezone").isNotNull(),
                F.date_format(F.from_utc_timestamp(F.col("measurement_time_utc"), F.col("timezone")), "HH:mm")
            )
        )
    )

    enriched = add_annotation_column(enriched, annotations_source)

    return add_custom_metadata_column(enriched, metadata_source)
