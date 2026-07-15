# Databricks notebook source
# DBTITLE 1,Silver Layer - Clean Data
# Silver: clean and standardize sensor data, decompress samples, parse macros /
# questions / annotations, apply legacy macro-id remap, and union with imported
# data.

# COMMAND ----------
import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import ArrayType

from openjii import decompress_sample
from openjii.centrum import question_schema
from openjii.centrum.runtime import (
    BRONZE_TABLE,
    LEGACY_MACRO_ID_MAP,
    RAW_IMPORTED_DATA_TABLE,
    SILVER_TABLE,
)

# COMMAND ----------

@dlt.table(
    name=SILVER_TABLE,
    comment="Silver layer: Cleaned and standardized sensor data",
    table_properties={
        "quality": "silver",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableChangeDataFeed": "true"
    }
)
@dlt.expect_or_drop("valid_timestamp", "timestamp IS NOT NULL")
@dlt.expect("valid_device_id", "device_id IS NOT NULL")
def clean_data():
    """Silver layer: Clean and standardize sensor data, including imported data."""
    bronze_df = dlt.read_stream(BRONZE_TABLE)

    df = (
        bronze_df
        .withColumn("device_id", F.col("parsed_data.device_id"))
        .withColumn("device_name", F.col("parsed_data.device_name"))
        .withColumn("device_version", F.col("parsed_data.device_version"))
        .withColumn("device_battery", F.col("parsed_data.device_battery"))
        .withColumn("device_firmware", F.col("parsed_data.device_firmware"))
        .withColumn(
            "sample",
            decompress_sample(
                F.col("parsed_data.sample"),
                F.col("parsed_data._sample_encoding")
            )
        )
        .withColumn("output", F.col("parsed_data.output"))
        .withColumn("user_id", F.col("parsed_data.user_id"))
        # Which protocol produced the row; topic = experiment/data_ingest/v1/<experiment>/<protocol>/...
        .withColumn(
            "protocol_id",
            F.expr(r"nullif(regexp_extract(parsed_data.topic, 'experiment/data_ingest/v1/[^/]+/([^/]+)', 1), '')")
        )
        # Null on single-device uploads; rows of one multi-device workbook
        # run share it and can be joined back on it.
        .withColumn("workbook_run_id", F.col("parsed_data.workbook_run_id"))
        # NOTE: timestamp === normalized UTC timestamp. timezone is the IANA name (e.g. "Europe/Amsterdam").
        # Together they are the source of truth: all local-time representations are derived from these two.
        .withColumn("timezone", F.col("parsed_data.timezone"))
        .withColumn("timestamp", F.col("parsed_data.timestamp"))
        .withColumn("processed_timestamp", F.current_timestamp())
        .withColumn("date", F.to_date("timestamp"))
        .withColumn("hour", F.hour("timestamp"))
        .withColumn(
            "ingest_latency_ms",
            F.unix_timestamp("ingestion_timestamp") - F.unix_timestamp("timestamp")
        )
    )

    def _remap_macro_id(id_col):
        """Remap legacy macro identifiers to actual UUIDs via chained CASE expression."""
        result = id_col
        for legacy_id, actual_id in LEGACY_MACRO_ID_MAP.items():
            result = F.when(id_col == F.lit(legacy_id), F.lit(actual_id)).otherwise(result)
        return result

    df = df.withColumn(
        "macros",
        F.when(
            F.col("parsed_data.macros").isNotNull(),
            F.col("parsed_data.macros")
        ).otherwise(
            F.when(
                F.col("sample").isNotNull(),
                # coalesce guards the parse-failure path: from_json on a non-array
                # sample returns null, which would leave macros null instead of [].
                F.coalesce(
                    F.expr("""
                    flatten(
                        transform(
                            from_json(sample, 'array<string>'),
                            x -> transform(
                                from_json(get_json_object(x, '$.macros'), 'array<string>'),
                                m -> named_struct(
                                    'id', m,
                                    'name', m, 
                                    'filename', m
                                )
                            )
                        )
                    )
                """),
                    F.array(),
                )
            ).otherwise(F.array())
        )
    )

    # Apply legacy macro ID remapping
    df = df.withColumn(
        "macros",
        F.transform(
            F.col("macros"),
            lambda m: F.struct(
                _remap_macro_id(m["id"]).alias("id"),
                m["name"].alias("name"),
                m["filename"].alias("filename")
            )
        )
    )

    df = df.withColumn(
        "questions",
        F.col("parsed_data.questions")
    )

    df = df.withColumn(
        "annotations",
        F.coalesce(F.col("parsed_data.annotations"), F.array())
    )

    df = df.withColumn(
        "id",
        F.abs(
            F.hash(
                F.col("experiment_id"),
                F.col("device_id"),
                F.col("timestamp"),
                F.col("sample"),
                F.col("ingestion_timestamp"),
                F.col("kinesis_sequence_number")
            )
        )
    )

    # Populate missing annotation IDs and rowIds
    # If annotations come from payload without IDs, generate them here
    df = df.withColumn(
        "annotations",
        F.expr("""
            transform(annotations, a -> struct(
                coalesce(a.id, uuid()) as id,
                coalesce(a.rowId, cast(id as string)) as rowId,
                a.type as type,
                a.content as content,
                a.createdBy as createdBy,
                a.createdByName as createdByName,
                coalesce(a.createdAt, current_timestamp()) as createdAt,
                coalesce(a.updatedAt, current_timestamp()) as updatedAt
            ))
        """)
    )

    df = df.withColumn("skip_macro_processing", F.lit(None).cast("boolean"))

    # Select final columns for bronze-sourced silver data
    bronze_clean = df.select(
        "id",
        "device_id",
        "client_id",
        "device_name",
        "device_version",
        "device_battery",
        "device_firmware",
        "sample",
        "output",
        "macros",
        "questions",
        "annotations",
        "user_id",
        "timezone",
        "experiment_id",
        "protocol_id",
        "workbook_run_id",
        "timestamp",
        "date",
        "hour",
        "ingest_latency_ms",
        "processed_timestamp",
        "skip_macro_processing"
    )

    # Read imported data and align to the same schema
    imported_df = dlt.read_stream(RAW_IMPORTED_DATA_TABLE)

    imported_clean = (
        imported_df
        .withColumn("id", F.col("id").cast("long"))
        .withColumn("processed_timestamp", F.current_timestamp())
        .withColumn("date", F.to_date("timestamp"))
        .withColumn("hour", F.hour("timestamp"))
        .withColumn("ingest_latency_ms", F.lit(None).cast("long"))
        .withColumn("timezone", F.lit(None).cast("string"))
        # Imported/transfer rows have no MQTT client identity.
        .withColumn("client_id", F.lit(None).cast("string"))
        # Build macros array from macro columns (empty when no macro)
        # Apply legacy macro ID remapping inline
        .withColumn(
            "macros",
            F.when(
                F.col("macro_id").isNotNull(),
                F.array(
                    F.struct(
                        _remap_macro_id(F.col("macro_id")).alias("id"),
                        F.coalesce(F.col("macro_name"), F.col("macro_filename"), F.col("macro_id")).alias("name"),
                        F.coalesce(F.col("macro_filename"), F.col("macro_id")).alias("filename")
                    )
                )
            ).otherwise(F.array())
        )
        # Parse questions from JSON string if present, otherwise empty array
        .withColumn(
            "questions",
            F.when(
                F.col("questions").isNotNull(),
                F.from_json(F.col("questions"), ArrayType(question_schema))
            ).otherwise(F.array())
        )
        .withColumn("annotations", F.array())
        # Imported/legacy data has no topic and no workbook-run concept.
        .withColumn("protocol_id", F.lit(None).cast("string"))
        .withColumn("workbook_run_id", F.lit(None).cast("string"))
        # Mark imported data to skip macro processing
        .withColumn("skip_macro_processing", F.lit(True))
        .select(
            "id",
            "device_id",
            "client_id",
            "device_name",
            "device_version",
            "device_battery",
            "device_firmware",
            "sample",
            "output",
            "macros",
            "questions",
            "annotations",
            "user_id",
            "timezone",
            "experiment_id",
            "protocol_id",
            "workbook_run_id",
            "timestamp",
            "date",
            "hour",
            "ingest_latency_ms",
            "processed_timestamp",
            "skip_macro_processing"
        )
    )

    # Union bronze-sourced data with imported data
    return bronze_clean.unionByName(imported_clean)
