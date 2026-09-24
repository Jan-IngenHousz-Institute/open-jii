# Databricks notebook source
# DBTITLE 1,Gold Layer - DLT mirror of a backend-managed table
# A thin DLT table that mirrors the backend-managed custom metadata table into
# the pipeline so experiment_table_metadata can dlt.read() it and get
# incremental-refresh tracking.

# COMMAND ----------
import dlt

from openjii.centrum import METADATA_SOURCE_TABLE
from openjii.centrum.runtime import CATALOG_NAME

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
