# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Raw Data Schemas
# Gold: one sample of the question answers per distinct schema and experiment,
# so experiment_table_metadata infers the schema without reading every row.
#
# A streaming dropDuplicates keeps the first row it sees for each key and holds
# only the keys in its state, a few per experiment. The sample stays a VARIANT:
# a JSON round trip would type 2.0 as an integer and change the merge.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F

from openjii.centrum import EXPERIMENT_RAW_DATA_SCHEMAS_TABLE, EXPERIMENT_RAW_DATA_TABLE
from openjii.variant_schema import variant_schema_key

# COMMAND ----------


@dlt.table(
    name=EXPERIMENT_RAW_DATA_SCHEMAS_TABLE,
    comment="Gold layer: one questions_data sample per (experiment_id, normalised schema).",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.feature.variantType-preview": "supported",
    },
    spark_conf={"spark.sql.streaming.stateStore.partitions": "2"},
)
def experiment_raw_data_schemas():
    return (
        dlt.read_stream(EXPERIMENT_RAW_DATA_TABLE)
        .select(
            "experiment_id",
            variant_schema_key("questions_data").alias("schema_key"),
            F.col("questions_data").alias("sample"),
        )
        .dropDuplicates(["experiment_id", "schema_key"])
    )
