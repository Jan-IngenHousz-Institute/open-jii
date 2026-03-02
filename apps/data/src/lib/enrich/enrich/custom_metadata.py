"""
Custom Metadata Enrichment

Provides utilities for enriching Databricks DataFrames with user-uploaded
custom metadata by joining on a question answer as the primary key.

The `experiment_metadata` table (written by the backend) stores a single
VARIANT blob per experiment with the shape:
    {
        columns: [...],
        rows: [ { col_id: value, ... }, ... ],
        identifierColumnId: "<col_id whose value matches the question answer>",
        experimentQuestionId: "<question label whose answer is the join key>"
    }

Join logic per measurement row:
    1. Extract experimentQuestionId  → e.g. "plot_id"
    2. From the row's questions_data VARIANT, get the answer for that question
    3. Extract identifierColumnId    → e.g. "col_abc123"
    4. Find the metadata row where   row[identifierColumnId] == answer
    5. Attach that row as a VARIANT  `custom_metadata` column
"""

from pyspark.sql import functions as F
from pyspark.sql.types import StringType, ArrayType, MapType


def add_custom_metadata_column(df, metadata_df):
    """
    Enrich measurement rows with user-uploaded custom metadata.

    Joins on `experiment_id` (1:1), then resolves the per-row match
    via the dynamic question-answer key.

    Args:
        df: PySpark DataFrame with 'experiment_id' and 'questions_data' (VARIANT) columns.
        metadata_df: PySpark DataFrame from the metadata DLT source table
            (passed via dlt.read() for incremental refresh support).
            Expected columns: experiment_id, metadata (VARIANT)

    Returns:
        DataFrame with an additional `custom_metadata` VARIANT column.
        NULL when no metadata exists or no matching row is found.
    """
    try:
        # Extract structural fields from the VARIANT metadata blob.
        # - question_id:  the question label whose answer is the join key
        # - id_column:    the column ID in the metadata rows that holds the matching value
        # - rows_json:    the rows array serialized to JSON for from_json parsing
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
                "_meta_question_id",
                "_meta_id_column",
                "_meta_rows_json",
            )
        )

        # Left join on experiment_id (1:1 — one metadata row per experiment).
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
        #   questions_data is VARIANT like {"plot_id": "plot_1", ...}
        #   _meta_question_id is STRING like "plot_id"
        #   → variant_get(questions_data, '$.plot_id', 'STRING') → "plot_1"
        enriched = enriched.withColumn(
            "_meta_join_key",
            F.expr(
                "variant_get(questions_data, concat('$.', _meta_question_id), 'STRING')"
            ),
        )

        # Find the matching metadata row: the one where row[identifierColumnId] == join_key.
        # filter() returns an array; take the first match and convert back to VARIANT.
        enriched = enriched.withColumn(
            "custom_metadata",
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

        # Drop internal columns.
        enriched = enriched.drop(
            "_meta_question_id",
            "_meta_id_column",
            "_meta_rows_json",
            "_meta_rows",
            "_meta_join_key",
        )

        print("Custom metadata enrichment join completed successfully")
        return enriched

    except Exception as e:
        print(f"Warning: Could not join with experiment metadata table: {str(e)}")
        print("Continuing without custom metadata enrichment...")
        return df.withColumn("custom_metadata", F.lit(None).cast("string"))
