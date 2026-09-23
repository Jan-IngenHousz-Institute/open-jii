# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Macro Data Schemas
# Gold: one sample of each macro's output and question answers per distinct
# schema, so Centrum's experiment_table_metadata infers the schemas without
# reading every result. Kept the same way as experiment_raw_data_schemas, in this
# pipeline because it owns experiment_macro_data.

# COMMAND ----------
import dlt
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_MACRO_DATA_SCHEMAS_TABLE, EXPERIMENT_MACRO_DATA_TABLE
from openjii.variant_schema import variant_schema_key

# COMMAND ----------


def _samples(results: DataFrame, column: str) -> DataFrame:
    return results.select(
        "experiment_id",
        "macro_id",
        F.lit(column).alias("column_name"),
        variant_schema_key(column).alias("schema_key"),
        F.col(column).alias("sample"),
    )


@dlt.table(
    name=EXPERIMENT_MACRO_DATA_SCHEMAS_TABLE,
    comment="Gold layer: one macro_output or questions_data sample per (experiment_id, macro_id, normalised schema).",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.feature.variantType-preview": "supported",
    },
)
def experiment_macro_data_schemas():
    results = dlt.read_stream(EXPERIMENT_MACRO_DATA_TABLE)

    return (
        _samples(results, "macro_output")
        .unionByName(_samples(results, "questions_data"))
        .dropDuplicates(["experiment_id", "macro_id", "column_name", "schema_key"])
    )
