"""
Custom Metadata Enrichment

Provides utilities for enriching Databricks DataFrames with user-uploaded
custom metadata by joining on a question answer as the primary key.

The `experiment_metadata` table (written by the backend) stores one or more
VARIANT blobs per experiment, each with the shape:
    {
        columns: [...],
        rows: [ { col_id: value, ... }, ... ],
        identifierColumnId: "<col_id whose value matches the question answer>",
        experimentQuestionId: "<question label whose answer is the join key>"
    }

Multiple metadata records can exist per experiment.  When enriching, each
record is resolved independently against the measurement row's question
answer, and all matching metadata row objects are merged via
`object_merge()` into a single `custom_metadata` VARIANT column.

Join logic per measurement row per metadata record:
    1. Extract experimentQuestionId  → e.g. "plot_id"
    2. From the row's questions_data VARIANT, get the answer for that question
    3. Extract identifierColumnId    → e.g. "col_abc123"
    4. Find the metadata row where   row[identifierColumnId] == answer
    5. Collect all matched rows across all metadata records
    6. object_merge() them into a single VARIANT `custom_metadata` column
"""

from pyspark.sql import functions as F
from pyspark.sql.types import StringType, ArrayType, MapType


def add_custom_metadata_column(df, metadata_df):
    """
    Enrich measurement rows with user-uploaded custom metadata.

    Joins on `experiment_id` (1:N – potentially multiple metadata records
    per experiment), resolves the per-row match via the dynamic
    question-answer key for each metadata record, then merges all matched
    metadata objects via ``object_merge()``.

    Args:
        df: PySpark DataFrame with 'experiment_id' and 'questions_data' (VARIANT) columns.
        metadata_df: PySpark DataFrame from the metadata DLT source table
            (passed via dlt.read() for incremental refresh support).
            Expected columns: metadata_id, experiment_id, metadata (VARIANT)

    Returns:
        DataFrame with an additional `custom_metadata` VARIANT column.
        NULL when no metadata exists or no matching row is found.
    """
    try:
        # Extract structural fields from each VARIANT metadata blob.
        metadata_parsed = (
            metadata_df
            .withColumn(
                "_meta_question_id",
                F.expr("variant_get(metadata, '$.experimentQuestionId', 'STRING')")
            )
            .withColumn(
                "_meta_id_column",
                F.expr("variant_get(metadata, '$.identifierColumnId', 'STRING')")
            )
            .withColumn(
                "_meta_rows_json",
                F.expr("to_json(variant_get(metadata, '$.rows', 'VARIANT'))")
            )
            .select(
                F.col("experiment_id").alias("_meta_experiment_id"),
                F.col("metadata_id").alias("_meta_metadata_id"),
                "_meta_question_id",
                "_meta_id_column",
                "_meta_rows_json",
            )
        )

        # Left join on experiment_id (1:N — multiple metadata records per experiment).
        enriched = df.join(
            metadata_parsed,
            df.experiment_id == metadata_parsed._meta_experiment_id,
            "left",
        ).drop("_meta_experiment_id")

        # Parse the JSON rows array into an array of maps.
        enriched = enriched.withColumn(
            "_meta_rows",
            F.from_json(
                F.col("_meta_rows_json"),
                ArrayType(MapType(StringType(), StringType())),
            ),
        )

        # Extract the join key from this row's questions_data using the dynamic question label.
        enriched = enriched.withColumn(
            "_meta_join_key",
            F.expr(
                "variant_get(questions_data, concat('$.', _meta_question_id), 'STRING')"
            ),
        )

        # Find the matching metadata row for this particular metadata record.
        enriched = enriched.withColumn(
            "_meta_matched",
            F.when(
                F.col("_meta_join_key").isNotNull()
                & F.col("_meta_rows").isNotNull(),
                F.expr(
                    """
                    parse_json(
                        to_json(
                            filter(
                                _meta_rows,
                                r -> element_at(r, _meta_id_column) = _meta_join_key
                            )[0]
                        )
                    )
                    """
                ),
            ),
        )

        # Collect all matched metadata objects per original row and merge them.
        # Use the original DataFrame columns to group back.
        original_cols = [c for c in df.columns]

        enriched = (
            enriched
            .groupBy(*original_cols)
            .agg(
                F.expr(
                    "aggregate("
                    "  collect_list(_meta_matched),"
                    "  cast(null as variant),"
                    "  (acc, x) -> CASE"
                    "    WHEN acc IS NULL THEN x"
                    "    WHEN x IS NULL THEN acc"
                    "    ELSE object_merge(acc, x)"
                    "  END"
                    ")"
                ).alias("custom_metadata")
            )
        )

        print("Custom metadata enrichment join completed successfully")
        return enriched

    except Exception as e:
        print(f"Warning: Could not join with experiment metadata table: {str(e)}")
        print("Continuing without custom metadata enrichment...")
        return df.withColumn("custom_metadata", F.lit(None).cast("string"))
