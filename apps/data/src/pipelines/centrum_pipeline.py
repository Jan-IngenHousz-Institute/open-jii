# Databricks notebook source
# DBTITLE 1,openJII Medallion Architecture Pipeline
# This notebook implements the complete medallion architecture (Bronze-Silver-Gold)
# for openJII IoT sensor data processing following the dual medallion pattern

# COMMAND ----------
import dlt
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType, MapType, ArrayType, IntegerType
from delta.tables import DeltaTable
import requests
import json
import pandas as pd
from datetime import datetime
from multispeq import execute_macro_script
from enrich.user_metadata import add_user_column
from enrich.annotations_metadata import add_annotation_column
from openjii import decompress_sample

# COMMAND ----------

# DBTITLE 1,Schema Definition
# Define schema for sensor data to parse JSON payloads
question_schema = StructType([
    StructField("question_label", StringType(), True),
    StructField("question_text", StringType(), True),
    StructField("question_answer", StringType(), True)
])

macro_schema = StructType([
    StructField("id", StringType(), True),
    StructField("name", StringType(), True),
    StructField("filename", StringType(), True)
])

# Define annotation schema to match the database structure
annotation_content_schema = StructType([
    StructField("text", StringType(), True),
    StructField("flagType", StringType(), True)
])

annotation_schema = StructType([
    StructField("id", StringType(), True),
    StructField("rowId", StringType(), True),
    StructField("type", StringType(), True),
    StructField("content", annotation_content_schema, True),
    StructField("createdBy", StringType(), True),
    StructField("createdByName", StringType(), True),
    StructField("createdAt", TimestampType(), True),
    StructField("updatedAt", TimestampType(), True)
])

sensor_schema = StructType([
    StructField("topic", StringType(), False),
    StructField("device_name", StringType(), True),
    StructField("device_version", StringType(), True),
    StructField("device_id", StringType(), False),
    StructField("device_battery", DoubleType(), True),
    StructField("device_firmware", StringType(), True),
    StructField("sample", StringType(), True),
    StructField("_sample_encoding", StringType(), True),
    StructField("timestamp", TimestampType(), False),
    StructField("output", StringType(), True),
    StructField("questions", ArrayType(question_schema), True),
    StructField("user_id", StringType(), True),
    StructField("macros", ArrayType(macro_schema), True),
    StructField("annotations", ArrayType(annotation_schema), True)
])

# COMMAND ----------

# DBTITLE 1,Configuration

ENVIRONMENT = spark.conf.get("ENVIRONMENT", "dev").lower()
CATALOG_NAME = "open_jii_dev"

BRONZE_TABLE = spark.conf.get("BRONZE_TABLE", "raw_data")
SILVER_TABLE = spark.conf.get("SILVER_TABLE", "clean_data")

KINESIS_STREAM_NAME = spark.conf.get("KINESIS_STREAM_NAME")
CHECKPOINT_PATH = spark.conf.get("CHECKPOINT_PATH")
SERVICE_CREDENTIAL_NAME = spark.conf.get("SERVICE_CREDENTIAL_NAME")
MONITORING_SLACK_CHANNEL = spark.conf.get("MONITORING_SLACK_CHANNEL")

MACROS_PATH = "/Workspace/Shared/macros"

EXPERIMENT_STATUS_TABLE = "experiment_status"
EXPERIMENT_RAW_DATA_TABLE = "experiment_raw_data"
EXPERIMENT_DEVICE_DATA_TABLE = "experiment_device_data"
EXPERIMENT_MACRO_DATA_TABLE = "experiment_macro_data"
EXPERIMENT_CONTRIBUTORS_TABLE = "experiment_contributors"
EXPERIMENT_TABLE_METADATA = "experiment_table_metadata"
ENRICHED_RAW_DATA_VIEW = "enriched_experiment_raw_data"
ENRICHED_MACRO_DATA_VIEW = "enriched_experiment_macro_data"
RAW_AMBYTE_TABLE = "raw_ambyte_data"
ENRICHED_RAW_AMBYTE_DATA_VIEW = "enriched_raw_ambyte_data"
RAW_IMPORTED_DATA_TABLE = "raw_imported_data"

# COMMAND ----------

# DBTITLE 1,Bronze Layer - Raw Data Processing
@dlt.table(
    name=BRONZE_TABLE,
    comment="Bronze layer: Raw sensor data ingested from Kinesis",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableChangeDataFeed": "true",
        "pipelines.reset.allowed": "false"
    }
)
def raw_data():
    """Bronze layer: Ingest raw Kinesis sensor data."""
    
    return (
        spark.readStream
        .format("kinesis")
        .option("streamName", KINESIS_STREAM_NAME)
        .option("initialPosition", "TRIM_HORIZON") 
        .option("serviceCredential", SERVICE_CREDENTIAL_NAME)
        .option("maxRecordsPerFetch", "10000")
        .load()
        .withColumn("ingestion_timestamp", F.current_timestamp())
        # Capture Kinesis metadata
        .withColumn("kinesis_sequence_number", F.col("sequenceNumber"))
        .withColumn("kinesis_shard_id", F.col("shardId"))
        .withColumn("kinesis_arrival_time", F.col("approximateArrivalTimestamp"))
        .withColumn("partitionKey", F.col("partitionKey"))
        # Parse data for basic extraction
        .withColumn("parsed_data", F.from_json(F.col("data").cast("string"), sensor_schema))
        .withColumn("ingest_date", F.to_date(F.col("ingestion_timestamp")))
        # Basic experiment_id extraction for partitioning
        .withColumn("experiment_id", F.coalesce(
            F.regexp_extract(F.col("parsed_data.topic"), r"experiment/data_ingest/v1/([^/]+)/", 1),
            F.regexp_extract(F.col("partitionKey"), r"/experiment/([^/]+)/", 1),
            F.lit(None).cast(StringType())
        ))
        .select(
            "experiment_id", 
            "parsed_data",
            "ingestion_timestamp",
            "ingest_date",
            "kinesis_sequence_number",
            "kinesis_shard_id",
            "kinesis_arrival_time",
            "partitionKey"
        )
    )

# COMMAND ----------

# DBTITLE 1,Silver Layer - Clean Data
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
@dlt.expect_or_drop("valid_device_id", "device_id IS NOT NULL")
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
        .withColumn("timestamp", F.col("parsed_data.timestamp"))
        .withColumn("processed_timestamp", F.current_timestamp())
        .withColumn("date", F.to_date("timestamp"))
        .withColumn("hour", F.hour("timestamp"))
        .withColumn(
            "ingest_latency_ms", 
            F.unix_timestamp("ingestion_timestamp") - F.unix_timestamp("timestamp")
        )
    )

    df = df.withColumn(
        "macros",
        F.when(
            F.col("parsed_data.macros").isNotNull(),
            F.col("parsed_data.macros")
        ).otherwise(
            F.when(
                F.col("sample").isNotNull(),
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
                """)
            ).otherwise(F.array())
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
                F.col("ingestion_timestamp")
            )
        )
    )

    df = df.withColumn(
        "new_id",
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
                coalesce(a.rowId, cast(new_id as string)) as rowId,
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
        "new_id",
        "device_id",
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
        "experiment_id",
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
        .withColumn("new_id", F.col("id").cast("long"))
        .withColumn("processed_timestamp", F.current_timestamp())
        .withColumn("date", F.to_date("timestamp"))
        .withColumn("hour", F.hour("timestamp"))
        .withColumn("ingest_latency_ms", F.lit(None).cast("long"))
        # Build macros array from macro columns (empty when no macro)
        .withColumn(
            "macros",
            F.when(
                F.col("macro_id").isNotNull(),
                F.array(
                    F.struct(
                        F.col("macro_id").alias("id"),
                        F.coalesce(F.col("macro_filename"), F.col("macro_id")).alias("name"),
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
        # Mark imported data to skip macro processing
        .withColumn("skip_macro_processing", F.lit(True))
        .select(
            "id",
            "new_id",
            "device_id",
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
            "experiment_id",
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

# COMMAND ----------

# DBTITLE 1,Gold Layer - Experiment Status
@dlt.table(
    name=EXPERIMENT_STATUS_TABLE,
    comment="Gold layer: Materialized view tracking experiment freshness status",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true"
    }
)
def experiment_status():
    """Track experiment data freshness."""
    FRESHNESS_THRESHOLD_MINUTES = 60
    
    # Read from silver table
    silver_df = dlt.read(SILVER_TABLE)
    
    # Get the current timestamp for comparison
    current_timestamp = F.current_timestamp()
    
    # Calculate the latest timestamp for each experiment_id
    experiment_status_df = (
        silver_df
        .groupBy("experiment_id")
        .agg(
            F.max("timestamp").alias("latest_timestamp"),
            F.max("processed_timestamp").alias("latest_processed_timestamp")
        )
        .filter("experiment_id IS NOT NULL")
    )
    
    freshness_threshold_seconds = FRESHNESS_THRESHOLD_MINUTES * 60
    status_df = (
        experiment_status_df
        .withColumn(
            "status",
            F.when(
                (current_timestamp.cast("long") - F.col("latest_processed_timestamp").cast("long")) <= freshness_threshold_seconds,
                F.lit("fresh")
            ).otherwise(F.lit("stale"))
        )
        .withColumn("status_updated_at", current_timestamp)
    )
    
    return status_df.select(
        "experiment_id",
        "latest_timestamp",
        "latest_processed_timestamp",
        "status",
        "status_updated_at"
    )

# COMMAND ----------

# DBTITLE 1,Gold Layer - Experiment Raw Data
@dlt.table(
    name=EXPERIMENT_RAW_DATA_TABLE,
    comment="Gold layer: Per-experiment raw sample data partitioned by experiment_id with VARIANT sample",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableChangeDataFeed": "true",
        "delta.feature.variantType-preview": "supported"
    }
)
def experiment_raw_data():
    """Per-experiment raw sample data with VARIANT support."""
    
    # Define UDF for sanitizing question labels
    @F.pandas_udf(ArrayType(StructType([
        StructField("question_label", StringType(), True),
        StructField("question_answer", StringType(), True)
    ])))
    def sanitize_questions_udf(questions: pd.Series) -> pd.Series:
        
        def sanitize_label(label):
            if not label:
                return "question_empty"
            
            # Convert to lowercase
            sanitized = label.lower()
            
            # Replace invalid characters with underscores
            invalid_chars = ' ,;{}()\n\t='
            for char in invalid_chars:
                sanitized = sanitized.replace(char, '_')
            
            # Remove leading/trailing underscores
            sanitized = sanitized.strip('_')
            
            # Collapse multiple underscores to single
            while '__' in sanitized:
                sanitized = sanitized.replace('__', '_')
            
            # Ensure it's not empty and doesn't start with a number
            if not sanitized or sanitized[0].isdigit():
                sanitized = f"question_{sanitized}"
            
            return sanitized
        
        def sanitize_questions_array(questions_array):
            if questions_array is None or len(questions_array) == 0:
                return []
            
            result = []
            for q in questions_array:
                if q:
                    result.append({
                        'question_label': sanitize_label(q.get('question_label')),
                        'question_answer': q.get('question_answer')
                    })
            return result
        
        return questions.apply(sanitize_questions_array)
    
    return (
        dlt.read_stream(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .withColumn("data", F.expr("parse_json(sample)"))
        .withColumn(
            "questions_sanitized",
            F.when(
                F.col("questions").isNotNull() & (F.size("questions") > 0),
                sanitize_questions_udf(F.col("questions"))
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
                                array_distinct(transform(questions_sanitized, q -> q.question_label)),
                                transform(
                                    array_distinct(transform(questions_sanitized, q -> q.question_label)),
                                    label -> element_at(filter(questions_sanitized, q -> q.question_label = label), -1).question_answer
                                )
                            )
                        )
                    )
                """)
            )
        )
        .select(
            F.col("new_id").alias("id"),
            "experiment_id",
            "device_id",
            "device_name",
            "timestamp",
            "macros",
            "questions_data",
            "annotations",
            "user_id",
            "data",
            "date",
            "processed_timestamp",
            "skip_macro_processing"
        )
    )

# COMMAND ----------

# DBTITLE 1,Gold Layer - Experiment Device Data
@dlt.table(
    name=EXPERIMENT_DEVICE_DATA_TABLE,
    comment="Gold layer: Device metadata aggregated per experiment",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    }
)
def experiment_device_data():
    """
    Aggregate device stats per experiment from clean_data.
    """
    silver_df = dlt.read(SILVER_TABLE)
    
    return (
        silver_df
        .filter("experiment_id IS NOT NULL")
        .groupBy("experiment_id", "device_id", "device_firmware")
        .agg(
            F.max("device_name").alias("device_name"),
            F.max("device_version").alias("device_version"),
            F.max("device_battery").alias("device_battery"),
            F.count("*").alias("total_measurements"),
            F.max("processed_timestamp").alias("processed_timestamp")
        )
        .withColumn(
            "id",
            F.abs(
                F.hash(
                    F.col("experiment_id"),
                    F.col("device_id"),
                    F.col("device_firmware")
                )
            )
        )
        .select(
            "id",
            "experiment_id",
            "device_id",
            "device_firmware",
            "device_name",
            "device_version",
            "device_battery",
            "total_measurements",
            "processed_timestamp"
        )
    )

# COMMAND ----------

# DBTITLE 1,Gold Layer - Experiment Macro Data
@dlt.table(
    name=EXPERIMENT_MACRO_DATA_TABLE,
    comment="Gold layer: Unified macro processing with VARIANT column for flexible schema",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableChangeDataFeed": "true",
        "delta.feature.variantType-preview": "supported"
    }
)
def experiment_macro_data():
    """Process macros with VARIANT output column."""
    
    # Read from experiment_raw_data and explode macros
    # Skip rows marked as imported (skip_macro_processing = true) since their
    # macro output is already included in the imported data
    base_df = (
        dlt.read_stream(EXPERIMENT_RAW_DATA_TABLE)
        .filter("macros IS NOT NULL")
        .filter("size(macros) > 0")
        .filter("skip_macro_processing IS NOT TRUE")
        .select(
            "id",
            "experiment_id",
            "device_id",
            "device_name",
            "timestamp",
            "user_id",
            "data",
            "date",
            "processed_timestamp",
            "questions_data",
            "annotations",
            F.explode("macros").alias("macro")
        )
        .select(
            "id",
            "experiment_id",
            "device_id",
            "device_name",
            "timestamp",
            "user_id",
            "data",
            "date",
            "processed_timestamp",
            "questions_data",
            "annotations",
            F.col("macro.id").alias("macro_id"),
            F.col("macro.name").alias("macro_name"),
            F.col("macro.filename").alias("macro_filename")
        )
    )
    
    # Define UDF to execute macro and return struct with result and error
    @F.pandas_udf(returnType=StructType([
        StructField("result", StringType(), True),
        StructField("error", StringType(), True)
    ]))
    def execute_macro_udf(pdf: pd.DataFrame) -> pd.DataFrame:
        results = []
        errors = []
        
        for _, row in pdf.iterrows():
            data = row.get("data")
            macro_filename = row.get("macro_filename")
            macro_name = row.get("macro_name")
            
            if pd.isna(data) or pd.isna(macro_filename):
                results.append(None)
                errors.append(f"NULL data or macro_filename (macro: {macro_name})")
                continue
            
            try:
                sample_json = data.toJson()
                
                result = execute_macro_script(macro_filename, sample_json, MACROS_PATH)
                
                if result:
                    results.append(json.dumps(result))
                    errors.append(None)
                else:
                    results.append(None)
                    errors.append(f"Macro returned empty result (macro: {macro_name})")
            except Exception as e:
                results.append(None)
                errors.append(f"{str(e)} (macro: {macro_name})")
        
        return pd.DataFrame({"result": results, "error": errors})
    
    return (
        base_df
        .withColumn("macro_result", execute_macro_udf(F.struct("data", "macro_filename", "macro_name")))
        .withColumn(
            "macro_output",
            F.when(F.col("macro_result.result").isNotNull(), F.expr("parse_json(macro_result.result)"))
        )
        .withColumn("macro_error", F.col("macro_result.error"))
        .withColumn(
            "macro_row_id",
            F.abs(
                F.hash(
                    F.col("id"),
                    F.col("macro_filename"),
                    F.col("processed_timestamp")
                )
            )
        )
        .select(
            "experiment_id",
            F.col("macro_row_id").alias("id"),
            F.col("id").alias("raw_id"),
            "device_id",
            "device_name",
            "timestamp",
            "user_id",
            "macro_id",
            "macro_name",
            "macro_filename",
            "macro_output",
            "macro_error",
            "processed_timestamp",
            "date",
            "questions_data",
            "annotations"
        )
    )

# COMMAND ----------

# DBTITLE 1,Gold Layer - Experiment Table Metadata
@dlt.table(
    name=EXPERIMENT_TABLE_METADATA,
    comment="Gold layer: Consolidated metadata cache for all experiment tables (row counts, schemas). Single query optimization. Replaces EXPERIMENT_MACROS_TABLE and EXPERIMENT_QUESTIONS_TABLE.",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.feature.variantType-preview": "supported",
    }
)
def experiment_table_metadata():
    """Metadata for all experiment tables."""

    macro_metadata = (
        dlt.read(EXPERIMENT_MACRO_DATA_TABLE)
        .filter("macro_output IS NOT NULL")
        .groupBy("experiment_id", "macro_id")
        .agg(
            F.count("*").alias("row_count"),
            F.expr("nullif(schema_of_variant_agg(macro_output), 'VOID')").alias("macro_schema"),
            F.expr("nullif(schema_of_variant_agg(questions_data), 'VOID')").alias("questions_schema")
        )
        .select(
            F.col("experiment_id"),
            F.col("macro_id").alias("identifier"),
            F.lit("macro").alias("table_type"),
            F.col("row_count"),
            F.col("macro_schema"),
            F.col("questions_schema")
        )
    )
    
    raw_data_metadata = (
        dlt.read(EXPERIMENT_RAW_DATA_TABLE)
        .groupBy("experiment_id")
        .agg(
            F.count("*").alias("row_count"),
            F.expr("nullif(schema_of_variant_agg(questions_data), 'VOID')").alias("questions_schema")
        )
        .select(
            F.col("experiment_id"),
            F.lit("raw_data").alias("identifier"),
            F.lit("static").alias("table_type"),
            F.col("row_count"),
            F.lit(None).cast("string").alias("macro_schema"),
            F.col("questions_schema")
        )
    )
    
    device_metadata = (
        dlt.read(EXPERIMENT_DEVICE_DATA_TABLE)
        .groupBy("experiment_id")
        .agg(F.count("*").alias("row_count"))
        .select(
            F.col("experiment_id"),
            F.lit("device").alias("identifier"),
            F.lit("static").alias("table_type"),
            F.col("row_count"),
            F.lit(None).cast("string").alias("macro_schema"),
            F.lit(None).cast("string").alias("questions_schema")
        )
    )
    
    ambyte_metadata = (
        dlt.read(RAW_AMBYTE_TABLE)
        .groupBy("experiment_id")
        .agg(F.count("*").alias("row_count"))
        .select(
            F.col("experiment_id"),
            F.lit("raw_ambyte_data").alias("identifier"),
            F.lit("static").alias("table_type"),
            F.col("row_count"),
            F.lit(None).cast("string").alias("macro_schema"),
            F.lit(None).cast("string").alias("questions_schema")
        )
    )
    
    return (
        macro_metadata
        .unionByName(raw_data_metadata)
        .unionByName(device_metadata)
        .unionByName(ambyte_metadata)
    )

# COMMAND ----------

# DBTITLE 1,Gold Layer - Experiment Contributors
@dlt.table(
    name=EXPERIMENT_CONTRIBUTORS_TABLE,
    comment="Gold layer: Cached user profiles for enrichment (full refresh on each pipeline run)",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true"
    }
)
def experiment_contributors():
    """Cached user profiles per experiment."""
    
    unique_users = (
        dlt.read(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .filter("user_id IS NOT NULL")
        .select("experiment_id", "user_id")
        .distinct()
    )
    
    return add_user_column(unique_users, ENVIRONMENT, dbutils)

# COMMAND ----------

# DBTITLE 1,Gold Layer - Enriched Experiment Raw Data
@dlt.table(
    name=ENRICHED_RAW_DATA_VIEW,
    comment="Enriched materialized view: Raw data with questions, user struct, and annotations. Incrementally refreshed.",
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
    """Enriched raw data with user profiles and annotations."""
    raw_data = dlt.read(EXPERIMENT_RAW_DATA_TABLE)
    contributors = dlt.read(EXPERIMENT_CONTRIBUTORS_TABLE)
    
    enriched = (
        raw_data
        .join(
            contributors,
            (raw_data.experiment_id == contributors.experiment_id) & 
            (raw_data.user_id == contributors.user_id),
            "left"
        )
        .select(
            raw_data.experiment_id,
            raw_data.id,
            raw_data.device_id,
            raw_data.device_name,
            raw_data.timestamp,
            raw_data.date,
            raw_data.macros,
            raw_data.questions_data,
            raw_data.annotations,
            contributors.user.alias("contributor"),
            raw_data.data,
            raw_data.processed_timestamp
        )
    )
    
    return add_annotation_column(
        enriched,
        table_name="experiment_raw_data",
        catalog_name=CATALOG_NAME,
        experiment_schema="centrum",
        spark=spark
    )

# COMMAND ----------

# DBTITLE 1,Gold Layer - Enriched Raw Ambyte Data
@dlt.table(
    name=ENRICHED_RAW_AMBYTE_DATA_VIEW,
    comment="Enriched materialized view: Raw ambyte data with annotations. Incrementally refreshed.",
    table_properties={
        "quality": "gold",
        "delta.enableRowTracking": "true",
        "delta.enableChangeDataFeed": "true",
        "delta.enableDeletionVectors": "true",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
    }
)
def enriched_raw_ambyte_data():
    """Enriched ambyte data with annotations."""
    raw_ambyte = dlt.read(RAW_AMBYTE_TABLE).drop("_rescued_data")
    
    return add_annotation_column(
        raw_ambyte,
        table_name="raw_ambyte_data",
        catalog_name=CATALOG_NAME,
        experiment_schema="centrum",
        spark=spark
    )

# COMMAND ----------

# DBTITLE 1,Gold Layer - Enriched Experiment Macro Data
@dlt.table(
    name=ENRICHED_MACRO_DATA_VIEW,
    comment="Enriched materialized view: Macro data with expanded VARIANT, questions, user struct, and annotations. Incrementally refreshed.",
    table_properties={
        "quality": "gold",
        "delta.enableDeletionVectors": "true",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.feature.variantType-preview": "supported",
    }
)
def enriched_experiment_macro_data():
    """Enriched macro data with user profiles and annotations."""
    macro_data = dlt.read(EXPERIMENT_MACRO_DATA_TABLE)
    contributors = dlt.read(EXPERIMENT_CONTRIBUTORS_TABLE)
    
    enriched = (
        macro_data
        .join(
            contributors,
            (macro_data.experiment_id == contributors.experiment_id) & 
            (macro_data.user_id == contributors.user_id),
            "left"
        )
        .select(
            macro_data.experiment_id,
            macro_data.id,
            macro_data.raw_id,
            macro_data.device_id,
            macro_data.device_name,
            macro_data.timestamp,
            macro_data.date,
            contributors.user.alias("contributor"),
            macro_data.macro_id,
            macro_data.macro_name,
            macro_data.macro_filename,
            macro_data.macro_output,
            macro_data.macro_error,
            macro_data.processed_timestamp,
            macro_data.questions_data,
            macro_data.annotations
        )
    )
    
    return add_annotation_column(
        enriched,
        table_name="experiment_macro_data",  # Generic macro data table name
        catalog_name=CATALOG_NAME,
        experiment_schema="centrum",
        spark=spark
    )

# COMMAND ----------

# DBTITLE 1,Raw Imported Data - Streaming Table
@dlt.table(
    name=RAW_IMPORTED_DATA_TABLE,
    comment="Streaming table: Imported measurement data from external platforms (e.g., PhotosynQ transfers), partitioned by experiment_id",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true"
    },
    partition_cols=["experiment_id"]
)
def raw_imported_data():
    """Streaming ingestion of imported measurement data from parquet files in data-imports volume."""
    imported_path = f"/Volumes/{CATALOG_NAME}/centrum/data-imports/*/photosynq_transfer"
    
    schema_location = f"/Volumes/{CATALOG_NAME}/centrum/data-imports/_schemas/imported_data_schema"
    
    df = (
        spark.readStream
        .format("cloudFiles")
        .option("cloudFiles.format", "parquet")
        .option("cloudFiles.schemaLocation", schema_location)
        .option("recursiveFileLookup", "true")
        .load(imported_path)
    )
    
    return (
        df
        .withColumn(
            "id",
            F.coalesce(
                F.col("id"),
                F.abs(F.hash(*[F.col(c) for c in df.columns])).cast("string")
            )
        )
        .withColumn("ingestion_timestamp", F.current_timestamp())
    )

# COMMAND ----------

# DBTITLE 1,Raw Ambyte Data - Streaming Table
@dlt.table(
    name=RAW_AMBYTE_TABLE,
    comment="Streaming table: Pre-processed Ambyte trace data from parquet files, partitioned by experiment_id",
    table_properties={
        "quality": "bronze",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true"
    },
    partition_cols=["experiment_id"]
)
def raw_ambyte_data():
    """Streaming ingestion of pre-processed Ambyte trace data."""
    processed_path = f"/Volumes/{CATALOG_NAME}/centrum/data-imports/*/processed-ambyte"
    
    schema_location = f"/Volumes/{CATALOG_NAME}/centrum/data-imports/_schemas/ambyte_schema"
    
    df = (
        spark.readStream
        .format("cloudFiles")
        .option("cloudFiles.format", "parquet")
        .option("cloudFiles.schemaLocation", schema_location)
        .option("recursiveFileLookup", "true")
        .load(processed_path)
    )
    
    path_experiment_id = F.regexp_extract(
        F.col("_metadata.file_path"), r"data-imports/([^/]+)/processed-ambyte", 1
    )

    if "experiment_id" in df.columns:
        df = df.withColumn("experiment_id", F.coalesce(F.col("experiment_id"), path_experiment_id))
    else:
        df = df.withColumn("experiment_id", path_experiment_id)
    
    return (
        df
        .withColumn(
            "id",
            F.abs(F.hash(*[F.col(c) for c in df.columns]))
        )
    )

# COMMAND ----------

# DBTITLE 1,Event Hook - Slack Notifications
@dlt.on_event_hook(max_allowable_consecutive_failures=3)
def send_slack_notifications(event):

    # Get the webhook URL from the secret scope
    SLACK_WEBHOOK_URL = dbutils.secrets.get(scope=f"event-hooks-{ENVIRONMENT}", key="slack-webhook-url")
    SLACK_HEADERS = {
        'Content-Type': 'application/json'
    }

    if (
        event['event_type'] in ['update_progress', 'flow_progress', 'operation_progress']
        and event['details'].get(event['event_type'], {}).get('state') in ['FAILED', 'STOPPED']
    ):
        event_type = event['event_type']
        state = event['details'].get(event['event_type'], {}).get('state')
        pipeline_id = event['origin'].get('pipeline_id')
        pipeline_name = event['origin'].get('pipeline_name')
        update_id = event['origin'].get('update_id')
        
        color = "#FF0000" if state == 'FAILED' else "#FFA500"
        
        try:
            databricks_host = dbutils.secrets.get(scope=f"event-hooks-{ENVIRONMENT}", key="databricks-host")
        except Exception:
            databricks_host = None
        
        if databricks_host:
            workspace_url = databricks_host
            pipeline_url = f"{databricks_host}/pipelines/{pipeline_id}"
            update_url = f"{databricks_host}/pipelines/{pipeline_id}/updates/{update_id}"
        else:
            workspace_url = None
            pipeline_url = None
            update_url = None
        
        timestamp = event.get('timestamp')
        if timestamp and isinstance(timestamp, (int, float)):
            timestamp = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S UTC')
        
        def slack_link(url, text):
            return f"<{url}|{text}>" if url else text
        
        payload = {
            "channel": MONITORING_SLACK_CHANNEL,
            "text": f"{pipeline_name} — a run has {state.lower()}.",
            "attachments": [
                {
                    "color": color,
                    "fields": [
                        {
                            "title": "Workspace:",
                            "value": slack_link(workspace_url, f"open-jii-databricks-workspace-{ENVIRONMENT}"),
                            "short": True
                        },
                        {
                            "title": "Job:",
                            "value": slack_link(pipeline_url, pipeline_name),
                            "short": True
                        },
                        {
                            "title": "Update:",
                            "value": slack_link(update_url, update_id),
                            "short": True
                        },
                        {
                            "title": "State:",
                            "value": state,
                            "short": True
                        },
                        {
                            "title": "Environment:",
                            "value": ENVIRONMENT.upper(),
                            "short": True
                        },
                        {
                            "title": "Event Type:",
                            "value": event_type,
                            "short": True
                        }
                    ],
                    "actions": [
                        {
                            "type": "button",
                            "text": "View Pipeline",
                            "url": pipeline_url
                        },
                        {
                            "type": "button", 
                            "text": "View Workspace",
                            "url": workspace_url
                        }
                    ]
                }
            ]
        }
        
        try:
            response = requests.post(
                url=SLACK_WEBHOOK_URL,
                headers=SLACK_HEADERS,
                json=payload
            )
            print(f"Slack notification sent: {event_type} - {state}")
        except Exception as e:
            print(f"Failed to send Slack notification: {e}")
