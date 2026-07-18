# Databricks notebook source
# DBTITLE 1,Gold Layer - DLT mirrors of backend-managed tables
# Two thin DLT tables that mirror backend-managed annotation and metadata
# tables into the pipeline so downstream gold/enriched tables can dlt.read()
# them and get incremental-refresh tracking.

# COMMAND ----------
import dlt

from openjii.centrum import ANNOTATIONS_SOURCE_TABLE, METADATA_SOURCE_TABLE
from openjii.centrum.runtime import CATALOG_NAME

# COMMAND ----------

@dlt.table(
    name=ANNOTATIONS_SOURCE_TABLE,
    comment="Gold layer: DLT-tracked mirror of the experiment_annotations table for incremental refresh support.",
    table_properties={
        "quality": "gold",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
    }
)
def experiment_annotations_source():
    """DLT mirror of the backend-managed experiment_annotations table."""
    return spark.read.table(f"{CATALOG_NAME}.centrum.experiment_annotations")

# COMMAND ----------

@dlt.table(
    name=METADATA_SOURCE_TABLE,
    comment="Gold layer: DLT-tracked mirror of the experiment_metadata table for incremental refresh support.",
    table_properties={
        "quality": "gold",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
        "delta.feature.variantType-preview": "supported",
    }
)
def experiment_metadata_source():
    """DLT mirror of the backend-managed experiment_metadata table."""
    return spark.read.table(f"{CATALOG_NAME}.centrum.experiment_custom_metadata")
