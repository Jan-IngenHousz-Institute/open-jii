# Databricks notebook source
# DBTITLE 1,Workbook Run Completeness
# Materialized derivation: late measurement rows can move partial -> complete.

# COMMAND ----------
import dlt

from openjii.centrum import (
    WORKBOOK_RUN_COMPLETENESS_TABLE,
    WORKBOOK_RUN_CONTROL_TABLE,
)
from openjii.centrum.completeness import derive_workbook_run_completeness
from openjii.centrum.runtime import SILVER_TABLE


@dlt.table(
    name=WORKBOOK_RUN_COMPLETENESS_TABLE,
    comment="Derived completeness of workbook attempts from manifests and received rows",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.enableChangeDataFeed": "true",
    },
)
def workbook_run_completeness():
    return derive_workbook_run_completeness(
        dlt.read(WORKBOOK_RUN_CONTROL_TABLE),
        dlt.read(SILVER_TABLE),
    )
