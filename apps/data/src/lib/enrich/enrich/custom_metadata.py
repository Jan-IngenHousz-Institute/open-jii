"""Custom Metadata Enrichment

Enriches measurement DataFrames with user-uploaded custom metadata.
Groups raw metadata records per experiment before joining so the
measurement DataFrame is never fanned-out.
"""

from pyspark.sql import functions as F


def _group_metadata(metadata_df):
    """Collapse raw metadata rows into one row per experiment."""
    return (
        metadata_df
        .groupBy("experiment_id")
        .agg(F.collect_list("metadata").alias("_meta_records"))
    )


def add_custom_metadata_column(df, metadata_df):
    """
    Enrich measurement rows with user-uploaded custom metadata.

    Args:
        df: PySpark DataFrame with 'experiment_id' and 'questions_data' columns.
        metadata_df: Raw metadata DataFrame with 'experiment_id' and 'metadata'
            VARIANT column (straight from the DLT mirror table).

    Returns:
        DataFrame with an additional `custom_metadata` VARIANT column.
    """
    try:
        grouped = _group_metadata(metadata_df)

        enriched = df.join(grouped, "experiment_id", "left")

        enriched = enriched.withColumn(
            "custom_metadata",
            F.when(
                F.col("_meta_records").isNotNull(),
                F.expr(
                    """
                    aggregate(
                        transform(
                            _meta_records,
                            meta -> parse_json(to_json(map_filter(
                                cast(
                                    filter(
                                        cast(variant_get(meta, '$.rows', 'VARIANT') as ARRAY<VARIANT>),
                                        r -> variant_get(r, concat('$.', variant_get(meta, '$.identifierColumnId', 'STRING')), 'STRING')
                                             = variant_get(questions_data, concat('$.', variant_get(meta, '$.experimentQuestionId', 'STRING')), 'STRING')
                                    )[0]
                                    AS MAP<STRING, VARIANT>
                                ),
                                (k, v) -> k != '_id'
                                           AND k != variant_get(meta, '$.identifierColumnId', 'STRING')
                            )))
                        ),
                        cast(null as variant),
                        (acc, x) -> CASE
                            WHEN acc IS NULL THEN x
                            WHEN x IS NULL THEN acc
                            ELSE parse_json(to_json(map_concat(
                                cast(acc AS MAP<STRING, VARIANT>),
                                cast(x AS MAP<STRING, VARIANT>)
                            )))
                        END
                    )
                    """
                ),
            ),
        ).drop("_meta_records")

        print("Custom metadata enrichment completed")
        return enriched

    except Exception as e:
        print(f"Warning: Could not enrich with experiment metadata: {str(e)}")
        return df.withColumn("custom_metadata", F.lit(None).cast("variant"))
