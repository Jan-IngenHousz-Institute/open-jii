# Databricks notebook source
# DBTITLE 1,Enriched Layer - Experiment Raw Data
# Enriched: experiment_raw_data joined with contributors, annotations, and
# custom metadata. Adds local-time columns derived from timezone.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from enrich.annotations_metadata import add_annotation_column
from enrich.custom_metadata import add_custom_metadata_column
from openjii.centrum import (
    ANNOTATIONS_SOURCE_TABLE,
    ENRICHED_RAW_DATA_VIEW,
    EXPERIMENT_CONTRIBUTORS_TABLE,
    EXPERIMENT_DEVICES_TABLE,
    EXPERIMENT_RAW_DATA_TABLE,
    METADATA_SOURCE_TABLE,
)

# COMMAND ----------

@dlt.table(
    name=ENRICHED_RAW_DATA_VIEW,
    comment="Enriched materialized view: Raw data with questions, user struct, and annotations. Qualified for incremental refresh.",
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
def enriched_experiment_raw_data():
    """Enriched raw data with user profiles, annotations, and user metadata."""
    raw_data = dlt.read(EXPERIMENT_RAW_DATA_TABLE)
    contributors = dlt.read(EXPERIMENT_CONTRIBUTORS_TABLE)
    devices = dlt.read(EXPERIMENT_DEVICES_TABLE)
    annotations_source = dlt.read(ANNOTATIONS_SOURCE_TABLE)
    metadata_source = dlt.read(METADATA_SOURCE_TABLE)

    enriched = (
        raw_data
        .join(
            contributors,
            (raw_data.experiment_id == contributors.experiment_id) &
            (raw_data.user_id == contributors.user_id),
            "left"
        )
        .join(
            devices,
            (raw_data.experiment_id == devices.experiment_id) &
            (raw_data.client_id == devices.client_id),
            "left"
        )
        .select(
            raw_data.experiment_id,
            raw_data.id,
            raw_data.device_id,
            raw_data.device_name,
            raw_data.timestamp,  # kept for backwards compatibility (downstream consumers order by timestamp)
            raw_data.timestamp.alias("measurement_time_utc"),
            raw_data.timezone,
            raw_data.date,
            raw_data.macros,
            raw_data.questions_data,
            raw_data.annotations,
            contributors.user.alias("contributor"),
            devices.device.alias("device"),
            raw_data.protocol_id,
            raw_data.workbook_run_id,
            raw_data.latitude,
            raw_data.longitude,
            raw_data.data,
            raw_data.processed_timestamp
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
