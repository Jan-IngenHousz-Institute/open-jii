# Databricks notebook source
# DBTITLE 1,Gold Layer - Experiment Raw Data
# Gold: per-experiment raw sample data with VARIANT support, sanitized question
# labels, and inline-repair application.

# COMMAND ----------
import dlt
import pandas as pd
from pyspark.sql import functions as F
from pyspark.sql.types import ArrayType, StringType, StructField, StructType

from data_repair import apply_inline_repairs
from openjii.centrum import EXPERIMENT_RAW_DATA_TABLE
from openjii.centrum.runtime import SILVER_TABLE

# COMMAND ----------

@dlt.table(
    name=EXPERIMENT_RAW_DATA_TABLE,
    comment="Gold layer: Per-experiment raw sample data partitioned by experiment_id with VARIANT sample",
    table_properties={
        "quality": "gold",
        "pipelines.autoOptimize.managed": "true",
        "delta.autoOptimize.optimizeWrite": "true",
        "delta.autoOptimize.autoCompact": "true",
        "delta.enableRowTracking": "true",
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

            # Allowlist: lowercase ASCII letters, digits, underscore.
            # Anything else collapses to a single underscore so the result is
            # safe as a Spark identifier and as a JSON/VARIANT key, regardless
            # of where it gets rendered downstream (SQL, CSV, Excel, UI).
            sanitized = ''.join(
                c if (c == '_' or (c.isascii() and c.isalnum())) else '_'
                for c in label.lower()
            )
            while '__' in sanitized:
                sanitized = sanitized.replace('__', '_')
            sanitized = sanitized.strip('_')

            if not sanitized or sanitized[0].isdigit():
                sanitized = f"question_{sanitized}"

            return sanitized

        def sanitize_questions_array(questions_array):
            if questions_array is None or len(questions_array) == 0:
                return []

            # Disambiguate duplicate sanitized labels so downstream
            # map_from_arrays doesn't collapse them and lose answers.
            # Strategy:
            #   - unique label in row -> bare label
            #   - label collides, sanitized text differs from sanitized label
            #       -> "<label>__<text>"
            #   - label collides but text adds nothing (empty, or same as label
            #       after sanitization, e.g. uncustomized default)
            #       -> positional fallback "_2", "_3" on bare label
            #   - label and text both collide
            #       -> positional fallback on the combined "<label>__<text>" key
            base_labels = [
                sanitize_label(q.get('question_label')) if q else None
                for q in questions_array
            ]
            label_total: dict[str, int] = {}
            for bl in base_labels:
                if bl is not None:
                    label_total[bl] = label_total.get(bl, 0) + 1

            key_counts: dict[str, int] = {}
            result = []
            for i, q in enumerate(questions_array):
                if not q:
                    continue
                base = base_labels[i]
                if label_total.get(base, 0) <= 1:
                    key = base
                else:
                    text = q.get('question_text')
                    text_part = sanitize_label(text) if text else None
                    if not text_part or text_part == base:
                        candidate = base
                    else:
                        candidate = f"{base}__{text_part}"
                    count = key_counts.get(candidate, 0) + 1
                    key_counts[candidate] = count
                    key = candidate if count == 1 else f"{candidate}_{count}"
                result.append({
                    'question_label': key,
                    'question_answer': q.get('question_answer')
                })
            return result

        return questions.apply(sanitize_questions_array)

    return (
        dlt.read_stream(SILVER_TABLE)
        .filter("experiment_id IS NOT NULL")
        .withColumn("data", F.expr("parse_json(sample)"))
        .withColumn("output_data", F.expr("try_parse_json(output)"))
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
                                transform(questions_sanitized, q -> q.question_label),
                                transform(questions_sanitized, q -> q.question_answer)
                            )
                        )
                    )
                """)
            )
        )
        .select(
            "id",
            "experiment_id",
            "device_id",
            "client_id",
            "device_name",
            "timestamp",
            "timezone",
            "macros",
            "questions_data",
            "annotations",
            "user_id",
            "protocol_id",
            "workbook_run_id",
            "workbook_version_id",
            "macro_context",
            "data",
            "output_data",
            "date",
            "processed_timestamp",
            "skip_macro_processing"
        )
        .transform(lambda df: apply_inline_repairs(df, EXPERIMENT_RAW_DATA_TABLE))
    )
