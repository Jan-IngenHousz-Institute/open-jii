# Databricks notebook source
# DBTITLE 1,Enriched Layer - Experiment Uploaded Data
# Enriched: uploaded rows joined with contributors, annotations, and custom
# metadata. Mirrors enriched_experiment_macro_data.

# COMMAND ----------
import dlt

from enrich.annotations_metadata import add_annotation_column
from enrich.custom_metadata import add_custom_metadata_column
from openjii.centrum import (
    ANNOTATIONS_SOURCE_TABLE,
    ENRICHED_UPLOADED_DATA_VIEW,
    EXPERIMENT_CONTRIBUTORS_TABLE,
    EXPERIMENT_UPLOADED_DATA_TABLE,
    METADATA_SOURCE_TABLE,
)

# COMMAND ----------

@dlt.table(
    name=ENRICHED_UPLOADED_DATA_VIEW,
    comment="Enriched view: uploaded rows joined with contributors, annotations, and experiment metadata. Mirrors enriched_experiment_macro_data.",
    table_properties={
        "quality": "gold",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
        "delta.enableDeletionVectors": "true",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.feature.variantType-preview": "supported",
    },
)
def enriched_experiment_uploaded_data():
    uploaded = dlt.read(EXPERIMENT_UPLOADED_DATA_TABLE)
    contributors = dlt.read(EXPERIMENT_CONTRIBUTORS_TABLE)
    annotations_source = dlt.read(ANNOTATIONS_SOURCE_TABLE)
    metadata_source = dlt.read(METADATA_SOURCE_TABLE)

    enriched = (
        uploaded
        .join(
            contributors,
            (uploaded.experiment_id == contributors.experiment_id)
            & (uploaded.created_by == contributors.user_id),
            "left",
        )
        .select(
            uploaded.id,
            uploaded.experiment_id,
            uploaded.upload_table_id,
            uploaded.upload_table_name,
            uploaded.upload_id,
            uploaded.uploaded_at,
            uploaded.uploaded_data,
            contributors.user.alias("contributor"),
        )
    )

    enriched = add_annotation_column(enriched, annotations_source)

    return add_custom_metadata_column(enriched, metadata_source)
